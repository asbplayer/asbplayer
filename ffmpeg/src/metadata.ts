import { selectedRuntimeMetadata } from '@project/ffmpeg/selected-runtime';

declare const __ASB_FFMPEG_RUNTIME_VERSION__: string | undefined;
declare const __ASB_FFMPEG_VERSION__: string | undefined;
declare const __ASB_FFMPEG_RUNTIME_ARCHIVE__: FfmpegRuntimeArchive | undefined;

export type FfmpegRuntimeArchive = {
    /** App-local archive URL. */
    url: string;
    sha256: string;
    bytes: number;
};

export const ffmpegMetadata = {
    runtimeVersion:
        typeof __ASB_FFMPEG_RUNTIME_VERSION__ === 'string'
            ? __ASB_FFMPEG_RUNTIME_VERSION__
            : selectedRuntimeMetadata.runtimeVersion,
    ffmpegVersion:
        typeof __ASB_FFMPEG_VERSION__ === 'string' ? __ASB_FFMPEG_VERSION__ : selectedRuntimeMetadata.ffmpegVersion,
    runtimeArchive:
        typeof __ASB_FFMPEG_RUNTIME_ARCHIVE__ === 'object'
            ? __ASB_FFMPEG_RUNTIME_ARCHIVE__
            : selectedRuntimeMetadata.runtimeArchive,
} as const;

export type FfmpegMetadata = typeof ffmpegMetadata;
