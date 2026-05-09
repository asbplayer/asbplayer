import {
    AlertMessage,
    AnkiSettingsToVideoMessage,
    AppBarToggleMessageToVideoMessage,
    AudioTrackModel,
    AudioTrackSelectedFromVideoMessage,
    AudioTrackSelectedToVideoMessage,
    CardTextFieldValues,
    RichSubtitleModel,
    CopyMessage,
    CopyToVideoMessage,
    CurrentTimeToVideoMessage,
    FullscreenToggleMessageToVideoMessage,
    HideSubtitlePlayerToggleToVideoMessage,
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
    SubtitlesUpdatedFromVideoMessage,
    ToggleSubtitleTrackInListFromVideoMessage,
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

export default class PlayerChannel {
    private channel?: BroadcastChannel;
    private readyCallbacks: ((duration: number, videoFileName?: string) => void)[];
    private playCallbacks: (() => void)[];
    private pauseCallbacks: (() => void)[];
    private currentTimeCallbacks: ((currentTime: number) => void)[];
    private audioTrackSelectedCallbacks: ((id: string) => void)[];
    private closeCallbacks: (() => void)[];
    private subtitlesCallbacks: ((subtitles: SubtitleModel[], subtitleFileName: string) => void)[];
    private subtitlesUpdatedCallbacks: ((updatedSubtitles: RichSubtitleModel[]) => void)[];
    private saveTokenLocalCallbacks: ((
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ) => void)[];
    private offsetCallbacks: ((offset: number) => void)[];
    private playbackRateCallbacks: ((playbackRate: number) => void)[];
    private playModesCallbacks: ((playModes: Set<PlayMode>) => void)[];
    private hideSubtitlePlayerToggleCallbacks: ((hidden: boolean) => void)[];
    private appBarToggleCallbacks: ((hidden: boolean) => void)[];
    private fullscreenToggleCallbacks: ((hidden: boolean) => void)[];
    private subtitleSettingsCallbacks: ((subtitleSettings: SubtitleSettings) => void)[];
    private miscSettingsCallbacks: ((miscSettings: MiscSettings) => void)[];
    private ankiSettingsCallbacks: ((ankiSettings: AnkiSettings) => void)[];
    private alertCallbacks: ((message: string, severity: string) => void)[];
    private copyCallbacks: ((
        postMineAction: PostMineAction,
        subtitle?: SubtitleModel,
        surroundingSubtitles?: SubtitleModel[],
        cardTextFieldValues?: CardTextFieldValues
    ) => void)[];

    constructor(channel: string) {
        this.channel = new BroadcastChannel(channel);
        this.playCallbacks = [];
        this.pauseCallbacks = [];
        this.currentTimeCallbacks = [];
        this.audioTrackSelectedCallbacks = [];
        this.closeCallbacks = [];
        this.readyCallbacks = [];
        this.subtitlesCallbacks = [];
        this.subtitlesUpdatedCallbacks = [];
        this.saveTokenLocalCallbacks = [];
        this.offsetCallbacks = [];
        this.playbackRateCallbacks = [];
        this.playModesCallbacks = [];
        this.hideSubtitlePlayerToggleCallbacks = [];
        this.appBarToggleCallbacks = [];
        this.fullscreenToggleCallbacks = [];
        this.subtitleSettingsCallbacks = [];
        this.miscSettingsCallbacks = [];
        this.ankiSettingsCallbacks = [];
        this.alertCallbacks = [];
        this.copyCallbacks = [];

        const that = this;

        this.channel.onmessage = (event) => {
            switch (event.data.command) {
                case 'init':
                    // ignore, this is for the chrome extension
                    break;
                case 'ready':
                    const readyMessage = event.data as ReadyToVideoMessage;

                    for (let callback of that.readyCallbacks) {
                        callback(readyMessage.duration, readyMessage.videoFileName);
                    }
                    break;
                case 'play':
                    for (let callback of that.playCallbacks) {
                        callback();
                    }
                    break;
                case 'pause':
                    for (let callback of that.pauseCallbacks) {
                        callback();
                    }
                    break;
                case 'currentTime':
                    const currentTimeMessage = event.data as CurrentTimeToVideoMessage;

                    for (let callback of that.currentTimeCallbacks) {
                        callback(currentTimeMessage.value);
                    }
                    break;
                case 'audioTrackSelected':
                    const audioTrackSelectedMessage = event.data as AudioTrackSelectedToVideoMessage;

                    for (let callback of that.audioTrackSelectedCallbacks) {
                        callback(audioTrackSelectedMessage.id);
                    }
                    break;
                case 'close':
                    for (let callback of that.closeCallbacks) {
                        callback();
                    }
                    break;
                case 'subtitles':
                    const subtitlesMessage = event.data as SubtitlesToVideoMessage;

                    for (let callback of that.subtitlesCallbacks) {
                        callback(
                            subtitlesMessage.value,
                            subtitlesMessage.names.length > 0 ? subtitlesMessage.names[0] : ''
                        );
                    }
                    break;
                case 'subtitlesUpdated':
                    const subtitlesUpdatedMessage = event.data as SubtitlesUpdatedToVideoMessage;

                    for (let callback of that.subtitlesUpdatedCallbacks) {
                        callback(subtitlesUpdatedMessage.subtitles);
                    }
                    break;
                case 'saveTokenLocal':
                    const { track, token, status, states, applyStates } = event.data as SaveTokenLocalToVideoMessage;

                    for (const callback of that.saveTokenLocalCallbacks) {
                        callback(track, token, status, states, applyStates);
                    }
                    break;
                case 'offset':
                    const offsetMessage = event.data as OffsetToVideoMessage;

                    for (const callback of that.offsetCallbacks) {
                        callback(offsetMessage.value);
                    }
                    break;
                case 'playbackRate':
                    const playbackRateMessage = event.data as PlaybackRateToVideoMessage;

                    for (const callback of that.playbackRateCallbacks) {
                        callback(playbackRateMessage.value);
                    }
                    break;
                case 'subtitleSettings':
                    const subtitleSettingsMessage = event.data as SubtitleSettingsToVideoMessage;

                    for (let callback of that.subtitleSettingsCallbacks) {
                        callback(subtitleSettingsMessage.value);
                    }
                    break;
                case 'playModes':
                    const playModesMessage = event.data as PlayModesMessage;

                    for (let callback of that.playModesCallbacks) {
                        const modes = new Set<PlayMode>(playModesMessage.playModes);
                        callback(modes);
                    }
                    break;
                case 'hideSubtitlePlayerToggle':
                    const hideSubtitlePlayerToggleMessage = event.data as HideSubtitlePlayerToggleToVideoMessage;

                    for (let callback of that.hideSubtitlePlayerToggleCallbacks) {
                        callback(hideSubtitlePlayerToggleMessage.value);
                    }
                    break;
                case 'appBarToggle':
                    const appBarToggleMessage = event.data as AppBarToggleMessageToVideoMessage;

                    for (let callback of that.appBarToggleCallbacks) {
                        callback(appBarToggleMessage.value);
                    }
                    break;
                case 'fullscreenToggle':
                    const fullscreenToggleMessage = event.data as FullscreenToggleMessageToVideoMessage;

                    for (const callback of that.fullscreenToggleCallbacks) {
                        callback(fullscreenToggleMessage.value);
                    }
                    break;
                case 'ankiSettings':
                    const ankiSettingsMessage = event.data as AnkiSettingsToVideoMessage;

                    for (let callback of that.ankiSettingsCallbacks) {
                        callback(ankiSettingsMessage.value);
                    }
                    break;
                case 'miscSettings':
                    const miscSettingsMessage = event.data as MiscSettingsToVideoMessage;

                    for (let callback of that.miscSettingsCallbacks) {
                        callback(miscSettingsMessage.value);
                    }
                    break;
                case 'alert':
                    const alertMessage = event.data as AlertMessage;

                    for (const callback of that.alertCallbacks) {
                        callback(alertMessage.message, alertMessage.severity);
                    }
                    break;
                case 'copy':
                    const copyMessage = event.data as CopyToVideoMessage;

                    for (const callback of that.copyCallbacks) {
                        const { text, word, definition, customFieldValues } = copyMessage;
                        const cardTextFieldValues = { text, word, definition, customFieldValues };
                        callback(
                            copyMessage.postMineAction,
                            copyMessage.subtitle,
                            copyMessage.surroundingSubtitles,
                            cardTextFieldValues
                        );
                    }
                    break;
                default:
                    console.error('Unrecognized event ' + event.data.command);
            }
        };
    }

    currentTime(value: number, echo = true) {
        this.channel?.postMessage({ command: 'currentTime', value: value, echo });
    }

    onPlay(callback: () => void) {
        this.playCallbacks.push(callback);
        return () => this._remove(callback, this.playCallbacks);
    }

    onPause(callback: () => void) {
        this.pauseCallbacks.push(callback);
        return () => this._remove(callback, this.pauseCallbacks);
    }

    onCurrentTime(callback: (currentTime: number) => void) {
        this.currentTimeCallbacks.push(callback);
        return () => this._remove(callback, this.currentTimeCallbacks);
    }

    onAudioTrackSelected(callback: (id: string) => void) {
        this.audioTrackSelectedCallbacks.push(callback);
        return () => this._remove(callback, this.audioTrackSelectedCallbacks);
    }

    onClose(callback: () => void) {
        this.closeCallbacks.push(callback);
        return () => this._remove(callback, this.closeCallbacks);
    }

    onReady(callback: (duration: number, videoFileName?: string) => void) {
        this.readyCallbacks.push(callback);
        return () => this._remove(callback, this.readyCallbacks);
    }

    onSubtitles(callback: (subtitles: SubtitleModel[], subtitleFileName: string) => void) {
        this.subtitlesCallbacks.push(callback);
        return () => this._remove(callback, this.subtitlesCallbacks);
    }

    onSubtitlesUpdated(callback: (updatedSubtitles: RichSubtitleModel[]) => void) {
        this.subtitlesUpdatedCallbacks.push(callback);
        return () => this._remove(callback, this.subtitlesUpdatedCallbacks);
    }

    onSaveTokenLocal(
        callback: (track: number, token: string, status: TokenStatus | null, states: TokenState[]) => void
    ) {
        this.saveTokenLocalCallbacks.push(callback);
        return () => this._remove(callback, this.saveTokenLocalCallbacks);
    }

    onOffset(callback: (offset: number) => void) {
        this.offsetCallbacks.push(callback);
        return () => this._remove(callback, this.offsetCallbacks);
    }

    onPlaybackRate(callback: (playbackRate: number) => void) {
        this.playbackRateCallbacks.push(callback);
        return () => this._remove(callback, this.playbackRateCallbacks);
    }

    onPlayModes(callback: (playModes: Set<PlayMode>) => void) {
        this.playModesCallbacks.push(callback);
        return () => this._remove(callback, this.playModesCallbacks);
    }

    onHideSubtitlePlayerToggle(callback: (hidden: boolean) => void) {
        this.hideSubtitlePlayerToggleCallbacks.push(callback);
        return () => this._remove(callback, this.hideSubtitlePlayerToggleCallbacks);
    }

    onAppBarToggle(callback: (hidden: boolean) => void) {
        this.appBarToggleCallbacks.push(callback);
        return () => this._remove(callback, this.appBarToggleCallbacks);
    }

    onFullscreenToggle(callback: (fullscreen: boolean) => void) {
        this.fullscreenToggleCallbacks.push(callback);
        return () => this._remove(callback, this.fullscreenToggleCallbacks);
    }

    onSubtitleSettings(callback: (subtitleSettings: SubtitleSettings) => void) {
        this.subtitleSettingsCallbacks.push(callback);
        return () => this._remove(callback, this.subtitleSettingsCallbacks);
    }

    onMiscSettings(callback: (miscSettings: MiscSettings) => void) {
        this.miscSettingsCallbacks.push(callback);
        return () => this._remove(callback, this.miscSettingsCallbacks);
    }

    onAnkiSettings(callback: (ankiSettings: AnkiSettings) => void) {
        this.ankiSettingsCallbacks.push(callback);
        return () => this._remove(callback, this.ankiSettingsCallbacks);
    }

    onAlert(callback: (message: string, severity: string) => void) {
        this.alertCallbacks.push(callback);
        return () => this._remove(callback, this.alertCallbacks);
    }

    onCopy(
        callback: (
            postMineAction: PostMineAction,
            subtitle?: SubtitleModel,
            surroundingSubtitles?: SubtitleModel[],
            cardTextFieldValues?: CardTextFieldValues
        ) => void
    ) {
        this.copyCallbacks.push(callback);
        return () => this._remove(callback, this.copyCallbacks);
    }

    ready(
        duration: number,
        paused: boolean,
        playbackRate: number,
        audioTracks: AudioTrackModel[] | undefined,
        selectedAudioTrack: string | undefined
    ) {
        const message: ReadyFromVideoMessage = {
            command: 'ready',
            duration: duration,
            paused: paused,
            currentTime: 0,
            audioTracks: audioTracks,
            selectedAudioTrack: selectedAudioTrack,
            playbackRate: playbackRate,
        };

        this.channel?.postMessage(message);
    }

    readyState(readyState: number) {
        const message: ReadyStateFromVideoMessage = { command: 'readyState', value: readyState };
        this.channel?.postMessage(message);
    }

    play(echo = true) {
        const message: PlayFromVideoMessage = { command: 'play', echo };
        this.channel?.postMessage(message);
    }

    pause(echo = true) {
        const message: PauseFromVideoMessage = { command: 'pause', echo };
        this.channel?.postMessage(message);
    }

    audioTrackSelected(id: string) {
        const message: AudioTrackSelectedFromVideoMessage = { command: 'audioTrackSelected', id: id };
        this.channel?.postMessage(message);
    }

    offset(offset: number) {
        const message: OffsetFromVideoMessage = { command: 'offset', value: offset };
        this.channel?.postMessage(message);
    }

    playbackRate(playbackRate: number, echo = true) {
        const message: PlaybackRateFromVideoMessage = { command: 'playbackRate', value: playbackRate, echo };
        this.channel?.postMessage(message);
    }

    saveTokenLocal(
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ) {
        const message: SaveTokenLocalFromVideoMessage = {
            command: 'saveTokenLocal',
            track,
            token,
            status,
            states,
            applyStates,
        };
        this.channel?.postMessage(message);
    }

    popOutToggle() {
        this.channel?.postMessage({ command: 'popOutToggle' });
    }

    copy(
        subtitle: SubtitleModel,
        surroundingSubtitles: SubtitleModel[],
        cardTextFieldValues: CardTextFieldValues,
        subtitleFileName: string,
        mediaTimestamp: number,
        postMineAction: PostMineAction
    ) {
        const message: CopyMessage = {
            command: 'copy',
            subtitle,
            surroundingSubtitles,
            ...cardTextFieldValues,
            subtitleFileName,
            postMineAction,
            mediaTimestamp,
        };

        this.channel?.postMessage(message);
    }

    playModes(playModes: Set<PlayMode>) {
        this.channel?.postMessage({ command: 'playModes', playModes: Array.from(playModes) });
    }

    hideSubtitlePlayerToggle() {
        this.channel?.postMessage({ command: 'hideSubtitlePlayerToggle' });
    }

    appBarToggle() {
        this.channel?.postMessage({ command: 'appBarToggle' });
    }

    toggleSubtitleTrackInList(track: number) {
        const message: ToggleSubtitleTrackInListFromVideoMessage = {
            command: 'toggleSubtitleTrackInList',
            track: track,
        };
        this.channel?.postMessage(message);
    }

    subtitlesUpdated(updatedSubtitles: RichSubtitleModel[]) {
        const message: SubtitlesUpdatedFromVideoMessage = {
            command: 'subtitlesUpdated',
            updatedSubtitles,
        };
        this.channel?.postMessage(message);
    }

    loadFiles() {
        this.channel?.postMessage({ command: 'loadFiles' });
    }

    close() {
        if (this.channel) {
            this.channel.postMessage({ command: 'exit' });
            this.channel.close();
            this.channel = undefined;
            this.playCallbacks = [];
            this.pauseCallbacks = [];
            this.currentTimeCallbacks = [];
            this.audioTrackSelectedCallbacks = [];
            this.closeCallbacks = [];
            this.readyCallbacks = [];
            this.subtitlesCallbacks = [];
            this.subtitlesUpdatedCallbacks = [];
            this.offsetCallbacks = [];
            this.playbackRateCallbacks = [];
            this.playModesCallbacks = [];
            this.hideSubtitlePlayerToggleCallbacks = [];
            this.appBarToggleCallbacks = [];
            this.fullscreenToggleCallbacks = [];
            this.subtitleSettingsCallbacks = [];
            this.miscSettingsCallbacks = [];
            this.ankiSettingsCallbacks = [];
            this.alertCallbacks = [];
            this.copyCallbacks = [];
        }
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
