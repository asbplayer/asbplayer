import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ImageCaptureParams, RecordAnimatedWebpResponse } from '@project/common';
import { StopRecordingErrorCode } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import AnimatedWebpRecorder from '@project/extension/src/services/animated-webp-recorder';
import * as animatedWebpMedia from '@project/extension/src/services/animated-webp-media';
import * as videoCapturer from '@project/extension/src/services/video-capturer';

jest.mock('@project/extension/src/services/video-capturer');
jest.mock('@project/extension/src/services/animated-webp-media', () => ({ negotiateAnimatedWebp: jest.fn() }));
jest.mock('@project/extension/src/services/offscreen-document', () => ({
    ensureOffscreenAudioServiceDocument: jest.fn(async () => undefined),
}));

const requester = { tabId: 1, src: 'blob:video' };
const captureParams: ImageCaptureParams = {
    maxWidth: 0,
    maxHeight: 0,
    rect: { left: 0, top: 0, width: 100, height: 100 },
    trimBlackBars: false,
};
const negotiation = { streamId: 'stream', fps: 10, quality: 0.85 };
const webp: RecordAnimatedWebpResponse = { base64: 'webp', audioBase64: 'audio' };
const media = { audioBase64: 'audio', image: { base64: 'webp', extension: 'webp' } };

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

describe('AnimatedWebpRecorder', () => {
    const capturer = jest.mocked(videoCapturer);
    const negotiate = jest.mocked(animatedWebpMedia.negotiateAnimatedWebp);
    let sendMessage: jest.Mock<(command: any) => Promise<unknown>>;
    let recorder: AnimatedWebpRecorder;

    beforeEach(() => {
        sendMessage = jest.fn(async () => 'mp3');
        (globalThis as any).browser = { runtime: { sendMessage } };
        negotiate.mockResolvedValue(negotiation);
        recorder = new AnimatedWebpRecorder({} as SettingsProvider);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
        delete (globalThis as any).browser;
    });

    describe('timed', () => {
        it('starts right away and hands back the clip and its audio', async () => {
            capturer.recordAnimatedWebp.mockResolvedValue(webp);

            const response = await recorder.startWithTimeout(1000, false, requester, { captureParams, armed: false });

            expect(response.started).toBe(true);
            await expect(response.result).resolves.toEqual(media);
            expect(capturer.recordAnimatedWebp).toHaveBeenCalledWith(
                requester.tabId,
                requester.src,
                1000,
                true,
                captureParams,
                negotiation
            );
        });

        it('uses the capture armed by the content script instead of negotiating a stream', async () => {
            capturer.recordAnimatedWebp.mockResolvedValue(webp);

            const response = await recorder.startWithTimeout(1000, false, requester, { captureParams, armed: true });
            await response.result;

            expect(negotiate).not.toHaveBeenCalled();
            expect(capturer.recordAnimatedWebp.mock.calls[0][5]).toBeUndefined();
        });

        it('negotiates a stream and retries when the armed capture was discarded', async () => {
            const missing: RecordAnimatedWebpResponse = { base64: '', error: 'gone', armedCaptureMissing: true };
            capturer.recordAnimatedWebp.mockResolvedValueOnce(missing).mockResolvedValueOnce(webp);

            const response = await recorder.startWithTimeout(1000, false, requester, { captureParams, armed: true });

            await expect(response.result).resolves.toEqual(media);
            expect(negotiate).toHaveBeenCalledTimes(1);
            expect(capturer.recordAnimatedWebp).toHaveBeenCalledTimes(2);
            expect(capturer.recordAnimatedWebp.mock.calls[1][5]).toEqual(negotiation);
        });

        it('hands back an empty image when the capture fails', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            capturer.recordAnimatedWebp.mockRejectedValue(new Error('capture failed'));

            const response = await recorder.startWithTimeout(1000, false, requester, { captureParams, armed: true });

            await expect(response.result).resolves.toEqual({
                audioBase64: '',
                image: { base64: '', extension: 'webp' },
            });
        });

        it('encodes the audio as mp3 when asked to', async () => {
            capturer.recordAnimatedWebp.mockResolvedValue(webp);

            const response = await recorder.startWithTimeout(1000, true, requester, { captureParams, armed: true });

            await expect(response.result).resolves.toEqual({ ...media, audioBase64: 'mp3' });
            expect(sendMessage.mock.calls[0][0].message).toEqual({
                command: 'encode-mp3',
                base64: 'audio',
                extension: 'webm',
            });
        });

        it('is cut short by stopping, which leaves the clip to the original request', async () => {
            const capture = deferred<RecordAnimatedWebpResponse>();
            capturer.recordAnimatedWebp.mockReturnValue(capture.promise);
            capturer.stopAnimatedWebp.mockResolvedValue(webp);
            const response = await recorder.startWithTimeout(1000, false, requester, { captureParams, armed: true });

            await expect(recorder.stop(false)).resolves.toEqual({
                stopped: false,
                error: { code: StopRecordingErrorCode.timedAudioRecordingInProgress, message: expect.any(String) },
            });
            expect(capturer.stopAnimatedWebp).toHaveBeenCalledWith(requester.tabId, requester.src);

            capture.resolve(webp);
            await expect(response.result).resolves.toEqual(media);
        });
    });

    describe('manual', () => {
        it('starts, then hands back the clip on stop', async () => {
            capturer.startAnimatedWebp.mockResolvedValue({ started: true });
            capturer.stopAnimatedWebp.mockResolvedValue(webp);

            const response = await recorder.start(requester, { captureParams, armed: false });
            expect(response.started).toBe(true);
            expect(capturer.startAnimatedWebp).toHaveBeenCalledWith(
                requester.tabId,
                requester.src,
                true,
                captureParams,
                negotiation
            );

            await expect(recorder.stop(false)).resolves.toEqual({ stopped: true });
            await expect(response.result).resolves.toEqual(media);
        });

        it('reports a failed start', async () => {
            capturer.startAnimatedWebp.mockResolvedValue({ started: false, error: 'no stream' });

            const response = await recorder.start(requester, { captureParams, armed: false });

            expect(response.started).toBe(false);
            expect(response.error?.message).toBe('no stream');
            expect(response.result).toBeUndefined();
        });

        it('reports stopping with nothing recording', async () => {
            await expect(recorder.stop(false)).resolves.toMatchObject({
                stopped: false,
                error: { code: StopRecordingErrorCode.other },
            });
            expect(capturer.stopAnimatedWebp).not.toHaveBeenCalled();
        });
    });
});
