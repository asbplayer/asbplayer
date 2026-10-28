# asbplayer FFmpeg runtime

This workspace builds an optional, independently versioned FFmpeg dependency for the webapp.

## Ordinary app development

Use the repository's Node and pnpm versions. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @project/client run start
```

Client startup and production builds use the published runtime selected by [`artifact-lock.json`](artifact-lock.json). They do not download, build, or bundle FFmpeg assets; the browser downloads the runtime on first use. Ordinary app and extension development does not need Docker or an FFmpeg build.

## Documentation

- [Build](docs/build.md): develop a local candidate, run checks, understand the build pipeline, and reproduce released bytes.
- [Release](docs/release.md): publish and select a runtime, understand versioning and archive names, and find corresponding source and licensing details.
- [Caching](docs/caching.md): follow downloads and integrity verification, offline use, and app update behavior.
- [Runtime](docs/runtime.md): integrate browser sessions, manage cancellation and resources, and follow worker/native request handling.

Run `pnpm run verify` from the repository root for app, script, and FFmpeg code checks without Docker. Native builds and full release verification are covered in the [build documentation](docs/build.md#verification).

## Licensing

See [corresponding source and licensing](docs/release.md#corresponding-source-and-licensing) for license notices, source distribution, and rebuild instructions.
