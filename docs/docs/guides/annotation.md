---
sidebar_position: 1
---

# Annotation

asbplayer can annotate subtitles to better assist with language learning. Annotation features include:

- word styling (color/underline/outline, etc.) based on a word's status (uncollected/unknown/learning, etc.)
    - known status can be sourced from and synced with Anki, and/or tracked locally in asbplayer (includes import/export features to help seed known words)
- reading annotation (readings displayed above each word or based on status)
- frequency annotation (rank-based frequency displayed below each word or based on status)
- many more features for future releases!

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
    - To populate the database, use [`Re-build Anki word database`](../reference/settings.md#rebuild-anki-word-database) after configuring these fields.
6. Enable your desired annotation features (styling, reading, frequency, etc.) for that track. Customize other settings as desired.
    - If [`Only show annotations on hover`](../reference/settings.md#only-show-annotations-on-hover) is enabled, you will need to hover subtitle text to see annotations.
7. For detailed explanations of each option, see the [Annotation](../reference/settings.md#annotation) section of the settings reference.

## Troubleshooting

### Enable or disable annotation for a track

Annotation is considered disabled if the following settings are set to these values:
- [`Colorize subtitles based on known words`](../reference/settings.md#colorize-subtitles-based-on-known-words): **Off**
- [`Display word readings`](../reference/settings.md#display-word-readings): **Never**
- [`Display readings for ignored words`](../reference/settings.md#display-readings-for-ignored-words): **Off**
- [`Display word frequency`](../reference/settings.md#display-word-frequency): **Never**

To enable annotation for a track, set at least one of the above settings to a value other than the disabled value. Also check whether **Only show annotations on hover** is enabled.

:::tip
The [`Re-build Anki word database`](../reference/settings.md#rebuild-anki-word-database) button will be disabled unless the above settings have specific values that benefit from Anki integration.
:::

### Clear Anki word database

To clear the Anki word database entries for a track, set the [`Anki word fields`](../reference/settings.md#anki-word-fields) and [`Anki sentence fields`](../reference/settings.md#anki-sentence-fields) to empty values and use the [`Re-build Anki word database`](../reference/settings.md#rebuild-anki-word-database) button. If the button is disabled, [follow these steps](#enable-or-disable-annotation-for-a-track) to enable annotation for the track first.

### Delete locally tracked words

You can delete a locally tracked word by hovering over it and using the keyboard shortcut to set its status to [**Uncollected**](../reference/settings.md#keyboard-shortcuts) and toggling [**Ignored**](../reference/settings.md#keyboard-shortcuts) if it was set. You can also use the [`Import Words`](../reference/settings.md#import-words) feature to bulk mark words as **Uncollected** and removing **Ignored**.

There is currently no option to clear all locally tracked words. This will be added in a future release. For now, you can delete all locally tracked words by right-clicking on the extension (or the asbplayer webpage if no extension is installed) and clicking Inspect. Then go to Application > Storage > IndexedDB and delete `DictionaryDatabase` in Chrome (other browsers should have a similar option).

### Everything is uncollected

If you accidentally enabled annotation, [follow these steps](#enable-or-disable-annotation-for-a-track) to disable it.

If word statuses never change from **Uncollected**:
- If you rely on local status, import words into the local word database or use the hover + keyboard shortcuts to set statuses.
- If you rely on Anki for status, make sure Anki is running and your **AnkiConnect URL** is correct.
    - Configure [`Anki word fields`](../reference/settings.md#anki-word-fields) (recommended) and/or [`Anki sentence fields`](../reference/settings.md#anki-sentence-fields).
    - Run [`Re-build Anki word database`](../reference/settings.md#rebuild-anki-word-database).
    - You do not need to keep Anki running after the database is built but keeping Anki open during playback will keep asbplayer in sync.

### Red strikethrough styling appears

If you accidentally enabled annotation, [follow these steps](#enable-or-disable-annotation-for-a-track) to disable it.

This indicates there was an error processing the subtitles, most likely due to an issue connecting to Yomitan. Check the browser console for error messages and seek support in the asbplayer Discord if you can’t resolve the issue.
