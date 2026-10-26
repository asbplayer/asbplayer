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

export interface ApprovedExternalConnection {
    name?: string;
    approvedAt: number;
}

export interface PendingExternalConnection {
    name?: string;
    requestedAt: number;
}

export interface ExternalConnectionsState {
    // Keyed by the external extension's runtime ID.
    approved: { [extensionId: string]: ApprovedExternalConnection };
    pending: { [extensionId: string]: PendingExternalConnection };
}

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
    externalConnections: {
        approved: {},
        pending: {},
    },
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
 * when the mutator reports no change. Throws when the lock is already held, or when the
 * provider does not support locked updates.
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
    name?: string
): Promise<void> => {
    await mutateExternalConnections(provider, (externalConnections) => {
        const request = externalConnections.pending[extensionId];
        delete externalConnections.pending[extensionId];
        externalConnections.approved[extensionId] = { name: name ?? request?.name, approvedAt: Date.now() };
        return true;
    });
};

export const denyExternalConnection = async (provider: GlobalStateProvider, extensionId: string): Promise<void> => {
    await mutateExternalConnections(provider, (externalConnections) => {
        if (!(extensionId in externalConnections.pending)) {
            return false;
        }

        delete externalConnections.pending[extensionId];
        return true;
    });
};

export const removeExternalConnection = async (provider: GlobalStateProvider, extensionId: string): Promise<void> => {
    await mutateExternalConnections(provider, (externalConnections) => {
        if (!(extensionId in externalConnections.approved)) {
            return false;
        }

        delete externalConnections.approved[extensionId];
        return true;
    });
};
