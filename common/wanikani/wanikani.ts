const WANIKANI_API_BASE_URL = 'https://api.wanikani.com/v2';
const WANIKANI_REVISION = '20170710';
const DEFAULT_RATE_LIMIT_RETRY_MS = 61000;

type WaniKaniResourceObject<TObject extends string, TData> = {
    id: number;
    object: TObject;
    url: string;
    data_updated_at: string;
    data: TData;
};

interface WaniKaniCollection<WaniKaniResourceObject> {
    object: 'collection';
    url: string;
    data_updated_at: string | null;
    data: WaniKaniResourceObject[];
    pages: {
        next_url: string | null;
        previous_url: string | null;
        per_page: number;
    };
    total_count: number;
}

interface WaniKaniErrorResponse {
    error: string;
    code: number;
}

export interface WaniKaniCollectionResult<T> {
    data: T[];
    dataUpdatedAt: string | null;
}

export interface WaniKaniUserData {
    id: string;
    username: string;
    level: number;
    profile_url: string;
    started_at: string;
    current_vacation_started_at: string | null;
    subscription: {
        active: boolean;
        type: string | null;
        max_level_granted: number | null;
        period_ends_at: string | null;
    };
    preferences: {
        default_voice_actor_id: 1;
        extra_study_autoplay_audio: boolean;
        lessons_autoplay_audio: boolean;
        lessons_batch_size: number;
        lessons_presentation_order: 'ascending_level_then_subject';
        reviews_autoplay_audio: boolean;
        reviews_display_srs_indicator: boolean;
        reviews_presentation_order: 'shuffled' | 'lower_levels_first';
    };
}
export type WaniKaniUser = WaniKaniResourceObject<'user', WaniKaniUserData>;

export type WaniKaniSubjectType = 'vocabulary' | 'kana_vocabulary' | 'kanji' | 'radical';

export interface WaniKaniAssignmentData {
    subject_id: number;
    subject_type: WaniKaniSubjectType;
    srs_stage: number;
    hidden: boolean;
    available_at: string | null;
}
export type WaniKaniAssignment = WaniKaniResourceObject<'assignment', WaniKaniAssignmentData>;

export interface WaniKaniSubjectData {
    characters: string;
    level: number;
    hidden_at: string | null;
    spaced_repetition_system_id: number;
}
export type WaniKaniSubject = WaniKaniResourceObject<WaniKaniSubjectType, WaniKaniSubjectData>;

export interface WaniKaniSpacedRepetitionSystemStage {
    interval: number | null;
    interval_unit: string | null;
    position: number;
}

export interface WaniKaniSpacedRepetitionSystemData {
    created_at: string;
    name: string;
    description: string;
    unlocking_stage_position: number;
    starting_stage_position: number;
    passing_stage_position: number;
    burning_stage_position: number;
    stages: WaniKaniSpacedRepetitionSystemStage[];
}
export type WaniKaniSpacedRepetitionSystem = WaniKaniResourceObject<
    'spaced_repetition_system',
    WaniKaniSpacedRepetitionSystemData
>;

export interface WaniKaniResetData {
    created_at: string;
    confirmed_at: string | null;
    original_level: number;
    target_level: number;
}
export type WaniKaniReset = WaniKaniResourceObject<'reset', WaniKaniResetData>;

export class WaniKaniApiError extends Error {
    readonly status: number;
    readonly code?: number;

    constructor(status: number, message: string, code?: number) {
        super(message);
        this.name = 'WaniKaniApiError';
        this.status = status;
        this.code = code;
    }
}

export class WaniKani {
    private readonly apiToken: string;

    constructor(apiToken: string) {
        this.apiToken = apiToken.trim();
    }

    async user(): Promise<WaniKaniUser> {
        return this._getJson<WaniKaniUser>(this._url('/user'));
    }

    async resets(options?: { updatedAfter?: string }): Promise<WaniKaniCollectionResult<WaniKaniReset>> {
        return this._getPaginated<WaniKaniReset>('/resets', { updated_after: options?.updatedAfter });
    }

    async assignments(options?: {
        subjectTypes?: WaniKaniSubjectType[];
        updatedAfter?: string;
        availableBefore?: string;
    }): Promise<WaniKaniCollectionResult<WaniKaniAssignment>> {
        return this._getPaginated<WaniKaniAssignment>('/assignments', {
            subject_types: options?.subjectTypes?.join(','),
            updated_after: options?.updatedAfter,
            available_before: options?.availableBefore,
        });
    }

    async subjects(options?: {
        types?: WaniKaniSubjectType[];
        updatedAfter?: string;
    }): Promise<WaniKaniCollectionResult<WaniKaniSubject>> {
        return this._getPaginated<WaniKaniSubject>('/subjects', {
            types: options?.types?.join(','),
            updated_after: options?.updatedAfter,
        });
    }

    async spacedRepetitionSystems(options?: {
        updatedAfter?: string;
    }): Promise<WaniKaniCollectionResult<WaniKaniSpacedRepetitionSystem>> {
        return this._getPaginated<WaniKaniSpacedRepetitionSystem>('/spaced_repetition_systems', {
            updated_after: options?.updatedAfter,
        });
    }

    private _url(path: string, params?: Record<string, string | number | boolean | undefined>) {
        const url = new URL(`${WANIKANI_API_BASE_URL}${path}`);
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value === undefined) continue;
                url.searchParams.set(key, String(value));
            }
        }
        return url.toString();
    }

    private async _getPaginated<T>(
        path: string,
        params?: Record<string, string | number | boolean | undefined>
    ): Promise<WaniKaniCollectionResult<T>> {
        const data: T[] = [];
        let dataUpdatedAt: string | null = null;
        let nextUrl: string | null = this._url(path, params);
        while (nextUrl) {
            const page: WaniKaniCollection<T> = await this._getJson(nextUrl);
            if (!dataUpdatedAt) dataUpdatedAt = page.data_updated_at;
            data.push(...page.data);
            nextUrl = page.pages.next_url;
        }
        return { data, dataUpdatedAt };
    }

    private async _getJson<T>(url: string): Promise<T> {
        while (true) {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.apiToken}`,
                    'Wanikani-Revision': WANIKANI_REVISION,
                },
            });
            if (response.status === 429) {
                await this._waitForRateLimitReset(response);
                continue;
            }
            if (!response.ok) {
                let body: WaniKaniErrorResponse | undefined;
                try {
                    body = await response.json();
                } catch {
                    body = undefined;
                }
                throw new WaniKaniApiError(response.status, body?.error ?? response.statusText, body?.code);
            }
            return response.json();
        }
    }

    private async _waitForRateLimitReset(response: Response) {
        const resetHeader = response.headers.get('RateLimit-Reset');
        const resetValue = resetHeader === null ? Number.NaN : Number(resetHeader);
        const delay = Number.isFinite(resetValue)
            ? Math.max(1000, resetValue * 1000 - Date.now() + 1000)
            : DEFAULT_RATE_LIMIT_RETRY_MS;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}
