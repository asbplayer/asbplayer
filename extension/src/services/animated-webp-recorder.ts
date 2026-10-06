import { asbError } from '@project/common/util/log';
import type {
    EncodeMp3InServiceWorkerMessage,
    ExtensionToOffscreenDocumentCommand,
    ImageCaptureParams,
    RecordAnimatedWebpResponse,
    StopRecordingResponse,
} from '@project/common';
import { StartRecordingErrorCode, StopRecordingErrorCode } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import type {
    ImageRecordingRequest,
    RecordedMedia,
    Requester,
    StartMediaRecordingResponse,
} from '@project/extension/src/services/audio-recorder-delegate';
import { negotiateAnimatedWebp } from '@project/extension/src/services/animated-webp-media';
import { ensureOffscreenAudioServiceDocument } from '@project/extension/src/services/offscreen-document';
import {
    recordAnimatedWebp,
    startAnimatedWebp,
    stopAnimatedWebp,
} from '@project/extension/src/services/video-capturer';

const failedRecording: RecordAnimatedWebpResponse = { base64: '' };

// Records an animated WebP of the video together with the tab's audio, both from the tab's single tabCapture
// stream, which the content script consumes (see animated-webp-capture.ts). Chrome only.
export default class AnimatedWebpRecorder {
    private readonly _settings: SettingsProvider;
    private _timed?: Requester;
    private _manual?: { requester: Requester; resolve: (media: RecordedMedia) => void };

    constructor(settings: SettingsProvider) {
        this._settings = settings;
    }

    // The content script only answers once the clip is finished, so the recording counts as started right
    // away and the clip is handed back through `result`.
    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requester: Requester,
        { captureParams, armed }: ImageRecordingRequest
    ): Promise<StartMediaRecordingResponse> {
        this._timed = requester;
        const result = this._recordedMedia(this._recordWithTimeout(time, requester, captureParams, armed), encodeAsMp3);
        void result.finally(() => {
            if (this._timed === requester) {
                this._timed = undefined;
            }
        });
        return { started: true, result };
    }

    private async _recordWithTimeout(
        time: number,
        { tabId, src }: Requester,
        captureParams: ImageCaptureParams,
        armed: boolean
    ) {
        // When the content script already armed a capture before the seek (see binding.ts), skip negotiating a
        // stream - it would just be discarded, and doing it here is exactly the latency arming avoids.
        const negotiation = armed ? undefined : await negotiateAnimatedWebp(this._settings, tabId);
        const response = await recordAnimatedWebp(tabId, src, time, true, captureParams, negotiation);

        if (response.armedCaptureMissing) {
            // The armed capture was discarded (e.g. after a slow seek), so open a new one
            const renegotiation = await negotiateAnimatedWebp(this._settings, tabId);
            return recordAnimatedWebp(tabId, src, time, true, captureParams, renegotiation);
        }

        return response;
    }

    // Starts an open-ended recording, collected on stop.
    async start(requester: Requester, { captureParams }: ImageRecordingRequest): Promise<StartMediaRecordingResponse> {
        try {
            const negotiation = await negotiateAnimatedWebp(this._settings, requester.tabId);
            const response = await startAnimatedWebp(requester.tabId, requester.src, true, captureParams, negotiation);

            if (!response.started) {
                return this._startError(response.error);
            }
        } catch (e) {
            return this._startError(e instanceof Error ? e.message : String(e));
        }

        const result = new Promise<RecordedMedia>((resolve) => {
            this._manual = { requester, resolve };
        });
        return { started: true, result };
    }

    async stop(encodeAsMp3: boolean): Promise<StopRecordingResponse> {
        if (this._timed !== undefined) {
            // Cut the timed clip short. Its own result still resolves, and whoever started it publishes the card.
            await stopAnimatedWebp(this._timed.tabId, this._timed.src).catch((e) =>
                asbError('recording/animated-webp', e)
            );
            return {
                stopped: false,
                error: {
                    code: StopRecordingErrorCode.timedAudioRecordingInProgress,
                    message: 'Timed recording in progress',
                },
            };
        }

        const manual = this._manual;

        if (manual === undefined) {
            return { stopped: false, error: { code: StopRecordingErrorCode.other, message: 'Not recording' } };
        }

        this._manual = undefined;
        const { tabId, src } = manual.requester;
        manual.resolve(await this._recordedMedia(stopAnimatedWebp(tabId, src), encodeAsMp3));
        return { stopped: true };
    }

    private _startError(message: string | undefined): StartMediaRecordingResponse {
        return {
            started: false,
            error: { code: StartRecordingErrorCode.other, message: message ?? 'Failed to start animated WebP capture' },
        };
    }

    // A failed capture still produces a recording, with an empty image, so the card can be published anyway.
    private async _recordedMedia(
        recording: Promise<RecordAnimatedWebpResponse>,
        encodeAsMp3: boolean
    ): Promise<RecordedMedia> {
        const { base64, audioBase64 } = await recording.catch((e) => {
            asbError('recording/animated-webp', e);
            return failedRecording;
        });
        const image = { base64, extension: 'webp' as const };

        if (!audioBase64 || !encodeAsMp3) {
            return { audioBase64: audioBase64 ?? '', image };
        }

        try {
            return { audioBase64: await encodeMp3(audioBase64), image };
        } catch (e) {
            asbError('recording/animated-webp', e);
            return { audioBase64: '', image };
        }
    }
}

const encodeMp3 = async (audioBase64: string): Promise<string> => {
    await ensureOffscreenAudioServiceDocument();
    const command: ExtensionToOffscreenDocumentCommand<EncodeMp3InServiceWorkerMessage> = {
        sender: 'asbplayer-extension-to-offscreen-document',
        message: {
            command: 'encode-mp3',
            base64: audioBase64,
            extension: 'webm',
        },
    };
    return browser.runtime.sendMessage(command);
};
