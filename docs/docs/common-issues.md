---
sidebar_position: 5
---

# Common issues

## asbplayer can't connect to Anki. It shows an error message e.g. 'Failed to fetch.'

This can happen due to ad blockers:

- If you're using Brave, make sure asbplayer isn't being blocked by Shield.
- Check that your browser or an ad blocker isn't blocking the request. A good place to start is by opening your browser's developer console and looking for errors.

Misconfiguration:

- If using the website, make sure that asbplayer is allowed by AnkiConnect, as described [here](./getting-started/mining-subtitles).

Or bugs:

- As of this writing enabling experimental web platform features is known to cause this issue. Try disabling this flag from `chrome://flags`.
- On later versions of macOS, AnkiConnect will not respond when Anki is backgrounded. See "Notes for MacOS Users" on the [AnkiConnect developer's website](https://foosoft.net/projects/anki-connect/).

### When using the 'update last card' feature, the card does not update in Anki.

Make sure Anki's card browser is closed when using "update last card." There is a [known issue](https://github.com/FooSoft/anki-connect/issues/82) with AnkiConnect where cards will not appear to update when the card browser is open.

### When loading a local file asbplayer either shows a black screen, or doesn't play audio.

Browsers have varying ability to decode certain video and audio formats. See the [compatibility section](./compatibility).

### My popup dictionary extension (e.g. Yomitan) doesn't work on the side panel

For security reasons, browsers do not allow extension scripts to be injected into other extension pages, so there is no fix for this. If you want to scan text with other extensions then you will need to do it from the subtitles displayed inside the video element, or from the subtitle list on the asbplayer website.

### asbplayer isn't detecting streaming video.

Make sure that in the extension details, the extension has access to all sites.

### Keyboard shortcuts aren't working.

Check the [keyboard shortcut settings](https://app.asbplayer.dev/?view=settings#keyboard-shortcuts).

Also, if using the extension:

- Check `chrome://extensions/shortcuts`.
- Try refreshing the page and loading subtitles again.
- Try uninstalling and reinstalling the extension, and restarting Chrome.
- Make sure the extension isn't installed twice.

### asbplayer isn't properly cropping screenshots from streaming video.

Make sure the browser zoom setting is at 100%. Cropping can be disabled altogether from the [extension settings](https://app.asbplayer.dev/?view=settings#misc-settings).

### I'm having trouble creating cards using JP mining note.

See this [issue](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer keeps asking for permission to record audio

asbplayer is not currently compatible with the Volume Master extension. So you'll need to disable it.

### Audio recordings are garbled, scratchy, or spotty

This is usually due to insufficient CPU. If you are on a laptop, make sure it's connected to a power source. In general make sure your CPU is not being throttled by battery-saving mode, etc.

### When I use a keyboard shortcut to open asbplayer for streaming video, nothing happens and the page becomes unresponsive.

This can happen because `Experimental Web Platform features` is enabled in `chrome://flags`. Make sure it's disabled and try again.
