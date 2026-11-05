import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ImageCaptureParams } from '@project/common';
import { AudioErrorCode, StartRecordingErrorCode, StopRecordingErrorCode } from '@project/common';
import type { AudioRecorderDelegate, RecordedMedia } from '@project/extension/src/services/audio-recorder-delegate';
import AudioRecorderService, {
    NoRecordingInProgressServiceError,
    RecordingInProgressError,
    TimedRecordingInProgressError,
} from '@project/extension/src/services/audio-recorder-service';
import type TabRegistry from '@project/extension/src/services/tab-registry';

const requester = { tabId: 1, src: 'blob:video' };
const captureParams: ImageCaptureParams = {
    maxWidth: 0,
    maxHeight: 0,
    rect: { left: 0, top: 0, width: 100, height: 100 },
    trimBlackBars: false,
};
const image = { captureParams, armed: false };
const media: RecordedMedia = { audioBase64: 'audio', image: { base64: 'webp', extension: 'webp', animated: true } };
const recordingInProgressResponse = {
    started: false,
    error: { code: StartRecordingErrorCode.recordingInProgress, message: 'Another recording is already in progress' },
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AudioRecorderService', () => {
    let sendMessage: jest.Mock<(tabId: number, command: any) => Promise<unknown>>;
    let delegate: jest.Mocked<AudioRecorderDelegate>;
    let service: AudioRecorderService;

    // Recording state changes the service signals to the video that requested the recording
    const signals = () =>
        sendMessage.mock.calls
            .map(([, command]) => command.message.command as string)
            .filter((command) => command === 'recording-started' || command === 'recording-finished');

    beforeEach(() => {
        sendMessage = jest.fn(async () => undefined);
        (globalThis as any).browser = { tabs: { sendMessage } };
        delegate = {
            startWithTimeout: jest.fn(async () => ({ started: true })),
            start: jest.fn(async () => ({ started: true })),
            stop: jest.fn(async () => ({ stopped: true })),
        };
        service = new AudioRecorderService(
            { publishCommandToAsbplayers: jest.fn(async () => undefined) } as unknown as TabRegistry,
            delegate
        );
    });

    afterEach(() => {
        jest.resetAllMocks();
        delete (globalThis as any).browser;
    });

    describe('recording result', () => {
        it('resolves with the audio delivered by message, without an image', async () => {
            const recording = service.startWithTimeout(1000, false, requester);
            await flush();
            const requestId = delegate.startWithTimeout.mock.calls[0][2];

            service.onAudioBase64('audio', requestId);

            await expect(recording).resolves.toEqual({ audioBase64: 'audio', image: null });
        });

        it('resolves with the animated WebP delivered along with the audio', async () => {
            const recording = service.startWithTimeout(1000, false, requester, image);
            await flush();
            const requestId = delegate.startWithTimeout.mock.calls[0][2];

            service.onAudioBase64('audio', requestId, { base64: 'webp' });

            await expect(recording).resolves.toEqual(media);
        });

        it('resolves with the audio error delivered along with the recording', async () => {
            const recording = service.startWithTimeout(1000, false, requester, image);
            await flush();
            const requestId = delegate.startWithTimeout.mock.calls[0][2];

            service.onAudioBase64('', requestId, { base64: 'webp' }, AudioErrorCode.captureFailed);

            await expect(recording).resolves.toEqual({
                ...media,
                audioBase64: '',
                audioError: AudioErrorCode.captureFailed,
            });
        });

        it('returns the recording delivered after a manual recording is stopped', async () => {
            delegate.stop.mockImplementation(async () => {
                service.onAudioBase64('audio', delegate.start.mock.calls[0][0], { base64: 'webp' });
                return { stopped: true };
            });

            await service.start(requester, image);
            expect(delegate.start.mock.calls[0][2]).toEqual(image);
            expect(signals()).toEqual(['recording-started']);

            await expect(service.stop(false, requester)).resolves.toEqual(media);
            expect(signals()).toEqual(['recording-started', 'recording-finished']);
        });
    });

    describe('concurrent recordings', () => {
        it('lets a new audio-only recording replace a pending audio-only one', async () => {
            const first = expect(service.startWithTimeout(1000, false, requester)).rejects.toThrow('superseded');
            await flush();

            const second = service.startWithTimeout(1000, false, requester);
            await flush();

            await first;
            expect(delegate.startWithTimeout).toHaveBeenCalledTimes(2);
            service.onAudioBase64('audio', delegate.startWithTimeout.mock.calls[1][2]);
            await expect(second).resolves.toEqual({ audioBase64: 'audio', image: null });
        });

        it('declines with an error notification when the recorder reports a recording in progress', async () => {
            delegate.startWithTimeout.mockResolvedValue(recordingInProgressResponse);
            delegate.start.mockResolvedValue(recordingInProgressResponse);

            await expect(service.startWithTimeout(1000, false, requester, image)).rejects.toBeInstanceOf(
                RecordingInProgressError
            );
            await expect(service.start(requester)).rejects.toBeInstanceOf(RecordingInProgressError);

            const errors = sendMessage.mock.calls.filter(([, command]) => command.message.command === 'notify-error');
            expect(errors).toHaveLength(2);
            // Lets the requester leave its recording-requested state
            expect(signals()).toEqual(['recording-finished', 'recording-finished']);
        });

        it('leaves a pending recording alone when a new one is declined', async () => {
            delegate.startWithTimeout
                .mockResolvedValueOnce({ started: true })
                .mockResolvedValueOnce(recordingInProgressResponse);
            const recording = service.startWithTimeout(1000, false, requester, image);
            await flush();

            await expect(service.startWithTimeout(1000, false, requester)).rejects.toBeInstanceOf(
                RecordingInProgressError
            );

            service.onAudioBase64('audio', delegate.startWithTimeout.mock.calls[0][2], { base64: 'webp' });
            await expect(recording).resolves.toEqual(media);
        });

        it('lets the requester recover when a recording fails to start', async () => {
            delegate.start.mockResolvedValueOnce({
                started: false,
                error: { code: StartRecordingErrorCode.other, message: 'no stream' },
            });

            await expect(service.start(requester, image)).rejects.toThrow('no stream');
            expect(signals()).toEqual(['recording-finished']);
        });
    });

    describe('stop', () => {
        it('leaves publishing to the original caller when a timed recording is cut short', async () => {
            delegate.stop.mockResolvedValue({
                stopped: false,
                error: { code: StopRecordingErrorCode.timedAudioRecordingInProgress, message: 'timed' },
            });
            const recording = service.startWithTimeout(1000, false, requester, image);
            await flush();

            await expect(service.stop(false, requester)).rejects.toBeInstanceOf(TimedRecordingInProgressError);

            service.onAudioBase64('audio', delegate.startWithTimeout.mock.calls[0][2], { base64: 'webp' });
            await expect(recording).resolves.toEqual(media);
        });

        it('treats stopping with nothing recording as a benign no-op', async () => {
            await expect(service.stop(false, requester)).rejects.toBeInstanceOf(NoRecordingInProgressServiceError);
            expect(delegate.stop).not.toHaveBeenCalled();
            expect(signals()).toEqual(['recording-finished']);
        });
    });
});
