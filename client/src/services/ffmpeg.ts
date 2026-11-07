import project from '@project/common/project';
import { webmOpusMimeType } from '@project/common/audio-transcode/webm-audio';
import type { AudioTranscodeHost } from '@project/common/audio-transcode';
import { transcodeAudioTrack } from '@project/common/audio-transcode/ffmpeg-audio-transcoder';
import { createFfmpegObjectUrls, createFfmpegSession, ffmpegMetadata, unpackFfmpegRuntime } from '@project/ffmpeg';
import { prepareFfmpegRuntimeArchive } from '@project/client/src/services/ffmpeg-cache';
import { asbError, asbTrace, asbWarn } from '@project/common/util/log';

const createSession = ({ signal }: { signal: AbortSignal }) => {
    const runtimeArchive = {
        ...ffmpegMetadata.runtimeArchive,
        url: new URL(ffmpegMetadata.runtimeArchive.url, window.location.href).href,
    };
    const session = createFfmpegSession({
        signal,
        onDiagnostics: ({ messages, omittedMessages }, context) => {
            for (const { source, level, message, occurrences } of messages) {
                const logLevel = !context.failed && source === 'ffmpeg' ? 'trace' : level; // Individual packets can fail while conversion succeeds; retain that detail at trace.
                const log = logLevel === 'error' ? asbError : logLevel === 'warning' ? asbWarn : asbTrace;
                log('ffmpeg/native', message, { ...context, source, nativeLevel: level, occurrences });
            }
            if (omittedMessages > 0) {
                asbTrace('ffmpeg/native', 'Earlier native diagnostics omitted', { ...context, omittedMessages });
            }
        },
        workerFactory: (workerUrl) => {
            asbTrace('ffmpeg/session', 'Starting worker from verified runtime', {
                sessionId: session.id,
                runtimeVersion: ffmpegMetadata.runtimeVersion,
            });
            const worker = new Worker(workerUrl, { type: 'module', name: project.releases.ffmpeg.package });
            worker.addEventListener('error', (event) => {
                asbError('ffmpeg/session', 'Worker failed', {
                    sessionId: session.id,
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error,
                });
            });
            worker.addEventListener('messageerror', () => {
                asbError('ffmpeg/session', 'Could not deserialize worker reply', { sessionId: session.id });
            });
            return worker;
        },
        prepareAssets: async (signal) => {
            const archive = await prepareFfmpegRuntimeArchive(
                runtimeArchive,
                typeof caches === 'undefined' ? undefined : caches,
                signal,
                fetch,
                session.id
            );
            const start = performance.now();
            const executables = await unpackFfmpegRuntime(archive, ffmpegMetadata.runtimeVersion);
            signal.throwIfAborted();
            asbTrace('ffmpeg/session', 'Unpacked runtime archive', {
                sessionId: session.id,
                elapsedMs: performance.now() - start,
            });
            // Execute the bytes we verified, including on uncontrolled pages or when storage is unavailable.
            return createFfmpegObjectUrls(executables);
        },
    });
    return session;
};

export const webAudioTranscodeHost: AudioTranscodeHost = {
    // Completion always switches to a Blob, including on browsers that can stream earlier with MSE.
    supportsAudioPlayback: () => {
        const result = document.createElement('audio').canPlayType(webmOpusMimeType);
        asbTrace('audio/transcode', 'Browser converted audio capability check', { mimeType: webmOpusMimeType, result });
        return result !== '';
    },
    transcodeAudio: (options) => transcodeAudioTrack({ ...options, createSession }),
};
