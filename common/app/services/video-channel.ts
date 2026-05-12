import {
    AlertMessage,
    AnkiSettingsToVideoMessage,
    AppBarToggleMessageToVideoMessage,
    AudioModel,
    AudioTrackModel,
    AudioTrackSelectedFromVideoMessage,
    AudioTrackSelectedToVideoMessage,
    CardTextFieldValues,
    RichSubtitleModel,
    CopyMessage,
    CopyToVideoMessage,
    CurrentTimeFromVideoMessage,
    CurrentTimeToVideoMessage,
    FullscreenToggleMessageToVideoMessage,
    HideSubtitlePlayerToggleToVideoMessage,
    ImageModel,
    MiscSettingsToVideoMessage,
    OffsetFromVideoMessage,
    OffsetToVideoMessage,
    PauseFromVideoMessage,
    PlaybackRateFromVideoMessage,
    PlaybackRateToVideoMessage,
    PlayFromVideoMessage,
    PlayMode,
    PlayModesMessage,
    PostMineAction,
    ReadyFromVideoMessage,
    ReadyStateFromVideoMessage,
    ReadyToVideoMessage,
    SubtitleModel,
    SubtitleSettingsToVideoMessage,
    SubtitlesToVideoMessage,
    TakeScreenshotToVideoPlayerMessage,
    ToggleSubtitleTrackInListFromVideoMessage,
    SubtitlesUpdatedFromVideoMessage,
    SubtitlesUpdatedToVideoMessage,
    SaveTokenLocalFromVideoMessage,
    SaveTokenLocalToVideoMessage,
} from '@project/common';
import {
    AnkiSettings,
    ApplyStrategy,
    MiscSettings,
    SubtitleSettings,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { VideoProtocol } from './video-protocol';

export default class VideoChannel {
    private readonly protocol: VideoProtocol;
    private time: number;
    private isReady: boolean;
    private readyCallbacks: ((paused: boolean) => void)[];
    private playCallbacks: ((echo: boolean) => void)[];
    private pauseCallbacks: ((echo: boolean) => void)[];
    private audioTrackSelectedCallbacks: ((audioTrack: string) => void)[];
    private currentTimeCallbacks: ((currentTime: number, echo: boolean) => void)[];
    private exitCallbacks: (() => void)[];
    private offsetCallbacks: ((offset: number) => void)[];
    private playbackRateCallbacks: ((playbackRate: number, echo: boolean) => void)[];
    private popOutToggleCallbacks: (() => void)[];
    private copyCallbacks: ((
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        cardTextFieldValues: CardTextFieldValues,
        audio: AudioModel | undefined,
        image: ImageModel | undefined,
        url: string | undefined,
        postMineAction: PostMineAction,
        id: string | undefined,
        mediaTimestamp: number | undefined
    ) => void)[];
    private hideSubtitlePlayerToggleCallbacks: (() => void)[];
    private appBarToggleCallbacks: (() => void)[];
    private ankiDialogRequestCallbacks: (() => void)[];
    private toggleSubtitleTrackInListCallbacks: ((track: number) => void)[];
    private subtitlesUpdatedCallbacks: ((updatedSubtitles: RichSubtitleModel[]) => void)[];
    private saveTokenLocalCallbacks: ((
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ) => void)[];
    private loadFilesCallbacks: (() => void)[];
    private playModesCallbacks: ((modes: Set<PlayMode>) => void)[];
    private cardUpdatedDialogCallbacks: (() => void)[];
    private cardExportedDialogCallbacks: (() => void)[];

    readyState: number;
    oncanplay: ((ev: Event) => void) | null = null;
    audioTracks?: AudioTrackModel[];
    selectedAudioTrack?: string;
    duration: number;
    _playbackRate: number;

    constructor(protocol: VideoProtocol) {
        this.protocol = protocol;
        this.time = 0;
        this.duration = 0;
        this.isReady = false;
        this.readyState = 0;
        this._playbackRate = 1;
        this.selectedAudioTrack = undefined;
        this.readyCallbacks = [];
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];
        this.exitCallbacks = [];
        this.offsetCallbacks = [];
        this.playbackRateCallbacks = [];
        this.popOutToggleCallbacks = [];
        this.copyCallbacks = [];
        this.hideSubtitlePlayerToggleCallbacks = [];
        this.appBarToggleCallbacks = [];
        this.ankiDialogRequestCallbacks = [];
        this.toggleSubtitleTrackInListCallbacks = [];
        this.subtitlesUpdatedCallbacks = [];
        this.saveTokenLocalCallbacks = [];
        this.loadFilesCallbacks = [];
        this.playModesCallbacks = [];
        this.cardUpdatedDialogCallbacks = [];
        this.cardExportedDialogCallbacks = [];

        const that = this;

        this.protocol.onMessage = (event) => {
            switch (event.data.command) {
                case 'ready':
                    const readyMessage = event.data as ReadyFromVideoMessage;

                    that.duration = readyMessage.duration;
                    that.isReady = true;
                    that.audioTracks = readyMessage.audioTracks;
                    that.selectedAudioTrack = readyMessage.selectedAudioTrack;
                    that.readyState = 4;
                    that.time = readyMessage.currentTime;
                    this._playbackRate = readyMessage.playbackRate;

                    for (let callback of that.readyCallbacks) {
                        callback(readyMessage.paused);
                    }
                    break;
                case 'readyState':
                    const readyStateMessage = event.data as ReadyStateFromVideoMessage;

                    that.readyState = readyStateMessage.value;
                    if (that.readyState === 4) {
                        that.oncanplay?.(new Event('canplay'));
                    }
                    break;
                case 'play':
                    const playMessage = event.data as PlayFromVideoMessage;

                    for (let callback of that.playCallbacks) {
                        callback(playMessage.echo);
                    }
                    break;
                case 'pause':
                    const pauseMessage = event.data as PauseFromVideoMessage;

                    for (let callback of that.pauseCallbacks) {
                        callback(pauseMessage.echo);
                    }
                    break;
                case 'audioTrackSelected':
                    const audioTrackSelectedMessage = event.data as AudioTrackSelectedFromVideoMessage;

                    for (let callback of that.audioTrackSelectedCallbacks) {
                        that.selectedAudioTrack = audioTrackSelectedMessage.id;
                        callback(audioTrackSelectedMessage.id);
                    }
                    break;
                case 'currentTime':
                    const currentTimeMessage = event.data as CurrentTimeFromVideoMessage;

                    for (let callback of that.currentTimeCallbacks) {
                        callback(currentTimeMessage.value, currentTimeMessage.echo);
                    }
                    break;
                case 'exit':
                    for (let callback of that.exitCallbacks) {
                        callback();
                    }
                    break;
                case 'offset':
                    const offsetMessage = event.data as OffsetFromVideoMessage;

                    for (let callback of that.offsetCallbacks) {
                        callback(offsetMessage.value);
                    }
                    break;
                case 'playbackRate':
                    const playbackRateMessage = event.data as PlaybackRateFromVideoMessage;

                    for (const callback of that.playbackRateCallbacks) {
                        callback(playbackRateMessage.value, playbackRateMessage.echo);
                    }
                    break;
                case 'popOutToggle':
                    for (let callback of that.popOutToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'copy':
                    for (let callback of that.copyCallbacks) {
                        const copyMessage = event.data as CopyMessage;
                        const { word, text, definition, customFieldValues } = copyMessage;
                        callback(
                            copyMessage.subtitle,
                            copyMessage.surroundingSubtitles,
                            { word, text, definition, customFieldValues },
                            copyMessage.audio,
                            copyMessage.image,
                            copyMessage.url,
                            copyMessage.postMineAction ?? PostMineAction.none,
                            copyMessage.id,
                            copyMessage.mediaTimestamp
                        );
                    }
                    break;
                case 'hideSubtitlePlayerToggle':
                    for (let callback of that.hideSubtitlePlayerToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'appBarToggle':
                    for (let callback of that.appBarToggleCallbacks) {
                        callback();
                    }
                    break;
                case 'sync':
                    // ignore
                    break;
                case 'syncv2':
                    // ignore
                    break;
                case 'ankiDialogRequest':
                    for (let callback of that.ankiDialogRequestCallbacks) {
                        callback();
                    }
                    break;
                case 'toggleSubtitleTrackInList':
                    const toggleSubtitleTrackInListMessage = event.data as ToggleSubtitleTrackInListFromVideoMessage;

                    for (const callback of that.toggleSubtitleTrackInListCallbacks) {
                        callback(toggleSubtitleTrackInListMessage.track);
                    }
                    break;
                case 'subtitlesUpdated':
                    const subtitlesUpdatedMessage = event.data as SubtitlesUpdatedFromVideoMessage;

                    for (const callback of that.subtitlesUpdatedCallbacks) {
                        callback(subtitlesUpdatedMessage.updatedSubtitles);
                    }
                    break;
                case 'saveTokenLocal':
                    const { track, token, status, states, applyStates } = event.data as SaveTokenLocalFromVideoMessage;

                    for (const callback of that.saveTokenLocalCallbacks) {
                        callback(track, token, status, states, applyStates);
                    }
                    break;
                case 'loadFiles':
                    for (const callback of that.loadFilesCallbacks) {
                        callback();
                    }
                    break;
                case 'playModes':
                    for (let callback of that.playModesCallbacks) {
                        const playModesMessage = event.data as PlayModesMessage;
                        const modes = new Set<PlayMode>(playModesMessage.playModes);
                        callback(modes);
                    }
                    break;
                case 'card-updated-dialog':
                    for (const callback of that.cardUpdatedDialogCallbacks) {
                        callback();
                    }
                    break;
                case 'card-exported-dialog':
                    for (const callback of that.cardExportedDialogCallbacks) {
                        callback();
                    }
                    break;
                default:
                    console.error('Unrecognized event ' + event.data.command);
            }
        };
    }

    get currentTime() {
        return this.time;
    }

    set currentTime(value: number) {
        this.time = value;
        this.readyState = 3;
        const message: CurrentTimeToVideoMessage = { command: 'currentTime', value: this.time };
        this.protocol.postMessage(message);
    }

    get playbackRate() {
        return this._playbackRate;
    }

    set playbackRate(playbackRate: number) {
        const message: PlaybackRateToVideoMessage = { command: 'playbackRate', value: playbackRate };
        this.protocol.postMessage(message);
    }

    onReady(callback: (paused: boolean) => void) {
        if (this.isReady) {
            callback(false);
        }
        this.readyCallbacks.push(callback);
        return () => this._remove(callback, this.readyCallbacks);
    }

    onPlay(callback: (echo: boolean) => void) {
        this.playCallbacks.push(callback);
        return () => this._remove(callback, this.playCallbacks);
    }

    onPause(callback: (echo: boolean) => void) {
        this.pauseCallbacks.push(callback);
        return () => this._remove(callback, this.pauseCallbacks);
    }

    onCurrentTime(callback: (currentTime: number, echo: boolean) => void) {
        this.currentTimeCallbacks.push(callback);
        return () => this._remove(callback, this.currentTimeCallbacks);
    }

    onAudioTrackSelected(callback: (id: string) => void) {
        this.audioTrackSelectedCallbacks.push(callback);
        return () => this._remove(callback, this.audioTrackSelectedCallbacks);
    }

    onExit(callback: () => void) {
        this.exitCallbacks.push(callback);
        return () => this._remove(callback, this.exitCallbacks);
    }

    onOffset(callback: (offset: number) => void) {
        this.offsetCallbacks.push(callback);
        return () => this._remove(callback, this.offsetCallbacks);
    }

    onPlaybackRate(callback: (playbackRate: number, echo: boolean) => void) {
        this.playbackRateCallbacks.push(callback);
        return () => this._remove(callback, this.playbackRateCallbacks);
    }

    onPopOutToggle(callback: () => void) {
        this.popOutToggleCallbacks.push(callback);
        return () => this._remove(callback, this.popOutToggleCallbacks);
    }

    onCopy(
        callback: (
            subtitle: SubtitleModel,
            surroundingSubtitles: SubtitleModel[],
            cardTextFieldValues: CardTextFieldValues,
            audio: AudioModel | undefined,
            image: ImageModel | undefined,
            url: string | undefined,
            postMineAction: PostMineAction,
            id: string | undefined,
            mediaTimestamp: number | undefined
        ) => void
    ) {
        this.copyCallbacks.push(callback);
        return () => this._remove(callback, this.copyCallbacks);
    }

    onHideSubtitlePlayerToggle(callback: () => void) {
        this.hideSubtitlePlayerToggleCallbacks.push(callback);
        return () => this._remove(callback, this.hideSubtitlePlayerToggleCallbacks);
    }

    onAppBarToggle(callback: () => void) {
        this.appBarToggleCallbacks.push(callback);
        return () => this._remove(callback, this.appBarToggleCallbacks);
    }

    onAnkiDialogRequest(callback: () => void) {
        this.ankiDialogRequestCallbacks.push(callback);
        return () => this._remove(callback, this.ankiDialogRequestCallbacks);
    }

    onToggleSubtitleTrackInList(callback: (track: number) => void) {
        this.toggleSubtitleTrackInListCallbacks.push(callback);
        return () => this._remove(callback, this.toggleSubtitleTrackInListCallbacks);
    }

    onSubtitlesUpdated(callback: (updatedSubtitles: RichSubtitleModel[]) => void) {
        this.subtitlesUpdatedCallbacks.push(callback);
        return () => this._remove(callback, this.subtitlesUpdatedCallbacks);
    }

    onSaveTokenLocal(
        callback: (
            track: number,
            token: string,
            status: TokenStatus | null,
            states: TokenState[],
            applyStates: ApplyStrategy
        ) => void
    ) {
        this.saveTokenLocalCallbacks.push(callback);
        return () => this._remove(callback, this.saveTokenLocalCallbacks);
    }

    onLoadFiles(callback: () => void) {
        this.loadFilesCallbacks.push(callback);
        return () => this._remove(callback, this.loadFilesCallbacks);
    }

    onPlayModes(callback: (modes: Set<PlayMode>) => void) {
        this.playModesCallbacks.push(callback);
        return () => this._remove(callback, this.playModesCallbacks);
    }

    onCardUpdatedDialog(callback: () => void) {
        this.cardUpdatedDialogCallbacks.push(callback);
        return () => this._remove(callback, this.cardUpdatedDialogCallbacks);
    }

    onCardExportedDialog(callback: () => void) {
        this.cardExportedDialogCallbacks.push(callback);
        return () => this._remove(callback, this.cardExportedDialogCallbacks);
    }

    ready(duration: number, videoFileName?: string) {
        const message: ReadyToVideoMessage = { command: 'ready', duration, videoFileName };
        this.protocol.postMessage(message);
    }

    init() {
        this.protocol.postMessage({ command: 'init' });
    }

    // Return a promise to implement the analogous HTMLMediaElement method
    play(): Promise<void> {
        this.protocol.postMessage({ command: 'play' });
        return new Promise((resolve, reject) => resolve());
    }

    pause() {
        this.protocol.postMessage({ command: 'pause' });
    }

    audioTrackSelected(id: string) {
        const message: AudioTrackSelectedToVideoMessage = { command: 'audioTrackSelected', id: id };
        this.protocol.postMessage(message);
    }

    subtitles(subtitles: SubtitleModel[], subtitleFileNames: string[]) {
        this.protocol.postMessage({
            command: 'subtitles',
            value: subtitles,
            name: subtitleFileNames.length > 0 ? subtitleFileNames[0] : null,
            names: subtitleFileNames,
        } as SubtitlesToVideoMessage);
    }

    saveTokenLocal(token: string, status: TokenStatus, states: TokenState[]) {
        this.protocol.postMessage({
            command: 'saveTokenLocal',
            token,
            status,
            states,
        } as SaveTokenLocalToVideoMessage);
    }

    subtitlesUpdated(subtitles: RichSubtitleModel[]) {
        this.protocol.postMessage({
            command: 'subtitlesUpdated',
            subtitles,
        } as SubtitlesUpdatedToVideoMessage);
    }

    offset(offset: number) {
        const message: OffsetToVideoMessage = { command: 'offset', value: offset };
        this.protocol.postMessage(message);
    }

    subtitleSettings(settings: SubtitleSettings) {
        const {
            subtitleColor,
            subtitleSize,
            subtitleThickness,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleShadowThickness,
            subtitleShadowColor,
            subtitleBackgroundOpacity,
            subtitleBackgroundColor,
            subtitleFontFamily,
            subtitleCustomStyles,
            subtitleBlur,
            imageBasedSubtitleScaleFactor,
            subtitleAlignment,
            subtitleTracksV2,
            subtitlePositionOffset: bottomSubtitlePositionOffset,
            topSubtitlePositionOffset,
            subtitlesWidth,
        } = settings;
        const message: SubtitleSettingsToVideoMessage = {
            command: 'subtitleSettings',
            value: {
                subtitleColor,
                subtitleSize,
                subtitleThickness,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleShadowThickness,
                subtitleShadowColor,
                subtitleBackgroundOpacity,
                subtitleBackgroundColor,
                subtitleFontFamily,
                subtitleCustomStyles,
                subtitleBlur,
                imageBasedSubtitleScaleFactor,
                subtitleAlignment,
                subtitleTracksV2,
                subtitlePositionOffset: bottomSubtitlePositionOffset,
                topSubtitlePositionOffset,
                subtitlesWidth,
            },
        };
        this.protocol.postMessage(message);
    }

    playModes(playModes: Set<PlayMode>) {
        const message: PlayModesMessage = {
            command: 'playModes',
            playModes: [...playModes],
        };
        this.protocol.postMessage(message);
    }

    hideSubtitlePlayerToggle(hidden: boolean) {
        const message: HideSubtitlePlayerToggleToVideoMessage = {
            command: 'hideSubtitlePlayerToggle',
            value: hidden,
        };
        this.protocol.postMessage(message);
    }

    appBarToggle(hidden: boolean) {
        const message: AppBarToggleMessageToVideoMessage = {
            command: 'appBarToggle',
            value: hidden,
        };
        this.protocol.postMessage(message);
    }

    fullscreenToggle(fullscreen: boolean) {
        const message: FullscreenToggleMessageToVideoMessage = {
            command: 'fullscreenToggle',
            value: fullscreen,
        };
        this.protocol.postMessage(message);
    }

    ankiSettings(settings: AnkiSettings) {
        const {
            ankiConnectUrl,
            deck,
            noteType,
            sentenceField,
            definitionField,
            audioField,
            imageField,
            wordField,
            sourceField,
            urlField,
            track1Field,
            track2Field,
            track3Field,
            customAnkiFields,
            tags,
            preferMp3,
            audioPaddingStart,
            audioPaddingEnd,
            maxImageWidth,
            maxImageHeight,
            mediaFragmentFormat,
            mediaFragmentTrimStart,
            mediaFragmentTrimEnd,
            mediaFragmentMaxClipLength,
            surroundingSubtitlesCountRadius,
            surroundingSubtitlesTimeRadius,
            ankiFieldSettings,
            customAnkiFieldSettings,
            recordWithAudioPlayback,
        } = settings;
        const message: AnkiSettingsToVideoMessage = {
            command: 'ankiSettings',
            value: {
                ankiConnectUrl,
                deck,
                noteType,
                sentenceField,
                definitionField,
                audioField,
                imageField,
                wordField,
                sourceField,
                urlField,
                track1Field,
                track2Field,
                track3Field,
                customAnkiFields,
                tags,
                preferMp3,
                audioPaddingStart,
                audioPaddingEnd,
                maxImageWidth,
                maxImageHeight,
                mediaFragmentFormat,
                mediaFragmentTrimStart,
                mediaFragmentTrimEnd,
                mediaFragmentMaxClipLength,
                surroundingSubtitlesCountRadius,
                surroundingSubtitlesTimeRadius,
                ankiFieldSettings,
                customAnkiFieldSettings,
                recordWithAudioPlayback,
            },
        };
        this.protocol.postMessage(message);
    }

    miscSettings(settings: MiscSettings) {
        const {
            themeType,
            videoSubtitleSplitBehavior,
            copyToClipboardOnMine,
            autoPausePreference,
            seekableTracks,
            autoCopyableTracks,
            seekDuration,
            speedChangeStep,
            fastForwardModePlaybackRate,
            keyBindSet,
            rememberSubtitleOffset,
            autoCopyCurrentSubtitle,
            alwaysPlayOnSubtitleRepeat,
            subtitleRegexFilter,
            subtitleRegexFilterTextReplacement,
            subtitleHtml,
            convertNetflixRuby: convertNetflixRuby,
            miningHistoryStorageLimit,
            clickToMineDefaultAction,
            postMiningPlaybackState,
            language,
            lastSubtitleOffset,
            tabName,
            pauseOnHoverMode,
            lastSelectedAnkiExportMode,
        } = settings;
        const message: MiscSettingsToVideoMessage = {
            command: 'miscSettings',
            value: {
                themeType,
                videoSubtitleSplitBehavior,
                copyToClipboardOnMine,
                autoPausePreference,
                seekableTracks,
                autoCopyableTracks,
                seekDuration,
                speedChangeStep,
                fastForwardModePlaybackRate,
                keyBindSet,
                rememberSubtitleOffset,
                autoCopyCurrentSubtitle,
                alwaysPlayOnSubtitleRepeat,
                subtitleRegexFilter,
                subtitleRegexFilterTextReplacement,
                subtitleHtml,
                convertNetflixRuby: convertNetflixRuby,
                miningHistoryStorageLimit,
                clickToMineDefaultAction,
                postMiningPlaybackState,
                language,
                lastSubtitleOffset,
                tabName,
                pauseOnHoverMode,
                lastSelectedAnkiExportMode,
            },
        };
        this.protocol.postMessage(message);
    }

    alert(message: string, severity: string) {
        const msg: AlertMessage = { command: 'alert', message, severity };
        this.protocol.postMessage(msg);
    }

    copy(
        postMineAction: PostMineAction,
        subtitle?: SubtitleModel,
        surroundingSubtitles?: SubtitleModel[],
        cardTextFieldValues?: CardTextFieldValues
    ) {
        const message: CopyToVideoMessage = {
            command: 'copy',
            postMineAction,
            subtitle,
            surroundingSubtitles,
            ...(cardTextFieldValues ?? {}),
        };
        this.protocol.postMessage(message);
    }

    takeScreenshot() {
        const message: TakeScreenshotToVideoPlayerMessage = { command: 'takeScreenshot' };
        this.protocol.postMessage(message);
    }

    close() {
        this.protocol.postMessage({ command: 'close' });
        this.protocol.close();
        this.readyCallbacks = [];
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];
        this.exitCallbacks = [];
        this.offsetCallbacks = [];
        this.playbackRateCallbacks = [];
        this.popOutToggleCallbacks = [];
        this.copyCallbacks = [];
        this.hideSubtitlePlayerToggleCallbacks = [];
        this.appBarToggleCallbacks = [];
        this.ankiDialogRequestCallbacks = [];
        this.toggleSubtitleTrackInListCallbacks = [];
        this.subtitlesUpdatedCallbacks = [];
        this.loadFilesCallbacks = [];
        this.playModesCallbacks = [];
        this.cardUpdatedDialogCallbacks = [];
        this.cardExportedDialogCallbacks = [];
    }

    _remove(callback: Function, callbacks: Function[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
