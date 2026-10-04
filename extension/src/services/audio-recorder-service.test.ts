import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ImageCaptureParams, RecordAnimatedWebpResponse } from '@project/common';
import type { AudioRecorderDelegate } from '@project/extension/src/services/audio-recorder-delegate';
import AudioRecorderService, {
    NoRecordingInProgressServiceError,
    RecordingInProgressError,
    TimedRecordingInProgressError,
} from '@project/extension/src/services/audio-recorder-service';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import * as videoCapturer from '@project/extension/src/services/video-capturer';

jest.mock('@project/extension/src/services/video-capturer');

const requester = { tabId: 1, src: 'blob:video' };
const captureParams: ImageCaptureParams = {
    maxWidth: 0,
    maxHeight: 0,
    rect: { left: 0, top: 0, width: 100, height: 100 },
    trimBlackBars: false,
};
const negotiation = { streamId: 'stream', fps: 10, quality: 0.85 };
const webp: RecordAnimatedWebpResponse = { base64: 'webp', audioBase64: 'audio' };

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('AudioRecorderService', () => {
    const capturer = jest.mocked(videoCapturer);
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

    describe('timed animated WebP', () => {
        it('resolves with the capture and signals the recording started and finished', async () => {
            capturer.recordAnimatedWebp.mockResolvedValue(webp);

            await expect(
                service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester, negotiation)
            ).resolves.toEqual(webp);

            expect(signals()).toEqual(['recording-started', 'recording-finished']);
            expect(service.animatedWebpRecording).toBe(false);
        });

        it('finishes the recording even when the capture fails', async () => {
            capturer.recordAnimatedWebp.mockRejectedValue(new Error('capture failed'));

            await expect(
                service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester, negotiation)
            ).rejects.toThrow('capture failed');

            expect(signals()).toEqual(['recording-started', 'recording-finished']);
            expect(service.animatedWebpRecording).toBe(false);
        });

        it('rejects a second recording while one is in progress and leaves the first alone', async () => {
            const first = deferred<RecordAnimatedWebpResponse>();
            capturer.recordAnimatedWebp.mockReturnValue(first.promise);
            const firstRecording = service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester);

            await expect(
                service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester)
            ).rejects.toBeInstanceOf(RecordingInProgressError);
            expect(capturer.recordAnimatedWebp).toHaveBeenCalledTimes(1);
            expect(service.animatedWebpRecording).toBe(true);

            first.resolve(webp);
            await expect(firstRecording).resolves.toEqual(webp);
            expect(service.animatedWebpRecording).toBe(false);
        });

        it('rejects while audio is being recorded', async () => {
            await service.start(requester);

            await expect(
                service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester)
            ).rejects.toBeInstanceOf(RecordingInProgressError);
            expect(capturer.recordAnimatedWebp).not.toHaveBeenCalled();
        });

        it('lets the requester leave its recording-requested state when rejected', async () => {
            capturer.recordAnimatedWebp.mockReturnValue(deferred<RecordAnimatedWebpResponse>().promise);
            void service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester);
            sendMessage.mockClear();

            await expect(
                service.recordAnimatedWebpWithTimeout(1000, true, captureParams, { tabId: 2, src: 'blob:other' })
            ).rejects.toBeInstanceOf(RecordingInProgressError);

            const finishedForOtherTab = sendMessage.mock.calls.filter(
                ([tabId, command]) => tabId === 2 && command.message.command === 'recording-finished'
            );
            expect(finishedForOtherTab).toHaveLength(1);
        });

        it('renegotiates the stream and retries when the armed capture was discarded', async () => {
            const missing: RecordAnimatedWebpResponse = { base64: '', error: 'gone', armedCaptureMissing: true };
            capturer.recordAnimatedWebp.mockResolvedValueOnce(missing).mockResolvedValueOnce(webp);
            const renegotiate = jest.fn(async () => negotiation);

            await expect(
                service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester, undefined, renegotiate)
            ).resolves.toEqual(webp);

            expect(renegotiate).toHaveBeenCalledTimes(1);
            expect(capturer.recordAnimatedWebp).toHaveBeenCalledTimes(2);
            expect(capturer.recordAnimatedWebp.mock.calls[0][5]).toBeUndefined();
            expect(capturer.recordAnimatedWebp.mock.calls[1][5]).toEqual(negotiation);
            // One continuous recording as far as the video is concerned
            expect(signals()).toEqual(['recording-started', 'recording-finished']);
        });

        it('does not renegotiate when the capture succeeded', async () => {
            capturer.recordAnimatedWebp.mockResolvedValue(webp);
            const renegotiate = jest.fn(async () => negotiation);

            await service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester, undefined, renegotiate);

            expect(renegotiate).not.toHaveBeenCalled();
            expect(capturer.recordAnimatedWebp).toHaveBeenCalledTimes(1);
        });

        it('is cut short by stopping, which leaves publishing to the original caller', async () => {
            const capture = deferred<RecordAnimatedWebpResponse>();
            capturer.recordAnimatedWebp.mockReturnValue(capture.promise);
            capturer.stopAnimatedWebp.mockResolvedValue(webp);
            const recording = service.recordAnimatedWebpWithTimeout(1000, true, captureParams, requester);

            await expect(service.stopAnimatedWebp(requester)).rejects.toBeInstanceOf(TimedRecordingInProgressError);
            expect(capturer.stopAnimatedWebp).toHaveBeenCalledWith(requester.tabId, requester.src);
            expect(service.animatedWebpRecording).toBe(true);

            capture.resolve(webp);
            await expect(recording).resolves.toEqual(webp);
            expect(service.animatedWebpRecording).toBe(false);
        });
    });

    describe('manual animated WebP', () => {
        it('starts, then collects the capture on stop', async () => {
            capturer.startAnimatedWebp.mockResolvedValue({ started: true });
            capturer.stopAnimatedWebp.mockResolvedValue(webp);

            await service.startAnimatedWebp(true, captureParams, requester, negotiation);
            expect(service.animatedWebpRecording).toBe(true);
            expect(signals()).toEqual(['recording-started']);

            await expect(service.stopAnimatedWebp(requester)).resolves.toEqual(webp);
            expect(service.animatedWebpRecording).toBe(false);
            expect(signals()).toEqual(['recording-started', 'recording-finished']);
        });

        it('rejects a second start while recording', async () => {
            capturer.startAnimatedWebp.mockResolvedValue({ started: true });
            await service.startAnimatedWebp(true, captureParams, requester, negotiation);

            await expect(service.startAnimatedWebp(true, captureParams, requester, negotiation)).rejects.toBeInstanceOf(
                RecordingInProgressError
            );
            expect(capturer.startAnimatedWebp).toHaveBeenCalledTimes(1);
        });

        it('rejects an audio recording while recording', async () => {
            capturer.startAnimatedWebp.mockResolvedValue({ started: true });
            await service.startAnimatedWebp(true, captureParams, requester, negotiation);

            await expect(service.start(requester)).rejects.toBeInstanceOf(RecordingInProgressError);
            await expect(service.startWithTimeout(1000, false, requester)).rejects.toBeInstanceOf(
                RecordingInProgressError
            );
            expect(delegate.start).not.toHaveBeenCalled();
            expect(delegate.startWithTimeout).not.toHaveBeenCalled();
        });

        it('lets the requester recover when the capture fails to start', async () => {
            capturer.startAnimatedWebp.mockResolvedValue({ started: false, error: 'no stream' });

            await expect(service.startAnimatedWebp(true, captureParams, requester, negotiation)).rejects.toThrow(
                'no stream'
            );

            expect(service.animatedWebpRecording).toBe(false);
            expect(signals()).toEqual(['recording-finished']);
        });

        it('treats stopping with nothing recording as a benign no-op', async () => {
            await expect(service.stopAnimatedWebp(requester)).rejects.toBeInstanceOf(NoRecordingInProgressServiceError);
            expect(signals()).toEqual(['recording-finished']);
        });
    });
});
