---
sidebar_position: 11
---

# Online subtitles {#online-subtitles}

Instead of hunting for subtitle files by hand, you can search for them and load them straight from asbplayer. Subtitles are provided by [Jimaku](https://jimaku.cc), a community subtitle site mostly covering anime and Japanese drama.

## Usage {#usage}

1. Open the side panel on a page with a video, then click **Load Subtitles**.
2. Click **Search online subtitles** (also available from the subtitle track dropdown).
3. The search term is pre-filled from the page title. Adjust it if needed, pick **Anime** or **Drama**, and search.
4. Click a search result to see its subtitle files, then click a file to load it.

Only `.srt` and `.ass` files are listed. Works you opened recently show up under **Recent** so you can skip the search next time.

## Getting a Jimaku API key {#api-key}

Jimaku requires an API key to search and download.

1. Create an account at [jimaku.cc](https://jimaku.cc) and log in.
2. Open your [account page](https://jimaku.cc/account) and generate an API key.
3. Paste the key into the **Jimaku API key** field in the search dialog.

The key is saved automatically, so you only need to do this once. It is hidden by default; use the eye icon to show it.

## Automatic episode detection {#episode-detection}

For series, asbplayer tries to read the episode number from the page title (for example `S01E05`, `EP05`, or `第5話`/`第五集`). If one is found:

- the episode marker is removed from the search term, so you search for the series name only;
- the file list is filtered to that episode, shown as an **EP N** chip. Click the chip's ✕ to see all files.

If the chosen episode has no usable subtitle files, the full list is shown instead.

### Custom episode regex {#episode-regex}

Some websites use title formats that the built-in rules don't recognize, so no episode is detected and you see every file in the series. A custom regex teaches asbplayer how to read the episode on those sites.

Once you've opened a series, click the gear icon next to the file list header to show the **Custom episode regex** field. The gear is highlighted while a regex is set.

- **Capture group 1** must be the episode number (arabic or kanji numerals both work).
- Your regex is tried first. If it is empty, invalid, or doesn't match, the built-in rules are used as usual, so it can only add coverage.
- Press **Enter** to re-filter the current series. The search term picks up the change the next time you open the dialog.

:::tip
The built-in rules were only tested on the few websites the feature's author uses. If a site's title format isn't recognized, please [open an issue](https://github.com/asbplayer/asbplayer/issues) with an example page title (or a PR on `common/subtitle-sources/jimaku-episode-patterns.ts`) so the built-in rules can be extended.
:::

For example, if a site titles its pages `Some Show - Chapter 07 | SiteName`, use:

```
Chapter (\d+)
```

## Acknowledgements {#jimaku-acknowledgements}

Huge thanks to [Rapptz](https://github.com/Rapptz), who built and maintains [Jimaku](https://github.com/Rapptz/jimaku) and provides the API that makes this feature possible. If you find it useful, please consider supporting the site and uploading your own subtitles.
