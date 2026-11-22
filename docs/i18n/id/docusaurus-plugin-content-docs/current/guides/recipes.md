---
sidebar_position: 1.5
title: Resep
---

import project from '@site/src/project';

import RecipePreset, { dialogueFocusRecipe, gapFastForwardRecipe } from '@site/src/components/RecipePreset';

export const nonAnnotationPlaybackSettings = {
  dictionaryTracks: Array.from({ length: 3 }, () => ({
    dictionaryPlaybackConfig: Object.fromEntries(
      ['autoPause', 'repeat', 'condensed', 'fastForward', 'wordVisibility'].map((feature) => [
        feature,
        {
          onStatuses: Array.from({ length: 6 }, () => ({ enabled: false })),
          onStates: [{ enabled: false }],
          ...(feature === 'fastForward' ? { rateByComprehension: { enabled: false } } : {}),
        },
      ])
    ),
  })),
};

export const annotationPlaybackRule = (statuses, rules = {}) => ({
  rules: { minWords: 0, maxWords: 0, minFrequency: 0, maxFrequency: 0, ...rules },
  onStatuses: Array.from({ length: 6 }, (_, status) => ({ enabled: statuses.includes(status) })),
  onStates: [{ enabled: false }],
});

export const annotationPlaybackSelection = (statuses) => ({
  onStatuses: Array.from({ length: 6 }, (_, status) => ({ enabled: statuses.includes(status) })),
  onStates: [{ enabled: false }],
});

export const annotationPlaybackSettings = (playbackConfig) => ({
  seekableTracks: 1,
  dictionaryTracks: nonAnnotationPlaybackSettings.dictionaryTracks.map((track, index) => ({
    dictionaryPlaybackConfig: {
      ...Object.fromEntries(
        Object.entries(track.dictionaryPlaybackConfig).map(([feature, config]) => [
          feature,
          { ...config, ...(index === 0 ? playbackConfig[feature] : {}) },
        ])
      ),
      ...(index === 0 && playbackConfig.selectOnPause !== undefined
        ? { selectOnPause: playbackConfig.selectOnPause }
        : {}),
    },
  })),
});

export const unfamiliarWordPlaybackConfig = {
  autoPause: annotationPlaybackRule([0, 1]),
  repeat: annotationPlaybackRule([0, 1]),
};

export const unfamiliarWordRepeatSettings = {
  autoPausePreference: 2,
  autoPauseResumeMode: 'fixed',
  autoPauseFixedDurationMs: 1000,
  autoPauseResumeDelayMs: 0,
  repeatCountPreference: 1,
  repeatsBeforeShowingSubtitles: 0,
  subtitleVisibility: 'whenDue',
  subtitleTriggerStartOffset: 0,
  subtitleTriggerEndOffset: 0,
};

# Resep

Resep menggabungkan mode pemutaran dan pengaturan pemutaran sehingga Anda dapat beralih di antara kegiatan belajar. Pilih resep di **Pengaturan > Pemutaran**, di samping mode pemutaran pada kontrol pemutar, atau di overlay seluler. Pilih **Nonaktif** untuk kembali ke pengaturan yang mendasarinya. Pengaturan pemutaran tersimpan, kecepatan pemutaran yang diingat, dan mode yang diingat tetap dipertahankan saat resep aktif.

## Membuat dan mengedit resep

Pilih **Edit Recipe** di tab Pemutaran. Jika resep telah dipilih, Anda memulai dari resep tersebut; jika tidak, Anda memulai dari pengaturan pemutaran saat ini. Pilih mode pemutaran dan ubah pengaturan yang ingin disertakan. Perubahan ini tetap menjadi draf dan tidak memengaruhi pemutaran sebelum disimpan.

Pilih **Save Recipe** untuk meninjau pengaturan dan memasukkan nama hingga 100 karakter. Anda dapat menghapus pengaturan tertentu dari pratinjau; pengaturan yang dihilangkan akan menggunakan pengaturan yang mendasarinya. Mode pemutaran selalu ditentukan sebagai satu kombinasi lengkap.

Saat mengedit resep yang sudah ada, biarkan namanya tetap sama untuk memperbarui resep tersebut. Mengetik di kolom nama akan membuat resep baru, meskipun nama aslinya diketik kembali. Pilih **Cancel** untuk membuang draf.

## Mengimpor dan membagikan

Pilih **Import Recipe**, tempel JSON resep, tinjau pengaturannya, lalu konfirmasi. Anda dapat mengubah nama dan menghapus pengaturan sebelum mengimpor. Resep yang diimpor ditambahkan ke akhir daftar dan langsung dipilih. Pengaturan yang tidak dikenal dan nilai pengaturan yang tidak valid akan diabaikan. Nama dan mode pemutaran harus valid.

Anda juga dapat membuka tautan impor. Tautan itu membuka aplikasi web pada tab Pemutaran dengan pratinjau impor yang siap digunakan; resep akan diterapkan setelah Anda mengonfirmasi impor.

Buka ikon pratinjau resep di menu tarik-turun untuk menyalin JSON atau membagikan URL impornya. Dari pratinjau yang sama, Anda dapat menghapus resep setelah mengonfirmasi. Pindahkan resep dengan tombol atas/bawah atau seret di menu tarik-turun. Pilihan akan mengikuti resep saat dipindahkan; menghapus resep yang dipilih akan menonaktifkan resep.

## Pintasan keyboard

Atur **Cycle through recipes forward**, **Cycle through recipes backwards**, dan **Toggle recipe #1** hingga **#10** di **Pintasan Keyboard > Pemutaran**. Mengaktifkan atau menonaktifkan resep yang sedang dipakai akan menonaktifkan resep. Perpindahan resep mengikuti urutan daftar dan mencakup **Nonaktif**. Pintasan pengaturan dan mode pemutaran menampilkan notifikasi saat resep aktif; edit atau nonaktifkan resep untuk mengubah pengaturan tersebut.

## Resep umum

Berikut beberapa resep prasetel yang berguna untuk kegiatan belajar umum. Jika memiliki resep yang ingin dibagikan atau memerlukan fitur yang belum tersedia untuk membuat resep yang tepat, Anda dapat memintanya di <a href={project.urls.discord}>Discord</a> atau <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Mode normal

Gunakan pengaturan pemutaran biasa tanpa mode belajar otomatis. Sebaiknya pengaturan di luar resep dibuat sesederhana mungkin agar `Nonaktif` berperilaku seperti pemutaran normal.

### Fokus dialog

Fokus pada dialog dengan menggabungkan pemutaran ringkas dan maju cepat. Lewati jeda dengan interval lompatan minimum 5 detik dan majukan jeda lain yang memenuhi syarat dengan kecepatan 3× dan interval minimum 1 detik. Sisakan konteks 150 ms di kedua sisi setiap jeda, sementara dialog diputar pada kecepatan pemutaran yang mendasarinya.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Maju cepat pada jeda

Tonton seluruh video sambil memajukan jeda yang memenuhi syarat dengan kecepatan 3× dan interval minimum 1 detik. Sisakan konteks 150 ms di kedua sisi setiap jeda, sementara dialog diputar pada kecepatan pemutaran yang mendasarinya.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Mode membaca

Jeda di awal setiap takarir untuk membaca dan mencari kata, lalu lanjutkan secara manual untuk mendengar audio dengan takarir tetap terlihat. Mengarahkan kursor ke takarir selama pemutaran juga menjeda video; menjauhkan kursor akan melanjutkannya.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Reading mode',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'manual',
      pauseOnHoverMode: 1,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Mode mendengarkan

Dengarkan tanpa takarir, lalu jeda otomatis di akhir setiap takarir untuk menampilkan teks dan memeriksa pemahaman Anda. Lanjutkan secara manual saat siap.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Listening mode',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'manual',
      subtitleVisibility: 'whilePaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Audio saja

Dengarkan terus-menerus dengan takarir tersembunyi selama pemutaran. Jeda secara manual untuk menampilkan takarir saat ini jika Anda memerlukan bantuan.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Audio only',
    playbackModes: [1],
    settings: {
      ...nonAnnotationPlaybackSettings,
      subtitleVisibility: 'whileManuallyPaused',
    },
  }}
/>

### Mendengarkan intensif

Dengarkan setiap takarir tiga kali dengan jeda 1 detik setelah setiap putaran. Takarir tetap tersembunyi pada dua putaran pertama dan muncul pada pengulangan terakhir untuk memeriksa pemahaman Anda. Pemutaran dilanjutkan otomatis setelah setiap jeda; sesuaikan durasi jeda 1 detik sesuai kebutuhan.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Intensive listening',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'fixed',
      autoPauseFixedDurationMs: 1000,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 2,
      repeatsBeforeShowingSubtitles: 2,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Mendengarkan dengan persiapan

Jeda di awal setiap takarir untuk membacanya dalam bahasa ibu Anda, tunggu hingga takarir menghilang, lalu dengarkan audio tanpa takarir. Waktu membaca adalah 80 ms per karakter, dengan minimum 1 detik dan maksimum 6 detik. Setelah teks menghilang, pemutaran tetap dijeda selama 500 ms sebelum dilanjutkan secara otomatis. Anda dapat menyesuaikan waktu ini saat mengedit resep.

Pilih trek yang digunakan untuk menghitung waktu membaca pada **Trek takarir yang terpengaruh oleh mode pemutaran dan pintasan keyboard**.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Primed listening',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 500,
      subtitleVisibility: 'whilePaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Membaca dengan suara lantang

Baca setiap takarir dengan suara lantang sebelum mendengarkan audio aslinya, lalu bandingkan pelafalan dan irama Anda. Pemutaran dijeda di awal dengan takarir terlihat dan dilanjutkan otomatis setelah 80 ms per karakter, dibatasi antara 1–6 detik. Setiap takarir diulang sekali. Sesuaikan waktu jeda agar Anda memiliki cukup waktu untuk berbicara.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Read aloud',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      repeatsBeforeShowingSubtitles: 0,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Membayangi ucapan

Berbicaralah bersama atau sedikit setelah audio asli, tirukan irama dan pelafalannya dengan takarir terlihat. Setiap takarir diulang sekali, dengan jeda 1 detik di akhir tiap putaran sebelum pemutaran dilanjutkan otomatis.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Shadowing',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'fixed',
      autoPauseFixedDurationMs: 1000,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      repeatsBeforeShowingSubtitles: 0,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Mengingat kembali

Dengarkan audio, lalu ucapkan kembali kalimat dari ingatan selama jeda otomatis di akhir kalimat. Takarir tersembunyi selama pemutaran dan jeda otomatis. Waktu berbicara adalah 80 ms per karakter, dibatasi antara 1–6 detik, dan setiap takarir diulang sekali. Sesuaikan waktu jeda sesuai kebutuhan; jeda secara manual saat pemutaran ulang untuk menampilkan teks jika Anda memerlukan bantuan.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Recall',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      subtitleVisibility: 'whileManuallyPaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

## Resep anotasi

Prasetel ini memerlukan [anotasi](./annotation.md) aktif karena menggunakan datanya. Jika memiliki resep yang ingin dibagikan atau memerlukan fitur yang belum tersedia untuk membuat resep yang tepat, Anda dapat memintanya di <a href={project.urls.discord}>Discord</a> atau <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Muat takarir bahasa sasaran sebagai **Trek 1**. Prasetel ini menggunakan trek tersebut untuk pemutaran dan pemilihan kata. **Belum dikenal** berarti **Belum dikumpulkan** atau **Tidak diketahui**. Preferensi tampilan anotasi lain, seperti bacaan dan warna, menggunakan pengaturan yang mendasarinya.

### Membantu kata yang belum dikenal

Tonton dengan takarir terlihat. Jika suatu baris berisi kata yang belum dikenal, jeda selama 1 detik di akhir baris lalu putar ulang sekali. Baris lain diputar tanpa jeda. Kata pertama yang belum dikenal dipilih selama jeda agar dapat dicari. Sesuaikan durasi jeda jika Anda memerlukan waktu lebih lama.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word rescue',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        selectOnPause: annotationPlaybackSelection([0, 1]),
      }),
    },
  }}
/>

### Menambang i+1

Fokus pada takarir yang berisi tepat satu token berstatus Belum dikumpulkan. Pemutaran ringkas melompati jeda di antara baris yang memenuhi syarat. Pemutaran dijeda di akhir setiap baris sampai Anda melanjutkannya secara manual, dan token Belum dikumpulkan dipilih untuk diperiksa atau ditambang.

Fitur ini menemukan kandidat i+1, tetapi tidak menjamin bahwa semua kata lainnya diketahui: sebuah baris juga dapat berisi kata Tidak diketahui, dan setiap kemunculan kata Belum dikumpulkan yang sama dihitung terpisah. Penambangan tetap dilakukan secara manual.

<RecipePreset
  recipe={{
    name: 'i+1 mining',
    playbackModes: [2, 3],
    settings: {
      ...annotationPlaybackSettings({
        autoPause: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        condensed: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        selectOnPause: annotationPlaybackSelection([0]),
      }),
      autoPausePreference: 2,
      autoPauseResumeMode: 'manual',
      subtitleVisibility: 'whenDue',
      streamingCondensedPlaybackMinimumSkipIntervalMs: 0,
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
      subtitleTriggerGapStartOffset: 0,
      subtitleTriggerGapEndOffset: 0,
    },
  }}
/>

### Petunjuk kata yang belum dikenal

Dengarkan dengan kata yang belum dikenal terlihat dan kata yang sudah dikenal tersembunyi. Baris yang berisi kata belum dikenal dijeda selama 1 detik di akhir sehingga seluruh teks terlihat, lalu diputar ulang sekali dengan petunjuk ditampilkan kembali. Kata pertama yang belum dikenal dipilih selama jeda agar dapat dicari. Baris tanpa kata yang belum dikenal tidak menampilkan takarir jika semua kata berhasil dikenali.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word hints',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        selectOnPause: annotationPlaybackSelection([0, 1]),
        wordVisibility: {
          ...annotationPlaybackRule([0, 1]),
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### Isian rumpang untuk kata yang belum dikenal

Baca bagian takarir yang sudah dikenal sementara kata yang belum dikenal disembunyikan, lalu coba lengkapi kata yang hilang berdasarkan audio dan konteks. Baris yang berisi kata belum dikenal dijeda selama 1 detik di akhir untuk menampilkan seluruh teks, lalu diputar ulang sekali dengan bagian rumpang ditampilkan kembali. Kata yang diabaikan tetap terlihat.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word cloze',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        wordVisibility: {
          ...annotationPlaybackRule([2, 3, 4, 5]),
          onStates: [{ enabled: true }],
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### Tempo mendengarkan adaptif

Putar dialog pada kecepatan 1× saat perkiraan pemahaman 60% atau lebih rendah, lalu tingkatkan bertahap hingga 1,8× pada 100%. Pemutaran ringkas melompati jeda dengan interval minimum 1 detik dan menyisakan konteks 150 ms di kedua sisinya. Jeda yang memenuhi syarat tetapi tersisa diputar pada kecepatan 1,8×.

Sesuaikan kecepatan dasar dan maju cepat saat mengedit resep; pertahankan kecepatan maju cepat lebih tinggi daripada kecepatan dasar.

<RecipePreset
  recipe={{
    name: 'Adaptive listening pace',
    playbackModes: [2, 4],
    settings: {
      ...annotationPlaybackSettings({ fastForward: { rateByComprehension: { enabled: true } } }),
      playbackRate: 1,
      fastForwardModePlaybackRate: 1.8,
      fastForwardPlaybackMinimumSkipIntervalMs: 1000,
      streamingCondensedPlaybackMinimumSkipIntervalMs: 1000,
      subtitleTriggerGapStartOffset: 150,
      subtitleTriggerGapEndOffset: -150,
    },
  }}
/>
