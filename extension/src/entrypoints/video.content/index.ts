import { asbError, asbInfo } from '@project/common/util';
import Binding from '@/services/binding';
import type { PageDelegate } from '@/services/pages';
import { currentPageDelegate } from '@/services/pages';
import VideoSelectController from '@/controllers/video-select-controller';
import type {
    CopyToClipboardMessage,
    CropAndResizeMessage,
    RecordAnimatedWebpMessage,
    RectModel,
    TabToExtensionCommand,
    ToggleSidePanelMessage,
} from '@project/common';
import { muxAnimatedWebp } from '@project/common';
import { bufferToBase64 } from '@project/common/base64';
import { SettingsProvider } from '@project/common/settings';
import { FrameInfoBroadcaster, FrameInfoListener } from '@/services/frame-info';
import { cropAndResize } from '@project/common/src/image-transformer';
import { TabAnkiUiController } from '@/controllers/tab-anki-ui-controller';
import { StatisticsOverlayController } from '@/controllers/statistics-overlay-controller';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { DefaultKeyBinder } from '@project/common/key-binder';
import { incrementallyFindShadowRoots, shadowRootHosts } from '@/services/shadow-roots';
import { isFirefoxBuild } from '@/services/build-flags';
import { mediaSourceIdentity } from '@/pages/util';

import './video.css';

const excludeGlobs = ['*://app.asbplayer.dev/*'];

if (import.meta.env.DEV) {
    excludeGlobs.push('*://localhost:3000/*');
}

const animatedWebpMaxFrames = 90;

const canvasToWebpBytes = (canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Failed to encode WebP frame'));
                    return;
                }
                blob.arrayBuffer()
                    .then((buffer) => resolve(new Uint8Array(buffer)))
                    .catch(reject);
            },
            'image/webp',
            quality
        );
    });

const recordTrack = (track: MediaStreamTrack, mimeType: string): { stop: () => Promise<Blob> } => {
    const recorder = new MediaRecorder(new MediaStream([track]));
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.start();
    return {
        stop: () => {
            recorder.stop();
            return stopped;
        },
    };
};

// The captured frame is the whole tab, so map the video element's CSS-pixel rect onto it (matching the
// screenshot crop path). Derived once from the first frame.
interface CropDimensions {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dw: number;
    dh: number;
}

const cropDimensions = (
    frameWidth: number,
    frameHeight: number,
    rect: RectModel,
    maxWidth: number,
    maxHeight: number
): CropDimensions => {
    const scaleX = frameWidth / window.innerWidth;
    const scaleY = frameHeight / window.innerHeight;
    const sx = Math.max(0, rect.left * scaleX);
    const sy = Math.max(0, rect.top * scaleY);
    const sw = Math.min(frameWidth - sx, rect.width * scaleX) || frameWidth;
    const sh = Math.min(frameHeight - sy, rect.height * scaleY) || frameHeight;
    const scale = Math.min(1, maxWidth > 0 ? maxWidth / sw : 1, maxHeight > 0 ? maxHeight / sh : 1);
    return { sx, sy, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
};

// Read a tabCapture stream's video frames in real time (MediaStreamTrackProcessor, Chrome-only), crop
// and encode each kept frame to a static WebP, then mux them into one animated WebP. Each frame's real
// timestamp drives its per-frame duration. Audio is recorded from the same stream in parallel.
const recordAnimatedWebp = async (
    streamId: string,
    durationMs: number,
    rect: RectModel,
    maxWidth: number,
    maxHeight: number,
    fps: number,
    quality: number,
    recordAudio: boolean,
    onRecordingStopped?: () => (() => void) | void
): Promise<{ base64: string; audioBase64?: string }> => {
    const Processor = (window as any).MediaStreamTrackProcessor;

    if (!Processor) {
        throw new Error('MediaStreamTrackProcessor is unavailable');
    }

    // Capture at the viewport's device resolution so the crop lines up with the screenshot crop.
    // chromeMediaSource constraints aren't in the standard typings.
    const dpr = window.devicePixelRatio || 1;
    const constraints: MediaStreamConstraints = {
        video: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
                maxWidth: Math.round(window.innerWidth * dpr),
                maxHeight: Math.round(window.innerHeight * dpr),
            },
        } as any,
    };
    if (recordAudio) {
        constraints.audio = { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as any;
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Widen the interval when the target fps would exceed the frame cap, so frames span the whole clip.
    const frameIntervalUs = Math.max(1e6 / fps, (durationMs * 1000) / animatedWebpMaxFrames);
    const frames: { timestampUs: number; data: Uint8Array }[] = [];
    let audioBase64: string | undefined;

    try {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = recordAudio ? stream.getAudioTracks()[0] : undefined;

        // The tab is briefly muted while capturing (piping the captured audio back to keep the tab
        // audible would feed back into tabCapture). The MediaRecorder still records the audio cleanly.
        const audioRecording = audioTrack ? recordTrack(audioTrack, 'audio/webm') : undefined;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const reader: ReadableStreamDefaultReader<VideoFrame> = new Processor({
            track: videoTrack,
        }).readable.getReader();

        // Safety net: a stalled track would otherwise hang reader.read(). Stopping it closes the reader.
        const stopTimeout = setTimeout(() => videoTrack.stop(), durationMs + 2000);

        let dimensions: CropDimensions | undefined;
        let firstTimestampUs: number | undefined;
        let nextCaptureUs = -Infinity;

        try {
            while (frames.length < animatedWebpMaxFrames) {
                const { value: frame, done } = await reader.read();

                if (done || !frame) {
                    break;
                }

                const timestampUs = frame.timestamp;

                if (firstTimestampUs === undefined) {
                    firstTimestampUs = timestampUs;
                }

                if (timestampUs - firstTimestampUs >= durationMs * 1000) {
                    frame.close();
                    break;
                }

                // Drop frames closer together than the target interval.
                if (timestampUs < nextCaptureUs) {
                    frame.close();
                    continue;
                }
                nextCaptureUs = timestampUs + frameIntervalUs;

                if (!dimensions) {
                    dimensions = cropDimensions(frame.displayWidth, frame.displayHeight, rect, maxWidth, maxHeight);
                    canvas.width = dimensions.dw;
                    canvas.height = dimensions.dh;
                }

                const { sx, sy, sw, sh, dw, dh } = dimensions;
                ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, dw, dh);
                frame.close();
                frames.push({ timestampUs, data: await canvasToWebpBytes(canvas, quality) });
            }
        } finally {
            clearTimeout(stopTimeout);
            await reader.cancel().catch(() => {});
        }

        if (audioRecording) {
            audioBase64 = bufferToBase64(await (await audioRecording.stop()).arrayBuffer());
        }
    } finally {
        stream.getTracks().forEach((t) => t.stop());
    }

    // Capture done — pause the video and show the processing notification while muxing.
    const removeOverlay = onRecordingStopped?.();

    try {
        if (frames.length === 0) {
            throw new Error('No frames captured');
        }

        const muxFrames = frames.map((frame, i) => {
            const nextUs = i + 1 < frames.length ? frames[i + 1].timestampUs : frame.timestampUs + frameIntervalUs;
            return { data: frame.data, durationMs: Math.max(1, Math.round((nextUs - frame.timestampUs) / 1000)) };
        });

        return { base64: bufferToBase64(muxAnimatedWebp(muxFrames).buffer), audioBase64 };
    } finally {
        removeOverlay?.();
    }
};

export default defineContentScript({
    // Set manifest options
    matches: ['<all_urls>'],
    excludeGlobs,
    allFrames: true,
    runAt: 'document_idle',

    main() {
        const extensionSettingsStorage = new ExtensionSettingsStorage();
        const settingsProvider = new SettingsProvider(extensionSettingsStorage);

        let unbindToggleSidePanel: (() => void) | undefined;

        const bindToggleSidePanel = () => {
            void settingsProvider.getSingle('keyBindSet').then((keyBindSet) => {
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
                        void browser.runtime.sendMessage(command);
                    },
                    () => false,
                    true
                );
            });
        };

        const hasValidVideoSource = (videoElement: HTMLVideoElement, page: PageDelegate) => {
            if (page.config.allowVideoElementsWithBlankSrc) {
                return true;
            }

            if (mediaSourceIdentity(videoElement) !== undefined) {
                return true;
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

                for (let i = 0; i < videoElements.length; ++i) {
                    const videoElement = videoElements[i];
                    const bindingExists = bindings.filter((b) => b.video.isSameNode(videoElement)).length > 0;

                    if (!bindingExists && hasValidVideoSource(videoElement, page) && !page.shouldIgnore(videoElement)) {
                        const b = new Binding(videoElement, {
                            hasPageScript,
                            frameId: frameInfoBroadcaster?.frameId,
                            videoSrcChangesIndicateNewVideo: page.config.videoSrcChangesIndicateNewVideo ?? false,
                        });
                        b.bind();
                        bindings.push(b);
                    }
                }

                for (let i = bindings.length - 1; i >= 0; --i) {
                    const b = bindings[i];
                    let videoElementExists = false;

                    for (let j = 0; j < videoElements.length; ++j) {
                        const videoElement = videoElements[j];

                        if (
                            videoElement.isSameNode(b.video) &&
                            hasValidVideoSource(videoElement, page) &&
                            !page.shouldIgnore(videoElement)
                        ) {
                            videoElementExists = true;
                            break;
                        }
                    }

                    if (!videoElementExists) {
                        bindings.splice(i, 1);
                        b.unbind();
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
            });
            videoSelectController.bind();

            const ankiUiController = new TabAnkiUiController(settingsProvider);
            let statisticsOverlayController: StatisticsOverlayController | undefined;

            if (isParentDocument) {
                bindToggleSidePanel();
                statisticsOverlayController = new StatisticsOverlayController(bindings);
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
                            cropAndResizeMessage.dataUrl
                        ).then((dataUrl) => sendResponse({ dataUrl }));
                        return true;
                    }
                    case 'record-animated-webp': {
                        const recordAnimatedWebpMessage = request.message as RecordAnimatedWebpMessage;
                        let animatedRect = recordAnimatedWebpMessage.rect;

                        if (recordAnimatedWebpMessage.frameId !== undefined) {
                            const iframe = frameInfoListener?.iframesById?.[recordAnimatedWebpMessage.frameId];

                            if (iframe !== undefined) {
                                const iframeRect = iframe.getBoundingClientRect();
                                animatedRect = {
                                    left: animatedRect.left + iframeRect.left,
                                    top: animatedRect.top + iframeRect.top,
                                    width: animatedRect.width,
                                    height: animatedRect.height,
                                };
                            }
                        }

                        const animatedBinding =
                            bindings.find((b) => b.registeredVideoSrc === request.src) ?? bindings[0];
                        recordAnimatedWebp(
                            recordAnimatedWebpMessage.streamId,
                            recordAnimatedWebpMessage.durationMs,
                            animatedRect,
                            recordAnimatedWebpMessage.maxWidth,
                            recordAnimatedWebpMessage.maxHeight,
                            recordAnimatedWebpMessage.fps,
                            recordAnimatedWebpMessage.quality,
                            recordAnimatedWebpMessage.recordAudio,
                            () => {
                                animatedBinding?.pause();
                                animatedBinding?.subtitleController.persistentNotification('info.processingClip');
                                return () => animatedBinding?.subtitleController.hideNotification();
                            }
                        )
                            .then(({ base64, audioBase64 }) => sendResponse({ base64, audioBase64 }))
                            .catch((e) => {
                                asbError('recording/animated-webp', e);
                                sendResponse({ base64: '', error: String(e?.message ?? e) });
                            });
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
