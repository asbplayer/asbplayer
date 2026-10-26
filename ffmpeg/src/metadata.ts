import { selectedRuntimeMetadata } from '@project/ffmpeg/selected-runtime';

declare const __ASB_FFMPEG_RUNTIME_VERSION__: string | undefined;
declare const __ASB_FFMPEG_VERSION__: string | undefined;
declare const __ASB_FFMPEG_RUNTIME_ARCHIVE__: FfmpegRuntimeArchive | undefined;
declare const __ASB_FFMPEG_RELEASE_API_URL__: string | null | undefined;

export type FfmpegRuntimeArchive = {
    /** Download URL; resolved through the release API when releaseApiUrl is set. */
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
    releaseApiUrl:
        typeof __ASB_FFMPEG_RELEASE_API_URL__ === 'undefined'
            ? selectedRuntimeMetadata.releaseApiUrl
            : __ASB_FFMPEG_RELEASE_API_URL__,
} as const;

export type FfmpegMetadata = typeof ffmpegMetadata;
