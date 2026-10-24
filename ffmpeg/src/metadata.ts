import artifactLock from '@project/ffmpeg/artifact-lock.json';

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
            : artifactLock.runtimeVersion,
    ffmpegVersion: typeof __ASB_FFMPEG_VERSION__ === 'string' ? __ASB_FFMPEG_VERSION__ : artifactLock.ffmpegVersion,
    runtimeArchive:
        typeof __ASB_FFMPEG_RUNTIME_ARCHIVE__ === 'object'
            ? __ASB_FFMPEG_RUNTIME_ARCHIVE__
            : {
                  url: `${artifactLock.releaseBaseDownloadUrl}/${artifactLock.runtimeArchive.filename}`,
                  sha256: artifactLock.runtimeArchive.sha256,
                  bytes: artifactLock.runtimeArchive.bytes,
              },
    releaseApiUrl:
        typeof __ASB_FFMPEG_RELEASE_API_URL__ === 'undefined'
            ? artifactLock.releaseUrl
                  .replace('https://github.com/', 'https://api.github.com/repos/')
                  .replace('/releases/tag/', '/releases/tags/')
            : __ASB_FFMPEG_RELEASE_API_URL__,
} as const;

export type FfmpegMetadata = typeof ffmpegMetadata;
