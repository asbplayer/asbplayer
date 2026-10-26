# asbplayer FFmpeg runtime

This workspace builds an optional, independently versioned FFmpeg dependency for the webapp. It currently exposes runtime inspection and links only `libavutil`. Media features should add the FFmpeg components, typed worker operations, native IO, and real-WASM tests they need.

## Ordinary app development

Use the repository's Node and pnpm versions. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @project/client run start
```

Client startup and production builds select the FFmpeg runtime from the committed `ffmpeg/artifact-lock.json`; they do not download, build, or bundle FFmpeg assets. The browser fetches the selected GitHub release on first use. Docker and a native build are only needed when developing FFmpeg itself. Extension development does not need runtime preparation.

## FFmpeg feature development

Install the repository dependencies and have Docker with buildx available, then run:

```sh
pnpm --filter @project/ffmpeg run build:candidate
VITE_FFMPEG_CANDIDATE=1 pnpm --filter @project/client run start
```

The build command builds the native runtime and worker, packages the release materials into `ffmpeg/release/`, and verifies the candidate. It downloads the hash-verified upstream source tarballs listed in `build-config.json` and uses the pinned Emscripten container; no host C++ or Emscripten toolchain is required. The second command starts the client against the local candidate.

Candidate builds use `releases.ffmpeg.version` in the repository's `project.json` and the current `build-config.json`. They leave `artifact-lock.json` untouched. After changing native code, the worker, or build inputs, rebuild and restart the client so it receives the rebuilt runtime archive and its matching hash. Ordinary client changes use Vite's hot reload.

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

FFmpeg source changes can merge independently of runtime releases. The app always uses the published runtime explicitly selected by `artifact-lock.json`, regardless of the FFmpeg source currently on `main`. Multiple FFmpeg changes can accumulate on `main` and be published together as a single runtime release when ready, if they do not break the contract the app expects. Updating `artifact-lock.json` is the explicit step that makes a new runtime available to the app.

1. Bump the runtime version in `project.json` → `releases.ffmpeg.version`, versions should follow `0.X.Y` semantic versioning.
2. Build/test locally as needed, then commit and push the final source.
3. Run **Release FFmpeg** for that branch. It builds and checks the candidate, then creates a draft `ffmpeg-v<version>` release with two assets: `asbplayer-ffmpeg-<version>-runtime.tar.gz` (worker, core module, WASM, manifest, and license notices) and `asbplayer-ffmpeg-<version>-sources.tar.gz` (the unmodified upstream source tarballs). GitHub adds source code archives of the tagged commit when the release is published, and computes SHA-256 digests for each asset.
4. Run `pnpm run select:runtime --repo owner/repo` from `ffmpeg/`. The repository defaults to `GH_REPO`, then `GITHUB_REPOSITORY`, then the GitHub `origin` remote. Selection supports published and draft releases. For drafts, authenticate with repository access using `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth login` (in that order). It downloads both archives through GitHub's API and requires their SHA-256 digests and sizes to match GitHub's asset metadata. It also verifies the runtime archive against its manifest and checks that the sources archive holds exactly the upstream tarballs with the hashes the manifest records, then writes the runtime archive's name, SHA-256, and size to `artifact-lock.json`. Missing or invalid GitHub digests fail selection without changing the lock.
5. Publish the draft with its relevant release notes before using it in the app, then review and commit the lock change. Normal client commands now consume the selected release. The lock records the final public release URLs, so publishing an unchanged draft does not require reselection.

Published versions are immutable. Any change to published runtime bytes or capabilities needs a new version. Selection verifies published assets rather than relying on local candidate files.

App deployments and FFmpeg releases are independent. Production app output contains no FFmpeg payload, notices, or source: these are distributed by the release. The app fetches only the runtime archive at runtime. `VITE_FFMPEG_CANDIDATE=1` explicitly includes the local candidate's runtime archive under `ffmpeg/` for testing.

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

## Code organization

The feature has four pipelines, from building an independent runtime to executing feature requests in the browser. Each stage below identifies the files that own its work.

### Build: source to verified candidate

1. **Prepare inputs.** `build:candidate` in [package.json](package.json) starts [build.sh](scripts/build.sh). Its shared [build-common.sh](scripts/build-common.sh) setup runs [prepare-sources.mjs](scripts/prepare-sources.mjs) to download and verify upstream sources and [generate-build-inputs.mjs](scripts/generate-build-inputs.mjs) to generate compiler and Docker inputs from [build-config.json](build-config.json) and the repository's [project.json](../project.json).
2. **Compile and assemble.** The [Dockerfile](Dockerfile) builds FFmpeg and the bridge in [native/runtime.cpp](native/runtime.cpp) into the core JavaScript module and WASM. `build.sh` bundles [worker.ts](src/worker.ts) with esbuild, checks linked system-library notices, and copies release notices. The assembled runtime goes into `ffmpeg/dist/<version>/`.
3. **Record and package.** [package-candidate.sh](scripts/package-candidate.sh) runs [generate-manifest.mjs](scripts/generate-manifest.mjs), which uses [inspect-runtime.mjs](scripts/inspect-runtime.mjs) to measure the compiled runtime's identity, capabilities, and memory. [package-release.mjs](scripts/package-release.mjs) then creates runtime and upstream source archives in `ffmpeg/release/`.
4. **Verify the candidate.** [verify-artifacts.mjs](scripts/verify-artifacts.mjs) checks the manifest against current build inputs and verifies the packaged contents. Shared checks in [runtime-manifest.mjs](scripts/runtime-manifest.mjs) validate identity, paths, file inventories, regular files, sizes, and hashes. These archives are ready for the full release checks.

### Release: candidate to selected version

1. **Run release checks.** [ffmpeg-release.yml](../.github/workflows/ffmpeg-release.yml) builds a candidate and runs [release-check.sh](scripts/release-check.sh). This includes code and artifact checks, native/WASM tests, and a clean rebuild through [verify-reproducible.sh](scripts/verify-reproducible.sh) for byte-for-byte comparison.
2. **Create a draft.** The workflow uploads the verified runtime and source archives to a draft GitHub release. [release-info.mjs](scripts/release-info.mjs) and [release-names.mjs](scripts/release-names.mjs) supply the version, tag, title, and archive names.
3. **Select a runtime.** [select-runtime.mjs](scripts/select-runtime.mjs) finds a draft or published release, downloads both archives, and verifies GitHub's digests and sizes. It uses the shared manifest verifier for runtime contents and [sources-archive.mjs](scripts/sources-archive.mjs) for upstream tarballs, then writes [artifact-lock.json](artifact-lock.json). [runtime-version.mjs](scripts/runtime-version.mjs) shares version-format parsing with the repository's [version-progression check](../scripts/check-ffmpeg-version.ts).
4. **Publish and commit.** Publish the selected draft if needed, then review and commit the lock. App builds consume this selection independently of ongoing runtime development.

### Download and cache: selected version to browser assets

1. **Embed the selection.** [selected-runtime.ts](src/selected-runtime.ts) exposes committed release defaults from the lock. [client/ffmpeg-build.ts](../client/ffmpeg-build.ts) supplies Vite definitions and candidate copy targets; [metadata.ts](src/metadata.ts) exposes the resulting metadata to browser code, applying build-time overrides when present.
2. **Prepare a browser session.** [client/src/services/ffmpeg.ts](../client/src/services/ffmpeg.ts) composes the session's worker factory and asset preparation. Its [ffmpeg-cache.ts](../client/src/services/ffmpeg-cache.ts) service reuses a cached archive with a matching verification marker, or downloads and verifies the archive's size and SHA-256 before attempting a cache write. [ffmpeg-release.ts](../client/src/services/ffmpeg-release.ts) resolves GitHub release assets for downloads. Storage failures still allow online execution of verified bytes.
3. **Create executable assets.** [runtime-archive.ts](src/runtime-archive.ts) decompresses and extracts the verified archive. [assets.ts](src/assets.ts) creates disposable Blob URLs for the worker, core module, and WASM.

Candidate mode uses a local archive through the same verification, caching, and extraction flow.

### Runtime: feature requests to native FFmpeg

1. **Load and own the session.** [session.ts](src/session.ts) starts asset preparation and the worker, manages pending requests and cancellation, and releases resources when the session ends.
2. **Initialize the worker.** [worker.ts](src/worker.ts) validates requests and calls `handleInitialize()` to import the core module, instantiate WASM, and create the native bridge. It returns runtime information so the session can check its identity before becoming ready.
3. **Dispatch operations.** Feature requests pass through the session using message types from [protocol.ts](src/protocol.ts). The worker validates session identity and dispatches operations. Substantial operations get handler functions in `worker.ts`; request validation, replies, and error handling remain centralized.
4. **Call native code and reply.** [native.ts](src/native.ts) owns JavaScript/WASM interop and calls the C API declared in [asb_ffmpeg.h](native/include/asb_ffmpeg.h), implemented by [runtime.cpp](native/runtime.cpp). The worker sends the result or error back, and the session resolves or rejects the feature's pending Promise.

## Build inventory

The worker's esbuild dependency is pinned in `package.json` and resolved by `pnpm-lock.yaml`. The generated runtime manifest records the installed esbuild version, and candidate verification checks it against that installation. Frozen runtime verification uses the selected release's recorded metadata.

`scripts/release-names.mjs` expands the `releases.ffmpeg.releaseTitle`, `releaseTag`, `artifact`, and `sources` templates from the repository's `project.json` using the runtime version. The `artifact` and `sources` values are basenames; archive filenames append `.tar.gz`, and the expanded `sources` value also names the sources directory. Packaging, release selection, the client build, and the shell/CI metadata command (`node ffmpeg/scripts/release-info.mjs`) share these names. The committed `artifact-lock.json` records the exact URL of the selected published release.

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
