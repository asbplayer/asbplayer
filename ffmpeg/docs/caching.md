# Downloading and caching the FFmpeg runtime

The browser prepares FFmpeg on demand when a feature loads a session. Normal app builds embed the runtime selection from [`artifact-lock.json`](../artifact-lock.json); [release selection](release.md) controls which bytes the app expects. [Local candidates](build.md#develop-a-local-candidate) use the same verification and caching flow with an archive served by the app.

## Cache lookup and download

Each session load calls [`prepareFfmpegRuntimeArchive`](../../client/src/services/ffmpeg-cache.ts) to obtain a verified compressed archive:

1. Check the `asbplayer-ffmpeg` cache at a single stable key. A cached response with a matching SHA-256 verification header is reused without downloading or hashing it again. There is no separate cached metadata file.
2. If the archive is missing or its marker differs, resolve it through GitHub's public release API using [ffmpeg-release.ts](../../client/src/services/ffmpeg-release.ts). Download with `Accept: application/octet-stream` for cross-origin browser access.
3. Verify the downloaded archive against the expected byte size and SHA-256, then attempt to cache it, replacing any previous selection. Storage failures still allow online execution of verified bytes.
4. Return the archive to the [runtime loading flow](runtime.md#loading-and-cancellation).

Cache checks happen when a session loads. App startup and updates never download or wait for FFmpeg.

## Offline use and app updates

The app works offline without FFmpeg. FFmpeg needs a connection on first use and works offline once its archive is cached, subject to browser storage limits. If storage is unsupported or blocked, or a cache write fails, the verified download can still run online.

Only one runtime archive is cached. A new app version selecting the same bytes reuses it; a different selection replaces it on demand. There are no versioned caches or retention guarantees for old tabs, so a different app version may need to download its expected archive again. [Existing sessions](runtime.md) keep their executable URLs until disposed.

An unused archive remains until FFmpeg is needed again or the browser evicts it. If the expected archive is not cached and GitHub or the download is unavailable, that session fails. App updates remain independent.

## How the selection reaches the browser

[selected-runtime.ts](../src/selected-runtime.ts) exposes committed defaults from the lock. [client/ffmpeg-build.ts](../../client/ffmpeg-build.ts) supplies Vite definitions and candidate copy targets, and [metadata.ts](../src/metadata.ts) exposes those values to browser code, applying build-time overrides when present.
