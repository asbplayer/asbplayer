---
sidebar_position: 5
---

import project from '@site/src/project';

# Masalah umum {#common-issues}

## Umum {#general}

### Takarir tidak muncul {#subtitles-arent-showing-up}

Takarir di asbplayer dapat disembunyikan dengan beberapa cara:

- Pintasan keyboard [`Tampilkan/sembunyikan takarir`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Pintasan keyboard [`Tampilkan/sembunyikan trek takarir X di video`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Opsi [`Tampilkan takarir`](./reference/settings.md#show-subtitles) di `Pemutaran > Mode pemutaran`.

### asbplayer tidak dapat terhubung ke Anki. Muncul pesan kesalahan seperti 'Failed to fetch.' {#anki-connection-failed}

Hal ini dapat disebabkan oleh pemblokir iklan:

- Jika menggunakan Brave, pastikan Shield tidak memblokir asbplayer.
- Pastikan peramban atau pemblokir iklan tidak memblokir permintaan. Coba buka konsol pengembang peramban dan cari pesan kesalahan.

Konfigurasi yang salah:

- Jika menggunakan situs web, pastikan AnkiConnect mengizinkan asbplayer seperti yang dijelaskan [di sini](./getting-started/mining-subtitles.md).

Atau bug:

- Saat tulisan ini dibuat, fitur platform web eksperimental diketahui dapat menyebabkan masalah ini. Coba nonaktifkan tanda tersebut dari `chrome://flags`.
- Pada versi macOS yang lebih baru, AnkiConnect tidak akan merespons saat Anki berjalan di latar belakang ([Catatan untuk Pengguna macOS](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### Kartu tidak diperbarui di Anki saat menggunakan fitur 'perbarui kartu terakhir'. {#card-not-updating}

Pastikan penjelajah kartu Anki ditutup saat menggunakan "perbarui kartu terakhir". Ada [masalah yang diketahui](https://github.com/FooSoft/anki-connect/issues/82) pada AnkiConnect yang membuat kartu seolah-olah tidak diperbarui saat penjelajah kartu terbuka.

### Saat memuat berkas lokal, asbplayer menampilkan layar hitam atau tidak memutar audio. {#local-video-playback-issues}

Kemampuan peramban dalam mendekode format video dan audio tertentu berbeda-beda. Lihat bagian [kompatibilitas](./compatibility.md#browsers-and-media-formats).

### Ekstensi kamus popup saya (misalnya Yomitan) tidak berfungsi di panel samping {#popup-dictionary-in-side-panel}

Demi alasan keamanan, peramban tidak mengizinkan skrip ekstensi disisipkan ke halaman ekstensi lain, jadi masalah ini tidak dapat diperbaiki. Jika ingin memindai teks dengan ekstensi lain, lakukan dari takarir yang ditampilkan di elemen video atau dari daftar takarir di situs web asbplayer.

### asbplayer tidak mendeteksi video streaming. {#asbplayer-isnt-detecting-streaming-video}

Pastikan ekstensi memiliki akses ke semua situs pada detail ekstensi.

### Pintasan keyboard tidak berfungsi. {#keyboard-shortcuts-arent-working}

Periksa <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>pengaturan pintasan keyboard</a> atau [referensi pintasan keyboard](./reference/settings.md#keyboard-shortcuts).

Jika menggunakan ekstensi:

- Periksa `chrome://extensions/shortcuts` di Chrome, atau `about:addons` → ikon roda gigi → `Kelola Pintasan Ekstensi` di Firefox.
- Coba muat ulang halaman dan muat takarir lagi.
- Coba hapus dan pasang ulang ekstensi, lalu mulai ulang peramban.
- Pastikan ekstensi tidak dipasang dua kali.

### asbplayer tidak memotong tangkapan layar video streaming dengan benar. {#screenshot-cropping-issues}

Pastikan pembesaran peramban diatur ke 100%. Pemotongan dapat dinonaktifkan sepenuhnya dari <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>pengaturan ekstensi</a>.

### Saya kesulitan membuat kartu dengan catatan JP mining. {#jp-mining-note-issues}

Lihat [masalah ini](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer terus meminta izin untuk merekam audio {#repeated-audio-permission-prompts}

Saat ini asbplayer tidak kompatibel dengan ekstensi Volume Master, jadi Anda perlu menonaktifkannya.

### Rekaman audio terdengar rusak, berderak, atau terputus-putus {#garbled-audio-recordings}

Biasanya hal ini disebabkan oleh CPU yang tidak memadai. Jika menggunakan laptop, pastikan laptop tersambung ke sumber daya. Secara umum, pastikan mode hemat baterai dan sebagainya tidak membatasi kinerja CPU.

### Saya menggunakan pintasan keyboard untuk membuka asbplayer pada video streaming, tetapi tidak terjadi apa-apa dan halaman tidak merespons. {#streaming-shortcut-unresponsive}

Hal ini dapat terjadi karena `Experimental Web Platform features` aktif di `chrome://flags`. Pastikan tanda tersebut dinonaktifkan, lalu coba lagi.

## Anotasi {#annotation}

### Mengaktifkan atau menonaktifkan anotasi untuk trek {#enable-or-disable-annotation-for-a-track}

Anotasi dianggap nonaktif jika pengaturan berikut memiliki nilai ini:

- Di [`Pengaturan > Anotasi`](./reference/settings.md#annotation):
  - [`Warnai takarir berdasarkan kata yang diketahui`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Mati**
  - [`Buat statistik secara otomatis`](./reference/settings.md#generate-statistics-automatically): **Mati**
  - [`Tampilkan bacaan kata`](./reference/settings.md#display-word-readings): _Tidak ada yang dipilih_ (nilai kosong)
  - [`Tampilkan frekuensi kata`](./reference/settings.md#display-word-frequency): _Tidak ada yang dipilih_ (nilai kosong)
  - [`Tampilkan aksen nada (bahasa Jepang)`](./reference/settings.md#display-pitch-accent-japanese): _Tidak ada yang dipilih_ (nilai kosong)
  - [`Tampilkan definisi kata`](./reference/settings.md#display-word-definitions): _Tidak ada yang dipilih_ (nilai kosong)
- Di [`Pengaturan > Pemutaran > Anotasi`](./reference/settings.md#playback-annotation):
  - [`Pilih kata cocok pertama saat jeda`](./reference/settings.md#select-first-matching-word-on-pause): Tidak pernah
  - [`Jeda otomatis pada takarir yang berisi kata-kata ini`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Tanpa filter kata
  - [`Putar takarir yang berisi kata-kata ini dalam mode ringkas`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Tanpa filter kata
  - [`Putar takarir yang berisi kata-kata ini dengan kecepatan normal dalam mode maju cepat`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Tanpa filter kata
  - [`Ulangi takarir yang berisi kata-kata ini`](./reference/settings.md#repeat-subtitles-containing-these-words): Tanpa filter kata
  - [`Tampilkan kata-kata ini selama pemutaran`](./reference/settings.md#show-these-words-during-playback): Tanpa filter kata
  - [`Sesuaikan kecepatan maju cepat berdasarkan pemahaman`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Mati**

Untuk mengaktifkan anotasi pada trek, ubah setidaknya satu pengaturan di atas ke nilai selain nilai nonaktifnya. Anotasi tertentu mungkin hanya muncul saat diarahkan jika [diatur demikian](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Tombol [`Bangun ulang basis data kata Anki`](./reference/settings.md#re-build-anki-word-database) dan [`Bangun ulang basis data kata WaniKani`](./reference/settings.md#re-build-wanikani-word-database) akan dinonaktifkan kecuali pengaturan di atas memiliki nilai tertentu yang memerlukan integrasi tersebut.
:::

### Menghapus basis data kata Anki {#clear-anki-word-database}

Untuk menghapus entri basis data kata Anki pada sebuah trek, kosongkan [`kolom kata Anki`](./reference/settings.md#anki-word-fields) dan [`kolom kalimat Anki`](./reference/settings.md#anki-sentence-fields), lalu gunakan tombol [`Bangun ulang basis data kata Anki`](./reference/settings.md#re-build-anki-word-database). Jika tombolnya nonaktif, [ikuti langkah-langkah ini](#enable-or-disable-annotation-for-a-track) untuk mengaktifkan anotasi pada trek terlebih dahulu.

### Menghapus basis data kata WaniKani {#clear-wanikani-word-database}

Untuk menghapus entri basis data kata WaniKani pada sebuah trek, kosongkan [token API WaniKani](./reference/settings.md#wanikani-api-token), lalu gunakan tombol [`Bangun ulang basis data kata WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Jika tombolnya nonaktif, [ikuti langkah-langkah ini](#enable-or-disable-annotation-for-a-track) untuk mengaktifkan anotasi pada trek terlebih dahulu.

### Menghapus kata yang dilacak secara lokal {#delete-locally-tracked-words}

Untuk menghapus kata yang dilacak secara lokal, arahkan kursor ke kata tersebut dan gunakan [pintasan keyboard anotasi](./reference/settings.md#annotation-keyboard-shortcuts) untuk mengubah statusnya menjadi **Belum dikumpulkan**. Jika status **Abaikan** aktif, nonaktifkan juga.

Untuk menghapus banyak kata yang dilacak secara lokal sekaligus, gunakan [`Penjelajah kata`](./reference/settings.md#word-browser) untuk menandai kata sebagai **Belum dikumpulkan** dan menghapus statusnya. Anda juga dapat menggunakan fitur [`Impor kata`](./reference/settings.md#import-words).

### Semua kata berstatus belum dikumpulkan {#everything-is-uncollected}

Jika anotasi tidak sengaja diaktifkan, [ikuti langkah-langkah ini](#enable-or-disable-annotation-for-a-track) untuk menonaktifkannya.

Jika status kata tidak pernah berubah dari **Belum dikumpulkan**:

- Jika mengandalkan status lokal, impor kata ke basis data kata lokal atau gunakan hover dan [pintasan keyboard anotasi](./reference/settings.md#annotation-keyboard-shortcuts) untuk mengatur status.
- Jika mengandalkan Anki untuk status, pastikan Anki berjalan dan **URL AnkiConnect** sudah benar.
    - Atur [`kolom kata Anki`](./reference/settings.md#anki-word-fields) (disarankan) dan/atau [`kolom kalimat Anki`](./reference/settings.md#anki-sentence-fields).
    - Jalankan [`Bangun ulang basis data kata Anki`](./reference/settings.md#re-build-anki-word-database).
    - Anki tidak perlu terus berjalan setelah basis data dibuat, tetapi membiarkannya terbuka selama pemutaran akan menjaga sinkronisasi asbplayer.
- Jika mengandalkan WaniKani untuk status, pastikan [`token API WaniKani`](./reference/settings.md#wanikani-api-token) sudah benar.
    - Jalankan [`Bangun ulang basis data kata WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - asbplayer akan menyinkronkan data dengan WaniKani secara otomatis selama pemutaran.

### Gaya coret merah muncul {#red-strikethrough-styling-appears}

Jika anotasi tidak sengaja diaktifkan, [ikuti langkah-langkah ini](#enable-or-disable-annotation-for-a-track) untuk menonaktifkannya.

Ini menandakan terjadi kesalahan saat memproses takarir, kemungkinan besar karena masalah koneksi ke Yomitan. Periksa pesan kesalahan di konsol peramban dan minta bantuan di Discord asbplayer jika masalah belum teratasi.
