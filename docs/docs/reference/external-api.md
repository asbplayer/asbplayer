---
sidebar_position: 2
description: Technical reference for asbplayer’s external interface and the WebSocket server that implements it.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# External API {#external-api}

This page is intended to be an technical reference on asbplayer's external interface. Below are ways to call the interface:

- The <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>pre-packaged WebSocket server</a>. See the [guide](../guides/web-socket-server) for how to setup the WebSocket server.
- (v1.23 and above) Using an extension-to-extension connection obtained from [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). See the [guide](../guides/external-extensions) for how to connect to asbplayer from another extension.

## Commands {#commands}

asbplayer responds to the following commands.

## `mine-subtitle` {#mine-subtitle}

Mines from the active tab by default. Set `mediaId` to an ID returned by [`get-bound-media`](#get-bound-media) to target specific media. If the media is not found or has no subtitles, `published` is `false`.

When `postMineAction` is `2`, `noteId` selects the Anki note to update. If omitted, the last-added note is updated. `noteId` applies to streaming media only and is ignored for local media.

> `mediaId` and `noteId` require extension v1.20.0 or later.

### Request {#mine-subtitle-request}

    ```javascript
    {
        "command": "mine-subtitle",
        // Message ID to correlate with asbplayer's response
        "messageId": "10281760-d787-4356-8572-f698d8ff3884",
        "body": {
            // 0 = "None", 1 = "Show anki dialog", 2 = "Update last card", 3 = "Export card"
            "postMineAction": 1,
            // Key-value pairs corresponding to an Anki note type
            "fields": {
                "key1": "value1",
                "key2": "value2"
            },
            // Optional media id from `get-bound-media`
            "mediaId": "a1b2c3d4e5f6",
            // Optional Anki note id to update when postMineAction is 2 (streaming media only)
            "noteId": 1752856898044
        }
    }
    ```

### Response {#mine-subtitle-response}

    ```javascript
    {
        "command": "response",
        // Same message ID received in request
        "messageId": "10281760-d787-4356-8572-f698d8ff3884",
        "body": {
            // Whether the command was successfully published to an asbplayer client
            "published": true
        }
    }
    ```

## `load-subtitles` {#load-subtitles}

Loads the files into the active tab's media by default, showing the video selector when the tab has more than one video. Set `mediaId` to an ID returned by [`get-bound-media`](#get-bound-media) to load the files directly into that media.

> `mediaId` requires extension v1.23.0 or later. Earlier versions load the files into every tab with a bound video

### Request {#load-subtitles-request}

```javascript
{
    "command": "load-subtitles",
    // Message ID to correlate with asbplayer's response
    "messageId": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "body": {
        "files": [{
            // Name of the file, including its extension
            "name": "some-file.srt",
            // Base64-encoded file contents
            "base64": "Zm9vYmFyY..."
        }],
        // Optional media id from `get-bound-media`
        "mediaId": "a1b2c3d4e5f6"
    }
}
```

### Response {#load-subtitles-response}

```javascript
{
    "command": "response",
    // Same message ID received in request
    "messageId": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "body": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Seeks the active tab's media by default. Set `mediaId` to an ID returned by [`get-bound-media`](#get-bound-media) to target specific media.

> `mediaId` requires extension v1.20.0+. Seeking local media requires extension v1.23.0+

### Request {#seek-timestamp-request}

```javascript
{
    "command": "seek-timestamp",
    // Message ID to correlate with asbplayer's response
    "messageId": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "body": {
        //The timestamp to seek in seconds
        "timestamp": 30.5,
        // Optional media id from `get-bound-media`
        "mediaId": "a1b2c3d4e5f6"
    }
}
```

### Response {#seek-timestamp-response}

```javascript
{
    "command": "response",
    // Same message ID received in request
    "messageId": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "body": {}
}
```

## `get-bound-media` {#get-bound-media}

> Requires extension v1.20.0+

Returns the media asbplayer is currently tracking, including both `streaming` and `local` media.

### Request {#get-bound-media-request}

```javascript
{
    "command": "get-bound-media",
    // Message ID to correlate with asbplayer's response
    "messageId": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "body": {}
}
```

### Response {#get-bound-media-response}

```javascript
{
    "command": "response",
    // Same message ID received in request
    "messageId": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "body": {
        "media": [{
            // Identifier for the media
            "id": "a1b2c3d4e5f6",
            // Type of media: "streaming" or "local"
            "type": "streaming",
            // Display title for the media, if available
            "title": "Title of the Video",
            // Favicon of the tab containing the media, if available
            "faviconUrl": "https://example.com/favicon.ico",
            // Subtitle tracks currently loaded for this media. Empty if none are loaded.
            "loadedSubtitles": [{
                // Track number
                "trackNumber": 0,
                // File name of the subtitle track
                "fileName": "subtitles.srt"
            }],
            // Whether the media's tab is the active tab of its window
            "active": true
        }]
    }
}
```

## `get-subtitles` {#get-subtitles}

> Requires extension v1.20.0+

Returns the subtitles currently loaded for a piece of media. By default it targets the active tab's media; pass a `mediaId` from [`get-bound-media`](#get-bound-media) to target specific media.
Returns an empty list when no matching media is found or no subtitles are loaded.

### Request {#get-subtitles-request}

```javascript
{
    "command": "get-subtitles",
    // Message ID to correlate with asbplayer's response
    "messageId": "2d7e8a1b-9c4f-4e3a-8b6d-1f0c5a2e9d7b",
    "body": {
        // Optional media id from `get-bound-media`. Defaults to the active tab when omitted.
        "mediaId": "a1b2c3d4e5f6",
        // Optional track numbers from `get-bound-media`. Returns all loaded tracks when omitted.
        "trackNumbers": [0]
    }
}
```

### Response {#get-subtitles-response}

```javascript
{
    "command": "response",
    // Same message ID received in request
    "messageId": "2d7e8a1b-9c4f-4e3a-8b6d-1f0c5a2e9d7b",
    "body": {
        // Loaded subtitles. `start`/`end` are in milliseconds; `track` is the loaded track number.
        "subtitles": [
            { "text": "Hello", "start": 1000, "end": 2000, "track": 0 }
        ]
    }
}
