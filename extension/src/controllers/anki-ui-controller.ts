import {
    ActiveProfileMessage,
    AnkiDialogSettings,
    AnkiDialogSettingsMessage,
    AnkiUiBridgeExportedMessage,
    AnkiUiBridgeRerecordMessage,
    AnkiUiBridgeResumeMessage,
    AnkiUiBridgeRewindMessage,
    AnkiUiInitialState,
    AnkiUiResumeState,
    AnkiUiSavedState,
    CardExportedDialogMessage,
    CardUpdatedDialogMessage,
    CopyToClipboardMessage,
    EncodeMp3InServiceWorkerMessage,
    EncodeMp3Message,
    OpenAsbplayerSettingsMessage,
    PostMinePlayback,
    SettingsUpdatedMessage,
    ShowAnkiUiMessage,
    VideoToExtensionCommand,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { sourceString } from '@project/common/util';
import Binding from '../services/binding';
import { fetchLocalization } from '../services/localization-fetcher';
import UiFrame, { uiFrameForHtml } from '../services/ui-frame';
import { ExtensionGlobalStateProvider } from '../services/extension-global-state-provider';
import { isOnTutorialPage } from '@/services/tutorial';

// We need to write the HTML into the iframe manually so that the iframe keeps it's about:blank URL.
// Otherwise, Chrome won't insert content scripts into the iframe (e.g. Yomichan won't work).
async function html(language: string) {
    return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>asbplayer - Anki</title>
                    <style>
                        @import url(${browser.runtime.getURL('/fonts/fonts.css')});
                    </style>
                </head>
                <body>
                    <div id="root" style="width:100%;height:100vh;"></div>
                    <script type="application/json" id="loc">${JSON.stringify(
                        await fetchLocalization(language)
                    )}</script>
                    <script type="module" src="${browser.runtime.getURL('/anki-ui.js')}"></script>
                </body>
            </html>`;
}

const globalStateProvider = new ExtensionGlobalStateProvider();

export default class AnkiUiController {
    private readonly frame: UiFrame;

    private fullscreenElement?: Element;
    private activeElement?: Element;
    private focusInListener?: (event: FocusEvent) => void;
    private _settings?: AnkiDialogSettings;
    private _inTutorial: boolean;

    constructor() {
        this.frame = uiFrameForHtml(html);
        this._inTutorial = isOnTutorialPage();
    }

    get settings() {
        return this._settings;
    }

    updateSettings(settings: AnkiDialogSettings, settingsProvider: SettingsProvider) {
        this._settings = settings;

        if (this.frame?.bound) {
            this.frame.client().then(async (client) => {
                const profilesPromise = settingsProvider.profiles();
                const activeProfilePromise = settingsProvider.activeProfile();
                const message: AnkiDialogSettingsMessage = {
                    command: 'settings',
                    settings,
                    profiles: await profilesPromise,
                    activeProfile: (await activeProfilePromise)?.name,
                };
                client.sendMessage(message);
            });
        }
    }

    get showing() {
        return !this.frame.hidden;
    }

    async show(
        context: Binding,
        { subtitle, surroundingSubtitles, image, audio, text, definition, word, customFieldValues }: ShowAnkiUiMessage
    ) {
        if (!this._settings) {
            throw new Error('Unable to show Anki UI because settings are missing.');
        }

        this._prepareShow(context);
        const client = await this._client(context);
        const url = context.url(subtitle.start, subtitle.end);

        const state: AnkiUiInitialState = {
            type: 'initial',
            open: true,
            canRerecord: true,
            settings: this._settings,
            source: sourceString(context.subtitleFileName(), subtitle.start),
            url: url,
            subtitle: subtitle,
            surroundingSubtitles: surroundingSubtitles,
            image: image,
            audio: audio,
            dialogRequestedTimestamp: context.video.currentTime * 1000,
            text,
            word,
            definition,
            customFieldValues,
            inTutorial: this._inTutorial,
            ...(await this._additionalUiState(context)),
        };
        client.updateState(state);
    }

    async showAfterRerecord(context: Binding, uiState: AnkiUiSavedState) {
        if (!this._settings) {
            throw new Error('Unable to show Anki UI after rerecording because anki settings are undefined');
        }

        this._prepareShow(context);
        const client = await this._client(context);
        const state: AnkiUiResumeState = {
            ...uiState,
            type: 'resume',
            open: true,
            canRerecord: true,
            settings: this._settings,
            dialogRequestedTimestamp: context.video.currentTime * 1000,
            inTutorial: this._inTutorial,
            ...(await this._additionalUiState(context)),
        };
        client.updateState(state);
    }

    async showAfterRetakingScreenshot(context: Binding, uiState: AnkiUiSavedState) {
        if (!this._settings) {
            throw new Error('Unable to show Anki UI after retaking screenshot because anki settings are undefined');
        }

        this._prepareShow(context);
        const client = await this._client(context);
        const state: AnkiUiResumeState = {
            ...uiState,
            type: 'resume',
            open: true,
            canRerecord: true,
            settings: this._settings,
            inTutorial: this._inTutorial,
            ...(await this._additionalUiState(context)),
        };
        client.updateState(state);
    }

    async requestRewind(context: Binding) {
        const client = await this._client(context);
        client.sendMessage({ command: 'rewind' });
    }

    private _prepareShow(context: Binding) {
        context.pause();

        if (document.activeElement) {
            this.activeElement = document.activeElement;
        }

        if (document.fullscreenElement) {
            this.fullscreenElement = document.fullscreenElement;
            document.exitFullscreen();
        }

        context.keyBindings.unbind();
        context.subtitleController.forceHideSubtitles = true;
        context.mobileVideoOverlayController.forceHide = true;
    }

    private async _client(context: Binding) {
        this.frame.fetchOptions = {
            videoSrc: context.video.src,
            allowedFetchUrl: this._settings!.ankiConnectUrl,
        };
        this.frame.language = await context.settings.getSingle('language');
        const isNewClient = await this.frame.bind();
        const client = await this.frame.client();

        if (isNewClient) {
            this.focusInListener = (event: FocusEvent) => {
                if (this.frame === undefined || this.frame.hidden) {
                    return;
                }

                // Refocus Anki UI to workaround sites like Netflix that automatically
                // take focus away when hiding video controls
                client.sendMessage({ command: 'focus' });
            };
            window.addEventListener('focusin', this.focusInListener);

            client.onMessage(async (message) => {
                switch (message.command) {
                    case 'openSettings':
                        const openSettingsCommand: VideoToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'open-asbplayer-settings',
                                tutorial: this._inTutorial,
                            },
                            src: context.video.src,
                        };
                        browser.runtime.sendMessage(openSettingsCommand);
                        return;
                    case 'copy-to-clipboard':
                        const copyToClipboardMessage = message as CopyToClipboardMessage;
                        const copyToClipboardCommand: VideoToExtensionCommand<CopyToClipboardMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'copy-to-clipboard',
                                dataUrl: copyToClipboardMessage.dataUrl,
                            },
                            src: context.video.src,
                        };
                        browser.runtime.sendMessage(copyToClipboardCommand);
                        return;
                    case 'encode-mp3':
                        const { base64, messageId, extension } = message as EncodeMp3Message;
                        const encodeMp3Command: VideoToExtensionCommand<EncodeMp3InServiceWorkerMessage> = {
                            sender: 'asbplayer-video',
                            message: {
                                command: 'encode-mp3',
                                base64,
                                extension,
                            },
                            src: context.video.src,
                        };
                        const encodedBase64 = await browser.runtime.sendMessage(encodeMp3Command);
                        client.sendMessage({
                            messageId,
                            base64: encodedBase64,
                        });
                        return;
                    case 'activeProfile':
                        const activeProfileMessage = message as ActiveProfileMessage;
                        context.settings.setActiveProfile(activeProfileMessage.profile).then(() => {
                            const settingsUpdatedCommand: VideoToExtensionCommand<SettingsUpdatedMessage> = {
                                sender: 'asbplayer-video',
                                message: {
                                    command: 'settings-updated',
                                },
                                src: context.video.src,
                            };
                            browser.runtime.sendMessage(settingsUpdatedCommand);
                        });
                        return;
                    case 'dismissedQuickSelectFtue':
                        globalStateProvider.set({ ftueHasSeenAnkiDialogQuickSelectV2: true }).catch(console.error);
                        return;
                    case 'exported':
                        const exportedMessage = message as AnkiUiBridgeExportedMessage;
                        context.settings.set({ lastSelectedAnkiExportMode: exportedMessage.mode }).then(() => {
                            const settingsUpdatedCommand: VideoToExtensionCommand<SettingsUpdatedMessage> = {
                                sender: 'asbplayer-video',
                                message: {
                                    command: 'settings-updated',
                                },
                                src: context.video.src,
                            };
                            browser.runtime.sendMessage(settingsUpdatedCommand);
                        });
                        return;
                    case 'card-updated-dialog':
                        const cardUpdatedDialogCommand: VideoToExtensionCommand<CardUpdatedDialogMessage> = {
                            sender: 'asbplayer-video',
                            message: message as CardUpdatedDialogMessage,
                            src: context.video.src,
                        };
                        browser.runtime.sendMessage(cardUpdatedDialogCommand);
                        return;
                    case 'card-exported-dialog':
                        const cardExportedDialogCommand: VideoToExtensionCommand<CardExportedDialogMessage> = {
                            sender: 'asbplayer-video',
                            message: message as CardExportedDialogMessage,
                            src: context.video.src,
                        };
                        browser.runtime.sendMessage(cardExportedDialogCommand);
                        return;
                }

                context.keyBindings.bind(context);
                context.subtitleController.forceHideSubtitles = false;
                context.mobileVideoOverlayController.forceHide = false;
                this.frame?.hide();

                if (this.fullscreenElement) {
                    this.fullscreenElement.requestFullscreen();
                    this.fullscreenElement = undefined;
                }

                if (this.activeElement) {
                    const activeHtmlElement = this.activeElement as HTMLElement;

                    if (typeof activeHtmlElement.focus === 'function') {
                        activeHtmlElement.focus();
                    }

                    this.activeElement = undefined;
                } else {
                    window.focus();
                }

                switch (message.command) {
                    case 'resume':
                        const resumeMessage = message as AnkiUiBridgeResumeMessage;
                        context.ankiUiSavedState = resumeMessage.uiState;

                        if (resumeMessage.cardExported && resumeMessage.uiState.dialogRequestedTimestamp !== 0) {
                            const seekTo = resumeMessage.uiState.dialogRequestedTimestamp / 1000;

                            if (context.video.currentTime !== seekTo) {
                                context.seek(seekTo);
                            }
                        }

                        switch (context.postMinePlayback) {
                            case PostMinePlayback.remember:
                                if (context.wasPlayingBeforeRecordingMedia) {
                                    context.play();
                                }
                                break;
                            case PostMinePlayback.play:
                                context.play();
                                break;
                            case PostMinePlayback.pause:
                                // already paused, don't need to do anything
                                break;
                        }
                        break;
                    case 'rewind':
                        const rewindMessage = message as AnkiUiBridgeRewindMessage;
                        context.ankiUiSavedState = rewindMessage.uiState;
                        context.pause();
                        context.seek(rewindMessage.uiState.subtitle.start / 1000);
                        break;
                    case 'rerecord':
                        const rerecordMessage = message as AnkiUiBridgeRerecordMessage;
                        context.rerecord(
                            rerecordMessage.recordStart,
                            rerecordMessage.recordEnd,
                            rerecordMessage.uiState
                        );
                        break;
                    default:
                        console.error('Unknown message received from bridge: ' + message.command);
                }
            });
        }

        this.frame.show();
        return client;
    }

    private async _additionalUiState(context: Binding) {
        const profilesPromise = context.settings.profiles();
        const activeProfilePromise = context.settings.activeProfile();
        const globalStatePromise = globalStateProvider.getAll();
        return {
            profiles: await profilesPromise,
            activeProfile: (await activeProfilePromise)?.name,
            ftueHasSeenAnkiDialogQuickSelect: (await globalStatePromise).ftueHasSeenAnkiDialogQuickSelectV2,
        };
    }

    unbind() {
        this.frame.unbind();

        if (this.focusInListener) {
            window.removeEventListener('focusin', this.focusInListener);
            this.focusInListener = undefined;
        }
    }
}
