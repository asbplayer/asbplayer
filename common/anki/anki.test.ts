import {
    Anki,
    CardInfo,
    DuplicateNoteError,
    escapeAnkiDeckQuery,
    escapeAnkiQuery,
    exportCard,
    inheritHtmlMarkup,
    NoteInfo,
} from '@project/common/anki';
import { AnkiSettings } from '@project/common/settings';
import { CardModel, Fetcher } from '@project/common';
import { extractText, sourceString } from '@project/common/util';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const testAnkiSettings: AnkiSettings = {
    ankiConnectUrl: 'http://127.0.0.1:8765',
    ankiConnectApiKey: '',
    deck: 'Sentences',
    noteType: 'Sentence',
    sentenceField: 'Sentence',
    definitionField: 'Definition',
    audioField: 'Audio',
    imageField: 'Image',
    wordField: 'Word',
    sourceField: 'Source',
    urlField: 'Url',
    track1Field: 'Track1',
    track2Field: 'Track2',
    track3Field: 'Track3',
    customAnkiFields: {},
    tags: [],
    recordWithAudioPlayback: false,
    preferMp3: false,
    audioPaddingStart: 0,
    audioPaddingEnd: 0,
    maxImageWidth: 0,
    maxImageHeight: 0,
    mediaFragmentFormat: 'jpeg',
    mediaFragmentTrimStart: 200,
    mediaFragmentTrimEnd: 200,
    mediaFragmentMaxClipLength: 10000,
    surroundingSubtitlesCountRadius: 0,
    surroundingSubtitlesTimeRadius: 0,
    ankiFieldSettings: {
        sentence: { order: 0, display: true },
        definition: { order: 1, display: true },
        audio: { order: 2, display: true },
        image: { order: 3, display: true },
        word: { order: 4, display: true },
        source: { order: 5, display: true },
        url: { order: 6, display: true },
        track1: { order: 7, display: true },
        track2: { order: 8, display: true },
        track3: { order: 9, display: true },
    },
    customAnkiFieldSettings: {},
};

const makeCardInfo = (overrides: Partial<CardInfo> = {}): CardInfo => ({
    answer: '<div>answer</div>',
    question: '<div>question</div>',
    deckName: 'test_deck',
    modelName: 'test_model',
    fieldOrder: 0,
    fields: {
        Sentence: { value: 'sentence', order: 0 },
        Word: { value: 'word', order: 1 },
    },
    css: '.card {}',
    cardId: 1,
    interval: 5,
    factor: 2500,
    note: 11,
    ord: 0,
    type: 2,
    queue: 2,
    due: 0,
    reps: 3,
    lapses: 0,
    left: 0,
    mod: 123456,
    nextReviews: ['1d', '3d', '5d', '10d'],
    flags: 0,
    ...overrides,
});

const makeNoteInfo = (overrides: Partial<NoteInfo> = {}): NoteInfo => ({
    noteId: 11,
    profile: 'User 1',
    modelName: 'test_model',
    tags: ['tag1'],
    fields: {
        Sentence: { value: 'sentence', order: 0 },
        Word: { value: 'word', order: 1 },
    },
    mod: 123456,
    cards: [1, 2],
    ...overrides,
});

const ankiConnectResponse = <T>(result: T) => ({ result, error: null });

type ExportArguments = Parameters<Anki['export']>[0];

class MockFetcher implements Fetcher {
    readonly fetch = jest.fn<Fetcher['fetch']>();
}

const makeSubtitle = (text: string, track = 0) => ({
    text,
    start: 1000,
    end: 2000,
    originalStart: 1000,
    originalEnd: 2000,
    track,
});

const makeAudioClip = (overrides: Record<string, unknown> & { base64Result?: string; base64Error?: Error } = {}) => {
    const media = {
        name: 'clip:name?.mp3',
        error: undefined,
        base64Reads: 0,
        base64: async () => {
            media.base64Reads++;
            if (overrides.base64Error) throw overrides.base64Error;
            return overrides.base64Result ?? 'audio-base64';
        },
        ...overrides,
    };
    return media as any;
};

const makeImage = (overrides: Record<string, unknown> & { base64Result?: string } = {}) => {
    const media = {
        name: 'image:name?.jpeg',
        error: undefined,
        base64Reads: 0,
        base64: async () => {
            media.base64Reads++;
            return overrides.base64Result ?? 'image-base64';
        },
        ...overrides,
    };
    return media as any;
};

const makeExportArguments = (overrides: Partial<ExportArguments> = {}): ExportArguments => ({
    text: 'line 1\nline 2',
    track1: 'track 1',
    track2: '<span>track 2</span>',
    track3: undefined,
    definition: 'definition line 1\ndefinition line 2',
    audioClip: undefined,
    image: undefined,
    word: 'term',
    source: 'Episode 1',
    url: 'https://example.com',
    customFieldValues: {},
    tags: ['tag-a', 'tag-b'],
    mode: 'default',
    ...overrides,
});

const makeCardModel = (overrides: Partial<CardModel> = {}): CardModel => ({
    subtitle: makeSubtitle('main subtitle'),
    surroundingSubtitles: [
        makeSubtitle('track 0 line', 0),
        makeSubtitle('track 1 line', 1),
        makeSubtitle('track 2 line', 2),
    ],
    subtitleFileName: 'episode.ass',
    mediaTimestamp: 12345,
    text: 'manual text',
    word: 'term',
    definition: 'definition',
    customFieldValues: { Hint: 'hint' },
    url: 'https://example.com',
    audio: {
        base64: 'audio-base64',
        extension: 'mp3',
        paddingStart: 0,
        paddingEnd: 0,
        playbackRate: 1,
    },
    image: {
        base64: 'image-base64',
        extension: 'jpeg',
    },
    ...overrides,
});

afterEach(() => {
    jest.restoreAllMocks();
});

it('escapes Anki query special characters', () => {
    expect(escapeAnkiQuery('a"b*c_d\\e:f')).toEqual('a\\"b\\*c\\_d\\\\e\\:f');
});

it('escapes deck query characters without escaping colons', () => {
    expect(escapeAnkiDeckQuery('deck:name*with_"slash\\')).toEqual('deck:name\\*with\\_\\"slash\\\\');
});

it('applies source markup to matching plain words', () => {
    expect(inheritHtmlMarkup('a foo bar', '<c>foo</c> <b>bar</b> is')).toEqual('a <c>foo</c> <b>bar</b>');
});

it('adds missing outer markup around an already-marked target word', () => {
    expect(inheritHtmlMarkup('a <c class="term">foo</c> bar', '<b><c class="term">foo</c></b> <b>bar</b> is')).toEqual(
        'a <b><c class="term">foo</c></b> <b>bar</b>'
    );
});

it('applies nested source markup to a plain target word', () => {
    expect(inheritHtmlMarkup('a foo bar', '<b><c class="term">foo</c></b> <b>bar</b> is')).toEqual(
        'a <b><c class="term">foo</c></b> <b>bar</b>'
    );
});

it('inherits marked up html with multi-character tag names', () => {
    expect(inheritHtmlMarkup('a foo bar', '<strong><span class="term">foo</span></strong> <em>bar</em> is')).toEqual(
        'a <strong><span class="term">foo</span></strong> <em>bar</em>'
    );
});

it('applies multiple missing outer tags around an already-marked target word', () => {
    expect(
        inheritHtmlMarkup('a <c class="term">foo</c> bar', '<d><b><c class="term">foo</c></b></d> <b>bar</b> is')
    ).toEqual('a <d><b><c class="term">foo</c></b></d> <b>bar</b>');
});

it('does not copy source line-break tags into the target', () => {
    expect(inheritHtmlMarkup('a foo bar', '<d>foo</d><br> <b>bar</b> is')).toEqual('a <d>foo</d> <b>bar</b>');
});

it('preserves target markup instead of replacing it with shallower source markup', () => {
    expect(
        inheritHtmlMarkup('a <d><b><c class="term">foo</c></b></d> bar', '<b><c class="term">foo</c></b> <b>bar</b> is')
    ).toEqual('a <d><b><c class="term">foo</c></b></d> <b>bar</b>');
});

it('maps CardModel data into export params in exportCard', async () => {
    const fetcher = new MockFetcher();
    fetcher.fetch.mockResolvedValue(ankiConnectResponse('stored-word'));
    const card = makeCardModel({
        text: undefined,
        mediaTimestamp: 0,
        customFieldValues: undefined,
        audio: {
            base64: 'audio-base64',
            extension: 'mp3',
            paddingStart: 0,
            paddingEnd: 0,
        },
    });

    const result = await exportCard(card, testAnkiSettings, 'default', fetcher);

    expect(result).toEqual('stored-word');
    expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
        action: 'addNote',
        version: 6,
        params: {
            note: {
                deckName: 'Sentences',
                modelName: 'Sentence',
                tags: [],
                options: {
                    allowDuplicate: true,
                    duplicateScope: 'deck',
                    duplicateScopeOptions: { deckName: 'Sentences', checkChildren: false },
                },
                audio: { filename: 'asbp_episode_1000.mp3', data: 'audio-base64', fields: ['Audio'] },
                picture: { filename: 'asbp_episode_1000.jpeg', data: 'image-base64', fields: ['Image'] },
                fields: {
                    Sentence: extractText(card.subtitle, card.surroundingSubtitles).replaceAll('\n', '<br>'),
                    Track1: extractText(card.subtitle, card.surroundingSubtitles, 0),
                    Track2: extractText(card.subtitle, card.surroundingSubtitles, 1),
                    Track3: extractText(card.subtitle, card.surroundingSubtitles, 2),
                    Definition: card.definition,
                    Word: card.word,
                    Source: sourceString(card.subtitleFileName, 0),
                    Url: card.url,
                },
            },
        },
    });
});

it('forwards GUI export mode in exportCard', async () => {
    const fetcher = new MockFetcher();
    fetcher.fetch.mockResolvedValue(ankiConnectResponse('stored-word'));
    const card = makeCardModel({ audio: undefined, image: undefined });

    await expect(exportCard(card, testAnkiSettings, 'gui', fetcher)).resolves.toBe('stored-word');
    expect(fetcher.fetch).toHaveBeenCalledWith(
        testAnkiSettings.ankiConnectUrl,
        expect.objectContaining({ action: 'guiAddCards' })
    );
});

it('passes through missing media in exportCard without constructing clips', async () => {
    const fetcher = new MockFetcher();
    fetcher.fetch.mockResolvedValue(ankiConnectResponse('stored-word'));
    const card = makeCardModel({ audio: undefined, image: undefined, mediaTimestamp: 12345 });

    await exportCard(card, testAnkiSettings, 'default', fetcher);

    const request = fetcher.fetch.mock.calls[0][1];
    expect(request.params.note.audio).toBeUndefined();
    expect(request.params.note.picture).toBeUndefined();
    expect(request.params.note.fields.Source).toBe(sourceString(card.subtitleFileName, card.mediaTimestamp));
});

describe('Anki', () => {
    it('exposes connection settings and includes a configured API key in requests', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(['Default']));
        const settings = { ...testAnkiSettings, ankiConnectApiKey: 'secret-key' };
        const anki = new Anki(settings, fetcher);

        expect(anki.ankiConnectUrl).toBe(testAnkiSettings.ankiConnectUrl);
        expect(anki.ankiConnectApiKey).toBe('secret-key');
        await expect(anki.deckNames()).resolves.toEqual(['Default']);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'deckNames',
            version: 6,
            key: 'secret-key',
        });
    });

    it.each([
        {
            name: 'findCardsWithWord',
            invoke: (anki: Anki) => anki.findCardsWithWord('term', []),
        },
        {
            name: 'findCardsContainingWord',
            invoke: (anki: Anki) => anki.findCardsContainingWord('term', []),
        },
        {
            name: 'findNotesWithFieldsContainingWord',
            invoke: (anki: Anki) => anki.findNotesWithFieldsContainingWord('term', []),
        },
        {
            name: 'findRecentlyEditedOrReviewedCards',
            invoke: (anki: Anki) => anki.findRecentlyEditedOrReviewedCards(1, []),
        },
        {
            name: 'findCardsDueBy',
            invoke: (anki: Anki) => anki.findCardsDueBy(1, []),
        },
        {
            name: 'cardsInfo',
            invoke: (anki: Anki) => anki.cardsInfo([]),
        },
        {
            name: 'cardsModTime',
            invoke: (anki: Anki) => anki.cardsModTime([]),
        },
        {
            name: 'areSuspended',
            invoke: (anki: Anki) => anki.areSuspended([]),
        },
        {
            name: 'notesInfo',
            invoke: (anki: Anki) => anki.notesInfo([]),
        },
        {
            name: 'notesModTime',
            invoke: (anki: Anki) => anki.notesModTime([]),
        },
    ])('returns an empty array without calling AnkiConnect for empty inputs in $name', async ({ invoke }) => {
        const fetcher = new MockFetcher();
        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(invoke(anki)).resolves.toEqual([]);
        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it.each([
        {
            name: 'deckNames',
            invoke: (anki: Anki) => anki.deckNames('http://override:8765'),
            action: 'deckNames',
            params: undefined,
            result: ['Default', 'Mining'],
            url: 'http://override:8765',
        },
        {
            name: 'modelNames',
            invoke: (anki: Anki) => anki.modelNames(),
            action: 'modelNames',
            params: undefined,
            result: ['Basic', 'Sentence'],
            url: testAnkiSettings.ankiConnectUrl,
        },
        {
            name: 'modelFieldNames',
            invoke: (anki: Anki) => anki.modelFieldNames('Sentence'),
            action: 'modelFieldNames',
            params: { modelName: 'Sentence' },
            result: ['Sentence', 'Word'],
            url: testAnkiSettings.ankiConnectUrl,
        },
        {
            name: 'createDeck',
            invoke: (anki: Anki) => anki.createDeck('Mining'),
            action: 'createDeck',
            params: { deck: 'Mining' },
            result: 1,
            url: testAnkiSettings.ankiConnectUrl,
        },
        {
            name: 'createModel',
            invoke: (anki: Anki) =>
                anki.createModel({
                    modelName: 'Sentence',
                    inOrderFields: ['Sentence', 'Word'],
                    css: '.card {}',
                    cardTemplates: [{ Front: '{{Sentence}}', Back: '{{Word}}' }],
                }),
            action: 'createModel',
            params: {
                modelName: 'Sentence',
                inOrderFields: ['Sentence', 'Word'],
                css: '.card {}',
                cardTemplates: [{ Front: '{{Sentence}}', Back: '{{Word}}' }],
            },
            result: { created: true },
            url: testAnkiSettings.ankiConnectUrl,
        },
        {
            name: 'requestPermission',
            invoke: (anki: Anki) => anki.requestPermission(),
            action: 'requestPermission',
            params: undefined,
            result: { permission: 'granted' },
            url: testAnkiSettings.ankiConnectUrl,
        },
        {
            name: 'version',
            invoke: (anki: Anki) => anki.version(),
            action: 'version',
            params: undefined,
            result: 6,
            url: testAnkiSettings.ankiConnectUrl,
        },
    ])('returns AnkiConnect results for $name', async ({ invoke, action, params, result, url }) => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(result));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(invoke(anki)).resolves.toEqual(result);
        expect(fetcher.fetch).toHaveBeenCalledWith(
            url,
            params === undefined
                ? {
                      action,
                      version: 6,
                  }
                : {
                      action,
                      version: 6,
                      params,
                  }
        );
    });

    it('passes arbitrary queries directly to findCards and findNotes', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([1, 2]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([11, 12]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.findCards('is:new', 'http://override:8765')).resolves.toEqual([1, 2]);
        await expect(anki.findNotes('deck:Mining')).resolves.toEqual([11, 12]);
        expect(fetcher.fetch.mock.calls).toEqual([
            [
                'http://override:8765',
                {
                    action: 'findCards',
                    version: 6,
                    params: { query: 'is:new' },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findNotes',
                    version: 6,
                    params: { query: 'deck:Mining' },
                },
            ],
        ]);
    });

    it('builds the exact field query for findCardsWithWord', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([1, 2]));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.findCardsWithWord('foo:bar', ['Sentence', 'Word']);

        expect(result).toEqual([1, 2]);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'findCards',
            version: 6,
            params: { query: '"Sentence:foo\\:bar" OR "Word:foo\\:bar"' },
        });
    });

    it('builds the exact field query for a single field in findCardsWithWord', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([1]));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.findCardsWithWord('foo:bar', ['Sentence']);

        expect(result).toEqual([1]);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'findCards',
            version: 6,
            params: { query: '"Sentence:foo\\:bar"' },
        });
    });

    it('builds the wildcard field query for findCardsContainingWord', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([1, 2]));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.findCardsContainingWord('foo:bar', ['Sentence', 'Word']);

        expect(result).toEqual([1, 2]);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'findCards',
            version: 6,
            params: { query: '"Sentence:*foo\\:bar*" OR "Word:*foo\\:bar*"' },
        });
    });

    it('builds the wildcard query for a single field in findCardsContainingWord', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([2]));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.findCardsContainingWord('foo:bar', ['Sentence']);

        expect(result).toEqual([2]);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'findCards',
            version: 6,
            params: { query: '"Sentence:*foo\\:bar*"' },
        });
    });

    it('uses the configured word field for note lookups and GUI browsing', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([11]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([11]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.findNotesWithWord('foo:bar')).resolves.toEqual([11]);
        await expect(anki.findNotesWithWordGui('foo:bar')).resolves.toEqual([11]);
        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findNotes',
                    version: 6,
                    params: { query: '"Word:foo\\:bar"' },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'guiBrowse',
                    version: 6,
                    params: { query: '"Word:foo\\:bar"' },
                },
            ],
        ]);
    });

    it('builds wildcard note queries across configured fields', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([11, 12]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.findNotesWithFieldsContainingWord('foo:bar', ['Sentence', 'Word'])).resolves.toEqual([
            11, 12,
        ]);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'findNotes',
            version: 6,
            params: { query: '"Sentence:*foo\\:bar*" OR "Word:*foo\\:bar*"' },
        });
    });

    it('detects AnkiConnect responses that require an API key', () => {
        expect(Anki.requiresApiKey(null)).toBe(false);
        expect(Anki.requiresApiKey('valid api key must be provided')).toBe(true);
        expect(Anki.requiresApiKey(new Error('Valid API key must be provided'))).toBe(true);
        expect(Anki.requiresApiKey({ requireApikey: true })).toBe(true);
        expect(Anki.requiresApiKey({ requireApiKey: true })).toBe(true);
        expect(Anki.requiresApiKey({ error: 'valid api key must be provided' })).toBe(true);
        expect(Anki.requiresApiKey({ error: 'other error' })).toBe(false);
    });

    it('builds the recency and due queries with escaped fields and decks', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([1]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([2]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.findRecentlyEditedOrReviewedCards(0, ['Sentence:Field'], ['Mining*Deck'])).resolves.toEqual([
            1,
        ]);
        await expect(anki.findCardsDueBy(-3, ['Sentence:Field'], ['Mining*Deck'])).resolves.toEqual([2]);

        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findCards',
                    version: 6,
                    params: {
                        query: '(edited:1 OR rated:1) (("deck:Mining\\*Deck") ("Sentence\\:Field:_*"))',
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findCards',
                    version: 6,
                    params: {
                        query: 'prop:due<=0 (("deck:Mining\\*Deck") ("Sentence\\:Field:_*"))',
                    },
                },
            ],
        ]);
    });

    it('builds recency and due queries for multiple fields and decks', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([1, 2]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([3, 4]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(
            anki.findRecentlyEditedOrReviewedCards(2, ['Sentence:Field', 'Word'], ['Mining*Deck', 'Secondary'])
        ).resolves.toEqual([1, 2]);
        await expect(anki.findCardsDueBy(5, ['Sentence:Field', 'Word'], ['Mining*Deck', 'Secondary'])).resolves.toEqual(
            [3, 4]
        );

        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findCards',
                    version: 6,
                    params: {
                        query: '(edited:2 OR rated:2) (("deck:Mining\\*Deck" OR "deck:Secondary") ("Sentence\\:Field:_*" OR "Word:_*"))',
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findCards',
                    version: 6,
                    params: {
                        query: 'prop:due<=5 (("deck:Mining\\*Deck" OR "deck:Secondary") ("Sentence\\:Field:_*" OR "Word:_*"))',
                    },
                },
            ],
        ]);
    });

    it('omits deck filters when no decks are supplied for recency and due queries', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([5]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([6]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.findRecentlyEditedOrReviewedCards(3, ['Sentence:Field', 'Word'])).resolves.toEqual([5]);
        await expect(anki.findCardsDueBy(7, ['Sentence:Field', 'Word'])).resolves.toEqual([6]);

        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findCards',
                    version: 6,
                    params: {
                        query: '(edited:3 OR rated:3) ("Sentence\\:Field:_*" OR "Word:_*")',
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findCards',
                    version: 6,
                    params: {
                        query: 'prop:due<=7 ("Sentence\\:Field:_*" OR "Word:_*")',
                    },
                },
            ],
        ]);
    });

    it('returns empty card lookups without querying Anki when no fields are supplied', async () => {
        const fetcher = new MockFetcher();
        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.findCardsWithWord('term', [])).resolves.toEqual([]);
        await expect(anki.findCardsContainingWord('term', [])).resolves.toEqual([]);
        await expect(anki.findNotesWithFieldsContainingWord('term', [])).resolves.toEqual([]);
        await expect(anki.findRecentlyEditedOrReviewedCards(1, [])).resolves.toEqual([]);
        await expect(anki.findCardsDueBy(1, [])).resolves.toEqual([]);

        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('cardsInfo strips answer, question, and css from the AnkiConnect response', async () => {
        const fetcher = new MockFetcher();
        const responseCard = makeCardInfo();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([responseCard]));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.cardsInfo([responseCard.cardId]);

        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'cardsInfo',
            version: 6,
            params: { cards: [responseCard.cardId] },
        });
        expect(result).toEqual([
            {
                ...responseCard,
                answer: undefined,
                question: undefined,
                css: undefined,
            },
        ]);
        expect(result[0]).not.toHaveProperty('answer');
        expect(result[0]).not.toHaveProperty('question');
        expect(result[0]).not.toHaveProperty('css');
    });

    it('returns card mod times for a single card', async () => {
        const fetcher = new MockFetcher();
        const modTimes = [{ cardId: 7, mod: 123456 }];
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(modTimes));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.cardsModTime([7])).resolves.toEqual(modTimes);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'cardsModTime',
            version: 6,
            params: { cards: [7] },
        });
    });

    it('batches cardsModTime and notesModTime requests at 10000 ids', async () => {
        const fetcher = new MockFetcher();
        const requestedCards: number[][] = [];
        const requestedNotes: number[][] = [];

        fetcher.fetch.mockImplementation(async (_url, body) => {
            if (body.action === 'cardsModTime') {
                const cards = body.params.cards as number[];
                requestedCards.push(cards);
                return ankiConnectResponse(cards.map((cardId) => ({ cardId, mod: cardId + 100 })));
            }

            if (body.action === 'notesModTime') {
                const notes = body.params.notes as number[];
                requestedNotes.push(notes);
                return ankiConnectResponse(notes.map((noteId) => ({ noteId, mod: noteId + 200 })));
            }

            throw new Error(`Unexpected action ${body.action}`);
        });

        const anki = new Anki(testAnkiSettings, fetcher);
        const cardIds = Array.from({ length: 10001 }, (_, index) => index + 1);
        const noteIds = Array.from({ length: 10001 }, (_, index) => index + 1);

        const cardsModTime = await anki.cardsModTime(cardIds);
        const notesModTime = await anki.notesModTime(noteIds);

        expect(requestedCards).toEqual([cardIds.slice(0, 10000), cardIds.slice(10000)]);
        expect(requestedNotes).toEqual([noteIds.slice(0, 10000), noteIds.slice(10000)]);
        expect(cardsModTime[0]).toEqual({ cardId: 1, mod: 101 });
        expect(cardsModTime[cardsModTime.length - 1]).toEqual({ cardId: 10001, mod: 10101 });
        expect(notesModTime[0]).toEqual({ noteId: 1, mod: 201 });
        expect(notesModTime[notesModTime.length - 1]).toEqual({ noteId: 10001, mod: 10201 });
    });

    it('returns note mod times for a single note', async () => {
        const fetcher = new MockFetcher();
        const modTimes = [{ noteId: 7, mod: 654321 }];
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(modTimes));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.notesModTime([7])).resolves.toEqual(modTimes);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'notesModTime',
            version: 6,
            params: { notes: [7] },
        });
    });

    it.each([
        { cards: [7], result: [true] },
        { cards: [7, 8], result: [true, null] },
    ])('passes through areSuspended results for $cards', async ({ cards, result }) => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(result));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.areSuspended(cards)).resolves.toEqual(result);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'areSuspended',
            version: 6,
            params: { cards },
        });
    });

    it('batches cardsInfo and notesInfo requests using the AnkiConnect contract', async () => {
        const fetcher = new MockFetcher();
        const requestedCards: number[][] = [];
        const requestedNotes: number[][] = [];

        fetcher.fetch.mockImplementation(async (_url, body) => {
            if (body.action === 'cardsInfo') {
                const cards = body.params.cards as number[];
                requestedCards.push(cards);
                return ankiConnectResponse(cards.map((cardId) => makeCardInfo({ cardId, note: cardId + 1000 })));
            }

            if (body.action === 'notesInfo') {
                const notes = body.params.notes as number[];
                requestedNotes.push(notes);
                return ankiConnectResponse(notes.map((noteId) => makeNoteInfo({ noteId, cards: [noteId * 10] })));
            }

            throw new Error(`Unexpected action ${body.action}`);
        });

        const anki = new Anki(testAnkiSettings, fetcher);
        const cardIds = Array.from({ length: 12 }, (_, index) => index + 1);
        const noteIds = Array.from({ length: 101 }, (_, index) => index + 1);

        const cardsInfo = await anki.cardsInfo(cardIds);
        const notesInfo = await anki.notesInfo(noteIds);

        expect(requestedCards).toEqual([cardIds.slice(0, 10), cardIds.slice(10)]);
        expect(requestedNotes).toEqual([noteIds.slice(0, 100), noteIds.slice(100)]);
        expect(cardsInfo.map((card) => card.cardId)).toEqual(cardIds);
        expect(cardsInfo.every((card) => !('answer' in card) && !('question' in card) && !('css' in card))).toBe(true);
        expect(notesInfo.map((note) => note.noteId)).toEqual(noteIds);
    });

    it('exports a default note with multiline fields and inline media payloads', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(321));
        const audioClip = makeAudioClip();
        const image = makeImage();
        const settings = {
            ...testAnkiSettings,
            customAnkiFields: { ExtraDefinition: 'Definition' },
        };
        const anki = new Anki(settings, fetcher);

        const result = await anki.export(
            makeExportArguments({
                audioClip,
                image,
                customFieldValues: { ExtraDefinition: 'custom note' },
            })
        );

        expect(result).toEqual(321);
        expect(audioClip.base64Reads).toBe(1);
        expect(image.base64Reads).toBe(1);
        expect(fetcher.fetch).toHaveBeenCalledWith(testAnkiSettings.ankiConnectUrl, {
            action: 'addNote',
            version: 6,
            params: {
                note: {
                    deckName: settings.deck,
                    modelName: settings.noteType,
                    tags: ['tag-a', 'tag-b'],
                    options: {
                        allowDuplicate: true,
                        duplicateScope: 'deck',
                        duplicateScopeOptions: {
                            deckName: settings.deck,
                            checkChildren: false,
                        },
                    },
                    audio: {
                        filename: 'asbp_clip_name_.mp3',
                        data: 'audio-base64',
                        fields: ['Audio'],
                    },
                    picture: {
                        filename: 'asbp_image_name_.jpeg',
                        data: 'image-base64',
                        fields: ['Image'],
                    },
                    fields: {
                        Sentence: 'line 1<br>line 2',
                        Track1: 'track 1',
                        Track2: '<span>track 2</span>',
                        Definition: 'definition line 1<br>definition line 2<br>custom note',
                        Word: 'term',
                        Source: 'Episode 1',
                        Url: 'https://example.com',
                    },
                },
            },
        });
    });

    it('skips errored media and media that encodes to an empty payload', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(321));
        const audioClip = makeAudioClip({ error: new Error('audio failed') });
        const image = makeImage({ base64Result: '' });
        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments({ audioClip, image }))).resolves.toEqual(321);

        expect(audioClip.base64Reads).toBe(0);
        expect(image.base64Reads).toBe(1);
        const body = fetcher.fetch.mock.calls[0][1];
        expect(body.action).toBe('addNote');
        expect(body.params.note.audio).toBeUndefined();
        expect(body.params.note.picture).toBeUndefined();
        expect(body.params.note.fields.Audio).toBeUndefined();
        expect(body.params.note.fields.Image).toBeUndefined();
    });

    it('rejects media encoding failures before creating an Anki note', async () => {
        const fetcher = new MockFetcher();
        const audioClip = makeAudioClip({
            base64Error: new Error('encode failed'),
        });
        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments({ audioClip }))).rejects.toThrow('encode failed');
        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('exports a default note with a webm media fragment by storing it and appending video html', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-clip.webm'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(322));
        const image = makeImage({ name: 'clip:name?.webm', extension: 'webm' });
        const anki = new Anki(testAnkiSettings, fetcher);

        const result = await anki.export(
            makeExportArguments({
                audioClip: undefined,
                image,
            })
        );

        expect(result).toEqual(322);
        expect(image.base64Reads).toBe(1);
        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'storeMediaFile',
                    version: 6,
                    params: {
                        filename: expect.stringMatching(/^asbp_clip_name__[A-Za-z0-9]{8}\.webm$/),
                        data: 'image-base64',
                        deleteExisting: false,
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'addNote',
                    version: 6,
                    params: {
                        note: {
                            deckName: testAnkiSettings.deck,
                            modelName: testAnkiSettings.noteType,
                            tags: ['tag-a', 'tag-b'],
                            options: {
                                allowDuplicate: true,
                                duplicateScope: 'deck',
                                duplicateScopeOptions: {
                                    deckName: testAnkiSettings.deck,
                                    checkChildren: false,
                                },
                            },
                            fields: {
                                Sentence: 'line 1<br>line 2',
                                Track1: 'track 1',
                                Track2: '<span>track 2</span>',
                                Definition: 'definition line 1<br>definition line 2',
                                Word: 'term',
                                Source: 'Episode 1',
                                Url: 'https://example.com',
                                Image: '<video autoplay loop muted playsinline src="stored-clip.webm"></video>',
                            },
                        },
                    },
                },
            ],
        ]);
    });

    it('uses the per-export AnkiConnect URL override for default exports', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse(321));
        const anki = new Anki(testAnkiSettings, fetcher);

        await anki.export(makeExportArguments({ ankiConnectUrl: 'http://override:8765' }));

        expect(fetcher.fetch).toHaveBeenCalledWith(
            'http://override:8765',
            expect.objectContaining({ action: 'addNote' })
        );
    });

    it('exports GUI notes by storing media files and referencing the stored filenames', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-audio.mp3'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-image.jpeg'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(654));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.export(
            makeExportArguments({
                audioClip: makeAudioClip(),
                image: makeImage(),
                mode: 'gui',
            })
        );

        expect(result).toEqual(654);
        expect(fetcher.fetch.mock.calls[0]).toEqual([
            testAnkiSettings.ankiConnectUrl,
            {
                action: 'storeMediaFile',
                version: 6,
                params: {
                    filename: expect.stringMatching(/^asbp_clip_name__[A-Za-z0-9]{8}\.mp3$/),
                    data: 'audio-base64',
                    deleteExisting: false,
                },
            },
        ]);
        expect(fetcher.fetch.mock.calls[1]).toEqual([
            testAnkiSettings.ankiConnectUrl,
            {
                action: 'storeMediaFile',
                version: 6,
                params: {
                    filename: expect.stringMatching(/^asbp_image_name__[A-Za-z0-9]{8}\.jpeg$/),
                    data: 'image-base64',
                    deleteExisting: false,
                },
            },
        ]);
        expect(fetcher.fetch.mock.calls[2]).toEqual([
            testAnkiSettings.ankiConnectUrl,
            {
                action: 'guiAddCards',
                version: 6,
                params: {
                    note: {
                        deckName: testAnkiSettings.deck,
                        modelName: testAnkiSettings.noteType,
                        tags: ['tag-a', 'tag-b'],
                        options: {
                            allowDuplicate: true,
                            duplicateScope: 'deck',
                            duplicateScopeOptions: {
                                deckName: testAnkiSettings.deck,
                                checkChildren: false,
                            },
                        },
                        fields: {
                            Sentence: 'line 1<br>line 2',
                            Track1: 'track 1',
                            Track2: '<span>track 2</span>',
                            Definition: 'definition line 1<br>definition line 2',
                            Word: 'term',
                            Source: 'Episode 1',
                            Url: 'https://example.com',
                            Audio: '[sound:stored-audio.mp3]',
                            Image: '<img src="stored-image.jpeg">',
                        },
                    },
                },
            },
        ]);
    });

    it('exports GUI notes with webm media fragments using video html', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-audio.mp3'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-clip.webm'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(655));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.export(
            makeExportArguments({
                audioClip: makeAudioClip(),
                image: makeImage({ name: 'clip:name?.webm', extension: 'webm' }),
                mode: 'gui',
            })
        );

        expect(result).toEqual(655);
        expect(fetcher.fetch.mock.calls[2]).toEqual([
            testAnkiSettings.ankiConnectUrl,
            {
                action: 'guiAddCards',
                version: 6,
                params: {
                    note: {
                        deckName: testAnkiSettings.deck,
                        modelName: testAnkiSettings.noteType,
                        tags: ['tag-a', 'tag-b'],
                        options: {
                            allowDuplicate: true,
                            duplicateScope: 'deck',
                            duplicateScopeOptions: {
                                deckName: testAnkiSettings.deck,
                                checkChildren: false,
                            },
                        },
                        fields: {
                            Sentence: 'line 1<br>line 2',
                            Track1: 'track 1',
                            Track2: '<span>track 2</span>',
                            Definition: 'definition line 1<br>definition line 2',
                            Word: 'term',
                            Source: 'Episode 1',
                            Url: 'https://example.com',
                            Audio: '[sound:stored-audio.mp3]',
                            Image: '<video autoplay loop muted playsinline src="stored-clip.webm"></video>',
                        },
                    },
                },
            },
        ]);
    });

    it('updates the latest note, inherits markup, adds tags, and returns the stored word in updateLast mode', async () => {
        const fetcher = new MockFetcher();
        // Note ids include values whose lexicographic order differs from numeric order
        // ('11' < '4' as strings) and arrive newest-first to guard the numeric comparator.
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([11, 4]));
        fetcher.fetch.mockResolvedValueOnce(
            ankiConnectResponse([
                makeNoteInfo({
                    noteId: 11,
                    fields: {
                        Sentence: { value: '<b>foo</b> <i>bar</i>', order: 0 },
                        Track1: { value: '<u>track one</u>', order: 1 },
                        Track2: { value: '<span>track two</span>', order: 2 },
                        Track3: { value: '<a>track three</a>', order: 3 },
                        Word: { value: 'stored word', order: 4 },
                    },
                }),
            ])
        );
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(null));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(null));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.export(
            makeExportArguments({
                text: 'foo bar',
                track1: 'track one',
                track2: 'track two',
                track3: 'track three',
                tags: ['tagged'],
                mode: 'updateLast',
            })
        );

        expect(result).toEqual('stored word');
        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findNotes',
                    version: 6,
                    params: { query: 'added:1' },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'notesInfo',
                    version: 6,
                    params: { notes: [11] },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'updateNoteFields',
                    version: 6,
                    params: {
                        note: {
                            deckName: testAnkiSettings.deck,
                            modelName: testAnkiSettings.noteType,
                            tags: ['tagged'],
                            options: {
                                allowDuplicate: true,
                                duplicateScope: 'deck',
                                duplicateScopeOptions: {
                                    deckName: testAnkiSettings.deck,
                                    checkChildren: false,
                                },
                            },
                            id: 11,
                            fields: {
                                Sentence: '<b>foo</b> <i>bar</i>',
                                Track1: '<u>track one</u>',
                                Track2: '<span>track two</span>',
                                Track3: '<a>track three</a>',
                                Definition: 'definition line 1<br>definition line 2',
                                Word: 'term',
                                Source: 'Episode 1',
                                Url: 'https://example.com',
                            },
                        },
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'addTags',
                    version: 6,
                    params: { notes: [11], tags: 'tagged' },
                },
            ],
        ]);
    });

    it('uses the per-export AnkiConnect URL override throughout updateLast exports', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([8]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([makeNoteInfo({ noteId: 8 })]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(null));
        const anki = new Anki(testAnkiSettings, fetcher);

        await anki.export(
            makeExportArguments({
                ankiConnectUrl: 'http://override:8765',
                tags: [],
                mode: 'updateLast',
            })
        );

        expect(fetcher.fetch.mock.calls.map((call) => call[0])).toEqual([
            'http://override:8765',
            'http://override:8765',
            'http://override:8765',
        ]);
    });

    it('stores media in updateLast mode and returns the note id when the word field is unavailable', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([8]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-audio.mp3'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-image.jpeg'));
        fetcher.fetch.mockResolvedValueOnce(
            ankiConnectResponse([
                makeNoteInfo({
                    noteId: 8,
                    fields: {
                        Sentence: { value: '<b>foo</b>', order: 0 },
                        Track1: { value: '<u>track one</u>', order: 1 },
                        Track2: { value: '<span>track two</span>', order: 2 },
                        Track3: { value: '<a>track three</a>', order: 3 },
                    },
                }),
            ])
        );
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(null));

        const anki = new Anki(testAnkiSettings, fetcher);
        const result = await anki.export(
            makeExportArguments({
                text: 'foo',
                track1: 'track one',
                track2: 'track two',
                track3: 'track three',
                audioClip: makeAudioClip(),
                image: makeImage(),
                tags: [],
                mode: 'updateLast',
            })
        );

        expect(result).toEqual(8);
        expect(fetcher.fetch.mock.calls).toEqual([
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'findNotes',
                    version: 6,
                    params: { query: 'added:1' },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'storeMediaFile',
                    version: 6,
                    params: {
                        filename: expect.stringMatching(/^asbp_clip_name__[A-Za-z0-9]{8}\.mp3$/),
                        data: 'audio-base64',
                        deleteExisting: false,
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'storeMediaFile',
                    version: 6,
                    params: {
                        filename: expect.stringMatching(/^asbp_image_name__[A-Za-z0-9]{8}\.jpeg$/),
                        data: 'image-base64',
                        deleteExisting: false,
                    },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'notesInfo',
                    version: 6,
                    params: { notes: [8] },
                },
            ],
            [
                testAnkiSettings.ankiConnectUrl,
                {
                    action: 'updateNoteFields',
                    version: 6,
                    params: {
                        note: {
                            deckName: testAnkiSettings.deck,
                            modelName: testAnkiSettings.noteType,
                            tags: [],
                            options: {
                                allowDuplicate: true,
                                duplicateScope: 'deck',
                                duplicateScopeOptions: {
                                    deckName: testAnkiSettings.deck,
                                    checkChildren: false,
                                },
                            },
                            id: 8,
                            fields: {
                                Sentence: '<b>foo</b>',
                                Track1: '<u>track one</u>',
                                Track2: '<span>track two</span>',
                                Track3: '<a>track three</a>',
                                Definition: 'definition line 1<br>definition line 2',
                                Word: 'term',
                                Source: 'Episode 1',
                                Url: 'https://example.com',
                                Audio: '[sound:stored-audio.mp3]',
                                Image: '<img src="stored-image.jpeg">',
                            },
                        },
                    },
                },
            ],
        ]);
    });

    it('returns the note id in updateLast mode when the stored word is empty', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([9]));
        fetcher.fetch.mockResolvedValueOnce(
            ankiConnectResponse([
                makeNoteInfo({
                    noteId: 9,
                    fields: {
                        Sentence: { value: 'sentence', order: 0 },
                        Word: { value: '', order: 1 },
                    },
                }),
            ])
        );
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(null));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments({ tags: [], mode: 'updateLast' }))).resolves.toEqual(9);
        expect(fetcher.fetch).toHaveBeenCalledTimes(3);
    });

    it('updates a specific note without querying recently added notes', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([makeNoteInfo({ noteId: 42 })]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(null));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(
            anki.export(makeExportArguments({ mode: 'updateSpecific', noteId: 42, tags: [] }))
        ).resolves.toEqual('word');
        expect(fetcher.fetch.mock.calls.map((call) => call[1].action)).toEqual(['notesInfo', 'updateNoteFields']);
        expect(fetcher.fetch.mock.calls[1][1].params.note.id).toBe(42);
    });

    it('requires a note id for updateSpecific exports', async () => {
        const fetcher = new MockFetcher();
        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments({ mode: 'updateSpecific' }))).rejects.toThrow(
            'noteId is required for updateSpecific mode'
        );
        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('keeps extensionless stored media names unchanged before upload', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse('stored-audio'));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse(10));

        const anki = new Anki(testAnkiSettings, fetcher);
        await anki.export(
            makeExportArguments({
                audioClip: makeAudioClip({ name: 'clip' }),
                image: undefined,
                mode: 'gui',
            })
        );

        expect(fetcher.fetch.mock.calls[0]).toEqual([
            testAnkiSettings.ankiConnectUrl,
            {
                action: 'storeMediaFile',
                version: 6,
                params: {
                    filename: 'asbp_clip',
                    data: 'audio-base64',
                    deleteExisting: false,
                },
            },
        ]);
    });

    it('throws if updateLast cannot find a recent note', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue(ankiConnectResponse([]));

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments({ mode: 'updateLast' }))).rejects.toThrow(
            'Could not find note to update'
        );
    });

    it('throws if updateLast cannot fetch info for the selected recent note', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([7]));
        fetcher.fetch.mockResolvedValueOnce(ankiConnectResponse([makeNoteInfo({ noteId: 8 })]));
        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments({ mode: 'updateLast' }))).rejects.toThrow(
            'Could not update card because the card info could not be fetched'
        );
    });

    it('throws DuplicateNoteError for duplicate AnkiConnect responses', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ result: null, error: 'cannot create note because it is a duplicate' });

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.export(makeExportArguments())).rejects.toBeInstanceOf(DuplicateNoteError);
    });

    it('throws a regular error for non-duplicate AnkiConnect failures', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ result: null, error: 'boom' });

        const anki = new Anki(testAnkiSettings, fetcher);

        await expect(anki.version()).rejects.toThrow('boom');
    });
});
