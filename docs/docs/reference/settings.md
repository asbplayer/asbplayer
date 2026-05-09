---
sidebar_position: 1
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Settings

## [Anki](https://app.asbplayer.dev/?view=settings#anki-settings)

### AnkiConnect URL

URL to the AnkiConnect server running as on addon inside Anki.

### Deck

Anki deck where cards are sent.

### Note Type

Anki note type to use for cards. A note type defines a "model" and a "view" for the cards. More specifically, a set of card fields, and an HTML template that determines how to render those fields on the card's front and back.

### Card Fields

Each card field setting determines what content gets mapped to which field of the configured note type. The **field label** - Sentence, Definition, Word, Image, Audio, or URL - is the **content** - and the **field value** is the **field inside the note type**.

Fields will appear in the **Anki Export Dialog** in the order that they appear in the settings. The order can be changed using the **⋮ menu** → **Move Down** or **Move Up**.

| Field                 | Content                                            |
| --------------------- | -------------------------------------------------- |
| Sentence (all tracks) | All subtitles at the mined timestamp               |
| Definition            | The user-provided word definition                  |
| Word                  | The user-provided word                             |
| Audio                 | Audio recorded from video source                   |
| Image                 | Screenshot of video source                         |
| Source                | Subtitle file or video name and timestamp          |
| URL                   | Current URL if card was mined from streaming video |
| Subtitle Track 1      | Subtitles from track 1 at the mined timestamp      |
| Subtitle Track 2      | Subtitles from track 2 at the mined timestamp      |
| Subtitle Track 3      | Subtitles from track 3 at the mined timestamp      |
| Custom Fields         | User-provided values                               |

### Tags

Default tags to supply with each card.

## [Mining](https://app.asbplayer.dev/?view=settings#mining-settings)

### Mining button default action

"Mining button" <NoteAddIcon/> refers to the leftmost button that appears in the **Overlay UI**, and the button that appears next to subtitles in the **Subtitle List**. This setting configures what those buttons do.

| Setting          | Behavior                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Show Anki dialog | Record target subtitle in mining history and show **Anki Export Dialog**                                                                                                                               |
| Update last card | Record target subtitle in mining history and update the last card in the configured deck with all asbplayer-provided context - all fields except the user-provided definition, word, and custom fields |
| Export card      | Record target subtitle in mining history and export a card _only_ with asbplayer-provided context - all fields except the user-provided definition, word, and custom fields                            |
| None             | Record target subtitle in mining history                                                                                                                                                               |

### Post-mining playback state

Configures the desired playback state after triggering a mining action.

### Play audio while recording from local video

asbplayer uses the browser's built-in [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) API to record audio from local video files. This setting configures whether sound should play during recording.

### Re-encode audio as mp3

Recorded audio is not encoded as an `mp3` by default. This setting will cause audio to be re-encoded as an `mp3`. In general there's no reason to turn this setting off, especially for users who want to review their cards on iOS.

### Copy mined subtitles to clipboard

If enabled, copies the target subtitle to clipboard anytime mining action is triggered.

### Audio padding start

How many milliseconds **before** the target subtitle to start recording audio.

### Audio padding end

How many milliseconds **after** the target subtitle to stop recording audio.

### Max image width/height

Max width/height in pixels of screenshots. `0` means "no limit."

### Surrounding subtitles count radius

At the bottom of **Anki Export Dialog** there's a slider which can be used to adjust the selected time interval. The slider includes surrounding subtitles as additional context. This setting controls limits the number of those surrounding subtitles.

### Surrounding subtitles time radius

At the bottom of **Anki Export Dialog** there's a slider which can be used to adjust the selected time interval. The slider includes surrounding subtitles as additional context. This setting controls the size of the allowed time interval around the target subtitle, for those surrounding subtitles.

## [Subtitle appearance](https://app.asbplayer.dev/?view=settings#subtitle-appearance)

### Subtitle track

asbplayer can load multiple subtitle tracks simultaneously. This dropdown selects the track(s) to which the settings below will apply. The default selection is "All." Modifying any appearance setting with "All" selected, modifies that setting for all tracks simultaneously. When you configure a track-specific value for a setting, that setting disappears from the "All" page.

| Setting                           | Description                                                                          | CSS property          |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| Subtitle color                    | Color                                                                                | `color`               |
| Subtitle size                     | Size in `px`                                                                         | `font-size`           |
| Subtitle outline color/thickness  | Color/thickness of stroke                                                            | `-webkit-text-stroke` |
| Subtitle shadow color/thickness   | Color/thickness of shadow                                                            | `text-shadow`         |
| Subtitle background color/opacity | Background color/opacity                                                             | `background`          |
| Subtitle font family              | Font. A dropdown of available fonts appears when local font access is granted.       | `font-family`         |
| Subtitle blur                     | Applies a blur effect to subtitles. Unblurs on hover.                                | `filter:blur(...)`    |
| CSS:\<style key\>                 | String value of any custom CSS property added using the **Add Custom CSS** dropdown. | Custom property       |
| Subtitle width                    | Width of subtitle container as percentage of video element width.                    | `width`               |

### Subtitle alignment

Whether to place subtitles at the top or bottom of the video element.

### Subtitle position offset from top

Distance from the top of the video element of all **top** subtitle tracks.

### Subtitle position offset from bottom

Distance from the bottom of the video element of all **bottom** subtitle tracks.

### Image-based subtitle scale factor

Scales the size of image-based subtitles. Image-based subtitles are ripped from BluRay discs and come in files with a `.sup` extension.

## [Keyboard shortcuts](https://app.asbplayer.dev/?view=settings#keyboard-shortcuts)

Keyboard shortcuts can be used to access most of asbplayer's features.

| Behavior                                                                             | Website shortcut? | Extension shortcut? |
| ------------------------------------------------------------------------------------ | :---------------: | :-----------------: |
| Mine current subtitle                                                                |         ✓         |          ✓          |
| Mine current subtitle and open Anki dialog                                           |         ✓         |          ✓          |
| Update last-created Anki card with asbplayer-captured screenshot, audio, etc.        |         ✓         |          ✓          |
| Export card to Anki, bypassing dialog.                                               |         ✓         |          ✓          |
| Manually take screenshot, overriding the one that is automatically taken when mining |         ✓         |          ✓          |
| Manually start/stop audio recording, even when a subtitle file is loaded.            |         ✓         |          ✓          |
| Select subtitle tracks to load.                                                      |                   |          ✓          |
| Play/pause                                                                           |         ✓         |          ✓          |
| Toggle auto-pause                                                                    |         ✓         |          ✓          |
| Toggle condensed playback                                                            |         ✓         |          ✓          |
| Toggle fast forward playback                                                         |         ✓         |          ✓          |
| Toggle repeat mode                                                                   |         ✓         |          ✓          |
| Toggle subtitles                                                                     |         ✓         |          ✓          |
| Toggle subtitle track 1 in video                                                     |         ✓         |          ✓          |
| Toggle subtitle track 2 in video                                                     |         ✓         |          ✓          |
| Toggle subtitle track 3 in video                                                     |         ✓         |          ✓          |
| Toggle subtitle track 1 in asbplayer                                                 |         ✓         |          ✓          |
| Toggle subtitle track 2 in asbplayer                                                 |         ✓         |          ✓          |
| Toggle subtitle track 3 in asbplayer                                                 |         ✓         |          ✓          |
| Unblur subtitle track 1 in asbplayer                                                 |         ✓         |          ✓          |
| Unblur subtitle track 2 in asbplayer                                                 |         ✓         |          ✓          |
| Unblur subtitle track 3 in asbplayer                                                 |         ✓         |          ✓          |
| Seek backward 10 seconds                                                             |         ✓         |          ✓          |
| Seek forward 10 seconds                                                              |         ✓         |          ✓          |
| Seek to previous subtitle                                                            |         ✓         |          ✓          |
| Seek to next subtitle                                                                |         ✓         |          ✓          |
| Seek to beginning of current/previous subtitle                                       |         ✓         |          ✓          |
| Adjust subtitle offset so that previous subtitle is at current timestamp             |         ✓         |          ✓          |
| Adjust subtitle offset so that next subtitle is at current timestamp                 |         ✓         |          ✓          |
| Adjust subtitle offset by +100ms                                                     |         ✓         |          ✓          |
| Adjust subtitle offset by -100ms                                                     |         ✓         |          ✓          |
| Reset subtitle offset                                                                |         ✓         |          ✓          |
| Increase playback rate                                                               |         ✓         |          ✓          |
| Decrease playback rate                                                               |         ✓         |          ✓          |
| Toggle side panel                                                                    |         ✓         |          ✓          |
| Mark hovered word as Mature                                                          |         ✓         |          ✓          |
| Mark hovered word as Young                                                           |         ✓         |          ✓          |
| Mark hovered word as Graduated                                                       |         ✓         |          ✓          |
| Mark hovered word as Learning                                                        |         ✓         |          ✓          |
| Mark hovered word as Unknown                                                         |         ✓         |          ✓          |
| Mark hovered word as Uncollected                                                     |         ✓         |          ✓          |
| Toggle hovered word as ignored                                                       |         ✓         |          ✓          |
| Open statistics                                                                      |         ✓         |          ✓          |

### Extension shortcuts

Some shortcut behaviors require privileged browser extension APIs, requiring the extension to implement the shortcut as a browser command rather than using vanilla key event listeners. Furthermore, when the browser extension is installed, settings are shared between the extension and the website, and so even on the website, some keyboard shortcuts are marked as "extension shortcuts." These shortcuts can only be edited in the browser's extension shortcuts editor.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Manage Extension Shortcuts`

## [Annotation](https://app.asbplayer.dev/?view=settings#annotation)

### Word Browser

:::info
Only local words can be edited/deleted, Anki-synced words are read-only and can only update through [syncing with Anki](#re-build-anki-word-database) and its [respective settings](#anki-decks-optional).
:::

Opens the Word Browser, where you can view and manage all words in your local word database and Anki-synced word database.

:::tip
You can lookup words in any script of the language (e.g romaji/hiragana/katakana/kanji for Japanese).

There are also some other common QOL substitutions, such as `e -> é` or `ss -> ß` done automatically.
:::

### Import Words

Imports words into asbplayer's **local word database**.

Imported words take priority over the Anki word database when determining word status.

The import dialog supports pasting arbitrary text (asbplayer will tokenize it) and importing previously-exported files.

:::tip
You can hover over words and use [keyboard shortcuts](#keyboard-shortcuts) to change their status locally.
:::

### Export Words

Exports your local word database so it can be backed up, moved to another device, or shared between the website and extension.

### Re-Build Anki word database

Builds (or rebuilds) the local cache of word-status information sourced from Anki.

:::tip
The cache is also updated automatically during playback when a track is enabled and Anki is connectable.

This button is disabled unless your annotation settings [benefit from Anki integration](../guides/annotation.md#enable-or-disable-annotation-for-a-track).

To clear the Anki word database entries for a track, [follow these steps](../guides/annotation.md#clear-anki-word-database).
:::

### Subtitle track

Selects which subtitle track these annotation settings apply to.

### Colorize subtitles based on known words

Enables word-status styling (uncollected/unknown/learning/etc.). Styling uses the configured **Word color style** and **status colors**.

### Generate statistics automatically

Automatically generate statistics for the current media upon load. This will also enable the statistics overlay.

### Display word readings

Shows readings (e.g. furigana) above words.

- **Always**: show readings for all eligible words.
- **Learning or below**: show readings only for words at **Learning**, **Unknown**, or **Uncollected** status.
- **Unknown or below**: show readings only for **Unknown** or **Uncollected** words.
- **Never**: disable readings.

### Display readings for ignored words

If enabled, readings will always be shown for words you marked as **ignored**.

:::tip
Typically ignoring is used for proper nouns such as names and places or words that you don't want to measure your knowledge against.
:::

### Display word frequency

Shows a rank-based frequency value below words (when available). This is useful for prioritizing which words are worth spending time learning.

- **Always**: show frequency for all eligible words.
- **Uncollected only**: only show frequency for **Uncollected** words.
- **Never**: disable frequency.

:::tip
Frequency information requires at least one rank-based frequency dictionary to be available in your Yomitan instance.

If multiple frequency numbers are available for a word, the lowest (most frequent) number is used.
:::

### Only show annotations on hover

If enabled, annotations are hidden by default and only appear when you hover over the subtitle text.

### Highlight words on hover

If enabled, hovering a word will highlight it which helps you understand how yomitan has tokenized it.

:::tip
This highlight reflects the focus asbplayer has to register keyboard shortcuts. If the highlight does not appear, you may need to click on the player to focus it. Note that the keyboard shortcuts only work for either the video or the subtitle list (but not both at the same time) depending on where the focus is.
:::

### Word field search strategy

Controls how asbplayer matches a subtitle word against local words and Anki cards found in your configured **Anki word fields**.

- **Exact form collected**: the field must contain the exact surface form from the subtitle (running -> running).
- **Lemma form collected**: the field must contain the lemma/base form (running -> run).
- **Lemma or exact form collected**: treat the word as collected if either lemma or exact form matches (any of the above).
- **Any form collected**: treat the word as collected if any related form matches (running -> run, ran, runs, etc.).

### Card choice priority

If multiple Anki cards match a word, this controls which card is used to determine the word's status:

- **Field contains exact form** (fallback to best known card if multiple)
- **Field contains lemma** (fallback to best known card if multiple)
- **Best known card**
- **Least known card**

### Sentence field search strategy

Controls how asbplayer searches your configured **Anki sentence fields**, it has the same options as **Word field search strategy**.

:::tip
Since sentences will contain multiple words thus diluting the relevance of the card state to any individual word, it's best to keep this as **Exact form collected** unless you only have sentence cards.
:::

### Yomitan API URL

The URL for the Yomitan API endpoint. If the URL is unreachable or invalid, asbplayer will show an error.

:::tip
You will need a configured [Yomitan](https://yomitan.wiki/) instance and the [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Yomitan parser

Selects which Yomitan parser to use for tokenizing subtitle text:

- **Scanning Parser (All languages)**: Yomitan's internal parser that matches the longest words from your dictionaries.
- **MeCab (Japanese)**: Uses MeCab to parse Japanese text. Requires Yomitan to be configured with MeCab support, preferably with at least one UniDic dictionary.

### Max word length

:::info
This setting only applies to the Scanning Parser.
:::

Limits the maximum word length that asbplayer will try to scan/tokenize for annotation.

:::tip
Setting this too low will miss longer words, setting it too high may cause performance issues.
:::

### Anki decks (optional)

Restricts Anki searches to the selected decks. If left empty, asbplayer searches across all decks.

### Anki word fields

Anki note fields that contain *only* the target word. This is the recommended way to source known-status information from Anki.

### Anki sentence fields

Anki note fields that contain a sentence (commonly used for sentence decks). This will be used as a fallback if there are no cards with the target word in **Anki word fields**.

### Mature Anki stability/interval (days)

Controls the cutoff (in days) for treating an Anki card as **Mature** versus lower maturity statuses.

- **Uncollected**: not found in Anki or local word database.
- **Unknown**: found in Anki with `is:new`.
- **Learning**: found in Anki with `is:learn`.
- **Graduated**: found in Anki with `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Young**: found in Anki with `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Mature**: found in Anki with `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
If a card has its FSRS stability available (last review of the card was with FSRS enabled), it will be used instead of the interval.
:::

### Treat suspended Anki cards as

Controls how **suspended** cards are treated when building word status from Anki:

- **Normal**: use Anki status as-is.
- Or choose a specific word status (e.g. **Mature**, **Unknown**, etc.) to force suspended cards to be treated as that status.

:::tip
If only some of the cards for a word are suspended, the suspended cards will be filtered out and the word status will be based on the unsuspended cards.
:::

### Word color style

Controls how status colors are applied to words for **Colorize subtitles based on known words**:

- **Text**: color of the word is changed.
- **Background**: color behind the word is changed.
- **Underline**: underline the word with the status color.
- **Overline**: overline the word with the status color.
- **Outline**: outline the word with the status color.

:::tip
When using **Outline**, you may need to set [**Subtitle outline thickness**](#subtitle-track) to `0` for the best results.
:::

### Thickness

Controls the thickness (in pixels) of **Underline**, **Overline**, and **Outline** styling.

### Word status colors

Each status has a configurable color used by **Word color style** (see [**Mature Anki stability/interval (days)**](#mature-anki-stabilityinterval-days) for how Anki card statuses are determined):

- **Uncollected**: Word is not present in your local word database and not found in your Anki word database.
- **Unknown**: Word is present but considered unknown.
- **Learning**: Word is currently learning.
- **Graduated**: Word has graduated from learning.
- **Young**: Word is known, but not yet mature.
- **Mature**: Word is fully known (mature).

:::tip
You can disable status stylings per your liking, e.g. disabling **Mature** to reduce clutter.

You can reuse colors (e.g. **Graduated** and **Young**) if you don't want to differentiate between certain statuses.
:::

## [Streaming video](https://app.asbplayer.dev/?view=settings#streaming-video) (extension only)

Streaming video settings are available only when the browser extension is installed.

### When loading subtitles, also open subtitle list via the app in a separate tab

Anytime subtitles are loaded into a video element, opens the website, and syncs the loaded subtitles with the website in a separate tab.

### Enable controls overlay

Display the overlay UI on video elements with loaded subtitles.

### Display subtitles

Display loaded subtitles on video elements.

### Record audio when mining

When mining a subtitle, record the audio covered by the subtitle for inclusion in the flashcard.

### Take screenshot when mining

When mining a subtitle, take a screenshot for inclusion in the flashcrd.

### Clean screenshot when mining

When mining a subtitle and screenshots are enabled, keep the screenshot "clean" by removing any HTML elements on top of the video element before taking the screenshot.

### Screenshot capture delay

How long to wait after the target subtitle appears before taking the screenshot.

### Allow subtitle file drag-and-drop

Allow subtitle files to be drag-and-dropped into video elements.

### Auto-load detected subtitles

If subtitle auto-detection is supported on the current website, load them automatically. If multiple tracks are detected, load the track for the preferred language. The preferred language is the one that was last loaded with the "remember these track choices" box checked.

### Condensed playback minimum skip interval

When condensed playback is enabled, skip to the next subtitle only if the next subtitle is at least this amount of time away.

### App URL

Determines where the extension fetches some configuration, and what URL to open when syncing subtitles to the website running in a separate tab. Essentially the website URL.

## [Misc](https://app.asbplayer.dev/?view=settings#misc-settings)

### Theme

Display all asbplayer in a light or dark theme.

### Remember subtitle offset

When enabled, timing offset is "sticky." Subtitles are loaded with the last-used offset.

### Auto-copy current subtitle to clipboard

Automatically copies subtitle to clipboard when it appears on screen. Useful for sending subtitles to apps that can monitor the clipboard.

### Always play after invoking 'Seek to beginning of current/previous subtitle'

Instead of retaining the current playback state, always play when using the keyboard shortcut that seeks to the beginning of the current/previous subtitle. Saves a keypress.

### Mining history storage limit

Limits the number of cards that can be saved in the mining history.

### Subtitle regex filter

Substrings matched by this regex will be replaced by the value of [Subtitle regex filter text replacement](#subtitle-regex-filter-text-replacement)

### Subtitle regex filter text replacement

Substrings matched by the regex above are replaced with the value of this setting. If left empty, matched substrings are simply removed.

### Subtitle HTML

How to handle HTML that appears in subtitle files.

### Language

Language to display UI in.

Note: not all strings have been localized in every language that asbplayer supports. Unlocalized will be displayed in English. Feel free to help out with localization at the [Crowdin project](https://crowdin.com/project/asbplayer).

### Auto-pause preference

When auto-pause is enabled, whether to auto-pause at the start or end of subtitles.

### Auto-pause when mousing over subtitles

Auto-pause behavior when mousing over subtitles. "Enabled with auto-resume" means that playback will automatically resume when mousing off of subtitles.

### Playback speed adjust step

Time increment to use when using the "increase/decrease playback rate" keyboard shortcuts.

### Fast-forward mode playback rate

How fast to fast-forward when fast-forward mode is enabled.

### Enable WebSocket client

Enables the WebSocket client. Allows asbplayer to be controlled using the WebSocket interface.

### WebSocket Server URL

The URL of the WebSocket server to connect to when enabling the WebSocket client. Usually this would be a locally-running instance of the [pre-packaged WebSocket server](../guides/web-socket-server).

### Import/export settings

Imports or exports settings as a `json` file. Settings files exported from older versions of asbplayer are not guaranteed to be importable into newer versions of asbplayer.

## Profiles

A settings profile is a completely different set of settings values. The active settings profile can be changed from the settings UI or from the **Load Subtitles** and **Anki Export** dialogs.
