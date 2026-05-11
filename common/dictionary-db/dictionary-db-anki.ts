import { Anki, escapeAnkiDeckQuery, escapeAnkiQuery, NoteInfo } from '@project/common/anki';
import {
    DictionaryBuildAnkiCacheStart,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateError as DictionaryBuildAnkiCacheError,
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateType,
    DictionaryBuildAnkiCacheStats,
    DictionaryBuildAnkiCacheProgress,
    Progress,
} from '@project/common';
import {
    AsbplayerSettings,
    dictionaryStatusCollectionEnabled,
    DictionaryTokenSource,
    DictionaryTrack,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { HAS_LETTER_REGEX, inBatches, mapAsync } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan/yomitan';
import { v4 as uuidv4 } from 'uuid';
import {
    _DictionaryDatabase,
    BUILD_MIN_EXPIRATION_MS,
    _buildIdHealthCheck,
    _clearBuildIds,
    DictionaryAnkiCardKey,
    DictionaryAnkiCardRecord,
    DictionaryMetaKey,
    _DictionaryTokenRecord,
    _ensureBuildId,
    _gatherModifiedTokens,
    _getFromSourceBulk,
    _saveRecordBulk,
    TrackStateForDB,
} from '@project/common/dictionary-db';

/**
 * If adding/removing fields here, add/remove the UI helperText in the settings tab
 */
interface AnkiCacheSettingsDependencies {
    ankiConnectUrl: string;
    dictionaryYomitanUrl: string;
    dictionaryYomitanParser: string;
    dictionaryYomitanScanLength: number;
    dictionaryAnkiDecks: string[];
    dictionaryAnkiWordFields: string[];
    dictionaryAnkiSentenceFields: string[];
    dictionaryAnkiMatureCutoff: number;
}

type CardsForDB = Map<
    number,
    {
        noteId: number;
        deckName: string;
        fields: Map<string, string>;
        modifiedAt: number;
        statuses: Map<number, TokenStatus>;
        suspended: boolean;
    }
>;

type AnkiTrackStatesForDB = Map<number, TrackStateForDB>;

export async function buildAnkiCachePipeline(
    db: _DictionaryDatabase,
    profile: string,
    settings: AsbplayerSettings,
    statusUpdates: (state: DictionaryBuildAnkiCacheState) => void
): Promise<void> {
    const modifiedTokens = new Set<string>();

    const anki = new Anki(settings);
    try {
        const permission = (await anki.requestPermission()).permission;
        if (permission !== 'granted') throw new Error(`permission ${permission}`);
    } catch (e) {
        console.error(e);
        statusUpdates({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: {
                code: DictionaryBuildAnkiCacheStateErrorCode.noAnki,
                msg: e instanceof Error ? e.message : String(e),
                modifiedTokens: Array.from(modifiedTokens),
            } as DictionaryBuildAnkiCacheError,
        });
        return;
    }

    const buildId = uuidv4();
    const buildTs = Date.now();
    const activeTracks: DictionaryMetaKey[] = [];
    let shouldClearBuildIds = true;
    statusUpdates({
        type: DictionaryBuildAnkiCacheStateType.start,
        body: {
            buildTimestamp: buildTs,
        } as DictionaryBuildAnkiCacheStart,
    });

    try {
        const trackStates: AnkiTrackStatesForDB = new Map();
        const settingsToUpdate: { key: DictionaryMetaKey; settings: string }[] = [];
        const tracksToClear: number[] = [];
        for (const [track, dt] of settings.dictionaryTracks.entries()) {
            const key: DictionaryMetaKey = [profile, track];
            let prevSettings: string | null = null;
            const existingBuild = await db.transaction('rw', db.meta, async () => {
                if (await _ensureBuildId(db, key, buildId, 'anki', { buildTs })) {
                    prevSettings = (await db.meta.get(key))!.ankiMeta.settings;
                    return;
                }
                return db.meta.where('[profile+track]').equals(key).first();
            });
            if (existingBuild !== undefined) {
                console.error(`Build already in progress - expires at ${existingBuild.ankiMeta.lastBuildExpiresAt}`);
                statusUpdates({
                    type: DictionaryBuildAnkiCacheStateType.error,
                    body: {
                        code: DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild,
                        modifiedTokens: Array.from(modifiedTokens),
                        data: {
                            expiration: existingBuild.ankiMeta.lastBuildExpiresAt,
                        },
                    } as DictionaryBuildAnkiCacheError,
                });
                return; // Since we set the buildId for all tracks regardless of enabled status, concurrent builds are prevented
            }
            activeTracks.push(key);

            if (!dictionaryStatusCollectionEnabled(dt)) continue; // Keep cache but don't update it TODO: Clear tracks that have been disabled for a while from db?
            if (!dt.dictionaryAnkiWordFields.length && !dt.dictionaryAnkiSentenceFields.length) {
                tracksToClear.push(track); // Explicitly clear tracks with no Anki fields
                continue;
            }
            const yomitan = new Yomitan(dt);
            try {
                await yomitan.version();
            } catch (e) {
                console.error(e);
                statusUpdates({
                    type: DictionaryBuildAnkiCacheStateType.error,
                    body: {
                        code: DictionaryBuildAnkiCacheStateErrorCode.noYomitan,
                        msg: e instanceof Error ? e.message : String(e),
                        data: { track },
                        modifiedTokens: Array.from(modifiedTokens),
                    } as DictionaryBuildAnkiCacheError,
                });
                return;
            }
            trackStates.set(track, { dt, yomitan });

            const currSettings: AnkiCacheSettingsDependencies = {
                ankiConnectUrl: settings.ankiConnectUrl,
                dictionaryYomitanUrl: dt.dictionaryYomitanUrl,
                dictionaryYomitanParser: dt.dictionaryYomitanParser,
                dictionaryYomitanScanLength: dt.dictionaryYomitanScanLength,
                dictionaryAnkiDecks: dt.dictionaryAnkiDecks,
                dictionaryAnkiWordFields: dt.dictionaryAnkiWordFields,
                dictionaryAnkiSentenceFields: dt.dictionaryAnkiSentenceFields,
                dictionaryAnkiMatureCutoff: dt.dictionaryAnkiMatureCutoff,
            };
            const currSettingsStr = JSON.stringify(currSettings);
            if (currSettingsStr === prevSettings) continue;
            settingsToUpdate.push({ key, settings: currSettingsStr });
            tracksToClear.push(track); // Clear track if settings have changed
        }

        let numCardsFromOrphanedTracks = 0;
        if (tracksToClear.length) {
            const orphanedTrackCardIds = await _orphanAllCardIds(db, profile, tracksToClear);
            numCardsFromOrphanedTracks = Array.from(orphanedTrackCardIds.values()).reduce((a, b) => a + b.length, 0);
            await db.transaction('rw', db.tokens, db.ankiCards, db.meta, async () => {
                await _buildIdHealthCheck(db, buildId, 'anki', activeTracks);
                await _deleteCardBulk(db, profile, orphanedTrackCardIds, modifiedTokens);
                await _gatherModifiedTokens(db, profile, modifiedTokens);
                for (const { key, settings } of settingsToUpdate) {
                    const trackMeta = await db.meta.get(key);
                    if (!trackMeta) continue;
                    await db.meta.update(key, {
                        ankiMeta: {
                            ...trackMeta.ankiMeta,
                            settings,
                        },
                    });
                }
            });
            if (!trackStates.size) {
                statusUpdates({
                    type: DictionaryBuildAnkiCacheStateType.stats,
                    body: {
                        buildTimestamp: buildTs,
                        tracksToClear,
                        orphanedCards: numCardsFromOrphanedTracks,
                        modifiedTokens: Array.from(modifiedTokens),
                    } as DictionaryBuildAnkiCacheStats,
                });
                return;
            }
        } else if (!trackStates.size) {
            statusUpdates({
                type: DictionaryBuildAnkiCacheStateType.stats,
                body: {
                    buildTimestamp: buildTs,
                    modifiedTokens: Array.from(modifiedTokens),
                } as DictionaryBuildAnkiCacheStats,
            });
            return;
        }

        const modifiedCards: CardsForDB = new Map();
        const orphanedTrackCardIds: Map<number, number[]> = new Map();
        let numUpdatedCards = 0;
        try {
            numUpdatedCards = await _syncTrackStatesWithAnki(
                db,
                profile,
                trackStates,
                modifiedCards,
                orphanedTrackCardIds,
                anki,
                buildId,
                activeTracks,
                statusUpdates
            );
            for (const [track, ts] of trackStates.entries()) {
                await _buildAnkiCardStatuses(track, ts, modifiedCards, anki);
            }
        } catch (e) {
            console.error(e);
            statusUpdates({
                type: DictionaryBuildAnkiCacheStateType.error,
                body: {
                    msg: e instanceof Error ? e.message : String(e),
                    code: DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates,
                    modifiedTokens: Array.from(modifiedTokens),
                } as DictionaryBuildAnkiCacheError,
            });
            return;
        }

        // Usually less than 5s to this point, building the tokens may take a while and is unlikely to fail
        void _processTracks(
            db,
            profile,
            buildId,
            trackStates,
            modifiedCards,
            orphanedTrackCardIds,
            tracksToClear,
            numCardsFromOrphanedTracks,
            modifiedTokens,
            activeTracks,
            numUpdatedCards,
            buildTs,
            statusUpdates
        );
        shouldClearBuildIds = false;
        statusUpdates({
            type: DictionaryBuildAnkiCacheStateType.stats,
            body: {
                buildTimestamp: buildTs,
                tracksToBuild: Array.from(trackStates.keys()),
                modifiedCards: numUpdatedCards,
                modifiedTokens: [], // Delay publishing deleted modified tokens so tokens aren't flashed uncollected during build
            } as DictionaryBuildAnkiCacheStats,
        });
    } catch (e) {
        console.error(e);
        statusUpdates({
            type: DictionaryBuildAnkiCacheStateType.error,
            body: {
                msg: e instanceof Error ? e.message : String(e),
                code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                modifiedTokens: Array.from(modifiedTokens),
            } as DictionaryBuildAnkiCacheError,
        });
    } finally {
        if (shouldClearBuildIds) await _clearBuildIds(db, activeTracks, buildId, 'anki'); // Otherwise let _processTracks() clear the build IDs when it's done
    }
}

/**
 * primaryKeys() and keys() are faster than toArray(), we don't need all fields
 */
async function _getAnkiCardKeys(db: _DictionaryDatabase, profile: string): Promise<DictionaryAnkiCardKey[]> {
    return db.ankiCards.where('profile').equals(profile).primaryKeys();
}

async function _getAnkiCardsByNoteIdBulk(
    db: _DictionaryDatabase,
    profile: string,
    noteIds: number[]
): Promise<Map<number, DictionaryAnkiCardRecord[]>> {
    if (!noteIds.length) return new Map();
    return db.ankiCards
        .where('[profile+noteId]')
        .anyOf(noteIds.map((noteId) => [profile, noteId]))
        .toArray()
        .then((ankiCards) => {
            if (!ankiCards.length) return new Map();
            const cardRecordsByNoteId = new Map<number, DictionaryAnkiCardRecord[]>();
            for (const ankiCard of ankiCards) {
                const val = cardRecordsByNoteId.get(ankiCard.noteId);
                if (val) val.push(ankiCard);
                else cardRecordsByNoteId.set(ankiCard.noteId, [ankiCard]);
            }
            return cardRecordsByNoteId;
        });
}

/**
 * There are five scenarios where tokens/cards need to be deleted:
 * 1. The card was removed from Anki (handled by _syncTrackStatesWithAnki())
 * 2. The card deck was changed (handled by _syncTrackStatesWithAnki())
 * 3. The card field was removed/renamed (handled by _syncTrackStatesWithAnki())
 * 4. The card field value no longer produce the same tokens (handled by _saveTokensForDB())
 * 5. Based on track settings such as no Anki fields (handled by tracksToClear)
 */
async function _deleteCardBulk(
    db: _DictionaryDatabase,
    profile: string,
    orphanedTrackCardIds: Map<number, number[]>,
    modifiedTokens: Set<string>
): Promise<void> {
    for (const [track, cardIds] of orphanedTrackCardIds.entries()) {
        if (!cardIds.length) orphanedTrackCardIds.delete(track);
    }
    if (!orphanedTrackCardIds.size) return;

    return db.transaction('rw', db.tokens, db.ankiCards, async () => {
        await mapAsync(Array.from(orphanedTrackCardIds.entries()), ([track, orphanedCardIds]) => {
            const cardIdsSet = new Set(orphanedCardIds);
            return Promise.all([
                db.tokens
                    .where('cardIds')
                    .anyOf(orphanedCardIds)
                    .distinct()
                    .filter((r) => r.track === track && r.profile === profile)
                    .modify((record, ref) => {
                        const remainingCardIds = record.cardIds.filter((id) => !cardIdsSet.has(id));
                        if (remainingCardIds.length === record.cardIds.length) return;

                        modifiedTokens.add(record.token);
                        for (const lemma of record.lemmas) modifiedTokens.add(lemma);

                        if (remainingCardIds.length) {
                            record.cardIds = remainingCardIds;
                        } else {
                            delete (ref as any).value;
                        }
                    }),
                db.ankiCards
                    .where('[cardId+track+profile]')
                    .anyOf(orphanedCardIds.map((cardId) => [cardId, track, profile]))
                    .delete(),
            ]);
        });
    });
}

async function _orphanAllCardIds(
    db: _DictionaryDatabase,
    profile: string,
    tracks: number[]
): Promise<Map<number, number[]>> {
    if (!tracks.length) return new Map();
    const orphanedTrackCardIds = new Map<number, number[]>(tracks.map((track) => [track, []]));
    return _getAnkiCardKeys(db, profile).then((ankiCardKeys) => {
        for (const [cardId, track] of ankiCardKeys) {
            const arr = orphanedTrackCardIds.get(track);
            if (!arr) continue;
            arr.push(cardId);
        }
        return orphanedTrackCardIds;
    });
}

/**
 * Determine which Anki cards have been modified since the last sync.
 * @param profile The profile name.
 * @param trackStates The track states.
 * @param modifiedCards The map to populate with modified cards.
 * @param orphanedTrackCardIds The map to populate with orphaned card IDs.
 * @param anki The Anki instance.
 * @param buildId The build ID.
 * @param activeTracks The active tracks.
 * @param statusUpdates The status update callback.
 * @returns The number of modified cards.
 */
async function _syncTrackStatesWithAnki(
    db: _DictionaryDatabase,
    profile: string,
    trackStates: AnkiTrackStatesForDB,
    modifiedCards: CardsForDB,
    orphanedTrackCardIds: Map<number, number[]>,
    anki: Anki,
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    statusUpdates: (state: DictionaryBuildAnkiCacheState) => void
): Promise<number> {
    const allDecksQuery = Array.from(trackStates.values()).some((ts) => !ts.dt.dictionaryAnkiDecks.length)
        ? ''
        : Array.from(new Set(Array.from(trackStates.values()).flatMap((ts) => ts.dt.dictionaryAnkiDecks)))
              .map((deck) => `"deck:${escapeAnkiDeckQuery(deck)}"`)
              .join(' OR ');
    const allFieldsQuery = Array.from(
        new Set(
            Array.from(trackStates.values()).flatMap((ts) => [
                ...ts.dt.dictionaryAnkiWordFields,
                ...ts.dt.dictionaryAnkiSentenceFields,
            ])
        )
    )
        .map((field) => `"${escapeAnkiQuery(field)}:_*"`)
        .join(' OR ');
    const query = allDecksQuery.length ? `(${allDecksQuery}) (${allFieldsQuery})` : `${allFieldsQuery}`;
    const noteIds = await anki.findNotes(query);
    if (!noteIds.length) {
        for (const [k, v] of (await _orphanAllCardIds(db, profile, Array.from(trackStates.keys()))).entries()) {
            orphanedTrackCardIds.set(k, v);
        }
        return new Set(Array.from(orphanedTrackCardIds.values()).flat()).size;
    }

    const notesInfo = await anki.notesInfo(noteIds);
    if (notesInfo.length !== noteIds.length) {
        throw new Error('Anki changed during cards record build, some notes info could not be retrieved.');
    }
    const notesModTime = notesInfo.reduce((acc, cur) => {
        acc.set(cur.noteId, cur.mod);
        return acc;
    }, new Map<number, number>()); // Edits to the fields are reflected in note mod time
    const allCardIds = notesInfo.flatMap((noteInfo) => noteInfo.cards);
    const cardsModTime = (await anki.cardsModTime(allCardIds)).reduce((acc, cur) => {
        acc.set(cur.cardId, cur.mod);
        return acc;
    }, new Map<number, number>()); // Reviews or suspension status are reflected in card mod time
    if (cardsModTime.size !== allCardIds.length) {
        throw new Error('Anki changed during cards record build, some cards mod time could not be retrieved.');
    }

    const existingAnkiNoteIdMap = await _getAnkiCardsByNoteIdBulk(db, profile, noteIds);
    const modifiedNotes: NoteInfo[] = [];
    const modifiedCardIdsSet = new Set<number>();
    for (const noteInfo of notesInfo) {
        const modifiedAt = Math.max(
            notesModTime.get(noteInfo.noteId)!,
            ...noteInfo.cards.map((cardId) => cardsModTime.get(cardId)!)
        );

        let modified = false;
        const existingAnkiCards = existingAnkiNoteIdMap.get(noteInfo.noteId);
        for (const [track, ts] of trackStates.entries()) {
            if (!_hasField(ts.dt, Object.keys(noteInfo.fields))) continue;
            const dbCards = existingAnkiCards?.filter((ankiCard) => ankiCard.track === track) ?? [];
            if (dbCards.some((a) => a.modifiedAt !== modifiedAt) || (!dbCards.length && noteInfo.cards.length)) {
                modified = true;
                break;
            }
        }
        if (!modified) continue;

        noteInfo.mod = modifiedAt;
        modifiedNotes.push(noteInfo);
        for (const cardId of noteInfo.cards) modifiedCardIdsSet.add(cardId);
    }

    const modifiedCardsDeck: Map<number, string> = new Map();
    if (modifiedNotes.length) {
        const modifiedCardIds = Array.from(modifiedCardIdsSet);
        for (const cardInfo of await anki.cardsInfo(modifiedCardIds, async (progress) => {
            await _updateBuildAnkiCacheProgress(db, buildId, activeTracks, progress, [], statusUpdates, true);
        })) {
            modifiedCardsDeck.set(cardInfo.cardId, cardInfo.deckName); // cardsInfo is much slower than notesInfo so we try to call it only if needed
        }
        const dts = Array.from(trackStates.values()).map((ts) => ts.dt);
        for (let i = modifiedNotes.length - 1; i >= 0; i--) {
            let modified = false;
            for (const dt of dts) {
                if (!modifiedNotes[i].cards.some((c) => _hasDeck(dt, modifiedCardsDeck.get(c)!))) continue;
                if (!_hasField(dt, Object.keys(modifiedNotes[i].fields))) continue;
                modified = true;
                break;
            }
            if (!modified) {
                for (const cardId of modifiedNotes[i].cards) modifiedCardIdsSet.delete(cardId);
                modifiedNotes.splice(i, 1);
            }
        }
    }

    if (modifiedNotes.length) {
        const modifiedCardIds = Array.from(modifiedCardIdsSet);
        const suspendedCards = new Set<number>();
        const areSuspended = await anki.areSuspended(modifiedCardIds);
        for (let i = 0; i < modifiedCardIds.length; i++) {
            if (areSuspended[i]) suspendedCards.add(modifiedCardIds[i]);
        }

        for (const modifiedNote of modifiedNotes) {
            const fields = new Map<string, string>();
            for (const [fieldName, { value }] of Object.entries(modifiedNote.fields)) {
                const trimmedValue = value.trim();
                if (!trimmedValue.length) continue;
                fields.set(fieldName, trimmedValue);
            }
            for (const cardId of modifiedNote.cards) {
                modifiedCards.set(cardId, {
                    noteId: modifiedNote.noteId,
                    deckName: modifiedCardsDeck.get(cardId)!,
                    fields,
                    modifiedAt: modifiedNote.mod,
                    statuses: new Map(),
                    suspended: suspendedCards.has(cardId),
                });
            }
        }
    }

    let numUpdatedCards = modifiedCardIdsSet.size;
    for (const track of trackStates.keys()) orphanedTrackCardIds.set(track, []);
    for (const [cardId, track] of await _getAnkiCardKeys(db, profile)) {
        const ts = trackStates.get(track);
        if (!ts) continue;
        if (!cardsModTime.has(cardId)) {
            orphanedTrackCardIds.get(track)!.push(cardId); // Card was removed from Anki
            numUpdatedCards += 1; // Only need to count these as modified cards are already counted
            continue;
        }
        if (!modifiedCardIdsSet.has(cardId)) continue; // Card unchanged
        const modifiedCard = modifiedCards.get(cardId)!;
        if (!_hasDeck(ts.dt, modifiedCard.deckName)) {
            orphanedTrackCardIds.get(track)!.push(cardId); // Card no longer in relevant deck
            continue;
        }
        if (_hasField(ts.dt, Array.from(modifiedCard.fields.keys()))) continue;
        orphanedTrackCardIds.get(track)!.push(cardId); // Card no longer has any relevant fields
    }

    return numUpdatedCards;
}

function _hasDeck(dt: DictionaryTrack, cardDeck: string): boolean {
    if (!dt.dictionaryAnkiDecks.length) return true;
    return dt.dictionaryAnkiDecks.some((deck) => deck === cardDeck || cardDeck.startsWith(`${deck}::`));
}

function _hasField(dt: DictionaryTrack, fields: string[]): boolean {
    return fields.some(
        (field) => dt.dictionaryAnkiWordFields.includes(field) || dt.dictionaryAnkiSentenceFields.includes(field)
    );
}

async function _buildAnkiCardStatuses(
    track: number,
    ts: TrackStateForDB,
    modifiedCards: CardsForDB,
    anki: Anki
): Promise<void> {
    if (!modifiedCards.size) return;
    const ankiFields = Array.from(new Set([...ts.dt.dictionaryAnkiWordFields, ...ts.dt.dictionaryAnkiSentenceFields]));
    if (!ankiFields.length) return;
    const decks = ts.dt.dictionaryAnkiDecks.map((deck) => `"deck:${escapeAnkiDeckQuery(deck)}"`).join(' OR ');
    const fields = ankiFields.map((field) => `"${escapeAnkiQuery(field)}:_*"`).join(' OR ');
    const query = decks.length ? `(${decks}) (${fields})` : fields;
    const matureCutoff = ts.dt.dictionaryAnkiMatureCutoff;
    const gradCutoff = Math.ceil(matureCutoff / 2);
    let numRemaining = Array.from(modifiedCards.values()).filter(
        (card) => _hasDeck(ts.dt, card.deckName) && _hasField(ts.dt, Array.from(card.fields.keys()))
    ).length;

    numRemaining = _processAnkiCardStatuses(
        track,
        await anki.findCards(`is:new (${query})`),
        modifiedCards,
        TokenStatus.UNKNOWN,
        numRemaining
    );
    if (numRemaining === 0) return;
    numRemaining = _processAnkiCardStatuses(
        track,
        await anki.findCards(`is:learn (${query})`),
        modifiedCards,
        TokenStatus.LEARNING,
        numRemaining
    );
    if (numRemaining === 0) return;

    // AnkiConnect doesn't expose Stability but we can retrieve it using search queries.
    // Stability is undefined for cards reviewed without FSRS so some cards may need to fallback to Interval.
    const props = ['prop:s', 'prop:ivl'];
    const startIndex = (await anki.findCards(`prop:s>=0 (${query})`)).length ? 0 : 1; // No cards are returned if FSRS is disabled
    for (let i = startIndex; i < props.length; i++) {
        const prop = props[i];
        numRemaining = _processAnkiCardStatuses(
            track,
            await anki.findCards(`-is:new -is:learn ${prop}<${gradCutoff} (${query})`),
            modifiedCards,
            TokenStatus.GRADUATED,
            numRemaining
        );
        if (numRemaining === 0) return;
        numRemaining = _processAnkiCardStatuses(
            track,
            await anki.findCards(`-is:new -is:learn ${prop}>=${gradCutoff} ${prop}<${matureCutoff} (${query})`),
            modifiedCards,
            TokenStatus.YOUNG,
            numRemaining
        );
        if (numRemaining === 0) return;
        numRemaining = _processAnkiCardStatuses(
            track,
            await anki.findCards(`-is:new -is:learn ${prop}>=${matureCutoff} (${query})`),
            modifiedCards,
            TokenStatus.MATURE,
            numRemaining
        );
        if (numRemaining === 0) return;
    }
    if (numRemaining !== 0) {
        throw new Error('Anki changed during status build, some cards statuses could not be determined.');
    }
}

function _processAnkiCardStatuses(
    track: number,
    cardIds: number[],
    modifiedCards: CardsForDB,
    status: TokenStatus,
    numRemaining: number
): number {
    for (const cardId of cardIds) {
        const updatedCard = modifiedCards.get(cardId);
        if (!updatedCard || updatedCard.statuses.has(track)) continue;
        updatedCard.statuses.set(track, status);
        if (--numRemaining === 0) break;
    }
    return numRemaining;
}

async function _updateBuildAnkiCacheProgress(
    db: _DictionaryDatabase,
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    progress: Progress,
    modifiedTokens: string[],
    statusUpdates: (state: DictionaryBuildAnkiCacheState) => void,
    forAnkiSync: boolean = false
): Promise<void> {
    const rate = progress.current / (Date.now() - progress.startedAt);
    const eta = rate ? Math.ceil((progress.total - progress.current) / rate) : 0;
    await db.transaction('rw', db.meta, async () => {
        await _buildIdHealthCheck(db, buildId, 'anki', activeTracks);
        const lastBuildExpiresAt = Date.now() + Math.max(eta, BUILD_MIN_EXPIRATION_MS);
        for (const key of activeTracks) {
            const trackMeta = await db.meta.get(key);
            if (!trackMeta) continue;
            await db.meta.update(key, {
                ankiMeta: {
                    ...trackMeta.ankiMeta,
                    lastBuildExpiresAt,
                },
            });
        }
    });
    statusUpdates({
        type: DictionaryBuildAnkiCacheStateType.progress,
        body: {
            current: progress.current,
            total: progress.total,
            buildTimestamp: progress.startedAt,
            modifiedTokens,
            forAnkiSync,
        } as DictionaryBuildAnkiCacheProgress,
    });
}

async function _processTracks(
    db: _DictionaryDatabase,
    profile: string,
    buildId: string,
    trackStates: Map<number, TrackStateForDB>,
    modifiedCards: CardsForDB,
    orphanedTrackCardIds: Map<number, number[]>,
    tracksToClear: number[],
    numCardsFromOrphanedTracks: number,
    modifiedTokens: Set<string>,
    activeTracks: DictionaryMetaKey[],
    numUpdatedCards: number,
    buildTs: number,
    statusUpdates: (state: DictionaryBuildAnkiCacheState) => void
): Promise<void> {
    let error: any;
    const progress: Progress = {
        current: 0,
        total: modifiedCards.size,
        startedAt: Date.now(),
    };
    try {
        await db.transaction('rw', db.meta, db.tokens, db.ankiCards, async () => {
            await _buildIdHealthCheck(db, buildId, 'anki', activeTracks);
            await _deleteCardBulk(db, profile, orphanedTrackCardIds, modifiedTokens);
        });

        // Cannot perform this in the transaction above as there are external async calls in here
        await _buildTokensForTracks(
            db,
            profile,
            trackStates,
            modifiedCards,
            buildId,
            activeTracks,
            progress,
            statusUpdates
        );
    } catch (e) {
        error = e;
        console.error(e);
    } finally {
        await _clearBuildIds(db, activeTracks, buildId, 'anki');
        if (modifiedTokens.size || numUpdatedCards || numCardsFromOrphanedTracks || error) {
            try {
                await _gatherModifiedTokens(db, profile, modifiedTokens); // Delay publishing deleted modified tokens so tokens aren't flashed uncollected during build
            } catch (e) {
                console.error(e);
                if (!error) error = e;
            }
        }

        if (error) {
            statusUpdates({
                type: DictionaryBuildAnkiCacheStateType.error,
                body: {
                    msg: error instanceof Error ? error.message : String(error),
                    code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                    modifiedTokens: Array.from(modifiedTokens),
                } as DictionaryBuildAnkiCacheError,
            });
        } else {
            statusUpdates({
                type: DictionaryBuildAnkiCacheStateType.stats,
                body: {
                    buildTimestamp: buildTs,
                    tracksToBuild: Array.from(trackStates.keys()),
                    modifiedCards: numUpdatedCards,
                    orphanedCards: numCardsFromOrphanedTracks,
                    tracksToClear: tracksToClear,
                    modifiedTokens: Array.from(modifiedTokens),
                } as DictionaryBuildAnkiCacheStats,
            });
        }
    }
}

async function _buildTokensForTracks(
    db: _DictionaryDatabase,
    profile: string,
    trackStates: Map<number, TrackStateForDB>,
    modifiedCards: CardsForDB,
    buildId: string,
    activeTracks: DictionaryMetaKey[],
    progress: Progress,
    statusUpdates: (state: DictionaryBuildAnkiCacheState) => void
): Promise<void> {
    if (!modifiedCards.size) return;
    const ankiTokenStatus = null; // Calculate when getting due to certain settings (e.g. dictionaryAnkiMatureCutoff dictionaryAnkiTreatSuspended)

    await inBatches(
        Array.from(modifiedCards.entries()),
        async (b) => {
            const modifiedCardsBatch: CardsForDB = new Map();
            for (const [cardId, card] of b) modifiedCardsBatch.set(cardId, card);

            for (const ts of trackStates.values()) {
                const texts: string[] = [];
                const ankiFields = new Set([...ts.dt.dictionaryAnkiWordFields, ...ts.dt.dictionaryAnkiSentenceFields]);
                for (const card of modifiedCardsBatch.values()) {
                    if (!_hasDeck(ts.dt, card.deckName)) continue;
                    for (const ankiField of ankiFields) {
                        const field = card.fields.get(ankiField);
                        if (field) texts.push(field);
                    }
                }
                await ts.yomitan.tokenizeBulk(texts);
            }

            const partialTokenRecordsByTrack = new Map<
                number,
                Map<DictionaryTokenSource, Map<string, { lemmas: string[]; cardIds: Set<number> }>>
            >();
            const ankiFieldsMap = new Map<number, Map<DictionaryTokenSource, string[]>>();
            for (const [track, ts] of trackStates.entries()) {
                partialTokenRecordsByTrack.set(
                    track,
                    new Map([
                        [DictionaryTokenSource.ANKI_WORD, new Map()],
                        [DictionaryTokenSource.ANKI_SENTENCE, new Map()],
                    ])
                );
                ankiFieldsMap.set(
                    track,
                    new Map([
                        [DictionaryTokenSource.ANKI_WORD, ts.dt.dictionaryAnkiWordFields],
                        [DictionaryTokenSource.ANKI_SENTENCE, ts.dt.dictionaryAnkiSentenceFields],
                    ])
                );
            }
            for (const [track, ts] of trackStates.entries()) {
                const sourceTokensMap = partialTokenRecordsByTrack.get(track)!;
                const sourceAnkiFieldsMap = ankiFieldsMap.get(track)!;
                for (const [cardId, card] of modifiedCardsBatch.entries()) {
                    if (!_hasDeck(ts.dt, card.deckName)) continue;
                    for (const [source, ankiFields] of sourceAnkiFieldsMap.entries()) {
                        for (const ankiField of ankiFields) {
                            const tokenCardsMap = sourceTokensMap.get(source)!;
                            const field = card.fields.get(ankiField);
                            if (!field) continue;
                            for (const tokenParts of await ts.yomitan.tokenize(field)) {
                                const trimmedToken = tokenParts
                                    .map((p) => p.text)
                                    .join('')
                                    .trim();
                                if (!HAS_LETTER_REGEX.test(trimmedToken)) continue;
                                let val = tokenCardsMap.get(trimmedToken);
                                if (!val) {
                                    const lemmas = (await ts.yomitan.lemmatize(trimmedToken))!;
                                    if (!lemmas.length) continue; // Not a valid dictionary entry
                                    val = { lemmas, cardIds: new Set<number>() };
                                    tokenCardsMap.set(trimmedToken, val);
                                }
                                val.cardIds.add(cardId);
                            }
                        }
                    }
                }
                ts.yomitan.resetCache();
            }

            const records: _DictionaryTokenRecord[] = [];
            const ankiCards: DictionaryAnkiCardRecord[] = [];
            for (const track of trackStates.keys()) {
                for (const [source, tokenCardsMap] of partialTokenRecordsByTrack.get(track)!.entries()) {
                    const tokenRecordMap = await _getFromSourceBulk(
                        db,
                        profile,
                        track,
                        source,
                        Array.from(tokenCardsMap.keys())
                    );
                    for (const [token, val] of tokenCardsMap.entries()) {
                        const existingRecord = tokenRecordMap.get(token); // Merge with existing record
                        const states: TokenState[] = [];
                        if (existingRecord) {
                            for (const cardId of existingRecord.cardIds) {
                                if (!modifiedCardsBatch.has(cardId)) val.cardIds.add(cardId); // If card was updated, it may no longer apply to this token. Should already be in cardIds if it's still valid.
                            }
                            for (const state of existingRecord.states) {
                                if (!states.includes(state)) states.push(state);
                            }
                        }
                        records.push({
                            profile,
                            track,
                            source,
                            token,
                            status: ankiTokenStatus,
                            lemmas: val.lemmas,
                            states,
                            cardIds: Array.from(val.cardIds),
                            subjectIds: [],
                        });
                    }
                }
                for (const [cardId, updatedCard] of modifiedCardsBatch.entries()) {
                    const status = updatedCard.statuses.get(track);
                    if (status === undefined) continue; // Card has no relevant deck/fields for this track
                    ankiCards.push({
                        profile,
                        track,
                        cardId: cardId,
                        noteId: updatedCard.noteId,
                        modifiedAt: updatedCard.modifiedAt,
                        status,
                        suspended: updatedCard.suspended,
                    });
                }
            }

            const modifiedTokens: Set<string> = new Set();
            await db.transaction('rw', db.meta, db.tokens, db.ankiCards, async () => {
                await _buildIdHealthCheck(db, buildId, 'anki', activeTracks);
                await _saveTokensForDB(
                    db,
                    profile,
                    trackStates,
                    records,
                    ankiCards,
                    modifiedCardsBatch,
                    partialTokenRecordsByTrack,
                    modifiedTokens
                );
                await _gatherModifiedTokens(db, profile, modifiedTokens);
            });

            progress.current += modifiedCardsBatch.size;
            await _updateBuildAnkiCacheProgress(
                db,
                buildId,
                activeTracks,
                progress,
                Array.from(modifiedTokens),
                statusUpdates
            );
        },
        { batchSize: 100 } // Batch for memory usage and yomitan cache size
    );
}

async function _saveTokensForDB(
    db: _DictionaryDatabase,
    profile: string,
    trackStates: Map<number, TrackStateForDB>,
    records: _DictionaryTokenRecord[],
    ankiCards: DictionaryAnkiCardRecord[],
    modifiedCardsBatch: CardsForDB,
    partialTokenRecordsByTrack: Map<
        number,
        Map<DictionaryTokenSource, Map<string, { lemmas: string[]; cardIds: Set<number> }>>
    >,
    modifiedTokens: Set<string>
): Promise<void> {
    for (const record of records) {
        modifiedTokens.add(record.token);
        for (const lemma of record.lemmas) modifiedTokens.add(lemma);
    }
    return db.transaction('rw', db.tokens, db.ankiCards, async () => {
        await Promise.all([_saveRecordBulk(db, records), db.ankiCards.bulkPut(ankiCards)]);
        await db.tokens
            .where('cardIds')
            .anyOf(Array.from(modifiedCardsBatch.keys()))
            .distinct()
            .filter((r) => trackStates.has(r.track) && r.profile === profile)
            .modify((record, ref) => {
                // We want tokens that were not updated but refers to updated cards (e.g. field value changed, different tokens)
                if (partialTokenRecordsByTrack.get(record.track)!.get(record.source)!.has(record.token)) return;
                const validCardIds = record.cardIds.filter((id) => !modifiedCardsBatch.has(id));
                if (validCardIds.length === record.cardIds.length) return;

                modifiedTokens.add(record.token);
                for (const lemma of record.lemmas) modifiedTokens.add(lemma);
                if (validCardIds.length) {
                    record.cardIds = validCardIds;
                } else {
                    delete (ref as any).value;
                }
            });
    });
}
