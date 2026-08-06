import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { clamp } from '../util';

// Pinned to the version verified to carry an E-AC-3 decoder. ffmpeg-core.wasm is ~32 MB, so it is
// fetched from a CDN on first use rather than shipped with the app, and cached for the session.
const coreVersion = '0.12.10';
// The ESM build, because Vite builds the ffmpeg worker as a module worker - a module worker can't
// call importScripts, so the core has to be imported rather than injected.
const coreBaseUrl = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;

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
let probeElement: HTMLAudioElement | undefined;

const playableOutputFormats = () => {
    probeElement = probeElement ?? document.createElement('audio');
    const playable = outputFormats.filter(({ mimeType }) => probeElement!.canPlayType(mimeType) !== '');
    return playable.length === 0 ? outputFormats : playable;
};

const loadCoreUrls = (onProgress?: ProgressCallback) => {
    if (coreUrls === undefined) {
        coreUrls = (async () => {
            const { toBlobURL } = await import('@ffmpeg/util');

            try {
                // The core has to be same-origin for the worker to load it, hence the blob URLs.
                return {
                    coreURL: await toBlobURL(`${coreBaseUrl}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(
                        `${coreBaseUrl}/ffmpeg-core.wasm`,
                        'application/wasm',
                        true,
                        ({ received, total }) =>
                            onProgress?.({ stage: 'loadingDecoder', ratio: total ? clamp(received / total, 0, 1) : 0 })
                    ),
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
 * so an offline browser that has not already fetched it cannot transcode anything.
 */
export const audioTranscodingAvailable = () => coreUrls !== undefined || navigator.onLine;

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
