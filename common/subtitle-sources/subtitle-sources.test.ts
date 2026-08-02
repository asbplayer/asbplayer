import { JimakuClient } from './subtitle-sources';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const originalFetch = globalThis.fetch;

const createResponse = ({
    ok = true,
    status = 200,
    statusText = 'OK',
    jsonData,
    textData,
    headers = {},
}: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    jsonData?: unknown;
    textData?: string;
    headers?: Record<string, string>;
}) => {
    return {
        ok,
        status,
        statusText,
        headers: {
            get: (key: string) => headers[key.toLowerCase()] ?? null,
        },
        text: async () => (textData !== undefined ? textData : JSON.stringify(jsonData)),
    } as unknown as Response;
};

afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('JimakuClient', () => {
    it('validates api key at construction', () => {
        expect(() => new JimakuClient({ apiKey: '   ' })).toThrow('Jimaku API key cannot be empty or whitespace-only');
    });

    it('searches entries with authorization header', async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
            createResponse({
                jsonData: [{ id: 729, name: 'Sousou no Frieren' }],
                headers: {
                    'x-ratelimit-limit': '100',
                    'x-ratelimit-remaining': '99',
                    'x-ratelimit-reset-after': '1.5',
                },
            })
        );
        global.fetch = fetchMock;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        const response = await client.searchEntries('Sousou no Frieren');

        expect(fetchMock).toHaveBeenCalledWith('https://jimaku.cc/api/entries/search?query=Sousou+no+Frieren', {
            headers: { Authorization: 'test-key' },
        });
        expect(response.data).toHaveLength(1);
        expect(response.data[0].id).toBe(729);
        expect(response.rateLimit.limit).toBe(100);
        expect(response.rateLimit.remaining).toBe(99);
        expect(response.rateLimit.resetAfterSeconds).toBe(1.5);
    });

    it('searches entries with anime parameter', async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
            createResponse({
                jsonData: [{ id: 999, name: 'Some Drama', flags: 2 }],
                headers: {
                    'x-ratelimit-limit': '100',
                    'x-ratelimit-remaining': '98',
                    'x-ratelimit-reset-after': '1.0',
                },
            })
        );
        global.fetch = fetchMock;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        const response = await client.searchEntries('Some Drama', false);

        expect(fetchMock).toHaveBeenCalledWith('https://jimaku.cc/api/entries/search?query=Some+Drama&anime=false', {
            headers: { Authorization: 'test-key' },
        });
        expect(response.data[0].name).toBe('Some Drama');
    });

    it('requests files with optional filters', async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(createResponse({ jsonData: [] }));
        global.fetch = fetchMock;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await client.getFiles(729, { episode: 1 });

        expect(fetchMock).toHaveBeenCalledWith('https://jimaku.cc/api/entries/729/files?episode=1', {
            headers: { Authorization: 'test-key' },
        });
    });

    it('waits for server rate-limit reset before the next request', async () => {
        jest.useFakeTimers();
        try {
            const fetchMock = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(
                    createResponse({
                        jsonData: [],
                        headers: {
                            'x-ratelimit-remaining': '0',
                            'x-ratelimit-reset-after': '0.25',
                        },
                    })
                )
                .mockResolvedValueOnce(createResponse({ jsonData: [] }));
            global.fetch = fetchMock;
            const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 10000 });

            await client.searchEntries('first');
            const secondRequest = client.searchEntries('second');

            expect(fetchMock).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(249);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            await secondRequest;

            expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://jimaku.cc/api/entries/search?query=second', {
                headers: { Authorization: 'test-key' },
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it('does not wait when server rate-limit headers report remaining quota', async () => {
        jest.useFakeTimers();
        try {
            const fetchMock = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(
                    createResponse({
                        jsonData: [],
                        headers: {
                            'x-ratelimit-remaining': '2',
                            'x-ratelimit-reset-after': '10',
                        },
                    })
                )
                .mockResolvedValueOnce(createResponse({ jsonData: [] }));
            global.fetch = fetchMock;
            const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 10000 });

            await client.searchEntries('first');
            const secondRequest = client.searchEntries('second');
            await Promise.resolve();

            expect(fetchMock).toHaveBeenCalledTimes(2);
            await secondRequest;
        } finally {
            jest.useRealTimers();
        }
    });

    it('falls back to the minimum request interval without server quota headers', async () => {
        jest.useFakeTimers();
        try {
            const fetchMock = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(createResponse({ jsonData: [] }))
                .mockResolvedValueOnce(createResponse({ jsonData: [] }));
            global.fetch = fetchMock;
            const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 100 });

            await client.searchEntries('first');
            await jest.advanceTimersByTimeAsync(40);
            const secondRequest = client.searchEntries('second');

            expect(fetchMock).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(59);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            await secondRequest;

            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            jest.useRealTimers();
        }
    });

    it('falls back to the minimum request interval when quota is exhausted without reset timing', async () => {
        jest.useFakeTimers();
        try {
            const fetchMock = jest
                .fn<typeof fetch>()
                .mockResolvedValueOnce(
                    createResponse({
                        jsonData: [],
                        headers: {
                            'x-ratelimit-remaining': '0',
                        },
                    })
                )
                .mockResolvedValueOnce(createResponse({ jsonData: [] }));
            global.fetch = fetchMock;
            const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 100 });

            await client.searchEntries('first');
            const secondRequest = client.searchEntries('second');

            expect(fetchMock).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(99);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1);
            await secondRequest;

            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            jest.useRealTimers();
        }
    });

    it('throws parsed error message on failed request', async () => {
        const fetchMock = jest
            .fn<typeof fetch>()
            .mockResolvedValue(createResponse({ ok: false, status: 401, jsonData: { error: 'Unauthorized' } }));
        global.fetch = fetchMock;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await expect(client.getEntry(123)).rejects.toThrow('Unauthorized');
    });

    it('falls back to status-based error when response is not json', async () => {
        const fetchMock = jest
            .fn<typeof fetch>()
            .mockResolvedValue(createResponse({ ok: false, status: 503, textData: '<html/>' }));
        global.fetch = fetchMock;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await expect(client.getEntry(123)).rejects.toThrow('Jimaku request failed with status 503');
    });

    it('throws when successful response does not contain valid json', async () => {
        const fetchMock = jest
            .fn<typeof fetch>()
            .mockResolvedValue(createResponse({ ok: true, status: 200, textData: '<html/>' }));
        global.fetch = fetchMock;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await expect(client.getEntry(123)).rejects.toThrow('Jimaku request failed: expected a JSON response body');
    });
});
