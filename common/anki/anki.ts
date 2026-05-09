import { AudioClip } from '@project/common/audio-clip';
import { AnkiExportMode, CardModel, MediaFragment, Progress } from '@project/common';
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

const logMediaCreationTime = (type: string, extension: string, durationMs: number, fileName: string) => {
    console.info(`[asbplayer] ${type} creation took ${durationMs}ms (${fileName}, .${extension})`);
};

const timedMediaBase64 = async (
    type: string,
    extension: string,
    fileName: string,
    getBase64: () => Promise<string>
) => {
    const startedAt = Date.now();
    const data = await getBase64();
    logMediaCreationTime(type, extension, Date.now() - startedAt, fileName);
    return data;
};

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
    image: MediaFragment | undefined;
    word: string | undefined;
    source: string | undefined;
    url: string | undefined;
    customFieldValues: { [key: string]: string };
    tags: string[];
    mode: AnkiExportMode;
    ankiConnectUrl?: string;
}

interface EncodedMedia {
    sanitizedName: string;
    data: string;
}

interface Base64Exportable {
    name: string;
    extension: string;
    base64: () => Promise<string>;
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
                : MediaFragment.fromBase64(
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
        sinceDays: number,
        fields: string[],
        decks: string[] = [],
        ankiConnectUrl?: string
    ): Promise<number[]> {
        if (!fields.length) return [];
        if (sinceDays < 1) sinceDays = 1;
        const fieldsQuery = fields.map((field) => `"${escapeAnkiQuery(field)}:_*"`).join(' OR ');
        const decksQuery = decks.map((deck) => `"deck:${escapeAnkiDeckQuery(deck)}"`).join(' OR ');
        const query = decksQuery.length ? `(${decksQuery}) (${fieldsQuery})` : fieldsQuery;
        const recentQuery = `(edited:${sinceDays} OR rated:${sinceDays})`;
        return this.findCards(`${recentQuery} (${query})`, ankiConnectUrl);
    }

    async findCardsDueBy(
        dueDays: number,
        fields: string[],
        decks: string[] = [],
        ankiConnectUrl?: string
    ): Promise<number[]> {
        if (!fields.length) return [];
        if (dueDays < 0) dueDays = 0;
        const fieldsQuery = fields.map((field) => `"${escapeAnkiQuery(field)}:_*"`).join(' OR ');
        const decksQuery = decks.map((deck) => `"deck:${escapeAnkiDeckQuery(deck)}"`).join(' OR ');
        const query = decksQuery.length ? `(${decksQuery}) (${fieldsQuery})` : fieldsQuery;
        const dueQuery = `prop:due<=${dueDays}`;
        return this.findCards(`${dueQuery} (${query})`, ankiConnectUrl);
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
        const updateLast = mode === 'updateLast';

        const recentNotes = updateLast ? await this.findNotes('added:1', ankiConnectUrl) : [];
        if (updateLast && recentNotes.length === 0) {
            throw new Error('Could not find note to update');
        }

        const exportableAudio =
            this.settingsProvider.audioField && audioClip && audioClip.error === undefined ? audioClip : undefined;
        const exportableImage =
            this.settingsProvider.imageField && image && image.error === undefined ? image : undefined;

        const [encodedAudio, encodedImage] = await Promise.all([
            this._encodeMedia(exportableAudio, 'audio'),
            this._encodeMedia(exportableImage, image?.extension === 'webm' ? 'clip' : 'image'),
        ]);

        if (encodedAudio) {
            await this._attachAudio(params, fields, encodedAudio, gui || updateLast, ankiConnectUrl);
        }

        if (encodedImage && image) {
            await this._attachMediaFragment(params, fields, encodedImage, image, gui || updateLast, ankiConnectUrl);
        }

        params.note['fields'] = fields;

        switch (mode) {
            case 'gui':
                return (await this._executeAction('guiAddCards', params, ankiConnectUrl)).result;
            case 'updateLast':
                const lastNoteId = [...recentNotes].sort()[recentNotes.length - 1];
                params.note['id'] = lastNoteId;
                const infoResponse = await this._executeAction('notesInfo', { notes: [lastNoteId] }, ankiConnectUrl);

                if (infoResponse.result.length > 0 && infoResponse.result[0].noteId === lastNoteId) {
                    const info = infoResponse.result[0];

                    this._inheritHtmlMarkupFromField('sentenceField', info, params);
                    this._inheritHtmlMarkupFromField('track1Field', info, params);
                    this._inheritHtmlMarkupFromField('track2Field', info, params);
                    this._inheritHtmlMarkupFromField('track3Field', info, params);

                    await this._executeAction('updateNoteFields', params, ankiConnectUrl);

                    if (tags.length > 0) {
                        await this._executeAction(
                            'addTags',
                            { notes: [lastNoteId], tags: tags.join(' ') },
                            ankiConnectUrl
                        );
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

                throw new Error('Could not update last card because the card info could not be fetched');
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

    private async _encodeMedia(media: Base64Exportable | undefined, type: string): Promise<EncodedMedia | undefined> {
        if (!media) {
            return undefined;
        }

        const sanitizedName = this._sanitizeFileName(media.name);
        const data = await timedMediaBase64(type, media.extension, sanitizedName, () => media.base64());

        if (!data) {
            return undefined;
        }

        return { sanitizedName, data };
    }

    private async _attachAudio(
        params: any,
        fields: any,
        encodedAudio: EncodedMedia,
        storeMediaFile: boolean,
        ankiConnectUrl?: string
    ) {
        if (storeMediaFile) {
            await this._storeAndAppendField(
                fields,
                this.settingsProvider.audioField,
                encodedAudio,
                (fileName) => `[sound:${fileName}]`,
                ankiConnectUrl
            );
            return;
        }

        params.note['audio'] = {
            filename: encodedAudio.sanitizedName,
            data: encodedAudio.data,
            fields: [this.settingsProvider.audioField],
        };
    }

    private async _attachMediaFragment(
        params: any,
        fields: any,
        encodedImage: EncodedMedia,
        image: MediaFragment,
        storeMediaFile: boolean,
        ankiConnectUrl?: string
    ) {
        if (image.extension === 'webm' || storeMediaFile) {
            await this._storeAndAppendField(
                fields,
                this.settingsProvider.imageField,
                encodedImage,
                (fileName) => this._mediaFragmentFieldHtml(fileName, image.extension),
                ankiConnectUrl
            );
            return;
        }

        params.note['picture'] = {
            filename: encodedImage.sanitizedName,
            data: encodedImage.data,
            fields: [this.settingsProvider.imageField],
        };
    }

    private async _storeAndAppendField(
        fields: any,
        fieldName: string | undefined,
        encodedMedia: EncodedMedia,
        value: (fileName: string) => string,
        ankiConnectUrl?: string
    ) {
        const fileName = (await this._storeMediaFile(encodedMedia.sanitizedName, encodedMedia.data, ankiConnectUrl))
            .result;
        this._appendField(fields, fieldName, value(fileName), false);
    }

    private _mediaFragmentFieldHtml(fileName: string, extension: string) {
        if (extension === 'webm') {
            return `<video autoplay loop muted playsinline src="${fileName}"></video>`;
        }

        return `<img src="${fileName}">`;
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
