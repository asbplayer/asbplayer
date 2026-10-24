# asbplayer FFmpeg runtime

This workspace builds an optional, independently versioned FFmpeg dependency for the webapp. It currently exposes runtime inspection and links only `libavutil`. Media features should add the FFmpeg components, typed worker operations, native IO, and real-WASM tests they need.

## Ordinary app development

Use the repository's Node and pnpm versions. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @project/client run start
```

Client startup and production builds read only the committed `ffmpeg/artifact-lock.json`; they do not download, build, or bundle FFmpeg assets. The browser fetches the selected GitHub release on first use. Docker and a native build are only needed when developing FFmpeg itself. Extension development does not need runtime preparation.

## FFmpeg feature development

Install the repository dependencies and have Docker with buildx available, then run:

```sh
pnpm --filter @project/ffmpeg run build:candidate
VITE_FFMPEG_CANDIDATE=1 pnpm --filter @project/client run start
```

The build command builds the native runtime and worker, packages the release materials into `ffmpeg/release/`, and verifies the candidate. It downloads the hash-verified upstream source tarballs listed in `build-config.json` and uses the pinned Emscripten container; no host C++ or Emscripten toolchain is required. The second command starts the client against the local candidate.

Candidate builds use `artifacts.ffmpeg.version` in the repository's `project.json` and the current `build-config.json`. They leave `artifact-lock.json` untouched. After changing native code, the worker, or build inputs, rebuild and restart the client so it receives the rebuilt runtime archive and its matching hash. Ordinary client changes use Vite's hot reload.

To create a client build for testing the candidate, including its PWA behavior:

```sh
VITE_FFMPEG_CANDIDATE=1 pnpm --filter @project/client run buildFast
VITE_FFMPEG_CANDIDATE=1 pnpm --filter @project/client run preview
```

Candidate client startup/builds verify the local candidate and serve its runtime archive from the app's `ffmpeg/` path instead of fetching a release; the app downloads, verifies, caches, and unpacks it exactly as it does a release. The archive is served with a `.tgz` name because Vite's static server marks stored `*.gz` files as `Content-Encoding: gzip`, which would make the browser decode it before verification. Use normal client commands to return to the selected release.

## Verification

Run commands from the repository root:

| Command                                            | Checks                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run verify`                                  | App checks and FFmpeg tests, TypeScript, lint, and formatting; no Docker                                                                    |
| `pnpm --filter @project/ffmpeg run verify:code`    | Runtime version format, FFmpeg tests, TypeScript, lint, and formatting                                                                      |
| `pnpm --filter @project/ffmpeg run verify:release` | Code checks, candidate verification, native/WASM tests, and a clean rebuild from the published source with byte-for-byte release comparison |

The FFmpeg package's `build:candidate` command validates the generated candidate. For native C++ tests and a real-WASM smoke test, run `pnpm run test:native-wasm` from `ffmpeg/`. The full release check requires a candidate to exist and is separate so normal development does not repeat the clean reproduction build.

Pull-request CI checks the host code and runs native tests when native build inputs change. The manual **Release FFmpeg** workflow runs the full release check before publishing.

## Publishing and selecting a runtime

Native code, emitted worker code, build configuration/toolchain, and runtime API changes need a matching release before they merge. App-only integration, tests, and documentation generally do not. For a series of FFmpeg changes, publish once from the final combined source and select that release in the PR that brings it to `main`.

1. Bump the runtime version in `project.json` → `artifacts.ffmpeg.version`, versions should follow `0.X.Y` semantic versioning.
2. Build/test locally as needed, then commit and push the final source.
3. Run **Release FFmpeg** for that branch. It builds and checks the candidate, then publishes `ffmpeg-v<version>` with two assets: `asbplayer-ffmpeg-<version>-runtime.tar.gz` (worker, core module, WASM, manifest, and license notices) and `asbplayer-ffmpeg-<version>-sources.tar.gz` (the unmodified upstream source tarballs). GitHub adds source code archives of the tagged commit to every release, and computes SHA-256 digests for each asset.
4. Run `pnpm run select:runtime --repo owner/repo` from `ffmpeg/`. The repository defaults to `GH_REPO`, then `GITHUB_REPOSITORY`, then the GitHub `origin` remote. This downloads the published runtime and sources archives, verifies the runtime archive against its manifest and checks that the sources archive holds exactly the upstream tarballs with the hashes the manifest records, and writes the archive's name, SHA-256, and size to `artifact-lock.json`.
5. Review and commit the lock change. Normal client commands now consume the selected release.

Published versions are immutable. Any change to published runtime bytes or capabilities needs a new version. Selection verifies published assets rather than relying on local candidate files. GitHub's immutable releases should be enabled for the repository so a published tag and its assets cannot change; the release's source code archives are generated from that tag.

App deployments and FFmpeg releases are independent. Production app output contains no FFmpeg payload, notices, or source: these are distributed by the release. The app fetches only the runtime archive at runtime. `VITE_FFMPEG_CANDIDATE=1` explicitly includes the local candidate's runtime archive under `ffmpeg/` for testing. `pnpm run fetch` remains available in `ffmpeg/` to inspect a frozen runtime locally, but ordinary app commands do not use it.

## Browser integration

Use `createWebFfmpegSession` from `client/src/services/ffmpeg.ts`. Create a session for the lifetime of the feature that owns it:

```ts
const owner = new AbortController();
const session = createWebFfmpegSession({
    signal: owner.signal,
});
// Wire the feature's Cancel action to owner.abort().
try {
    const runtime = await session.load();
    const info = await runtime.inspect();
    // Use the runtime within this feature's lifetime.
} finally {
    session.dispose();
}
```

The first load resolves the runtime archive through GitHub's public release API and downloads it with `Accept: application/octet-stream` for cross-origin browser access, then verifies it against the SHA-256 and byte size embedded from the lock. Each session load decompresses the verified archive with the browser's `DecompressionStream`, extracts the worker, core module, and WASM with a minimal ustar reader (releases pin `tar --format=ustar`), and executes Blob URLs created from those bytes, including before service-worker control or when persistent storage is unavailable. Unpacking takes milliseconds compared to WASM compilation and media work. A Content Security Policy must allow Blob workers, module imports, and WASM fetches.

The owner's signal or `dispose()` stops shared downloads and terminates the worker, including synchronous native work. Disposal/failure releases executable URLs. Create a fresh session to retry. A signal passed to `load({ signal })` or `inspect({ signal })` cancels only that caller's wait. Initialization has no timeout.

`createInputReader(fileOrBlob)` provides synchronous worker-side random access through bounded slices, with a 64 KiB default maximum per read. It preserves safe integer offsets above 4 GiB, clips reads at EOF, and rejects invalid ranges without copying the entire file into WASM. Native IO adapters, codecs, and job queues belong to future features that need them.

## Offline use and app updates

The app works offline without FFmpeg. FFmpeg works offline after its runtime archive is cached, subject to browser storage limits. First installation needs a connection. Storage failures allow online execution of verified bytes without an offline cache.

App updates never download or wait for FFmpeg. One `asbplayer-ffmpeg` cache stores the compressed runtime archive under a single stable key, so only one runtime is ever cached. A later session reuses a matching hash and replaces a mismatch on demand. There are no versioned runtime caches or retention guarantees for old tabs; a different app version may need to download its expected archive again. Existing sessions keep their verified Blob URLs until disposed.

Cache checks happen when an FFmpeg session loads, rather than at app startup or during an app update. The cached response stores its verified SHA-256 in a header; there is no separate cached metadata file. A matching hash is reused, including by a new app version selecting the same FFmpeg bytes. A missing or mismatched archive is downloaded and verified automatically. An unused cached archive remains until FFmpeg is needed again or the browser evicts it. If GitHub or the download is unavailable, that FFmpeg session fails; app updates remain independent.

## Build inventory

The worker's esbuild dependency is pinned in `package.json` and resolved by `pnpm-lock.yaml`. The generated runtime manifest records the installed esbuild version, and candidate verification checks it against that installation. Frozen runtime verification uses the selected release's recorded metadata.

`scripts/release-names.mjs` defines the public release tag and title, archive filenames, and sources directory name, using `artifacts.ffmpeg.prefix` and `artifacts.ffmpeg.tagPrefix` from the repository's `project.json`. Packaging, release selection, the client build, and the shell/CI metadata command (`node ffmpeg/scripts/release-info.mjs`) share these names. The committed `artifact-lock.json` records the exact URL of the selected published release.

`runtime-assets.json` declares the executable filenames/MIME types the app extracts from the runtime archive, and the notice filenames packaged into it. The manifest measures linked libraries, operations, identity, and initial/shared memory by loading the compiled bridge. `limits` records declared build inputs; configure starts with `--disable-all` (which retains `libavutil`) and disables external-library autodetection and pthreads. The remaining options configure the WASM toolchain and output size; new media features explicitly enable only their required components. The real-WASM smoke test separately verifies the runtime against the intended library/API contract.

## Corresponding source and licensing

Each release offers the corresponding source of every bundled library from the same place as the runtime:

- `asbplayer-ffmpeg-<version>-sources.tar.gz`, holding each unmodified upstream source tarball (byte-identical to its upstream download and pinned by SHA-256 in `build-config.json`) under one `asbplayer-ffmpeg-<version>-sources/` directory
- GitHub's source code archives of the tagged commit, containing the native bridge, worker/client source, tests, container recipe, lockfiles, and build scripts

Keeping the upstream tarballs unmodified lets anyone check them against the upstream hashes and signatures. To rebuild from those, extract the source code archive, extract the sources archive's tarballs into `ffmpeg/.cache/archives/` (`tar -xzf asbplayer-ffmpeg-<version>-sources.tar.gz --strip-components=1 -C ffmpeg/.cache/archives`), and run with Docker/buildx available:

```sh
corepack enable
pnpm install --frozen-lockfile --filter @project/ffmpeg
pnpm --filter @project/ffmpeg run build:candidate
```

`verify:reproducible` performs this rebuild from the repository files and the packaged sources archive and compares the result byte for byte.

The runtime combines asbplayer's AGPL-3.0-or-later native bridge and worker with LGPL-2.1-or-later FFmpeg. The runtime archive includes the asbplayer, FFmpeg, and related notices. The app's About page lists FFmpeg and links to the release page of the version selected in `artifact-lock.json`. Verification rejects GPL, nonfree, version-3, network, or threaded builds but may be allowed if a specific need arises.
