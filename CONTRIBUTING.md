# Contributing

Contributions to the project are always welcome. asbplayer will never be complete, and there are a ton of [issues](https://github.com/asbplayer/asbplayer/issues) to work on. [Many contributions](https://github.com/asbplayer/asbplayer/pulls?q=is%3Apr+is%3Aclosed) have already been made, including some very large features.

## AI-assisted contributions

The guidelines below take inspiration from the [Linux project](https://github.com/torvalds/linux/blob/master/Documentation/process/coding-assistants.rst#attribution).

AI-assisted contributions must include a tag like the following in the commit message:

```
Assisted-by: AGENT_NAME:MODEL_VERSION
```

For example:

```
Assisted-by: Claude:claude-3-opus
```

## Pull requests

Make sure the pre-merge checks are passing:

```bash
yarn run verify
```

Then open a pull request on the [GitHub repository](https://github.com/asbplayer/asbplayer).

## Development

Below are useful commands for development.

```bash
# Install yarn
npm install --global yarn

# Make sure you're on yarn 3
yarn set version 3.2.0

# Install dependencies
yarn

# Starts the development server for the website
yarn workspace @project/client run start

# Starts the dev server for the Chromium version of the extension to extension/.output/chrome-mv3-dev
yarn workspace @project/extension dev

# Starts the dev server for the Firefox version of the extension to extension/.output/firefox-mv2-dev
yarn workspace @project/extension dev:firefox

# Starts the dev server for the Firefox for Android version of the extension to extension/.output/firefox-android-mv2-dev
yarn workspace @project/extension dev:firefox-android

# Push the Firefox for Android extension to a connected Android device
./scripts/push-firefox-android
```

If you have problems building try deleting `node_modules` and re-running `yarn`.

## Localization

Any new localization keys should first be added to the English loc files, and then copied across all the other loc files using a helper script.

```bash
cd ./scripts/loc
npm install
node ./merge-loc-from-en.js
```

Translations are later pulled from the [Crowdin project](https://crowdin.com/project/asbplayer).
