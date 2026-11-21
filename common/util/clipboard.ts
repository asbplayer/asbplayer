import { base64ToBlob, blobToBase64 } from '@project/common/base64';

const maxTextLength = 64 * 1024;
const maxPngBytes = 24 * 1024 * 1024;
const pngMimeType = 'image/png';
const pngDataUrlPrefix = `data:${pngMimeType};base64,`;

export type ClipboardFallback = (text: string) => Promise<void>;

export function isClipboardText(data: unknown): data is string {
    return typeof data === 'string' && data.length <= maxTextLength;
}

export function isClipboardPngDataUrl(dataUrl: unknown): dataUrl is string {
    return (
        typeof dataUrl === 'string' &&
        dataUrl.startsWith(pngDataUrlPrefix) &&
        dataUrl.length > pngDataUrlPrefix.length &&
        dataUrl.length <= pngDataUrlPrefix.length + (maxPngBytes / 3) * 4
    );
}

function isClipboardPngBlob(blob: Blob): boolean {
    return blob.type === pngMimeType && blob.size > 0 && blob.size <= maxPngBytes;
}

function validateClipboardData(data: string | Blob) {
    if (typeof data === 'string' ? isClipboardText(data) : isClipboardPngBlob(data)) return;
    throw new Error('Clipboard data exceeds the size limit or is not plain text or PNG');
}

export async function encodeClipboardPng(blob: Blob): Promise<string> {
    validateClipboardData(blob);
    return pngDataUrlPrefix + (await blobToBase64(blob));
}

export function decodeClipboardPng(dataUrl: unknown): Blob {
    if (!isClipboardPngDataUrl(dataUrl)) throw new Error('Invalid clipboard PNG data URL');
    return base64ToBlob(dataUrl.slice(pngDataUrlPrefix.length), pngMimeType);
}

/** Writes plain text to the clipboard, falling back to `fallback` when the local write fails. */
export function clipboardWrite(data: string, fallback?: ClipboardFallback): Promise<void>;
/** Writes a PNG blob to the clipboard. */
export function clipboardWrite(data: Blob): Promise<void>;
export async function clipboardWrite(data: string | Blob, fallback?: ClipboardFallback): Promise<void> {
    if (typeof data !== 'string') validateClipboardData(data);
    try {
        /* eslint-disable no-restricted-syntax */
        if (typeof data === 'string') await navigator.clipboard.writeText(data);
        else await navigator.clipboard.write([new ClipboardItem({ [data.type]: data })]);
        /* eslint-enable no-restricted-syntax */
    } catch (error) {
        if (!fallback || typeof data !== 'string') throw error;
        validateClipboardData(data);
        await fallback(data);
    }
}
