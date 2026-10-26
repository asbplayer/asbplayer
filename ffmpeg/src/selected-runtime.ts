import artifactLock from '@project/ffmpeg/artifact-lock.json' with { type: 'json' };

/** Committed release defaults shared by build tooling and browser metadata. */
export const selectedRuntimeMetadata = {
    runtimeVersion: artifactLock.runtimeVersion,
    ffmpegVersion: artifactLock.ffmpegVersion,
    runtimeArchive: {
        url: `${artifactLock.releaseBaseDownloadUrl}/${artifactLock.runtimeArchive.filename}`,
        sha256: artifactLock.runtimeArchive.sha256,
        bytes: artifactLock.runtimeArchive.bytes,
    },
    releaseApiUrl: artifactLock.releaseUrl
        .replace('https://github.com/', 'https://api.github.com/repos/')
        .replace('/releases/tag/', '/releases/tags/'),
} as const;
