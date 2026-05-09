export interface JimakuEntry {
    id: number;
    anilist_id?: number;
    name: string;
    japanese_name?: string;
    english_name?: string;
    created_at?: string;
    last_updated_at?: string;
    flags?: number;
}

export interface JimakuFile {
    id: number;
    name: string;
    url: string;
    created_at?: string;
    size?: number;
}

export interface JimakuRateLimit {
    limit?: number;
    remaining?: number;
    resetAfterSeconds?: number;
}

export interface JimakuResponse<T> {
    data: T;
    rateLimit: JimakuRateLimit;
}

interface JimakuErrorPayload {
    error?: string;
    message?: string;
}

const parseJsonSafely = (text: string): unknown | undefined => {
    if (text.length === 0) {
        return undefined;
    }

    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
};

const defaultJimakuBaseUrl = 'https://jimaku.cc/api';

type TrustedHtmlPolicyLike = {
    createHTML: (value: string) => string | TrustedHTML;
};

let trustedHtmlPolicy: TrustedHtmlPolicyLike | undefined;

const createTrustedHtml = (html: string): string | TrustedHTML => {
    const trustedTypesApi = (
        globalThis as typeof globalThis & {
            trustedTypes?: {
                createPolicy: (
                    name: string,
                    policy: { createHTML: (value: string) => string }
                ) => TrustedHtmlPolicyLike;
                getPolicy?: (name: string) => TrustedHtmlPolicyLike | null;
            };
        }
    ).trustedTypes;

    if (!trustedTypesApi) {
        return html;
    }

    if (!trustedHtmlPolicy) {
        try {
            trustedHtmlPolicy = trustedTypesApi.createPolicy('asbplayer-subtitle-sources', {
                createHTML: (value) => value,
            });
        } catch (error) {
            trustedHtmlPolicy = trustedTypesApi.getPolicy?.('asbplayer-subtitle-sources') ?? undefined;
        }
    }

    return trustedHtmlPolicy ? trustedHtmlPolicy.createHTML(html) : html;
};

const parseHtmlDocument = (html: string) => {
    const trustedHtml = createTrustedHtml(html);
    return new DOMParser().parseFromString(trustedHtml as string, 'text/html');
};

const parseRateLimit = (headers: Headers): JimakuRateLimit => ({
    limit: parseOptionalInt(headers.get('x-ratelimit-limit')),
    remaining: parseOptionalInt(headers.get('x-ratelimit-remaining')),
    resetAfterSeconds: parseOptionalFloat(headers.get('x-ratelimit-reset-after')),
});

const parseOptionalInt = (value: string | null): number | undefined => {
    if (value === null) {
        return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalFloat = (value: string | null): number | undefined => {
    if (value === null) {
        return undefined;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export interface JimakuClientOptions {
    apiKey: string;
    baseUrl?: string;
    minRequestIntervalMs?: number;
}

export class JimakuClient {
    private readonly _apiKey: string;
    private readonly _baseUrl: string;
    private readonly _minRequestIntervalMs: number;
    private _lastRequestTimestampMs?: number;
    private _lastRateLimit?: JimakuRateLimit;

    constructor({ apiKey, baseUrl = defaultJimakuBaseUrl, minRequestIntervalMs = 1000 }: JimakuClientOptions) {
        const trimmedApiKey = apiKey.trim();

        if (trimmedApiKey.length === 0) {
            throw new Error('Jimaku API key cannot be empty or whitespace-only');
        }

        this._apiKey = trimmedApiKey;
        this._baseUrl = baseUrl;
        this._minRequestIntervalMs = minRequestIntervalMs;
    }

    async searchEntries(query: string): Promise<JimakuResponse<JimakuEntry[]>> {
        const searchParams = new URLSearchParams();
        searchParams.set('query', query);
        return await this._request<JimakuEntry[]>(`entries/search?${searchParams.toString()}`);
    }

    async getEntry(id: number): Promise<JimakuResponse<JimakuEntry>> {
        return await this._request<JimakuEntry>(`entries/${id}`);
    }

    async getFiles(
        id: number,
        options?: {
            episode?: number;
        }
    ): Promise<JimakuResponse<JimakuFile[]>> {
        const searchParams = new URLSearchParams();

        if (options?.episode !== undefined) {
            searchParams.set('episode', `${options.episode}`);
        }

        const query = searchParams.toString();
        const endpoint = query.length > 0 ? `entries/${id}/files?${query}` : `entries/${id}/files`;
        return await this._request<JimakuFile[]>(endpoint);
    }

    private async _request<T>(endpoint: string): Promise<JimakuResponse<T>> {
        await this._waitIfNeeded();
        const response = await fetch(new URL(endpoint, `${this._baseUrl}/`).toString(), {
            headers: {
                Authorization: this._apiKey,
            },
        });
        this._lastRequestTimestampMs = Date.now();

        const rateLimit = parseRateLimit(response.headers);
        this._lastRateLimit = rateLimit;
        const bodyText = await response.text();
        const parsedBody = parseJsonSafely(bodyText) as T | JimakuErrorPayload | undefined;

        if (!response.ok) {
            const errorMessage =
                (parsedBody as JimakuErrorPayload | undefined)?.error ??
                (parsedBody as JimakuErrorPayload | undefined)?.message ??
                `Jimaku request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        if (parsedBody === undefined) {
            throw new Error('Jimaku request failed: expected a JSON response body');
        }

        return {
            data: parsedBody as T,
            rateLimit,
        };
    }

    private async _waitIfNeeded() {
        // Prioritize server-reported rate limit data over hard-coded interval
        if (this._lastRateLimit !== undefined) {
            const { remaining, resetAfterSeconds } = this._lastRateLimit;

            if (remaining !== undefined && remaining <= 0 && resetAfterSeconds !== undefined && resetAfterSeconds > 0) {
                await new Promise((resolve) => setTimeout(resolve, resetAfterSeconds * 1000));
                return;
            }

            // If we still have quota remaining, skip the hard-coded wait
            if (remaining !== undefined && remaining > 0) {
                return;
            }
        }

        if (this._lastRequestTimestampMs === undefined || this._minRequestIntervalMs <= 0) {
            return;
        }

        const elapsedMs = Date.now() - this._lastRequestTimestampMs;
        const remainingMs = this._minRequestIntervalMs - elapsedMs;

        if (remainingMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
    }
}
