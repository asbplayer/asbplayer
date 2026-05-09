import TabRegistry, { Asbplayer } from '@/services/tab-registry';
import ImageCapturer from '@/services/image-capturer';
import VideoHeartbeatHandler from '@/handlers/video/video-heartbeat-handler';
import RecordMediaHandler from '@/handlers/video/record-media-handler';
import RerecordMediaHandler from '@/handlers/video/rerecord-media-handler';
import StartRecordingMediaHandler from '@/handlers/video/start-recording-media-handler';
import StopRecordingMediaHandler from '@/handlers/video/stop-recording-media-handler';
import ToggleSubtitlesHandler from '@/handlers/video/toggle-subtitles-handler';
import SyncHandler from '@/handlers/video/sync-handler';
import HttpPostHandler from '@/handlers/video/http-post-handler';
import VideoToAsbplayerCommandForwardingHandler from '@/handlers/video/video-to-asbplayer-command-forwarding-handler';
import AsbplayerToVideoCommandForwardingHandler from '@/handlers/asbplayer/asbplayer-to-video-command-forwarding-handler';
import AsbplayerV2ToVideoCommandForwardingHandler from '@/handlers/asbplayerv2/asbplayer-v2-to-video-command-forwarding-handler';
import AsbplayerHeartbeatHandler from '@/handlers/asbplayerv2/asbplayer-heartbeat-handler';
import RefreshSettingsHandler from '@/handlers/popup/refresh-settings-handler';
import { CommandHandler } from '@/handlers/command-handler';
import TakeScreenshotHandler from '@/handlers/video/take-screenshot-handler';
import AudioRecorderService from '@/services/audio-recorder-service';
import AudioBase64Handler from '@/handlers/offscreen-document/audio-base-64-handler';
import AckTabsHandler from '@/handlers/asbplayerv2/ack-tabs-handler';
import OpenExtensionShortcutsHandler from '@/handlers/asbplayerv2/open-extension-shortcuts-handler';
import ExtensionCommandsHandler from '@/handlers/asbplayerv2/extension-commands-handler';
import OpenAsbplayerSettingsHandler from '@/handlers/video/open-asbplayer-settings-handler';
import CaptureVisibleTabHandler from '@/handlers/foreground/capture-visible-tab-handler';
import CopyToClipboardHandler from '@/handlers/video/copy-to-clipboard-handler';
import SettingsUpdatedHandler from '@/handlers/asbplayerv2/settings-updated-handler';
import {
    Command,
    CopySubtitleMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
    PostMineAction,
    TakeScreenshotMessage,
    ToggleRecordingMessage,
    ToggleVideoSelectMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { fetchSupportedLanguages, primeLocalization } from '@/services/localization-fetcher';
import VideoDisappearedHandler from '@/handlers/video/video-disappeared-handler';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import LoadSubtitlesHandler from '@/handlers/asbplayerv2/load-subtitles-handler';
import ToggleSidePanelHandler from '@/handlers/video/toggle-side-panel-handler';
import CopySubtitleHandler from '@/handlers/asbplayerv2/copy-subtitle-handler';
import { RequestingActiveTabPermissionHandler } from '@/handlers/video/requesting-active-tab-permission';
import { CardPublisher } from '@/services/card-publisher';
import CardUpdatedDialogHandler from '@/handlers/asbplayerv2/card-updated-dialog-handler';
import CardExportedDialogHandler from '@/handlers/asbplayerv2/card-exported-dialog-handler';
import AckMessageHandler from '@/handlers/video/ack-message-handler';
import PublishCardHandler from '@/handlers/asbplayerv2/publish-card-handler';
import BulkExportCancellationHandler from '@/handlers/asbplayerv2/bulk-export-cancellation-handler';
import BulkExportStartedHandler from '@/handlers/asbplayerv2/bulk-export-started-handler';
import { bindWebSocketClient, unbindWebSocketClient } from '@/services/web-socket-client-binding';
import { isFirefoxBuild } from '@/services/build-flags';
import { CaptureStreamAudioRecorder, OffscreenAudioRecorder } from '@/services/audio-recorder-delegate';
import RequestModelHandler from '@/handlers/mobile-overlay/request-model-handler';
import CurrentTabHandler from '@/handlers/current-tab-handler';
import UpdateMobileOverlayModelHandler from '@/handlers/video/update-mobile-overlay-model-handler';
import { isMobile } from '@project/common/device-detection/mobile';
import { enqueueUpdateAlert } from '@/services/update-alert';
import RequestSubtitlesHandler from '@/handlers/asbplayerv2/request-subtitles-handler';
import RequestCurrentSubtitleHandler from '@/handlers/asbplayerv2/request-current-subtitle-handler';
import MobileOverlayForwarderHandler from '@/handlers/mobile-overlay/mobile-overlay-forwarder-handler';
import RequestCopyHistoryHandler from '@/handlers/asbplayerv2/request-copy-history-handler';
import DeleteCopyHistoryHandler from '@/handlers/asbplayerv2/delete-copy-history-handler';
import ClearCopyHistoryHandler from '@/handlers/asbplayerv2/clear-copy-history-handler';
import SaveCopyHistoryHandler from '@/handlers/asbplayerv2/save-copy-history-handler';
import PageConfigHandler from '@/handlers/asbplayerv2/page-config-handler';
import EncodeMp3Handler from '@/handlers/video/encode-mp3-handler';
import { DictionaryDB } from '@project/common/dictionary-db/dictionary-db';
import DictionaryHandler from '@/handlers/dictionary/dictionary-handler';
import SaveTokenLocalHandler from '@/handlers/asbplayerv2/save-token-local-handler';
import { ExtensionGlobalStateProvider } from '@/services/extension-global-state-provider';
import { lt as semverLt } from 'semver';
import { AnnotationTutorialState } from '@project/common/global-state';
import BrowserFeaturesHandler from '@/handlers/asbplayerv2/browser-features-handler';
import OpenStatisticsHandler from '@/handlers/video/open-statistics-handler';
import StatisticsOverlayForwarderHandler from '@/handlers/statistics-overlay/statistics-overlay-forwarder-handler';
import OpenStatisticsOverlayHandler from '@/handlers/open-statistics-overlay-handler';

export default defineBackground(() => {
    if (!isFirefoxBuild) {
        browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    }

    const settings = new SettingsProvider(new ExtensionSettingsStorage());

    const startListener = async () => {
        primeLocalization(await settings.getSingle('language'));
    };

    const globalStateProvider = new ExtensionGlobalStateProvider();

    const updateBadgeForAnnotationTutorial = () => {
        browser.action.setBadgeText({ text: '!' });
        browser.storage.local.onChanged.addListener((changes) => {
            // Hide the "!" badge when the user views the annotation tutorial
            for (const [key, { newValue }] of Object.entries(changes)) {
                if (key === 'ftueAnnotation' && newValue !== AnnotationTutorialState.shouldSee) {
                    browser.action.setBadgeText({ text: '' });
                }
            }
        });
    };

    globalStateProvider.get(['ftueAnnotation']).then((s) => {
        if (s.ftueAnnotation === AnnotationTutorialState.shouldSee) {
            updateBadgeForAnnotationTutorial();
        }
    });

    const installListener = async (details: Browser.runtime.InstalledDetails) => {
        if (details.reason === browser.runtime.OnInstalledReason.UPDATE) {
            primeLocalization(await settings.getSingle('language'));

            // Existing users who upgrade to 1.14.0 should see the annotation tutorial
            if (details.previousVersion !== undefined && semverLt(details.previousVersion, '1.14.0')) {
                const annotationTutorialState = (await globalStateProvider.get(['ftueAnnotation'])).ftueAnnotation;
                if (annotationTutorialState === AnnotationTutorialState.hasNotSeen) {
                    await globalStateProvider.set({ ftueAnnotation: AnnotationTutorialState.shouldSee });
                    updateBadgeForAnnotationTutorial();
                }
            }
            return;
        }

        if (details.reason === browser.runtime.OnInstalledReason.INSTALL) {
            // Remove subtag e.g. "en-US" is converted to "en"
            const defaultUiLanguage = browser.i18n.getUILanguage().split('-')[0];
            const supportedLanguages = await fetchSupportedLanguages();

            if (supportedLanguages.includes(defaultUiLanguage)) {
                await settings.set({ language: defaultUiLanguage });
            }

            await primeLocalization(await settings.getSingle('language'));

            if (isMobile) {
                // Set reasonable defaults for mobile
                await settings.set({
                    streamingTakeScreenshot: false, // Kiwi Browser does not support captureVisibleTab
                    subtitleSize: 18,
                    subtitlePositionOffset: 25,
                    topSubtitlePositionOffset: 25,
                    subtitlesWidth: 100,
                });
            }

            browser.tabs.create({ url: browser.runtime.getURL('/ftue-ui.html'), active: true });
        }
    };

    const updateListener = async (details: Browser.runtime.InstalledDetails) => {
        if (details.reason !== browser.runtime.OnInstalledReason.UPDATE) {
            return;
        }

        enqueueUpdateAlert();
    };

    browser.runtime.onInstalled.addListener(installListener);
    browser.runtime.onInstalled.addListener(updateListener);
    browser.runtime.onStartup.addListener(startListener);

    const tabRegistry = new TabRegistry(settings);
    const audioRecorder = new AudioRecorderService(
        tabRegistry,
        isFirefoxBuild ? new CaptureStreamAudioRecorder() : new OffscreenAudioRecorder()
    );
    const imageCapturer = new ImageCapturer(settings);
    const cardPublisher = new CardPublisher(settings);
    const dictionaryDB = new DictionaryDB();

    const handlers: CommandHandler[] = [
        new VideoHeartbeatHandler(tabRegistry),
        new RecordMediaHandler(audioRecorder, imageCapturer, cardPublisher, settings),
        new RerecordMediaHandler(settings, audioRecorder, cardPublisher),
        new StartRecordingMediaHandler(audioRecorder, imageCapturer, cardPublisher, settings),
        new StopRecordingMediaHandler(audioRecorder, imageCapturer, cardPublisher, settings),
        new TakeScreenshotHandler(imageCapturer, cardPublisher),
        new ToggleSubtitlesHandler(settings, tabRegistry),
        new SyncHandler(tabRegistry),
        new HttpPostHandler(),
        new ToggleSidePanelHandler(tabRegistry),
        new OpenStatisticsHandler(tabRegistry),
        new OpenStatisticsOverlayHandler(tabRegistry),
        new OpenAsbplayerSettingsHandler(),
        new CopyToClipboardHandler(),
        new EncodeMp3Handler(),
        new DictionaryHandler(dictionaryDB, tabRegistry),
        new VideoDisappearedHandler(tabRegistry),
        new RequestingActiveTabPermissionHandler(),
        new CopySubtitleHandler(tabRegistry),
        new LoadSubtitlesHandler(tabRegistry),
        new RequestSubtitlesHandler(),
        new RequestCurrentSubtitleHandler(),
        new SaveTokenLocalHandler(),
        new RequestCopyHistoryHandler(),
        new SaveCopyHistoryHandler(settings),
        new DeleteCopyHistoryHandler(settings),
        new ClearCopyHistoryHandler(settings),
        new PublishCardHandler(cardPublisher),
        new CardUpdatedDialogHandler(),
        new CardExportedDialogHandler(),
        new BulkExportCancellationHandler(cardPublisher),
        new BulkExportStartedHandler(cardPublisher),
        new AckMessageHandler(tabRegistry),
        new AudioBase64Handler(audioRecorder),
        new UpdateMobileOverlayModelHandler(),
        new RefreshSettingsHandler(tabRegistry, settings),
        new VideoToAsbplayerCommandForwardingHandler(tabRegistry),
        new AsbplayerToVideoCommandForwardingHandler(),
        new AsbplayerHeartbeatHandler(tabRegistry),
        new AckTabsHandler(tabRegistry),
        new SettingsUpdatedHandler(tabRegistry, settings),
        new OpenExtensionShortcutsHandler(),
        new ExtensionCommandsHandler(),
        new PageConfigHandler(),
        new BrowserFeaturesHandler(),
        new AsbplayerV2ToVideoCommandForwardingHandler(),
        new CaptureVisibleTabHandler(),
        new RequestModelHandler(),
        new CurrentTabHandler(),
        new MobileOverlayForwarderHandler(),
        new StatisticsOverlayForwarderHandler(),
    ];

    browser.runtime.onMessage.addListener((request: Command<Message>, sender, sendResponse) => {
        for (const handler of handlers) {
            if (
                (typeof handler.sender === 'string' && handler.sender === request.sender) ||
                (typeof handler.sender === 'object' && handler.sender.includes(request.sender))
            ) {
                if (handler.command === null || handler.command === request.message.command) {
                    if (handler.handle(request, sender, sendResponse) === true) {
                        return true;
                    }

                    break;
                }
            }
        }
    });

    browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus?.create({
            id: 'load-subtitles',
            title: browser.i18n.getMessage('contextMenuLoadSubtitles'),
            contexts: ['page', 'video'],
        });

        browser.contextMenus?.create({
            id: 'mine-subtitle',
            title: browser.i18n.getMessage('contextMenuMineSubtitle'),
            contexts: ['page', 'video'],
        });
    });

    browser.contextMenus?.onClicked.addListener((info) => {
        if (info.menuItemId === 'load-subtitles') {
            const toggleVideoSelectCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'toggle-video-select',
                },
            };
            tabRegistry.publishCommandToVideoElementTabs((tab): ExtensionToVideoCommand<Message> | undefined => {
                if (info.pageUrl !== tab.url) {
                    return undefined;
                }

                return toggleVideoSelectCommand;
            });
        } else if (info.menuItemId === 'mine-subtitle') {
            tabRegistry.publishCommandToVideoElements((videoElement): ExtensionToVideoCommand<Message> | undefined => {
                if (info.srcUrl !== undefined && videoElement.src !== info.srcUrl) {
                    return undefined;
                }

                if (info.srcUrl === undefined && info.pageUrl !== videoElement.tab.url) {
                    return undefined;
                }

                const copySubtitleCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'copy-subtitle',
                        postMineAction: PostMineAction.showAnkiDialog,
                    },
                    src: videoElement.src,
                };
                return copySubtitleCommand;
            });
        }
    });

    browser.commands?.onCommand.addListener((command) => {
        browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const validAsbplayer = (asbplayer: Asbplayer) => {
                if (asbplayer.sidePanel) {
                    return false;
                }

                const tab = asbplayer.tab;

                if (tab && tabs.find((t) => t.id === tab.id) === undefined) {
                    return false;
                }

                return true;
            };

            switch (command) {
                case 'copy-subtitle':
                case 'update-last-card':
                case 'export-card':
                case 'copy-subtitle-with-dialog':
                    const postMineAction = postMineActionFromCommand(command);
                    tabRegistry.publishCommandToVideoElements((videoElement) => {
                        if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                            return undefined;
                        }

                        const extensionToVideoCommand: ExtensionToVideoCommand<CopySubtitleMessage> = {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'copy-subtitle',
                                postMineAction: postMineAction,
                            },
                            src: videoElement.src,
                        };
                        return extensionToVideoCommand;
                    });

                    tabRegistry.publishCommandToAsbplayers({
                        commandFactory: (asbplayer) => {
                            if (!validAsbplayer(asbplayer)) {
                                return undefined;
                            }

                            const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<CopySubtitleMessage> = {
                                sender: 'asbplayer-extension-to-player',
                                message: {
                                    command: 'copy-subtitle',
                                    postMineAction: postMineAction,
                                },
                                asbplayerId: asbplayer.id,
                            };
                            return extensionToPlayerCommand;
                        },
                    });
                    break;
                case 'toggle-video-select':
                    for (const tab of tabs) {
                        if (typeof tab.id !== 'undefined') {
                            const extensionToVideoCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                                sender: 'asbplayer-extension-to-video',
                                message: {
                                    command: 'toggle-video-select',
                                },
                            };
                            browser.tabs.sendMessage(tab.id, extensionToVideoCommand);
                        }
                    }
                    break;
                case 'take-screenshot':
                    tabRegistry.publishCommandToVideoElements((videoElement) => {
                        if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                            return undefined;
                        }

                        const extensionToVideoCommand: ExtensionToVideoCommand<TakeScreenshotMessage> = {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'take-screenshot',
                            },
                            src: videoElement.src,
                        };
                        return extensionToVideoCommand;
                    });

                    tabRegistry.publishCommandToAsbplayers({
                        commandFactory: (asbplayer) => {
                            if (!validAsbplayer(asbplayer)) {
                                return undefined;
                            }

                            const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<TakeScreenshotMessage> = {
                                sender: 'asbplayer-extension-to-player',
                                message: {
                                    command: 'take-screenshot',
                                },
                                asbplayerId: asbplayer.id,
                            };
                            return extensionToPlayerCommand;
                        },
                    });
                    break;
                case 'toggle-recording':
                    tabRegistry.publishCommandToVideoElements((videoElement) => {
                        if (tabs.find((t) => t.id === videoElement.tab.id) === undefined) {
                            return undefined;
                        }

                        const extensionToVideoCommand: ExtensionToVideoCommand<ToggleRecordingMessage> = {
                            sender: 'asbplayer-extension-to-video',
                            message: {
                                command: 'toggle-recording',
                            },
                            src: videoElement.src,
                        };
                        return extensionToVideoCommand;
                    });
                    tabRegistry.publishCommandToAsbplayers({
                        commandFactory: (asbplayer) => {
                            if (!validAsbplayer(asbplayer)) {
                                return undefined;
                            }

                            const extensionToPlayerCommand: ExtensionToAsbPlayerCommand<ToggleRecordingMessage> = {
                                sender: 'asbplayer-extension-to-player',
                                message: {
                                    command: 'toggle-recording',
                                },
                                asbplayerId: asbplayer.id,
                            };
                            return extensionToPlayerCommand;
                        },
                    });
                    break;
                default:
                    throw new Error('Unknown command ' + command);
            }
        });
    });

    function postMineActionFromCommand(command: string) {
        switch (command) {
            case 'copy-subtitle':
                return PostMineAction.none;
            case 'copy-subtitle-with-dialog':
                return PostMineAction.showAnkiDialog;
            case 'update-last-card':
                return PostMineAction.updateLastCard;
            case 'export-card':
                return PostMineAction.exportCard;
            default:
                throw new Error('Cannot determine post mine action for unknown command ' + command);
        }
    }

    const updateWebSocketClientState = () => {
        settings.getSingle('webSocketClientEnabled').then((webSocketClientEnabled) => {
            if (webSocketClientEnabled) {
                bindWebSocketClient(settings, tabRegistry);
            } else {
                unbindWebSocketClient();
            }
        });
    };

    updateWebSocketClientState();
    tabRegistry.onAsbplayerInstance(updateWebSocketClientState);
    tabRegistry.onSyncedElement(updateWebSocketClientState);
    browser.runtime.onConnect.addListener((port) => {
        const asbplayerId = /asbplayer-side-panel-(.+)/.exec(port.name)?.[1];
        if (asbplayerId) {
            port.onDisconnect.addListener(() => tabRegistry.onAsbplayerRemoved(asbplayerId));
        }
    });

    const action = browser.action || browser.browserAction;

    const defaultAction = (tab: Browser.tabs.Tab) => {
        if (isMobile) {
            if (tab.id !== undefined) {
                const extensionToVideoCommand: ExtensionToVideoCommand<ToggleVideoSelectMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'toggle-video-select',
                    },
                };
                browser.tabs.sendMessage(tab.id, extensionToVideoCommand);
            }
        } else {
            action.openPopup();
        }
    };

    if (isFirefoxBuild) {
        let hasHostPermission = true;

        browser.permissions.contains({ origins: ['<all_urls>'] }, (result) => {
            hasHostPermission = result;

            if (hasHostPermission && !isMobile) {
                action.setPopup({
                    popup: 'popup-ui.html',
                });
            }
        });

        action.onClicked.addListener(async (tab) => {
            if (hasHostPermission) {
                defaultAction(tab);
            } else {
                try {
                    const obtainedHostPermission = await browser.permissions.request({ origins: ['<all_urls>'] });

                    if (obtainedHostPermission) {
                        hasHostPermission = true;
                        browser.runtime.reload();
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        });
    } else {
        if (!isMobile) {
            action.setPopup({
                popup: 'popup-ui.html',
            });
        }

        action.onClicked.addListener(defaultAction);
    }

    if (isFirefoxBuild) {
        // Firefox requires the use of iframe.srcdoc in order to load UI into an about:blank iframe
        // (which is required for UI to be scannable by other extensions like Yomitan).
        // However, such an iframe inherits the content security directives of the parent document,
        // which may prevent loading of extension scripts into the iframe.
        // Because of this, we modify CSP headers below to explicitly allow access to extension-packaged resources.
        browser.webRequest.onHeadersReceived.addListener(
            (details) => {
                const responseHeaders = details.responseHeaders;

                if (!responseHeaders) {
                    return;
                }

                for (const header of responseHeaders) {
                    if (header.name.toLowerCase() === 'content-security-policy') {
                        let cspValue = header.value;
                        cspValue += ` ; script-src moz-extension://${browser.runtime.id}`;
                    }
                }

                return { responseHeaders };
            },
            { urls: ['<all_urls>'] },
            ['blocking', 'responseHeaders']
        );
    }
});
