---
sidebar_position: 1
---

# Annotation

asbplayer can annotate subtitles to better assist with language learning. Annotation features include:

- **Word Styling**: color/underline/outline, etc. based on a word's status
    - known status can be sourced from and synced with Anki, WaniKani, and/or tracked locally in asbplayer (includes import/export features to help seed known words)
- **Reading Annotation**: readings displayed above each word or based on status
- **Frequency Annotation**: rank-based frequency displayed below each word or based on status (requires at least on rank-based frequency dictionary)
- **Pitch Accent Annotation**: accent patterns displayed on furigana or kana words (requires at least one pitch accent dictionary)
- **Many more features for future releases!**

:::info
Annotation requires a configured [Yomitan](https://yomitan.wiki/) instance and the [yomitan-api](https://github.com/yomidevs/yomitan-api).

If you rely on the **local word database**, installing the asbplayer browser extension is recommended so your browser is less likely to delete stored words. If you can’t install the extension, consider periodically exporting your settings and/or local words as a backup.
:::

## Setup

1. Open asbplayer **Settings**.
2. Go to the **Annotation** section.
3. Select the track you want to configure.
4. Configure the **Yomitan URL** for that track.
    - You will need a configured [Yomitan](https://yomitan.wiki/) instance and the [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - If the URL is invalid or unreachable, asbplayer will show an error next to the setting.
    - Frequency information requires at least one rank-based frequency dictionary to be available in your Yomitan instance.
5. (Anki users) Configure which cards to source known status information from
    - [`Anki decks`](../reference/settings.md#anki-decks-optional) should typically be left blank to source from all decks, filtering by the fields is usually sufficient.
    - [`Anki word fields`](../reference/settings.md#anki-word-fields) correspond to the field on the Anki note that contains only the target word.
    - [`Anki sentence fields`](../reference/settings.md#anki-sentence-fields) should only be used for Anki notes that do not have a dedicated word field (such as sentence decks). These words are treated as a fallback if a word isn't present in the Anki word fields.
    - To populate the database, use [`Re-build Anki word database`](../reference/settings.md#re-build-anki-word-database) after configuring these fields.
6. (WaniKani users) Visit [WaniKani > Settings > API Tokens](https://www.wanikani.com/settings/personal_access_tokens) to create a token for asbplayer.
    - In the `Token Description` field enter `asbplayer`, leave all `Permissions` unchecked, asbplayer only needs read access to your WaniKani account.
    - Click `Generate token` and copy the generated token into [`WaniKani API token`](../reference/settings.md#wanikani-api-token).
    - To populate the database, use [`Re-build WaniKani word database`](../reference/settings.md#re-build-wanikani-word-database) after configuring the API token.
7. Enable your desired annotation features (styling, reading, frequency, pitch accent, etc.) for that track. Customize other settings as desired.
8. For detailed explanations of each option, see the [Annotation](../reference/settings.md#annotation) section of the settings reference.

## Troubleshooting

Please refer to the [common issues](../common-issues.md#annotation) section of the docs for troubleshooting annotation issues. If you can't find a solution there, please reach out on [Discord](https://discord.gg/ad7VAQru7m) or submit a [bug report](https://github.com/asbplayer/asbplayer/issues) with detailed information about your issue and steps to reproduce it.
