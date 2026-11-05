import { asbError } from '@project/common/util/log';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';
import type {
    StartRecordingAudioWithTimeoutMessage,
    StopRecordingAudioMessage,
    AudioBase64Message,
    StartRecordingAudioMessage,
    OffscreenDocumentToExtensionCommand,
    StartRecordingResponse,
    StopRecordingResponse,
    EncodeMp3InServiceWorkerMessage,
    AnimatedWebpCaptureRequest,
    ArmAnimatedWebpCaptureMessage,
    ArmAnimatedWebpCaptureResponse,
} from '@project/common';
import { AudioErrorCode, StartRecordingErrorCode, StopRecordingErrorCode } from '@project/common';
import AudioRecorder, { TimedRecordingInProgressError, NoRecordingInProgressError } from '@/services/audio-recorder';
import type { AnimatedWebpResult } from '@/services/animated-webp-capture';
import {
    activeAnimatedWebpCapture,
    armAnimatedWebpCapture,
    releaseAnimatedWebpCapture,
    startAnimatedWebpCapture,
    takeArmedAnimatedWebpCapture,
} from '@/services/animated-webp-capture';
import { Mp3Encoder } from '@project/common/audio-clip';
import { base64ToBlob, bufferToBase64 } from '@project/common/base64';
import { mp3WorkerFactory } from '@/services/mp3-worker-factory';

configureExtensionLogProvider();

const audioRecorder = new AudioRecorder();

const _encodeMp3 = async (base64: string) => {
    const blob = await (await fetch('data:audio/webm;base64,' + base64)).blob();
    const mp3Blob = await Mp3Encoder.encode(blob, mp3WorkerFactory);
    return bufferToBase64(await mp3Blob.arrayBuffer());
};

const _sendAudioBase64 = async (base64: string, requestId: string, encodeAsMp3: boolean) => {
    if (encodeAsMp3) {
        base64 = await _encodeMp3(base64);
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

// Set while an animated WebP capture is starting or in progress. It holds the tab capture for its whole duration.
let animatedWebpBusy = false;

const recordingInProgressResponse: StartRecordingResponse = {
    started: false,
    error: { code: StartRecordingErrorCode.recordingInProgress, message: 'Another recording is already in progress' },
};

const armedCaptureMissingResponse: StartRecordingResponse = {
    started: false,
    armedCaptureMissing: true,
    error: { code: StartRecordingErrorCode.other, message: 'The armed animated WebP capture is gone' },
};

// Audio-only recordings replace each other, but a recording that captures an image can't replace another one or be
// replaced, since it holds the tab capture until it's done.
const _canStart = (image: boolean) =>
    !animatedWebpBusy && activeAnimatedWebpCapture() === undefined && !(image && audioRecorder.isRecording);

// Uses the capture armed ahead of the mining seek, or arms one from streamId. Resolves to undefined when there's
// neither, so the sender can ask again with a stream id.
const _startAnimatedWebpCapture = async (
    image: AnimatedWebpCaptureRequest,
    streamId: string | undefined,
    durationMs?: number
) => {
    let capture = takeArmedAnimatedWebpCapture();

    if (capture === undefined) {
        if (streamId === undefined) {
            return undefined;
        }

        await armAnimatedWebpCapture(streamId, image.fps, image.quality, true, image.viewport);
        capture = takeArmedAnimatedWebpCapture()!;
    }

    const { viewport, rect, maxWidth, maxHeight } = image;
    return startAnimatedWebpCapture(capture, { durationMs, viewport, rect, maxWidth, maxHeight, playAudio: true });
};

const failedAnimatedWebp: AnimatedWebpResult = { base64: '' };

const _sendAnimatedWebp = async (recording: Promise<AnimatedWebpResult>, requestId: string, encodeAsMp3: boolean) => {
    const { base64, audioBase64, imageError } = await recording.catch((e) => {
        asbError('recording/animated-webp', e);
        return failedAnimatedWebp;
    });

    if (imageError) {
        asbError('recording/animated-webp', imageError);
    }

    let audio = audioBase64 ?? '';

    if (audio && encodeAsMp3) {
        try {
            audio = await _encodeMp3(audio);
        } catch (e) {
            asbError('recording/encoding', e);
            audio = '';
        }
    }

    const command: OffscreenDocumentToExtensionCommand<AudioBase64Message> = {
        sender: 'asbplayer-offscreen-document',
        message: {
            command: 'audio-base64',
            base64: audio,
            requestId,
            image: { base64 },
            audioError: audio ? undefined : AudioErrorCode.captureFailed,
        },
    };

    void browser.runtime.sendMessage(command);
};

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
                case 'arm-animated-webp-capture': {
                    const armMessage = request.message as ArmAnimatedWebpCaptureMessage;

                    if (!_canStart(true)) {
                        const response: ArmAnimatedWebpCaptureResponse = {
                            armed: false,
                            error: 'Recording in progress',
                        };
                        sendResponse(response);
                        return true;
                    }

                    armAnimatedWebpCapture(
                        armMessage.streamId,
                        armMessage.fps,
                        armMessage.quality,
                        true,
                        armMessage.viewport
                    ).then(
                        () => sendResponse({ armed: true }),
                        (e) => {
                            asbError('recording/animated-webp', e);
                            sendResponse({ armed: false, error: String(e?.message ?? e) });
                        }
                    );
                    return true;
                }
                case 'start-recording-audio-with-timeout': {
                    const startRecordingAudioWithTimeoutMessage =
                        request.message as StartRecordingAudioWithTimeoutMessage;
                    const { image, streamId, requestId, encodeAsMp3, timeout } = startRecordingAudioWithTimeoutMessage;

                    if (!_canStart(image !== undefined)) {
                        sendResponse(recordingInProgressResponse);
                        return true;
                    }

                    if (image !== undefined) {
                        animatedWebpBusy = true;
                        _startAnimatedWebpCapture(image, streamId, timeout)
                            .then((capture) => {
                                if (capture === undefined) {
                                    sendResponse(armedCaptureMissingResponse);
                                    return;
                                }

                                sendResponse({ started: true });
                                return _sendAnimatedWebp(capture.result, requestId, encodeAsMp3);
                            })
                            .catch((e) => {
                                asbError('recording/animated-webp', e);
                                sendResponse(errorResponseForError(e));
                            })
                            .finally(() => {
                                animatedWebpBusy = false;
                            });
                        return true;
                    }

                    _stream(streamId!)
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
                            asbError('recording/audio', e);
                            sendResponse(errorResponseForError(e));
                        });
                    return true;
                }
                case 'start-recording-audio': {
                    const startRecordingAudioMessage = request.message as StartRecordingAudioMessage;
                    const { image, streamId } = startRecordingAudioMessage;

                    if (!_canStart(image !== undefined)) {
                        sendResponse(recordingInProgressResponse);
                        return true;
                    }

                    currentRequestId = startRecordingAudioMessage.requestId;

                    if (image !== undefined) {
                        // Collected and released on stop
                        animatedWebpBusy = true;
                        _startAnimatedWebpCapture(image, streamId)
                            .then((capture) => {
                                if (capture === undefined) {
                                    animatedWebpBusy = false;
                                    sendResponse(armedCaptureMissingResponse);
                                    return;
                                }

                                sendResponse({ started: true });
                            })
                            .catch((e) => {
                                animatedWebpBusy = false;
                                asbError('recording/animated-webp', e);
                                sendResponse(errorResponseForError(e));
                            });
                        return true;
                    }

                    _stream(streamId!)
                        .then((stream) => audioRecorder.stopSafely().then(() => audioRecorder.start(stream)))
                        .then(() => sendResponse({ started: true }))
                        .catch((e) => {
                            asbError('recording/audio', e);
                            sendResponse(errorResponseForError(e));
                        });
                    return true;
                }
                case 'stop-recording-audio': {
                    const stopRecordingAudioMessage = request.message as StopRecordingAudioMessage;
                    const animatedWebpCapture = activeAnimatedWebpCapture();

                    if (animatedWebpCapture !== undefined) {
                        animatedWebpCapture.stop();

                        if (animatedWebpCapture.timed) {
                            // Cut short. The timed recording still sends its own result.
                            const response: StopRecordingResponse = {
                                stopped: false,
                                error: {
                                    code: StopRecordingErrorCode.timedAudioRecordingInProgress,
                                    message: 'Timed recording in progress',
                                },
                            };
                            sendResponse(response);
                            return true;
                        }

                        sendResponse({ stopped: true });
                        void _sendAnimatedWebp(
                            animatedWebpCapture.result,
                            currentRequestId!,
                            stopRecordingAudioMessage.encodeAsMp3
                        ).finally(() => {
                            releaseAnimatedWebpCapture(animatedWebpCapture);
                            animatedWebpBusy = false;
                        });
                        return true;
                    }

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
                                asbError('recording/audio', e);
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
                        .catch((error) => asbError('recording/encoding', error));
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
