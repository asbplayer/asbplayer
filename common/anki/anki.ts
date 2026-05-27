import { AudioClip } from '@project/common/audio-clip';
import { AnkiExportMode, CardModel, Image, Progress } from '@project/common';
import { HttpFetcher, Fetcher } from '@project/common';
import { AnkiSettings, AnkiSettingsFieldKey } from '@project/common/settings';
import sanitize from 'sanitize-filename';
import { extractText, fromBatches, sourceString } from '@project/common/util';

const ANKI_CARDS_INFO_BATCH_SIZE = 10;
const ANKI_NOTES_INFO_BATCH_SIZE = 100;
const ANKI_MOD_BATCH_SIZE = 10000;

const ankiQuerySpecialCharacters = ['"', '*', '_', '\\', ':'];
const ankiQueryDeckSpecialCharacters = ['"', '*', '_', '\\'];
const alphaNumericCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const unsafeURLChars = /[:\/\?#\[\]@!$&'()*+,;= "<>%{}|\\^`]/g;
const replacement = '_';

export function escapeAnkiQuery(query: string) {
    let escaped = '';

    for (let i = 0; i < query.length; ++i) {
        const char = query[i];
        if (ankiQuerySpecialCharacters.includes(char)) {
            escaped += `\\${char}`;
        } else {
            escaped += char;
        }
    }

    return `${escaped}`;
}

export function escapeAnkiDeckQuery(query: string) {
    let escaped = '';

    for (let i = 0; i < query.length; ++i) {
        const char = query[i];
        if (ankiQueryDeckSpecialCharacters.includes(char)) {
            escaped += `\\${char}`;
        } else {
            escaped += char;
        }
    }

    return `${escaped}`;
}

function randomString() {
    let string = '';

    for (let i = 0; i < 8; ++i) {
        string += alphaNumericCharacters.charAt(Math.floor(Math.random() * alphaNumericCharacters.length));
    }

    return string;
}

// Makes a file name unique with reasonable probability by appending a string of random characters.
// Leaves more room for the original file name than Anki's appended hash when `storeMediaFile`
// is called with `deleteExisting` == true.
// Also, AnkiConnect Android doesn't support `deleteExisting` anyway.
const makeUniqueFileName = (fileName: string) => {
    const match = /(.*)\.(.*)/.exec(fileName);

    if (match === null || match.length < 3) {
        // Give up (not likely since we expect fileName to have an extension)
        return fileName;
    }

    const baseName = match[1];
    const exension = match[2];
    return `${baseName}_${randomString()}.${exension}`;
};

const htmlTagRegexString = '<([^/ >])*[^>]*>(.*?)</\\1>';
const anyHtmlTagRegex = /<[^>]+>/;

// Given <a><b>content</b></a> return ['<a><b>content</b></a>', '<b>content</b>', 'content']
const tagContent = (html: string) => {
    const htmlTagRegex = new RegExp(htmlTagRegexString);
    let content = html;
    let contents = [html];

    while (true) {
        const match = htmlTagRegex.exec(content);

        if (match === null || match.length < 3) {
            break;
        }

        content = match[2];
        contents.push(content);
    }

    return contents;
};

const containsHtmlTag = (value: string) => anyHtmlTagRegex.test(value);

export const inheritHtmlMarkup = (original: string, markedUp: string) => {
    const htmlTagRegex = new RegExp(htmlTagRegexString, 'ig');
    const markedUpWithoutBreaklines = markedUp.replaceAll('<br>', '');
    let inherited = original;

    while (true) {
        const match = htmlTagRegex.exec(markedUpWithoutBreaklines);

        if (match === null || match.length < 3) {
            break;
        }

        let newInherited = inherited;

        if (!inherited.includes(match[0])) {
            const candidateTargets = tagContent(match[2]);

            for (const target of candidateTargets) {
                newInherited = inherited.replace(target, match[0]);

                if (newInherited !== inherited) {
                    break;
                }
            }
        }

        inherited = newInherited;
    }

    return inherited;
};

export interface ExportParams {
    text: string | undefined;
    track1: string | undefined;
    track2: string | undefined;
    track3: string | undefined;
    definition: string | undefined;
    audioClip: AudioClip | undefined;
    image: Image | undefined;
    word: string | undefined;
    source: string | undefined;
    url: string | undefined;
    customFieldValues: { [key: string]: string };
    tags: string[];
    mode: AnkiExportMode;
    noteId?: number;
    ankiConnectUrl?: string;
}

export async function exportCard(
    card: CardModel,
    ankiSettings: AnkiSettings,
    exportMode: AnkiExportMode = 'default'
): Promise<string> {
    const anki = new Anki(ankiSettings);
    const source = sourceString(card.subtitleFileName, card.mediaTimestamp);
    let audioClip =
        card.audio === undefined
            ? undefined
            : AudioClip.fromBase64(
                  source,
                  card.subtitle.start,
                  card.subtitle.end,
                  card.audio.playbackRate ?? 1,
                  card.audio.base64,
                  card.audio.extension,
                  card.audio.error
              );

    return await anki.export({
        text: card.text ?? extractText(card.subtitle, card.surroundingSubtitles),
        track1: extractText(card.subtitle, card.surroundingSubtitles, 0),
        track2: extractText(card.subtitle, card.surroundingSubtitles, 1),
        track3: extractText(card.subtitle, card.surroundingSubtitles, 2),
        definition: card.definition,
        audioClip,
        image:
            card.image === undefined
                ? undefined
                : Image.fromBase64(
                      source,
                      card.subtitle.start,
                      card.image.base64,
                      card.image.extension,
                      card.image.error
                  ),
        word: card.word,
        source: source,
        url: card.url,
        customFieldValues: card.customFieldValues ?? {},
        tags: ankiSettings.tags,
        mode: exportMode,
    });
}

export interface CreateModelParams {
    modelName: string;
    inOrderFields: string[];
    css: string;
    cardTemplates: { Front: string; Back: string }[];
}

export class DuplicateNoteError extends Error {
    constructor(message: string = 'duplicate') {
        super(message);
        this.name = 'DuplicateNoteError';
    }
}

// Optional fields are unused thus deleted to save memory
export interface CardInfo {
    answer?: string;
    question?: string;
    deckName: string;
    modelName: string;
    fieldOrder: number;
    fields: { [fieldName: string]: { value: string; order: number } };
    css?: string;
    cardId: number;
    interval: number;
    factor: number;
    note: number;
    ord: number;
    type: number;
    queue: number;
    due: number;
    reps: number;
    lapses: number;
    left: number;
    mod: number;
    nextReviews: [string, string, string, string];
    flags: number;
}

export interface NoteInfo {
    noteId: number;
    profile: string;
    modelName: string;
    tags: string[];
    fields: { [fieldName: string]: { value: string; order: number } };
    mod: number;
    cards: number[];
}

export class Anki {
    private readonly settingsProvider: AnkiSettings;
    private readonly fetcher: Fetcher;

    constructor(settingsProvider: AnkiSettings, fetcher = new HttpFetcher()) {
        this.settingsProvider = settingsProvider;
        this.fetcher = fetcher;
    }

    get ankiConnectUrl() {
        return this.settingsProvider.ankiConnectUrl;
    }

    async deckNames(ankiConnectUrl?: string): Promise<string[]> {
        const response = await this._executeAction('deckNames', null, ankiConnectUrl);
        return response.result;
    }

    async modelNames(ankiConnectUrl?: string): Promise<string[]> {
        const response = await this._executeAction('modelNames', null, ankiConnectUrl);
        return response.result;
    }

    async modelFieldNames(modelName: string, ankiConnectUrl?: string): Promise<string[]> {
        const response = await this._executeAction('modelFieldNames', { modelName: modelName }, ankiConnectUrl);
        return response.result;
    }

    async findCards(query: string, ankiConnectUrl?: string): Promise<number[]> {
        const response = await this._executeAction('findCards', { query: query }, ankiConnectUrl);
        return response.result;
    }

    async findCardsWithWord(word: string, fields: string[], ankiConnectUrl?: string): Promise<number[]> {
        if (!fields.length) return [];
        return this.findCards(
            fields.map((field) => `"${field}:${escapeAnkiQuery(word)}"`).join(' OR '),
            ankiConnectUrl
        );
    }

    async findCardsContainingWord(word: string, fields: string[], ankiConnectUrl?: string): Promise<number[]> {
        if (!fields.length) return [];
        return this.findCards(
            fields.map((field) => `"${field}:*${escapeAnkiQuery(word)}*"`).join(' OR '),
            ankiConnectUrl
        );
    }

    async findNotesWithWord(word: string, ankiConnectUrl?: string): Promise<number[]> {
        return this.findNotes(`"${this.settingsProvider.wordField}:${escapeAnkiQuery(word)}"`, ankiConnectUrl);
    }

    async findNotesWithWordGui(word: string, ankiConnectUrl?: string): Promise<number[]> {
        const response = await this._executeAction(
            'guiBrowse',
            { query: `"${this.settingsProvider.wordField}:${escapeAnkiQuery(word)}"` },
            ankiConnectUrl
        );
        return response.result;
    }

    async findRecentlyEditedOrReviewedCards(
        fields: string[],
        sinceDays: number,
        ankiConnectUrl?: string
    ): Promise<number[]> {
        if (!fields.length) return [];
        if (sinceDays < 1) sinceDays = 1;
        const response = await this._executeAction(
            'findCards',
            {
                query: `(rated:${sinceDays} OR edited:${sinceDays}) (${fields.map((field) => `"${escapeAnkiQuery(field)}:_*"`).join(' OR ')})`,
            },
            ankiConnectUrl
        );
        return response.result;
    }

    async cardsInfo(
        allCards: number[],
        statusUpdates?: (progress: Progress) => Promise<void>,
        ankiConnectUrl?: string
    ): Promise<CardInfo[]> {
        if (!allCards.length) return [];
        return (
            await fromBatches(
                allCards,
                async (cards) => {
                    const cardsInfo: CardInfo[] = (await this._executeAction('cardsInfo', { cards }, ankiConnectUrl))
                        .result;
                    for (const cardInfo of cardsInfo) {
                        delete cardInfo.answer;
                        delete cardInfo.question;
                        delete cardInfo.css;
                    }
                    return cardsInfo;
                },
                { batchSize: ANKI_CARDS_INFO_BATCH_SIZE, statusUpdates }
            )
        ).flat();
    }

    async cardsModTime(allCards: number[], ankiConnectUrl?: string): Promise<{ cardId: number; mod: number }[]> {
        if (!allCards.length) return [];
        return (
            await fromBatches(
                allCards,
                async (cards) => {
                    return (await this._executeAction('cardsModTime', { cards }, ankiConnectUrl)).result as {
                        cardId: number;
                        mod: number;
                    }[];
                },
                { batchSize: ANKI_MOD_BATCH_SIZE }
            )
        ).flat();
    }

    async areSuspended(cards: number[], ankiConnectUrl?: string): Promise<(boolean | null)[]> {
        if (!cards.length) return [];
        return (await this._executeAction('areSuspended', { cards }, ankiConnectUrl)).result;
    }

    async findNotes(query: string, ankiConnectUrl?: string): Promise<number[]> {
        const response = await this._executeAction('findNotes', { query: query }, ankiConnectUrl);
        return response.result;
    }

    async notesInfo(allNotes: number[], ankiConnectUrl?: string): Promise<NoteInfo[]> {
        if (!allNotes.length) return [];
        return (
            await fromBatches(
                allNotes,
                async (notes) => {
                    return (await this._executeAction('notesInfo', { notes }, ankiConnectUrl)).result as NoteInfo[];
                },
                { batchSize: ANKI_NOTES_INFO_BATCH_SIZE }
            )
        ).flat();
    }

    async notesModTime(allNotes: number[], ankiConnectUrl?: string): Promise<{ noteId: number; mod: number }[]> {
        if (!allNotes.length) return [];
        return (
            await fromBatches(
                allNotes,
                async (notes) => {
                    return (await this._executeAction('notesModTime', { notes }, ankiConnectUrl)).result as {
                        noteId: number;
                        mod: number;
                    }[];
                },
                { batchSize: ANKI_MOD_BATCH_SIZE }
            )
        ).flat();
    }

    async createDeck(name: string, ankiConnectUrl?: string) {
        const response = await this._executeAction('createDeck', { deck: name }, ankiConnectUrl);
        return response.result;
    }

    async createModel(params: CreateModelParams, ankiConnectUrl?: string) {
        const response = await this._executeAction('createModel', params, ankiConnectUrl);
        return response.result;
    }

    async requestPermission(ankiConnectUrl?: string) {
        const response = await this._executeAction('requestPermission', null, ankiConnectUrl);
        return response.result;
    }

    async version(ankiConnectUrl?: string) {
        const response = await this._executeAction('version', null, ankiConnectUrl);
        return response.result;
    }

    async export({
        text,
        track1,
        track2,
        track3,
        definition,
        audioClip,
        image,
        word,
        source,
        url,
        customFieldValues,
        tags,
        mode,
        ankiConnectUrl,
        noteId,
    }: ExportParams) {
        const fields = {};

        this._appendField(fields, this.settingsProvider.sentenceField, text, true);
        this._appendField(fields, this.settingsProvider.track1Field, track1, true);
        this._appendField(fields, this.settingsProvider.track2Field, track2, true);
        this._appendField(fields, this.settingsProvider.track3Field, track3, true);
        this._appendField(fields, this.settingsProvider.definitionField, definition, true);
        this._appendField(fields, this.settingsProvider.wordField, word, false);
        this._appendField(fields, this.settingsProvider.sourceField, source, false);
        this._appendField(fields, this.settingsProvider.urlField, url, false);

        if (customFieldValues) {
            for (const customFieldName of Object.keys(customFieldValues)) {
                this._appendField(
                    fields,
                    this.settingsProvider.customAnkiFields[customFieldName],
                    customFieldValues[customFieldName],
                    true
                );
            }
        }

        const params: any = {
            note: {
                deckName: this.settingsProvider.deck,
                modelName: this.settingsProvider.noteType,
                tags: tags,
                options: {
                    allowDuplicate: true,
                    duplicateScope: 'deck',
                    duplicateScopeOptions: {
                        deckName: this.settingsProvider.deck,
                        checkChildren: false,
                    },
                },
            },
        };

        const gui = mode === 'gui';
        const isUpdate = mode === 'updateLast' || mode === 'updateSpecific';

        if (this.settingsProvider.audioField && audioClip && audioClip.error === undefined) {
            const sanitizedName = this._sanitizeFileName(audioClip.name);
            const data = await audioClip.base64();

            if (data) {
                if (gui || isUpdate) {
                    const fileName = (await this._storeMediaFile(sanitizedName, data, ankiConnectUrl)).result;
                    this._appendField(fields, this.settingsProvider.audioField, `[sound:${fileName}]`, false);
                } else {
                    params.note['audio'] = {
                        filename: sanitizedName,
                        data,
                        fields: [this.settingsProvider.audioField],
                    };
                }
            }
        }

        if (this.settingsProvider.imageField && image && image.error === undefined) {
            const sanitizedName = this._sanitizeFileName(image.name);
            const data = await image.base64();

            if (data) {
                if (gui || isUpdate) {
                    const fileName = (await this._storeMediaFile(sanitizedName, data, ankiConnectUrl)).result;
                    this._appendField(fields, this.settingsProvider.imageField, `<img src="${fileName}">`, false);
                } else {
                    params.note['picture'] = {
                        filename: sanitizedName,
                        data,
                        fields: [this.settingsProvider.imageField],
                    };
                }
            }
        }

        params.note['fields'] = fields;

        switch (mode) {
            case 'gui':
                return (await this._executeAction('guiAddCards', params, ankiConnectUrl)).result;
            case 'updateLast': {
                const recentNotes = (
                    await this._executeAction('findNotes', { query: 'added:1' }, ankiConnectUrl)
                ).result.sort();

                if (recentNotes.length === 0) {
                    throw new Error('Could not find note to update');
                }

                return await this._updateNoteFields(recentNotes[recentNotes.length - 1], params, tags, ankiConnectUrl);
            }
            case 'updateSpecific': {
                if (noteId === undefined) {
                    throw new Error('noteId is required for updateSpecific mode');
                }

                return await this._updateNoteFields(noteId, params, tags, ankiConnectUrl);
            }
            case 'default':
                return (await this._executeAction('addNote', params, ankiConnectUrl)).result;
            default:
                throw new Error('Unknown export mode: ' + mode);
        }
    }

    private _appendField(fields: any, fieldName: string | undefined, value: string | undefined, multiline: boolean) {
        if (!fieldName || !value) {
            return;
        }

        let newValue = value;
        if (multiline && !containsHtmlTag(value)) {
            newValue = value.split('\n').join('<br>');
        }
        const existingValue = fields[fieldName];

        if (existingValue) {
            newValue = existingValue + '<br>' + newValue;
        }

        fields[fieldName] = newValue;
    }

    private _sanitizeUnsafeURLChars(name: string) {
        return name.replace(unsafeURLChars, replacement);
    }

    private _sanitizeFileName(name: string) {
        if (typeof name.toWellFormed === 'function') {
            name = name.toWellFormed();
        }

        // Sanitize unsafe URL characters for AnkiWeb compatibility.
        name = this._sanitizeUnsafeURLChars(name);
        // Sanitize for file system compatibility on various operating systems.
        name = sanitize(name, { replacement: replacement });
        // Prefix to allow filtering by asbplayer created files,
        // and to prevent Anki from skipping cleanup of files that start with an underscore.
        return 'asbp_' + name;
    }

    private async _storeMediaFile(name: string, base64: string, ankiConnectUrl?: string) {
        return this._executeAction(
            'storeMediaFile',
            { filename: makeUniqueFileName(name), data: base64, deleteExisting: false },
            ankiConnectUrl
        );
    }

    private async _updateNoteFields(noteId: number, params: any, tags: string[], ankiConnectUrl?: string) {
        params.note['id'] = noteId;
        const infoResponse = await this._executeAction('notesInfo', { notes: [noteId] });

        if (infoResponse.result.length === 0 || infoResponse.result[0].noteId !== noteId) {
            throw new Error('Could not update card because the card info could not be fetched');
        }

        const info = infoResponse.result[0];

        this._inheritHtmlMarkupFromField('sentenceField', info, params);
        this._inheritHtmlMarkupFromField('track1Field', info, params);
        this._inheritHtmlMarkupFromField('track2Field', info, params);
        this._inheritHtmlMarkupFromField('track3Field', info, params);

        await this._executeAction('updateNoteFields', params, ankiConnectUrl);

        if (tags.length > 0) {
            await this._executeAction('addTags', { notes: [noteId], tags: tags.join(' ') }, ankiConnectUrl);
        }

        if (!this.settingsProvider.wordField || !info.fields) {
            return info.noteId;
        }

        const wordField = info.fields[this.settingsProvider.wordField];

        if (!wordField || !wordField.value) {
            return info.noteId;
        }

        return wordField.value;
    }

    private _inheritHtmlMarkupFromField(fieldKey: AnkiSettingsFieldKey, info: any, params: any) {
        const fieldName = this.settingsProvider[fieldKey];

        if (
            fieldName &&
            info.fields &&
            typeof info.fields[fieldName]?.value === 'string' &&
            typeof params.note.fields[fieldName] === 'string'
        ) {
            params.note.fields[fieldName] = inheritHtmlMarkup(
                params.note.fields[fieldName],
                info.fields[fieldName].value
            );
        }
    }

    private async _executeAction(action: string, params: any, ankiConnectUrl?: string) {
        const body: any = {
            action: action,
            version: 6,
        };

        if (params) {
            body['params'] = params;
        }

        const json = await this.fetcher.fetch(ankiConnectUrl || this.settingsProvider.ankiConnectUrl, body);

        if (json.error) {
            if (json.error.includes('duplicate')) {
                throw new DuplicateNoteError(json.error);
            }
            throw new Error(json.error);
        }

        return json;
    }
}
