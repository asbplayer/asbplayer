---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Pengaturan {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### URL AnkiConnect {#ankiconnect-url}

URL server AnkiConnect yang berjalan sebagai add-on di dalam Anki.

### Kunci API AnkiConnect {#ankiconnect-api-key}

Kunci API yang dikonfigurasikan di AnkiConnect jika perlindungan kunci API diaktifkan.

### Segarkan Penjelajah Kartu Anki setelah memperbarui kartu {#refresh-anki-card-browser}

Jika diaktifkan, Penjelajah Kartu Anki yang terbuka akan disegarkan setelah asbplayer memperbarui kartu agar kolomnya menampilkan nilai terkini. Jendela Penjelajah Kartu mungkin akan muncul di depan. Pengaturan ini nonaktif secara bawaan.

### Deck {#deck}

Deck Anki tujuan pengiriman kartu.

### Jenis catatan {#note-type}

Jenis catatan Anki yang digunakan untuk kartu. Jenis catatan menentukan "model" dan "tampilan" kartu, yaitu kumpulan kolom kartu dan templat HTML yang menentukan cara menampilkan kolom tersebut pada sisi depan dan belakang kartu.

### Kolom kartu {#card-fields}

Setiap pengaturan kolom kartu menentukan konten yang dipetakan ke kolom jenis catatan yang dikonfigurasikan. **Label kolom**—Sentence, Definition, Word, Image, Audio, atau URL—adalah **kontennya**, sedangkan **nilai kolom** adalah **kolom di dalam jenis catatan**.

Kolom akan muncul di **Dialog Ekspor Anki** mengikuti urutannya dalam pengaturan. Urutan dapat diubah melalui **menu ⋮** → **Pindahkan ke bawah** atau **Pindahkan ke atas**.

| Kolom                 | Konten                                            |
| --------------------- | -------------------------------------------------- |
| Kalimat (semua trek) | Semua takarir pada waktu yang ditambang               |
| Definition            | Definisi kata dari pengguna                  |
| Word                  | Kata dari pengguna                             |
| Audio                 | Audio rekaman dari sumber video                   |
| Image                 | Tangkapan layar sumber video                         |
| Source                | Nama berkas takarir atau video dan penanda waktu          |
| URL                   | URL saat ini jika kartu ditambang dari video streaming |
| Subtitle Track 1      | Takarir trek 1 pada waktu yang ditambang      |
| Subtitle Track 2      | Takarir trek 2 pada waktu yang ditambang      |
| Subtitle Track 3      | Takarir trek 3 pada waktu yang ditambang      |
| Kolom khusus         | Nilai dari pengguna                               |

### Tag {#tags}

Tag bawaan yang disertakan pada setiap kartu.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href} >Penambangan</a> {#mining}

### Tindakan bawaan tombol tambang {#mining-button-default-action}

"Tombol tambang" <NoteAddIcon/> merujuk pada tombol paling kiri di **Antarmuka Overlay** dan tombol di samping takarir pada **Daftar Takarir**. Pengaturan ini menentukan tindakan tombol tersebut.

| Pengaturan             | Tindakan                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tampilkan dialog Anki | Simpan takarir sasaran di riwayat penambangan dan tampilkan **Dialog Ekspor Anki**                                                                                                                               |
| Perbarui kartu terakhir | Simpan takarir sasaran di riwayat penambangan dan perbarui kartu terakhir di deck yang dikonfigurasikan dengan semua konteks dari asbplayer—semua kolom kecuali definisi, kata, dan kolom khusus yang diisi pengguna |
| Tampilkan dialog pembaruan kartu | Simpan takarir sasaran di riwayat penambangan dan tampilkan dialog untuk memperbarui kartu terakhir dengan konteks dari asbplayer                                                                                |
| Ekspor kartu | Simpan takarir sasaran di riwayat penambangan dan ekspor kartu _hanya_ dengan konteks dari asbplayer—semua kolom kecuali definisi, kata, dan kolom khusus yang diisi pengguna                            |
| Tidak ada | Simpan takarir sasaran di riwayat penambangan                                                                                                                                                               |

### Status pemutaran setelah menambang {#post-mining-playback-state}

Mengatur status pemutaran yang diinginkan setelah tindakan penambangan dijalankan.

### Salin takarir yang ditambang ke papan klip {#copy-mined-subtitles-to-clipboard}

Jika diaktifkan, takarir sasaran akan disalin ke papan klip setiap kali tindakan penambangan dijalankan.

### Selalu gunakan teks takarir untuk kolom kalimat {#always-use-subtitle-text-for-sentence-field}

Jika diaktifkan, kolom Sentence diisi dengan teks takarir yang ditambang dari semua trek, meskipun aplikasi eksternal menyediakan teks kalimat yang berbeda. Ini berguna saat [menambang dengan Yomitan](../guides/one-click-mining.md).

### Saat memperbarui kartu terakhir, perbarui juga gambar/audio kartu dengan teks takarir yang sama" {#update-all-cards-with-the-same-subtitle-text}

Jika diaktifkan, tindakan penambangan **Perbarui kartu terakhir** juga memperbarui kolom audio dan gambar pada catatan yang dibuat berurutan dari baris takarir yang sama. Setiap catatan sebelumnya tetap menyimpan kalimat, kata, definisi, dan kolom khususnya. Pencocokan mengabaikan markup kalimat dan memungkinkan kalimat menjadi bagian dari konteks takarir yang ditambang.

Pencarian mencakup catatan yang ditambahkan dalam dua hari Anki terakhir dan berhenti saat menemukan kalimat yang berbeda atau tidak ada. Kolom kalimat harus dikonfigurasikan. Pengaturan ini nonaktif secara bawaan dan tidak memengaruhi pembaruan kartu yang dipilih secara khusus.

### Putar audio saat merekam dari video lokal {#play-audio-while-recording-from-local-video}

asbplayer menggunakan API [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) bawaan peramban untuk merekam audio dari berkas video lokal. Pengaturan ini menentukan apakah suara diputar selama perekaman.

### Enkode ulang audio sebagai mp3 {#re-encode-audio-as-mp3}

Secara bawaan, audio rekaman tidak dienkode sebagai `mp3`. Pengaturan ini akan mengenkode ulang audio sebagai `mp3`. Umumnya tidak ada alasan untuk menonaktifkan pengaturan ini, terutama jika Anda ingin meninjau kartu di iOS.

### Jeda awal audio {#audio-padding-start}

Jumlah milidetik **sebelum** takarir sasaran untuk mulai merekam audio.

### Jeda akhir audio {#audio-padding-end}

Jumlah milidetik **setelah** takarir sasaran untuk berhenti merekam audio.

### Format pengambilan gambar (khusus situs web) {#image-capture-format}

Menentukan format gambar untuk kartu hasil penambangan. Hanya tersedia di situs web untuk berkas video lokal; satu-satunya opsi tambahan adalah "klip video".

### Lebar/tinggi maksimum tangkapan {#max-capture-dimensions}

Lebar/tinggi maksimum tangkapan layar dalam piksel. `0` berarti "tanpa batas".

### Pangkas bilah hitam dari tangkapan layar {#trim-black-bars-from-screenshots}

Jika diaktifkan, bilah hitam akibat letterboxing akan dipangkas dari tangkapan layar.

### Pangkas awal/akhir klip {#clip-trim-start-end}

Menentukan durasi yang dipangkas dari awal dan akhir interval takarir saat menentukan interval bawaan klip video. Hanya tersedia jika format pengambilan gambar klip video dipilih.

### Durasi klip maksimum {#max-clip-length}

Menentukan durasi maksimum klip video. Hanya tersedia jika format pengambilan gambar klip video dipilih.

### Jeda pengambilan tangkapan layar {#screenshot-capture-delay}

Lama waktu menunggu setelah takarir sasaran muncul sebelum mengambil tangkapan layar.

### Jumlah takarir sekitar {#surrounding-subtitles-count-radius}

Di bagian bawah **Dialog Ekspor Anki** terdapat penggeser untuk menyesuaikan rentang waktu yang dipilih. Penggeser menyertakan takarir sekitar sebagai konteks tambahan. Pengaturan ini membatasi jumlah takarir tersebut.

### Rentang waktu takarir sekitar {#surrounding-subtitles-time-radius}

At the bottom of **Anki Export Dialog** there's a slider which can be used to adjust the selected time interval. Penggeser menyertakan takarir sekitar sebagai konteks tambahan. Pengaturan ini menentukan rentang waktu yang diizinkan untuk takarir sekitar sasaran.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Tampilan takarir</a> {#subtitle-appearance}

### Trek takarir {#subtitle-appearance-track}

asbplayer dapat memuat beberapa trek takarir sekaligus. Menu tarik-turun ini memilih trek yang akan dikenai pengaturan di bawah. Pilihan bawaan adalah "Semua". Perubahan pada pengaturan tampilan saat "Semua" dipilih berlaku untuk semua trek. Jika Anda mengatur nilai khusus trek, pengaturan tersebut tidak lagi muncul di halaman "Semua".

### Pratinjau takarir {#subtitle-preview}

Pratinjau dan edit teks takarir untuk melihat efek pengaturan tampilannya.

### Gaya {#styling}

| Pengaturan                       | Deskripsi                                                                          | CSS property                |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Warna takarir                    | Color                                                                                | `color`                     |
| Ukuran takarir                     | Ukuran dalam `px`                                                                         | `font-size`                 |
| Ketebalan fon takarir           | Ketebalan fon                                                                       | `font-weight`               |
| Warna kerangka takarir            | Warna garis luar                                                                  | `-webkit-text-stroke-color` |
| Ketebalan kerangka takarir        | Ketebalan of the stroke                                                              | `-webkit-text-stroke-width` |
| Warna bayangan takarir             | Warna bayangan                                                                  | `text-shadow`               |
| Ketebalan bayangan takarir         | Ketebalan of the shadow                                                              | `text-shadow`               |
| Warna latar takarir         | Warna latar                                                                     | `background-color`          |
| Opasitas latar takarir       | Opasitas latar                                                                   | `background`                |
| Keluarga fon takarir              | Font. A dropdown of available fonts appears when local font access is granted.       | `font-family`               |
| CSS:\<style key\>                 | String value of any custom CSS property added using the **Add Custom CSS** dropdown. | Custom property             |
| Buram takarir                     | Memburamkan takarir. Efek buram hilang saat kursor diarahkan.                                | `filter:blur(...)`          |
| Faktor skala takarir berbasis gambar | Menskalakan takarir berbasis gambar.                                                        | —                           |

### Tata letak {#layout}

| Pengaturan                          | Deskripsi                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Perataan takarir                   | Menentukan posisi takarir di bagian atas atau bawah elemen video.        |
| Offset posisi takarir dari bawah | Jarak semua trek takarir bawah dari bagian bawah elemen video. |
| Offset posisi takarir dari atas    | Jarak semua trek takarir atas dari bagian atas elemen video.       |
| Lebar takarir                      | Lebar wadah takarir, dalam `%` atau piksel.                               |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Pintasan keyboard</a> {#keyboard-shortcuts}

Pintasan keyboard dapat digunakan untuk mengakses sebagian besar fitur asbplayer.

### <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Takarir</a> pintasan keyboard {#subtitles-keyboard-shortcuts}

| Tindakan                            | Pintasan bawaan |
| ------------------------------------ | ---------------- |
| Pilih trek takarir yang akan dimuat.      | Ctrl + Shift + F |
| Tampilkan/sembunyikan takarir                     | ↓                |
| Tampilkan/sembunyikan trek takarir 1 di video     | 1                |
| Tampilkan/sembunyikan trek takarir 2 di video     | 2                |
| Tampilkan/sembunyikan trek takarir 3 di video     | 3                |
| Tampilkan/sembunyikan trek takarir 1 di asbplayer | W + 1            |
| Tampilkan/sembunyikan trek takarir 2 di asbplayer | W + 2            |
| Tampilkan/sembunyikan trek takarir 3 di asbplayer | W + 3            |
| Hilangkan buram trek takarir 1 di asbplayer | B + 1            |
| Hilangkan buram trek takarir 2 di asbplayer | B + 2            |
| Hilangkan buram trek takarir 3 di asbplayer | B + 3            |
| Naikkan takarir bawah             |                  |
| Turunkan takarir bawah           |                  |
| Naikkan takarir atas                |                  |
| Turunkan takarir atas              |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href} >Penambangan</a> keyboard shortcuts {#mining-keyboard-shortcuts}

| Tindakan                                                                            | Pintasan bawaan           |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Tambang takarir saat ini                                                                | Ctrl + Shift + Z (website) |
| Tambang takarir saat ini dan buka dialog Anki                                           | Ctrl + Shift + X           |
| Perbarui kartu Anki terakhir dengan tangkapan layar, audio, dan lainnya dari asbplayer        | Ctrl + Shift + U           |
| Ekspor kartu ke Anki tanpa membuka dialog.                                               |                            |
| Ambil tangkapan layar secara manual, menggantikan tangkapan otomatis saat menambang | Ctrl + Shift + V (website) |
| Mulai/hentikan perekaman audio secara manual, meskipun berkas takarir telah dimuat.            | Ctrl + Shift + R (website) |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Pemutaran</a> pintasan keyboard {#playback-keyboard-shortcuts}

| Tindakan                       | Pintasan bawaan |
| ------------------------------- | ---------------- |
| Tampilkan/sembunyikan panel samping               | \`               |
| Putar/jeda                      | Space            |
| Aktifkan/nonaktifkan jeda otomatis               | Shift + P        |
| Aktifkan/nonaktifkan pemutaran ringkas       | Shift + O        |
| Aktifkan/nonaktifkan pemutaran maju cepat    | Shift + F        |
| Aktifkan/nonaktifkan mode pengulangan              | Shift + R        |
| Alihkan waktu penayangan takarir |                  |
| Beralih mode lanjut setelah jeda otomatis    |                  |
| Beralih ke resep berikutnya   |                  |
| Beralih ke resep sebelumnya  |                  |
| Aktifkan/nonaktifkan resep 1                 |                  |
| Aktifkan/nonaktifkan resep 2                 |                  |
| Aktifkan/nonaktifkan resep 3                 |                  |
| Aktifkan/nonaktifkan resep 4                 |                  |
| Aktifkan/nonaktifkan resep 5                 |                  |
| Aktifkan/nonaktifkan resep 6                 |                  |
| Aktifkan/nonaktifkan resep 7                 |                  |
| Aktifkan/nonaktifkan resep 8                 |                  |
| Aktifkan/nonaktifkan resep 9                 |                  |
| Aktifkan/nonaktifkan resep 10                |                  |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Lompat</a> pintasan keyboard {#seek-keyboard-shortcuts}

| Tindakan                                                                 | Pintasan bawaan |
| ------------------------------------------------------------------------- | ---------------- |
| Mundur (bawaan 3 detik, [dapat dikonfigurasikan](#seek-interval-seconds)) | A                |
| Maju (bawaan 3 detik, [dapat dikonfigurasikan](#seek-interval-seconds))  | D                |
| Lompat ke takarir sebelumnya                                                 | ←                |
| Lompat ke takarir berikutnya                                                     | →                |
| Lompat ke awal takarir saat ini/sebelumnya                            | ↑                |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Kecepatan pemutaran</a> pintasan keyboard {#playback-rate-keyboard-shortcuts}

| Tindakan              | Pintasan bawaan |
| ---------------------- | ---------------- |
| Tambah kecepatan pemutaran | Ctrl + Shift + ] |
| Kurangi kecepatan pemutaran | Ctrl + Shift + [ |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Offset takarir</a> pintasan keyboard {#subtitle-offset-keyboard-shortcuts}

| Tindakan                                                                | Pintasan bawaan |
| ------------------------------------------------------------------------ | ---------------- |
| Sesuaikan offset takarir agar takarir sebelumnya berada pada waktu saat ini | Ctrl + ←         |
| Sesuaikan offset takarir agar takarir berikutnya berada pada waktu saat ini     | Ctrl + →         |
| Tambah offset takarir sebesar 100 ms                                         | Ctrl + Shift + ← |
| Kurangi offset takarir sebesar 100 ms                                         | Ctrl + Shift + → |
| Atur ulang offset takarir                                                    | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>Anotasi</a> pintasan keyboard {#annotation-keyboard-shortcuts}

| Tindakan                          | Pintasan bawaan |
| --------------------------------- | ---------------- |
| Buka statistik                   | Q + S            |
| Lompat ke kata berikutnya                 | Q + E            |
| Lompat ke kata sebelumnya             | Q + W            |
| Tandai kata yang diarahkan sebagai Matang       | Q + 5            |
| Lompat ke kata Matang berikutnya          |                  |
| Lompat ke kata Matang sebelumnya      |                  |
| Tandai kata yang diarahkan sebagai Muda        | Q + 4            |
| Lompat ke kata Muda berikutnya           |                  |
| Lompat ke kata Muda sebelumnya       |                  |
| Tandai kata yang diarahkan sebagai Lulus    | Q + 3            |
| Lompat ke kata Lulus berikutnya       |                  |
| Lompat ke kata Lulus sebelumnya   |                  |
| Tandai kata yang diarahkan sebagai Sedang dipelajari     | Q + 2            |
| Lompat ke kata Sedang dipelajari berikutnya        |                  |
| Lompat ke kata Sedang dipelajari sebelumnya    |                  |
| Tandai kata yang diarahkan sebagai Tidak diketahui      | Q + 1            |
| Lompat ke kata Tidak diketahui berikutnya         |                  |
| Lompat ke kata Tidak diketahui sebelumnya     |                  |
| Tandai kata yang diarahkan sebagai Belum dikumpulkan  | Q + 0            |
| Lompat ke kata Belum dikumpulkan berikutnya     |                  |
| Lompat ke kata Belum dikumpulkan sebelumnya |                  |
| Tandai kata yang diarahkan sebagai Diabaikan    | Q + I            |
| Lompat ke kata Diabaikan berikutnya         |                  |
| Lompat ke kata Diabaikan sebelumnya     |                  |

### Interval lompatan (detik) {#seek-interval-seconds}

Mengatur interval yang digunakan oleh [pintasan keyboard lompat](#seek-keyboard-shortcuts).

### Selalu putar setelah memilih 'Lompat ke awal takarir saat ini/sebelumnya' {#always-play-on-subtitle-seek}

Alih-alih mempertahankan status pemutaran saat ini, selalu putar saat menggunakan [pintasan keyboard lompat](#seek-keyboard-shortcuts) untuk melompat ke awal takarir saat ini/sebelumnya. Menghemat satu penekanan tombol.

### Langkah penyesuaian kecepatan pemutaran {#playback-speed-adjust-step}

Nilai kenaikan yang digunakan oleh [pintasan keyboard](#playback-rate-keyboard-shortcuts) "tambah/kurangi kecepatan pemutaran".

### Pintasan ekstensi {#extension-shortcuts}

Jika ekstensi peramban terpasang, beberapa pintasan penambangan (misalnya tambang takarir saat ini, tambang takarir saat ini dan buka dialog Anki) diterapkan sebagai perintah peramban, bukan pendengar peristiwa tombol biasa. Pintasan tersebut hanya dapat diedit di editor pintasan ekstensi peramban.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Kelola Pintasan Ekstensi`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Anotasi</a> {#annotation}

### Penjelajah kata {#word-browser}

:::info
Hanya kata lokal yang dapat diedit atau dihapus; sumber eksternal hanya dapat dibaca dan diperbarui melalui [sinkronisasi](#re-build-anki-word-database).
:::

Opens the Penjelajah kata, where you can view and manage all words in your local word database and Anki-synced word database.

:::tip
Anda dapat mencari kata dalam aksara bahasa apa pun (misalnya romaji/hiragana/katakana/kanji untuk bahasa Jepang).

Beberapa penggantian praktis umum juga dilakukan secara otomatis, seperti `e -> é` atau `ss -> ß`.
:::

### Impor kata {#import-words}

Mengimpor kata ke **basis data kata lokal** asbplayer.

Kata yang diimpor dianggap lokal dan lebih diutamakan daripada sumber eksternal saat menentukan status kata.

Dialog impor mendukung penempelan teks apa pun (asbplayer akan memecahnya menjadi token) dan mengimpor berkas yang sebelumnya diekspor.

:::tip
You can hover over words and use the [Anotasi keyboard shortcuts](#annotation-keyboard-shortcuts) to change their status locally.
:::

### Ekspor kata {#export-words}

Mengekspor basis data kata lokal agar dapat dicadangkan, dipindahkan ke perangkat lain, atau dibagikan antara situs web dan ekstensi.

### Bangun ulang basis data kata Anki {#re-build-anki-word-database}

Membangun atau membangun ulang cache lokal informasi status kata yang bersumber dari Anki.

:::tip
Cache juga diperbarui secara otomatis selama pemutaran jika trek diaktifkan dan Anki dapat dihubungkan.

Tombol ini dinonaktifkan kecuali pengaturan anotasi Anda [memerlukan integrasi Anki](../common-issues.md#enable-or-disable-annotation-for-a-track).

Untuk menghapus entri basis data kata Anki pada sebuah trek, [ikuti langkah-langkah ini](../common-issues.md#clear-anki-word-database).
:::

### Bangun ulang basis data kata WaniKani {#re-build-wanikani-word-database}

Membangun atau membangun ulang cache lokal informasi kosakata yang bersumber dari WaniKani.

:::tip
Cache juga diperbarui secara otomatis selama pemutaran jika trek diaktifkan dan token telah dikonfigurasikan.

Tombol ini dinonaktifkan kecuali pengaturan anotasi Anda [memerlukan integrasi WaniKani](../common-issues.md#enable-or-disable-annotation-for-a-track).

Untuk menghapus entri basis data kata WaniKani pada sebuah trek, [ikuti langkah-langkah ini](../common-issues.md#clear-wanikani-word-database).
:::

### Trek takarir {#annotation-track}

Memilih trek takarir yang dikenai pengaturan anotasi ini.

### Warnai takarir berdasarkan kata yang diketahui {#colorize-subtitles-based-on-known-words}

Enables word-status styling (uncollected/unknown/learning/etc.). Gaya uses the configured [**Gaya warna kata**](#word-color-style) and [**Warna status kata**](#word-status-colors).

### Buat statistik secara otomatis {#generate-statistics-automatically}

Automatically generate statistics for the current media upon load. This will also enable the statistics overlay. The [Buka statistik keyboard shortcut](#annotation-keyboard-shortcuts) is in the Anotasi group.

### Tampilkan bacaan kata {#display-word-readings}

Menampilkan bacaan (misalnya furigana) di atas kata berdasarkan status dan keadaannya.

### Tampilkan frekuensi kata {#display-word-frequency}

Menampilkan nilai frekuensi berbasis peringkat di bawah kata (jika tersedia) berdasarkan status dan keadaannya. Ini berguna untuk menentukan kata mana yang perlu diprioritaskan untuk dipelajari.

:::tip
Informasi frekuensi memerlukan setidaknya satu kamus frekuensi berbasis peringkat di Yomitan. Jika kamus frekuensi tidak menyatakan modenya, asbplayer akan mencoba memperkirakan apakah frekuensinya berbasis peringkat dan menggunakannya jika sesuai.

Jika tersedia beberapa angka frekuensi untuk sebuah kata, angka terkecil (paling sering) yang digunakan.
:::

### Tampilkan aksen nada (bahasa Jepang) {#display-pitch-accent-japanese}

:::note
Too see the pitch accent on furigana, it must be enabled via [**Tampilkan bacaan kata**](#display-word-readings).
:::

Menampilkan aksen nada pada furigana atau kana itu sendiri berdasarkan status dan keadaannya.

:::info
Jika datanya tersedia, aksen nada partikel yang mengikuti kata ditentukan oleh aksen nada kata tersebut.

Biasanya hanya kanji yang diberi bacaan furigana, tetapi jika fitur ini diaktifkan, semua karakter dalam kata akan diberi bacaan furigana jika setidaknya satu karakternya kanji. Ini memudahkan pembacaan aksen nada pada kata majemuk.
:::

### Tampilkan definisi kata {#display-word-definitions}

Mengatur apakah definisi atau penjelasan singkat ditampilkan untuk setiap kata berdasarkan status dan keadaannya.

### Strategi pencarian kolom kata {#word-field-search-strategy}

Mengatur cara asbplayer mencocokkan kata pada takarir dengan kata yang Anda ketahui.

- **Bentuk tepat dikumpulkan**: the field must contain the exact surface form from the subtitle (running -> running).
- **Bentuk lema dikumpulkan**: you must have the lemma/base form collected (running -> run).
- **Bentuk lema atau tepat dikumpulkan**: treat the word as collected if either lemma or exact form matches (any of the above).
- **Bentuk apa pun dikumpulkan**: treat the word as collected if any related form matches (running -> run, ran, runs, etc.).

When **Bentuk lema dikumpulkan**, **Bentuk lema atau tepat dikumpulkan**, or **Bentuk apa pun dikumpulkan** is selected, [**Cocokkan lintas aksara bahasa**](#match-across-language-scripts) controls whether lemma-based matching may cross between different scripts for a language (e.g Kanji, Hiragana, Katakana).

### Prioritas pemilihan kartu {#card-choice-priority}

Jika beberapa kartu Anki cocok dengan kata, opsi ini menentukan kartu yang digunakan untuk menetapkan status kata:

- **Kolom berisi bentuk tepat** (fallback to best known card if multiple)
- **Kolom berisi lema** (fallback to best known card if multiple)
- **Kartu paling dikenal**
- **Kartu paling tidak dikenal**

### Strategi pencarian kolom kalimat {#sentence-field-search-strategy}

Controls how asbplayer searches your configured [**Kolom kalimat Anki**](#anki-sentence-fields), it has the same options as [**Strategi pencarian kolom kata**](#word-field-search-strategy).

When **Bentuk lema dikumpulkan**, **Bentuk lema atau tepat dikumpulkan**, or **Bentuk apa pun dikumpulkan** is selected, [**Cocokkan lintas aksara bahasa**](#match-across-language-scripts) controls whether lemma-based matching may cross between different scripts for a language (e.g Kanji, Hiragana, Katakana).

:::tip
Karena kalimat berisi banyak kata sehingga status kartu kurang relevan untuk setiap kata, sebaiknya gunakan **Bentuk tepat dikumpulkan** kecuali Anda hanya memiliki kartu kalimat.
:::

### Cocokkan lintas aksara bahasa {#match-across-language-scripts}

Mengatur apakah pencocokan berbasis lema dapat dilakukan lintas aksara dalam suatu bahasa (misalnya kanji, hiragana, katakana).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### URL API Yomitan {#yomitan-api-url}

URL endpoint API Yomitan. Jika URL tidak dapat dijangkau atau tidak valid, asbplayer akan menampilkan kesalahan.

:::tip
Anda memerlukan [Yomitan](https://yomitan.wiki/) yang telah dikonfigurasikan dan [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Parser Yomitan {#yomitan-parser}

Selects which Parser Yomitan to use for tokenizing subtitle text:

- **Scanning Parser (All languages)**: Yomitan's internal parser that matches the longest words from your dictionaries.
- **MeCab (Japanese)**: Uses MeCab to parse Japanese text. Requires Yomitan to be configured with MeCab support, preferably with at least one UniDic dictionary.

### Panjang kata maksimum {#max-word-length}

:::info
Pengaturan ini hanya berlaku untuk Scanning Parser.
:::

Membatasi panjang maksimum kata yang akan dipindai atau dipecah menjadi token oleh asbplayer untuk anotasi.

:::tip
Nilai yang terlalu rendah akan melewatkan kata yang lebih panjang; nilai yang terlalu tinggi dapat menurunkan kinerja.
:::

### Deck Anki (opsional) {#anki-decks}

Membatasi pencarian Anki pada deck yang dipilih. Jika dikosongkan, asbplayer mencari di semua deck.

### Kolom kata Anki {#anki-word-fields}

Kolom catatan Anki yang hanya berisi kata sasaran. Ini cara yang disarankan untuk memperoleh informasi status kata dari Anki.

### Kolom kalimat Anki {#anki-sentence-fields}

Anki note fields that contain a sentence (commonly used for sentence decks). This will be used as a fallback if there are no cards with the target word in [**Kolom kata Anki**](#anki-word-fields).

### Stabilitas/interval Anki untuk status Matang (hari) {#mature-anki-stability-interval}

Menentukan batas (dalam hari) untuk menganggap kartu Anki berstatus **Matang** atau berstatus kematangan yang lebih rendah.

- **Uncollected**: not found in Anki.
- **Unknown**: found in Anki with `is:new`.
- **Learning**: found in Anki with `is:learn`.
- **Graduated**: found in Anki with `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Young**: found in Anki with `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Mature**: found in Anki with `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Jika stabilitas FSRS kartu tersedia (kartu terakhir ditinjau saat FSRS aktif), nilai itu akan digunakan sebagai pengganti interval.

For more information on word statuses, see [**Warna status kata**](#word-status-colors).
:::

### Perlakukan kartu Anki yang ditangguhkan sebagai {#treat-suspended-anki-cards-as}

Mengatur cara kartu yang **ditangguhkan** diperlakukan saat membangun status kata dari Anki:

- **Normal**: use Anki status as-is.
- Or choose a specific word status (e.g. **Mature**, **Unknown**, etc.) to force suspended cards to be treated as that status.

:::tip
Jika hanya sebagian kartu untuk suatu kata yang ditangguhkan, kartu tersebut akan disaring dan status kata ditentukan berdasarkan kartu yang tidak ditangguhkan.

For more information on word statuses, see [**Warna status kata**](#word-status-colors).
:::

### Token API WaniKani {#wanikani-api-token}

Use the Token API WaniKani to sync your known words from WaniKani. For setup, follow the instructions in the [annotations guide](../guides/annotation.md#setup).

asbplayer hanya menggunakan jenis subjek `vocabulary` dan `kana_vocabulary` untuk menentukan kata yang diketahui. Status ditentukan berdasarkan tahap SRS dan [sistem pengulangan berjeda](https://docs.api.wanikani.com/20170710/#spaced-repetition-system) yang dikonfigurasikan untuk subjek tersebut. Status WaniKani ditentukan sebagai berikut:

- **Uncollected**: not found in WaniKani.
- **Unknown**: found in WaniKani with an SRS stage below `Starting stage`.
- **Learning**: found in WaniKani with an SRS stage at or above `Starting stage` and below `Passing stage`.
- **Graduated**: found in WaniKani with an SRS stage in the lower half of the stages between `Passing stage` and `Burning stage`.
- **Young**: found in WaniKani with an SRS stage in the upper half of the stages between `Passing stage` and `Burning stage`.
- **Mature**: found in WaniKani with an SRS stage at or above `Burning stage`.

:::tip
For more information on word statuses, see [**Warna status kata**](#word-status-colors).
:::

### Gaya warna kata {#word-color-style}

Controls how status colors are applied to words for [**Warnai takarir berdasarkan kata yang diketahui**](#colorize-subtitles-based-on-known-words):

- **Text**: color of the word is changed.
- **Background**: color behind the word is changed.
- **Underline**: underline the word with the status color.
- **Overline**: overline the word with the status color.
- **Outline**: outline the word with the status color.

:::tip
Saat menggunakan **Kerangka**, Anda mungkin perlu mengatur [**Ketebalan kerangka takarir**](#subtitle-appearance-track) ke `0` agar hasilnya optimal.
:::

### Ketebalan {#thickness}

Mengatur ketebalan (dalam piksel) gaya **Garis bawah**, **Garis atas**, dan **Kerangka**.

### Sorot kata saat kursor diarahkan {#highlight-words-on-hover}

:::info
This highlight reflects the focus asbplayer has to register keyboard shortcuts. If the highlight does not appear, you may need to click on the player to focus it. Pintasan keyboard only work for either the video or the subtitle list (but not both at the same time) depending on where the focus is.

Sorotan ini terutama membantu Anda mengetahui kata mana yang sedang diarahkan kursor untuk dikumpulkan. Karena itu, sasaran kursor harus berupa kata dan pewarnaan harus diaktifkan.
:::

Jika diaktifkan, mengarahkan kursor ke kata akan menyorotnya sehingga Anda dapat melihat cara Yomitan memecahnya menjadi token.

### Tampilkan warna kata hanya saat diarahkan {#only-display-word-color-on-hover}

:::note
This setting only applies if [**Warnai takarir berdasarkan kata yang diketahui**](#colorize-subtitles-based-on-known-words) is enabled.
:::

Jika diaktifkan untuk video atau daftar takarir, warna kata disembunyikan secara bawaan dan hanya muncul saat kursor diarahkan ke teks takarir di video atau daftar takarir.

### Tampilkan bacaan kata hanya saat diarahkan {#only-display-word-reading-on-hover}

:::note
This setting only applies if [**Tampilkan bacaan kata**](#display-word-readings) is enabled.
:::

Jika diaktifkan untuk video atau daftar takarir, bacaan kata disembunyikan secara bawaan dan hanya muncul saat kursor diarahkan ke teks takarir di video atau daftar takarir.

### Tampilkan frekuensi kata hanya saat diarahkan {#only-display-word-frequency-on-hover}

:::note
This setting only applies if [**Tampilkan frekuensi kata**](#display-word-frequency) is enabled.
:::

Jika diaktifkan untuk video atau daftar takarir, frekuensi kata disembunyikan secara bawaan dan hanya muncul saat kursor diarahkan ke teks takarir di video atau daftar takarir.

### Tampilkan definisi kata hanya saat diarahkan {#only-display-word-definitions-on-hover}

:::note
This setting only applies if [**Tampilkan definisi kata**](#display-word-definitions) is enabled.
:::

Jika diaktifkan untuk video atau daftar takarir, definisi kata disembunyikan secara bawaan dan hanya muncul saat kursor diarahkan ke teks takarir di video atau daftar takarir.

### Tampilkan aksen nada hanya saat diarahkan {#only-display-pitch-accent-on-hover}

:::note
This setting only applies if [**Tampilkan aksen nada (bahasa Jepang)**](#display-pitch-accent-japanese) is enabled.
:::

Jika diaktifkan untuk video atau daftar takarir, aksen nada disembunyikan secara bawaan dan hanya muncul saat kursor diarahkan ke teks takarir di video atau daftar takarir.

### Ukuran bacaan kata {#word-reading-size}

Mengatur ukuran bacaan kata (furigana) dalam satuan em (% dari ukuran fon takarir).

### Ukuran frekuensi kata {#word-frequency-size}

Mengatur ukuran frekuensi kata dalam satuan em (% dari ukuran fon takarir).

### Ukuran definisi kata {#word-definition-size}

Mengatur ukuran definisi kata dalam satuan em (% dari ukuran fon takarir).

### Ukuran aksen nada {#pitch-accent-size}

Mengatur ukuran aksen nada dalam satuan em (% dari ukuran fon takarir).

### Warna status kata {#word-status-colors}

Each status has a configurable color and transparency used by [**Gaya warna kata**](#word-color-style) which can be individually enabled or disabled.

- **Uncollected**: Word is not present in your asbplayer database.
- **Unknown**: Word is present but considered unknown.
- **Learning**: Word is currently learning.
- **Graduated**: Word has graduated from learning.
- **Young**: Word is known, but not yet mature.
- **Mature**: Word is fully known (mature).

:::tip
Anda dapat menonaktifkan gaya status sesuai keinginan, misalnya menonaktifkan **Matang** agar tampilan lebih rapi.

Anda dapat menggunakan warna yang sama (misalnya untuk **Lulus** dan **Muda**) jika tidak ingin membedakan status tertentu.

For how Anki Card statuses are determined, see [**Stabilitas/interval Anki untuk status Matang (hari)**](#mature-anki-stability-interval).
For how WaniKani statuses are determined, see [**Token API WaniKani**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Pemutaran</a> {#playback}

### Trek takarirs affected by playback modes and keyboard shortcuts {#playback-subtitle-tracks}

Menentukan trek yang dipertimbangkan saat menggunakan pintasan keyboard [Takarir](#subtitles-keyboard-shortcuts) dan [Lompat](#seek-keyboard-shortcuts), atau mode pemutaran. Misalnya, saat mode ringkas diaktifkan, bagian kosong yang dilewati otomatis adalah bagian linimasa tanpa takarir pada trek yang ditentukan di sini.

### Jeda otomatis saat kursor diarahkan ke takarir {#auto-pause-when-mousing-over-subtitles}

Perilaku jeda otomatis saat kursor diarahkan ke takarir. "Aktif dengan lanjut otomatis" berarti pemutaran akan dilanjutkan otomatis saat kursor menjauh dari takarir.

### Pemutaran modes {#playback-modes}

Pemutaran modes can be toggled with the [Pemutaran keyboard shortcuts](#playback-keyboard-shortcuts).

### Pemutaran rate {#playback-rate}

Mengatur kecepatan pemutaran media normal, termasuk kecepatan di dalam takarir saat mode maju cepat aktif. Pemutaran baru selalu dimulai dengan kecepatan ini. Gunakan [pintasan keyboard kecepatan pemutaran](#playback-rate-keyboard-shortcuts) untuk menyesuaikannya saat menonton.

### Tampilkan notifikasi kecepatan pemutaran {#show-playback-rate-notification}

Menampilkan notifikasi saat kecepatan pemutaran berubah di luar mode maju cepat.

### Preferensi jeda otomatis {#auto-pause-preference}

Saat jeda otomatis aktif, menentukan apakah jeda dilakukan di awal, akhir, atau kedua batas takarir. Jika kedua batas dan pengulangan aktif, jeda dilakukan di akhir sebelum mengulang, sedangkan jeda awal dilewati agar tidak terjadi jeda ganda.

### Preferensi jumlah pengulangan {#repeat-count-preference}

Mengatur berapa kali setiap takarir diulang sebelum pemutaran dilanjutkan. Nilai `0` berarti pengulangan tanpa batas.

### Jumlah pengulangan sebelum takarir ditampilkan {#repeats-before-showing-subtitles}

Sembunyikan takarir pada segmen berulang sampai segmen tersebut diulang sebanyak jumlah ini. `0` tidak menyembunyikan takarir; `1` menampilkannya mulai pengulangan pertama.

### Offset pemicu awal dan akhir takarir {#subtitle-trigger-start-and-end-offsets}

Menggeser pemicu awal dan akhir takarir yang digunakan oleh jeda otomatis dan pengulangan, dalam milidetik. Offset ini diterapkan setelah offset takarir global. Offset awal dan akhir dapat dikonfigurasikan secara terpisah; nilai positif memicu efek pemutaran lebih lambat, sedangkan nilai negatif memicunya lebih cepat. Setiap batas yang digeser dibatasi oleh media dan batas peristiwa takarir di sekitarnya. Jika waktu awal dan akhir yang digeser saling melewati, urutan waktunya ditukar.

### Interval lompatan minimum untuk maju cepat {#fast-forward-minimum-skip-interval}

Majukan video dengan cepat pada seluruh jeda antartakarir jika jeda setidaknya sepanjang nilai ini. Jeda yang lebih pendek tetap menggunakan kecepatan pemutaran normal.

### Kecepatan pemutaran maju cepat {#fast-forward-playback-rate}

Kecepatan maju cepat saat mode maju cepat diaktifkan.

### Interval lompatan minimum untuk pemutaran ringkas {#condensed-playback-minimum-skip-interval}

Saat pemutaran ringkas aktif, lompat ke takarir berikutnya hanya jika jarak waktunya setidaknya sebesar nilai ini.

### Offset pemicu awal dan akhir jeda takarir {#subtitle-gap-trigger-start-and-end-offsets}

Menggeser pemicu jeda takarir yang digunakan oleh mode maju cepat dan ringkas. Offset awal jeda bernilai nonnegatif dan menunda pemicu dari saat takarir berakhir; offset akhir jeda bernilai nonpositif dan memajukan pemicu dari saat sebelum takarir berikutnya. Setiap jeda dibatasi oleh media dan batas peristiwa takarir di sekitarnya.

### Mode melanjutkan setelah jeda otomatis {#auto-pause-resume-mode}

Mengatur cara jeda otomatis berakhir.

- **Manual**: Pemutaran stays paused until you resume it.

- **Fixed**: Every automatic pause lasts for the same configured time.
  - Controls [Durasi jeda tetap](#fixed-pause-duration) and [Jeda sebelum melanjutkan setelah jeda otomatis](#resume-delay-after-auto-pause).

- **Subtitle length**: The pause duration is calculated from the subtitle's character count. Only subtitles on seekable tracks are counted, so a translation track loaded alongside the target language does not inflate the pause.
  - Controls [Durasi jeda minimum](#minimum-pause-duration), [Durasi jeda maksimum](#maximum-pause-duration), [Waktu jeda per karakter](#pause-time-per-character), and [Jeda sebelum melanjutkan setelah jeda otomatis](#resume-delay-after-auto-pause).

### Durasi jeda tetap {#fixed-pause-duration}

Durasi jeda otomatis dalam mode **Tetap**.

### Durasi jeda minimum {#minimum-pause-duration}

Durasi jeda terpendek dalam mode **Panjang takarir**, terlepas dari jumlah karakternya.

### Durasi jeda maksimum {#maximum-pause-duration}

Durasi jeda terpanjang dalam mode **Panjang takarir**. Nilai `0` berarti tanpa batas maksimum. Nilai maksimum selain nol tidak boleh lebih kecil daripada durasi jeda minimum.

### Waktu jeda per karakter {#pause-time-per-character}

Jumlah milidetik untuk setiap karakter dalam mode **Panjang takarir**. Jumlah karakter dikalikan nilai ini, lalu dibatasi antara durasi jeda minimum dan maksimum.

### Jeda sebelum melanjutkan setelah jeda otomatis {#resume-delay-after-auto-pause}

Dalam mode **Tetap** dan **Panjang takarir**, jeda otomatis berlangsung dalam dua tahap: takarir ditampilkan selama durasi jeda yang dikonfigurasikan, lalu disembunyikan sementara pemutaran tetap dijeda selama jeda lanjut. Pengaturan ini menentukan durasi tahap kedua.

### Tampilkan takarir {#show-subtitles}

- **Saat waktunya**: Takarir muncul selama rentang waktunya aktif.

- **Saat dijeda**: Takarir hanya muncul saat waktunya aktif dan pemutaran dijeda.

- **Saat dijeda manual**: Takarir hanya muncul saat waktunya aktif dan pemutaran dijeda secara manual.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Pemutaran > Anotasi</a> {#playback-annotation}

These settings use the word statuses, states, and frequencies from [Anotasi](#annotation) for the selected subtitle track. The auto-pause, condensed, fast-forward, and repeat rules take effect while their playback modes are on. **No word filter** means no statuses or states are selected for that track. Rules apply per track: a seekable track without statuses or states selected for one of those modes keeps that mode's usual behavior, even when it plays alongside a track that has rules.

### Trek takarir {#playback-annotation-track}

Selects the subtitle track whose annotation playback settings you are editing. The selected track is shared with the Anotasi tab.

### Pilih kata cocok pertama saat dijeda {#select-first-matching-word-on-pause}

Memilih kata pertama yang cocok dengan status atau keadaan terpilih setiap kali pemutaran dijeda, termasuk jeda manual dan setelah melompat saat dijeda. Kosongkan pilihan untuk menonaktifkan perilaku ini. Pemilihan terjadi di pemutar video, atau di pemutar takarir jika tidak ada video yang dimuat atau terhubung.

Jika jeda disebabkan oleh [aturan jeda otomatis berbasis anotasi](#auto-pause-subtitles-containing-these-words), kata yang cocok dengan aturan itu akan dipilih. Menu tarik-turun ini tetap mengatur pemilihan kata saat jeda manual.

Setiap aturan kata di bawah ini memiliki pilihan status dan keadaan, batas jumlah kata, serta batas frekuensi masing-masing. Kata harus memiliki status atau keadaan terpilih dan memenuhi kedua batas tersebut.

### Jeda otomatis pada takarir yang berisi kata-kata ini {#auto-pause-subtitles-containing-these-words}

When auto-pause mode is on, pause only on subtitles containing a matching word and select the first matching word. This takes precedence over [**Pilih kata cocok pertama saat dijeda**](#select-first-matching-word-on-pause) for automatic pauses; that dropdown still applies on manual pauses.

### Ulangi takarir yang berisi kata-kata ini {#repeat-subtitles-containing-these-words}

Saat mode pengulangan aktif, ulangi hanya takarir yang berisi kata cocok.

### Putar takarir yang berisi kata-kata ini dalam mode ringkas {#play-subtitles-containing-these-words-in-condensed-mode}

Saat mode ringkas aktif, pertahankan takarir yang berisi kata cocok di linimasa ringkas. Lewati takarir lainnya.

### Putar takarir yang berisi kata-kata ini dengan kecepatan normal dalam mode maju cepat {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Saat mode maju cepat aktif, putar takarir yang berisi kata cocok pada kecepatan pemutaran normal. Majukan video dengan cepat saat melewati takarir lainnya.

### Sesuaikan kecepatan maju cepat berdasarkan pemahaman {#adjust-fast-forward-rate-by-comprehension}

Saat mode maju cepat aktif, gunakan nilai pemahaman kalimat untuk menentukan kecepatan pemutaran di dalam takarir.

At or below [**Pemahaman minimum**](#minimum-comprehension), use the normal playback rate; at 100%, use the configured fast-forward rate. Rates between those points are interpolated.

Changing the speed in a comprehension-controlled subtitle changes the configured fast-forward rate, then recalculates the applied rate from comprehension. This also applies when comprehension keeps the subtitle at normal speed. Pintasan keyboard and player speed controls use the same behavior; the normal rate is unchanged.

### Pemahaman minimum {#minimum-comprehension}

Mengatur persentase dimulainya percepatan (0–99%, bawaan 60%).

### Tampilkan kata-kata ini selama pemutaran {#show-these-words-during-playback}

Pilih status dan keadaan kata yang harus tetap terlihat.

### Sembunyikan seluruh takarir jika setidaknya persentase ini kata akan disembunyikan {#whole-subtitle-hidden-percentage}

Sembunyikan seluruh takarir jika aturan tampil akan menyembunyikan setidaknya persentase kata ini. Misalnya, pada **80%**, jika empat kata dalam takarir lima kata akan disembunyikan, seluruh takarir disembunyikan, termasuk satu kata yang dipilih untuk ditampilkan. Tanda baca dan karakter nonhuruf lainnya tidak dihitung.

### Sembunyikan setiap kata yang tidak cocok {#hide-non-matching-words-individually}

Jika diaktifkan, kata yang tidak memenuhi aturan tampil akan disembunyikan satu per satu selama takarir berada di bawah ambang penyembunyian seluruh takarir. Jika dinonaktifkan, seluruh takarir tetap terlihat sampai ambang tercapai.

### Jumlah minimum kata per kategori terpilih {#minimum-words-per-selected-category}

Setiap kategori terpilih (seperti **Belum dikumpulkan** atau **Diabaikan**) dihitung terpisah dalam sebuah takarir. Jika jumlahnya di bawah batas ini, kata dalam kategori tersebut tidak memicu aturan. `0` menonaktifkan batas.

### Jumlah maksimum kata per kategori terpilih {#maximum-words-per-selected-category}

Setiap kategori terpilih (seperti **Belum dikumpulkan** atau **Diabaikan**) dihitung terpisah dalam sebuah takarir. Jika jumlahnya melebihi batas ini, kata dalam kategori tersebut tidak memicu aturan. `0` menonaktifkan batas.

### Hanya jika frekuensi kata setidaknya {#only-when-word-frequency-is-at-least}

Frekuensi kata yang cocok harus sama dengan atau lebih tinggi dari nilai ini. Frekuensi yang tidak tersedia dihitung sebagai `1`. `0` menonaktifkan batas.

### Hanya jika frekuensi kata paling banyak {#only-when-word-frequency-is-at-most}

Frekuensi kata yang cocok harus sama dengan atau lebih rendah dari nilai ini. Frekuensi yang tidak tersedia dihitung sebagai `1`. `0` menonaktifkan batas.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Video streaming</a> (extension only) {#streaming-video}

Video streaming settings are available only when the browser extension is installed.

### Saat memuat takarir, buka juga daftar takarir di aplikasi pada tab terpisah {#open-subtitle-list-in-tab}

Setiap kali takarir dimuat ke elemen video, buka situs web di tab terpisah dan sinkronkan takarir yang dimuat dengannya.

### URL aplikasi {#app-url}

Menentukan sumber ekstensi mengambil beberapa konfigurasi dan URL yang dibuka saat menyinkronkan takarir ke situs web di tab terpisah. Pada dasarnya, ini adalah URL situs web.

### Aktifkan overlay kontrol {#enable-controls-overlay}

Tampilkan antarmuka Overlay pada elemen video yang memuat takarir.

### Tampilkan takarir {#display-subtitles}

Tampilkan takarir yang dimuat pada elemen video.

### Rekam audio saat menambang {#record-audio-when-mining}

Saat menambang takarir, rekam audio yang dicakup takarir untuk disertakan di kartu flash.

### Ambil tangkapan layar saat menambang {#take-screenshot-when-mining}

Saat menambang takarir, ambil tangkapan layar untuk disertakan di kartu flash.

### Bersihkan tangkapan layar saat menambang {#clean-screenshot-when-mining}

Saat menambang takarir dengan fitur tangkapan layar aktif, bersihkan tangkapan layar dengan menghapus elemen HTML apa pun di atas elemen video sebelum mengambilnya.

### Pangkas tangkapan layar saat menambang {#crop-screenshot-when-mining}

Saat menambang takarir, pangkas tangkapan layar agar hanya mencakup elemen video.

### Format pengambilan gambar {#streaming-image-capture-format}

Menentukan format gambar untuk kartu yang ditambang dari video streaming. Opsi tambahannya adalah "Animated WebP", yang merekam video di tab selama rentang waktu takarir—termasuk jeda audio—dan menyimpannya sebagai gambar animasi, bukan satu tangkapan layar.

Animated WebP hanya digunakan saat [rekam audio ketika menambang](#record-audio-when-mining) diaktifkan; jika tidak, tangkapan layar biasa diambil. Fitur ini berlaku untuk setiap cara menambang yang merekam media, termasuk perekaman manual dengan pintasan rekam yang menangkap video hingga perekaman dihentikan (maksimal 30 detik). Hanya satu perekaman yang dapat berjalan pada satu waktu. Animated WebP tidak tersedia di Firefox dan video yang dilindungi DRM tidak dapat direkam. Tab harus tetap terlihat saat klip direkam karena Chrome berhenti merender tab tersembunyi.

### FPS gambar animasi {#animated-image-fps}

Jumlah bingkai per detik yang diambil untuk gambar Animated WebP. Klip yang lebih panjang otomatis menggunakan lebih sedikit bingkai agar ukuran kartu tetap kecil. Hanya tersedia jika format gambar Animated WebP dipilih.

### Kualitas gambar animasi {#animated-image-quality}

Kualitas setiap bingkai gambar Animated WebP, dari `0.1` hingga `1`. Nilai lebih tinggi menghasilkan gambar lebih baik, tetapi berkasnya lebih besar. Hanya tersedia jika format gambar Animated WebP dipilih.

### Izinkan seret dan letakkan berkas takarir {#allow-subtitle-file-drag-and-drop}

Izinkan berkas takarir diseret dan dilepaskan ke elemen video.

### Muat otomatis takarir yang terdeteksi {#auto-load-detected-subtitles}

Jika deteksi takarir otomatis didukung di situs web saat ini, muat takarir secara otomatis. Jika beberapa trek terdeteksi, muat trek dalam bahasa pilihan. Bahasa pilihan adalah trek yang terakhir dimuat saat kotak "ingat pilihan trek ini" dicentang.

### Tampilkan peringatan jika gagal memuat takarir yang terdeteksi secara otomatis {#prompt-on-subtitle-autoload-failure}

Jika pemuatan takarir otomatis gagal, tampilkan konfirmasi sebelum mencoba memuat takarir yang terdeteksi.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Video streaming > Pages</a> {#pages}

Pengaturan untuk integrasi khusus halaman seperti YouTube, Netflix, dan lainnya. asbplayer memiliki pengaturan bawaan untuk setiap halaman; bagian halaman memungkinkan Anda mengubah nilai bawaan tersebut.

### Kode bahasa sasaran untuk terjemahan mesin (khusus YouTube) {#youtube-translation-languages}

Menentukan bahasa sasaran untuk terjemahan mesin YouTube. Jika bahasa ditentukan di sini, trek tambahan untuk setiap bahasa sasaran akan muncul di pemilih trek takarir.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Lain-lain</a> {#misc}

### Impor/ekspor pengaturan {#import-export-settings}

Mengimpor atau mengekspor pengaturan sebagai berkas `json`.

### Tema {#theme}

Menampilkan seluruh asbplayer dengan tema terang atau gelap.

### Bahasa {#language}

Bahasa to display UI in.

Catatan: belum semua string diterjemahkan ke setiap bahasa yang didukung asbplayer. String yang belum diterjemahkan akan ditampilkan dalam bahasa Inggris. Silakan bantu menerjemahkannya di [proyek Crowdin](https://crowdin.com/project/asbplayer).

### Perbesar video lokal secara otomatis {#auto-maximize-local-video}

Perbesar video lokal secara otomatis saat panel takarir dibuka.

### Tampilkan tombol tambang di daftar takarir {#show-mining-button-in-subtitle-list}

Jika diaktifkan, tombol tambang ditampilkan di samping setiap takarir dalam daftar takarir.

### Penanda waktu di daftar takarir {#subtitle-list-timestamps}

Mengatur tampilan penanda waktu di daftar takarir.

- **Tersembunyi**: Tidak ditampilkan.
- **Awal**: Hanya menampilkan penanda waktu awal takarir.
- **Awal dan akhir**: Menampilkan penanda waktu awal dan akhir takarir.

### Ingat offset takarir {#remember-subtitle-offset}

Jika diaktifkan, offset waktu akan diingat. Takarir dimuat menggunakan offset terakhir.

### Ingat kecepatan pemutaran terakhir {#remember-last-playback-rate}

Memperbarui pengaturan kecepatan pemutaran saat kecepatannya diubah pada video. Jika dinonaktifkan, pemutaran tetap dimulai dengan kecepatan yang dikonfigurasikan, tetapi perubahan saat menonton hanya berlaku sementara.

### Ingat mode pemutaran terakhir {#remember-last-playback-modes}

Memulihkan mode pemutaran yang terakhir diaktifkan saat pemutaran dimuat kembali. Jika dinonaktifkan, pemutaran dimulai dalam mode normal.

### Salin takarir saat ini ke papan klip secara otomatis {#auto-copy-current-subtitle-to-clipboard}

Menyalin takarir ke papan klip secara otomatis saat muncul di layar. Berguna untuk mengirim takarir ke aplikasi yang dapat memantau papan klip.

### Trek takarirs eligible for auto-copy {#subtitle-tracks-eligible-for-auto-copy}

Specifies which tracks will be auto-copied when the [Salin takarir saat ini ke papan klip secara otomatis](#auto-copy-current-subtitle-to-clipboard) setting is enabled.

### Tampilkan gambar mini pratinjau {#show-preview-thumbnails}

Menampilkan gambar mini pratinjau di daftar takarir.

### Tampilkan takarir di atas gambar mini {#subtitle-above-thumbnail}

Menampilkan takarir di atas gambar mini pratinjau dalam daftar takarir.

### Filter regex takarir {#subtitle-regex-filter}

Substrings matched by this regex will be replaced by the value of [Filter regex takarir text replacement](#subtitle-regex-filter-text-replacement)

### Filter regex takarir text replacement {#subtitle-regex-filter-text-replacement}

Subteks yang cocok dengan regex di atas akan diganti dengan nilai pengaturan ini. Jika dikosongkan, subteks yang cocok akan dihapus.

### HTML takarir {#subtitle-html}

Mengatur cara menangani HTML dalam berkas takarir.

### Deteksi dan tampilkan Ruby {#detect-and-display-ruby}

Jika diaktifkan, asbplayer akan otomatis mendeteksi bacaan kata bergaya Netflix dan menampilkannya dengan gaya khusus menggunakan tag `ruby`. Bacaan bergaya Netflix sering muncul dalam takarir bahasa Jepang, seperti `花子（はなこ）`, yaitu bacaan dalam tanda kurung setelah kata.

### Aktifkan klien WebSocket {#enable-websocket-client}

Mengaktifkan klien WebSocket agar asbplayer dapat dikendalikan melalui antarmuka WebSocket.

### URL server WebSocket {#websocket-server-url}

URL server WebSocket yang dihubungkan saat klien WebSocket diaktifkan. Biasanya URL ini mengarah ke [server WebSocket yang disertakan](../guides/web-socket-server.md) dan berjalan secara lokal.

### Batas penyimpanan riwayat penambangan {#mining-history-storage-limit}

Membatasi jumlah kartu yang dapat disimpan dalam riwayat penambangan.

### Nama tab {#name-of-the-tab}

Nama yang digunakan untuk tab aplikasi.

## Profil {#profiles}

Profil pengaturan adalah kumpulan nilai pengaturan yang sepenuhnya berbeda. Profil aktif dapat diubah dari antarmuka pengaturan atau dialog **Muat Takarir** dan **Ekspor Anki**.
