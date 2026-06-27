import {
    AnkiUiInitialState,
    OpenAsbplayerSettingsMessage,
    CopyToClipboardMessage,
    TabToExtensionCommand,
    CardModel,
    EncodeMp3Message,
    AnkiDialogSettingsMessage,
    ActiveProfileMessage,
    SettingsUpdatedMessage,
    AnkiUiBridgeExportedMessage,
    EncodeMp3InServiceWorkerMessage,
    CardUpdatedDialogMessage,
    CardExportedDialogMessage,
} from '@project/common';
import { AnkiSettings, SettingsProvider, ankiSettingsKeys } from '@project/common/settings';
import { sourceString } from '@project/common/util';
import UiFrame, { uiFrameForHtml } from '../services/ui-frame';
import { fetchLocalization } from '../services/localization-fetcher';
import { ExtensionGlobalStateProvider } from '../services/extension-global-state-provider';
import { isOnTutorialPage } from '@/services/tutorial';

const globalStateProvider = new ExtensionGlobalStateProvider();

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

export class TabAnkiUiController {
    private readonly _frame: UiFrame;
    private readonly _settings: SettingsProvider;
    private readonly _inTutorial = isOnTutorialPage();

    constructor(settings: SettingsProvider) {
        this._frame = uiFrameForHtml(html);
        this._settings = settings;
    }

    async show(card: CardModel) {
        const { language, ...ankiDialogSettings } = await this._settings.get([
            'language',
            'themeType',
            'lastSelectedAnkiExportMode',
            ...ankiSettingsKeys,
        ]);
        const profilesPromise = this._settings.profiles();
        const activeProfilePromise = this._settings.activeProfile();
        const globalStatePromise = globalStateProvider.getAll();
        const client = await this._client(language, ankiDialogSettings);
        const state: AnkiUiInitialState = {
            type: 'initial',
            open: true,
            canRerecord: false,
            settings: ankiDialogSettings,
            source: sourceString(card.subtitleFileName, card.mediaTimestamp ?? 0),
            dialogRequestedTimestamp: 0,
            ...card,
            profiles: await profilesPromise,
            activeProfile: (await activeProfilePromise)?.name,
            ftueHasSeenAnkiDialogQuickSelect: (await globalStatePromise).ftueHasSeenAnkiDialogQuickSelectV2,
            inTutorial: this._inTutorial,
        };
        client.updateState(state);
    }

    async updateSettings() {
        const ankiDialogSettings = await this._settings.get([
            'themeType',
            'lastSelectedAnkiExportMode',
            ...ankiSettingsKeys,
        ]);

        if (this._frame.bound) {
            this._frame.client().then(async (client) => {
                const profilesPromise = this._settings.profiles();
                const activeProfilePromise = this._settings.activeProfile();
                const message: AnkiDialogSettingsMessage = {
                    command: 'settings',
                    settings: ankiDialogSettings,
                    profiles: await profilesPromise,
                    activeProfile: (await activeProfilePromise)?.name,
                };
                client.sendMessage(message);
            });
        }
    }

    private async _client(language: string, ankiSettings: AnkiSettings) {
        this._frame.fetchOptions = {
            allowedFetchUrl: ankiSettings.ankiConnectUrl,
        };
        this._frame.language = language;
        const isNewClient = await this._frame.bind();
        const client = await this._frame.client();

        if (isNewClient) {
            client.onMessage(async (message) => {
                switch (message.command) {
                    case 'openSettings':
                        const openSettingsCommand: TabToExtensionCommand<OpenAsbplayerSettingsMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: {
                                command: 'open-asbplayer-settings',
                            },
                        };
                        browser.runtime.sendMessage(openSettingsCommand);
                        return;
                    case 'copy-to-clipboard':
                        const copyToClipboardMessage = message as CopyToClipboardMessage;
                        const copyToClipboardCommand: TabToExtensionCommand<CopyToClipboardMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: {
                                command: 'copy-to-clipboard',
                                dataUrl: copyToClipboardMessage.dataUrl,
                            },
                        };
                        browser.runtime.sendMessage(copyToClipboardCommand);
                        return;
                    case 'encode-mp3':
                        const { base64, messageId, extension } = message as EncodeMp3Message;
                        const encodeMp3Command: TabToExtensionCommand<EncodeMp3InServiceWorkerMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: {
                                command: 'encode-mp3',
                                base64,
                                extension,
                            },
                        };
                        const encodedBase64 = await browser.runtime.sendMessage(encodeMp3Command);
                        client.sendMessage({
                            messageId,
                            base64: encodedBase64,
                        });
                        return;
                    case 'resume':
                        this._frame.hide();
                        return;
                    case 'activeProfile':
                        const activeProfileMessage = message as ActiveProfileMessage;
                        this._settings.setActiveProfile(activeProfileMessage.profile).then(() => {
                            const settingsUpdatedCommand: TabToExtensionCommand<SettingsUpdatedMessage> = {
                                sender: 'asbplayer-video-tab',
                                message: {
                                    command: 'settings-updated',
                                },
                            };
                            browser.runtime.sendMessage(settingsUpdatedCommand);
                        });
                        return;
                    case 'dismissedQuickSelectFtue':
                        globalStateProvider.set({ ftueHasSeenAnkiDialogQuickSelectV2: true }).catch(console.error);
                        return;
                    case 'exported':
                        const exportedMessage = message as AnkiUiBridgeExportedMessage;
                        this._settings.set({ lastSelectedAnkiExportMode: exportedMessage.mode }).then(() => {
                            const settingsUpdatedCommand: TabToExtensionCommand<SettingsUpdatedMessage> = {
                                sender: 'asbplayer-video-tab',
                                message: {
                                    command: 'settings-updated',
                                },
                            };
                            browser.runtime.sendMessage(settingsUpdatedCommand);
                        });
                        return;
                    case 'card-updated-dialog':
                        const cardUpdatedDialogCommand: TabToExtensionCommand<CardUpdatedDialogMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: message as CardUpdatedDialogMessage,
                        };
                        browser.runtime.sendMessage(cardUpdatedDialogCommand);
                        return;
                    case 'card-exported-dialog':
                        const cardExportedDialogCommand: TabToExtensionCommand<CardExportedDialogMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: message as CardExportedDialogMessage,
                        };
                        browser.runtime.sendMessage(cardExportedDialogCommand);
                        return;
                }
            });
        }

        this._frame.show();
        return client;
    }

    unbind() {
        this._frame.unbind();
    }
}
