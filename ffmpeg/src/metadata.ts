declare const __ASB_FFMPEG_RUNTIME_VERSION__: string;
declare const __ASB_FFMPEG_VERSION__: string;
declare const __ASB_FFMPEG_RUNTIME_ARCHIVE__: FfmpegRuntimeArchive;

export type FfmpegRuntimeArchive = {
    /** App-local archive URL. */
    url: string;
    sha256: string;
    bytes: number;
};

export const ffmpegMetadata = {
    runtimeVersion: __ASB_FFMPEG_RUNTIME_VERSION__,
    ffmpegVersion: __ASB_FFMPEG_VERSION__,
    runtimeArchive: __ASB_FFMPEG_RUNTIME_ARCHIVE__,
} as const;

export type FfmpegMetadata = typeof ffmpegMetadata;
