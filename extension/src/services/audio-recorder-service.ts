import type {
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    NotifyErrorMessage,
    RecordingFinishedMessage,
    RecordAnimatedWebpResponse,
    RecordingStartedMessage,
    RequestActiveTabPermissionMessage,
    ImageCaptureParams,
    StartRecordingResponse,
} from '@project/common';
import { StartRecordingErrorCode, StopRecordingErrorCode } from '@project/common';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type { AudioRecorderDelegate } from '@project/extension/src/services/audio-recorder-delegate';
import {
    recordAnimatedWebp,
    startAnimatedWebp,
    stopAnimatedWebp,
} from '@project/extension/src/services/video-capturer';
import { v4 as uuidv4 } from 'uuid';

interface Requester {
    tabId: number;
    src: string;
}

export class DrmProtectedStreamError extends Error {}

export class TimedRecordingInProgressError extends Error {}

export class NoRecordingInProgressServiceError extends Error {}

export class RecordingInProgressError extends Error {}

export interface AnimatedWebpNegotiation {
    streamId: string;
    fps: number;
    quality: number;
}

interface AnimatedWebpRecording {
    requester: Requester;
    // Whether it ends by itself after a fixed duration, as opposed to waiting for stopAnimatedWebp
    timed: boolean;
}

// Owns the state of every media recording the extension makes - audio-only clips and animated-WebP clips
// alike - so they share the same started/finished notifications and can't overlap. Both capture from the
// tab's single tabCapture stream, which is why they have to exclude each other.
export default class AudioRecorderService {
    private readonly _tabRegistry: TabRegistry;
    private readonly _delegate: AudioRecorderDelegate;

    private audioBase64Promise?: Promise<string>;
    private audioBase64Resolve?: (value: string) => void;
    private audioBase64Reject?: (error: any) => void;
    private currentRecordRequestId: string | undefined;
    private animatedWebp?: AnimatedWebpRecording;

    constructor(tabRegistry: TabRegistry, delegate: AudioRecorderDelegate) {
        this._tabRegistry = tabRegistry;
        this._delegate = delegate;
    }

    onAudioBase64(base64: string, requestId: string) {
        if (this.currentRecordRequestId === requestId) {
            this.audioBase64Resolve?.(base64);
            this.audioBase64Resolve = undefined;
            this.audioBase64Promise = undefined;
            this.audioBase64Reject = undefined;
            this.currentRecordRequestId = undefined;
        }
    }

    async startWithTimeout(time: number, encodeAsMp3: boolean, requester: Requester): Promise<string> {
        const requestId = uuidv4();

        try {
            this._assertNoAnimatedWebpRecording(requester);
            const response = await this._delegate.startWithTimeout(time, encodeAsMp3, requestId, requester);

            if (response.started) {
                this._notifyRecordingStarted(requester);
                return await this._prepareForAudioDataResponse(requestId);
            }

            throw this._handleStartError(response, requester);
        } finally {
            this._notifyRecordingFinished(requester);
        }
    }

    async start(requester: Requester) {
        try {
            this._assertNoAnimatedWebpRecording(requester);
            const requestId = uuidv4();
            const response = await this._delegate.start(requestId, requester);

            if (!response.started) {
                throw this._handleStartError(response, requester);
            }

            void this._prepareForAudioDataResponse(requestId);
            this._notifyRecordingStarted(requester);
        } catch (e) {
            this._notifyRecordingFinished(requester);
            throw e;
        }
    }

    get animatedWebpRecording() {
        return this.animatedWebp !== undefined;
    }

    // Records an animated WebP (plus audio, when requested) for a fixed duration. Can be cut short with
    // stopAnimatedWebp, in which case this still resolves with what was captured.
    async recordAnimatedWebpWithTimeout(
        durationMs: number,
        recordAudio: boolean,
        captureParams: ImageCaptureParams,
        requester: Requester,
        negotiation?: AnimatedWebpNegotiation
    ): Promise<RecordAnimatedWebpResponse> {
        const recording = this._beginAnimatedWebp(requester, true);
        this._notifyRecordingStarted(requester);

        try {
            return await recordAnimatedWebp(
                requester.tabId,
                requester.src,
                durationMs,
                recordAudio,
                captureParams,
                negotiation
            );
        } finally {
            this._endAnimatedWebp(recording);
        }
    }

    // Starts an open-ended animated WebP recording that runs until stopAnimatedWebp.
    async startAnimatedWebp(
        recordAudio: boolean,
        captureParams: ImageCaptureParams,
        requester: Requester,
        negotiation: AnimatedWebpNegotiation
    ) {
        const recording = this._beginAnimatedWebp(requester, false);

        try {
            const response = await startAnimatedWebp(
                requester.tabId,
                requester.src,
                recordAudio,
                captureParams,
                negotiation
            );

            if (!response.started) {
                const errorMessage = `Failed to start animated WebP recording: "${response.error}"`;
                this._notifyError(errorMessage, requester);
                throw new Error(errorMessage);
            }

            this._notifyRecordingStarted(requester);
        } catch (e) {
            this._endAnimatedWebp(recording);
            throw e;
        }
    }

    async stopAnimatedWebp(requester: Requester): Promise<RecordAnimatedWebpResponse> {
        const recording = this.animatedWebp;

        if (recording === undefined) {
            // Benign no-op, same as stopping audio when nothing is recording
            this._notifyRecordingFinished(requester);
            throw new NoRecordingInProgressServiceError();
        }

        let response: RecordAnimatedWebpResponse;

        try {
            response = await stopAnimatedWebp(recording.requester.tabId, recording.requester.src);
        } catch (e) {
            this._endAnimatedWebp(recording);
            throw e;
        }

        if (recording.timed) {
            // The timed recording was cut short and its original caller publishes the card, so there is
            // nothing for this caller to do.
            throw new TimedRecordingInProgressError();
        }

        this._endAnimatedWebp(recording);
        return response;
    }

    private _beginAnimatedWebp(requester: Requester, timed: boolean): AnimatedWebpRecording {
        if (this.animatedWebp !== undefined || this.audioBase64Promise !== undefined) {
            // Let the requester leave its "recording requested" state, like a rejected audio start does
            this._notifyRecordingFinished(requester);
            throw this._recordingInProgress(requester);
        }

        this.animatedWebp = { requester, timed };
        return this.animatedWebp;
    }

    private _endAnimatedWebp(recording: AnimatedWebpRecording) {
        if (this.animatedWebp === recording) {
            this.animatedWebp = undefined;
        }

        this._notifyRecordingFinished(recording.requester);
    }

    private _assertNoAnimatedWebpRecording(requester: Requester) {
        if (this.animatedWebp !== undefined) {
            throw this._recordingInProgress(requester);
        }
    }

    private _recordingInProgress(requester: Requester) {
        const errorMessage = 'Cannot start recording: another recording is already in progress';
        this._notifyError(errorMessage, requester);
        return new RecordingInProgressError(errorMessage);
    }

    private _handleStartError(response: StartRecordingResponse, { tabId, src }: Requester): Error {
        const errorCode = response.error!.code;
        const errorMessage = `Failed to start audio recording: "${response.error!.message}"`;

        switch (errorCode) {
            case StartRecordingErrorCode.noActiveTabPermission:
                if (tabId !== undefined) {
                    this._requestActiveTab(tabId, src);
                }
                return new Error(errorMessage);
            case StartRecordingErrorCode.other:
                this._notifyError(errorMessage, { tabId, src });
                return new Error(errorMessage);
            case StartRecordingErrorCode.drmProtected:
                return new DrmProtectedStreamError();
        }
    }

    private _requestActiveTab(tabId: number, src: string) {
        const command: ExtensionToVideoCommand<RequestActiveTabPermissionMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'request-active-tab-permission',
            },
            src,
        };
        void browser.tabs.sendMessage(tabId, command);
    }

    async stop(encodeAsMp3: boolean, requester: Requester): Promise<string> {
        const audioBase64Promise = this.audioBase64Promise; // Audio delivery can clear the shared promise before the stop acknowledgment arrives.
        if (audioBase64Promise === undefined) {
            // Benign no-op: If the user spams cancel on a bulk export,
            // we can get a cancel request on a non-recording state.
            this._notifyRecordingFinished(requester);
            throw new NoRecordingInProgressServiceError();
        }

        const response = await this._delegate.stop(encodeAsMp3, requester);

        if (!response.stopped) {
            if (response.error!.code === StopRecordingErrorCode.timedAudioRecordingInProgress) {
                throw new TimedRecordingInProgressError();
            }

            const errorMessage = `Failed to stop audio recording: ${response.error!.message}`;
            this._notifyError(errorMessage, requester);
            throw new Error(errorMessage);
        }

        this._notifyRecordingFinished(requester);
        return audioBase64Promise;
    }

    private _notifyRecordingStarted({ tabId, src }: Requester) {
        const command: ExtensionToAsbPlayerCommand<RecordingStartedMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'recording-started',
            },
        };
        void this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.sidePanel ? command : undefined),
        });
        const videoCommand: ExtensionToVideoCommand<RecordingStartedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'recording-started',
            },
            src,
        };
        void browser.tabs.sendMessage(tabId, videoCommand);
    }

    private _notifyRecordingFinished({ tabId, src }: Requester) {
        const playerCommand: ExtensionToAsbPlayerCommand<RecordingFinishedMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'recording-finished',
            },
        };
        void this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.sidePanel ? playerCommand : undefined),
        });
        const videoCommand: ExtensionToVideoCommand<RecordingFinishedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'recording-finished',
            },
            src,
        };
        void browser.tabs.sendMessage(tabId, videoCommand);
    }

    private _prepareForAudioDataResponse(requestId: string): Promise<string> {
        if (this.audioBase64Promise !== undefined) {
            this.audioBase64Reject?.(new Error('Audio request superseded by a newer request'));
            this.audioBase64Resolve = undefined;
            this.audioBase64Reject = undefined;
            this.audioBase64Promise = undefined;
            this.currentRecordRequestId = undefined;
        }

        this.audioBase64Promise = new Promise<string>((resolve, reject) => {
            this.audioBase64Resolve = resolve;
            this.audioBase64Reject = reject;
            this.currentRecordRequestId = requestId;
        });
        return this.audioBase64Promise;
    }

    private _notifyError(message: string, { tabId, src }: Requester) {
        const notifyErrorCommand: ExtensionToVideoCommand<NotifyErrorMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'notify-error',
                message: message,
            },
            src,
        };
        void browser.tabs.sendMessage(tabId, notifyErrorCommand);
    }
}
