---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Menambang takarir {#mining-subtitles}

**Menambang kalimat** adalah kegiatan membuat kartu flash dari kalimat. asbplayer membantu Anda membuat kartu kalimat berkualitas tinggi dengan menggabungkan video, audio, dan takarir ke dalam satu kartu. asbplayer terintegrasi dengan **Anki**, aplikasi kartu flash yang populer.

## Menyiapkan Anki {#setup-anki}

1. Pasang [Anki](https://apps.ankiweb.net/).
2. Tambahkan [AnkiConnect](https://ankiweb.net/shared/info/2055492159) ke Anki.
3. Jika menambang dari berkas video, tambahkan <code>{appOrigin}</code> ke `webCorsOriginList` dalam pengaturan AnkiConnect:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Tambahkan sebuah **Deck**.
5. Tambahkan sebuah **Note type**.
   Sebaiknya buat jenis catatan sendiri atau gunakan yang sudah tersedia. Jika ingin langsung mulai, ikuti langkah berikut untuk membuat jenis catatan dasar:
   1. Klik Alat → Kelola Jenis Catatan.
   2. Tambahkan jenis catatan "Basic".
   3. Atur **Kolom**:
      - Kalimat
      - Kata
      - Definisi
      - Gambar
      - Audio
      - Sumber
      - URL
   4. Atur **Kartu**:
      - Depan:
        ```
        {{Sentence}}
        ```
      - Belakang:
        ```
        {{FrontSide}}
        <hr id=answer>
        {{Definition}}
        <p/>
        <div class="image">
        {{Image}}
        </div>
        <p/>
        {{Audio}}
        <p/>
        {{Source}}
        <p/>
        {{URL}}
        ```

## Mengonfigurasi asbplayer {#configure-asbplayer}

1. Buka <a href={new URL('?view=settings', project.urls.app).href}>pengaturan asbplayer</a>.
2. Pilih **Deck** dan **Note type** yang baru saja Anda buat.
3. Untuk setiap kolom **Sentence**, **Definition**, **Word**, **Audio**, **Image**, **Source**, dan **URL**, pilih kolom yang sesuai pada jenis catatan.

## Memasang aplikasi kamus {#install-a-dictionary-app}

asbplayer tidak memiliki kamus bawaan. Kami menyarankan Anda memasang aplikasi kamus agar lebih mudah mengisi kolom **Definition** pada kartu. Berikut beberapa pilihan populer:

- [Yomitan](https://yomitan.wiki/) adalah ekstensi peramban yang memungkinkan Anda mencari kata dengan mengarahkan kursor ke kata tersebut. Awalnya dibuat untuk bahasa Jepang, tetapi kini mulai mendukung bahasa lain.
- [VocabSieve](https://docs.freelanguagetools.org/) adalah aplikasi belajar bahasa mandiri yang mendukung bahasa-bahasa Eropa.

## Menambang takarir {#mine-subtitles}

1. [Muat takarir](./loading-subtitles.md) ke sumber video mana pun.
2. Klik tombol **Tambang Takarir** <NoteAddIcon />.
3. Isi dialog yang muncul, lalu klik **Ekspor**.
