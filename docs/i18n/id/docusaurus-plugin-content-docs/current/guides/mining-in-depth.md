---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Menambang lebih lanjut {#mining-in-depth}

Anda dapat menambang kalimat dengan berbagai cara menggunakan asbplayer, sesuai kebutuhan dan preferensi.

## Membuka Dialog Ekspor Anki {#opening-the-anki-export-dialog}

Ada beberapa cara untuk membuka **Dialog Ekspor Anki**:

1. Tombol **Tambang Takarir** <NoteAddIcon /> di **Daftar Takarir** pada **Panel Samping** atau situs web.
2. Tombol **Tambang Takarir** <NoteAddIcon /> di **Antarmuka Overlay** pada video streaming atau situs web seluler.
3. Pintasan keyboard [Menambang](../reference/settings.md#mining-keyboard-shortcuts) **tambang takarir saat ini dan buka dialog Anki** — bawaan `Ctrl + Shift + X`.
4. Klik kanan → asbplayer → **Tambang Takarir** pada video streaming.

:::info
Cara #1 dan #2 hanya membuka dialog jika [tindakan bawaan tombol tambang](../reference/settings#mining-button-default-action) diatur ke "Tampilkan dialog Anki."  
:::

:::info
Saat trek takarir _kosong_ dimuat dan perekaman audio diaktifkan, semua tindakan di atas akan mulai merekam audio saat pertama kali digunakan dan membuka dialog Anki saat digunakan untuk kedua kalinya.
:::

## Menyesuaikan kartu {#adjusting-cards}

Kartu dapat disesuaikan dari dialog sebelum diekspor.

### Rentang waktu terpilih {#selected-time-range}

**Penggeser** di bagian bawah dialog dapat digunakan untuk mengubah rentang waktu yang dipilih.

- **Kolom kalimat** akan otomatis diperbarui agar sesuai dengan rentang waktu yang dipilih, jika belum diedit secara manual.
- Untuk berkas lokal, klip audio juga akan diperbarui secara otomatis.
- Untuk video streaming, klip audio dapat direkam ulang sesuai rentang waktu yang dipilih.

### Kolom audio {#audio-field}

**Kolom audio** menampilkan klip audio rekaman dan menyediakan tiga tombol tindakan:

- **Putar/Jeda** — pratinjau klip audio langsung di dalam dialog.
- **Rekam ulang** — rekam ulang audio menggunakan rentang waktu yang dipilih (hanya untuk video streaming; ditampilkan jika callback rekam ulang tersedia).
- **Unduh** — unduh klip audio sebagai berkas ke perangkat Anda.

### Kolom teks {#text-fields}

Semua kolom teks—kalimat, definisi, kata, kolom khusus, sumber, URL, dan tag—dapat diedit. Biasanya, aplikasi kamus terpisah digunakan untuk mengisi kolom definisi.

### Kolom gambar {#image-field}

Untuk berkas lokal, klik **Tombol Pratinjau** <ImageIcon /> di **Kolom gambar** untuk mengubah penanda waktu video yang digunakan untuk mengambil tangkapan layar.

## Mengekspor kartu {#exporting-cards}

Gunakan tombol di bagian bawah dialog untuk mengekspor kartu. Ada tiga jenis ekspor:

1. **Ekspor**: hanya mengekspor kartu dengan isi dialog.
2. **Perbarui kartu terakhir**: memperbarui kartu terakhir di deck Anki dengan isi dialog.
3. **Buka di Anki**: membuka pembuat kartu Anki dengan isi dialog yang sudah diisikan.

## Alur menambang tanpa dialog {#dialog-less-mining-flows}

Alur menambang tanpa dialog, yang menyertakan definisi kata dan melewati dialog Anki sepenuhnya, dapat dilakukan jika asbplayer digunakan bersama aplikasi kamus yang juga terintegrasi dengan Anki. Saat ini, aplikasi kamus paling populer yang menyediakan fitur ini adalah [Yomitan](https://yomitan.wiki/).

### Perbarui kartu terakhir {#update-last-card}

Berikut contoh alur menambang tanpa dialog menggunakan Yomitan:

1. Gunakan Yomitan untuk menyorot kata dalam takarir yang ingin ditambang.
2. Gunakan tombol pembuatan kartu Yomitan untuk membuat kartu.
3. Segera gunakan pintasan keyboard [Menambang](../reference/settings.md#mining-keyboard-shortcuts) asbplayer **perbarui kartu terakhir** — `Ctrl + Shift + U` — untuk memperbarui kartu dengan konten dari asbplayer.

Kekurangan alur ini adalah Anda melewatkan kesempatan untuk mengubah kartu karena dialog dilewati. Namun, ada beberapa cara untuk mengatasinya:

- Daripada langsung memperbarui kartu terakhir pada langkah akhir, gunakan `Ctrl + Shift + X` untuk membuka dialog, menyesuaikan kartu, lalu memilih **perbarui kartu terakhir** di antarmuka dialog. Dengan cara ini dialog tetap digunakan, tetapi definisi kata yang disediakan otomatis oleh Yomitan tetap tersedia.
- **Dialog Ekspor Anki** dapat dibuka _setelah_ kartu dibuat menggunakan pintasan keyboard [Menambang](../reference/settings.md#mining-keyboard-shortcuts) **ambil tangkapan layar secara manual** — bawaan `Ctrl + Shift + V`.

### Sekali klik {#one-click}

Lihat panduan [penambangan sekali klik](./one-click-mining.md).
