import type {
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    NotifyErrorMessage,
    RecordingFinishedMessage,
    RecordingStartedMessage,
    RequestActiveTabPermissionMessage,
    StartRecordingResponse,
} from '@project/common';
import { StartRecordingErrorCode, StopRecordingErrorCode } from '@project/common';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type {
    AudioRecorderDelegate,
    ImageRecordingRequest,
    RecordedMedia,
} from '@project/extension/src/services/audio-recorder-delegate';
import { v4 as uuidv4 } from 'uuid';

interface Requester {
    tabId: number;
    src: string;
}

export class DrmProtectedStreamError extends Error {}

export class TimedRecordingInProgressError extends Error {}

export class NoRecordingInProgressServiceError extends Error {}

export class RecordingInProgressError extends Error {}

export default class AudioRecorderService {
    private readonly _tabRegistry: TabRegistry;
    private readonly _delegate: AudioRecorderDelegate;

    private mediaPromise?: Promise<RecordedMedia>;
    private mediaResolve?: (value: RecordedMedia) => void;
    private mediaReject?: (error: any) => void;
    private currentRecordRequestId: string | undefined;
    // Set while a recording that also captures an image is starting or in progress. It holds the tab's only
    // tabCapture stream, so nothing else can start until it's done.
    private imageRecordingRequestId: string | undefined;

    constructor(tabRegistry: TabRegistry, delegate: AudioRecorderDelegate) {
        this._tabRegistry = tabRegistry;
        this._delegate = delegate;
    }

    onAudioBase64(base64: string, requestId: string) {
        this._onRecordedMedia({ audioBase64: base64, image: null }, requestId);
    }

    private _onRecordedMedia(media: RecordedMedia, requestId: string) {
        if (this.currentRecordRequestId === requestId) {
            this.mediaResolve?.(media);
            this._clearPendingMedia();
        }
    }

    private _onRecordingFailed(error: any, requestId: string) {
        if (this.currentRecordRequestId === requestId) {
            this.mediaReject?.(error);
            this._clearPendingMedia();
        }
    }

    private _clearPendingMedia() {
        this.mediaResolve = undefined;
        this.mediaPromise = undefined;
        this.mediaReject = undefined;
        this.currentRecordRequestId = undefined;
    }

    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requester: Requester,
        image?: ImageRecordingRequest
    ): Promise<RecordedMedia> {
        const requestId = uuidv4();

        try {
            this._assertCanStart(requestId, requester, image);
            const response = await this._delegate.startWithTimeout(time, encodeAsMp3, requestId, requester, image);

            if (response.started) {
                this._notifyRecordingStarted(requester);
                return await this._prepareForMediaResponse(requestId, response.result);
            }

            throw this._handleStartError(response, requester);
        } finally {
            this._endImageRecording(requestId);
            this._notifyRecordingFinished(requester);
        }
    }

    async start(requester: Requester, image?: ImageRecordingRequest) {
        const requestId = uuidv4();

        try {
            this._assertCanStart(requestId, requester, image);
            const response = await this._delegate.start(requestId, requester, image);

            if (!response.started) {
                throw this._handleStartError(response, requester);
            }

            const end = () => this._endImageRecording(requestId);
            void this._prepareForMediaResponse(requestId, response.result).then(end, end);
            this._notifyRecordingStarted(requester);
        } catch (e) {
            this._endImageRecording(requestId);
            this._notifyRecordingFinished(requester);
            throw e;
        }
    }

    // A new audio-only recording replaces a pending audio-only one, but a recording that captures an image
    // can't be replaced or replace another one, since the tab can only be captured once at a time.
    private _assertCanStart(requestId: string, requester: Requester, image?: ImageRecordingRequest) {
        if (this.imageRecordingRequestId !== undefined || (image !== undefined && this.mediaPromise !== undefined)) {
            throw this._recordingInProgress(requester);
        }

        if (image !== undefined) {
            this.imageRecordingRequestId = requestId;
        }
    }

    private _endImageRecording(requestId: string) {
        if (this.imageRecordingRequestId === requestId) {
            this.imageRecordingRequestId = undefined;
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

    async stop(encodeAsMp3: boolean, requester: Requester): Promise<RecordedMedia> {
        const mediaPromise = this.mediaPromise; // Media delivery can clear the shared promise before the stop acknowledgment arrives.
        if (mediaPromise === undefined) {
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
        return mediaPromise;
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

    // The recording arrives either through `result`, when the delegate produces it in the background page, or
    // later through onAudioBase64.
    private _prepareForMediaResponse(requestId: string, result?: Promise<RecordedMedia>): Promise<RecordedMedia> {
        if (this.mediaPromise !== undefined) {
            this.mediaReject?.(new Error('Audio request superseded by a newer request'));
            this._clearPendingMedia();
        }

        this.mediaPromise = new Promise<RecordedMedia>((resolve, reject) => {
            this.mediaResolve = resolve;
            this.mediaReject = reject;
            this.currentRecordRequestId = requestId;
        });
        const mediaPromise = this.mediaPromise;
        void result?.then(
            (media) => this._onRecordedMedia(media, requestId),
            (e) => this._onRecordingFailed(e, requestId)
        );
        return mediaPromise;
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
