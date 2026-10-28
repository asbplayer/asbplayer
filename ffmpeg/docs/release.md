# Releasing and selecting an FFmpeg runtime

The app uses the published runtime selected by [`artifact-lock.json`](../artifact-lock.json), independently of the FFmpeg source currently on `main`. Compatible source changes can accumulate and ship together; updating the lock makes the new runtime available to the app. For local development and checks, see [building and verifying FFmpeg](build.md).

The commands below run from the repository root unless stated otherwise.

## Publish and select a runtime

1. [Build and test locally](build.md), then commit and push the final source.
2. Run [**Release FFmpeg**](../../.github/workflows/ffmpeg-release.yml) for that branch and choose **patch** or **minor**. Starting from the lock's `runtimeVersion`, patch increments `0.X.Y` to `0.X.(Y+1)`; minor increments it to `0.(X+1).0`. This version is independent of the upstream FFmpeg version in [`build-config.json`](../build-config.json).
3. The workflow builds the new version and runs [release-check.sh](../scripts/release-check.sh): code and artifact checks, native/WASM tests, and a clean rebuild for byte-for-byte comparison. It passes `ASB_FFMPEG_RUNTIME_VERSION` to those commands without modifying the lock, then creates a draft `ffmpeg-v<version>` release with a runtime archive (worker, core module, WASM, manifest, and notices) and a sources archive (unmodified upstream tarballs). GitHub computes SHA-256 digests for the assets and provides source code archives of the tagged commit when published.
4. Run `pnpm run select:runtime --version 0.X.Y --repo owner/repo` from `ffmpeg/`, replacing `0.X.Y` with the new release version. The [selection script](../scripts/select-runtime.mjs) verifies the draft or published assets and writes their runtime selection to `artifact-lock.json`; see [selection and verification](#selection-and-verification) for authentication and integrity checks.
5. Publish the draft with its relevant release notes before using it in the app, then review and commit the lock change. Normal client commands now consume the selected release. The lock records the final public release URLs, so publishing an unchanged draft does not require reselection.

Published versions are immutable. Any change to published runtime bytes or capabilities needs a new version. Selection verifies published assets rather than relying on local candidate files. The workflow rejects existing release tags; select and commit the preceding release before calculating another bump from it.

Production app output contains no FFmpeg payload, notices, or source: these are distributed by the release. The browser [downloads and caches](caching.md) only the runtime archive on demand. [Candidate mode](build.md#develop-a-local-candidate) explicitly includes a local runtime archive under `ffmpeg/` for testing.

## Selection and verification

Without `--repo`, selection uses `GH_REPO`, then `GITHUB_REPOSITORY`, then the GitHub `origin` remote. For drafts, authenticate with repository access using `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth login` (in that order).

Selection downloads both archives through GitHub's API and requires their SHA-256 digests and sizes to match GitHub's asset metadata. The [shared manifest verifier](../scripts/runtime-manifest.mjs) checks the runtime contents, and [sources-archive.mjs](../scripts/sources-archive.mjs) checks that the sources archive contains exactly the upstream tarballs with the recorded hashes. Successful selection writes the runtime archive's name, SHA-256, and size to the lock. Missing or invalid GitHub digests fail selection without changing it.

## Release metadata

[`release-names.mjs`](../scripts/release-names.mjs) expands the `releases.ffmpeg.releaseTitle`, `releaseTag`, `artifact`, and `sources` templates from the repository's [`project.json`](../../project.json) using the runtime version. The `artifact` and `sources` values are basenames; archive filenames append `.tar.gz`, and the expanded `sources` value also names the sources directory. Defaults are `asbplayer-ffmpeg-<version>-runtime.tar.gz` and `asbplayer-ffmpeg-<version>-sources.tar.gz`.

Packaging, release selection, the client build, and the shell/CI metadata command ([`node ffmpeg/scripts/release-info.mjs`](../scripts/release-info.mjs)) share these names. `project.json` holds only the naming templates; the committed `artifact-lock.json` is the version source and records the selected release's exact URL. [`runtime-version.mjs`](../scripts/runtime-version.mjs) validates version format for builds, release bumps, and selection. `release-info.mjs --bump patch` or `--bump minor` prints the next release's metadata without changing the lock.

## Corresponding source and licensing

Each release offers the corresponding source of every bundled library from the same place as the runtime:

- `asbplayer-ffmpeg-<version>-sources.tar.gz`, holding each unmodified upstream source tarball (byte-identical to its upstream download and pinned by SHA-256 in `build-config.json`) under one `asbplayer-ffmpeg-<version>-sources/` directory
- GitHub's source code archives of the tagged commit, containing the native bridge, worker/client source, tests, container recipe, lockfiles, and build scripts

The upstream tarballs remain unmodified so anyone can check them against upstream hashes and signatures. See [rebuilding from released sources](build.md#rebuild-from-released-sources) for extraction and build commands and the byte-for-byte reproduction check.

The runtime combines asbplayer's AGPL-3.0-or-later native bridge and worker with LGPL-2.1-or-later FFmpeg. The runtime archive includes the asbplayer, FFmpeg, and related notices. The app's About page lists FFmpeg and links to the release page of the version selected in `artifact-lock.json`. Verification rejects GPL, nonfree, version-3, network, or threaded builds but may be allowed if a specific need arises.
