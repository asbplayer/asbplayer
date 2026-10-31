# Contributing

Contributions to the project are always welcome. asbplayer will never be complete, and there are a ton of [issues](https://github.com/asbplayer/asbplayer/issues) to work on. [Many contributions](https://github.com/asbplayer/asbplayer/pulls?q=is%3Apr+is%3Aclosed) have already been made, including some very large features.

## AI-assisted contributions

### Large contributions

While it is possible to make large and valuable contributions using AI very quickly, reviewing those contributions still takes enormous amounts of time. Therefore, **it is highly recommended that you discuss feature and implementation details with maintainers before opening a large PR.** Maintainers can be easily reached on a [GitHub issue](https://github.com/asbplayer/asbplayer/issues) or [Discord](https://discord.gg/ad7VAQru7m).

### Commit messages

The guidelines below take inspiration from the [Linux project](https://github.com/torvalds/linux/blob/master/Documentation/process/coding-assistants.rst#attribution).

AI-assisted contributions must include a tag like the following in the commit message:

```
Assisted-by: AGENT_NAME:MODEL_VERSION
```

For example:

```
Assisted-by: Claude:claude-3-opus
```

## License

Please review the contribution licensing terms in [CONTRIBUTORS](./CONTRIBUTORS) before contributing.

## Pull requests

Make sure the pre-merge checks are passing:

```bash
pnpm run verify
```

Then open a pull request on the [GitHub repository](https://github.com/asbplayer/asbplayer).

## Documentation

Documentation is under the `docs` folder in this repository. When adding new features, please update the documentation as well.

## Development

Shared project metadata and defaults live in [`project.json`](./project.json). App and extension code import it through `@project/common/project`; docs use `@site/src/project`, and build configuration imports the JSON directly. User settings and environment variables can still override service defaults.

Use these values for current project defaults, links, and UI metadata. Keep user overrides, historical release links, compatibility versions, and independent test fixtures separate. `defaultLanguage` controls the app's initial/fallback language; English source content and documentation retain their own language. Docs can import `@site/src/project` in MDX links and examples.

### Versions

- `version` is the extension build version. A maintainer bumps it before a release, or anyone is free to bump it in their PR when a feature needs a new version for a runtime compatibility check (usually a minor version, never major). Most changes, fixes, and features should not change it. Existing feature compatibility checks keep the version in which that feature was introduced.
- `releases.extension.publishedVersion` tracks the latest extension version published to **all stores**, including Chrome, Firefox, and Firefox for Android. A maintainer updates it only after that version is available in every store. It may lag behind `version` during development and store review.
- `releases.app.releaseTag` is the tag template for app deploys. Each deploy tags its date-based version (`app-v26.10.30`); further deploys on the same day add `.1`, `.2`, and so on. The About dialog links to the running build's tag.

After editing `project.json`, run `pnpm sync:project` and include the generated changes in your commit. `pnpm check:project` (also part of `pnpm verify`) detects stale generated files. The Anki add-on and Go server packaging scripts also synchronize configuration before building, so their distributions do not need the repository at runtime.

### Commands

Use the Node version specified in `.nvmrc`, either via a node version manager (e.g. `nvm use`) or via nix, which has it locked down in `flake.lock`.

Below are useful commands for development.

```bash
# Install pnpm (if not using nix). Other ways to install: https://pnpm.io/installation
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=11.27.0 sh -

# Install dependencies
pnpm i

# Starts the development server for the website
pnpm --filter @project/client run start

# Starts the dev server for the Chromium version of the extension to extension/.output/chrome-mv3-dev
pnpm --filter @project/extension dev

# Starts the dev server for the Firefox version of the extension to extension/.output/firefox-mv2-dev
pnpm --filter @project/extension dev:firefox

# Starts the dev server for the Firefox for Android version of the extension to extension/.output/firefox-android-mv2-dev
pnpm --filter @project/extension dev:firefox-android

# Push the Firefox for Android extension to a connected Android device
./scripts/push-firefox-android
```

If you have problems building try deleting `node_modules` and re-running `pnpm i`.

## Localization

Any new localization keys should first be added to the English loc files, and then copied across all the other loc files using a helper script.

```bash
cd ./scripts/loc
node ./merge-loc-from-en.js
```

Translations are later pulled from the [Crowdin project](https://crowdin.com/project/asbplayer).

Supported languages and their translation revisions are maintained in `project.json` under `languages`. Each entry has a `code` and a `version`; maintainers bump the revision when publishing updated translations.

`pnpm sync:project` also generates `common/extension.json` for the translation update endpoint used by existing extensions. Edit its inputs in `project.json`; do not edit `extension.json` directly. CI runs sync and fails if it produces modified or untracked files, while local `pnpm check:project` checks for missing or stale outputs without writing.

### Adding a New Language

To add a language, add its entry to `project.json`, then run `pnpm sync:project`. Sync creates missing common, extension, and external locale files from their English sources and records the copied strings as untranslated. Existing translations are preserved. Commit the generated files together with the configuration change, then rebuild to make the language selectable. Locale scripts use the configured language list; extra files in the locale directories do not add supported languages.

Enable new target languages separately in Crowdin's project settings and add a mapping in `scripts/loc/crowdin.yml` when Crowdin's language code differs from the local code. Adding a local language does not enable it on Crowdin.

## Release process

### Webapp

In general, the webapp can be deployed at any time. Webapp-facing changes are written to be backwards compatible with older extensions.

1. Use the [action](https://github.com/asbplayer/asbplayer/actions/workflows/deploy-cf-pages.lock.yml) to create a deploy PR against `cf-pages`. 
2. Review the PR and merge once ready. Any change to `cf-pages` is automatically deployed to [https://app.asbplayer.dev](https://app.asbplayer.dev). The PWA's service worker will pick up the new changes and prompt users to update.

### Extension


1. If an webapp deploy is required for new loc keys and features, and settings shared by both the webapp and extension, deploy the webapp first. If there are new loc keys, ensure that `project.json` loc versions are incremented on `main`.
2. Use the snapshot [action](https://github.com/asbplayer/asbplayer/actions/workflows/release-snapshot-build.yml) to distribute release candidate snapshots on Discord a few days prior to releasing. This gives users an opportunity to test the new build before it's released. It is a known issue that this process is unreliable because only a few users pay attention to snapshots.
3. Use the [action](https://github.com/asbplayer/asbplayer/actions/workflows/draft-extension-release.lock.yml) to draft a GitHub release.
4. The drafted text will be incomplete, so fill in any blanks and edit as necessary.
5. Checkout the release tag and create a new Chromium build locally using `pnpm --filter @project/extension run zip`.
6. Publish the build through the Chrome store dev console.
7. Confirm that the new build is released on the Chrome store. This can take hours to days.
8. Deploy the Firefox builds using the [Firefox action](https://github.com/asbplayer/asbplayer/actions/workflows/release-firefox-build.yml) and the [Firefox for Android action](https://github.com/asbplayer/asbplayer/actions/workflows/release-firefox-android-build.yml).
9. Publish all extension artifacts (`crx` for the Chrome build and `xpi` for Firefox builds) on the release page.