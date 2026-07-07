import {
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
    AudioBase64Message,
    StartRecordingAudioMessage,
    OffscreenDocumentToExtensionCommand,
    StartRecordingResponse,
    StartRecordingErrorCode,
    StopRecordingErrorCode,
    StopRecordingResponse,
    EncodeMp3InServiceWorkerMessage,
} from '@project/common';
import AudioRecorder, { TimedRecordingInProgressError, NoRecordingInProgressError } from '@/services/audio-recorder';
import { Mp3Encoder } from '@project/common/audio-clip';
import { base64ToBlob, bufferToBase64 } from '@project/common/base64';
import { mp3WorkerFactory } from '@/services/mp3-worker-factory';

const audioRecorder = new AudioRecorder();

const _sendAudioBase64 = async (base64: string, requestId: string, encodeAsMp3: boolean) => {
    if (encodeAsMp3) {
        const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
        const mp3Blob = await Mp3Encoder.encode(blob, mp3WorkerFactory);
        base64 = bufferToBase64(await mp3Blob.arrayBuffer());
    }

    const command: OffscreenDocumentToExtensionCommand<AudioBase64Message> = {
        sender: 'asbplayer-offscreen-document',
        message: {
            command: 'audio-base64',
            base64,
            requestId,
        },
    };

    void browser.runtime.sendMessage(command);
};

const _stream: (streamId: string) => Promise<MediaStream> = async (streamId: string) => {
    return navigator.mediaDevices.getUserMedia({
        audio: {
            // @ts-expect-error: The ts declaration is missing mandatory
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
            },
        },
    });
};

let currentRequestId: string | undefined;

const errorResponseForError = (e: any) => {
    let errorCode: StartRecordingErrorCode;

    if (e instanceof DOMException && e.name === 'AbortError') {
        errorCode = StartRecordingErrorCode.noActiveTabPermission;
    } else {
        errorCode = StartRecordingErrorCode.other;
    }

    return {
        started: false,
        error: { code: errorCode, message: e.message },
    };
};

window.onload = async () => {
    const listener = (request: any, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        if (request.sender === 'asbplayer-extension-to-offscreen-document') {
            switch (request.message.command) {
                case 'start-recording-audio-with-timeout': {
                    const startRecordingAudioWithTimeoutMessage =
                        request.message as StartRecordingAudioWithTimeoutMessage;
                    _stream(startRecordingAudioWithTimeoutMessage.streamId)
                        .then((stream) => {
                            return audioRecorder.stopSafely().then(() =>
                                audioRecorder.startWithTimeout(
                                    stream,
                                    startRecordingAudioWithTimeoutMessage.timeout,
                                    () => {
                                        const successResponse: StartRecordingResponse = { started: true };
                                        sendResponse(successResponse);
                                    }
                                )
                            );
                        })
                        .then((audioBase64) =>
                            _sendAudioBase64(
                                audioBase64,
                                startRecordingAudioWithTimeoutMessage.requestId,
                                startRecordingAudioWithTimeoutMessage.encodeAsMp3
                            )
                        )
                        .catch((e) => {
                            console.error(e);
                            sendResponse(errorResponseForError(e));
                        });
                    return true;
                }
                case 'start-recording-audio': {
                    const startRecordingAudioMessage = request.message as StartRecordingAudioMessage;
                    currentRequestId = startRecordingAudioMessage.requestId;
                    _stream(startRecordingAudioMessage.streamId)
                        .then((stream) => audioRecorder.stopSafely().then(() => audioRecorder.start(stream)))
                        .then(() => sendResponse({ started: true }))
                        .catch((e) => {
                            console.error(e);
                            sendResponse(errorResponseForError(e));
                        });
                    return true;
                }
                case 'stop-recording-audio': {
                    const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                    audioRecorder
                        .stop()
                        .then((audioBase64) => {
                            const successResponse: StopRecordingResponse = {
                                stopped: true,
                            };

                            sendResponse(successResponse);
                            void _sendAudioBase64(
                                audioBase64,
                                currentRequestId!,
                                stopRecordingAudioMessage.encodeAsMp3
                            );
                        })
                        .catch((e) => {
                            let errorCode: StopRecordingErrorCode;

                            if (e instanceof TimedRecordingInProgressError) {
                                errorCode = StopRecordingErrorCode.timedAudioRecordingInProgress;
                            } else if (e instanceof NoRecordingInProgressError) {
                                // Just no-op if nothing is recording--this can happen in bulk export.
                                errorCode = StopRecordingErrorCode.other;
                            } else {
                                console.error(e);
                                errorCode = StopRecordingErrorCode.other;
                            }

                            const errorResponse: StopRecordingResponse = {
                                stopped: false,
                                error: {
                                    code: errorCode,
                                    message: e.message,
                                },
                            };

                            sendResponse(errorResponse);
                        });
                    return true;
                }
                case 'encode-mp3': {
                    const encodeMp3Message = request.message as EncodeMp3InServiceWorkerMessage;
                    const { base64, extension } = encodeMp3Message;

                    Mp3Encoder.encode(base64ToBlob(base64, `audio/${extension}`), mp3WorkerFactory)
                        .then((blob) => blob.arrayBuffer())
                        .then((buffer) => sendResponse(bufferToBase64(buffer)))
                        .catch(console.error);
                    return true;
                }
            }
        }
    };
    browser.runtime.onMessage.addListener(listener);

    window.addEventListener('beforeunload', () => {
        browser.runtime.onMessage.removeListener(listener);
    });
};
