// The app and extension currently share settings via extension storage.
// However, each setting can have different values per profile.
// "Global state" exists for other kinds of key/value pairs that should
// not be affected by settings profiles. For example: FTUE state.

export enum AnnotationTutorialState {
    hasNotSeen = 0,
    shouldSee = 1,
    hasSeen = 2,
}

export interface JimakuCachedWork {
    id: number;
    name: string;
}

export interface OnlineSubtitleSourceConfig {
    jimakuApiKey: string;
    jimakuSearchCategory: 'anime' | 'drama';
    jimakuRecentWorks?: JimakuCachedWork[];
    jimakuEpisodeRegex?: string;
}

export type GenericParseType = 'off' | 'base' | 'aggressive';

export interface GenericSubtitleParserState {
    pages: {
        [host: string]: {
            parse: GenericParseType;
        };
    };
}

export interface ExternalMethodUsage {
    count: number;
    lastUsedAt: number;
}

export interface ExternalConnection {
    name?: string;
    requestedAt?: number;
    approvedAt?: number;
    deniedAt?: number;
    lastConnectedAt?: number;
    lastDisconnectedAt?: number;
    lastUsedAt?: number;
    methods: Record<string, ExternalMethodUsage>;
}

// Pending requests expire after this long so that unapproved requests cannot accumulate
// indefinitely.
export const pendingRequestExpirationMs = 24 * 60 * 60 * 1000;
export const deniedRequestCooldownMs = 24 * 60 * 60 * 1000;

export type ExternalConnectionsState = { [extensionId: string]: ExternalConnection };

/**
 * Pending requests that have not yet expired. Callers rendering pending requests (or counting
 * them, e.g. for badges) should use this so that expired requests are never displayed even
 * before they have been pruned from the underlying state.
 */
export const activePendingExternalConnections = (
    connections: ExternalConnectionsState,
    now: number
): ExternalConnectionsState =>
    Object.fromEntries(
        Object.entries(connections).filter(
            ([, c]) =>
                c.approvedAt === undefined &&
                c.deniedAt === undefined &&
                c.requestedAt !== undefined &&
                now - c.requestedAt <= pendingRequestExpirationMs
        )
    );

export const approvedExternalConnections = (connections: ExternalConnectionsState): ExternalConnectionsState =>
    Object.fromEntries(Object.entries(connections).filter(([, c]) => c.approvedAt !== undefined));

/**
 * Stable representation of the fields that affect approval UI, badges, and port revocation.
 * Usage and connection timestamps are excluded so their frequent updates can be ignored.
 */
export const externalConnectionsPermissionSignature = (connections: ExternalConnectionsState): string =>
    JSON.stringify(
        Object.keys(connections)
            .sort()
            .map((extensionId) => {
                const c = connections[extensionId];
                return [extensionId, c.name ?? null, c.requestedAt ?? null, c.approvedAt ?? null, c.deniedAt ?? null];
            })
    );

export const initialGlobalState: GlobalState = {
    ftueHasSeenAnkiDialogQuickSelectV2: false,
    ftueHasSeenSubtitleTrackSelector: false,
    ftueAnnotation: AnnotationTutorialState.hasNotSeen,
    genericSubtitleParser: {
        pages: {},
    },
    onlineSubtitleSourceConfig: {
        jimakuApiKey: '',
        jimakuSearchCategory: 'anime',
        jimakuRecentWorks: [],
    },
    externalConnections: {},
};

export interface GlobalState {
    ftueHasSeenAnkiDialogQuickSelectV2: boolean;
    ftueHasSeenSubtitleTrackSelector: boolean;
    ftueAnnotation: AnnotationTutorialState;
    genericSubtitleParser: GenericSubtitleParserState;
    onlineSubtitleSourceConfig: OnlineSubtitleSourceConfig;
    externalConnections: ExternalConnectionsState;
}

export interface GlobalStateProvider {
    getAll: () => Promise<GlobalState>;
    get: <K extends keyof GlobalState>(keys: K[]) => Promise<Pick<GlobalState, K>>;
    set: (state: Partial<GlobalState>) => Promise<void>;
    onUpdated: (callback: (state: Partial<GlobalState>) => void) => () => void;
    updateWithLocking: <K extends keyof GlobalState>(
        key: K,
        mutate: (state: GlobalState[K]) => boolean
    ) => Promise<void>;
}

/**
 * Locked read-modify-write of the `externalConnections` global state key. Skips the write
 * when the mutator reports no change. Waits for the lock when another context holds it.
 */
export const mutateExternalConnections = async (
    provider: GlobalStateProvider,
    mutate: (externalConnections: ExternalConnectionsState) => boolean
): Promise<void> => {
    await provider.updateWithLocking('externalConnections', mutate);
};

export const approveExternalConnection = async (
    provider: GlobalStateProvider,
    extensionId: string,
    now: number
): Promise<void> => {
    await mutateExternalConnections(provider, (externalConnections) => {
        const connection = externalConnections[extensionId];
        if (connection === undefined || connection.approvedAt !== undefined || connection.deniedAt !== undefined) {
            // Pending expiration check is intentionally skipped here, and kept purely visual to avoid complexity
            // managing time vs expiration.
            return false;
        }

        connection.approvedAt = now;
        return true;
    });
};

export const denyExternalConnection = async (
    provider: GlobalStateProvider,
    extensionId: string,
    now: number
): Promise<void> => {
    await mutateExternalConnections(provider, (externalConnections) => {
        const connection = externalConnections[extensionId];
        if (connection === undefined || connection.approvedAt !== undefined || connection.deniedAt !== undefined) {
            return false;
        }
        connection.deniedAt = now;
        return true;
    });
};

export const removeExternalConnection = async (provider: GlobalStateProvider, extensionId: string): Promise<void> => {
    await mutateExternalConnections(provider, (externalConnections) => {
        if (!(extensionId in externalConnections)) {
            return false;
        }
        delete externalConnections[extensionId];
        return true;
    });
};
