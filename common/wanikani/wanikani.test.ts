import { describe, expect, it } from '@jest/globals';
import type { Fetcher } from '@project/common';
import { WaniKani, WaniKaniApiError, WaniKaniAssignment, WaniKaniSubject } from './wanikani';

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
        json: async () => body,
    }) as unknown as Response;

const responseWithInvalidJson = (status: number, statusText: string) =>
    ({
        ok: false,
        status,
        statusText,
        headers: new Headers(),
        json: async () => {
            throw new Error('invalid json');
        },
    }) as unknown as Response;

class TestTransport implements Fetcher<RequestInit, Response> {
    requests: Array<{ url: string; init: RequestInit }> = [];

    constructor(private readonly responses: Response[]) {}

    fetch = async (url: string, init: RequestInit) => {
        this.requests.push({ url, init });
        const response = this.responses.shift();
        if (response === undefined) throw new Error('Unexpected WaniKani request');
        return response;
    };
}

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

describe('WaniKani', () => {
    it('sends auth headers, encodes query params, and follows paginated collection responses', async () => {
        const nextUrl = 'https://api.wanikani.com/v2/assignments?page_after_id=1';
        const transport = new TestTransport([
            response(collection([makeAssignment(1)], nextUrl, '2024-01-01', 4)),
            response(collection([makeAssignment(2)], null, '2024-01-02', 99)),
        ]);

        const result = await new WaniKani('  wk-token  ', transport).assignments({
            subjectTypes: ['vocabulary', 'kana_vocabulary'],
            updatedAfter: '2024-01-01',
        });

        expect(result).toEqual({
            data: [makeAssignment(1), makeAssignment(2)],
            dataUpdatedAt: '2024-01-01',
            totalCount: 4,
        });
        expect(transport.requests).toHaveLength(2);
        const firstUrl = new URL(transport.requests[0].url);
        expect(firstUrl.origin + firstUrl.pathname).toBe('https://api.wanikani.com/v2/assignments');
        expect(firstUrl.searchParams.get('subject_types')).toBe('vocabulary,kana_vocabulary');
        expect(firstUrl.searchParams.get('updated_after')).toBe('2024-01-01');
        expect(transport.requests[0].init).toEqual({
            method: 'GET',
            headers: {
                Authorization: 'Bearer wk-token',
                'Wanikani-Revision': '20170710',
            },
        });
        expect(transport.requests[1].url).toBe(nextUrl);
    });

    it('maps structured WaniKani error responses', async () => {
        const transport = new TestTransport([response({ error: 'Token is invalid', code: 401 }, 401, 'Unauthorized')]);

        await expect(new WaniKani('bad-token', transport).user()).rejects.toMatchObject({
            name: 'WaniKaniApiError',
            status: 401,
            code: 401,
            message: 'Token is invalid',
        } satisfies Partial<WaniKaniApiError>);
    });

    it('falls back to HTTP status text when an error response is malformed', async () => {
        const transport = new TestTransport([responseWithInvalidJson(500, 'Server Error')]);

        await expect(new WaniKani('token', transport).subjects({ types: ['vocabulary'] })).rejects.toMatchObject({
            status: 500,
            message: 'Server Error',
        } satisfies Partial<WaniKaniApiError>);
    });

    it('retries one rate-limited request after the reset delay', async () => {
        const transport = new TestTransport([
            response(
                { error: 'Rate limited', code: 429 },
                429,
                'Too Many Requests',
                new Headers({ 'RateLimit-Reset': '2' })
            ),
            response(makeSubject(1)),
        ]);
        const waits: number[] = [];

        const result = await new WaniKani(
            'token',
            transport,
            () => 1000,
            async (milliseconds) => {
                waits.push(milliseconds);
            }
        ).user();

        expect(result).toEqual(makeSubject(1));
        expect(waits).toEqual([2000]);
        expect(transport.requests).toHaveLength(2);
    });

    it('surfaces a second rate-limit response without retrying indefinitely', async () => {
        const rateLimited = response(
            { error: 'Rate limited', code: 429 },
            429,
            'Too Many Requests',
            new Headers({ 'RateLimit-Reset': '2' })
        );
        const transport = new TestTransport([rateLimited, rateLimited]);

        await expect(
            new WaniKani(
                'token',
                transport,
                () => 1000,
                async () => undefined
            ).user()
        ).rejects.toMatchObject({ status: 429, code: 429, message: 'Rate limited' });
        expect(transport.requests).toHaveLength(2);
    });
});
