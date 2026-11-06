# Downloading and caching the FFmpeg runtime

The browser prepares FFmpeg on demand when a feature loads a session. Normal app builds download, verify, and copy the pinned runtime into their static assets, then embed the runtime selection from [`artifact-lock.json`](../artifact-lock.json); [release selection](release.md) controls which bytes the app expects. [Local candidates](build.md#develop-a-local-candidate) use the same verification and caching flow with an archive served by the app.

## Cache lookup and download

Each session load calls [`prepareFfmpegRuntimeArchive`](../../client/src/services/ffmpeg-cache.ts) to obtain a verified compressed archive:

1. Check the `asbplayer-ffmpeg` cache at a single stable key. A cached response with a matching SHA-256 verification header is reused without downloading or hashing it again. There is no separate cached metadata file.
2. If the archive is missing or its marker differs, fetch `ffmpeg/runtime.tgz` from the app's origin. Browser code never requests GitHub release assets. The build downloads those server-side, where browser CORS restrictions do not apply.
3. Verify the downloaded archive against the expected byte size and SHA-256, then attempt to cache it, replacing any previous selection. Storage failures still allow online execution of verified bytes.
4. Return the archive to the [runtime loading flow](runtime.md#loading-and-cancellation).

Cache checks happen when a session loads. Browser app startup and updates never download or wait for FFmpeg. The runtime is excluded from PWA precaching; users who never need it do not download it.

## Offline use and app updates

The app works offline without FFmpeg. FFmpeg needs a connection on first use and works offline once its archive is cached, subject to browser storage limits. If storage is unsupported or blocked, or a cache write fails, the verified download can still run online.

Only one runtime archive is cached. A new app version selecting the same bytes reuses it; a different selection replaces it on demand. There are no versioned caches or retention guarantees for old tabs. App hosting contains only the current `ffmpeg/runtime.tgz`, not every released version. An old app with its matching cached archive can continue using it. If that archive was never cached, was replaced, or was evicted, the old app may receive a newer archive at that URL. Size/hash verification rejects it; update or reload asbplayer to use the new selection. [Existing sessions](runtime.md) keep their executable URLs until disposed.

An unused archive remains until FFmpeg is needed again or the browser evicts it. If the expected archive is not cached and the app-hosted download is unavailable, that session fails. GitHub availability affects uncached app builds, not browser sessions. App updates remain independent.

## How the selection reaches the browser

[selected-runtime.ts](../src/selected-runtime.ts) exposes committed defaults from the lock. [client/ffmpeg-build.ts](../../client/ffmpeg-build.ts) acquires the selected archive through [prepare-runtime.mjs](../scripts/prepare-runtime.mjs), supplies Vite definitions, and copies selected or candidate bytes to the same stable URL, and [metadata.ts](../src/metadata.ts) exposes those values to browser code, applying build-time overrides when present.
