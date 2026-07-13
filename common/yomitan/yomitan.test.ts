import { Fetcher, Progress } from '@project/common';
import {
    DictionaryTrack,
    defaultSettings,
    TokenFrequencyAnnotation,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenStyling,
} from '@project/common/settings';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
    TermDictionaryEntry,
    TermEntriesResult,
    TermHeadword,
    TermSource,
    TokenPartResult,
    Yomitan,
    filterYomitanDictionaries,
    splitTextForTokenization,
} from '@project/common/yomitan';

const testDictionaryTrack = (overrides: Partial<DictionaryTrack> = {}): DictionaryTrack => ({
    ...defaultSettings.dictionaryTracks[0],
    dictionaryColorizeSubtitles: false,
    dictionaryAutoGenerateStatistics: false,
    dictionaryColorizeOnHoverOnly: false,
    dictionaryHighlightOnHover: false,
    dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
    dictionaryMatchAcrossScripts: true,
    dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
    dictionaryYomitanUrl: 'http://127.0.0.1:50500',
    dictionaryYomitanParser: 'scanning-parser',
    dictionaryYomitanScanLength: 25,
    dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
    dictionaryDisplayIgnoredTokenReadings: false,
    dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
    dictionaryAnkiDecks: [],
    dictionaryAnkiWordFields: [],
    dictionaryAnkiSentenceFields: [],
    dictionaryAnkiSentenceTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
    dictionaryAnkiMatureCutoff: 21,
    dictionaryAnkiTreatSuspended: 'NORMAL',
    dictionaryTokenStyling: TokenStyling.TEXT,
    dictionaryTokenStylingThickness: 1,
    dictionaryColorizeFullyKnownTokens: false,
    dictionaryTokenStatusColors: [],
    dictionaryTokenStatusConfig: [],
    ...overrides,
});

type TestTermFrequency = NonNullable<TermHeadword['frequencies']>[number];
type TestTokenizeResult = {
    id: string;
    source: string;
    dictionary: string;
    index: number;
    content: TokenPartResult[][];
};

class MockFetcher implements Fetcher {
    readonly fetch = jest.fn<Fetcher['fetch']>();
}

const makeSource = (overrides: Partial<TermSource> = {}): TermSource => ({
    originalText: 'alpha',
    transformedText: 'alpha',
    deinflectedText: 'alpha',
    matchType: 'exact',
    matchSource: 'term',
    isPrimary: true,
    ...overrides,
});

const makeFrequency = (overrides: Partial<TestTermFrequency> = {}): TestTermFrequency => ({
    index: 0,
    headwordIndex: 0,
    dictionary: 'freq',
    dictionaryIndex: 0,
    dictionaryAlias: 'freq',
    hasReading: true,
    frequencyMode: 'rank-based',
    frequency: 10,
    displayValue: '10',
    displayValueParsed: true,
    ...overrides,
});

const makeHeadword = (overrides: Partial<TermHeadword> = {}): TermHeadword => ({
    index: 0,
    headwordIndex: 0,
    term: 'alpha',
    reading: 'alpha',
    sources: [makeSource()],
    frequencies: [makeFrequency()],
    ...overrides,
});

const makeEntry = (overrides: Partial<TermDictionaryEntry> = {}): TermDictionaryEntry => ({
    headwords: [makeHeadword()],
    frequencies: [makeFrequency()],
    pronunciations: [],
    ...overrides,
});

const makePitchPronunciation = (positions: number | string, headwordIndex = 0) => ({
    index: 0,
    headwordIndex,
    dictionary: 'pitch',
    dictionaryIndex: 0,
    dictionaryAlias: 'pitch',
    pronunciations: [
        {
            type: 'pitch-accent',
            positions,
            nasalPositions: [],
            devoicePositions: [],
            tags: [],
        },
    ],
});

const makeTokenPart = (overrides: Partial<TokenPartResult> = {}): TokenPartResult => ({
    text: 'alpha',
    reading: 'alpha',
    ...overrides,
});

const makeTokenizeResult = (overrides: Partial<TestTokenizeResult> = {}): TestTokenizeResult => ({
    id: 'result-0',
    source: 'scanning-parser',
    dictionary: 'Test Dictionary',
    index: 0,
    content: [[makeTokenPart()]],
    ...overrides,
});

const makeMecabSupportResult = () =>
    makeTokenizeResult({
        source: 'mecab',
        dictionary: 'UniDic 202402',
        content: [
            [
                makeTokenPart({
                    text: '思い',
                    reading: 'おもい',
                    lemma: '思い出す',
                    lemmaReading: 'おもいだす',
                }),
                makeTokenPart({ text: '出せ', reading: 'だせ' }),
                makeTokenPart({ text: 'なく', reading: 'なく' }),
            ],
        ],
    });

const makeTermEntriesResult = (index: number, dictionaryEntries: TermDictionaryEntry[]): TermEntriesResult => ({
    dictionaryEntries,
    originalTextLength: 1,
    index,
});

const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const flushMicrotasks = async (turns = 6) => {
    for (let i = 0; i < turns; ++i) {
        await Promise.resolve();
    }
};

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('Yomitan', () => {
    it('rejects tokenizations whose reconstructed text differs from the source', () => {
        const yomitan = new Yomitan(testDictionaryTrack());

        expect(() => yomitan.verifyTokenizeResult('alpha', [[{ text: 'beta', reading: '' }]])).toThrow(
            'Tokenize result does not match the original text'
        );
    });

    it('rejects malformed term-entry responses instead of caching them', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ dictionaryEntries: null });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.lemmatize('alpha')).rejects.toThrow('Unexpected Yomitan termEntries response');
    });

    it('reports bulk frequency support after negotiating parser-specific capabilities', async () => {
        const scanningFetcher = new MockFetcher();
        scanningFetcher.fetch.mockResolvedValue({ version: '26.4.6' });
        const scanning = new Yomitan(testDictionaryTrack(), scanningFetcher);
        await scanning.version();

        const mecabFetcher = new MockFetcher();
        mecabFetcher.fetch
            .mockResolvedValueOnce({ version: '26.4.6' })
            .mockResolvedValueOnce([makeMecabSupportResult()]);
        const mecab = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), mecabFetcher);
        await mecab.version();

        expect(scanning.getSupportsBulkFrequency()).toBe(true);
        expect(mecab.getSupportsBulkFrequency()).toBe(true);
    });

    it('reports bulk frequency support as false before the bulk API version', async () => {
        const scanningFetcher = new MockFetcher();
        scanningFetcher.fetch.mockResolvedValue({ version: '26.4.5' });
        const scanning = new Yomitan(testDictionaryTrack(), scanningFetcher);
        await scanning.version();

        const mecabFetcher = new MockFetcher();
        mecabFetcher.fetch
            .mockResolvedValueOnce({ version: '26.4.5' })
            .mockResolvedValueOnce([makeMecabSupportResult()]);
        const mecab = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), mecabFetcher);
        await mecab.version();

        expect(scanning.getSupportsBulkFrequency()).toBe(false);
        expect(mecab.getSupportsBulkFrequency()).toBe(false);
    });

    it('reports bulk pitch accent support after negotiating parser-specific capabilities', async () => {
        const scanningFetcher = new MockFetcher();
        scanningFetcher.fetch.mockResolvedValue({ version: '26.7.1' });
        const scanning = new Yomitan(testDictionaryTrack(), scanningFetcher);
        await scanning.version();

        const mecabFetcher = new MockFetcher();
        mecabFetcher.fetch
            .mockResolvedValueOnce({ version: '26.7.1' })
            .mockResolvedValueOnce([makeMecabSupportResult()]);
        const mecab = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), mecabFetcher);
        await mecab.version();

        expect(scanning.getSupportsBulkPitchAccent()).toBe(true);
        expect(mecab.getSupportsBulkPitchAccent()).toBe(true);

        const olderFetcher = new MockFetcher();
        olderFetcher.fetch.mockResolvedValue({ version: '26.4.5' });
        const olderScanning = new Yomitan(testDictionaryTrack(), olderFetcher);
        await olderScanning.version();
        expect(olderScanning.getSupportsBulkPitchAccent()).toBe(false);
    });

    it('splits, trims, and filters text into tokenization inputs', () => {
        expect(splitTextForTokenization(' \n。\n')).toEqual([]);
        expect(splitTextForTokenization(' alpha ')).toEqual(['alpha']);
        expect(splitTextForTokenization(' alpha。\n beta \n!!')).toEqual(['alpha', 'beta']);
    });

    it('passes split tokenization inputs and options through the public bulk API', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
            makeTokenizeResult({
                content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
            }),
            makeTokenizeResult({
                id: 'result-1',
                index: 1,
                content: [[makeTokenPart({ text: 'beta', reading: 'beta' })]],
            }),
        ]);
        const progress: Progress[] = [];
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(
            yomitan.splitAndTokenizeBulk(
                ' alpha。\n beta \n!!',
                async (update) => {
                    progress.push(update);
                },
                'http://override:50500'
            )
        ).resolves.toEqual([
            [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
            [makeTokenPart({ text: 'beta', reading: 'beta' })],
        ]);
        expect(fetcher.fetch).toHaveBeenCalledWith('http://override:50500/tokenize', {
            text: ['alpha', 'beta'],
            scanLength: 25,
            parser: 'scanning-parser',
        });
        expect(progress.map(({ current, total }) => ({ current, total }))).toEqual([{ current: 2, total: 2 }]);
    });

    it('passes through non-mecab tokenize results unchanged in filterDictionaries', () => {
        const results = [makeTokenizeResult(), makeTokenizeResult({ id: 'result-1', index: 1 })];

        expect(filterYomitanDictionaries(results, 'scanning-parser')).toEqual(results);
    });

    it('prefers the newest UniDic dictionary per index in filterDictionaries', () => {
        const older = makeTokenizeResult({ id: 'older', source: 'mecab', dictionary: 'UniDic 202401', index: 0 });
        const newer = makeTokenizeResult({ id: 'newer', source: 'mecab', dictionary: 'UniDic 202402', index: 0 });
        const other = makeTokenizeResult({ id: 'other', source: 'mecab', dictionary: 'ipadic-neologd', index: 1 });

        const filtered = filterYomitanDictionaries([older, newer, other], 'mecab') as TestTokenizeResult[];

        expect(filtered[0]).toEqual(newer);
        expect(filtered[1]).toEqual(other);
    });

    it('throws when tokenize is called with mecab parser support disabled', async () => {
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));

        await expect(yomitan.tokenize('alpha')).rejects.toThrow('Yomitan is not configured to support MeCab');
    });

    it('returns both MeCab lemma forms after support negotiation and tokenization', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch
            .mockResolvedValueOnce({ version: '26.4.6' })
            .mockResolvedValueOnce([makeMecabSupportResult()])
            .mockResolvedValueOnce([
                makeTokenizeResult({
                    source: 'mecab',
                    dictionary: 'UniDic 202402',
                    content: [
                        [
                            makeTokenPart({
                                text: 'alpha',
                                lemma: 'base',
                                lemmaReading: 'reading',
                            }),
                        ],
                    ],
                }),
            ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await yomitan.version();
        await yomitan.tokenize('alpha');

        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['base', 'reading']);
        expect(fetcher.fetch).toHaveBeenCalledTimes(3);
    });

    it('caches tokenize results and primes lemma and frequency caches from tokenize headwords', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([
            makeTokenizeResult({
                content: [
                    [
                        makeTokenPart({
                            text: 'alpha',
                            reading: 'alpha',
                            headwords: [
                                [
                                    makeHeadword({
                                        term: 'alpha',
                                        reading: 'alpha',
                                        sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                                        frequencies: [makeFrequency({ frequency: 3 })],
                                    }),
                                ],
                            ],
                        }),
                    ],
                ],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        await yomitan.version();

        const first = await yomitan.tokenize('alpha');
        const second = await yomitan.tokenize('alpha');

        expect(second).toEqual(first);
        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['alpha']);
        await expect(yomitan.frequency('alpha')).resolves.toEqual(3);
        expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    it('handles empty tokenize content and empty token-part groups without crashing', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce([makeTokenizeResult({ content: [] })]);
        fetcher.fetch.mockResolvedValueOnce([makeTokenizeResult({ content: [[]] })]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.tokenize('empty')).resolves.toEqual([]);
        await expect(yomitan.tokenizeBulk(['empty-group'])).resolves.toEqual([]);
    });

    it('returns an empty array without fetching in tokenizeBulk for 0 items', async () => {
        const fetcher = new MockFetcher();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.tokenizeBulk([])).resolves.toEqual([]);
        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('throws when tokenizeBulk is called with mecab parser support disabled', async () => {
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));

        await expect(yomitan.tokenizeBulk(['alpha'])).rejects.toThrow('Yomitan is not configured to support MeCab');
    });

    it('reuses cached texts and preserves order in tokenizeBulk', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce([
            makeTokenizeResult({
                content: [[makeTokenPart({ text: 'cached', reading: 'cached' })]],
            }),
        ]);
        fetcher.fetch.mockResolvedValueOnce([
            makeTokenizeResult({
                content: [[makeTokenPart({ text: 'fresh', reading: 'fresh' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.tokenize('cached');
        const result = await yomitan.tokenizeBulk(['cached', 'fresh']);

        expect(result).toEqual([
            [makeTokenPart({ text: 'cached', reading: 'cached' })],
            [makeTokenPart({ text: 'fresh', reading: 'fresh' })],
        ]);
        expect(fetcher.fetch).toHaveBeenCalledTimes(2);
        expect(fetcher.fetch.mock.calls[1]).toEqual([
            'http://127.0.0.1:50500/tokenize',
            {
                text: ['fresh'],
                scanLength: 25,
                parser: 'scanning-parser',
            },
        ]);
    });

    it('does not fetch in tokenizeBulk when all texts are already cached', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce([
            makeTokenizeResult({
                content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
            }),
        ]);
        fetcher.fetch.mockResolvedValueOnce([
            makeTokenizeResult({
                content: [[makeTokenPart({ text: 'beta', reading: 'beta' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.tokenize('alpha');
        await yomitan.tokenize('beta');
        fetcher.fetch.mockClear();

        await expect(yomitan.tokenizeBulk(['alpha', 'beta'])).resolves.toEqual([
            [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
            [makeTokenPart({ text: 'beta', reading: 'beta' })],
        ]);
        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('prefetches unique term entries in tokenizeBulk for mecab bulk support', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch
            .mockResolvedValueOnce({ version: '26.4.6' })
            .mockResolvedValueOnce([makeMecabSupportResult()])
            .mockResolvedValueOnce([
                makeTokenizeResult({
                    source: 'mecab',
                    dictionary: 'UniDic 202402',
                    index: 0,
                    content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
                }),
                makeTokenizeResult({
                    id: 'result-1',
                    source: 'mecab',
                    dictionary: 'UniDic 202402',
                    index: 1,
                    content: [
                        [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
                        [makeTokenPart({ text: 'beta', reading: 'beta' })],
                    ],
                }),
            ])
            .mockResolvedValueOnce([makeTermEntriesResult(0, []), makeTermEntriesResult(1, [])]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        await yomitan.version();

        await expect(yomitan.tokenizeBulk(['alpha', 'beta'])).resolves.toEqual([
            [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
            [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
            [makeTokenPart({ text: 'beta', reading: 'beta' })],
        ]);

        expect(fetcher.fetch).toHaveBeenLastCalledWith('http://127.0.0.1:50500/termEntries', {
            term: ['alpha', 'beta'],
        });
    });

    it('does not prefetch term entries in tokenizeBulk when supportsTermEntriesBulk is false', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch
            .mockResolvedValueOnce({ version: '26.4.5' })
            .mockResolvedValueOnce([makeMecabSupportResult()])
            .mockResolvedValueOnce([
                makeTokenizeResult({
                    source: 'mecab',
                    dictionary: 'UniDic 202402',
                    content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
                }),
            ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        await yomitan.version();

        await expect(yomitan.tokenizeBulk(['alpha'])).resolves.toEqual([
            [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
        ]);

        expect(fetcher.fetch).toHaveBeenCalledTimes(3);
    });

    it('does not prefetch term entries in tokenizeBulk for scanning-parser even when supportsTermEntriesBulk is true', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([
            makeTokenizeResult({
                source: 'scanning-parser',
                dictionary: 'Test Dictionary',
                content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        await yomitan.version();

        await expect(yomitan.tokenizeBulk(['alpha'])).resolves.toEqual([
            [makeTokenPart({ text: 'alpha', reading: 'alpha' })],
        ]);

        expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    it('uses valid tokenize frequencies from reading sources after capability negotiation', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([
            makeTokenizeResult({
                content: [
                    [
                        makeTokenPart({
                            headwords: [
                                [
                                    makeHeadword({
                                        sources: [makeSource({ matchSource: 'reading' })],
                                        frequencies: [
                                            makeFrequency({ frequency: 0 }),
                                            makeFrequency({ frequency: Number.POSITIVE_INFINITY }),
                                            makeFrequency({ frequency: 7 }),
                                        ],
                                    }),
                                ],
                            ],
                        }),
                    ],
                ],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.version();
        await yomitan.tokenize('alpha');

        await expect(yomitan.frequency('alpha')).resolves.toBe(7);
        expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    it('lemmatize falls back to the token when configured and no dictionary entries match', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ dictionaryEntries: [] });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: true,
            tokensWereModified: () => undefined,
        });

        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['alpha']);
    });

    it('lemmatize caches an empty result when fallback is disabled and no dictionary entries match', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ dictionaryEntries: [] });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: () => undefined,
        });

        await expect(yomitan.lemmatize('alpha')).resolves.toEqual([]);
        await expect(yomitan.lemmatize('alpha')).resolves.toEqual([]);
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns empty lemmas and null frequency for non-letter tokens in lemmatize and frequency', async () => {
        const fetcher = new MockFetcher();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.lemmatize('!!')).resolves.toEqual([]);
        await expect(yomitan.frequency('!!')).resolves.toBeNull();
        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('fetches lemmas once and reuses the cache in lemmatize', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({
            dictionaryEntries: [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: '過ぎる',
                            reading: 'すぎる',
                            sources: [makeSource({ originalText: '過ぎます', deinflectedText: '過ぎる' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 4 })],
                }),
            ],
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.lemmatize('過ぎます')).resolves.toEqual(['過ぎる', 'すぎる']);
        await expect(yomitan.lemmatize('過ぎます')).resolves.toEqual(['過ぎる', 'すぎる']);
        await expect(yomitan.frequency('過ぎます')).resolves.toEqual(4);
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('promotes only a matching later kanji headword for kana-only input', async () => {
        const lemmatize = (token: string, headwords: TermHeadword[]) => {
            const fetcher = new MockFetcher();
            fetcher.fetch.mockResolvedValue({ dictionaryEntries: [makeEntry({ headwords })] });
            return new Yomitan(testDictionaryTrack(), fetcher).lemmatize(token);
        };
        const source = (originalText: string, deinflectedText: string) =>
            makeSource({ originalText, transformedText: originalText, deinflectedText });

        await expect(
            lemmatize('すぎます', [
                makeHeadword({ term: 'すぎる', reading: 'すぎる', sources: [source('すぎます', 'すぎる')] }),
                makeHeadword({ term: '過ぎる', reading: 'すぎる', sources: [source('すぎます', 'すぎる')] }),
            ])
        ).resolves.toEqual(['過ぎる', 'すぎる']);
        await expect(
            lemmatize('すぎます', [
                makeHeadword({ term: 'すぎる', reading: 'すぎる', sources: [source('すぎます', 'すぎる')] }),
                makeHeadword({ term: '誤る', reading: 'あやまる', sources: [source('すぎます', 'すぎる')] }),
            ])
        ).resolves.toEqual(['すぎる']);
        await expect(
            lemmatize('過ぎます', [
                makeHeadword({ term: '過ぎる', reading: 'すぎる', sources: [source('過ぎます', '過ぎる')] }),
                makeHeadword({ term: '越える', reading: 'すぎる', sources: [source('過ぎます', 'すぎる')] }),
            ])
        ).resolves.toEqual(['過ぎる', 'すぎる']);
    });

    it('returns undefined in lemmatize when resetCache cancels a pending request', async () => {
        jest.useFakeTimers().setSystemTime(1000);
        const fetcher = new MockFetcher();
        const blockerResponse = deferred<{ dictionaryEntries: TermDictionaryEntry[] }>();
        fetcher.fetch.mockImplementation(async (_url, body) => {
            if ((body as { term: string }).term === 'blocker') return blockerResponse.promise;
            throw new Error('Cancelled lemmatize should not fetch');
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        const blocker = yomitan.lemmatize('blocker');
        await flushMicrotasks();
        const lemmatizePromise = yomitan.lemmatize('alpha');
        jest.setSystemTime(1001);
        yomitan.resetCache();
        blockerResponse.resolve({ dictionaryEntries: [] });
        await blocker;
        await jest.advanceTimersByTimeAsync(10);

        await expect(lemmatizePromise).resolves.toBeUndefined();
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns the minimum rank frequency and primes lemmas in frequency', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({
            dictionaryEntries: [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'alpha',
                            reading: 'alpha',
                            sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 9 }), makeFrequency({ index: 1, frequency: 4 })],
                }),
            ],
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.frequency('alpha')).resolves.toEqual(4);
        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['alpha']);
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('caches pitch accents from tokenize headword pronunciations when supported', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '26.7.1' }).mockResolvedValueOnce([
            makeTokenizeResult({
                content: [
                    [
                        makeTokenPart({
                            text: 'alpha',
                            reading: 'alpha',
                            headwords: [
                                [
                                    makeHeadword({
                                        term: 'alpha',
                                        reading: 'alpha',
                                        sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                                        pronunciations: [
                                            makePitchPronunciation(2),
                                            makePitchPronunciation(2),
                                            makePitchPronunciation(0),
                                        ] as any,
                                    }),
                                ],
                            ],
                        }),
                    ],
                ],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        await yomitan.version();

        await yomitan.tokenize('alpha');

        await expect(yomitan.pitchAccent('alpha')).resolves.toBe(2);
        expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    });

    it('extracts pitch accents from term entries and prefers string positions on ties', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({
            dictionaryEntries: [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'alpha',
                            reading: 'alpha',
                            sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                        }),
                    ],
                    pronunciations: [makePitchPronunciation(1), makePitchPronunciation('LH')] as any,
                }),
            ],
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.pitchAccent('alpha')).resolves.toBe('LH');
        await expect(yomitan.frequency('alpha')).resolves.toBe(10);
        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['alpha']);
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns undefined immediately and updates the cache asynchronously in frequency when a callback is configured', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({
            dictionaryEntries: [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'beta',
                            reading: 'beta',
                            sources: [makeSource({ originalText: 'beta', deinflectedText: 'beta' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 6 })],
                }),
            ],
        });
        const modified: string[] = [];
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: (token) => modified.push(token),
        });

        await expect(yomitan.frequency('beta')).resolves.toBeUndefined();
        await flushMicrotasks(20);

        expect(modified).toEqual(['beta']);
        await expect(yomitan.frequency('beta')).resolves.toBe(6);
        await expect(yomitan.lemmatize('beta')).resolves.toEqual(['beta']);
    });

    it('notifies without fetching when resetCache cancels async frequency updates', async () => {
        jest.useFakeTimers().setSystemTime(1000);
        const fetcher = new MockFetcher();
        const blockerResponse = deferred<{ dictionaryEntries: TermDictionaryEntry[] }>();
        fetcher.fetch.mockImplementation(async (_url, body) => {
            if ((body as { term: string }).term === 'blocker') return blockerResponse.promise;
            throw new Error('Cancelled frequency should not fetch');
        });
        const modified: string[] = [];
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: (token) => modified.push(token),
        });

        const blocker = yomitan.lemmatize('blocker');
        await flushMicrotasks();
        await expect(yomitan.frequency('gamma')).resolves.toBeUndefined();
        jest.setSystemTime(1001);
        yomitan.resetCache();
        blockerResponse.resolve({ dictionaryEntries: [] });
        await blocker;
        await jest.advanceTimersByTimeAsync(10);
        await flushMicrotasks();

        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
        expect(modified).toContain('gamma');
    });

    it('does not fetch or notify when async frequency work finds a populated cache after waiting', async () => {
        jest.useFakeTimers().setSystemTime(1000);
        const fetcher = new MockFetcher();
        const blockerResponse = deferred<{ dictionaryEntries: TermDictionaryEntry[] }>();
        fetcher.fetch.mockImplementation(async (url, body) => {
            if (url.endsWith('/yomitanVersion')) return { version: '26.4.6' };
            if (url.endsWith('/termEntries') && (body as { term: string }).term === 'blocker') {
                return blockerResponse.promise;
            }
            if (url.endsWith('/tokenize')) {
                return [
                    makeTokenizeResult({
                        content: [
                            [
                                makeTokenPart({
                                    text: 'delta',
                                    headwords: [
                                        [
                                            makeHeadword({
                                                term: 'delta',
                                                reading: 'delta',
                                                sources: [
                                                    makeSource({ originalText: 'delta', deinflectedText: 'delta' }),
                                                ],
                                                frequencies: [makeFrequency({ frequency: 12 })],
                                            }),
                                        ],
                                    ],
                                }),
                            ],
                        ],
                    }),
                ];
            }
            throw new Error('Cached frequency should not fetch term entries');
        });
        const modified: string[] = [];
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: (token) => modified.push(token),
        });

        await yomitan.version();
        const blocker = yomitan.lemmatize('blocker');
        await flushMicrotasks();
        await expect(yomitan.frequency('delta')).resolves.toBeUndefined();
        await yomitan.tokenize('delta');
        blockerResponse.resolve({ dictionaryEntries: [] });
        await blocker;
        await jest.advanceTimersByTimeAsync(10);
        await flushMicrotasks();

        await expect(yomitan.frequency('delta')).resolves.toBe(12);
        expect(fetcher.fetch).toHaveBeenCalledTimes(3);
        expect(modified).toEqual([]);
    });

    it('frequency falls back to reading sources and ignores occurrence-based values', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({
            dictionaryEntries: [
                makeEntry({
                    headwords: [makeHeadword({ sources: [makeSource({ matchSource: 'reading' })] })],
                    frequencies: [
                        makeFrequency({ frequencyMode: 'occurrence-based', frequency: 1 }),
                        makeFrequency({ index: 1, frequency: 8 }),
                    ],
                }),
            ],
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.frequency('alpha')).resolves.toBe(8);
    });

    it('frequency ignores non-rank frequencies before capability negotiation', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({
            dictionaryEntries: [
                makeEntry({
                    frequencies: [
                        makeFrequency({ frequencyMode: 'occurrence-based', frequency: 2 }),
                        makeFrequency({ index: 1, frequency: 8 }),
                    ],
                }),
            ],
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.frequency('alpha')).resolves.toBe(8);
    });

    it('infers rank-based frequency dictionaries from token occurrence ordering', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const modified: string[] = [];
        const fetcher = new MockFetcher();
        fetcher.fetch.mockImplementation(async (_url, body) => {
            const terms = (body as { term: string[] }).term;
            return terms.map((token, index) => {
                const tokenIndex = Number(token.substring('word'.length));
                const frequency = tokenIndex < 10 ? tokenIndex + 1 : 1000 + tokenIndex;
                return makeTermEntriesResult(index, [
                    makeEntry({
                        headwords: [
                            makeHeadword({
                                term: token,
                                reading: token,
                                sources: [makeSource({ originalText: token, deinflectedText: token })],
                            }),
                        ],
                        frequencies: [
                            makeFrequency({
                                dictionary: 'inferred-rank',
                                dictionaryAlias: 'inferred-rank',
                                frequencyMode: null,
                                frequency,
                            }),
                        ],
                    }),
                ]);
            });
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: (token) => modified.push(token),
        });
        const tokenOccurrences = new Map<string, number>();
        const tokens = Array.from({ length: 20 }, (_, index) => `word${index}`);

        for (const [index, token] of tokens.entries()) {
            tokenOccurrences.set(token, index < 10 ? 100 - index : 20 - index);
        }

        await yomitan.termEntriesBulk(tokens, false);
        await expect(yomitan.frequency('word0')).resolves.toBeNull();

        yomitan.inferFrequencyModesFromTokenOccurrences(new Map([[0, tokenOccurrences]]));

        await expect(yomitan.frequency('word0')).resolves.toBe(1);
        await expect(yomitan.frequency('word19')).resolves.toBe(1019);
        expect(modified).toHaveLength(20);
        expect(modified).toEqual(expect.arrayContaining(['word0', 'word19']));
    });

    it('returns early without fetching in termEntriesBulk for 0 items', async () => {
        const fetcher = new MockFetcher();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.termEntriesBulk([], false);

        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('caches letter and non-letter results in termEntriesBulk', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
            makeTermEntriesResult(0, [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'alpha',
                            reading: 'alpha',
                            sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 2 })],
                }),
            ]),
            makeTermEntriesResult(1, [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'beta',
                            reading: 'beta',
                            sources: [makeSource({ originalText: 'beta', deinflectedText: 'beta' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 5 })],
                }),
            ]),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.termEntriesBulk(['alpha', '!', 'beta'], false);

        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['alpha']);
        await expect(yomitan.frequency('alpha')).resolves.toEqual(2);
        await expect(yomitan.lemmatize('beta')).resolves.toEqual(['beta']);
        await expect(yomitan.frequency('beta')).resolves.toEqual(5);
        await expect(yomitan.frequency('!')).resolves.toBeNull();
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetches only uncached letter tokens in termEntriesBulk', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce([
            makeTermEntriesResult(0, [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'alpha',
                            reading: 'alpha',
                            sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 2 })],
                }),
            ]),
        ]);
        fetcher.fetch.mockResolvedValueOnce([
            makeTermEntriesResult(0, [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'beta',
                            reading: 'beta',
                            sources: [makeSource({ originalText: 'beta', deinflectedText: 'beta' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 5 })],
                }),
            ]),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.termEntriesBulk(['alpha'], false);
        fetcher.fetch.mockClear();

        await yomitan.termEntriesBulk(['alpha', '!', 'beta'], false);

        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
        expect(fetcher.fetch).toHaveBeenCalledWith('http://127.0.0.1:50500/termEntries', { term: ['beta'] });
        await expect(yomitan.frequency('beta')).resolves.toEqual(5);
    });

    it('does not fetch in termEntriesBulk when all tokens are already cached', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
            makeTermEntriesResult(0, [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'alpha',
                            reading: 'alpha',
                            sources: [makeSource({ originalText: 'alpha', deinflectedText: 'alpha' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 2 })],
                }),
            ]),
            makeTermEntriesResult(1, [
                makeEntry({
                    headwords: [
                        makeHeadword({
                            term: 'beta',
                            reading: 'beta',
                            sources: [makeSource({ originalText: 'beta', deinflectedText: 'beta' })],
                        }),
                    ],
                    frequencies: [makeFrequency({ frequency: 5 })],
                }),
            ]),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await yomitan.termEntriesBulk(['alpha', 'beta'], false);
        fetcher.fetch.mockClear();

        await yomitan.termEntriesBulk(['alpha', '!', 'beta'], false);

        expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('retries tokenizeBulk with smaller batches after native messaging size failures', async () => {
        const fetcher = new MockFetcher();
        let failures = 1;
        fetcher.fetch.mockImplementation(async (_url, body) => {
            if (failures > 0) {
                --failures;
                return 'Message exceeded maximum allowed size of 64MiB.';
            }

            const texts = (body as { text: string[] }).text;
            return texts.map((text, index) =>
                makeTokenizeResult({
                    id: `result-${index}`,
                    index,
                    content: [[makeTokenPart({ text, reading: text })]],
                })
            );
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const texts = Array.from({ length: 101 }, (_, index) => `text${index}`);

        const result = await yomitan.tokenizeBulk(texts);

        expect(result).toHaveLength(101);
        expect(fetcher.fetch.mock.calls.map((call) => (call[1] as { text: string[] }).text.length)).toEqual([
            100, 50, 50, 1,
        ]);
    });

    it('permanently reduces the termEntriesBulk batch size after repeated native messaging size failures', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const fetcher = new MockFetcher();
        let failures = 3;
        fetcher.fetch.mockImplementation(async (_url, body) => {
            if (failures > 0) {
                --failures;
                return 'Message exceeded maximum allowed size of 64MiB.';
            }

            const terms = (body as { term: string[] }).term;
            return terms.map((term, index) =>
                makeTermEntriesResult(index, [
                    makeEntry({
                        headwords: [
                            makeHeadword({
                                term,
                                reading: term,
                                sources: [makeSource({ originalText: term, deinflectedText: term })],
                            }),
                        ],
                    }),
                ])
            );
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const terms = Array.from({ length: 11 }, (_, index) => `term${index}`);

        await yomitan.termEntriesBulk(terms, false);

        expect(fetcher.fetch.mock.calls.map((call) => (call[1] as { term: string[] }).term.length)).toEqual([
            10, 5, 3, 2, 2, 2, 2, 2, 1,
        ]);

        fetcher.fetch.mockClear();
        await yomitan.termEntriesBulk(
            Array.from({ length: 12 }, (_, index) => `fresh${index}`),
            false
        );
        expect(fetcher.fetch.mock.calls.map((call) => (call[1] as { term: string[] }).term.length)).toEqual([5, 5, 2]);
    });

    it('uses the per-call Yomitan URL override for API-backed public methods', async () => {
        const fetcher = new MockFetcher();
        const overrideUrl = 'http://override:50500';
        fetcher.fetch.mockImplementation(async (url, body) => {
            if (url.endsWith('/tokenize')) {
                return [makeTokenizeResult({ content: [] })];
            }
            if (url.endsWith('/termEntries')) {
                const term = (body as { term: string | string[] }).term;
                if (Array.isArray(term)) {
                    return term.map((_, index) => makeTermEntriesResult(index, [makeEntry()]));
                }
                return { dictionaryEntries: [makeEntry()] };
            }
            if (url.endsWith('/yomitanVersion')) {
                return { version: '26.4.6' };
            }
            throw new Error(`Unexpected URL ${url}`);
        });

        await new Yomitan(testDictionaryTrack(), fetcher).tokenize('alpha', overrideUrl);
        await new Yomitan(testDictionaryTrack(), fetcher).lemmatize('alpha', overrideUrl);
        await new Yomitan(testDictionaryTrack(), fetcher).frequency('alpha', overrideUrl);
        await new Yomitan(testDictionaryTrack(), fetcher).termEntriesBulk(['alpha'], false, overrideUrl);
        await new Yomitan(testDictionaryTrack(), fetcher).version(overrideUrl);

        expect(fetcher.fetch.mock.calls.map((call) => call[0])).toEqual([
            `${overrideUrl}/tokenize`,
            `${overrideUrl}/termEntries`,
            `${overrideUrl}/termEntries`,
            `${overrideUrl}/termEntries`,
            `${overrideUrl}/yomitanVersion`,
        ]);
    });

    it('batches termEntriesBulk requests in groups of 10', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockImplementation(async (_url, body) => {
            const terms = (body as { term: string[] }).term;
            return terms.map((term, index) =>
                makeTermEntriesResult(index, [
                    makeEntry({
                        headwords: [
                            makeHeadword({
                                term,
                                reading: term,
                                sources: [makeSource({ originalText: term, deinflectedText: term })],
                            }),
                        ],
                        frequencies: [makeFrequency({ frequency: index + 1 })],
                    }),
                ])
            );
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const terms = Array.from({ length: 11 }, (_, index) => `term${index}`);

        await yomitan.termEntriesBulk(terms, false);

        expect(fetcher.fetch).toHaveBeenCalledTimes(2);
        expect((fetcher.fetch.mock.calls[0][1] as { term: string[] }).term).toHaveLength(10);
        expect((fetcher.fetch.mock.calls[1][1] as { term: string[] }).term).toHaveLength(1);
    });

    it('stops termEntriesBulk before fetching when resetCache cancels a pending acquire', async () => {
        jest.useFakeTimers().setSystemTime(1000);
        const fetcher = new MockFetcher();
        const blockerResponse = deferred<{ dictionaryEntries: TermDictionaryEntry[] }>();
        fetcher.fetch.mockImplementation(async (_url, body) => {
            if ((body as { term: string }).term === 'blocker') return blockerResponse.promise;
            throw new Error('Cancelled bulk request should not fetch');
        });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        const blocker = yomitan.lemmatize('blocker');
        await flushMicrotasks();
        const promise = yomitan.termEntriesBulk(['alpha'], false);
        jest.setSystemTime(1001);
        yomitan.resetCache();
        blockerResponse.resolve({ dictionaryEntries: [] });
        await blocker;
        await jest.advanceTimersByTimeAsync(10);
        await promise;

        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('accepts dev version 0.0.0.0 and enables bulk features for non-mecab parsers', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: '0.0.0.0' });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.version()).resolves.toEqual('0.0.0.0');

        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
        expect(yomitan.getSupportsBulkFrequency()).toBe(true);
    });

    it('verifies mecab support for dev version 0.0.0.0 when the parser is mecab', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '0.0.0.0' }).mockResolvedValueOnce([makeMecabSupportResult()]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await expect(yomitan.version()).resolves.toEqual('0.0.0.0');

        expect(yomitan.getSupportsMecab()).toBe(true);
        expect(yomitan.getSupportsMecabLemma()).toBe(true);
        expect(yomitan.getSupportsBulkFrequency()).toBe(true);
    });

    it('rejects versions older than the minimum supported Yomitan release', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: '25.12.15.9' });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.version()).rejects.toThrow('Minimum Yomitan version is 25.12.16.0, found 25.12.15.9');
    });

    it('rejects malformed Yomitan versions that semver cannot coerce', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: 'not-a-version' });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.version()).rejects.toThrow('Minimum Yomitan version is 25.12.16.0, found not-a-version');
    });

    it('verifies mecab support at the configured threshold and toggles bulk support by version', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([makeMecabSupportResult()]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await expect(yomitan.version()).resolves.toEqual('26.4.6');

        expect(yomitan.getSupportsMecab()).toBe(true);
        expect(yomitan.getSupportsMecabLemma()).toBe(true);
        expect(yomitan.getSupportsBulkFrequency()).toBe(true);
    });

    it('does not verify mecab support for non-mecab parsers and keeps bulk support disabled before 26.4.6', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: '26.4.5' });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.version()).resolves.toEqual('26.4.5');

        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
        expect(yomitan.getSupportsBulkFrequency()).toBe(false);
    });

    it('does not verify mecab support before version 26.3.9 even when the parser is mecab', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: '26.3.8' });
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await expect(yomitan.version()).resolves.toEqual('26.3.8');

        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
        expect(yomitan.getSupportsBulkFrequency()).toBe(false);
    });

    it('sets full mecab and lemma support when verifyMecabSupport receives the expected tokenization', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([makeMecabSupportResult()]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await yomitan.version();

        expect(yomitan.getSupportsMecab()).toBe(true);
        expect(yomitan.getSupportsMecabLemma()).toBe(true);
    });

    it('keeps mecab support but disables lemma support when verifyMecabSupport sees unexpected lemmas', async () => {
        const fetcher = new MockFetcher();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([
            makeTokenizeResult({
                source: 'mecab',
                dictionary: 'UniDic 202402',
                content: [
                    [
                        makeTokenPart({ text: '思い', reading: 'おもい', lemma: 'wrong', lemmaReading: 'wrong' }),
                        makeTokenPart({ text: '出せ', reading: 'だせ' }),
                        makeTokenPart({ text: 'なく', reading: 'なく' }),
                    ],
                ],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await yomitan.version();

        expect(yomitan.getSupportsMecab()).toBe(true);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
    });

    it('disables mecab support when verifyMecabSupport receives an unexpected tokenization shape', async () => {
        const fetcher = new MockFetcher();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        fetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([
            makeTokenizeResult({
                source: 'mecab',
                dictionary: 'UniDic 202402',
                content: [[makeTokenPart({ text: '思い出せない', reading: 'おもいだせない' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await yomitan.version();

        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
    });

    it('disables mecab support when verifyMecabSupport receives an unexpected source or fetch failure', async () => {
        const unexpectedSourceFetcher = new MockFetcher();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        unexpectedSourceFetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockResolvedValueOnce([
            makeTokenizeResult({
                source: 'scanning-parser',
                content: [[makeTokenPart({ text: '思い出せなく', reading: 'おもいだせなく' })]],
            }),
        ]);
        const unexpectedSource = new Yomitan(
            testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }),
            unexpectedSourceFetcher
        );

        await unexpectedSource.version();
        expect(unexpectedSource.getSupportsMecab()).toBe(false);
        expect(unexpectedSource.getSupportsMecabLemma()).toBe(false);

        const failureFetcher = new MockFetcher();
        failureFetcher.fetch.mockResolvedValueOnce({ version: '26.4.6' }).mockRejectedValueOnce(new Error('boom'));
        const failure = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), failureFetcher);
        await failure.version();
        expect(failure.getSupportsMecab()).toBe(false);
        expect(failure.getSupportsMecabLemma()).toBe(false);
    });

    it('throws from tokenize when the Yomitan API returns an empty payload', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue('{}');
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect(yomitan.tokenize('alpha')).rejects.toThrow('Yomitan API error for tokenize: {}');
        expect(fetcher.fetch).toHaveBeenCalledWith('http://127.0.0.1:50500/tokenize', {
            text: 'alpha',
            scanLength: 25,
            parser: 'scanning-parser',
        });
    });
});
