/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const lock = require('./artifact-lock.json');

// Supply the build definitions explicitly when tests load browser runtime modules.
Object.assign(globalThis, {
    __ASB_FFMPEG_RUNTIME_VERSION__: lock.runtimeVersion,
    __ASB_FFMPEG_VERSION__: lock.ffmpegVersion,
    __ASB_FFMPEG_RUNTIME_ARCHIVE__: {
        url: 'ffmpeg/runtime.tgz',
        sha256: lock.runtimeArchive.sha256,
        bytes: lock.runtimeArchive.bytes,
    },
});
