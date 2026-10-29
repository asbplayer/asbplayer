# Building and verifying FFmpeg

This workspace builds the native FFmpeg bridge and its browser worker as an independently versioned runtime. The current build links only `libavutil` and exposes runtime inspection. Ordinary app and extension development can use the selected release without building FFmpeg; see the [README](../README.md).

Ordinary client startup and builds acquire the pinned GitHub release with Node and copy only its runtime archive into the app. [Uploaded drafts can be tested locally](release.md#test-an-uploaded-draft-locally) using an existing `gh` login, without compiling a candidate. This is also the Cloudflare path: it needs no Docker or native toolchain. Downloads and cached build inputs are verified against the lock's hash and size.

The commands below run from the repository root unless stated otherwise. Use the repository's Node and pnpm versions, and have Docker with buildx available for native builds.

## Develop a local candidate

Install the repository dependencies, build a candidate, and start the client against it:

```sh
pnpm install --frozen-lockfile
pnpm --filter @project/ffmpeg run build:candidate
VITE_FFMPEG_CANDIDATE=1 pnpm --filter @project/client run start
```

`build:candidate` compiles the native runtime and worker, packages the release materials into `ffmpeg/release/`, and verifies the candidate. It downloads the hash-verified upstream source tarballs listed in [`build-config.json`](../build-config.json) and uses the pinned Emscripten container; no host C++ or Emscripten toolchain is required.

Candidate builds use the runtime version in [`artifact-lock.json`](../artifact-lock.json) and the current `build-config.json`, leaving the lock untouched. Rebuilt candidates can keep the same version: the browser cache matches the archive's SHA-256, so changed bytes replace the cached archive. After changing native code, the worker, or build inputs, rebuild and restart the client so it receives the rebuilt archive and its matching hash. Ordinary client changes use Vite's hot reload.

To create a client build for testing the candidate, including its PWA behavior:

```sh
VITE_FFMPEG_CANDIDATE=1 pnpm --filter @project/client run buildFast
pnpm --filter @project/client run preview
```

Candidate client startup/builds verify the local candidate and serve its archive at the app's stable `ffmpeg/runtime.tgz` path, using the same [download and caching](caching.md) and [runtime loading](runtime.md) paths as a published release. The archive uses a `.tgz` name because Vite's static server marks `*.gz` files as `Content-Encoding: gzip`, which would make the browser decode it before verification. Use normal client commands to return to the selected release, or see [release instructions](release.md) to publish the candidate.

## Verification

| Command                                            | Checks                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run verify`                                  | App and repository script checks, FFmpeg tests, TypeScript, lint, and formatting; no Docker                                                 |
| `pnpm --filter @project/ffmpeg run verify:code`    | FFmpeg tests, TypeScript, lint, and formatting                                                                                              |
| `pnpm --filter @project/ffmpeg run verify:release` | Code checks, candidate verification, native/WASM tests, and a clean rebuild from the published source with byte-for-byte release comparison |

The FFmpeg package's `build:candidate` command validates the generated candidate. For native C++ tests and a real-WASM smoke test, run `pnpm run test:native-wasm` from `ffmpeg/`. The full release check requires a candidate to exist and is separate so normal development does not repeat the clean reproduction build.

Pull-request CI checks the host code and runs native tests when native build inputs change. The manual **Release FFmpeg** workflow runs the full release check before publishing.

## From source to verified candidate

1. **Prepare inputs.** `build:candidate` in [package.json](../package.json) starts [build.sh](../scripts/build.sh). Its shared [build-common.sh](../scripts/build-common.sh) setup runs [prepare-sources.mjs](../scripts/prepare-sources.mjs) to download and verify upstream sources and [generate-build-inputs.mjs](../scripts/generate-build-inputs.mjs) to generate compiler and Docker inputs from [build-config.json](../build-config.json) and the repository's [project.json](../../project.json).
2. **Compile and assemble.** The [Dockerfile](../Dockerfile) builds FFmpeg and the bridge in [native/runtime.cpp](../native/runtime.cpp) into the core JavaScript module and WASM. `build.sh` bundles [worker.ts](../src/worker.ts) with Rolldown, checks linked system-library notices, and copies release notices. The assembled runtime goes into `ffmpeg/dist/<version>/`.
3. **Record and package.** [package-candidate.sh](../scripts/package-candidate.sh) runs [generate-manifest.mjs](../scripts/generate-manifest.mjs), which uses [inspect-runtime.mjs](../scripts/inspect-runtime.mjs) to measure the compiled runtime's identity, capabilities, and memory. [package-release.mjs](../scripts/package-release.mjs) then creates runtime and upstream source archives in `ffmpeg/release/`.
4. **Verify the candidate.** [verify-artifacts.mjs](../scripts/verify-artifacts.mjs) checks the manifest against current build inputs and verifies the packaged contents. Shared checks in [runtime-manifest.mjs](../scripts/runtime-manifest.mjs) validate identity, paths, file inventories, regular files, sizes, and hashes. These archives are ready for the full release checks.

## Build inventory

The worker's Rolldown dependency is pinned in the FFmpeg [package.json](../package.json) and resolved by the repository's [pnpm-lock.yaml](../../pnpm-lock.yaml). The generated runtime manifest records the installed Rolldown version, and candidate verification checks it against that installation. Verification of a selected release uses its recorded metadata, independently of the current bundler installation.

[`runtime-assets.json`](../runtime-assets.json) declares the executable filenames/MIME types the app extracts from the runtime archive, and the notice filenames packaged into it. The manifest measures linked libraries, operations, identity, and initial/shared memory by loading the compiled bridge. `limits` in [`build-config.json`](../build-config.json) records declared build inputs; configure starts with `--disable-all` (which retains `libavutil`) and disables external-library autodetection and pthreads. `--enable-version3` enables the LGPLv3 distribution used by this project; GPL and nonfree components remain disabled. The remaining options configure the WASM toolchain and output size; new media features explicitly enable only their required components. The real-WASM smoke test separately verifies the runtime against the intended library/API contract.

Release and archive names are shared with the client and selection scripts; see [release metadata](release.md#release-metadata).

## Rebuild from released sources

Each release offers the repository source and upstream source tarballs described in [corresponding source and licensing](release.md#corresponding-source-and-licensing). Keeping the upstream tarballs unmodified lets anyone check them against the upstream hashes and signatures. Extract the source code archive and place the sources archive in its root, then run there with Docker/buildx available. Replace `0.1.0` below with the release's runtime version:

```sh
mkdir -p ffmpeg/.cache/archives
tar -xzf asbplayer-ffmpeg-0.1.0-sources.tar.gz --strip-components=1 -C ffmpeg/.cache/archives
corepack enable
pnpm install --frozen-lockfile --filter @project/ffmpeg
ASB_FFMPEG_RUNTIME_VERSION=0.1.0 pnpm --filter @project/ffmpeg run build:candidate
```

The override stamps the release version into the build without changing the lock, which may still select an earlier runtime in the tagged source. The release workflow supplies it automatically for builds and checks. Use the same override when running `verify:release` or [`verify:reproducible`](../scripts/verify-reproducible.sh), which rebuilds from the repository files and packaged sources archive and compares the result byte for byte. Reproduction works from both a Git checkout and an extracted source archive; installed dependencies and generated FFmpeg outputs are excluded from the clean rebuild.
