---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Penambangan sekali klik {#one-click-mining}

asbplayer sangat baik dalam menghubungkan konten takarir dan video ke AnkiConnect, tetapi tidak dapat menyediakan definisi kata secara otomatis. Karena itu, sebagian besar alur menambang kalimat memerlukan dua atau tiga kali input mouse atau keyboard dari pengguna.

Penambangan sekali klik dapat dilakukan jika asbplayer digunakan bersama aplikasi lain yang:

- menyediakan informasi definisi kata yang belum ada, dan
- sudah terintegrasi dengan AnkiConnect.

[Yomitan](https://yomitan.wiki/) adalah salah satu contoh aplikasi tersebut.

## Memasang dan mengonfigurasi Yomitan {#install-and-configure-yomitan}

Ikuti petunjuk di [situs web Yomitan](https://yomitan.wiki/) untuk memasang Yomitan dan mengonfigurasikannya dengan kamus untuk bahasa sasaran Anda. Jika belum, tambahkan juga [AnkiConnect](https://ankiweb.net/shared/info/2055492159) ke Anki.

Di pengaturan Anki Yomitan:

- Alamat server AnkiConnect harus berupa alamat bawaan (<code>{ankiConnectUrl}</code>).
- Yomitan harus menggunakan **Note type** yang sama dengan asbplayer.

## Memasang add-on Anki asbplayer {#install-the-asbplayer-anki-add-on}

Add-on ini memerlukan Anki 25.02 atau yang lebih baru. Add-on ini belum tersedia di AnkiWeb, jadi harus dipasang dari berkas:

1. Unduh berkas `.ankiaddon` terbaru dari <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>halaman rilis</a>.
2. Buka berkas tersebut dan tekan **Ya** pada jendela popup.
3. Mulai ulang Anki.

## Menghubungkan asbplayer ke add-on {#connect-asbplayer-to-the-add-on}

Aktifkan klien WebSocket di <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>pengaturan lain-lain</a> ekstensi asbplayer (di dekat bagian bawah). Gunakan URL server WebSocket bawaan (<code>{webSocketUrl}</code>) yang sesuai dengan nilai bawaan add-on.

## Menambang seperti biasa dengan **Yomitan** {#mine-with-yomitan-as-usual}

Menambang kalimat menggunakan Yomitan akan membuat kartu yang sudah berisi definisi kata, gambar, dan audio.

Agar selalu menggunakan teks takarir asbplayer untuk kolom Sentence, aktifkan [**Selalu gunakan teks takarir untuk kolom kalimat**](../reference/settings#always-use-subtitle-text-for-sentence-field) di pengaturan **Penambangan**. Teks kalimat dari Yomitan akan diganti dengan teks takarir yang ditambang dari semua trek.

## Pengaturan add-on

Pengaturan add-on dapat diubah di Anki dengan membuka **Alat > Add-on**, memilih add-on, lalu menekan **Konfigurasi**. `postMineAction` adalah tindakan yang dijalankan asbplayer setelah Yomitan menambahkan kartu (bawaan: <code>{project.services.webSocket.postMineAction}</code>). Atur ke `2` (perbarui kartu terakhir) untuk alur penambangan sekali klik. Jika `port` diubah, URL server WebSocket asbplayer harus disesuaikan.
