---
sidebar_position: 2
description: Tekninen viite asbplayerin ulkoiseen käyttöliittymään ja sitä toteuttavaan WebSocket-palvelimeen.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Ulkoinen API {#external-api}

Tämä sivu on asbplayerin ulkoisen käyttöliittymän tekninen viite. Käyttöliittymää voi kutsua seuraavilla tavoilla:

- <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>valmiiksi pakattu WebSocket-palvelin</a>. Katso [oppaasta](../guides/web-socket-server.md), miten WebSocket-palvelin määritetään.
- (v1.23 ja uudemmat) Laajennusten välinen yhteys, joka saadaan [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect)-kutsulla. Katso [oppaasta](../guides/external-extensions.md), miten asbplayeriin yhdistetään toisesta laajennuksesta.

## Komennot {#commands}

asbplayer vastaa seuraaviin JSON-RPC-viesteinä esitettyihin komentoihin. OpenRPC-skeema löytyy [täältä](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
asbplayerin laajennusversiot 1.22 ja sitä vanhemmat tukevat skeemaa `{ command, messageId, body }` skeeman `{ method, id, params }` sijaan.
:::

## `mine-subtitle` {#mine-subtitle}

Oletuksena kortti louhitaan aktiivisesta välilehdestä. Kohdista toiminto tiettyyn mediaan asettamalla `mediaId` arvoksi tunnus, jonka [`get-bound-media`](#get-bound-media) palauttaa. Jos mediaa ei löydy tai siinä ei ole tekstityksiä, `published` on `false`.

Kun `postMineAction` on `2`, `noteId` määrittää päivitettävän Anki-muistiinpanon. Jos arvoa ei anneta, päivitetään viimeksi lisätty muistiinpano. `noteId` koskee vain suoratoistomediaa, ja paikallisessa mediassa se ohitetaan.

> `mediaId` ja `noteId` vaativat laajennuksen version 1.20.0 tai uudemman.

### Pyyntö {#mine-subtitle-request}

    ```javascript
    {
        "jsonrpc": "2.0",
        "id": "10281760-d787-4356-8572-f698d8ff3884",
        "method": "mine-subtitle",
        "params": {
            // 0 = "None", 1 = "Show Anki dialog", 2 = "Update last card", 3 = "Export card", 4 = "Show update card dialog"
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

### Vastaus {#mine-subtitle-response}

    ```javascript
    {
        "jsonrpc": "2.0",
        // Same id received in request
        "id": "10281760-d787-4356-8572-f698d8ff3884",
        "result": {
            // Whether the command was successfully published to an asbplayer client
            "published": true
        }
    }
    ```

## `load-subtitles` {#load-subtitles}

Oletuksena tiedostot ladataan aktiivisen välilehden mediaan. Jos välilehdellä on useita videoita, näytetään videon valitsin. Lataa tiedostot suoraan tiettyyn mediaan asettamalla `mediaId` arvoksi tunnus, jonka [`get-bound-media`](#get-bound-media) palauttaa.

> `mediaId` vaatii laajennuksen version 1.23.0 tai uudemman. Aiemmat versiot lataavat tiedostot jokaiseen välilehteen, johon on yhdistetty video.

### Pyyntö {#load-subtitles-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "method": "load-subtitles",
    "params": {
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

### Vastaus {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Oletuksena komento siirtää aktiivisen välilehden median toistokohtaa. Kohdista toiminto tiettyyn mediaan asettamalla `mediaId` arvoksi tunnus, jonka [`get-bound-media`](#get-bound-media) palauttaa.

> `mediaId` vaatii laajennuksen version 1.20.0 tai uudemman. Paikallisessa mediassa siirtyminen vaatii laajennuksen version 1.23.0 tai uudemman.

### Pyyntö {#seek-timestamp-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "method": "seek-timestamp",
    "params": {
        //The timestamp to seek in seconds
        "timestamp": 30.5,
        // Optional media id from `get-bound-media`
        "mediaId": "a1b2c3d4e5f6"
    }
}
```

### Vastaus {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Vaatii laajennuksen version 1.20.0 tai uudemman.

Palauttaa median, jota asbplayer parhaillaan seuraa, mukaan lukien sekä `streaming`- että `local`-median.

### Pyyntö {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Vastaus {#get-bound-media-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "result": {
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

> Vaatii laajennuksen version 1.20.0 tai uudemman.

Palauttaa mediaan parhaillaan ladatut tekstitykset. Oletuksena kohteena on aktiivisen välilehden media; kohdista tiettyyn mediaan välittämällä sen `mediaId`, jonka saat komennosta [`get-bound-media`](#get-bound-media).
Palauttaa tyhjän luettelon, jos vastaavaa mediaa ei löydy tai tekstityksiä ei ole ladattu.

### Pyyntö {#get-subtitles-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "2d7e8a1b-9c4f-4e3a-8b6d-1f0c5a2e9d7b",
    "method": "get-subtitles",
    "params": {
        // Optional media id from `get-bound-media`. Defaults to the active tab when omitted.
        "mediaId": "a1b2c3d4e5f6",
        // Optional track numbers from `get-bound-media`. Returns all loaded tracks when omitted.
        "trackNumbers": [0]
    }
}
```

### Vastaus {#get-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "2d7e8a1b-9c4f-4e3a-8b6d-1f0c5a2e9d7b",
    "result": {
        // Loaded subtitles. `start`/`end` are in milliseconds; `track` is the loaded track number.
        "subtitles": [
            { "text": "Hello", "start": 1000, "end": 2000, "track": 0 }
        ]
    }
}
```

## `client-info` {#client-info}

Palauttaa asbplayer-asiakkaan tiedot, kuten tuetut protokollat. asbplayerin uusimmat versiot tukevat JSON-RPC:tä.

### Pyyntö {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Vastaus {#client-info-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "result": {
        "protocols": ["jsonrpc-2.0"]
    }
}
```

## `rpc.discover` {#rpc-discover}

Palauttaa käytössä olevan koontiversion OpenRPC-dokumentin. Käytä sitä nykyisten metodien nimien, parametrien, tulosten ja siirtotunnisteiden selvittämiseen niiden kovakoodauksen sijaan.

### Pyyntö {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Vastaus {#rpc-discover-response}

Palauttaa tuettuja JSON-RPC-metodeja kuvaavan OpenRPC-dokumentin. Katso koko dokumentti tiedostosta [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

## Virhekoodit {#error-codes}

Virheissä käytetään JSON-RPC:n vakiomuotoista virheobjektia:

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request, or null when the request id is unusable
    "id": "10281760-d787-4356-8572-f698d8ff3884",
    "error": {
        "code": -32602,
        "message": "Invalid params",
        // Optional additional details
        "data": []
    }
}
```

| Koodi    | Merkitys         | Huomautukset                                                    |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Jäsennysvirhe     | Kehys ei ole kelvollista JSON-muotoa.                           |
| `-32600` | Virheellinen pyyntö | Kehys ei ole kelvollinen JSON-RPC-pyyntö.                    |
| `-32601` | Metodia ei löydy | Tuntematon metodi tai metodia ei ole saatavilla kyseisellä siirtotavalla. |
| `-32602` | Virheelliset parametrit | Metodin parametrit eivät läpäisseet skeeman validointia. |
| `-32603` | Sisäinen virhe   | Käsittelijä epäonnistui tai palautti tuloksen, joka ei läpäissyt validointia. |
| `-32000` | Pyynnön aikakatkaisu | Palvelin ei saanut vastausta asbplayerilta ajoissa.          |
| `-32001` | Ei asiakkaita    | Palvelimeen ei ole yhdistetty asbplayeria, jolle pyyntö voitaisiin välittää. |
| `-32002` | Ei hyväksytty    | Ulkoinen laajennus lähetti komennon ennen hyväksyntää.          |

Ilmoituksiin ei koskaan vastata, vaikka niiden käsittely epäonnistuisi. Pyyntö, jonka `id` ei ole käyttökelpoinen, saa virhevastauksen, jossa `id: null`.

Go-palvelimen HTTP-silta muuntaa nämä virheet HTTP-tilakoodeiksi. Katso [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
