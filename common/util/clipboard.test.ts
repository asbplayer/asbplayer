import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { clipboardWrite, decodeClipboardPng, encodeClipboardPng } from '@project/common/util/clipboard';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
});

function setClipboard(value: Pick<Clipboard, 'writeText'> | undefined) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
}

describe('clipboardWrite', () => {
    it('uses the document clipboard when it succeeds', async () => {
        const writeText = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const fallback = jest.fn<() => Promise<void>>();
        setClipboard({ writeText });

        await clipboardWrite('字幕', fallback);

        expect(writeText).toHaveBeenCalledWith('字幕');
        expect(fallback).not.toHaveBeenCalled();
    });

    it('retries the same text through the fallback when the document is unfocused', async () => {
        const notFocused = new DOMException('Document is not focused', 'NotAllowedError');
        setClipboard({ writeText: () => Promise.reject(notFocused) });
        const fallback = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);

        await clipboardWrite('字幕\ntranslation', fallback);

        expect(fallback).toHaveBeenCalledWith('字幕\ntranslation');
        await expect(clipboardWrite('字幕')).rejects.toBe(notFocused);
    });

    it('uses the fallback when there is no local clipboard API and surfaces its failure', async () => {
        setClipboard(undefined);
        const notWritten = new Error('Background clipboard unavailable');
        await expect(
            clipboardWrite('subtitle', async () => {
                throw notWritten;
            })
        ).rejects.toBe(notWritten);
    });

    it('round-trips valid PNG data URLs and rejects invalid ones', async () => {
        const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
        const png = decodeClipboardPng(dataUrl);
        await expect(encodeClipboardPng(png)).resolves.toBe(dataUrl);
        expect(() => decodeClipboardPng('data:text/html;base64,YQ==')).toThrow('Invalid clipboard PNG');
    });

    it('allows large local text writes, rejects oversized text before fallback, and rejects unsupported image types up front', async () => {
        const writeText = jest.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        const fallback = jest.fn<(text: string) => Promise<void>>();
        setClipboard({ writeText });

        const largeText = 'x'.repeat(64 * 1024 + 1);
        await clipboardWrite(largeText, fallback);
        expect(writeText).toHaveBeenCalledWith(largeText);
        expect(fallback).not.toHaveBeenCalled();

        writeText.mockClear();
        setClipboard(undefined);
        await expect(clipboardWrite(largeText, fallback)).rejects.toThrow('size limit');
        await expect(clipboardWrite(new Blob(['test'], { type: 'text/html' }))).rejects.toThrow('PNG');
        expect(writeText).not.toHaveBeenCalled();
        expect(fallback).not.toHaveBeenCalled();
    });
});
