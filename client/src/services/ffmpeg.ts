import project from '@project/common/project';
import { createFfmpegObjectUrls, createFfmpegSession, ffmpegMetadata, unpackFfmpegRuntime } from '@project/ffmpeg';
import { prepareFfmpegRuntimeArchive } from '@project/client/src/services/ffmpeg-cache';
import { asbError, asbTrace } from '@project/common/util/log';
import { createGithubReleaseFetcher } from '@project/client/src/services/ffmpeg-release';

export const createWebFfmpegSession = ({ signal }: { signal?: AbortSignal } = {}) => {
    const runtimeArchive = {
        ...ffmpegMetadata.runtimeArchive,
        url: new URL(ffmpegMetadata.runtimeArchive.url, window.location.href).href,
    };
    return createFfmpegSession({
        signal,
        workerFactory: (workerUrl) => {
            asbTrace('ffmpeg/session', 'Starting worker from verified runtime', {
                runtimeVersion: ffmpegMetadata.runtimeVersion,
            });
            const worker = new Worker(workerUrl, { type: 'module', name: project.artifacts.ffmpeg.prefix });
            worker.addEventListener('error', (event) => {
                asbError('ffmpeg/session', 'Worker failed', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error,
                });
            });
            worker.addEventListener('messageerror', () => {
                asbError('ffmpeg/session', 'Could not deserialize worker reply');
            });
            return worker;
        },
        prepareAssets: async (signal) => {
            const archive = await prepareFfmpegRuntimeArchive(
                runtimeArchive,
                typeof caches === 'undefined' ? undefined : caches,
                signal,
                {
                    fetcher: ffmpegMetadata.releaseApiUrl
                        ? createGithubReleaseFetcher(ffmpegMetadata.releaseApiUrl)
                        : fetch,
                }
            );
            const start = performance.now();
            const executables = await unpackFfmpegRuntime(archive, ffmpegMetadata.runtimeVersion);
            signal.throwIfAborted();
            asbTrace('ffmpeg/session', 'Unpacked runtime archive', { elapsedMs: performance.now() - start });
            // Execute the bytes we verified, including on uncontrolled pages or when storage is unavailable.
            return createFfmpegObjectUrls(executables);
        },
    });
};
