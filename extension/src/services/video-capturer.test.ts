import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ImageCaptureParams } from '@project/common';
import {
    ArmedCaptureMissingError,
    recordAnimatedWebp,
    stopAnimatedWebp,
} from '@project/extension/src/services/video-capturer';

const captureParams: ImageCaptureParams = {
    maxWidth: 0,
    maxHeight: 0,
    rect: { left: 0, top: 0, width: 100, height: 100 },
    trimBlackBars: false,
};

describe('video capturer', () => {
    let sendMessage: jest.Mock<(tabId: number, command: any) => Promise<unknown>>;

    beforeEach(() => {
        sendMessage = jest.fn(async () => ({ base64: 'webp', audioBase64: 'audio' }));
        (globalThis as any).browser = { tabs: { sendMessage } };
    });

    afterEach(() => {
        delete (globalThis as any).browser;
    });

    it('returns the recorded clip', async () => {
        await expect(recordAnimatedWebp(1, 'blob:video', 1000, true, captureParams)).resolves.toEqual({
            base64: 'webp',
            audioBase64: 'audio',
        });
    });

    it('throws when the content script reports a failed capture', async () => {
        sendMessage.mockResolvedValue({ base64: '', error: 'No frames captured' });

        await expect(recordAnimatedWebp(1, 'blob:video', 1000, true, captureParams)).rejects.toThrow(
            'No frames captured'
        );
        await expect(stopAnimatedWebp(1, 'blob:video')).rejects.toThrow('No frames captured');
    });

    it('returns the audio when only the image failed', async () => {
        sendMessage.mockResolvedValue({ base64: '', audioBase64: 'audio', imageError: 'No frames captured' });

        await expect(recordAnimatedWebp(1, 'blob:video', 1000, true, captureParams)).resolves.toEqual({
            base64: '',
            audioBase64: 'audio',
            imageError: 'No frames captured',
        });
    });

    it('throws a distinct error when the armed capture was discarded', async () => {
        sendMessage.mockResolvedValue({ base64: '', error: 'gone', armedCaptureMissing: true });

        await expect(recordAnimatedWebp(1, 'blob:video', 1000, true, captureParams)).rejects.toBeInstanceOf(
            ArmedCaptureMissingError
        );
    });
});
