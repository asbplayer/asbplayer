import {
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    NotifyErrorMessage,
    RecordingFinishedMessage,
    RecordingStartedMessage,
    RequestActiveTabPermissionMessage,
    StartRecordingErrorCode,
    StartRecordingResponse,
    StopRecordingErrorCode,
} from '@project/common';
import TabRegistry from './tab-registry';
import { AudioRecorderDelegate } from './audio-recorder-delegate';
import { v4 as uuidv4 } from 'uuid';

interface Requester {
    tabId: number;
    src: string;
}

export class DrmProtectedStreamError extends Error {}

export class TimedRecordingInProgressError extends Error {}

export class NoRecordingInProgressServiceError extends Error {}

export default class AudioRecorderService {
    private readonly _tabRegistry: TabRegistry;
    private readonly _delegate: AudioRecorderDelegate;

    private audioBase64Promise?: Promise<string>;
    private audioBase64Resolve?: (value: string) => void;
    private audioBase64Reject?: (error: any) => void;
    private currentRecordRequestId: string | undefined;

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
        if (this.audioBase64Promise === undefined) {
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
        return this.audioBase64Promise;
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
