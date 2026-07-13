import { describe, expect, it, jest } from '@jest/globals';
import {
    DictionaryTokenSource,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenStatus,
} from '@project/common/settings';
import { getTokenStatus } from '@project/common/util';
import { TrackState } from './subtitle-annotations';
import { resolveTokenStatus } from './token-collection';
import { makeDictionaryTrack } from './annotations-test-utils';

const cardStatus = (status: TokenStatus, cardId = 1) => ({ cardId, status, suspended: false });

const makeTrackState = (
    overrides: Parameters<typeof makeDictionaryTrack>[0],
    lemmas: string[] = ['lemma']
): TrackState => {
    const trackState = new TrackState(0, makeDictionaryTrack(overrides));
    trackState.updateYomitan({ lemmatize: jest.fn(async () => lemmas) } as any);
    return trackState;
};

type CollectedForm = 'exact' | 'lemma' | 'different-inflection';

describe('getTokenStatus', () => {
    it('folds empty, active, and suspended card statuses', () => {
        expect(getTokenStatus([], 'NORMAL')).toBe(TokenStatus.UNKNOWN);
        expect(getTokenStatus([{ cardId: 1, status: TokenStatus.LEARNING, suspended: false }], 'NORMAL')).toBe(
            TokenStatus.LEARNING
        );
        expect(
            getTokenStatus(
                [
                    { cardId: 1, status: TokenStatus.GRADUATED, suspended: false },
                    { cardId: 2, status: TokenStatus.YOUNG, suspended: false },
                ],
                'NORMAL'
            )
        ).toBe(TokenStatus.YOUNG);
        expect(
            getTokenStatus(
                [
                    { cardId: 1, status: TokenStatus.MATURE, suspended: true },
                    { cardId: 2, status: TokenStatus.LEARNING, suspended: false },
                ],
                TokenStatus.UNKNOWN
            )
        ).toBe(TokenStatus.LEARNING);
        expect(getTokenStatus([{ cardId: 1, status: TokenStatus.MATURE, suspended: true }], TokenStatus.UNKNOWN)).toBe(
            TokenStatus.UNKNOWN
        );
    });
});

describe('resolveTokenStatus', () => {
    it('ignores capitalization when resolving collected word matches', async () => {
        const trackState = new TrackState(
            0,
            makeDictionaryTrack({
                dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
            })
        );
        trackState.updateYomitan({ lemmatize: jest.fn(async () => ['word']) } as any);
        trackState.tokenCollectionExact.add(
            [{ cardId: 1, status: TokenStatus.MATURE, suspended: false }],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'Word',
            []
        );

        await expect(resolveTokenStatus('word', 'word', trackState)).resolves.toEqual({
            status: TokenStatus.MATURE,
            source: DictionaryTokenSource.ANKI_WORD,
            externalCandidateStatuses: [{ cardId: 1, status: TokenStatus.MATURE, suspended: false }],
        });
    });

    it('matches kana subtitle tokens against collected kanji forms only when cross-script matching is enabled', async () => {
        const status = {
            cardId: 1,
            status: TokenStatus.MATURE,
            suspended: false,
        };
        const makeTrackState = (dictionaryMatchAcrossScripts: boolean) => {
            const trackState = new TrackState(
                0,
                makeDictionaryTrack({
                    dictionaryMatchAcrossScripts,
                    dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                    dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
                })
            );
            trackState.updateYomitan({ lemmatize: jest.fn(async () => ['見る']) } as any);
            trackState.tokenCollectionAny.add([status], DictionaryTokenSource.ANKI_WORD, undefined, '見る', [], '見る');
            return trackState;
        };

        await expect(resolveTokenStatus('みる', 'みる', makeTrackState(true))).resolves.toEqual({
            status: TokenStatus.MATURE,
            source: DictionaryTokenSource.ANKI_WORD,
            externalCandidateStatuses: [status],
        });
        await expect(resolveTokenStatus('みる', 'みる', makeTrackState(false))).resolves.toEqual({
            status: TokenStatus.UNCOLLECTED,
        });
    });

    it('does not match kanji subtitle tokens against collected kana forms even when cross-script matching is enabled', async () => {
        const trackState = makeTrackState(
            {
                dictionaryMatchAcrossScripts: true,
                dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
            },
            ['みる']
        );
        trackState.tokenCollectionAny.add(
            [cardStatus(TokenStatus.MATURE)],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'みる',
            [],
            'みる'
        );

        await expect(resolveTokenStatus('見る', '見る', trackState)).resolves.toEqual({
            status: TokenStatus.UNCOLLECTED,
        });
    });

    it.each<[TokenMatchStrategy, CollectedForm]>([
        [TokenMatchStrategy.EXACT_FORM_COLLECTED, 'exact'],
        [TokenMatchStrategy.LEMMA_FORM_COLLECTED, 'lemma'],
        [TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED, 'lemma'],
        [TokenMatchStrategy.ANY_FORM_COLLECTED, 'different-inflection'],
    ])('matches the expected collected form for %s', async (strategy, collectedForm) => {
        const trackState = makeTrackState(
            {
                dictionaryTokenMatchStrategy: strategy,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
            },
            ['走る']
        );
        switch (collectedForm) {
            case 'exact':
                trackState.tokenCollectionExact.add(
                    [cardStatus(TokenStatus.MATURE)],
                    DictionaryTokenSource.ANKI_WORD,
                    undefined,
                    '走った',
                    []
                );
                break;
            case 'lemma':
                trackState.tokenCollectionLemma.add(
                    [cardStatus(TokenStatus.MATURE)],
                    DictionaryTokenSource.ANKI_WORD,
                    undefined,
                    '走る',
                    []
                );
                break;
            case 'different-inflection':
                trackState.tokenCollectionAny.add(
                    [cardStatus(TokenStatus.MATURE)],
                    DictionaryTokenSource.ANKI_WORD,
                    undefined,
                    '走る',
                    [],
                    '走れ'
                );
                break;
        }

        await expect(resolveTokenStatus('走った', '走った', trackState)).resolves.toMatchObject({
            status: TokenStatus.MATURE,
            source: DictionaryTokenSource.ANKI_WORD,
        });
    });

    it.each<[TokenMatchStrategy, CollectedForm]>([
        [TokenMatchStrategy.EXACT_FORM_COLLECTED, 'lemma'],
        [TokenMatchStrategy.LEMMA_FORM_COLLECTED, 'exact'],
        [TokenMatchStrategy.LEMMA_FORM_COLLECTED, 'different-inflection'],
        [TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED, 'different-inflection'],
    ])('does not match unsupported collected forms for %s', async (strategy, collectedForm) => {
        const trackState = makeTrackState(
            {
                dictionaryTokenMatchStrategy: strategy,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
            },
            ['走る']
        );
        switch (collectedForm) {
            case 'exact':
                trackState.tokenCollectionExact.add(
                    [cardStatus(TokenStatus.MATURE)],
                    DictionaryTokenSource.ANKI_WORD,
                    undefined,
                    '走った',
                    []
                );
                break;
            case 'lemma':
                trackState.tokenCollectionLemma.add(
                    [cardStatus(TokenStatus.MATURE)],
                    DictionaryTokenSource.ANKI_WORD,
                    undefined,
                    '走る',
                    []
                );
                break;
            case 'different-inflection':
                trackState.tokenCollectionAny.add(
                    [cardStatus(TokenStatus.MATURE)],
                    DictionaryTokenSource.ANKI_WORD,
                    undefined,
                    '走る',
                    [],
                    '走れ'
                );
                break;
        }

        await expect(resolveTokenStatus('走った', '走った', trackState)).resolves.toEqual({
            status: TokenStatus.UNCOLLECTED,
        });
    });

    it('uses exact matches before lemma and any-form matches when configured for exact priority', async () => {
        const trackState = new TrackState(
            0,
            makeDictionaryTrack({
                dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
            })
        );
        trackState.updateYomitan({ lemmatize: jest.fn(async () => ['lemma']) } as any);
        trackState.tokenCollectionAny.add(
            [{ cardId: 1, status: TokenStatus.UNKNOWN, suspended: false }],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'lemma',
            [],
            'surface'
        );
        trackState.tokenCollectionAny.add(
            [{ status: TokenStatus.MATURE, suspended: false }],
            DictionaryTokenSource.WANIKANI,
            undefined,
            'lemma',
            [],
            'collected-lemma'
        );

        await expect(resolveTokenStatus('surface', 'surface', trackState)).resolves.toEqual({
            status: TokenStatus.UNKNOWN,
            source: DictionaryTokenSource.ANKI_WORD,
            externalCandidateStatuses: [{ cardId: 1, status: TokenStatus.UNKNOWN, suspended: false }],
        });
    });

    it.each([
        [TokenMatchStrategyPriority.EXACT, TokenStatus.UNKNOWN],
        [TokenMatchStrategyPriority.LEMMA, TokenStatus.MATURE],
        [TokenMatchStrategyPriority.BEST_KNOWN, TokenStatus.MATURE],
        [TokenMatchStrategyPriority.LEAST_KNOWN, TokenStatus.UNKNOWN],
    ])('uses %s card choice priority when exact and lemma candidates both exist', async (priority, expectedStatus) => {
        const trackState = makeTrackState({
            dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
            dictionaryTokenMatchStrategyPriority: priority,
        });
        trackState.tokenCollectionAny.add(
            [cardStatus(TokenStatus.UNKNOWN, 1)],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'lemma',
            [],
            'surface'
        );
        trackState.tokenCollectionAny.add(
            [cardStatus(TokenStatus.MATURE, 2)],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'lemma',
            [],
            'lemma'
        );

        await expect(resolveTokenStatus('surface', 'surface', trackState)).resolves.toMatchObject({
            status: expectedStatus,
            source: DictionaryTokenSource.ANKI_WORD,
        });
    });

    it('can choose the best known word status across exact, lemma, and any-form matches', async () => {
        const trackState = new TrackState(
            0,
            makeDictionaryTrack({
                dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.BEST_KNOWN,
            })
        );
        trackState.updateYomitan({ lemmatize: jest.fn(async () => ['lemma']) } as any);
        trackState.tokenCollectionAny.add(
            [{ cardId: 1, status: TokenStatus.UNKNOWN, suspended: false }],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'lemma',
            [],
            'surface'
        );
        trackState.tokenCollectionAny.add(
            [
                {
                    status: TokenStatus.MATURE,
                    suspended: false,
                    waniKani: { subjectId: 1, subjectLevel: 1, assignmentId: 1, availableAt: null },
                },
            ],
            DictionaryTokenSource.WANIKANI,
            undefined,
            'lemma',
            [],
            'collected-lemma'
        );

        await expect(resolveTokenStatus('surface', 'surface', trackState)).resolves.toEqual({
            status: TokenStatus.MATURE,
            source: DictionaryTokenSource.WANIKANI,
            externalCandidateStatuses: [
                { cardId: 1, status: TokenStatus.UNKNOWN, suspended: false },
                {
                    status: TokenStatus.MATURE,
                    suspended: false,
                    waniKani: { subjectId: 1, subjectLevel: 1, assignmentId: 1, availableAt: null },
                },
            ],
        });
    });

    it('uses sentence matches only when no word match is present', async () => {
        const withWordAndSentence = makeTrackState({
            dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
            dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
            dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
        });
        withWordAndSentence.tokenCollectionExact.add(
            [cardStatus(TokenStatus.UNKNOWN, 1)],
            DictionaryTokenSource.ANKI_WORD,
            undefined,
            'surface',
            []
        );
        withWordAndSentence.tokenCollectionExact.add(
            [cardStatus(TokenStatus.MATURE, 2)],
            DictionaryTokenSource.ANKI_SENTENCE,
            undefined,
            'surface',
            []
        );

        await expect(resolveTokenStatus('surface', 'surface', withWordAndSentence)).resolves.toMatchObject({
            status: TokenStatus.UNKNOWN,
            source: DictionaryTokenSource.ANKI_WORD,
        });

        const sentenceOnly = makeTrackState({
            dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
            dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
            dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
        });
        sentenceOnly.tokenCollectionExact.add(
            [cardStatus(TokenStatus.MATURE, 2)],
            DictionaryTokenSource.ANKI_SENTENCE,
            undefined,
            'surface',
            []
        );

        await expect(resolveTokenStatus('surface', 'surface', sentenceOnly)).resolves.toMatchObject({
            status: TokenStatus.MATURE,
            source: DictionaryTokenSource.ANKI_SENTENCE,
        });
    });

    it('uses the sentence match strategy independently from the word match strategy', async () => {
        const trackState = makeTrackState(
            {
                dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
            },
            ['lemma']
        );
        trackState.tokenCollectionExact.add(
            [cardStatus(TokenStatus.UNKNOWN, 1)],
            DictionaryTokenSource.ANKI_SENTENCE,
            undefined,
            'surface',
            []
        );
        trackState.tokenCollectionLemma.add(
            [cardStatus(TokenStatus.MATURE, 2)],
            DictionaryTokenSource.ANKI_SENTENCE,
            undefined,
            'lemma',
            []
        );

        await expect(resolveTokenStatus('surface', 'surface', trackState)).resolves.toMatchObject({
            status: TokenStatus.MATURE,
            source: DictionaryTokenSource.ANKI_SENTENCE,
        });
    });
});
