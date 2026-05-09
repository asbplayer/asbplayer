---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Mining in-depth

Sentence mining can be accomplished in a variety of ways, according to your needs and preferences, using asbplayer.

## Opening the Anki Export Dialog

There are multiple ways to open the **Anki Export Dialog**:

1. **Mine Subtitle** <NoteAddIcon /> button that can be found in the **Subtitle List** of the **Side Panel** or on the website.
2. **Mine Subtitle** <NoteAddIcon /> button in the **Overlay UI** on streaming videos or on the mobile website.
3. The **mine current subtitle and open Anki dialog** keyboard shortcut - `Ctrl + Shift + X` by default.
4. Right-click → asbplayer → **Mine Subtitle** on streaming video.

:::info
Methods #1 and #2 will open the dialog only if the [mining button default action](../reference/settings#mining-button-default-action) is set to "Show Anki dialog."  
:::

:::info
When an _empty_ subtitle track is loaded, and audio recording is enabled, all of the above actions will start recording audio the first time they are triggered, and open the Anki dialog the second time they are triggered.
:::

## Adjusting cards

Prior to being exported, cards can be adjusted from the dialog.

### Selected time range

A **slider** at the bottom of the dialog can be used to change the selected time range.

- The **Sentence Field** will be automatically updated to match the selected time range, if it has not been manually edited already.
- For local files, the audio clip will also be automatically updated.
- For streaming video, the audio clip can be re-recorded with the selected time range.

### Text fields

Any of the text fields - sentence, definition, word, custom fields, source, URL, tags - can be edited. Typically, a separate dictionary app is used to fill out the definition field.

### Image field

For local files, clicking the **Preview Button** <ImageIcon /> on the **Image Field** can be used to change the video timestamp from which the screenshot is extracted.

## Exporting cards

Use the buttons at the bottom of the dialog to finally export the card. There are three types of export:

1. **Export**: simply export a card with the dialog content.
2. **Update last card**: update the last card in your Anki deck with the dialog content.
3. **Open in Anki**: opens Anki's card creator prefilled with the dialog content.

## Dialog-less mining flows

Dialog-less mining flows that both include a word definition and skip the Anki dialog entirely can be achieved when asbplayer is used in combination with a dictionary app that also integrates with Anki. Currently, the most popular dictionary app that does this is [Yomitan](https://yomitan.wiki/).

### Update last card

A dialog-less mining flow with Yomitan looks like this:

1. Using Yomitan, highlight the word inside the subtitles that you would like to mine.
2. Use Yomitan's card-creation button to create a card.
3. Immediately use asbplayer's **update last card** keyboard shortcut - `Ctrl + Shift + U` - to update the card with asbplayer-supplied content.

The disadvantage of this flow is that skipping the dialog means skipping the opportunity to modify the card. However, there are ways to work around this:

- Instead of directly updating the last card at the final step, you can always use `Ctrl + Shift + X` instead to open the dialog, adjust the card, and finally **update last card** using the dialog GUI. With this method you still go through the dialog, but retain the benefit of Yomitan's automatically-supplied word definition.
- The **Anki Export Dialog** can always be opened _after_ card creation with the **manually take screenshot** keyboard shortcut - `Ctrl + Shift + V` by default.

### One click

See the [one-click mining](./one-click-mining.md) guide.
