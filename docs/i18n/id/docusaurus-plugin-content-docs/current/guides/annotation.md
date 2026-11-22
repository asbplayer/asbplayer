---
sidebar_position: 1
---

import project from '@site/src/project';

# Anotasi {#annotation}

asbplayer dapat memberi anotasi pada takarir untuk membantu Anda belajar bahasa. Fitur anotasi meliputi:

- **Gaya kata**: warna, garis bawah, kerangka, dan lainnya berdasarkan status kata
    - Status diketahui dapat bersumber dari dan disinkronkan dengan Anki, WaniKani, dan/atau dilacak secara lokal di asbplayer (termasuk fitur impor/ekspor untuk menambahkan kata yang diketahui)
- **Anotasi bacaan**: bacaan yang ditampilkan di atas setiap kata atau berdasarkan statusnya
- **Anotasi frekuensi**: frekuensi berbasis peringkat yang ditampilkan di bawah setiap kata atau berdasarkan statusnya (memerlukan setidaknya satu kamus frekuensi berbasis peringkat)
- **Anotasi aksen nada**: pola aksen yang ditampilkan pada furigana atau kata kana (memerlukan setidaknya satu kamus aksen nada)
- **Anotasi glosarium**: definisi atau penjelasan singkat yang ditampilkan untuk setiap kata
- **Statistik dan pemahaman**: memberikan gambaran tentang kata yang Anda ketahui dalam media saat ini.
- **Pemutaran adaptif**: menggunakan mode pemutaran dan data anotasi untuk mengoptimalkan pengalaman belajar Anda.
- **Penjelajah kata**: mengelola kata lokal dan melihat kata yang disinkronkan dari sumber eksternal.
- **Banyak fitur lainnya untuk rilis mendatang!**

:::info
Anotasi memerlukan [Yomitan](https://yomitan.wiki/) yang telah dikonfigurasi dan [yomitan-api](https://github.com/yomidevs/yomitan-api).

Jika Anda mengandalkan **basis data kata lokal**, sebaiknya pasang ekstensi peramban asbplayer agar kata tersimpan tidak mudah dihapus oleh peramban. Jika ekstensi tidak dapat dipasang, pertimbangkan untuk mengekspor pengaturan dan/atau kata lokal secara berkala sebagai cadangan.
:::

## Penyiapan {#setup}

1. Buka **Pengaturan** asbplayer.
2. Buka bagian **Anotasi**.
3. Pilih trek yang ingin dikonfigurasi.
4. Atur **URL Yomitan** untuk trek tersebut.
    - Anda memerlukan [Yomitan](https://yomitan.wiki/) yang telah dikonfigurasi dan [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - Jika URL tidak valid atau tidak dapat dijangkau, asbplayer akan menampilkan kesalahan di samping pengaturan tersebut.
    - Informasi frekuensi memerlukan setidaknya satu kamus frekuensi berbasis peringkat di Yomitan.
5. (Pengguna Anki) Atur kartu mana yang menjadi sumber informasi status kata yang diketahui.
    - [`Deck Anki`](../reference/settings.md#anki-decks) biasanya dibiarkan kosong agar semua deck digunakan sebagai sumber; penyaringan berdasarkan kolom biasanya sudah cukup.
    - [`Kolom kata Anki`](../reference/settings.md#anki-word-fields) merujuk pada kolom di catatan Anki yang hanya berisi kata sasaran.
    - [`Kolom kalimat Anki`](../reference/settings.md#anki-sentence-fields) hanya digunakan untuk catatan Anki yang tidak memiliki kolom khusus untuk kata (seperti deck kalimat). Kata dari sini digunakan sebagai cadangan jika kata tidak ditemukan di kolom kata Anki.
    - Untuk mengisi basis data, gunakan [`Bangun ulang basis data kata Anki`](../reference/settings.md#re-build-anki-word-database) setelah mengatur kolom tersebut.
6. (Pengguna WaniKani) Buka [WaniKani > Pengaturan > Token API](https://www.wanikani.com/settings/personal_access_tokens) untuk membuat token bagi asbplayer.
    - Pada kolom `Token Description`, masukkan `asbplayer`. Biarkan semua `Permissions` tidak dicentang; asbplayer hanya memerlukan akses baca ke akun WaniKani Anda.
    - Klik `Generate token`, lalu salin token yang dibuat ke [`Token API WaniKani`](../reference/settings.md#wanikani-api-token).
    - Untuk mengisi basis data, gunakan [`Bangun ulang basis data kata WaniKani`](../reference/settings.md#re-build-wanikani-word-database) setelah mengatur token API.
7. Aktifkan fitur anotasi yang diinginkan (gaya, bacaan, frekuensi, aksen nada, dan sebagainya) untuk trek tersebut. Sesuaikan pengaturan lain sesuai kebutuhan.
8. Untuk penjelasan terperinci tentang setiap opsi, lihat bagian [Anotasi](../reference/settings.md#annotation) pada referensi pengaturan. Tindakan keyboard tercantum dalam grup [Pintasan keyboard anotasi](../reference/settings.md#annotation-keyboard-shortcuts).

## Pemecahan masalah {#troubleshooting}

Lihat bagian [masalah umum](../common-issues.md#annotation) pada dokumentasi untuk mengatasi masalah anotasi. Jika solusi tidak ditemukan di sana, hubungi kami melalui <a href={project.urls.discord}>Discord</a> atau kirim <a href={`${project.urls.repo}/issues`}>laporan bug</a> yang berisi detail masalah dan langkah untuk mengulanginya.
