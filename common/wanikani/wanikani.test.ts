import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { WaniKani, WaniKaniApiError, WaniKaniAssignment, WaniKaniSubject } from './wanikani';

const originalFetch = globalThis.fetch;

const collection = <T>(
    data: T[],
    nextUrl: string | null = null,
    dataUpdatedAt = '2024-01-01T00:00:00.000000Z',
    totalCount = data.length
) => ({
    object: 'collection',
    url: 'https://api.wanikani.com/v2/test',
    data_updated_at: dataUpdatedAt,
    data,
    pages: {
        next_url: nextUrl,
        previous_url: null,
        per_page: data.length,
    },
    total_count: totalCount,
});

const response = (body: unknown, status = 200, statusText = 'OK', headers = new Headers()) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        headers,
        json: jest.fn(async () => body),
    }) as unknown as Response;

const responseWithInvalidJson = (status: number, statusText: string) =>
    ({
        ok: false,
        status,
        statusText,
        headers: new Headers(),
        json: jest.fn(async () => {
            throw new Error('invalid json');
        }),
    }) as unknown as Response;

const makeAssignment = (id: number): WaniKaniAssignment => ({
    id,
    object: 'assignment',
    url: `https://api.wanikani.com/v2/assignments/${id}`,
    data_updated_at: '2024-01-01T00:00:00.000000Z',
    data: {
        subject_id: id,
        subject_type: 'vocabulary',
        srs_stage: 5,
        hidden: false,
        available_at: null,
    },
});

const makeSubject = (id: number): WaniKaniSubject => ({
    id,
    object: 'vocabulary',
    url: `https://api.wanikani.com/v2/subjects/${id}`,
    data_updated_at: '2024-01-01T00:00:00.000000Z',
    data: {
        characters: `単語${id}`,
        level: 1,
        hidden_at: null,
        spaced_repetition_system_id: 1,
    },
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('WaniKani', () => {
    it('sends auth headers, encodes query params, and follows paginated collection responses', async () => {
        const fetchMock = jest.fn<typeof fetch>();
        globalThis.fetch = fetchMock;
        const nextUrl = 'https://api.wanikani.com/v2/assignments?page_after_id=1';
        fetchMock
            .mockResolvedValueOnce(response(collection([makeAssignment(1)], nextUrl, '2024-01-01', 4)))
            .mockResolvedValueOnce(response(collection([makeAssignment(2)], null, '2024-01-02', 99)));

        const result = await new WaniKani('  wk-token  ').assignments({
            subjectTypes: ['vocabulary', 'kana_vocabulary'],
            updatedAfter: '2024-01-01',
        });

        expect(result).toEqual({
            data: [makeAssignment(1), makeAssignment(2)],
            dataUpdatedAt: '2024-01-01',
            totalCount: 4,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url, init] = fetchMock.mock.calls[0];
        const firstUrl = new URL(url as string);
        expect(firstUrl.origin + firstUrl.pathname).toBe('https://api.wanikani.com/v2/assignments');
        expect(firstUrl.searchParams.get('subject_types')).toBe('vocabulary,kana_vocabulary');
        expect(firstUrl.searchParams.get('updated_after')).toBe('2024-01-01');
        expect(init).toEqual({
            method: 'GET',
            headers: {
                Authorization: 'Bearer wk-token',
                'Wanikani-Revision': '20170710',
            },
        });
        expect(fetchMock.mock.calls[1][0]).toBe(nextUrl);
    });

    it('maps structured WaniKani error responses', async () => {
        const fetchMock = jest.fn<typeof fetch>();
        globalThis.fetch = fetchMock;
        fetchMock.mockResolvedValue(response({ error: 'Token is invalid', code: 401 }, 401, 'Unauthorized'));

        await expect(new WaniKani('bad-token').user()).rejects.toMatchObject({
            name: 'WaniKaniApiError',
            status: 401,
            code: 401,
            message: 'Token is invalid',
        } satisfies Partial<WaniKaniApiError>);
    });

    it('falls back to HTTP status text when an error response is malformed', async () => {
        const fetchMock = jest.fn<typeof fetch>();
        globalThis.fetch = fetchMock;

        fetchMock.mockResolvedValue(responseWithInvalidJson(500, 'Server Error'));

        await expect(new WaniKani('token').subjects({ types: ['vocabulary'] })).rejects.toMatchObject({
            status: 500,
            message: 'Server Error',
        } satisfies Partial<WaniKaniApiError>);
    });

    it('retries one rate-limited request after the reset delay', async () => {
        jest.useFakeTimers();
        jest.spyOn(Date, 'now').mockReturnValue(1000);
        const fetchMock = jest.fn<typeof fetch>();
        globalThis.fetch = fetchMock;
        fetchMock
            .mockResolvedValueOnce(
                response({ error: 'Rate limited', code: 429 }, 429, 'Too Many Requests', {
                    get: (name: string) => (name === 'RateLimit-Reset' ? '2' : null),
                } as Headers)
            )
            .mockResolvedValueOnce(response(makeSubject(1)));

        const promise = new WaniKani('token').user();
        await Promise.resolve();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(2000);
        await expect(promise).resolves.toEqual(makeSubject(1));
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('surfaces a second rate-limit response without retrying indefinitely', async () => {
        jest.useFakeTimers();
        jest.spyOn(Date, 'now').mockReturnValue(1000);
        const fetchMock = jest.fn<typeof fetch>();
        globalThis.fetch = fetchMock;
        const rateLimited = response({ error: 'Rate limited', code: 429 }, 429, 'Too Many Requests', {
            get: (name: string) => (name === 'RateLimit-Reset' ? '2' : null),
        } as Headers);
        fetchMock.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(rateLimited);

        const promise = new WaniKani('token').user();
        await Promise.resolve();
        jest.advanceTimersByTime(2000);

        await expect(promise).rejects.toMatchObject({ status: 429, code: 429, message: 'Rate limited' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
