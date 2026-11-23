---
sidebar_position: 11
---

import project from '@site/src/project';

# Takarir online {#online-subtitles}

Daripada mencari berkas takarir secara manual, Anda dapat mencari dan memuatnya langsung dari asbplayer. Takarir disediakan oleh [Jimaku](https://jimaku.cc), situs takarir komunitas yang sebagian besar mencakup anime dan drama Jepang.

## Cara menggunakan {#usage}

1. Buka panel samping pada halaman yang memuat video, lalu klik **Muat Takarir**.
2. Klik **Cari takarir online** (juga tersedia dari menu tarik-turun trek takarir).
3. Istilah pencarian diisi otomatis dari judul halaman. Ubah jika perlu, pilih **Anime** atau **Drama**, lalu cari.
4. Klik hasil pencarian untuk melihat berkas takarirnya, lalu klik berkas untuk memuatnya.

Hanya berkas `.srt` dan `.ass` yang ditampilkan. Karya yang baru saja Anda buka akan muncul di **Terbaru**, sehingga pencarian dapat dilewati lain kali.

## Mendapatkan kunci API Jimaku {#api-key}

Jimaku memerlukan kunci API untuk mencari dan mengunduh.

1. Buat akun di [jimaku.cc](https://jimaku.cc), lalu masuk.
2. Buka [halaman akun](https://jimaku.cc/account) dan buat kunci API.
3. Tempel kunci tersebut ke kolom **Kunci API Jimaku** pada dialog pencarian.

Kunci disimpan secara otomatis, jadi langkah ini cukup dilakukan sekali. Secara bawaan, kunci disembunyikan; gunakan ikon mata untuk menampilkannya.

## Deteksi episode otomatis {#episode-detection}

Untuk serial, asbplayer mencoba membaca nomor episode dari judul halaman (misalnya `S01E05`, `EP05`, atau `第5話`/`第五集`). Jika ditemukan:

- penanda episode dihapus dari istilah pencarian sehingga pencarian hanya menggunakan nama serial;
- daftar berkas difilter ke episode tersebut dan ditandai sebagai **EP N**. Klik ✕ pada tanda itu untuk melihat semua berkas.

Jika tidak ada berkas takarir yang dapat digunakan untuk episode pilihan, daftar lengkap akan ditampilkan.

### Regex episode khusus {#episode-regex}

Beberapa situs menggunakan format judul yang tidak dikenali oleh aturan bawaan, sehingga episode tidak terdeteksi dan semua berkas dalam serial ditampilkan. Regex khusus dapat memberi tahu asbplayer cara membaca episode di situs tersebut.

Setelah membuka serial, klik ikon roda gigi di sebelah judul daftar berkas untuk menampilkan kolom **Regex episode khusus**. Ikon roda gigi akan disorot jika regex telah diatur.

- **Grup tangkapan 1** harus berupa nomor episode (angka Arab dan angka kanji dapat digunakan).
- Regex Anda dicoba terlebih dahulu. Jika kosong, tidak valid, atau tidak cocok, aturan bawaan tetap digunakan, jadi regex khusus hanya menambah cakupan deteksi.
- Tekan **Enter** untuk memfilter ulang serial saat ini. Istilah pencarian akan menerapkan perubahan itu saat dialog dibuka lagi.

:::tip
Aturan bawaan hanya diuji pada beberapa situs yang digunakan oleh pembuat fitur ini. Jika format judul situs tidak dikenali, silakan <a href={`${project.urls.repo}/issues`}>buat issue</a> dengan contoh judul halaman (atau kirim PR untuk `common/subtitle-sources/jimaku-episode-patterns.ts`) agar aturan bawaan dapat diperluas.
:::

Misalnya, jika judul halaman situs berbentuk `Some Show - Chapter 07 | SiteName`, gunakan:

```
Chapter (\d+)
```

## Ucapan terima kasih {#jimaku-acknowledgements}

Terima kasih banyak kepada [Rapptz](https://github.com/Rapptz), pembuat dan pengelola [Jimaku](https://github.com/Rapptz/jimaku), yang menyediakan API sehingga fitur ini dapat digunakan. Jika Anda merasa fitur ini berguna, pertimbangkan untuk mendukung situs tersebut dan mengunggah takarir Anda sendiri.
