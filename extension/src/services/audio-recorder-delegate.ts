import type {
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
import type AnimatedWebpRecorder from '@project/extension/src/services/animated-webp-recorder';

export interface Requester {
    tabId: number;
    src: string;
}

// Asks for the video to be captured as an image (an animated WebP) along with the audio
export interface ImageRecordingRequest {
    captureParams: ImageCaptureParams;
    // Whether the content script already opened the tab-capture stream ahead of the mining seek
    armed: boolean;
}

export interface RecordedImage {
    base64: string; // empty when the capture failed
    extension: 'webp';
}

export interface RecordedMedia {
    audioBase64: string;
    // Only set when an image was requested and the recorder can capture one
    image: RecordedImage | null;
}

export interface StartMediaRecordingResponse extends StartRecordingResponse {
    // Set by recorders that produce the recording in the background page itself. The others deliver it
    // later with an audio-base64 message.
    result?: Promise<RecordedMedia>;
}

export interface AudioRecorderDelegate {
    startWithTimeout: (
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester,
        image?: ImageRecordingRequest
    ) => Promise<StartMediaRecordingResponse>;
    start: (
        requestId: string,
        requester: Requester,
        image?: ImageRecordingRequest
    ) => Promise<StartMediaRecordingResponse>;
    stop: (encodeAsMp3: boolean, requester: Requester) => Promise<StopRecordingResponse>;
}

export class OffscreenAudioRecorder implements AudioRecorderDelegate {
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
        { tabId }: Requester
    ): Promise<StartRecordingResponse> {
        await ensureOffscreenAudioServiceDocument();

        const streamId = await this._mediaStreamId(tabId);
        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioWithTimeoutMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                encodeAsMp3,
                streamId,
                requestId,
            },
        };
        return browser.runtime.sendMessage(command);
    }

    async start(requestId: string, { tabId }: Requester) {
        await ensureOffscreenAudioServiceDocument();
        const streamId = await this._mediaStreamId(tabId);

        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio',
                streamId,
                requestId,
            },
        };
        return browser.runtime.sendMessage(command);
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

// Chrome can only capture a tab once at a time, so a recording that also captures an image takes the place of
// the offscreen audio recording instead of running alongside it.
export class ChromeMediaRecorder implements AudioRecorderDelegate {
    private readonly _audioRecorder: OffscreenAudioRecorder;
    private readonly _animatedWebpRecorder: AnimatedWebpRecorder;
    private _recordingImage = false;

    constructor(audioRecorder: OffscreenAudioRecorder, animatedWebpRecorder: AnimatedWebpRecorder) {
        this._audioRecorder = audioRecorder;
        this._animatedWebpRecorder = animatedWebpRecorder;
    }

    startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        requester: Requester,
        image?: ImageRecordingRequest
    ) {
        this._recordingImage = image !== undefined;

        if (image === undefined) {
            return this._audioRecorder.startWithTimeout(time, encodeAsMp3, requestId, requester);
        }

        return this._animatedWebpRecorder.startWithTimeout(time, encodeAsMp3, requester, image);
    }

    start(requestId: string, requester: Requester, image?: ImageRecordingRequest) {
        this._recordingImage = image !== undefined;

        if (image === undefined) {
            return this._audioRecorder.start(requestId, requester);
        }

        return this._animatedWebpRecorder.start(requester, image);
    }

    stop(encodeAsMp3: boolean) {
        return this._recordingImage
            ? this._animatedWebpRecorder.stop(encodeAsMp3)
            : this._audioRecorder.stop(encodeAsMp3);
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
