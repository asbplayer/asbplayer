import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ImageCaptureParams } from '@project/common';
import type AnimatedWebpRecorder from '@project/extension/src/services/animated-webp-recorder';
import type { OffscreenAudioRecorder } from '@project/extension/src/services/audio-recorder-delegate';
import {
    ChromeMediaRecorder,
    recordingInProgressResponse,
} from '@project/extension/src/services/audio-recorder-delegate';

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
const image = { captureParams, armed: false };

describe('ChromeMediaRecorder', () => {
    let audioRecorder: jest.Mocked<OffscreenAudioRecorder>;
    let animatedWebpRecorder: jest.Mocked<AnimatedWebpRecorder>;
    let recorder: ChromeMediaRecorder;

    beforeEach(() => {
        audioRecorder = {
            startWithTimeout: jest.fn(async () => ({ started: true })),
            start: jest.fn(async () => ({ started: true })),
            stop: jest.fn(async () => ({ stopped: true })),
        } as unknown as jest.Mocked<OffscreenAudioRecorder>;
        animatedWebpRecorder = {
            recording: false,
            startWithTimeout: jest.fn(async () => ({ started: true })),
            start: jest.fn(async () => ({ started: true })),
            stop: jest.fn(async () => ({ stopped: true })),
        } as unknown as jest.Mocked<AnimatedWebpRecorder>;
        recorder = new ChromeMediaRecorder(audioRecorder, animatedWebpRecorder);
    });

    it('records audio offscreen when no image is requested', async () => {
        await recorder.startWithTimeout(1000, true, 'id', requester);
        await recorder.stop(true);

        expect(audioRecorder.startWithTimeout).toHaveBeenCalledWith(1000, true, 'id', requester);
        expect(audioRecorder.stop).toHaveBeenCalledWith(true);
        expect(animatedWebpRecorder.startWithTimeout).not.toHaveBeenCalled();
        expect(animatedWebpRecorder.stop).not.toHaveBeenCalled();
    });

    it('records an animated WebP instead when an image is requested, and stops it', async () => {
        await recorder.start('id', requester, image);
        Object.assign(animatedWebpRecorder, { recording: true });
        await recorder.stop(false);

        expect(animatedWebpRecorder.start).toHaveBeenCalledWith(requester, image);
        expect(animatedWebpRecorder.stop).toHaveBeenCalledWith(false);
        expect(audioRecorder.start).not.toHaveBeenCalled();
        expect(audioRecorder.stop).not.toHaveBeenCalled();
    });

    it('declines any recording while an animated WebP is being recorded', async () => {
        Object.assign(animatedWebpRecorder, { recording: true });

        await expect(recorder.startWithTimeout(1000, false, 'id', requester)).resolves.toBe(
            recordingInProgressResponse
        );
        await expect(recorder.start('id', requester, image)).resolves.toBe(recordingInProgressResponse);
        expect(audioRecorder.startWithTimeout).not.toHaveBeenCalled();
        expect(animatedWebpRecorder.start).not.toHaveBeenCalled();
    });
});
