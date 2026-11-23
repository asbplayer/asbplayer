---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Server WebSocket {#websocket-server}

asbplayer memanfaatkan koneksi WebSocket dua arah untuk menyediakan antarmuka yang dapat diakses dari luar peramban.

Dalam rancangan ini, asbplayer bertindak sebagai **klien WebSocket** yang mempertahankan koneksi ke **server WebSocket** yang berjalan secara lokal di komputer pengguna. Server tersebut menyediakan antarmuka HTTP untuk mengirim perintah ke asbplayer sebagai klien. Referensi teknis server yang disertakan tersedia [di sini](../reference/external-api.md).

Server ini awalnya dibuat untuk mendukung alur penambangan sekali klik yang memperkaya permintaan `addNote` AnkiConnect dengan media dari asbplayer. Karena itu, salah satu fungsi utamanya juga sebagai **proxy AnkiConnect**.

:::note
Cara yang disarankan untuk menambang sekali klik adalah menggunakan [add-on Anki asbplayer](./one-click-mining.md#install-the-asbplayer-anki-add-on). Proxy AnkiConnect yang dijelaskan di bawah merupakan alternatif.
:::

## Menjalankan server {#run-the-server}

1. Klon <a href={project.urls.repo}>repositori asbplayer</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Jika belum terpasang, pasang [Golang](https://go.dev/dl/).
3. Jalankan server:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Proxy ini sangat ringan, jadi dapat dibiarkan berjalan di latar belakang. Di Windows, [RBTray](https://github.com/benbuck/rbtray) dapat digunakan untuk meminimalkannya ke bilah tugas.

## Menghubungkan asbplayer ke server {#connect-asbplayer-to-the-server}

Konfigurasikan dan aktifkan klien WebSocket asbplayer dari <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>pengaturan lain-lain</a>. Secara bawaan, asbplayer sudah diarahkan ke alamat IP dan port bawaan server WebSocket. Biasanya, Anda hanya perlu mengaktifkan klien WebSocket.

## Penambangan sekali klik dengan proxy AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Ikuti petunjuk di [situs web Yomitan](https://yomitan.wiki/) untuk memasang Yomitan dan mengonfigurasikannya dengan kamus untuk bahasa sasaran Anda.

Lalu konfigurasikan Yomitan:

- URL AnkiConnect harus mengarah ke proxy AnkiConnect, bukan AnkiConnect secara langsung. URL proxy bawaan adalah <code>{webSocketHttpUrl}</code>.
- Yomitan harus menggunakan **Note type** yang sama dengan asbplayer.

Menambang kalimat menggunakan Yomitan akan membuat kartu yang sudah berisi definisi kata, gambar, dan audio. Penambangan sekali klik sepenuhnya dapat dilakukan jika `POST_MINE_ACTION` proxy diatur ke `2` (perbarui kartu terakhir). Lihat [konfigurasi server](#server-configuration) untuk detailnya.

Agar selalu menggunakan teks takarir asbplayer untuk kolom Sentence, aktifkan [**Selalu gunakan teks takarir untuk kolom kalimat**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) di pengaturan **Penambangan**. Teks kalimat dari Yomitan akan diganti dengan teks takarir yang ditambang dari semua trek.

## Referensi API {#api-reference}

Lihat [referensi teknis](../reference/external-api.md#commands) untuk deskripsi perintah yang didukung dan dapat dikirim ke asbplayer melalui koneksi WebSocket.

## API berbasis HTTP {#http-based-api}

Server WebSocket menyediakan API berbasis HTTP yang menjalankan perintah-perintah yang didokumentasikan di atas.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## Proxy AnkiConnect {#ankiconnect-proxy}

Server WebSocket juga berfungsi sebagai proxy AnkiConnect yang memungkinkan permintaan `addNote` diperkaya dengan konteks dari asbplayer, seperti audio dan tangkapan layar.

Proxy meneruskan semua permintaan AnkiConnect apa adanya, kecuali `addNote`. Perilaku khusus proxy untuk `addNote` bergantung pada nilai `POST_MINE_ACTION` dalam konfigurasi yang dijelaskan di bawah.

## Konfigurasi server {#server-configuration}

Server dikonfigurasikan melalui berkas `.env` di direktori yang sama. Berikut contoh berkas beserta keterangannya.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
