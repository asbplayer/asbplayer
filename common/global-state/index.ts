// The app and extension currently share settings via extension storage.
// However, each setting can have different values per profile.
// "Global state" exists for other kinds of key/value pairs that should
// not be affected by settings profiles. For example: FTUE state.

export enum AnnotationTutorialState {
    hasNotSeen = 0,
    shouldSee = 1,
    hasSeen = 2,
}

export interface OnlineSubtitleSourceConfig {
    jimakuApiKey: string;
}

export const initialGlobalState: GlobalState = {
    ftueHasSeenAnkiDialogQuickSelectV2: false,
    ftueHasSeenSubtitleTrackSelector: false,
    ftueAnnotation: AnnotationTutorialState.hasNotSeen,
    onlineSubtitleSourceConfig: {
        jimakuApiKey: '',
    },
};

export interface GlobalState {
    ftueHasSeenAnkiDialogQuickSelectV2: boolean;
    ftueHasSeenSubtitleTrackSelector: boolean;
    ftueAnnotation: AnnotationTutorialState;
    onlineSubtitleSourceConfig: OnlineSubtitleSourceConfig;
}

export interface GlobalStateProvider {
    getAll: () => Promise<GlobalState>;
    get: <K extends keyof GlobalState>(keys: K[]) => Promise<Pick<GlobalState, K>>;
    set: (state: Partial<GlobalState>) => Promise<void>;
}
