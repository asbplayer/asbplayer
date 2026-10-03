import { asbError, asbInfo, asbTrace } from '@project/common/util/log';
import Binding from '@/services/binding';
import { currentPageDelegate } from '@/services/pages';
import VideoSelectController from '@/controllers/video-select-controller';
import type {
    CopyToClipboardMessage,
    CropAndResizeMessage,
    ImageCaptureParams,
    RecordAnimatedWebpMessage,
    StartAnimatedWebpMessage,
    TabToExtensionCommand,
    ToggleSidePanelMessage,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import {
    activeAnimatedWebpCapture,
    armAnimatedWebpCapture,
    discardArmedAnimatedWebpCapture,
    releaseAnimatedWebpCapture,
    startAnimatedWebpCapture,
    takeArmedAnimatedWebpCapture,
} from '@/services/animated-webp-capture';
import type { AnimatedWebpCaptureOptions } from '@/services/animated-webp-capture';
import { FrameInfoBroadcaster, FrameInfoListener } from '@/services/frame-info';
import { cropAndResize } from '@project/common/src/image-transformer';
import { TabAnkiUiController } from '@/controllers/tab-anki-ui-controller';
import { StatisticsOverlayController } from '@/controllers/statistics-overlay-controller';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { DefaultKeyBinder } from '@project/common/key-binder';
import { incrementallyFindShadowRoots, shadowRootHosts } from '@/services/shadow-roots';
import { isFirefoxBuild } from '@/services/build-flags';
import { mediaSourceIdentity } from '@/pages/util';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

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

    main() {
        configureExtensionLogProvider();

        const extensionSettingsStorage = new ExtensionSettingsStorage();
        const settingsProvider = new SettingsProvider(extensionSettingsStorage);

        let unbindToggleSidePanel: (() => void) | undefined;

        const bindToggleSidePanel = () => {
            void settingsProvider
                .getSingle('keyBindSet')
                .then((keyBindSet) => {
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
                            void browser.runtime
                                .sendMessage(command)
                                .catch((error) => asbError('video', 'Failed to toggle the side panel:', error));
                        },
                        () => false,
                        true
                    );
                })
                .catch((error) => asbError('video', 'Failed to load key bindings:', error));
        };

        const shadowRootsWithBindings: ShadowRoot[] = [];
        const candidateIds = new WeakMap<HTMLMediaElement, number>();
        let nextCandidateId = 0;
        const candidateIdFor = (video: HTMLMediaElement) => {
            let candidateId = candidateIds.get(video);
            if (candidateId === undefined) {
                candidateId = ++nextCandidateId;
                candidateIds.set(video, candidateId);
            }
            return candidateId;
        };

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
            const hasPageScript = page.config.pageScript !== undefined;
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

                const candidates = videoElements.map((video) => ({
                    video,
                    hasValidSource:
                        page.config.allowVideoElementsWithBlankSrc === true || mediaSourceIdentity(video) !== undefined,
                    ignored: page.shouldIgnore(video),
                    bindingExists: bindings.some((binding) => binding.video.isSameNode(video)),
                }));

                for (const candidate of candidates) {
                    const { video, hasValidSource, ignored, bindingExists } = candidate;
                    if (!bindingExists && hasValidSource && !ignored) {
                        const binding = new Binding(video, {
                            hasPageScript,
                            frameId: frameInfoBroadcaster?.frameId,
                            videoSrcChangesIndicateNewVideo: page.config.videoSrcChangesIndicateNewVideo ?? false,
                        });
                        binding.bind();
                        bindings.push(binding);
                        asbTrace('video/discovery', 'Bound video element candidate', {
                            page: page.config.key ?? (page.config.generic ? 'generic' : 'unmatched'),
                            candidateId: candidateIdFor(video),
                            readyState: video.readyState,
                            preferred: page.videoElementPreference(video) === 0,
                        });
                    }
                }

                for (let i = bindings.length - 1; i >= 0; --i) {
                    const binding = bindings[i];
                    const candidate = candidates.find(({ video }) => video.isSameNode(binding.video));
                    if (candidate === undefined || !candidate.hasValidSource || candidate.ignored) {
                        bindings.splice(i, 1);
                        binding.unbind();
                        asbTrace('video/discovery', 'Unbound video element candidate', {
                            page: page.config.key ?? (page.config.generic ? 'generic' : 'unmatched'),
                            candidateId: candidateIdFor(binding.video),
                            reason:
                                candidate === undefined
                                    ? 'removed-from-document'
                                    : candidate.ignored
                                      ? 'matched-ignore-rule'
                                      : 'source-unavailable',
                        });
                    }
                }

                bindings.sort((a, b) => page.videoElementPreference(a.video) - page.videoElementPreference(b.video));
                if (bindings.length === 0) {
                    frameInfoBroadcaster?.unbind();
                } else {
                    frameInfoBroadcaster?.bind();
                }
            };

            bindToVideoElements();
            const videoInterval = setInterval(bindToVideoElements, 1000);
            const shadowRootInterval = page.config.searchShadowRootsForVideoElements
                ? setInterval(incrementallyFindShadowRoots, 100)
                : undefined;

            const videoSelectController = new VideoSelectController(bindings, {
                isBindingsSorted: page.config.preferredVideoElementSelector !== undefined,
                isPreferredBinding:
                    page.config.preferredVideoElementSelector !== undefined
                        ? (b) => page.videoElementPreference(b.video) === 0
                        : undefined,
            });
            videoSelectController.bind();

            const ankiUiController = new TabAnkiUiController(settingsProvider);
            let statisticsOverlayController: StatisticsOverlayController | undefined;

            if (isParentDocument) {
                bindToggleSidePanel();
                statisticsOverlayController = new StatisticsOverlayController(bindings);
                statisticsOverlayController.bind();
            }

            const animatedWebpOptions = (
                params: ImageCaptureParams,
                src: string | undefined,
                durationMs?: number
            ): AnimatedWebpCaptureOptions => {
                let rect = params.rect;

                if (params.frameId !== undefined) {
                    const iframe = frameInfoListener?.iframesById?.[params.frameId];

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

                const binding = bindings.find((b) => b.registeredVideoSrc === src) ?? bindings[0];

                return {
                    durationMs,
                    rect,
                    maxWidth: params.maxWidth,
                    maxHeight: params.maxHeight,
                    onRecordingStopped: () => {
                        binding?.pause();
                        binding?.subtitleController.persistentNotification('info.processingClip');
                        return () => binding?.subtitleController.hideNotification();
                    },
                };
            };

            // Prefer a capture that was already armed (getUserMedia negotiated) before the mining seek
            // happened, so we don't lose the start of the clip to that negotiation's latency. Fall back to
            // arming it now if none is available.
            const takeOrArmAnimatedWebpCapture = async (message: {
                streamId?: string;
                fps?: number;
                quality?: number;
                recordAudio: boolean;
            }) => {
                const armed = takeArmedAnimatedWebpCapture();

                if (armed) {
                    return armed;
                }

                if (message.streamId === undefined || message.fps === undefined || message.quality === undefined) {
                    throw new Error('No armed animated WebP capture and no stream to arm one from');
                }

                await armAnimatedWebpCapture(message.streamId, message.fps, message.quality, message.recordAudio);
                return takeArmedAnimatedWebpCapture()!;
            };

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
                    case 'copy-to-clipboard': {
                        const copyToClipboardMessage = request.message as CopyToClipboardMessage;
                        void fetch(copyToClipboardMessage.dataUrl)
                            .then((response) => response.blob())
                            .then((blob) => {
                                if (isFirefoxBuild) {
                                    if (blob.type.startsWith('text/plain')) {
                                        blob.text()
                                            .then((text) => navigator.clipboard.writeText(text))
                                            .catch((error) => asbInfo('video/clipboard', error));
                                    } else {
                                        asbError(
                                            'video/clipboard',
                                            `Cannot write blob type ${blob.type} to clipboard on Firefox`
                                        );
                                    }
                                } else {
                                    navigator.clipboard
                                        .write([new ClipboardItem({ [blob.type]: blob })])
                                        .catch((error) => asbError('video/clipboard', error));
                                }
                            });
                        break;
                    }
                    case 'crop-and-resize': {
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

                        void cropAndResize(
                            cropAndResizeMessage.maxWidth,
                            cropAndResizeMessage.maxHeight,
                            rect,
                            cropAndResizeMessage.dataUrl,
                            cropAndResizeMessage.trimBlackBars
                        ).then((dataUrl) => sendResponse({ dataUrl }));
                        return true;
                    }
                    case 'record-animated-webp': {
                        const recordAnimatedWebpMessage = request.message as RecordAnimatedWebpMessage;

                        (async () => {
                            const capture = await takeOrArmAnimatedWebpCapture(recordAnimatedWebpMessage);
                            return startAnimatedWebpCapture(
                                capture,
                                animatedWebpOptions(
                                    recordAnimatedWebpMessage,
                                    request.src,
                                    recordAnimatedWebpMessage.durationMs
                                )
                            ).result;
                        })()
                            .then(({ base64, audioBase64 }) => sendResponse({ base64, audioBase64 }))
                            .catch((e) => {
                                asbError('recording/animated-webp', e);
                                sendResponse({ base64: '', error: String(e?.message ?? e) });
                            });
                        return true;
                    }
                    case 'start-animated-webp': {
                        const startAnimatedWebpMessage = request.message as StartAnimatedWebpMessage;

                        (async () => {
                            // A manual start has no mining seek to arm ahead of, so anything armed is stale
                            discardArmedAnimatedWebpCapture();
                            const capture = await takeOrArmAnimatedWebpCapture(startAnimatedWebpMessage);
                            startAnimatedWebpCapture(
                                capture,
                                animatedWebpOptions(startAnimatedWebpMessage, request.src)
                            );
                        })()
                            .then(() => sendResponse({ started: true }))
                            .catch((e) => {
                                asbError('recording/animated-webp', e);
                                sendResponse({ started: false, error: String(e?.message ?? e) });
                            });
                        return true;
                    }
                    case 'stop-animated-webp': {
                        const active = activeAnimatedWebpCapture();

                        if (active === undefined) {
                            sendResponse({ base64: '', error: 'No animated WebP capture in progress' });
                            return true;
                        }

                        active.stop();
                        active.result
                            .then(({ base64, audioBase64 }) => sendResponse({ base64, audioBase64 }))
                            .catch((e) => {
                                asbError('recording/animated-webp', e);
                                sendResponse({ base64: '', error: String(e?.message ?? e) });
                            })
                            .finally(() => releaseAnimatedWebpCapture(active));
                        return true;
                    }
                    case 'show-anki-ui':
                        if (request.src === undefined) {
                            // Message intended for the tab, and not a specific video binding
                            void ankiUiController.show(request.message);
                        }
                        break;
                    case 'settings-updated':
                        bindToggleSidePanel();
                        void ankiUiController.updateSettings();
                        break;
                    default:
                    // ignore
                }
            };

            browser.runtime.onMessage.addListener(messageListener);

            window.addEventListener('beforeunload', () => {
                for (const b of bindings) {
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

        let bindingStarted = false;
        const bindOnceDocumentComplete = () => {
            if (bindingStarted || document.readyState !== 'complete') return;
            bindingStarted = true;
            document.removeEventListener('readystatechange', bindOnceDocumentComplete);
            void bind().catch((error) => asbError('video', error));
        };
        bindOnceDocumentComplete();
        if (!bindingStarted) document.addEventListener('readystatechange', bindOnceDocumentComplete);
    },
});
