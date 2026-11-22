---
sidebar_position: 9.5
---

import project from '@site/src/project';

# Ekstensi eksternal {#external-extensions}

Mulai v1.23, asbplayer menyediakan cara bagi ekstensi peramban lain untuk berkomunikasi dengannya. Ekstensi apa pun yang terhubung ke asbplayer melalui [browser.runtime.connect](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-connect) dan mendapat persetujuan pengguna dapat menjalankan [perintah](../reference/external-api.md) melalui koneksi tersebut.

Contoh implementasi ekstensi yang terintegrasi dengan asbplayer dengan cara ini tersedia <a href={`${project.urls.externalExtensionTemplateRepo}`}>di sini</a>.

## Menghubungkan dan meminta persetujuan pengguna

Ekstensi yang ingin berkomunikasi dengan asbplayer harus terlebih dahulu terhubung menggunakan kode seperti berikut. ID ekstensi asbplayer dapat ditemukan di pengelola ekstensi peramban (di Chrome, buka `chrome://extensions`; di Firefox, buka `about:addons`).

```typescript
const port = browser.runtime.connect(<asbplayer extension ID>, {
    name: 'asbplayer-external-v1', // Must match this string exactly
});
```

Minta persetujuan dengan `initialize`, yang langsung mengembalikan status saat ini.

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'initialize',
    params: {
        name: 'external-extension-name', // Self-reported name
        version: '1.2.3', // Self-reported version
    },
});
```

Jika ekstensi belum disetujui, asbplayer menandai koneksi sebagai tertunda, meminta persetujuan pengguna, lalu merespons:

```json
{
    "jsonrpc": "2.0",
    "id": "<the id from the initialize request>",
    "result": { "state": "pending" }
}
```

Periksa `approval-state` untuk mengetahui apakah pengguna telah menyetujui permintaan koneksi.

```json
{
    "jsonrpc": "2.0",
    "id": "<request id>",
    "method": "approval-state",
    "params": {}
}
```

Setelah disetujui, `approval-state` mengembalikan `{ "state": "approved" }` dan koneksi dapat menjalankan perintah. Jika ditolak, `approval-state` mengembalikan `{ "state": "denied" }` satu kali, lalu asbplayer menutup port. Setelah permintaan ditolak, ekstensi tidak dapat meminta persetujuan lagi selama 24 jam.

Perintah dapat dijalankan seperti yang [didokumentasikan](../reference/external-api.md). Contoh:

```typescript
port.postMessage({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'get-bound-media',
    params: {},
});
```

Jika berhasil, asbplayer merespons dengan `{ jsonrpc, id, result }`; jika gagal, responsnya `{ jsonrpc, id, error }`.
