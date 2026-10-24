import type { FfmpegRuntimeArchive } from '@project/ffmpeg';
import { asbError, asbTrace, asbWarn } from '@project/common/util/log';

export const ffmpegRuntimeCacheName = 'asbplayer-ffmpeg';
export const ffmpegRuntimeCacheKey = 'https://ffmpeg.asbplayer.invalid/ffmpeg/runtime.tar.gz';
const verificationHeader = 'X-Asbplayer-FFmpeg-SHA256';
const archiveType = 'application/gzip';

const isHtml = (response: Response) => response.headers.get('Content-Type')?.toLowerCase().includes('text/html');

const verifyResponse = (response: Response) => {
    if (!response.ok) throw new Error(`Could not download FFmpeg (HTTP ${response.status}).`);
    if (isHtml(response)) throw new Error('Could not download FFmpeg: received HTML instead of the runtime archive.');
    return response;
};

const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>) => {
    const subtle = globalThis.crypto?.subtle;
    const digest = subtle
        ? new Uint8Array(await subtle.digest('SHA-256', bytes))
        : (await import('@noble/hashes/sha256')).sha256(bytes);
    return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const download = async (archive: FfmpegRuntimeArchive, fetcher: typeof fetch, signal: AbortSignal) => {
    const response = verifyResponse(await fetcher(new Request(archive.url, { signal, cache: 'reload' })));
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty FFmpeg runtime archive response');
    const bytes = new Uint8Array(archive.bytes);
    let received = 0;
    const cancelRead = () => void reader.cancel(signal.reason).catch(() => {});
    signal.addEventListener('abort', cancelRead, { once: true });
    try {
        while (true) {
            signal.throwIfAborted();
            const { done, value } = await reader.read();
            signal.throwIfAborted();
            if (done) break;
            if (received + value.byteLength > bytes.byteLength) {
                throw new Error('FFmpeg runtime archive size check failed');
            }
            bytes.set(value, received);
            received += value.byteLength;
        }
        if (received !== bytes.byteLength) throw new Error('FFmpeg runtime archive size check failed');
    } finally {
        signal.removeEventListener('abort', cancelRead);
        await reader.cancel().catch(() => {});
    }
    if ((await sha256Hex(bytes)) !== archive.sha256) {
        throw new Error('FFmpeg integrity check failed. Please retry.');
    }
    return bytes;
};

/** Return the verified runtime archive. The first use downloads and caches it; later loads trust the cached hash marker. */
export const prepareFfmpegRuntimeArchive = async (
    archive: FfmpegRuntimeArchive,
    cacheStorage: CacheStorage | undefined,
    signal: AbortSignal,
    { fetcher = fetch }: { fetcher?: typeof fetch } = {}
): Promise<Blob> => {
    signal.throwIfAborted();
    if (!/^[a-f0-9]{64}$/.test(archive.sha256) || !Number.isSafeInteger(archive.bytes) || archive.bytes <= 0) {
        throw new Error('Missing FFmpeg runtime archive hash or size');
    }
    const cacheName = ffmpegRuntimeCacheName;
    let cache: Cache | undefined;
    try {
        cache = await cacheStorage?.open(cacheName);
        if (cacheStorage === undefined) {
            asbTrace('ffmpeg/cache', 'Cache storage is unsupported; using a downloaded archive', { cacheName });
        }
    } catch (error) {
        // Online use still works when browser storage is unavailable.
        asbWarn('ffmpeg/cache', 'Could not open runtime cache; using a downloaded archive', { cacheName, error });
    }
    const cached = await cache?.match(ffmpegRuntimeCacheKey).catch((error: unknown) => {
        asbWarn('ffmpeg/cache', 'Could not read runtime cache; downloading the archive', { cacheName, error });
        return undefined;
    });
    signal.throwIfAborted();
    if (cached?.ok && cached.headers.get(verificationHeader) === archive.sha256) {
        asbTrace('ffmpeg/cache', 'Reusing verified runtime archive', { cacheName, bytes: archive.bytes });
        return cached.blob();
    }
    if (cached !== undefined) {
        asbTrace('ffmpeg/cache', 'Replacing a cached runtime archive for a different selection', { cacheName });
    }

    const start = performance.now();
    asbTrace('ffmpeg/download', 'Downloading runtime archive', { url: archive.url, expectedBytes: archive.bytes });
    try {
        const bytes = await download(archive, fetcher, signal);
        signal.throwIfAborted();
        const verified = new Response(bytes, {
            headers: { 'Content-Type': archiveType, [verificationHeader]: archive.sha256 },
        });
        await cache?.put(ffmpegRuntimeCacheKey, verified).catch((error: unknown) => {
            asbWarn('ffmpeg/cache', 'Could not persist runtime archive; offline use may be unavailable', {
                cacheName,
                error,
            });
        });
        signal.throwIfAborted();
        asbTrace('ffmpeg/download', 'Verified runtime archive', {
            cacheName,
            bytes: bytes.byteLength,
            elapsedMs: performance.now() - start,
        });
        return new Blob([bytes], { type: archiveType });
    } catch (error) {
        if (signal.aborted) {
            asbTrace('ffmpeg/download', 'Runtime download cancelled', { cacheName });
        } else {
            asbError('ffmpeg/download', 'Runtime download failed', { cacheName, error });
        }
        throw error;
    }
};
