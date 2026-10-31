import project from '@project/common/project';
import { webmOpusMimeType } from '@project/common/audio-transcode/webm-audio';
import type { AudioTranscodeHost } from '@project/common/audio-transcode';
import { createFfmpegObjectUrls, createFfmpegSession, ffmpegMetadata, unpackFfmpegRuntime } from '@project/ffmpeg';
import { prepareFfmpegRuntimeArchive } from '@project/client/src/services/ffmpeg-cache';
import { asbError, asbTrace, asbWarn } from '@project/common/util/log';

export const createWebFfmpegSession = ({ signal }: { signal?: AbortSignal } = {}) => {
    const runtimeArchive = {
        ...ffmpegMetadata.runtimeArchive,
        url: new URL(ffmpegMetadata.runtimeArchive.url, window.location.href).href,
    };
    return createFfmpegSession({
        signal,
        onDiagnostics: ({ messages, omittedMessages }, context) => {
            for (const { source, level, message, occurrences } of messages) {
                if (!context.failed && source === 'ffmpeg') continue;
                const log = level === 'error' ? asbError : level === 'warning' ? asbWarn : asbTrace;
                log('ffmpeg/native', message, { ...context, source, occurrences });
            }
            if (omittedMessages > 0) {
                asbTrace('ffmpeg/native', 'Earlier native diagnostics omitted', { ...context, omittedMessages });
            }
        },
        workerFactory: (workerUrl) => {
            asbTrace('ffmpeg/session', 'Starting worker from verified runtime', {
                runtimeVersion: ffmpegMetadata.runtimeVersion,
            });
            const worker = new Worker(workerUrl, { type: 'module', name: project.releases.ffmpeg.package });
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
                fetch
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

export const webAudioTranscodeHost: AudioTranscodeHost = {
    // Completion always switches to a Blob, including on browsers that can stream earlier with MSE.
    supportsAudioPlayback: () => document.createElement('audio').canPlayType(webmOpusMimeType) !== '',
    createSession: createWebFfmpegSession,
};
