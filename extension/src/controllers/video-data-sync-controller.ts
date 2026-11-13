import { v4 as uuid } from 'uuid';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { streamSubtitles } from '@project/extension/src/services/progressive-subtitles';
import { pgsParserWorkerFactory } from '@project/extension/src/services/pgs-parser-worker-factory';
import project from '@project/common/project';
import { arrayEquals } from '@project/common/util';
import { asbError, asbTrace } from '@project/common/util/log';
import type {
    ActiveProfileMessage,
    ConfirmedVideoDataSubtitleTrack,
    OpenAsbplayerSettingsMessage,
    LoadableSubtitleTrack,
    SerializedSubtitleFile,
    SettingsUpdatedMessage,
    VideoData,
    VideoDataSubtitleTrack,
    VideoDataUiBridgeConfirmMessage,
    VideoDataUiBridgeOpenFileMessage,
    VideoDataUiBridgeSetGenericSubtitleParserMessage,
    VideoDataUiBridgeSetOnlineSubtitleSourceConfigMessage,
    VideoDataUiModel,
    VideoToExtensionCommand,
} from '@project/common';
import { VideoDataUiOpenReason } from '@project/common';
import type { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { base64ToBlob, bufferToBase64 } from '@project/common/base64';
import type Binding from '@project/extension/src/services/binding';
import { currentPageDelegate } from '@project/extension/src/services/pages';
import type UiFrame from '@project/extension/src/services/ui-frame';
import { uiFrameForHtml } from '@project/extension/src/services/ui-frame';
import { fetchLocalization } from '@project/extension/src/services/localization-fetcher';
import i18n from 'i18next';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import { isOnTutorialPage } from '@/services/tutorial';
import { subtitleFileExtensionForUrl } from '@/pages/util';
import { frameColorSchemeStyleBlock } from '@/services/frame-color-scheme';
import { setGenericSubtitleParserOptionsForHost } from '@/services/generic-subtitle-parser';

declare global {
    function cloneInto(obj: any, targetScope: any, options?: any): any;
}

async function html(lang: string) {
    return `<!DOCTYPE html>
            <html lang="${encodeURIComponent(lang)}">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>${project.names.short} - Video Data Sync</title>
                <style>
                    @import url(${browser.runtime.getURL('/fonts/fonts.css')});
                    ${frameColorSchemeStyleBlock()}
                </style>
            </head>
            <body>
                <div id="root" style="width:100%;height:100dvh;"></div>
                <script type="application/json" id="loc">${JSON.stringify(await fetchLocalization(lang))}</script>
                <script type="module" src="${browser.runtime.getURL('/video-data-sync-ui.js')}"></script>
            </body>
            </html>`;
}

interface ShowOptions {
    reason: VideoDataUiOpenReason;
    fromAsbplayerId?: string;
}

type RequestSubtitlesOptions =
    | { readonly kind: 'reload'; readonly videoChanged: boolean }
    | { readonly kind: 'refresh-open-picker' };

const subtitleParsingSettingsKeys = [
    'subtitleRegexFilter',
    'subtitleRegexFilterTextReplacement',
    'subtitleHtml',
    'convertNetflixRuby',
] as const;

type SubtitleParsingSettings = Pick<AsbplayerSettings, (typeof subtitleParsingSettingsKeys)[number]>;

type SubtitleLoad = {
    controller: AbortController;
    location: string;
    // Kept after EOF so parsing settings can restart the selected URLs without retaining the response text.
    selection?: { tracks: ConfirmedVideoDataSubtitleTrack[]; syncWithAsbplayerId?: string };
};

const fetchDataForLanguageOnDemand = (language: string): Promise<VideoData> => {
    return new Promise((resolve) => {
        const listener = (event: Event) => {
            const data = (event as CustomEvent).detail as VideoData;
            resolve(data);
            document.removeEventListener('asbplayer-synced-language-data', listener, false);
        };
        document.addEventListener('asbplayer-synced-language-data', listener, false);
        document.dispatchEvent(new CustomEvent('asbplayer-get-synced-language-data', { detail: language }));
    });
};

const globalStateProvider = new ExtensionGlobalStateProvider();

export default class VideoDataSyncController {
    private readonly _context: Binding;
    private readonly _domain: string;
    private readonly _frame: UiFrame;
    private readonly _settings: SettingsProvider;

    private _autoSync?: boolean;
    private _lastLanguagesSynced: { [key: string]: string[] };
    private _emptySubtitle: VideoDataSubtitleTrack;
    private _syncedData?: VideoData;
    private _wasPaused?: boolean;
    private _playBlocker?: () => void;
    private _openedLocation?: string;
    private _fullscreenElement?: Element;
    private _activeElement?: Element;
    private _autoSyncAttempted: boolean = false;
    private _refreshingOpenPicker: boolean = false;
    private _dataReceivedListener?: (event: Event) => void;
    private _dataReceivedEventTarget?: EventTarget;
    private _isTutorial: boolean;
    private _subtitleLoad?: SubtitleLoad;
    private _subtitleParsingSettings?: SubtitleParsingSettings;

    constructor(context: Binding, settings: SettingsProvider) {
        this._context = context;
        this._settings = settings;
        this._autoSync = false;
        this._lastLanguagesSynced = {};
        this._emptySubtitle = {
            id: '-',
            language: '-',
            url: '-',
            label: i18n.t('extension.videoDataSync.emptySubtitleTrack'),
            extension: 'srt',
        };
        this._domain = new URL(window.location.href).host;
        this._frame = uiFrameForHtml(html);
        this._isTutorial = isOnTutorialPage();
    }

    private get lastLanguagesSynced(): string[] {
        return this._lastLanguagesSynced[this._domain] ?? [];
    }

    private set lastLanguagesSynced(value: string[]) {
        this._lastLanguagesSynced[this._domain] = value;
    }

    unbind() {
        this.cancelSubtitleLoad({ clearSubtitles: false });
        if (this._dataReceivedListener) {
            this._dataReceivedEventTarget?.removeEventListener(
                'asbplayer-synced-data',
                this._dataReceivedListener,
                false
            );
        }

        this._dataReceivedListener = undefined;
        this._dataReceivedEventTarget = undefined;
        this._syncedData = undefined;
        this._refreshingOpenPicker = false;
        this._cleanupPlayBlocker();
        this._openedLocation = undefined;
        this._frame.unbind();
    }

    updateSettings(settings: AsbplayerSettings) {
        const previous = this._subtitleParsingSettings;
        this._subtitleParsingSettings = settings;
        this._autoSync = settings.streamingAutoSync;
        this._lastLanguagesSynced = settings.streamingLastLanguagesSynced;
        const selection = this._subtitleLoad?.selection;
        if (selection && previous && subtitleParsingSettingsKeys.some((key) => previous[key] !== settings[key])) {
            void this._syncDataArray(selection.tracks, selection.syncWithAsbplayerId);
        }

        if (this._frame.clientIfLoaded !== undefined) {
            void this._context.settings
                .getSingle('themeType')
                .then(async (themeType) => {
                    const [profiles, activeProfile] = await Promise.all([
                        this._context.settings.profiles(),
                        this._context.settings.activeProfile(),
                    ]);
                    this._frame.clientIfLoaded?.updateState({
                        settings: {
                            themeType,
                            profiles,
                            activeProfile: activeProfile?.name,
                        },
                    });
                })
                .catch((error) => asbError('video/sync', 'Failed to update settings in the subtitle picker:', error));
        }
    }

    get pickerVisible(): boolean {
        return !this._frame.hidden;
    }

    get openedLocation(): string | undefined {
        return this._openedLocation;
    }

    async requestSubtitles(request: RequestSubtitlesOptions) {
        if (
            request.kind === 'reload' &&
            (request.videoChanged || (this._subtitleLoad && this._subtitleLoad.location !== window.location.href))
        ) {
            this.cancelSubtitleLoad({ clearSubtitles: false });
        }
        if (!this._context.hasPageScript) {
            return;
        }

        // While the picker is open on the same location, ignore ordinary reloads
        // so player events do not clobber an in-progress user selection. On a true
        // soft-navigation or an explicitly reported video change, dismiss the stale
        // picker and continue.
        if (this.pickerVisible && request.kind === 'reload') {
            const locationChanged = this.openedLocation !== undefined && window.location.href !== this.openedLocation;
            if (locationChanged || request.videoChanged) {
                asbTrace('subtitle/request', 'Closing stale subtitle picker before reloading tracks', {
                    locationChanged,
                    videoChanged: request.videoChanged,
                });
                this._hideAndResume();
            } else {
                return;
            }
        }

        const pageDelegate = await currentPageDelegate();

        if (!pageDelegate.isVideoPage()) {
            return;
        }

        if (request.kind === 'refresh-open-picker') {
            this._refreshingOpenPicker = true;
        } else {
            this._syncedData = undefined;
            this._autoSyncAttempted = false;
            this._refreshingOpenPicker = false;
        }

        const eventTargetIsVideo =
            pageDelegate.config.subtitleDiscoveryRequestTarget === 'video' || pageDelegate.config.generic === true;
        const eventTarget = eventTargetIsVideo ? this._context.video : document;
        if (!this._dataReceivedListener || this._dataReceivedEventTarget !== eventTarget) {
            if (this._dataReceivedListener) {
                this._dataReceivedEventTarget?.removeEventListener(
                    'asbplayer-synced-data',
                    this._dataReceivedListener,
                    false
                );
            }
            this._dataReceivedListener = (event: Event) => {
                const data = (event as CustomEvent).detail as VideoData;
                void this._setSyncedData(data);
            };
            this._dataReceivedEventTarget = eventTarget;
            eventTarget.addEventListener('asbplayer-synced-data', this._dataReceivedListener, false);
        }

        asbTrace('subtitle/request', 'Dispatching site subtitle data request', {
            page: pageDelegate.config.key ?? (pageDelegate.config.generic ? 'generic' : 'unmatched'),
            genericPage: pageDelegate.config.generic === true,
            eventTarget: eventTargetIsVideo ? 'video-element' : 'document',
        });
        if (pageDelegate.config.key === 'youtube') {
            const targetTranslationLanguageCodes =
                (await this._settings.getSingle('streamingPages')).youtube.targetLanguages ?? [];
            let payload = { targetTranslationLanguageCodes };
            if (typeof cloneInto === 'function') {
                payload = cloneInto(payload, document.defaultView);
            }
            document.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { detail: payload }));
        } else {
            eventTarget.dispatchEvent(
                new CustomEvent('asbplayer-get-synced-data', {
                    bubbles: eventTargetIsVideo,
                    composed: eventTargetIsVideo,
                })
            );
        }
    }

    async show({ reason, fromAsbplayerId }: ShowOptions) {
        const client = await this._client();
        const additionalFields: Partial<VideoDataUiModel> = {
            open: true,
            openReason: reason,
        };

        if (fromAsbplayerId !== undefined) {
            additionalFields.openedFromAsbplayerId = fromAsbplayerId;
        }

        const model = await this._buildModel(additionalFields);
        this._prepareShow();
        client.updateState(model);

        const pageDelegate = await currentPageDelegate();
        if (pageDelegate.config.refreshSubtitleDataOnPickerOpen === true) {
            void this.requestSubtitles({ kind: 'refresh-open-picker' });
        }
    }

    private async _buildModel(additionalFields: Partial<VideoDataUiModel>) {
        const subtitleTrackChoices = this._syncedData?.subtitles ?? [];
        const subs = this._matchLastSyncedWithAvailableTracks();
        const autoSelectedTracks: VideoDataSubtitleTrack[] = subs.autoSelectedTracks;
        const autoSelectedTrackIds = this._isTutorial
            ? // '1' is the ID of the non-empty track in the tutorial
              // See asbplayer-tutorial-page.ts
              ['1', '-', '-']
            : autoSelectedTracks.map((subtitle) => subtitle.id || '-');
        const defaultCheckboxState = !this._isTutorial && subs.completeMatch;
        const themeType = await this._context.settings.getSingle('themeType');
        const profilesPromise = this._context.settings.profiles();
        const activeProfilePromise = this._context.settings.activeProfile();
        const globalState = await globalStateProvider.get([
            'ftueHasSeenSubtitleTrackSelector',
            'genericSubtitleParser',
            'onlineSubtitleSourceConfig',
        ]);
        const hasSeenFtue = globalState.ftueHasSeenSubtitleTrackSelector;
        const onlineSubtitleSourceConfig = globalState.onlineSubtitleSourceConfig;
        const pageDelegate = await currentPageDelegate();
        const hideRememberTrackPreferenceToggle =
            this._isTutorial || pageDelegate.config.hideRememberTrackPreferenceToggle === true;
        const isGenericPage = pageDelegate.config.generic === true;
        const showGenericPageOption =
            !this._isTutorial && (isGenericPage || pageDelegate.config.pageScript === undefined);
        const genericSubtitleParser = globalState.genericSubtitleParser.pages[window.location.host]?.parse ?? 'off';
        return this._syncedData
            ? {
                  isLoading: this._syncedData.subtitles === undefined,
                  suggestedName: this._syncedData.basename,
                  selectedSubtitle: autoSelectedTrackIds,
                  subtitles: subtitleTrackChoices,
                  error: this._syncedData.error,
                  defaultCheckboxState: defaultCheckboxState,
                  openedFromAsbplayerId: '',
                  settings: {
                      themeType: themeType,
                      profiles: await profilesPromise,
                      activeProfile: (await activeProfilePromise)?.name,
                  },
                  hasSeenFtue,
                  hideRememberTrackPreferenceToggle,
                  isGenericPage,
                  showGenericPageOption,
                  genericSubtitleParser,
                  onlineSubtitleSourceConfig,
                  ...additionalFields,
              }
            : {
                  isLoading: this._context.hasPageScript,
                  suggestedName: document.title,
                  selectedSubtitle: autoSelectedTrackIds,
                  error: '',
                  subtitles: subtitleTrackChoices,
                  defaultCheckboxState: defaultCheckboxState,
                  openedFromAsbplayerId: '',
                  settings: {
                      themeType: themeType,
                      profiles: await profilesPromise,
                      activeProfile: (await activeProfilePromise)?.name,
                  },
                  hasSeenFtue,
                  hideRememberTrackPreferenceToggle,
                  isGenericPage,
                  showGenericPageOption,
                  genericSubtitleParser,
                  onlineSubtitleSourceConfig,
                  ...additionalFields,
              };
    }

    private _matchLastSyncedWithAvailableTracks() {
        const subtitleTrackChoices = this._syncedData?.subtitles ?? [];
        const tracks = {
            autoSelectedTracks: [this._emptySubtitle, this._emptySubtitle, this._emptySubtitle],
            completeMatch: false,
        };

        const emptyChoice = this.lastLanguagesSynced.some((lang) => lang !== '-') === undefined;

        if (!subtitleTrackChoices.length && emptyChoice) {
            tracks.completeMatch = true;
        } else {
            let matches: number = 0;
            for (let i = 0; i < this.lastLanguagesSynced.length; i++) {
                const language = this.lastLanguagesSynced[i];
                for (let j = 0; j < subtitleTrackChoices.length; j++) {
                    if (language === '-') {
                        matches++;
                        break;
                    } else if (language === subtitleTrackChoices[j].language) {
                        tracks.autoSelectedTracks[i] = subtitleTrackChoices[j];
                        matches++;
                        break;
                    }
                }
            }
            if (matches === this.lastLanguagesSynced.length) {
                tracks.completeMatch = true;
            }
        }

        return tracks;
    }

    private _defaultVideoName(basename: string | undefined, subtitleTrack: VideoDataSubtitleTrack) {
        if (subtitleTrack.url === '-') {
            return basename ?? '';
        }

        if (basename) {
            return `${basename} - ${subtitleTrack.label}`;
        }

        return subtitleTrack.label;
    }

    private async _setSyncedData(data: VideoData) {
        const previousData = this._syncedData;
        this._syncedData = data;

        if (this._updateOpenPickerFromRefresh(previousData, data)) return;

        const wasLoading = previousData?.subtitles === undefined;
        if (await this._handleAutoSync(wasLoading)) return;

        await this._updatePickerAfterDataReceived(wasLoading);
    }

    private _updateOpenPickerFromRefresh(previousData: VideoData | undefined, data: VideoData): boolean {
        if (!this._refreshingOpenPicker || !this.pickerVisible || previousData?.subtitles === undefined) {
            return false;
        }

        const previousSubtitleIds = previousData.subtitles.map((track) => track.id);
        const subtitleIds = data.subtitles?.map((track) => track.id);
        if (!arrayEquals(previousSubtitleIds, subtitleIds)) {
            this._frame.clientIfLoaded?.updateState({
                subtitles: data.subtitles ?? [],
                suggestedName: data.basename,
                error: data.error ?? '',
                isLoading: false,
            });
        }

        return true;
    }

    private async _handleAutoSync(wasLoading: boolean): Promise<boolean> {
        if (this._syncedData?.subtitles === undefined || !(await this._canAutoSync())) return false;
        if (this._autoSyncAttempted) return true;
        this._autoSyncAttempted = true;

        if (this.pickerVisible) {
            if (wasLoading) this._frame.clientIfLoaded?.updateState(await this._buildModel({})); // Picker is open in loading state. Populate it now that tracks have arrived.
            return true;
        }

        const subs = this._matchLastSyncedWithAvailableTracks();
        const shouldPrompt = subs.completeMatch
            ? false
            : await this._settings.getSingle('streamingAutoSyncPromptOnFailure');
        asbTrace('subtitle/sync', 'Evaluated automatic subtitle selection', {
            availableTrackCount: this._syncedData.subtitles.length,
            rememberedLanguageCount: this.lastLanguagesSynced.length,
            completeMatch: subs.completeMatch,
            autoSelectedTrackCount: subs.autoSelectedTracks.length,
            shouldPrompt,
        });

        if (subs.completeMatch) {
            const autoSelectedTracks: VideoDataSubtitleTrack[] = subs.autoSelectedTracks;
            await this._syncData(autoSelectedTracks);
        } else if (shouldPrompt) {
            await this.show({ reason: VideoDataUiOpenReason.failedToAutoLoadPreferredTrack });
        }

        return true;
    }

    private async _updatePickerAfterDataReceived(wasLoading: boolean) {
        if (this.pickerVisible && !wasLoading) return;
        this._frame.clientIfLoaded?.updateState(await this._buildModel({}));
    }

    private async _canAutoSync(): Promise<boolean> {
        const page = await currentPageDelegate();
        return this._autoSync === true && page.canAutoSync(this._context.video);
    }

    private async _client() {
        this._frame.language = await this._settings.getSingle('language');
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage((message) => {
                void (async () => {
                    if ('openSettings' === message.command) {
                        const openSettingsCommand: VideoToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'open-asbplayer-settings',
                            },
                            src: this._context.registeredVideoSrc,
                        };
                        void browser.runtime.sendMessage(openSettingsCommand);
                        return;
                    }

                    if ('activeProfile' === message.command) {
                        const activeProfileMessage = message as ActiveProfileMessage;
                        await this._context.settings.setActiveProfile(activeProfileMessage.profile);
                        const settingsUpdatedCommand: VideoToExtensionCommand<SettingsUpdatedMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'settings-updated',
                            },
                            src: this._context.registeredVideoSrc,
                        };
                        void browser.runtime.sendMessage(settingsUpdatedCommand);
                        return;
                    }

                    if ('dismissFtue' === message.command) {
                        globalStateProvider
                            .set({ ftueHasSeenSubtitleTrackSelector: true })
                            .catch((error) => asbError('video/sync', error));
                        return;
                    }

                    if ('setOnlineSubtitleSourceConfig' === message.command) {
                        const setOnlineSubtitleSourceConfigMessage =
                            message as VideoDataUiBridgeSetOnlineSubtitleSourceConfigMessage;
                        const currentOnlineSubtitleSourceConfig = (
                            await globalStateProvider.get(['onlineSubtitleSourceConfig'])
                        ).onlineSubtitleSourceConfig;

                        await globalStateProvider.set({
                            onlineSubtitleSourceConfig: {
                                ...currentOnlineSubtitleSourceConfig,
                                ...setOnlineSubtitleSourceConfigMessage.state,
                            },
                        });
                        return;
                    }

                    if ('setGenericSubtitleParser' === message.command) {
                        const setGenericSubtitleParserMessage =
                            message as VideoDataUiBridgeSetGenericSubtitleParserMessage;
                        await setGenericSubtitleParserOptionsForHost(
                            globalStateProvider,
                            window.location.host,
                            setGenericSubtitleParserMessage.parse
                        );
                        return;
                    }

                    if ('cancel' === message.command) {
                        this._hideAndResume();
                        return;
                    }

                    let dataWasSynced = true;

                    if ('confirm' === message.command) {
                        const confirmMessage = message as VideoDataUiBridgeConfirmMessage;

                        if (confirmMessage.shouldRememberTrackChoices) {
                            this.lastLanguagesSynced = confirmMessage.data
                                .map((track) => track.language)
                                .filter((language) => language !== undefined);
                            await this._context.settings
                                .set({ streamingLastLanguagesSynced: this._lastLanguagesSynced })
                                .catch((error) => {
                                    asbError('video/sync', 'Failed to save remembered track choices:', error);
                                });
                        }

                        const data = confirmMessage.data;

                        dataWasSynced = await this._syncDataArray(data, confirmMessage.syncWithAsbplayerId);
                    } else if ('openFile' === message.command) {
                        dataWasSynced = false;
                        const load = this._beginSubtitleLoad();
                        const openFileMessage = message as VideoDataUiBridgeOpenFileMessage;
                        const subtitleFiles = openFileMessage.subtitles;

                        try {
                            await this._syncSubtitles(
                                subtitleFiles.map((subtitleFile) => ({ fileParts: [subtitleFile] })),
                                load.controller.signal,
                                undefined
                            );
                            dataWasSynced = true;
                        } catch (e) {
                            if (!load.controller.signal.aborted && e instanceof Error) {
                                await this._reportError(e.message);
                            }
                        } finally {
                            if (this._subtitleLoad === load) this._subtitleLoad = undefined;
                        }
                    }

                    if (dataWasSynced) {
                        this._hideAndResume();
                    }
                })().catch((error) => asbError('video/sync', error));
            });
        }

        this._frame.show();
        return client;
    }

    private _prepareShow() {
        this._openedLocation = window.location.href;
        this._wasPaused = this._wasPaused ?? this._context.video.paused;
        this._context.pause();

        // Some players (e.g. Hulu) call video.play() on an internal timer that
        // ignores the picker being open. Re-pause on any play event until the
        // picker is dismissed.
        if (!this._playBlocker) {
            this._playBlocker = () => {
                this._context.pause();
            };
            this._context.video.addEventListener('play', this._playBlocker);
        }

        if (document.fullscreenElement) {
            this._fullscreenElement = document.fullscreenElement;
            void document.exitFullscreen();
        }

        if (document.activeElement) {
            this._activeElement = document.activeElement;
        }

        this._context.keyBindings.unbind();
        this._context.subtitleController.forceHideSubtitles = true;
        this._context.mobileVideoOverlayController.forceHide = true;
    }

    private _cleanupPlayBlocker() {
        if (this._playBlocker) {
            this._context.video.removeEventListener('play', this._playBlocker);
            this._playBlocker = undefined;
        }
    }

    private _hideAndResume() {
        this._cleanupPlayBlocker();
        this._openedLocation = undefined;
        this._refreshingOpenPicker = false;
        this._context.keyBindings.bind(this._context);
        this._context.subtitleController.forceHideSubtitles = false;
        this._context.mobileVideoOverlayController.forceHide = false;
        this._frame?.hide();

        if (this._fullscreenElement) {
            void this._fullscreenElement.requestFullscreen();
            this._fullscreenElement = undefined;
        }

        if (this._activeElement) {
            if (typeof (this._activeElement as HTMLElement).focus === 'function') {
                (this._activeElement as HTMLElement).focus();
            }

            this._activeElement = undefined;
        } else {
            window.focus();
        }

        if (!this._wasPaused) {
            // This can trigger a loop of pause/play when loading subtitles from subtitle picker
            // while the video is playing due to _playBlocker(). To avoid this, we disable mouseover pause
            // temporarily until the play() promise resolves. This became an issue with the addition of
            // PlaybackEngine which moved away from setIntervals() for playback semantics which exposed the core issue.
            const enablePauseOnHover = this._context.disablePauseOnHover();
            void this._context
                .play()
                .finally(enablePauseOnHover)
                .catch((error) => asbError('video/sync', 'Failed to resume playback after subtitle selection:', error));
        }

        this._wasPaused = undefined;
    }

    cancelSubtitleLoad({ clearSubtitles }: { clearSubtitles: boolean }) {
        const load = this._subtitleLoad;
        load?.controller.abort();
        this._subtitleLoad = undefined;
        if (clearSubtitles && load?.selection) {
            this._context.updateSubtitleSource({ type: 'snapshot', tracks: [] });
        }
    }

    private _beginSubtitleLoad(): SubtitleLoad {
        // A replacement discards the previous progressive transcript even if the new selection fails.
        this.cancelSubtitleLoad({ clearSubtitles: true });
        const load = { controller: new AbortController(), location: window.location.href };
        this._subtitleLoad = load;
        return load;
    }

    private _syncData(data: VideoDataSubtitleTrack[]) {
        return this._syncDataArray(
            data.map((track) => ({
                ...track,
                name: this._defaultVideoName(this._syncedData?.basename, track),
            }))
        );
    }

    private async _syncDataArray(data: ConfirmedVideoDataSubtitleTrack[], syncWithAsbplayerId?: string) {
        const load = this._beginSubtitleLoad();
        const { signal } = load.controller;
        const progressive = data.some((track) => track.progressive);
        try {
            const tracks: LoadableSubtitleTrack<SerializedSubtitleFile>[] = [];
            for (const track of data) {
                const { name, language, extension, url, file } = track;
                const fileParts = track.progressive
                    ? []
                    : await this._subtitleFilePartsForUrl(name, language, extension, url!, file !== undefined, signal);
                signal.throwIfAborted();
                if (fileParts === undefined) return false;
                tracks.push({ fileParts });
            }
            if (progressive) {
                await this._startProgressiveSubtitles(data, tracks, load, syncWithAsbplayerId);
            } else {
                await this._syncSubtitles(tracks, signal, syncWithAsbplayerId);
            }
            return true;
        } catch (error) {
            if (signal.aborted) return false;
            load.controller.abort();
            if (typeof (error as Error).message !== 'undefined') {
                await this._reportError(`Data Sync failed: ${(error as Error).message}`);
            }
            return false;
        } finally {
            if ((!progressive || signal.aborted) && this._subtitleLoad === load) this._subtitleLoad = undefined;
        }
    }

    private async _startProgressiveSubtitles(
        selected: ConfirmedVideoDataSubtitleTrack[],
        serializedTracks: LoadableSubtitleTrack<SerializedSubtitleFile>[],
        load: SubtitleLoad,
        syncWithAsbplayerId?: string
    ) {
        const { signal } = load.controller;
        const settings = await this._settings.getAll();
        signal.throwIfAborted();
        this._subtitleParsingSettings ??= settings;
        const parsingSettings = this._subtitleParsingSettings;
        const reader = new SubtitleReader({
            regexFilter: parsingSettings.subtitleRegexFilter,
            regexFilterTextReplacement: parsingSettings.subtitleRegexFilterTextReplacement,
            subtitleHtml: parsingSettings.subtitleHtml,
            convertNetflixRuby: parsingSettings.convertNetflixRuby,
            pgsParserWorkerFactory,
        });
        const pending = selected.flatMap((selection, track) => {
            if (!selection.progressive) return [];
            if (typeof selection.url !== 'string') throw new Error('Invalid progressive subtitle URL');
            return [
                {
                    track,
                    loadId: uuid(),
                    name: `${selection.name}.${selection.extension}`,
                    url: selection.url,
                    extension: selection.extension,
                },
            ];
        });
        const tracks = serializedTracks.map(({ fileParts }) => ({
            fileParts: fileParts.map((file) => new File([base64ToBlob(file.base64, 'text/plain')], file.name)),
        }));
        load.selection = { tracks: selected, syncWithAsbplayerId };
        await this._context.loadProgressiveSubtitles(tracks, pending, signal, syncWithAsbplayerId);
        signal.throwIfAborted();
        // The picker closes while the selected responses continue loading in the background.
        for (const { track, loadId, url, extension } of pending) {
            void streamSubtitles(url, extension, reader, { track, loadId }, signal, (update) =>
                this._context.updateSubtitleSource(update)
            ).catch((error) => {
                if (!signal.aborted) {
                    asbError('subtitle/progressive', 'Progressive subtitle response failed', error);
                }
            });
        }
    }

    /**
     * Decodes and loads selected tracks, preserving group order and empty slots.
     * Each group's fileParts belong to one track, not separate tracks.
     */
    private async _syncSubtitles(
        serializedTracks: LoadableSubtitleTrack<SerializedSubtitleFile>[],
        signal: AbortSignal,
        syncWithAsbplayerId: string | undefined
    ) {
        const tracks = await Promise.all(
            serializedTracks.map(async ({ fileParts }) => ({
                fileParts: await Promise.all(
                    fileParts.map(
                        async (serializedSourceFile) =>
                            new File(
                                [base64ToBlob(serializedSourceFile.base64, 'text/plain')],
                                serializedSourceFile.name
                            )
                    )
                ),
            }))
        );
        const subtitleSourceFiles = tracks.flatMap((track) => track.fileParts);
        const startedAt = performance.now();
        const fileCount = subtitleSourceFiles.length;
        const totalBytes = subtitleSourceFiles.reduce((sum, subtitleSourceFile) => sum + subtitleSourceFile.size, 0);
        const trackFileDetails = tracks.map(({ fileParts }, track) => ({
            track,
            fileCount: fileParts.length,
            fileNames: Array.from(new Set(fileParts.map((subtitleSourceFile) => subtitleSourceFile.name))),
        }));
        try {
            signal.throwIfAborted();
            await this._context.loadSubtitles(tracks, { signal, syncWithAsbplayerId });
            asbTrace('subtitle/sync', 'Loaded retrieved subtitle files', {
                fileCount,
                totalBytes,
                trackCount: tracks.length,
                tracks: trackFileDetails,
                durationMs: performance.now() - startedAt,
            });
        } catch (error) {
            asbError('subtitle/error', 'Failed to load retrieved subtitle files', {
                fileCount,
                totalBytes,
                trackCount: tracks.length,
                tracks: trackFileDetails,
                durationMs: performance.now() - startedAt,
                errorName: error instanceof Error ? error.name : typeof error,
            });
            throw error;
        }
    }

    /** Retrieves one selected track: one complete file or multiple fragments. */
    private async _subtitleFilePartsForUrl(
        name: string,
        language: string | undefined,
        extension: string,
        url: string | string[],
        isLocalSubtitleFile: boolean | undefined,
        signal: AbortSignal
    ): Promise<SerializedSubtitleFile[] | undefined> {
        const startedAt = performance.now();
        if (url === '-') {
            return [
                {
                    name: `${name}.${extension}`,
                    base64: '',
                },
            ];
        }

        if (url === 'lazy') {
            if (language === undefined) {
                await this._reportError('Unable to determine language');
                return undefined;
            }

            const data = await fetchDataForLanguageOnDemand(language);

            if (data.error) {
                await this._reportError(data.error);
                return undefined;
            }

            const lazilyFetchedUrl = data.subtitles?.find((t) => t.language === language)?.url;

            if (lazilyFetchedUrl === undefined) {
                await this._reportError('Failed to fetch subtitles for specified language');
                return undefined;
            }

            url = lazilyFetchedUrl;
        }

        if (typeof url === 'string') {
            const sourceKind = isLocalSubtitleFile
                ? 'local-object-url'
                : url.startsWith('data:')
                  ? 'inline-data'
                  : 'remote';
            const response = await fetch(url, { signal })
                .catch(async (error) => {
                    asbTrace('subtitle/error', 'Subtitle retrieval request failed', {
                        extension,
                        sourceKind,
                        durationMs: performance.now() - startedAt,
                        errorName: error instanceof Error ? error.name : typeof error,
                    });
                    if (!signal.aborted) await this._reportError(error.message);
                    return undefined;
                })
                .finally(() => {
                    if (isLocalSubtitleFile) {
                        URL.revokeObjectURL(url);
                    }
                });

            if (!response) {
                return undefined;
            }

            if (!response.ok) {
                asbError('subtitle/error', 'Subtitle retrieval returned an unsuccessful status', {
                    extension,
                    sourceKind,
                    status: response.status,
                    durationMs: performance.now() - startedAt,
                });
                throw new Error(`Subtitle Retrieval failed with Status ${response.status}/${response.statusText}...`);
            }

            return [
                {
                    name: `${name}.${extension}`,
                    base64: response ? bufferToBase64(await response.arrayBuffer()) : '',
                },
            ];
        }

        // `url` is an array

        const firstUri = url[0];
        const partExtension = subtitleFileExtensionForUrl(firstUri, extension);
        const filePartName = `${name}.${partExtension}`;
        const partCount = url.length;
        const promises = url.map((u) => fetch(u, { signal }));
        const fileParts = [];
        const responseStatusCounts: Record<string, number> = {};
        let finishedPromises = 0;
        let responseBytes = 0;

        try {
            for (const p of promises) {
                const response = await p;
                responseStatusCounts[response.status] = (responseStatusCounts[response.status] ?? 0) + 1;

                if (!response.ok) {
                    throw new Error(
                        `Subtitle Retrieval failed with Status ${response.status}/${response.statusText}...`
                    );
                }

                ++finishedPromises;
                this._context.subtitleController.notification({
                    text: `${filePartName} (${Math.floor((finishedPromises / partCount) * 100)}%)`,
                });

                const body = await response.arrayBuffer();
                responseBytes += body.byteLength;
                fileParts.push({
                    name: filePartName,
                    base64: bufferToBase64(body),
                });
            }
        } catch (error) {
            asbError('subtitle/error', 'Segmented subtitle retrieval failed', {
                extension: partExtension,
                partCount,
                completedPartCount: finishedPromises,
                responseStatusCounts,
                responseBytes,
                durationMs: performance.now() - startedAt,
                errorName: error instanceof Error ? error.name : typeof error,
            });
            throw error;
        }

        asbTrace('subtitle/fetch', 'Finished segmented subtitle retrieval', {
            extension: partExtension,
            partCount,
            responseStatusCounts,
            responseBytes,
            durationMs: performance.now() - startedAt,
        });
        return fileParts;
    }

    private async _reportError(error: string) {
        const client = await this._client();
        const themeType = await this._context.settings.getSingle('themeType');

        this._prepareShow();

        return client.updateState({
            open: true,
            isLoading: false,
            error,
            themeType: themeType,
        });
    }
}
