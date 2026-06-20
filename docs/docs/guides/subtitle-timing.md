---
sidebar_position: 2
---

# Subtitle timing

Subtitle files will very often not be aligned to the video source you load them into. To work around this, asbplayer provides ways to adjust subtitle timing.

## Keyboard shortcuts

The fastest way to fix subtitle timing is with the [keyboard shortcuts](https://app.asbplayer.dev/?view=settings#keyboard-shortcuts). There are two sets of shortcuts for adjusting subtitle offset:

- `Ctrl + Left/Right` or `Shift + Left/Right`: Align the current timestamp to the left or right subtitle.
- `Ctrl + Shift + Left/Right`: Move the current timestamp `100ms` to the left or right.

Most often, finding the correct offset will look like this:

1. Wait for a character to start talking.
2. `Ctrl + Left/Right` until the subtitle matching the character's dialog appears on screen.
3. `Ctrl + Shift + Right/Left` until the subtitle timing precisely matches the dialog.

## Overlay UI

The overlay UI provides buttons that perform the same functions as the keyboard shortcuts above.

1. Scroll the rightmost section to the **middle** control.
2. Click the left or right button to align the left or right subtitle to the current timestamp.
3. Click and **hold** the left or right button to move the current timestamp `100ms` to the left or right.

## Sync to a reference

If you have another subtitle that is already correctly timed, asbplayer can detect the offset for you instead of adjusting it by hand. The reference can be an uploaded subtitle file or another subtitle track you already loaded. Only timing is compared, so the reference does not need to be in the same language.

1. Click the **Sync to Reference** button in the player controls, or in the extension side panel.
2. Choose a reference: **Upload a file…**, or select another loaded track.
3. Click **Detect offset**. asbplayer shows the detected offset and a confidence percentage, and warns when the confidence is low.
4. Click **Apply** to shift the subtitle, or **Undo** to revert.
