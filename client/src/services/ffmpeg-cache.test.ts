/** @jest-environment node */
import type { FfmpegRuntimeArchive } from '@project/ffmpeg';
import { createHash } from 'node:crypto';
import {
    ffmpegRuntimeCacheKey,
    ffmpegRuntimeCacheName,
    prepareFfmpegRuntimeArchive,
} from '@project/client/src/services/ffmpeg-cache';

const hash = (body: string) => createHash('sha256').update(body).digest('hex');
const archive = (version: string): FfmpegRuntimeArchive & { body: string } => {
    const body = `runtime archive ${version}`;
    return {
        url: `https://example.test/ffmpeg-v${version}/asbplayer-ffmpeg-${version}-runtime.tar.gz`,
        sha256: hash(body),
        bytes: Buffer.byteLength(body),
        body,
    };
};
const serving =
    (...archives: Array<ReturnType<typeof archive>>): typeof fetch =>
    async (request) => {
        const match = archives.find(({ url }) => url === (request as Request).url);
        return match ? new Response(match.body) : new Response('Not Found', { status: 404 });
    };
const offline: typeof fetch = async () => {
    throw new TypeError('Offline');
};
const signal = () => new AbortController().signal;
const prepare = (
    selected: ReturnType<typeof archive>,
    storage: CacheStorage | undefined,
    fetcher: typeof fetch,
    abortSignal = signal()
) => prepareFfmpegRuntimeArchive(selected, storage, abortSignal, { fetcher });
// CacheStorage is a browser boundary; retain its public read and write behavior.
const memoryCaches = () => {
    const caches = new Map<string, Cache>();
    return {
        async open(name: string) {
            let cache = caches.get(name);
            if (cache !== undefined) return cache;
            const entries = new Map<string, Response>();
            const key = (request: RequestInfo) => (typeof request === 'string' ? request : request.url);
            cache = {
                async match(request: RequestInfo) {
                    return entries.get(key(request))?.clone();
                },
                async put(request: RequestInfo, response: Response) {
                    entries.set(key(request), response.clone());
                },
                async keys() {
                    return [...entries.keys()].map((url) => new Request(url));
                },
            } as unknown as Cache;
            caches.set(name, cache);
            return cache;
        },
        async keys() {
            return [...caches.keys()];
        },
    } as CacheStorage;
};
const blockedStorage = {
    open: async () => {
        throw new Error('Storage unavailable');
    },
} as unknown as CacheStorage;

it('caches the verified archive on first use and reuses it offline', async () => {
    const storage = memoryCaches();
    const selected = archive('0.1.0');
    expect(await (await prepare(selected, storage, serving(selected))).text()).toBe(selected.body);
    expect(await (await prepare(selected, storage, offline)).text()).toBe(selected.body);
});

it('keeps a single cached archive when the selected runtime changes', async () => {
    const storage = memoryCaches();
    const first = archive('0.1.0');
    const second = archive('0.2.0');
    await prepare(first, storage, serving(first));
    await prepare(second, storage, serving(second));
    expect(await storage.keys()).toEqual([ffmpegRuntimeCacheName]);
    const cache = await storage.open(ffmpegRuntimeCacheName);
    expect((await cache.keys()).map(({ url }) => url)).toEqual([ffmpegRuntimeCacheKey]);
    expect(await (await prepare(second, storage, offline)).text()).toBe(second.body);
    await expect(prepare(first, storage, offline)).rejects.toThrow('Offline');
});

it('does not hash or download the archive again on later loads', async () => {
    const storage = memoryCaches();
    const selected = archive('0.1.0');
    await prepare(selected, storage, serving(selected));
    const digest = jest.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Unexpected repeated hashing'));
    try {
        expect(await (await prepare(selected, storage, offline)).text()).toBe(selected.body);
    } finally {
        digest.mockRestore();
    }
});

it('downloads instead of trusting a cached archive without a matching verification marker', async () => {
    const storage = memoryCaches();
    const selected = archive('0.1.0');
    const cache = await storage.open(ffmpegRuntimeCacheName);
    await cache.put(ffmpegRuntimeCacheKey, new Response(selected.body));
    const fetcher = jest.fn(serving(selected));
    await prepare(selected, storage, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await prepare(selected, storage, offline);
});

it('rejects a corrupt HTTP-200 archive without caching it, then recovers after the server is repaired', async () => {
    const storage = memoryCaches();
    const selected = archive('0.1.0');
    const corrupt: typeof fetch = async () => new Response('x'.repeat(selected.bytes));
    await expect(prepare(selected, storage, corrupt)).rejects.toThrow('integrity check failed');
    expect(await (await storage.open(ffmpegRuntimeCacheName)).match(ffmpegRuntimeCacheKey)).toBeUndefined();
    await prepare(selected, storage, serving(selected));
    expect(await (await prepare(selected, storage, offline)).text()).toBe(selected.body);
});

it.each(['short', 'long'])('rejects a %s response against the locked archive size', async (kind) => {
    const selected = archive('0.1.0');
    const fetcher: typeof fetch = async () =>
        new Response(kind === 'long' ? `${selected.body}extra` : selected.body.slice(1));
    await expect(prepare(selected, memoryCaches(), fetcher)).rejects.toThrow('size check failed');
});

it('cancels the response stream promptly when the owner aborts', async () => {
    const cancelled = jest.fn();
    const fetcher: typeof fetch = async () => new Response(new ReadableStream({ cancel: cancelled }));
    const owner = new AbortController();
    const downloading = prepare(archive('0.1.0'), memoryCaches(), fetcher, owner.signal);
    await new Promise(setImmediate);
    owner.abort();
    await expect(downloading).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled).toHaveBeenCalledTimes(1);
});

it.each([404, 410, 'html'] as const)(
    'leaves FFmpeg unavailable if the release cannot be downloaded (%s)',
    async (result) => {
        const fetcher: typeof fetch = async () =>
            result === 'html'
                ? new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } })
                : new Response('Missing', { status: result });
        await expect(prepare(archive('0.1.0'), memoryCaches(), fetcher)).rejects.toThrow(
            result === 'html' ? 'received HTML' : `HTTP ${result}`
        );
    }
);

it('reports an offline first use as a download failure', async () => {
    await expect(prepare(archive('0.1.0'), memoryCaches(), offline)).rejects.toThrow('Offline');
});

it.each([
    ['unsupported', undefined],
    ['blocked', blockedStorage],
])('initializes online and still rejects corrupt downloads when cache storage is %s', async (_kind, storage) => {
    const selected = archive('0.1.0');
    expect(await (await prepare(selected, storage, serving(selected))).text()).toBe(selected.body);
    await expect(prepare(selected, storage, async () => new Response('x'.repeat(selected.bytes)))).rejects.toThrow(
        'integrity check failed'
    );
});

it('allows online initialization when cache writes fail', async () => {
    const selected = archive('0.1.0');
    const storage = {
        open: async () =>
            ({
                match: async () => undefined,
                put: async () => {
                    throw new Error('Quota exceeded');
                },
            }) as unknown as Cache,
    } as unknown as CacheStorage;
    expect(await (await prepare(selected, storage, serving(selected))).text()).toBe(selected.body);
});

it('does not download or open the cache for an already aborted request', async () => {
    const owner = new AbortController();
    owner.abort();
    const fetcher = jest.fn(offline);
    const storage = { open: jest.fn() } as unknown as CacheStorage;
    await expect(prepare(archive('0.1.0'), storage, fetcher, owner.signal)).rejects.toMatchObject({
        name: 'AbortError',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.open).not.toHaveBeenCalled();
});

it('rejects a selection without a pinned hash or size', async () => {
    await expect(prepare({ ...archive('0.1.0'), sha256: '' }, memoryCaches(), offline)).rejects.toThrow(
        'Missing FFmpeg runtime archive hash or size'
    );
});
