import { JimakuClient } from './subtitle-sources';

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

describe('JimakuClient', () => {
    it('validates api key at construction', () => {
        expect(() => new JimakuClient({ apiKey: '   ' })).toThrow('Jimaku API key cannot be empty or whitespace-only');
    });

    it('searches entries with authorization header', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            createResponse({
                jsonData: [{ id: 729, name: 'Sousou no Frieren' }],
                headers: {
                    'x-ratelimit-limit': '100',
                    'x-ratelimit-remaining': '99',
                    'x-ratelimit-reset-after': '1.5',
                },
            })
        );
        global.fetch = fetchMock as unknown as typeof fetch;
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

    it('requests files with optional filters', async () => {
        const fetchMock = jest.fn().mockResolvedValue(createResponse({ jsonData: [] }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await client.getFiles(729, { episode: 1 });

        expect(fetchMock).toHaveBeenCalledWith('https://jimaku.cc/api/entries/729/files?episode=1', {
            headers: { Authorization: 'test-key' },
        });
    });

    it('throws parsed error message on failed request', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(createResponse({ ok: false, status: 401, jsonData: { error: 'Unauthorized' } }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await expect(client.getEntry(123)).rejects.toThrow('Unauthorized');
    });

    it('falls back to status-based error when response is not json', async () => {
        const fetchMock = jest.fn().mockResolvedValue(createResponse({ ok: false, status: 503, textData: '<html/>' }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await expect(client.getEntry(123)).rejects.toThrow('Jimaku request failed with status 503');
    });

    it('throws when successful response does not contain valid json', async () => {
        const fetchMock = jest.fn().mockResolvedValue(createResponse({ ok: true, status: 200, textData: '<html/>' }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const client = new JimakuClient({ apiKey: 'test-key', minRequestIntervalMs: 0 });

        await expect(client.getEntry(123)).rejects.toThrow('Jimaku request failed: expected a JSON response body');
    });
});
