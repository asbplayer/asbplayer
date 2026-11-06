# Releasing and selecting an FFmpeg runtime

The app uses the published runtime selected by [`artifact-lock.json`](../artifact-lock.json), independently of the FFmpeg source currently on `main`. Compatible source changes can accumulate and ship together; updating the lock makes the new runtime available to the app. For local development and checks, see [building and verifying FFmpeg](build.md).

The commands below run from the repository root unless stated otherwise.

## Develop, review, and publish a runtime

1. Commit and push the implementation source. Leave `artifact-lock.json` selecting the previous published runtime so implementation PRs can pass Verify independently of the next runtime release.
2. Run [**Release FFmpeg**](../../.github/workflows/ffmpeg-release.yml) against that branch and choose **patch** or **minor**.
3. The workflow builds and runs [release-check.sh](../scripts/release-check.sh): code and artifact checks, native/WASM tests, and a clean rebuild for byte-for-byte comparison. It passes `ASB_FFMPEG_RUNTIME_VERSION` without modifying the lock, then creates a draft `ffmpeg-v<version>` with a runtime archive and an upstream sources archive.
4. [Test the uploaded draft locally](#test-an-uploaded-draft-locally). Continue reviewing and merging implementation PRs while their committed locks select the previous published runtime.
5. To rebuild the pending release from a newer commit, run **Release FFmpeg** on the desired branch with **current (draft only)**. This resolves the sole existing FFmpeg draft in the workflow repository, independently of the selected version. It fails if there are no matching drafts or multiple matching drafts. After verification, it replaces the runtime and sources assets and updates the draft's target commit, preserving its release notes. It rechecks that the original release is still a draft before replacing assets and updating its target. Published releases cannot be updated with `current`.
6. Once the implementation is ready, rebuild the draft against the final source (for example, `main` after the implementation PRs merge). Wait for the workflow to finish, finalize the release notes, and publish the draft.
7. Open a separate selection PR: run `pnpm --filter @project/ffmpeg run select:runtime --version 0.X.Y --repo owner/repo`, review the generated lock, and commit it. Verify and production app builds now consume the published runtime.

The workflow serializes release runs and rejects existing tags so the published source points at the commit that produced the assets. Patch and minor create new drafts; `current` only updates an existing draft. Published runtime bytes and capabilities are immutable and require a new version to change. Select and commit the preceding release before calculating another bump from it.

Production app builds download the selected runtime archive, verify its locked SHA-256 and size, and copy it, including its license notices, to `ffmpeg/runtime.tgz`. The source archives remain on the exact GitHub release linked from About. The browser [downloads and caches](caching.md) only the app-hosted runtime on demand. [Candidate mode](build.md#develop-a-local-candidate) uses the same path with verified local bytes.

## Test an uploaded draft locally

Authenticate with access to the release repository, temporarily select the draft, and run the normal client commands:

```sh
gh auth login
pnpm --filter @project/ffmpeg run select:runtime --version 0.2.0 --repo asbplayer/asbplayer
pnpm --filter @project/client run start
```

No local native build or candidate mode is required. The client downloader tries the public URL first. If GitHub returns 404, it uses `GH_TOKEN`, `GITHUB_TOKEN`, or the existing `gh` login to fetch the selected asset through GitHub's API. Both GitHub's digest/size and the committed or locally selected hash/size must match before the archive enters the normal cache. Verified cached bytes are usable without credentials. Public downloads remain anonymous.

Keep this draft selection uncommitted during implementation review. Rerun selection whenever draft assets are replaced; changed draft bytes may be selected again at the same version. Restart the client to receive the new selection. Restore the previous lock before committing implementation changes:

```sh
git restore ffmpeg/artifact-lock.json
```

Once the release is published, selection rejects changing its locked bytes at the same version. Publishing an unchanged draft does not require a lock edit. CI continues to select the previous public runtime until the selection PR lands.

## Selection and verification

Without `--repo`, selection uses `GH_REPO`, then `GITHUB_REPOSITORY`, then the GitHub `origin` remote. For drafts, authenticate with repository access using `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth login` (in that order).

Selection downloads both archives through GitHub's API and requires their SHA-256 digests and sizes to match GitHub's asset metadata. The [shared manifest verifier](../scripts/runtime-manifest.mjs) checks the runtime contents, and [sources-archive.mjs](../scripts/sources-archive.mjs) checks that the sources archive contains exactly the upstream tarballs with the recorded hashes. Successful selection writes the runtime archive's name, SHA-256, and size to the lock. Missing or invalid GitHub digests fail selection without changing it.

## Release metadata

[`release-names.mjs`](../scripts/release-names.mjs) expands the `releases.ffmpeg.releaseTitle`, `releaseTag`, `artifact`, and `sources` templates from the repository's [`project.json`](../../project.json) using the runtime version. The `artifact` and `sources` values are basenames; archive filenames append `.tar.gz`, and the expanded `sources` value also names the sources directory. Defaults are `asbplayer-ffmpeg-<version>-runtime.tar.gz` and `asbplayer-ffmpeg-<version>-sources.tar.gz`.

Packaging, release selection, the client build, and the shell/CI metadata command ([`node ffmpeg/scripts/release-info.mjs`](../scripts/release-info.mjs)) share these names. `project.json` holds only the naming templates; the committed `artifact-lock.json` is the version source and records the selected release's exact URL. [`runtime-version.mjs`](../scripts/runtime-version.mjs) validates version format for builds, release bumps, and selection. `release-info.mjs --bump patch` or `--bump minor` prints the next release's metadata without changing the lock. `--bump current` authenticates through the same token/`gh` fallback as selection, requires `GH_REPO` or `GITHUB_REPOSITORY`, and prints the pending draft's version and release ID instead of the locked version.

## Corresponding source and licensing

Each release offers the corresponding source of every bundled library from the same place as the runtime:

- `asbplayer-ffmpeg-<version>-sources.tar.gz`, holding each unmodified upstream source tarball (byte-identical to its upstream download and pinned by SHA-256 in `build-config.json`) under one `asbplayer-ffmpeg-<version>-sources/` directory
- GitHub's source code archives of the tagged commit, containing the native bridge, worker/client source, tests, container recipe, lockfiles, and build scripts

The upstream tarballs remain unmodified so anyone can check them against upstream hashes and signatures. See [rebuilding from released sources](build.md#rebuild-from-released-sources) for extraction and build commands and the byte-for-byte reproduction check.

The runtime is built with `--enable-version3` and combines asbplayer's AGPL-3.0-or-later bridge and worker with LGPLv3 FFmpeg. The runtime archive includes the asbplayer notice, both LGPL 3 and GPL 3 texts, and related notices. Both candidate and selected-release verification require LGPLv3, `--enable-version3`, and both license texts.

`--enable-version3` is required by this project's distribution policy because the app hosts the runtime while GitHub hosts its corresponding source. LGPL 2.1 offers online source distribution, but describes access from the same place; version 3 explicitly permits another server through GPL 3 §6(d). The flag makes that license choice explicit in the compiled FFmpeg runtime.

The app's About page lists FFmpeg and links to the exact release selected in `artifact-lock.json`, offering the corresponding tagged repository source and upstream tarballs.

Verification rejects GPL, network, or threaded builds but may be allowed if a specific need arises.
