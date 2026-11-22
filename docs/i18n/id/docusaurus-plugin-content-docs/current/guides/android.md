---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

Meski pengalaman pengguna kurang optimal, asbplayer tetap dapat digunakan di perangkat Android.

## Situs web {#website}

Situs web dapat digunakan langsung. **Antarmuka Overlay** akan ditampilkan sebagai pengganti kontrol video bawaan yang dioptimalkan untuk desktop.

### Tambahkan ke layar utama {#add-to-home-screen}

Sebagai aplikasi web progresif, situs web dapat ditambahkan ke layar utama perangkat Android Anda. Buka menu peramban, lalu ketuk "Tambahkan ke layar utama".

## Ekstensi {#extension}

:::warning
**Banyak fitur yang tidak tersedia**: **panel samping**, **tangkapan layar**, dan **antarmuka WebSocket**. Lihat bagian [kompatibilitas](../compatibility.md#browsers-and-features) untuk tabel fitur yang didukung dan tidak didukung di setiap peramban.
:::

Seperti pada situs web, cara utama menggunakan ekstensi asbplayer adalah melalui **Antarmuka Overlay**. Panel samping tidak tersedia, jadi **takarir dimuat dengan memilih tombol asbplayer dari menu ekstensi peramban**. Anda tidak harus menggunakan papan ketik (Bluetooth), tetapi papan ketik dapat berguna jika ingin memakai [pintasan keyboard](../reference/settings.md#keyboard-shortcuts) dengan ekstensi.

Berikut peramban Android yang dapat memasang asbplayer.

### Firefox untuk Android {#firefox-for-android}

Pasang asbplayer dari <a href={project.extension.firefoxAndroid.storeUrl}>halaman AMO</a>. Firefox untuk Android memiliki keterbatasan yang sama dengan Firefox: audio dari streaming yang dilindungi DRM tidak dapat direkam.

### Edge Canary {#edge-canary}

Edge Canary adalah peramban seluler berbasis Chromium lain yang dapat menjalankan ekstensi. Saat ini, asbplayer di Edge Canary belum mendukung perekaman audio.
Untuk memasang asbplayer di Edge Canary:

1. Unduh berkas `crx` asbplayer dari <a href={`${project.urls.repo}/releases/latest`}>halaman rilis</a>.
2. Jika belum, aktifkan mode pengembang dari pengaturan Edge Canary dengan membuka "Tentang Microsoft Edge" dan mengetuk string versi build beberapa kali.
3. Dari **Opsi Pengembang**, ketuk **Pemasangan ekstensi lewat crx**, lalu pilih berkas `crx` yang baru diunduh.

### Kiwi Browser (dihentikan) {#kiwi-browser-discontinued}

Kiwi Browser adalah peramban seluler berbasis Chromium yang dapat menjalankan ekstensi. Namun, pengembangannya telah dihentikan dan satu-satunya cara memasangnya adalah dari [halaman GitHub](https://github.com/kiwibrowser/src.next/releases). Setelah Kiwi Browser dipasang, asbplayer dapat dipasang dari <a href={project.extension.chrome.storeUrl}>web store Chrome</a>.

## Integrasi Anki {#anki-integration}

Pasang [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid) untuk mengintegrasikan Anki.
