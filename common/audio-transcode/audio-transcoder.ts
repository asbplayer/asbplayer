import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { clamp } from '../util';

// Pinned to the version verified to carry an E-AC-3 decoder. ffmpeg-core.wasm is ~32 MB, so it is
// fetched from a CDN on first use rather than shipped with the app.
const coreVersion = '0.12.10';
// The ESM build, because Vite builds the ffmpeg worker as a module worker - a module worker can't
// call importScripts, so the core has to be imported rather than injected.
const coreBaseUrl = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;

interface CoreFile {
    readonly name: string;
    readonly mimeType: string;
    /** Base64 SHA-256 of the file's contents, as published by the registry. */
    readonly integrity: string;
    /**
     * Uncompressed size. The CDN serves the core gzipped without a Content-Length, so this is what
     * download progress is measured against - the response can't say how much is coming.
     */
    readonly size: number;
}

/**
 * The decoder is executable code served by a third party, so its bytes are checked against the
 * hashes the registry publishes before any of it is allowed to run. Update these together with
 * `coreVersion` - a mismatch fails the conversion rather than executing what arrived.
 */
const coreScript: CoreFile = {
    name: 'ffmpeg-core.js',
    mimeType: 'text/javascript',
    integrity: 'Z6SPEWRfhUOfP95PIRkELBazdLkQIGt6eiTzQuKNyuM=',
    size: 111_804,
};
const coreWasm: CoreFile = {
    name: 'ffmpeg-core.wasm',
    mimeType: 'application/wasm',
    integrity: 'n1eUelvVMNjwDFs/LLKjSS+qfl2CMxU0LWqGVtCmt7c=',
    size: 32_232_419,
};

// Named by version so that bumping the decoder can't serve the previous one, and by a shared prefix
// so that the superseded copy is deleted rather than left holding 32 MB indefinitely.
const coreCachePrefix = 'asbplayer-audio-decoder';
const coreCacheName = `${coreCachePrefix}-${coreVersion}`;

const mountPoint = '/mnt';
const inputFileName = 'input';

/**
 * Output formats in preference order. Encoding dominates the running time - demuxing and decoding
 * a ten minute 5.1 E-AC-3 track takes about two seconds of the ten the whole conversion used to
 * take - so the cheapest acceptable encoder is the one worth having first.
 *
 * Opus is roughly twice as fast as Vorbis here, and Vorbis is insensitive to its quality setting.
 * Note the complexity cap: libopus in ffmpeg-core traps with an out of bounds memory access at
 * compression_level 5 and above whenever it encodes two channels, whatever the source layout.
 * Levels 0 to 4 are safe, and 4 costs about a second more per ten minutes than 0.
 */
const outputFormats = [
    {
        mimeType: 'audio/webm; codecs="opus"',
        container: 'webm',
        encoderArgs: ['-c:a', 'libopus', '-compression_level', '4', '-b:a', '96k'],
    },
    {
        mimeType: 'audio/webm; codecs="vorbis"',
        container: 'webm',
        encoderArgs: ['-c:a', 'libvorbis', '-q:a', '4'],
    },
    {
        mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        container: 'mp4',
        encoderArgs: ['-c:a', 'aac', '-b:a', '128k'],
    },
];

/**
 * Encoding is single threaded and ffmpeg's audio encoders have no internal threading, so the only
 * way to use more than one core is to encode separate time ranges in separate workers. Four is
 * where the gains stop: eight was no faster than four, since per chunk setup starts to dominate.
 */
const maxChunks = 4;
// Each worker instantiates its own ~32 MB core, so splitting is only worth the memory on a machine
// with cores to spare and headroom to hold them.
const minCoresForSplitting = 4;
const minMemoryGbForSplitting = 4;
// Joining chunks costs about 8 ms of permanent drift per boundary, so only split work that is long
// enough for the speedup to be worth it, and keep chunks big enough that boundaries stay few.
const minDurationForSplittingSeconds = 120;
const minChunkDurationSeconds = 45;
const mediaDurationTimeoutMs = 5_000;

export type AudioTranscodeStage = 'loadingDecoder' | 'transcoding';

export interface AudioTranscodeProgress {
    readonly stage: AudioTranscodeStage;
    readonly ratio: number;
}

export interface TranscodedAudio {
    readonly blob: Blob;
    readonly mimeType: string;
}

interface CoreUrls {
    coreURL: string;
    wasmURL: string;
}

interface TimeRange {
    readonly start: number;
    readonly lengthSeconds: number;
    /** The final range runs to the end of the file, so that rounding can't drop the tail. */
    readonly toEnd: boolean;
}

type OutputFormat = (typeof outputFormats)[number];
type ProgressCallback = (progress: AudioTranscodeProgress) => void;

let coreUrls: Promise<CoreUrls> | undefined;
let coreCache: Promise<Cache | undefined> | undefined;
let probeElement: HTMLAudioElement | undefined;

const playableOutputFormats = () => {
    probeElement = probeElement ?? document.createElement('audio');
    const playable = outputFormats.filter(({ mimeType }) => probeElement!.canPlayType(mimeType) !== '');
    return playable.length === 0 ? outputFormats : playable;
};

const openCoreCache = () => {
    if (coreCache === undefined) {
        coreCache = (async () => {
            // Cache Storage is absent in insecure contexts and can be switched off by the user, in
            // which case the decoder still works - it just has to be downloaded again next session.
            if (typeof caches === 'undefined') {
                return undefined;
            }

            try {
                const cache = await caches.open(coreCacheName);
                const names = await caches.keys();
                await Promise.all(
                    names
                        .filter((name) => name.startsWith(coreCachePrefix) && name !== coreCacheName)
                        .map((name) => caches.delete(name))
                );
                return cache;
            } catch (e) {
                console.warn('Audio decoder cache is unavailable:', e);
                return undefined;
            }
        })();
    }

    return coreCache;
};

const coreFileUrl = (file: CoreFile) => `${coreBaseUrl}/${file.name}`;

const matchesIntegrity = async (bytes: Uint8Array<ArrayBuffer>, integrity: string) => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return btoa(String.fromCharCode(...digest)) === integrity;
};

const download = async (file: CoreFile, onProgress?: (ratio: number) => void) => {
    const response = await fetch(coreFileUrl(file));

    if (!response.ok) {
        throw new Error(`Failed to download ${file.name}: ${response.status}`);
    }

    if (response.body === null) {
        return new Uint8Array(await response.arrayBuffer());
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let reportedPercent = -1;

    for (;;) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
        received += value.length;

        // The core arrives in thousands of chunks, so only report when the displayed figure moves.
        const percent = Math.floor(clamp(received / file.size, 0, 1) * 100);

        if (percent !== reportedPercent) {
            reportedPercent = percent;
            onProgress?.(percent / 100);
        }
    }

    const bytes = new Uint8Array(received);
    let offset = 0;

    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }

    return bytes;
};

/**
 * Reads one file of the decoder, preferring the copy an earlier session cached. Whatever the
 * source, the bytes are verified before being handed back - a cached copy that no longer matches
 * its hash is treated as corrupt and fetched again.
 */
const coreFileBytes = async (file: CoreFile, onProgress?: (ratio: number) => void) => {
    const cache = await openCoreCache();
    const url = coreFileUrl(file);
    const cached = await cache?.match(url);

    if (cached !== undefined) {
        const cachedBytes = new Uint8Array(await cached.arrayBuffer());

        if (await matchesIntegrity(cachedBytes, file.integrity)) {
            // Deliberately silent: nothing is being downloaded, so reporting download progress here
            // would flash "Downloading the audio converter" at a user who is only waiting on startup.
            return cachedBytes;
        }

        await cache?.delete(url);
    }

    const bytes = await download(file, onProgress);

    if (!(await matchesIntegrity(bytes, file.integrity))) {
        throw new Error(`Integrity check failed for ${file.name}`);
    }

    try {
        await cache?.put(url, new Response(bytes, { headers: { 'Content-Type': file.mimeType } }));
    } catch (e) {
        // Running out of quota costs a download next session, but shouldn't fail this conversion.
        console.warn('Failed to cache the audio decoder:', e);
    }

    return bytes;
};

const loadCoreUrls = (onProgress?: ProgressCallback) => {
    if (coreUrls === undefined) {
        coreUrls = (async () => {
            try {
                // Progress is reported for the wasm alone - the script beside it is a rounding error.
                const script = await coreFileBytes(coreScript);
                const wasm = await coreFileBytes(coreWasm, (ratio) => onProgress?.({ stage: 'loadingDecoder', ratio }));

                // The core has to be same-origin for the worker to load it, hence the blob URLs.
                return {
                    coreURL: URL.createObjectURL(new Blob([script], { type: coreScript.mimeType })),
                    wasmURL: URL.createObjectURL(new Blob([wasm], { type: coreWasm.mimeType })),
                };
            } catch (e) {
                // Allow a later attempt to retry the download.
                coreUrls = undefined;
                throw e;
            }
        })();
    }

    return coreUrls;
};

/**
 * @returns whether a transcode could be started right now. The decoder is downloaded on first use,
 * so an offline browser can only transcode when an earlier session cached it.
 */
export const audioTranscodingAvailable = async () => {
    if (coreUrls !== undefined || navigator.onLine) {
        return true;
    }

    const cache = await openCoreCache();

    if (cache === undefined) {
        return false;
    }

    const cached = await Promise.all([coreScript, coreWasm].map((file) => cache.match(coreFileUrl(file))));
    return cached.every((response) => response !== undefined);
};

/**
 * Reads the duration from the browser rather than the container. Only files the browser can already
 * open reach this point, so it knows the duration even though it can't decode the audio.
 */
const mediaDuration = (file: File) =>
    new Promise<number | undefined>((resolve) => {
        const element = document.createElement('video');
        const url = URL.createObjectURL(file);
        let settled = false;

        const finish = (duration?: number) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            element.removeAttribute('src');
            element.load();
            URL.revokeObjectURL(url);
            resolve(duration !== undefined && Number.isFinite(duration) && duration > 0 ? duration : undefined);
        };

        const timeout = setTimeout(() => finish(undefined), mediaDurationTimeoutMs);
        element.preload = 'metadata';
        element.onloadedmetadata = () => finish(element.duration);
        element.onerror = () => finish(undefined);
        element.src = url;
    });

const chunkCountFor = (durationSeconds: number | undefined) => {
    const cores = navigator.hardwareConcurrency ?? 1;
    const memoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory;

    if (
        durationSeconds === undefined ||
        durationSeconds < minDurationForSplittingSeconds ||
        cores < minCoresForSplitting ||
        (memoryGb !== undefined && memoryGb < minMemoryGbForSplitting)
    ) {
        return 1;
    }

    // Leave a core for the rest of the page.
    const byCores = Math.min(cores - 1, maxChunks);
    const byDuration = Math.floor(durationSeconds / minChunkDurationSeconds);
    return clamp(Math.min(byCores, byDuration), 1, maxChunks);
};

const rangesFor = (durationSeconds: number, chunks: number): TimeRange[] => {
    const chunkDuration = durationSeconds / chunks;
    return Array.from({ length: chunks }, (_, index) => ({
        start: index * chunkDuration,
        lengthSeconds: chunkDuration,
        toEnd: index === chunks - 1,
    }));
};

const newFFmpeg = async (coreURL: string, wasmURL: string, signal?: AbortSignal) => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg: FFmpeg = new FFmpeg();
    const terminate = () => ffmpeg.terminate();
    signal?.addEventListener('abort', terminate);
    const dispose = () => {
        signal?.removeEventListener('abort', terminate);
        ffmpeg.terminate();
    };

    try {
        await ffmpeg.load({ coreURL, wasmURL });
    } catch (e) {
        dispose();
        throw e;
    }

    return { ffmpeg, dispose };
};

/** Encodes one time range of the source, or all of it when no range is given. */
const encodeRange = async ({
    format,
    file,
    trackIndex,
    range,
    coreURL,
    wasmURL,
    onProgress,
    signal,
}: {
    format: OutputFormat;
    file: File;
    trackIndex: number;
    range?: TimeRange;
    coreURL: string;
    wasmURL: string;
    onProgress?: (ratio: number) => void;
    signal?: AbortSignal;
}): Promise<Uint8Array> => {
    const { FFFSType } = await import('@ffmpeg/ffmpeg');
    const { ffmpeg, dispose } = await newFFmpeg(coreURL, wasmURL, signal);
    const outputFileName = `output.${format.container}`;

    try {
        // ffmpeg reports progress against the whole input, so a range that covers a quarter of the
        // file would never report more than a quarter done. Derive it from the output time instead.
        ffmpeg.on('progress', ({ progress, time }) =>
            onProgress?.(
                range === undefined ? clamp(progress, 0, 1) : clamp(time / 1_000_000 / range.lengthSeconds, 0, 1)
            )
        );

        await ffmpeg.createDir(mountPoint);
        await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: inputFileName, data: file }] }, mountPoint);

        const exitCode = await ffmpeg.exec([
            '-nostdin',
            // Seeking before the input makes each worker skip straight to its own range.
            ...(range && range.start > 0 ? ['-ss', String(range.start)] : []),
            ...(range === undefined || range.toEnd ? [] : ['-t', String(range.lengthSeconds)]),
            '-i',
            `${mountPoint}/${inputFileName}`,
            // Audio only - the video keeps playing from the original file.
            '-vn',
            '-sn',
            '-dn',
            '-map',
            `0:a:${trackIndex}`,
            // Surround tracks are downmixed, since browsers play back through the system mixer anyway.
            '-ac',
            '2',
            ...format.encoderArgs,
            '-f',
            format.container,
            outputFileName,
        ]);

        if (exitCode !== 0) {
            throw new Error(`Audio transcoding failed with exit code ${exitCode}`);
        }

        return (await ffmpeg.readFile(outputFileName)) as Uint8Array;
    } finally {
        dispose();
    }
};

/** Joins encoded chunks without re-encoding them. */
const concatChunks = async ({
    chunks,
    format,
    coreURL,
    wasmURL,
    signal,
}: {
    chunks: Uint8Array[];
    format: OutputFormat;
    coreURL: string;
    wasmURL: string;
    signal?: AbortSignal;
}): Promise<Uint8Array> => {
    const { ffmpeg, dispose } = await newFFmpeg(coreURL, wasmURL, signal);
    const outputFileName = `joined.${format.container}`;

    try {
        const names = chunks.map((_, index) => `chunk${index}.${format.container}`);

        for (let index = 0; index < chunks.length; ++index) {
            await ffmpeg.writeFile(names[index], chunks[index]);
            // Release our copy as soon as the decoder has one. These run to tens of megabytes each
            // on a feature length film, and the browser needs that memory for the video itself.
            chunks[index] = new Uint8Array(0);
        }

        await ffmpeg.writeFile('chunks.txt', names.map((name) => `file '${name}'`).join('\n'));

        const exitCode = await ffmpeg.exec([
            '-nostdin',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            'chunks.txt',
            '-c',
            'copy',
            '-f',
            format.container,
            outputFileName,
        ]);

        if (exitCode !== 0) {
            throw new Error(`Joining transcoded audio failed with exit code ${exitCode}`);
        }

        return (await ffmpeg.readFile(outputFileName)) as Uint8Array;
    } finally {
        dispose();
    }
};

const encodeInParallel = async ({
    ranges,
    format,
    file,
    trackIndex,
    coreURL,
    wasmURL,
    onProgress,
    signal,
}: {
    ranges: TimeRange[];
    format: OutputFormat;
    file: File;
    trackIndex: number;
    coreURL: string;
    wasmURL: string;
    onProgress?: ProgressCallback;
    signal?: AbortSignal;
}) => {
    const ratios = ranges.map(() => 0);
    const reportProgress = () =>
        onProgress?.({
            stage: 'transcoding',
            ratio: clamp(ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length, 0, 1),
        });

    const chunks = await Promise.all(
        ranges.map((range, index) =>
            encodeRange({
                format,
                file,
                trackIndex,
                range,
                coreURL,
                wasmURL,
                signal,
                onProgress: (ratio) => {
                    ratios[index] = ratio;
                    reportProgress();
                },
            })
        )
    );

    return concatChunks({ chunks, format, coreURL, wasmURL, signal });
};

const transcodeToFormat = async ({
    format,
    file,
    trackIndex,
    coreURL,
    wasmURL,
    onProgress,
    signal,
}: {
    format: OutputFormat;
    file: File;
    trackIndex: number;
    coreURL: string;
    wasmURL: string;
    onProgress?: ProgressCallback;
    signal?: AbortSignal;
}): Promise<TranscodedAudio> => {
    const singlePass = () =>
        encodeRange({
            format,
            file,
            trackIndex,
            coreURL,
            wasmURL,
            signal,
            onProgress: (ratio) => onProgress?.({ stage: 'transcoding', ratio }),
        });

    const duration = await mediaDuration(file);
    const chunks = chunkCountFor(duration);
    let data: Uint8Array;

    if (chunks < 2 || duration === undefined) {
        data = await singlePass();
    } else {
        try {
            data = await encodeInParallel({
                ranges: rangesFor(duration, chunks),
                format,
                file,
                trackIndex,
                coreURL,
                wasmURL,
                onProgress,
                signal,
            });
        } catch (e) {
            if (signal?.aborted) {
                throw e;
            }

            console.warn('Transcoding audio in parallel failed, falling back to a single pass', e);
            data = await singlePass();
        }
    }

    return { blob: new Blob([data], { type: format.mimeType }), mimeType: format.mimeType };
};

/**
 * Decodes one audio track of a media file and re-encodes it into a format the browser can play.
 *
 * The source file is mounted rather than copied into the decoder's memory, so files larger than
 * available memory can be transcoded.
 *
 * @param trackIndex position of the track among the file's audio tracks
 */
export const transcodeAudioTrack = async ({
    file,
    trackIndex,
    onProgress,
    signal,
}: {
    file: File;
    trackIndex: number;
    onProgress?: ProgressCallback;
    signal?: AbortSignal;
}): Promise<TranscodedAudio> => {
    const { coreURL, wasmURL } = await loadCoreUrls(onProgress);

    if (signal?.aborted) {
        throw new Error('Audio transcoding was cancelled');
    }

    let lastError: unknown;

    // Fall through to the next encoder if one fails. An encoder that traps takes the whole wasm
    // instance with it, so each attempt gets a fresh one.
    for (const format of playableOutputFormats()) {
        try {
            return await transcodeToFormat({ format, file, trackIndex, coreURL, wasmURL, onProgress, signal });
        } catch (e) {
            if (signal?.aborted) {
                throw e;
            }

            console.warn(`Audio transcoding to ${format.mimeType} failed, trying the next format`, e);
            lastError = e;
        }
    }

    throw lastError ?? new Error('No usable audio output format');
};
