---
sidebar_position: 3
---

# Subtitle text filtering {#subtitle-text-filtering}

If you'd like to filter out specific instances subtitle text, one way to do so is by using a regular expression (regex). asbplayer can match any sequence following a specified regex pattern and remove the matches.

## Configure the regex filter {#configure-the-regex-filter}

Under the [misc](https://app.asbplayer.dev/?view=settings#misc-settings) section in asbplayer settings, locate the "Subtitle regex filter" textbox. Enter an appropriate regex to filter desired content.
You can replace filtered content similarly by entering a string into the "Subtitle regex filter text replacement" textbox. Leaving this blank will simply remove the content.

### Useful examples of regular expressions {#useful-examples-of-regular-expressions}

#### `([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])` {#remove-speaker-names}

Remove names enclosed by parenthesis to indicate speakers (e.g. "**（山田）**　元気ですか？")

#### `(.*)\n+(?!-)(.*)` {#merge-subtitle-lines}

Some subtitles are split in several lines and this regex forces them into a single line. For this filter to work, you must also put `$1 $2` in the "Subtitle regex filter text replacement" field.

**NB**: When using this regex pattern in combination with other patterns (using the `|` operator, see below), place this pattern at the end. This ensures that all other regex transformations are applied first, and then the results are finally combined into a single line.

#### `-?\[.*\]` {#remove-bracketed-descriptions}

Remove indications enclosed by square brackets that sound or music that is playing (e.g. "**\[PLAYFUL MUSIC]**" or "**\-[GASPS]**")

#### `^[\-\(\)\.\s\p{Lu}]+$` {#remove-uppercase-descriptions}

As an alternative to the above, filter out descriptions written in capital letters, but without the square brackets (e.g. "**PLAYFUL MUSIC**"). If your language has additional letters with diacritics, you feel free to add them to this list.

#### `[♪♬#～〜]+` {#remove-music-symbols}

Any combination of symbols on their own that represent playing music (e.g. `♪♬♪`)

### Combining regexes {#combining-regexes}

Regular expressions can be combined with the character `|` (no spaces needed inbetween). E.g., if you want to use the two regexes from the list above, you can use `-?\[.*\]|[♪♬#～〜]+`. You can combine as many regexes as you wish this way.

## Learn {#learn}

Learn how to write and test custom regular expressions at [Regex Learn - Playground](https://regexlearn.com/playground).
