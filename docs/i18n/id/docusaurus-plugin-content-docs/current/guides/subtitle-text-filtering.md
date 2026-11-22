---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Memfilter teks takarir {#subtitle-text-filtering}

Untuk menyaring bagian tertentu dari teks takarir, Anda dapat menggunakan ekspresi reguler (regex). asbplayer dapat mencocokkan rangkaian teks sesuai pola regex yang ditentukan dan menghapus hasil yang cocok.

## Mengonfigurasi filter regex {#configure-the-regex-filter}

Di bagian <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>lain-lain</a> pada pengaturan asbplayer, cari kotak teks "Subtitle regex filter". Masukkan regex yang sesuai untuk menyaring konten yang diinginkan.
Anda juga dapat mengganti konten yang disaring dengan memasukkan teks ke kotak "Subtitle regex filter text replacement". Jika dikosongkan, konten akan dihapus.

### Menghapus nama pembicara {#remove-speaker-names}

Hapus nama pembicara yang diapit tanda kurung (misalnya "**（山田）**　元気ですか？").

<details>
<summary>Gunakan filter ini</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Mempertahankan bacaan bahasa Jepang {#preserve-japanese-readings}

Hapus nama atau deskripsi dalam tanda kurung, tetapi pertahankan bacaan bahasa Jepang yang langsung mengikuti teks bahasa Jepang. Misalnya, `（山田）漢字(かんじ)を読む。` menjadi `漢字(かんじ)を読む。`. `(かんじ)` dan `（かんじ）` akan dipertahankan jika tepat didahului karakter dalam rentang kanji, hiragana, atau katakana yang tercantum di regex.

Ini merupakan pendekatan heuristik: deskripsi yang langsung mengikuti teks bahasa Jepang, seperti `こんにちは（笑）`, juga akan dipertahankan, sedangkan bacaan yang dipisahkan dari teks dasarnya dengan spasi akan dihapus. Tanda kurung bersarang tidak ditangani. Kosongkan "Subtitle regex filter text replacement".

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menggabungkan baris takarir {#merge-subtitle-lines}

Beberapa takarir terbagi menjadi beberapa baris; regex ini menggabungkannya menjadi satu baris. Agar filter ini berfungsi, masukkan `$1 $2` di kolom "Subtitle regex filter text replacement".

Jika menggabungkan pola ini dengan pola lain, letakkan pola ini paling akhir agar alternatif yang lebih spesifik dapat dicocokkan terlebih dahulu pada posisi yang sama. Alternatif tidak dijalankan sebagai tahap penyaringan terpisah. Semua kecocokan menggunakan teks pengganti yang sama, dan penambahan grup tangkapan pada alternatif lain akan mengubah nomor yang diperlukan dalam `$1 $2`.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Menghapus baris baru {#remove-newlines}

Hapus semua karakter baris baru tanpa menyisipkan spasi. Misalnya, dua baris berisi `こんにちは` dan `世界` menjadi `こんにちは世界`. Kosongkan "Subtitle regex filter text replacement". Untuk menyisipkan spasi di antara baris, gunakan [contoh menggabungkan baris takarir](#merge-subtitle-lines).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menghapus deskripsi dalam tanda kurung siku {#remove-bracketed-descriptions}

Hapus keterangan suara atau musik yang diapit tanda kurung siku (misalnya "**\[MUSIK CERIA]**" atau "**\-[TERKEJUT]**").

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menghapus deskripsi huruf kapital {#remove-uppercase-descriptions}

Sebagai alternatif, saring deskripsi yang ditulis dengan huruf kapital tanpa tanda kurung siku (misalnya "**MUSIK CERIA**"). Jika bahasa Anda memiliki huruf tambahan dengan diakritik, Anda dapat menambahkannya ke daftar ini.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menghapus simbol musik {#remove-music-symbols}

Hapus rangkaian simbol musik yang berdiri sendiri (misalnya `♪♬♪`).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menghapus keterangan efek suara {#remove-sound-effect-cues}

Hapus teks takarir yang seluruhnya terdiri atas deskripsi dalam tanda kurung atau simbol musik, seperti `[SUARA GUNTUR]`, `-[TERKEJUT]`, atau `♪♬♪`. Jangkar `^` dan `$` mengharuskan seluruh teks takarir cocok, sehingga dialog seperti `Halo [TERKEJUT]` atau `♪ Halo ♪` tetap dipertahankan. Kosongkan "Subtitle regex filter text replacement".

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menghapus tanda kiri-ke-kanan {#remove-left-to-right-marks}

Hapus U+200E, tanda kiri-ke-kanan (LRM) yang tidak terlihat. Misalnya, teks berisi `Halo`, LRM, dan `dunia` akan menjadi `Halodunia`. Masukkan escape literal `\u200E` di kolom regex dan kosongkan "Subtitle regex filter text replacement".

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menghapus kontrol dua arah {#remove-bidi-controls}

Hapus semua karakter kontrol Unicode dua arah, termasuk tanda kiri-ke-kanan (U+200E), tanda kanan-ke-kiri (U+200F), serta kontrol embedding, override, dan isolate. Kosongkan "Subtitle regex filter text replacement". Karakter ini dapat memengaruhi urutan tampilan teks kanan-ke-kiri atau teks dengan arah campuran, jadi gunakan filter ini hanya jika Anda ingin menghapusnya.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menggabungkan regex {#combining-regexes}

Ekspresi reguler dapat digabungkan dengan karakter `|` (tidak perlu spasi di antaranya). Misalnya, untuk menggunakan dua regex dari daftar di atas, masukkan `-?\[.*\]|[♪♬#～〜]+`. Anda dapat menggabungkan sebanyak mungkin regex dengan cara ini.

### Menghapus teks dalam tanda kurung dan baris baru {#remove-parenthesized-text-and-newlines}

Untuk menghapus teks dalam tanda kurung dan semua baris baru sekaligus, gunakan:

Kosongkan "Subtitle regex filter text replacement". Misalnya, `（山田）こんにちは` yang diikuti baris baru dan `世界` menjadi `こんにちは世界`. Pola ini menghapus tanda kurung ASCII dan lebar penuh beserta isinya, termasuk bacaan bahasa Jepang, lalu menggabungkan baris tanpa menambahkan spasi. Tanda kurung bersarang tidak ditangani; untuk itu gunakan [contoh nama pembicara](#remove-speaker-names).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Menggabungkan semua filter penghapusan {#combine-all-removal-filters}

Untuk menghapus kontrol dua arah, nama pembicara dalam tanda kurung (termasuk tanda kurung bersarang), deskripsi dalam tanda kurung siku, dan simbol musik sekaligus, gunakan:

Kosongkan "Subtitle regex filter text replacement". Pola ini menggabungkan contoh penghapusan di atas dan menggabungkan baris tanpa menambahkan spasi. Bacaan bahasa Jepang juga akan dihapus; gunakan [contoh yang mempertahankan bacaan](#preserve-japanese-readings) jika ingin menyimpannya.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Karakter tak terlihat dan takarir kosong {#invisible-characters}

Takarir yang tampak kosong mungkin mengandung karakter tak terlihat seperti LRM. Setelah penguraian dan penyaringan, asbplayer membuang cue teks yang hanya berisi spasi, karakter kontrol, atau karakter Unicode yang secara bawaan dapat diabaikan. Tanda arah di dalam teks bermakna akan dipertahankan kecuali regex Anda menghapusnya secara eksplisit.

Karakter tak terlihat di awal atau akhir cue dapat membuat pola berjangkar seperti `^\[.+\]$` tidak cocok. Jika pola tidak cocok, asbplayer mencobanya lagi tanpa spasi dan kontrol tak terlihat di sekelilingnya, tetapi cue hanya dibuang jika percobaan ulang tidak menyisakan teks bermakna. Misalnya, `[GUNTUR]` yang diikuti LRM dihapus dengan pola ini dan teks pengganti kosong. Percobaan ulang mempertahankan cue asli jika teks penggantinya masih bermakna.

Saat menggabungkan pola berjangkar dengan alternatif penghapusan dua arah, ingat bahwa penggantian dilakukan dalam satu tahap. Misalnya, `^\[.+\]$|\u200E` yang diterapkan pada `[GUNTUR]` diikuti LRM akan menghapus LRM, tetapi tidak mencoba ulang deskripsi dalam tanda kurung setelahnya. Untuk menghapus keduanya dalam tahap yang sama, gunakan pola tanpa jangkar `\[.+\]|\p{Bidi_Control}` dengan teks pengganti kosong. Pola ini juga menghapus deskripsi dalam tanda kurung yang berada di tengah dialog.

## Pelajari {#learn}

Pelajari cara menulis dan menguji ekspresi reguler khusus di [Regex Learn - Playground](https://regexlearn.com/playground).
