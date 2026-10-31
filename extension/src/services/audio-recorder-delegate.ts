import type {
    AnimatedWebpCaptureRequest,
    AudioErrorCode,
    ExtensionToOffscreenDocumentCommand,
    ExtensionToVideoCommand,
    ImageCaptureParams,
    StartRecordingAudioMessage,
    StartRecordingAudioViaCaptureStreamMessage,
    StartRecordingAudioWithTimeoutMessage,
    StartRecordingAudioWithTimeoutViaCaptureStreamMessage,
    StartRecordingResponse,
    StopRecordingAudioMessage,
    StopRecordingResponse,
} from '@project/common';
import { ensureOffscreenAudioServiceDocument } from '@project/extension/src/services/offscreen-document';
import type { SettingsProvider } from '@project/common/settings';
import { animatedWebpSettings } from '@project/extension/src/services/animated-webp-media';
import { resolveCaptureArea } from '@project/extension/src/services/video-capturer';

export interface Requester {
    tabId: number;
    src: string;
}

// Asks for the video to be captured as an image (an animated WebP) along with the audio
export interface ImageRecordingRequest {
    captureParams: ImageCaptureParams;
    // Whether the tab-capture stream was already opened in the offscreen document ahead of the mining seek
    armed: boolean;
}

export interface RecordedImage {
    base64: string; // empty when the capture failed
    extension: 'webp';
    animated: true;
}

export interface RecordedMedia {
    audioBase64: string;
    // Set when the audio couldn't be recorded
    audioError?: AudioErrorCode;
    // Only set when an image was requested and the recorder can capture one
    image: RecordedImage | null;
}

export interface AudioRecorderDelegate {
    startWithTimeout: (
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester,
        image?: ImageRecordingRequest
    ) => Promise<StartRecordingResponse>;
    start: (requestId: string, requester: Requester, image?: ImageRecordingRequest) => Promise<StartRecordingResponse>;
    stop: (encodeAsMp3: boolean, requester: Requester) => Promise<StopRecordingResponse>;
}

export class OffscreenAudioRecorder implements AudioRecorderDelegate {
    private readonly _settings: SettingsProvider;

    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    private _mediaStreamId(tabId: number): Promise<string> {
        return new Promise((resolve) => {
            browser.tabCapture.getMediaStreamId(
                {
                    targetTabId: tabId,
                },
                (streamId) => resolve(streamId)
            );
        });
    }

    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        requester: Requester,
        image?: ImageRecordingRequest
    ): Promise<StartRecordingResponse> {
        return this._start(requester, image, (streamId, animatedWebp) => ({
            command: 'start-recording-audio-with-timeout',
            timeout: time,
            encodeAsMp3,
            streamId,
            requestId,
            image: animatedWebp,
        }));
    }

    async start(requestId: string, requester: Requester, image?: ImageRecordingRequest) {
        return this._start(requester, image, (streamId, animatedWebp) => ({
            command: 'start-recording-audio',
            streamId,
            requestId,
            image: animatedWebp,
        }));
    }

    // A capture armed ahead of the mining seek holds the tab capture, so it's used instead of a new stream id. If it
    // was discarded in the meantime, the offscreen document asks again with one.
    private async _start<M extends StartRecordingAudioWithTimeoutMessage | StartRecordingAudioMessage>(
        { tabId, src }: Requester,
        image: ImageRecordingRequest | undefined,
        message: (streamId: string | undefined, animatedWebp: AnimatedWebpCaptureRequest | undefined) => M
    ): Promise<StartRecordingResponse> {
        await ensureOffscreenAudioServiceDocument();
        const animatedWebp =
            image === undefined ? undefined : await this._animatedWebpCaptureRequest(tabId, src, image.captureParams);
        const send = (streamId: string | undefined): Promise<StartRecordingResponse> => {
            const command: ExtensionToOffscreenDocumentCommand<M> = {
                sender: 'asbplayer-extension-to-offscreen-document',
                message: message(streamId, animatedWebp),
            };
            return browser.runtime.sendMessage(command);
        };

        if (image?.armed) {
            const response = await send(undefined);

            if (!response.armedCaptureMissing) {
                return response;
            }
        }

        return send(await this._mediaStreamId(tabId));
    }

    private async _animatedWebpCaptureRequest(
        tabId: number,
        src: string,
        { rect, frameId, maxWidth, maxHeight }: ImageCaptureParams
    ): Promise<AnimatedWebpCaptureRequest> {
        const [area, { fps, quality }] = await Promise.all([
            resolveCaptureArea(tabId, src, rect, frameId),
            animatedWebpSettings(this._settings),
        ]);
        return { ...area, maxWidth, maxHeight, fps, quality };
    }

    async stop(encodeAsMp3: boolean): Promise<StopRecordingResponse> {
        const command: ExtensionToOffscreenDocumentCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'stop-recording-audio',
                encodeAsMp3,
            },
        };
        return browser.runtime.sendMessage(command);
    }
}

export class CaptureStreamAudioRecorder implements AudioRecorderDelegate {
    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ): Promise<StartRecordingResponse> {
        const command: ExtensionToVideoCommand<StartRecordingAudioWithTimeoutViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                encodeAsMp3,
                requestId,
            },
            src,
        };

        return browser.tabs.sendMessage(tabId, command);
    }

    async start(requestId: string, { tabId, src }: Requester) {
        const command: ExtensionToVideoCommand<StartRecordingAudioViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio',
                requestId,
            },
            src,
        };
        return browser.tabs.sendMessage(tabId, command);
    }

    async stop(encodeAsMp3: boolean, { tabId, src }: Requester): Promise<StopRecordingResponse> {
        const command: ExtensionToVideoCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'stop-recording-audio',
                encodeAsMp3,
            },
            src,
        };
        return browser.tabs.sendMessage(tabId, command);
    }
}
