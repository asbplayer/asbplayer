import { Fetcher } from '@project/common';
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

    it('reports bulk frequency support based on parser-specific feature flags', () => {
        const scanning = new Yomitan(testDictionaryTrack());
        (scanning as any).supportsTokenizeFrequency = true;
        (scanning as any).supportsTermEntriesBulk = false;

        const mecab = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));
        (mecab as any).supportsTokenizeFrequency = false;
        (mecab as any).supportsTermEntriesBulk = true;

        expect(scanning.getSupportsBulkFrequency()).toBe(true);
        expect(mecab.getSupportsBulkFrequency()).toBe(true);
    });

    it('reports bulk frequency support as false when the parser-specific feature flag is disabled', () => {
        const scanning = new Yomitan(testDictionaryTrack());
        (scanning as any).supportsTokenizeFrequency = false;
        (scanning as any).supportsTermEntriesBulk = true;

        const mecab = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));
        (mecab as any).supportsTokenizeFrequency = true;
        (mecab as any).supportsTermEntriesBulk = false;

        expect(scanning.getSupportsBulkFrequency()).toBe(false);
        expect(mecab.getSupportsBulkFrequency()).toBe(false);
    });

    it('reports bulk pitch accent support based on parser-specific feature flags', () => {
        const scanning = new Yomitan(testDictionaryTrack());
        (scanning as any).supportsTokenizePronunciations = true;
        (scanning as any).supportsTermEntriesBulk = false;

        const mecab = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));
        (mecab as any).supportsTokenizePronunciations = false;
        (mecab as any).supportsTermEntriesBulk = true;

        expect(scanning.getSupportsBulkPitchAccent()).toBe(true);
        expect(mecab.getSupportsBulkPitchAccent()).toBe(true);

        (scanning as any).supportsTokenizePronunciations = false;
        (mecab as any).supportsTermEntriesBulk = false;

        expect(scanning.getSupportsBulkPitchAccent()).toBe(false);
        expect(mecab.getSupportsBulkPitchAccent()).toBe(false);
    });

    it('splits, trims, and filters text before delegating splitAndTokenizeBulk', async () => {
        const yomitan = new Yomitan(testDictionaryTrack());
        const tokenizeBulkSpy = jest.spyOn(yomitan, 'tokenizeBulk').mockResolvedValue([]);

        await yomitan.splitAndTokenizeBulk(' \n。\n');
        await yomitan.splitAndTokenizeBulk(' alpha ');
        await yomitan.splitAndTokenizeBulk(' alpha。\n beta \n!!');

        expect(tokenizeBulkSpy.mock.calls).toEqual([
            [[], undefined, undefined],
            [['alpha'], undefined, undefined],
            [['alpha', 'beta'], undefined, undefined],
        ]);
    });

    it('passes through non-mecab tokenize results unchanged in filterDictionaries', () => {
        const yomitan = new Yomitan(testDictionaryTrack());
        const results = [makeTokenizeResult(), makeTokenizeResult({ id: 'result-1', index: 1 })];

        expect((yomitan as any).filterDictionaries(results, 'scanning-parser')).toEqual(results);
    });

    it('prefers the newest UniDic dictionary per index in filterDictionaries', () => {
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));
        const older = makeTokenizeResult({ id: 'older', source: 'mecab', dictionary: 'UniDic 202401', index: 0 });
        const newer = makeTokenizeResult({ id: 'newer', source: 'mecab', dictionary: 'UniDic 202402', index: 0 });
        const other = makeTokenizeResult({ id: 'other', source: 'mecab', dictionary: 'ipadic-neologd', index: 1 });

        const filtered = (yomitan as any).filterDictionaries([older, newer, other], 'mecab') as TestTokenizeResult[];

        expect(filtered[0]).toEqual(newer);
        expect(filtered[1]).toEqual(other);
    });

    it('throws when tokenize is called with mecab parser support disabled', async () => {
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));

        await expect(yomitan.tokenize('alpha')).rejects.toThrow('Yomitan is not configured to support MeCab');
    });

    it('caches tokenize results and primes lemma and frequency caches from tokenize headwords', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
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
        (yomitan as any).supportsTokenizeFrequency = true;

        const first = await yomitan.tokenize('alpha');
        const second = await yomitan.tokenize('alpha');

        expect(first).toBe(second);
        await expect(yomitan.lemmatize('alpha')).resolves.toEqual(['alpha']);
        await expect(yomitan.frequency('alpha')).resolves.toEqual(3);
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
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
        fetcher.fetch.mockResolvedValue([
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
        ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        const termEntriesBulkSpy = jest.spyOn(yomitan, 'termEntriesBulk').mockResolvedValue(undefined);
        (yomitan as any).supportsMecab = true;
        (yomitan as any).supportsTermEntriesBulk = true;

        await yomitan.tokenizeBulk(['alpha', 'beta']);

        expect(termEntriesBulkSpy).toHaveBeenCalledWith(expect.arrayContaining(['alpha', 'beta']), false, undefined);
        expect(termEntriesBulkSpy.mock.calls[0][0]).toHaveLength(2);
    });

    it('does not prefetch term entries in tokenizeBulk when supportsTermEntriesBulk is false', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
            makeTokenizeResult({
                source: 'mecab',
                dictionary: 'UniDic 202402',
                content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        const termEntriesBulkSpy = jest.spyOn(yomitan, 'termEntriesBulk').mockResolvedValue(undefined);
        (yomitan as any).supportsMecab = true;
        (yomitan as any).supportsTermEntriesBulk = false;

        await yomitan.tokenizeBulk(['alpha']);

        expect(termEntriesBulkSpy).not.toHaveBeenCalled();
    });

    it('does not prefetch term entries in tokenizeBulk for scanning-parser even when supportsTermEntriesBulk is true', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
            makeTokenizeResult({
                source: 'scanning-parser',
                dictionary: 'Test Dictionary',
                content: [[makeTokenPart({ text: 'alpha', reading: 'alpha' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const termEntriesBulkSpy = jest.spyOn(yomitan, 'termEntriesBulk').mockResolvedValue(undefined);
        (yomitan as any).supportsTermEntriesBulk = true;

        await yomitan.tokenizeBulk(['alpha']);

        expect(termEntriesBulkSpy).not.toHaveBeenCalled();
    });

    it('extractFrequencyFromTokenize falls back from term to reading sources and ignores invalid frequencies', () => {
        const yomitan = new Yomitan(testDictionaryTrack());
        (yomitan as any).supportsTokenizeFrequency = true;

        (yomitan as any).extractFrequencyFromTokenize('alpha', [
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
        ]);

        expect((yomitan as any).frequencyCache.get('alpha')).toEqual(7);
    });

    it('does not cache tokenize frequencies when supportsTokenizeFrequency is false', () => {
        const yomitan = new Yomitan(testDictionaryTrack());

        (yomitan as any).extractFrequencyFromTokenize('alpha', [
            [
                makeHeadword({
                    frequencies: [makeFrequency({ frequency: 3 })],
                }),
            ],
        ]);

        expect((yomitan as any).frequencyCache.has('alpha')).toBe(false);
    });

    it('does not cache mecab lemmas when supportsMecabLemma is false', () => {
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));

        (yomitan as any).extractLemmaFromMecab('alpha', makeTokenPart({ lemma: 'base', lemmaReading: 'reading' }));

        expect((yomitan as any).lemmatizeCache.has('alpha')).toBe(false);
    });

    it('caches both lemma and distinct lemmaReading from mecab token parts when supported', () => {
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }));
        (yomitan as any).supportsMecabLemma = true;

        (yomitan as any).extractLemmaFromMecab('alpha', makeTokenPart({ lemma: 'base', lemmaReading: 'reading' }));

        expect((yomitan as any).lemmatizeCache.get('alpha')).toEqual(['base', 'reading']);
    });

    it('extractLemmas prefers a later kanji form over an earlier kana-only headword for kana input', () => {
        const yomitan = new Yomitan(testDictionaryTrack());
        const lemmas = (yomitan as any).extractLemmas('すぎます', [
            [
                makeHeadword({
                    term: 'すぎる',
                    reading: 'すぎる',
                    sources: [
                        makeSource({
                            originalText: 'すぎます',
                            transformedText: 'すぎます',
                            deinflectedText: 'すぎる',
                        }),
                    ],
                }),
                makeHeadword({
                    term: '過ぎる',
                    reading: 'すぎる',
                    sources: [
                        makeSource({
                            originalText: 'すぎます',
                            transformedText: 'すぎます',
                            deinflectedText: 'すぎる',
                        }),
                    ],
                }),
            ],
        ]) as string[];

        expect(lemmas).toEqual(['過ぎる', 'すぎる']);
    });

    it('extractLemmas falls back to the token when lemmaTokenFallback is enabled', () => {
        const yomitan = new Yomitan(testDictionaryTrack(), new MockFetcher(), {
            lemmaTokenFallback: true,
            tokensWereModified: jest.fn(),
        });

        expect((yomitan as any).extractLemmas('alpha', [])).toEqual(['alpha']);
    });

    it('extractLemmas caches an empty result when fallback is disabled and no entries match', () => {
        const yomitan = new Yomitan(testDictionaryTrack(), new MockFetcher(), {
            lemmaTokenFallback: false,
            tokensWereModified: jest.fn(),
        });

        expect((yomitan as any).extractLemmas('alpha', [])).toEqual([]);
        expect((yomitan as any).lemmatizeCache.get('alpha')).toEqual([]);
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

    it('returns undefined in lemmatize when resetCache cancels a pending request', async () => {
        const fetcher = new MockFetcher();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const acquireDeferred = deferred<number>();
        jest.spyOn((yomitan as any).asyncSemaphore, 'acquire').mockReturnValue(acquireDeferred.promise);

        const lemmatizePromise = yomitan.lemmatize('alpha');
        yomitan.resetCache();
        (yomitan as any).lastCancelledAt = Number.MAX_SAFE_INTEGER;
        acquireDeferred.resolve(1);

        await expect(lemmatizePromise).resolves.toBeUndefined();
        expect(fetcher.fetch).not.toHaveBeenCalled();
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
        fetcher.fetch.mockResolvedValue([
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
        (yomitan as any).supportsTokenizePronunciations = true;

        await yomitan.tokenize('alpha');

        await expect(yomitan.pitchAccent('alpha')).resolves.toBe(2);
        expect(fetcher.fetch).toHaveBeenCalledTimes(1);
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
        const modified = jest.fn();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: modified,
        });

        await expect(yomitan.frequency('beta')).resolves.toBeUndefined();
        await flushMicrotasks(20);

        expect(modified).toHaveBeenCalledWith('beta');
        expect((yomitan as any).frequencyCache.get('beta')).toEqual(6);
        expect((yomitan as any).lemmatizeCache.get('beta')).toEqual(['beta']);
    });

    it('notifies without fetching when resetCache cancels async frequency updates', async () => {
        const fetcher = new MockFetcher();
        const modified = jest.fn();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: modified,
        });
        const acquireDeferred = deferred<number>();
        jest.spyOn((yomitan as any).asyncSemaphore, 'acquire').mockReturnValue(acquireDeferred.promise);

        await expect(yomitan.frequency('gamma')).resolves.toBeUndefined();
        yomitan.resetCache();
        (yomitan as any).lastCancelledAt = Number.MAX_SAFE_INTEGER;
        acquireDeferred.resolve(1);
        await flushMicrotasks();

        expect(fetcher.fetch).not.toHaveBeenCalled();
        expect(modified).toHaveBeenCalledWith('gamma');
    });

    it('does not fetch or notify when async frequency work finds a populated cache after waiting', async () => {
        const fetcher = new MockFetcher();
        const modified = jest.fn();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher, {
            lemmaTokenFallback: false,
            tokensWereModified: modified,
        });
        const acquireDeferred = deferred<number>();
        jest.spyOn((yomitan as any).asyncSemaphore, 'acquire').mockReturnValue(acquireDeferred.promise);

        await expect(yomitan.frequency('delta')).resolves.toBeUndefined();
        (yomitan as any).frequencyCache.set('delta', 12);
        acquireDeferred.resolve(1);
        await flushMicrotasks();

        expect(fetcher.fetch).not.toHaveBeenCalled();
        expect(modified).not.toHaveBeenCalled();
    });

    it('extractFrequency falls back from term sources and ignores non-rank frequencies when tokenize frequencies are supported', () => {
        const yomitan = new Yomitan(testDictionaryTrack());
        (yomitan as any).supportsTokenizeFrequency = true;
        const frequency = (yomitan as any).extractFrequency('alpha', [
            makeEntry({
                headwords: [
                    makeHeadword({
                        sources: [makeSource({ matchSource: 'reading' })],
                    }),
                ],
                frequencies: [
                    makeFrequency({ frequencyMode: 'occurrence-based', frequency: 1 }),
                    makeFrequency({ index: 1, frequency: 8 }),
                ],
            }),
        ]) as number | null;

        expect(frequency).toEqual(8);
    });

    it('ignores non-rank frequencies in extractFrequency when tokenize frequencies are not supported', () => {
        const yomitan = new Yomitan(testDictionaryTrack());
        const frequency = (yomitan as any).extractFrequency('alpha', [
            makeEntry({
                frequencies: [
                    makeFrequency({ frequencyMode: 'occurrence-based', frequency: 2 }),
                    makeFrequency({ index: 1, frequency: 8 }),
                ],
            }),
        ]) as number | null;

        expect(frequency).toEqual(8);
    });

    it('infers rank-based frequency dictionaries from token occurrence ordering', () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const modified = jest.fn();
        const yomitan = new Yomitan(testDictionaryTrack(), new MockFetcher(), {
            lemmaTokenFallback: false,
            tokensWereModified: modified,
        });
        const tokenOccurrences = new Map<string, number>();
        const tokens = Array.from({ length: 20 }, (_, index) => `word${index}`);

        for (const [index, token] of tokens.entries()) {
            const isCommon = index < 10;
            const frequency = isCommon ? index + 1 : 1000 + index;
            tokenOccurrences.set(token, isCommon ? 100 - index : 20 - index);

            const extractedFrequency = (yomitan as any).extractFrequency(token, [
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

            expect(extractedFrequency).toBeNull();
            expect((yomitan as any).frequencyCache.get(token)).toBeNull();
        }

        yomitan.inferFrequencyModesFromTokenOccurrences(new Map([[0, tokenOccurrences]]));

        expect((yomitan as any).inferredFrequencyModes.get('inferred-rank')).toBe('rank-based');
        expect((yomitan as any).frequencyCache.get('word0')).toBe(1);
        expect((yomitan as any).frequencyCache.get('word19')).toBe(1019);
        expect(modified).toHaveBeenCalledTimes(20);
        expect(modified).toHaveBeenCalledWith('word0');
        expect(modified).toHaveBeenCalledWith('word19');
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

        expect((yomitan as any).termEntriesBatchSize).toBe(5);
        expect(fetcher.fetch.mock.calls.map((call) => (call[1] as { term: string[] }).term.length)).toEqual([
            10, 5, 3, 2, 2, 2, 2, 2, 1,
        ]);
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
        const fetcher = new MockFetcher();
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const acquireDeferred = deferred<number>();
        jest.spyOn((yomitan as any).asyncSemaphore, 'acquire').mockReturnValue(acquireDeferred.promise);

        const promise = yomitan.termEntriesBulk(['alpha'], false);
        yomitan.resetCache();
        (yomitan as any).lastCancelledAt = Number.MAX_SAFE_INTEGER;
        acquireDeferred.resolve(1);
        await promise;

        expect(fetcher.fetch).not.toHaveBeenCalled();
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
        fetcher.fetch.mockResolvedValue({ version: '0.0.0.0' });
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        const verifySpy = jest.spyOn(yomitan as any, 'verifyMecabSupport').mockResolvedValue(undefined);

        await expect(yomitan.version()).resolves.toEqual('0.0.0.0');

        expect(verifySpy).toHaveBeenCalled();
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
        fetcher.fetch.mockResolvedValue({ version: '26.4.6' });
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        const verifySpy = jest.spyOn(yomitan as any, 'verifyMecabSupport').mockResolvedValue(undefined);

        await expect(yomitan.version()).resolves.toEqual('26.4.6');

        expect(verifySpy).toHaveBeenCalled();
        expect(yomitan.getSupportsBulkFrequency()).toBe(true);
    });

    it('does not verify mecab support for non-mecab parsers and keeps bulk support disabled before 26.4.6', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: '26.4.5' });
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);
        const verifySpy = jest.spyOn(yomitan as any, 'verifyMecabSupport').mockResolvedValue(undefined);
        (yomitan as any).supportsMecab = true;
        (yomitan as any).supportsMecabLemma = true;

        await expect(yomitan.version()).resolves.toEqual('26.4.5');

        expect(verifySpy).not.toHaveBeenCalled();
        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
        expect(yomitan.getSupportsBulkFrequency()).toBe(false);
    });

    it('does not verify mecab support before version 26.3.9 even when the parser is mecab', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue({ version: '26.3.8' });
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);
        const verifySpy = jest.spyOn(yomitan as any, 'verifyMecabSupport').mockResolvedValue(undefined);
        (yomitan as any).supportsMecab = true;
        (yomitan as any).supportsMecabLemma = true;

        await expect(yomitan.version()).resolves.toEqual('26.3.8');

        expect(verifySpy).not.toHaveBeenCalled();
        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
        expect(yomitan.getSupportsBulkFrequency()).toBe(false);
    });

    it('sets full mecab and lemma support when verifyMecabSupport receives the expected tokenization', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue([
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
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await (yomitan as any).verifyMecabSupport();

        expect(yomitan.getSupportsMecab()).toBe(true);
        expect(yomitan.getSupportsMecabLemma()).toBe(true);
    });

    it('keeps mecab support but disables lemma support when verifyMecabSupport sees unexpected lemmas', async () => {
        const fetcher = new MockFetcher();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        fetcher.fetch.mockResolvedValue([
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

        await (yomitan as any).verifyMecabSupport();

        expect(yomitan.getSupportsMecab()).toBe(true);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
    });

    it('disables mecab support when verifyMecabSupport receives an unexpected tokenization shape', async () => {
        const fetcher = new MockFetcher();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        fetcher.fetch.mockResolvedValue([
            makeTokenizeResult({
                source: 'mecab',
                dictionary: 'UniDic 202402',
                content: [[makeTokenPart({ text: '思い出せない', reading: 'おもいだせない' })]],
            }),
        ]);
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await (yomitan as any).verifyMecabSupport();

        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
    });

    it('disables mecab support when verifyMecabSupport receives an unexpected source or fetch failure', async () => {
        const fetcher = new MockFetcher();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        fetcher.fetch.mockResolvedValueOnce([
            makeTokenizeResult({
                source: 'scanning-parser',
                content: [[makeTokenPart({ text: '思い出せなく', reading: 'おもいだせなく' })]],
            }),
        ]);
        fetcher.fetch.mockRejectedValueOnce(new Error('boom'));
        const yomitan = new Yomitan(testDictionaryTrack({ dictionaryYomitanParser: 'mecab' }), fetcher);

        await (yomitan as any).verifyMecabSupport();
        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);

        await (yomitan as any).verifyMecabSupport();
        expect(yomitan.getSupportsMecab()).toBe(false);
        expect(yomitan.getSupportsMecabLemma()).toBe(false);
    });

    it('throws from _executeAction when the Yomitan API returns an empty payload', async () => {
        const fetcher = new MockFetcher();
        fetcher.fetch.mockResolvedValue('{}');
        const yomitan = new Yomitan(testDictionaryTrack(), fetcher);

        await expect((yomitan as any)._executeAction('tokenize', { text: 'alpha' })).rejects.toThrow(
            'Yomitan API error for tokenize: {}'
        );
        expect(fetcher.fetch).toHaveBeenCalledWith('http://127.0.0.1:50500/tokenize', { text: 'alpha' });
    });
});
