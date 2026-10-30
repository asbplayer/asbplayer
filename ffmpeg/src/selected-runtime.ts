import artifactLock from '@project/ffmpeg/artifact-lock.json' with { type: 'json' };

/** Selected identity and app-local delivery path. GitHub is used only by build tooling. */
export const selectedRuntimeMetadata = {
    runtimeVersion: artifactLock.runtimeVersion,
    ffmpegVersion: artifactLock.ffmpegVersion,
    runtimeArchive: {
        url: 'ffmpeg/runtime.tgz',
        sha256: artifactLock.runtimeArchive.sha256,
        bytes: artifactLock.runtimeArchive.bytes,
    },
} as const;
