import {
    ActiveProfileMessage,
    ConfirmedVideoDataSubtitleTrack,
    OpenAsbplayerSettingsMessage,
    SerializedSubtitleFile,
    SettingsUpdatedMessage,
    VideoData,
    VideoDataSubtitleTrack,
    VideoDataUiBridgeConfirmMessage,
    VideoDataUiBridgeOpenFileMessage,
    VideoDataUiBridgeSetOnlineSubtitleSourceConfigMessage,
    VideoDataUiModel,
    VideoDataUiOpenReason,
    VideoToExtensionCommand,
} from '@project/common';
import { AsbplayerSettings, SettingsProvider } from '@project/common/settings';
import { base64ToBlob, bufferToBase64 } from '@project/common/base64';
import Binding from '../services/binding';
import { currentPageDelegate } from '../services/pages';
import UiFrame, { uiFrameForHtml } from '../services/ui-frame';
import { fetchLocalization } from '../services/localization-fetcher';
import i18n from 'i18next';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import { isOnTutorialPage } from '@/services/tutorial';
import { extractExtension } from '@/pages/util';

declare global {
    function cloneInto(obj: any, targetScope: any, options?: any): any;
}

async function html(lang: string) {
    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>asbplayer - Video Data Sync</title>
                <style>
                    @import url(${browser.runtime.getURL('/fonts/fonts.css')});
                </style>
            </head>
            <body>
                <div id="root" style="width:100%;height:100vh;"></div>
                <script type="application/json" id="loc">${JSON.stringify(await fetchLocalization(lang))}</script>
                <script type="module" src="${browser.runtime.getURL('/video-data-sync-ui.js')}"></script>
            </body>
            </html>`;
}

interface ShowOptions {
    reason: VideoDataUiOpenReason;
    fromAsbplayerId?: string;
}

const fetchDataForLanguageOnDemand = (language: string): Promise<VideoData> => {
    return new Promise((resolve, reject) => {
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
    private _fullscreenElement?: Element;
    private _activeElement?: Element;
    private _autoSyncAttempted: boolean = false;
    private _dataReceivedListener?: (event: Event) => void;
    private _isTutorial: boolean;

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
        if (this._dataReceivedListener) {
            document.removeEventListener('asbplayer-synced-data', this._dataReceivedListener, false);
        }

        this._dataReceivedListener = undefined;
        this._syncedData = undefined;
    }

    updateSettings({ streamingAutoSync, streamingLastLanguagesSynced }: AsbplayerSettings) {
        this._autoSync = streamingAutoSync;
        this._lastLanguagesSynced = streamingLastLanguagesSynced;

        if (this._frame.clientIfLoaded !== undefined) {
            this._context.settings.getSingle('themeType').then((themeType) => {
                const profilesPromise = this._context.settings.profiles();
                const activeProfilePromise = this._context.settings.activeProfile();
                Promise.all([profilesPromise, activeProfilePromise]).then(([profiles, activeProfile]) => {
                    this._frame.clientIfLoaded?.updateState({
                        settings: {
                            themeType,
                            profiles,
                            activeProfile: activeProfile?.name,
                        },
                    });
                });
            });
        }
    }

    async requestSubtitles() {
        if (!this._context.hasPageScript) {
            return;
        }

        const pageDelegate = await currentPageDelegate();

        if (!pageDelegate?.isVideoPage()) {
            return;
        }

        this._syncedData = undefined;
        this._autoSyncAttempted = false;

        if (!this._dataReceivedListener) {
            this._dataReceivedListener = (event: Event) => {
                const data = (event as CustomEvent).detail as VideoData;
                this._setSyncedData(data);
            };
            document.addEventListener('asbplayer-synced-data', this._dataReceivedListener, false);
        }

        if (pageDelegate.config.key === 'youtube') {
            const targetTranslationLanguageCodes =
                (await this._settings.getSingle('streamingPages')).youtube.targetLanguages ?? [];
            let payload = { targetTranslationLanguageCodes };
            if (typeof cloneInto === 'function') {
                payload = cloneInto(payload, document.defaultView);
            }
            document.dispatchEvent(new CustomEvent('asbplayer-get-synced-data', { detail: payload }));
        } else {
            document.dispatchEvent(new CustomEvent('asbplayer-get-synced-data'));
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
            'onlineSubtitleSourceConfig',
        ]);
        const hasSeenFtue = globalState.ftueHasSeenSubtitleTrackSelector;
        const onlineSubtitleSourceConfig = globalState.onlineSubtitleSourceConfig;
        const hideRememberTrackPreferenceToggle = this._isTutorial || (await this._pageHidesTrackPrefToggle());
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
                  onlineSubtitleSourceConfig,
                  ...additionalFields,
              }
            : {
                  isLoading: this._context.hasPageScript,
                  suggestedName: document.title,
                  selectedSubtitle: autoSelectedTrackIds,
                  error: '',
                  showSubSelect: true,
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
                  onlineSubtitleSourceConfig,
                  ...additionalFields,
              };
    }

    private _matchLastSyncedWithAvailableTracks() {
        const subtitleTrackChoices = this._syncedData?.subtitles ?? [];
        let tracks = {
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
        this._syncedData = data;

        if (this._syncedData?.subtitles !== undefined && (await this._canAutoSync())) {
            if (!this._autoSyncAttempted) {
                this._autoSyncAttempted = true;
                const subs = this._matchLastSyncedWithAvailableTracks();

                if (subs.completeMatch) {
                    const autoSelectedTracks: VideoDataSubtitleTrack[] = subs.autoSelectedTracks;
                    await this._syncData(autoSelectedTracks);

                    if (!this._frame.hidden) {
                        this._hideAndResume();
                    }
                } else {
                    const shouldPrompt = await this._settings.getSingle('streamingAutoSyncPromptOnFailure');

                    if (shouldPrompt) {
                        await this.show({ reason: VideoDataUiOpenReason.failedToAutoLoadPreferredTrack });
                    }
                }
            }
        } else if (this._frame.clientIfLoaded !== undefined) {
            this._frame.clientIfLoaded.updateState(await this._buildModel({}));
        }
    }

    private async _canAutoSync(): Promise<boolean> {
        const page = await currentPageDelegate();

        if (page === undefined) {
            return this._autoSync ?? false;
        }

        return this._autoSync === true && page.canAutoSync(this._context.video);
    }

    private async _pageHidesTrackPrefToggle() {
        return (await currentPageDelegate())?.config?.hideRememberTrackPreferenceToggle ?? false;
    }

    private async _client() {
        this._frame.language = await this._settings.getSingle('language');
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage(async (message) => {
                if ('openSettings' === message.command) {
                    const openSettingsCommand: VideoToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                        sender: 'asbplayer-video',
                        message: {
                            command: 'open-asbplayer-settings',
                        },
                        src: this._context.video.src,
                    };
                    browser.runtime.sendMessage(openSettingsCommand);
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
                        src: this._context.video.src,
                    };
                    browser.runtime.sendMessage(settingsUpdatedCommand);
                    return;
                }

                if ('dismissFtue' === message.command) {
                    globalStateProvider.set({ ftueHasSeenSubtitleTrackSelector: true }).catch(console.error);
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

                let dataWasSynced = true;

                if ('confirm' === message.command) {
                    const confirmMessage = message as VideoDataUiBridgeConfirmMessage;

                    if (confirmMessage.shouldRememberTrackChoices) {
                        this.lastLanguagesSynced = confirmMessage.data
                            .map((track) => track.language)
                            .filter((language) => language !== undefined) as string[];
                        await this._context.settings
                            .set({ streamingLastLanguagesSynced: this._lastLanguagesSynced })
                            .catch(() => {});
                    }

                    const data = confirmMessage.data as ConfirmedVideoDataSubtitleTrack[];

                    dataWasSynced = await this._syncDataArray(data, confirmMessage.syncWithAsbplayerId);
                } else if ('openFile' === message.command) {
                    const openFileMessage = message as VideoDataUiBridgeOpenFileMessage;
                    const subtitles = openFileMessage.subtitles as SerializedSubtitleFile[];

                    try {
                        await this._syncSubtitles(subtitles, false);
                        dataWasSynced = true;
                    } catch (e) {
                        if (e instanceof Error) {
                            await this._reportError(e.message);
                        }
                    }
                }

                if (dataWasSynced) {
                    this._hideAndResume();
                }
            });
        }

        this._frame.show();
        return client;
    }

    private _prepareShow() {
        this._wasPaused = this._wasPaused ?? this._context.video.paused;
        this._context.pause();

        if (document.fullscreenElement) {
            this._fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        if (document.activeElement) {
            this._activeElement = document.activeElement;
        }

        this._context.keyBindings.unbind();
        this._context.subtitleController.forceHideSubtitles = true;
        this._context.mobileVideoOverlayController.forceHide = true;
    }

    private _hideAndResume() {
        this._context.keyBindings.bind(this._context);
        this._context.subtitleController.forceHideSubtitles = false;
        this._context.mobileVideoOverlayController.forceHide = false;
        this._frame?.hide();

        if (this._fullscreenElement) {
            this._fullscreenElement.requestFullscreen();
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
            this._context.play();
        }

        this._wasPaused = undefined;
    }

    private async _syncData(data: VideoDataSubtitleTrack[]) {
        try {
            let subtitles: SerializedSubtitleFile[] = [];

            for (let i = 0; i < data.length; i++) {
                const { extension, url, language, localFile } = data[i];
                const subtitleFiles = await this._subtitlesForUrl(
                    this._defaultVideoName(this._syncedData?.basename, data[i]),
                    language,
                    extension,
                    url,
                    localFile
                );
                if (subtitleFiles !== undefined) {
                    subtitles.push(...subtitleFiles);
                }
            }

            await this._syncSubtitles(
                subtitles,
                data.some((track) => typeof track.url === 'object')
            );
            return true;
        } catch (error) {
            if (typeof (error as Error).message !== 'undefined') {
                await this._reportError(`Data Sync failed: ${(error as Error).message}`);
            }

            return false;
        }
    }

    private async _syncDataArray(data: ConfirmedVideoDataSubtitleTrack[], syncWithAsbplayerId?: string) {
        try {
            let subtitles: SerializedSubtitleFile[] = [];

            for (let i = 0; i < data.length; i++) {
                const { name, language, extension, url, localFile } = data[i];
                const subtitleFiles = await this._subtitlesForUrl(name, language, extension, url, localFile);
                if (subtitleFiles !== undefined) {
                    subtitles.push(...subtitleFiles);
                }
            }

            await this._syncSubtitles(
                subtitles,
                data.some((track) => typeof track.url === 'object'),
                syncWithAsbplayerId
            );
            return true;
        } catch (error) {
            if (typeof (error as Error).message !== 'undefined') {
                await this._reportError(`Data Sync failed: ${(error as Error).message}`);
            }

            return false;
        }
    }

    private async _syncSubtitles(
        serializedFiles: SerializedSubtitleFile[],
        flatten: boolean,
        syncWithAsbplayerId?: string
    ) {
        const files: File[] = await Promise.all(
            serializedFiles.map(async (f) => new File([base64ToBlob(f.base64, 'text/plain')], f.name))
        );
        this._context.loadSubtitles(files, flatten, syncWithAsbplayerId);
    }

    private async _subtitlesForUrl(
        name: string,
        language: string | undefined,
        extension: string,
        url: string | string[],
        localFile: boolean | undefined
    ): Promise<SerializedSubtitleFile[] | undefined> {
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
            const response = await fetch(url)
                .catch((error) => this._reportError(error.message))
                .finally(() => {
                    if (localFile) {
                        URL.revokeObjectURL(url);
                    }
                });

            if (!response) {
                return undefined;
            }

            if (!response.ok) {
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
        const partExtension = extractExtension(firstUri, extension);
        const fileName = `${name}.${partExtension}`;
        const promises = url.map((u) => fetch(u));
        const tracks = [];
        let totalPromises = promises.length;
        let finishedPromises = 0;

        for (const p of promises) {
            const response = await p;

            if (!response.ok) {
                throw new Error(`Subtitle Retrieval failed with Status ${response.status}/${response.statusText}...`);
            }

            ++finishedPromises;
            this._context.subtitleController.notification(
                `${fileName} (${Math.floor((finishedPromises / totalPromises) * 100)}%)`
            );

            tracks.push({
                name: fileName,
                base64: bufferToBase64(await response.arrayBuffer()),
            });
        }

        return tracks;
    }

    private async _reportError(error: string) {
        const client = await this._client();
        const themeType = await this._context.settings.getSingle('themeType');

        this._prepareShow();

        return client.updateState({
            open: true,
            isLoading: false,
            showSubSelect: true,
            error,
            themeType: themeType,
        });
    }
}
