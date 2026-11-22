---
sidebar_position: 2
description: Referensi teknis antarmuka eksternal asbplayer dan server WebSocket yang mengimplementasikannya.
---

import project, { ankiConnectUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# API eksternal {#external-api}

Halaman ini merupakan referensi teknis untuk antarmuka eksternal asbplayer. Berikut cara memanggil antarmuka tersebut:

- <a href={`${project.urls.repo}/tree/main/scripts/web-socket-server`}>Server WebSocket yang disertakan</a>. Lihat [panduan](../guides/web-socket-server.md) untuk menyiapkan server WebSocket.
- (v1.23 dan yang lebih baru) Menggunakan koneksi antar-ekstensi yang diperoleh dari [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect). Lihat [panduan](../guides/external-extensions.md) untuk menghubungkan ekstensi lain ke asbplayer.

## Perintah {#commands}

asbplayer merespons perintah berikut, yang direpresentasikan sebagai pesan JSON-RPC. Skema OpenRPC tersedia [di sini](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json).

:::info
Ekstensi asbplayer v1.22 dan sebelumnya mendukung skema `{ command, messageId, body }`, bukan `{ method, id, params }`.
:::

## `mine-subtitle` {#mine-subtitle}

Secara bawaan, menambang dari tab aktif. Atur `mediaId` ke ID yang dikembalikan oleh [`get-bound-media`](#get-bound-media) untuk memilih media tertentu. Jika media tidak ditemukan atau tidak memiliki takarir, `published` bernilai `false`.

Jika `postMineAction` bernilai `2`, `noteId` memilih catatan Anki yang akan diperbarui. Jika tidak disertakan, catatan yang terakhir ditambahkan akan diperbarui. `noteId` hanya berlaku untuk media streaming dan diabaikan untuk media lokal.

> `mediaId` dan `noteId` memerlukan ekstensi v1.20.0 atau yang lebih baru.

### Permintaan {#mine-subtitle-request}

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

### Respons {#mine-subtitle-response}

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

Secara bawaan, memuat berkas ke media di tab aktif dan menampilkan pemilih video jika tab memiliki lebih dari satu video. Atur `mediaId` ke ID yang dikembalikan oleh [`get-bound-media`](#get-bound-media) untuk memuat berkas langsung ke media tersebut.

> `mediaId` memerlukan ekstensi v1.23.0 atau yang lebih baru. Versi sebelumnya memuat berkas ke setiap tab yang memiliki video terikat.

### Permintaan {#load-subtitles-request}

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

### Respons {#load-subtitles-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "3565510c-342f-4cec-ad2e-dee81af88d75",
    "result": {}
}
```

## `seek-timestamp` {#seek-timestamp}

Secara bawaan, melompat ke posisi waktu pada media di tab aktif. Atur `mediaId` ke ID yang dikembalikan oleh [`get-bound-media`](#get-bound-media) untuk memilih media tertentu.

> `mediaId` memerlukan ekstensi v1.20.0 atau yang lebih baru. Melompat pada media lokal memerlukan ekstensi v1.23.0 atau yang lebih baru.

### Permintaan {#seek-timestamp-request}

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

### Respons {#seek-timestamp-response}

```javascript
{
    "jsonrpc": "2.0",
    // Same id received in request
    "id": "6e4b2d8f-3a1c-4d9e-8f7b-2c0a9d5e1f3b",
    "result": {}
}
```

## `get-bound-media` {#get-bound-media}

> Memerlukan ekstensi v1.20.0 atau yang lebih baru.

Mengembalikan media yang sedang dilacak asbplayer, termasuk media `streaming` dan `local`.

### Permintaan {#get-bound-media-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "9f1c2b3a-4d5e-6f70-8190-a1b2c3d4e5f6",
    "method": "get-bound-media",
    "params": {}
}
```

### Respons {#get-bound-media-response}

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

> Requires extension v1.20.0+

Mengembalikan takarir yang sedang dimuat untuk suatu media. Secara bawaan, perintah ini memilih media di tab aktif; berikan `mediaId` dari [`get-bound-media`](#get-bound-media) untuk memilih media tertentu.
Mengembalikan daftar kosong jika media yang cocok tidak ditemukan atau tidak ada takarir yang dimuat.

### Permintaan {#get-subtitles-request}

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

### Respons {#get-subtitles-response}

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

Mengembalikan informasi klien asbplayer, seperti protokol yang didukung. Versi asbplayer terbaru mendukung JSON-RPC.

### Permintaan {#client-info-request}

```javascript
{
    "jsonrpc": "2.0",
    // Request id used to correlate the probe response
    "id": "e3b0c442-98fc-4c14-9b2c-1c5a2e9d7b6f",
    "method": "client-info",
    "params": {}
}
```

### Respons {#client-info-response}

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

Mengembalikan dokumen OpenRPC untuk build yang sedang berjalan. Gunakan dokumen ini untuk mengetahui nama metode, parameter, hasil, dan tag transport saat ini alih-alih menuliskannya secara tetap.

### Permintaan {#rpc-discover-request}

```javascript
{
    "jsonrpc": "2.0",
    "id": "5f2b9c4d-7e1a-4b8f-9d3c-6a0e2f7b1c84",
    "method": "rpc.discover",
    "params": {}
}
```

### Respons {#rpc-discover-response}

Mengembalikan dokumen OpenRPC yang menjelaskan metode JSON-RPC yang didukung. Lihat [`external-api/openrpc.json`](https://github.com/asbplayer/asbplayer/blob/main/external-api/openrpc.json) untuk dokumen lengkapnya.

## Kode kesalahan {#error-codes}

Kesalahan menggunakan objek kesalahan JSON-RPC standar:

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

| Kode     | Arti             | Catatan                                                         |
| -------- | ---------------- | --------------------------------------------------------------- |
| `-32700` | Kesalahan parse  | Frame bukan JSON yang valid.                                     |
| `-32600` | Permintaan tidak valid | Frame bukan permintaan JSON-RPC yang valid.                |
| `-32601` | Metode tidak ditemukan | Metode tidak dikenal atau tidak tersedia pada transport tersebut. |
| `-32602` | Parameter tidak valid | Parameter metode gagal divalidasi terhadap skema.          |
| `-32603` | Kesalahan internal | Penangan gagal atau mengembalikan hasil yang gagal divalidasi. |
| `-32000` | Waktu permintaan habis | Server tidak menerima respons dari asbplayer tepat waktu. |
| `-32001` | Tidak ada klien | Tidak ada asbplayer yang terhubung untuk menerima penerusan permintaan dari server. |
| `-32002` | Belum disetujui | Ekstensi eksternal mengirim perintah sebelum disetujui.       |

Notifikasi tidak pernah dijawab, termasuk saat penanganannya gagal. Permintaan dengan `id` yang tidak dapat digunakan menerima respons kesalahan dengan `id: null`.

Bridge HTTP pada server Go memetakan kesalahan ini ke status HTTP; lihat [`external-api/README.md`](https://github.com/asbplayer/asbplayer/blob/main/external-api/README.md#error-codes).
