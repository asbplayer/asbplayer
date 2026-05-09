import Binding from '@/services/binding';
import { PageDelegate, currentPageDelegate } from '@/services/pages';
import VideoSelectController from '@/controllers/video-select-controller';
import {
    CopyToClipboardMessage,
    CropAndResizeMessage,
    TabToExtensionCommand,
    ToggleSidePanelMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { FrameInfoBroadcaster, FrameInfoListener } from '@/services/frame-info';
import { cropAndResize } from '@project/common/src/image-transformer';
import { TabAnkiUiController } from '@/controllers/tab-anki-ui-controller';
import { StatisticsOverlayController } from '@/controllers/statistics-overlay-controller';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { DefaultKeyBinder } from '@project/common/key-binder';
import { incrementallyFindShadowRoots, shadowRootHosts } from '@/services/shadow-roots';
import { isFirefoxBuild } from '@/services/build-flags';

import type { ContentScriptContext } from '#imports';
import './video.css';

const excludeGlobs = ['*://app.asbplayer.dev/*'];

if (import.meta.env.DEV) {
    excludeGlobs.push('*://localhost:3000/*');
}

export default defineContentScript({
    // Set manifest options
    matches: ['<all_urls>'],
    excludeGlobs,
    allFrames: true,
    runAt: 'document_idle',

    main(ctx: ContentScriptContext) {
        const extensionSettingsStorage = new ExtensionSettingsStorage();
        const settingsProvider = new SettingsProvider(extensionSettingsStorage);

        let unbindToggleSidePanel: (() => void) | undefined;

        const bindToggleSidePanel = () => {
            settingsProvider.getSingle('keyBindSet').then((keyBindSet) => {
                unbindToggleSidePanel?.();
                unbindToggleSidePanel = new DefaultKeyBinder(keyBindSet).bindToggleSidePanel(
                    (event) => {
                        event.preventDefault();
                        event.stopImmediatePropagation();

                        const command: TabToExtensionCommand<ToggleSidePanelMessage> = {
                            sender: 'asbplayer-video-tab',
                            message: {
                                command: 'toggle-side-panel',
                            },
                        };
                        browser.runtime.sendMessage(command);
                    },
                    () => false,
                    true
                );
            });
        };

        const hasValidVideoSource = (videoElement: HTMLVideoElement, page?: PageDelegate) => {
            if (page?.config?.allowVideoElementsWithBlankSrc) {
                return true;
            }

            if (videoElement.src) {
                return true;
            }

            for (let index = 0, length = videoElement.children.length; index < length; index++) {
                const elm = videoElement.children[index];

                if ('SOURCE' === elm.tagName && (elm as HTMLSourceElement).src) {
                    return true;
                }
            }

            return false;
        };

        const shadowRootsWithBindings: ShadowRoot[] = [];

        const injectStylesIntoShadowRoot = async (shadowRoot: ShadowRoot, cssPath: string) => {
            for (const s of shadowRootsWithBindings) {
                if (s.isSameNode(shadowRoot)) {
                    return;
                }
            }

            shadowRootsWithBindings.push(shadowRoot);
            const sheet = new CSSStyleSheet();
            await sheet.replace(await (await fetch(cssPath)).text());
            shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
        };

        const bind = async () => {
            const bindings: Binding[] = [];
            const page = await currentPageDelegate();
            let hasPageScript = page?.config.pageScript !== undefined;
            let frameInfoListener: FrameInfoListener | undefined;
            let frameInfoBroadcaster: FrameInfoBroadcaster | undefined;
            const isParentDocument = window.self === window.top;

            if (isParentDocument) {
                // Parent document, listen for child iframe info
                frameInfoListener = new FrameInfoListener();
                frameInfoListener.bind();
            } else {
                // Child iframe, broadcast frame info
                frameInfoBroadcaster = new FrameInfoBroadcaster();
            }

            const bindToVideoElements = () => {
                const videoElements = [...document.getElementsByTagName('video')];

                for (const shadowRootHost of shadowRootHosts) {
                    if (!shadowRootHost.shadowRoot) {
                        continue;
                    }

                    for (const video of shadowRootHost.shadowRoot.querySelectorAll('video')) {
                        videoElements.push(video);
                        void injectStylesIntoShadowRoot(
                            shadowRootHost.shadowRoot,
                            browser.runtime.getURL('/content-scripts/video.css')
                        );
                    }
                }

                for (let i = 0; i < videoElements.length; ++i) {
                    const videoElement = videoElements[i];
                    const bindingExists = bindings.filter((b) => b.video.isSameNode(videoElement)).length > 0;

                    if (
                        !bindingExists &&
                        hasValidVideoSource(videoElement, page) &&
                        !page?.shouldIgnore(videoElement)
                    ) {
                        const b = new Binding(videoElement, hasPageScript, frameInfoBroadcaster?.frameId);
                        b.bind();
                        bindings.push(b);
                    }
                }

                for (let i = bindings.length - 1; i >= 0; --i) {
                    const b = bindings[i];
                    let videoElementExists = false;

                    for (let j = 0; j < videoElements.length; ++j) {
                        const videoElement = videoElements[j];

                        if (videoElement.isSameNode(b.video) && hasValidVideoSource(videoElement, page)) {
                            videoElementExists = true;
                            break;
                        }
                    }

                    if (!videoElementExists) {
                        bindings.splice(i, 1);
                        b.unbind();
                    }
                }

                if (bindings.length === 0) {
                    frameInfoBroadcaster?.unbind();
                } else {
                    frameInfoBroadcaster?.bind();
                }
            };

            bindToVideoElements();
            const videoInterval = setInterval(bindToVideoElements, 1000);
            const shadowRootInterval = page?.config.searchShadowRootsForVideoElements
                ? setInterval(incrementallyFindShadowRoots, 100)
                : undefined;

            const videoSelectController = new VideoSelectController(bindings);
            videoSelectController.bind();

            const ankiUiController = new TabAnkiUiController(settingsProvider);
            let statisticsOverlayController: StatisticsOverlayController | undefined;

            if (isParentDocument) {
                bindToggleSidePanel();
                statisticsOverlayController = new StatisticsOverlayController();
                statisticsOverlayController.bind();
            }

            const messageListener = (
                request: any,
                sender: Browser.runtime.MessageSender,
                sendResponse: (response?: any) => void
            ) => {
                if (!isParentDocument) {
                    // Inside iframe - only root window is allowed to handle messages here
                    return;
                }

                if (request.sender !== 'asbplayer-extension-to-video') {
                    return;
                }

                switch (request.message.command) {
                    case 'copy-to-clipboard':
                        const copyToClipboardMessage = request.message as CopyToClipboardMessage;
                        fetch(copyToClipboardMessage.dataUrl)
                            .then((response) => response.blob())
                            .then((blob) => {
                                if (isFirefoxBuild) {
                                    if (blob.type.startsWith('text/plain')) {
                                        blob.text()
                                            .then((text) => navigator.clipboard.writeText(text))
                                            .catch(console.info);
                                    } else {
                                        console.error(`Cannot write blob type ${blob.type} to clipboard on Firefox`);
                                    }
                                } else {
                                    navigator.clipboard
                                        .write([new ClipboardItem({ [blob.type]: blob })])
                                        .catch(console.error);
                                }
                            });
                        break;
                    case 'crop-and-resize':
                        const cropAndResizeMessage = request.message as CropAndResizeMessage;
                        let rect = cropAndResizeMessage.rect;

                        if (cropAndResizeMessage.frameId !== undefined) {
                            const iframe = frameInfoListener?.iframesById?.[cropAndResizeMessage.frameId];

                            if (iframe !== undefined) {
                                const iframeRect = iframe.getBoundingClientRect();
                                rect = {
                                    left: rect.left + iframeRect.left,
                                    top: rect.top + iframeRect.top,
                                    width: rect.width,
                                    height: rect.height,
                                };
                            }
                        }

                        cropAndResize(
                            cropAndResizeMessage.maxWidth,
                            cropAndResizeMessage.maxHeight,
                            rect,
                            cropAndResizeMessage.dataUrl
                        ).then((dataUrl) => sendResponse({ dataUrl }));
                        return true;
                    case 'show-anki-ui':
                        if (request.src === undefined) {
                            // Message intended for the tab, and not a specific video binding
                            ankiUiController.show(request.message);
                        }
                        break;
                    case 'settings-updated':
                        bindToggleSidePanel();
                        ankiUiController.updateSettings();
                        break;
                    default:
                    // ignore
                }
            };

            browser.runtime.onMessage.addListener(messageListener);

            window.addEventListener('beforeunload', (event) => {
                for (let b of bindings) {
                    b.unbind();
                }

                bindings.length = 0;

                clearInterval(videoInterval);

                if (shadowRootInterval !== undefined) {
                    clearInterval(shadowRootInterval);
                }

                videoSelectController.unbind();
                frameInfoListener?.unbind();
                frameInfoBroadcaster?.unbind();
                unbindToggleSidePanel?.();
                statisticsOverlayController?.unbind();
                browser.runtime.onMessage.removeListener(messageListener);
            });
        };

        if (document.readyState === 'complete') {
            bind().catch(console.error);
        } else {
            document.addEventListener('readystatechange', (event) => {
                if (document.readyState === 'complete') {
                    bind().catch(console.error);
                }
            });
        }
    },
});
