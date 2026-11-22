---
sidebar_position: 1.5
title: Recipes
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

# Ricette

Le ricette combinano modalità e impostazioni di riproduzione, così puoi passare da un'attività di apprendimento all'altra. Seleziona una ricetta in **Impostazioni > Riproduzione**, accanto alle modalità di riproduzione nei controlli del lettore o nell'interfaccia mobile in sovrimpressione. Seleziona **Disattivato** per tornare alle impostazioni di base. Quando una ricetta è attiva, le impostazioni di riproduzione salvate, la velocità di riproduzione memorizzata e le modalità memorizzate vengono mantenute.

## Creare e modificare una ricetta

Nella scheda Riproduzione, seleziona **Modifica ricetta**. Se è selezionata una ricetta, parti da quella; altrimenti, parti dalle impostazioni di riproduzione correnti. Scegli le modalità di riproduzione e modifica le impostazioni da includere. Le modifiche restano in una bozza e non influiscono sulla riproduzione finché non le salvi.

Seleziona **Salva ricetta** per rivedere le impostazioni e inserire un nome di massimo 100 caratteri. Puoi rimuovere singole impostazioni dall'anteprima; quelle omesse useranno le impostazioni di base. Le modalità di riproduzione sono sempre indicate come combinazione completa.

Quando modifichi una ricetta esistente, se lasci invariato il nome la aggiorni. Se inserisci del testo nel campo del nome, crei una nuova ricetta, anche se poi ripristini il nome originale. Seleziona **Annulla** per eliminare la bozza.

## Importare e condividere

Seleziona **Importa ricetta**, incolla il JSON della ricetta, rivedi le impostazioni e conferma. Prima dell'importazione puoi modificare il nome e rimuovere alcune impostazioni. Le ricette importate vengono aggiunte alla fine dell'elenco e selezionate. Le impostazioni sconosciute e i valori non validi vengono ignorati. Il nome e le modalità di riproduzione devono essere validi.

Puoi anche aprire un link di importazione. Si apre l'app web con la scheda Riproduzione e l'anteprima dell'importazione già pronte; la ricetta viene applicata dopo aver confermato l'importazione.

Apri l'icona di anteprima di una ricetta nel menu a discesa per copiarne il JSON o condividere il link di importazione. Dalla stessa anteprima puoi eliminare la ricetta dopo aver confermato. Sposta le ricette con i pulsanti su/giù o trascinandole nel menu a discesa. Quando sposti una ricetta, la selezione la segue; se elimini quella selezionata, le ricette vengono disattivate.

## Scorciatoie da tastiera

Configura **Passa alla ricetta successiva**, **Passa alla ricetta precedente** e **Attiva/disattiva ricetta da 1** a **10** in **Scorciatoie da tastiera > Riproduzione**. Attivare o disattivare la ricetta corrente disattiva le ricette. Lo scorrimento segue l'ordine dell'elenco e include **Disattivato**. Quando una ricetta è attiva, le scorciatoie per le impostazioni e le modalità di riproduzione mostrano una notifica; per modificare quelle impostazioni, modifica o disattiva la ricetta.

## Ricette comuni

Di seguito trovi alcune ricette preimpostate utili per le attività di apprendimento più comuni. Se vuoi condividere una ricetta o ti serve una funzione per crearne una adatta alle tue esigenze, puoi richiederla su <a href={project.urls.discord}>Discord</a> o su <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Modalità normale

Usa le impostazioni di riproduzione abituali senza una modalità di apprendimento automatica. Ti consigliamo di mantenere semplici le impostazioni non incluse nelle ricette, così **Disattivato** corrisponderà al comportamento di riproduzione normale.

### Concentrarsi sui dialoghi

Concentrati sui dialoghi combinando la riproduzione condensata e l'avanzamento rapido. Salta gli intervalli vuoti con un intervallo minimo di 5 secondi e fai avanzare rapidamente a 3× i restanti intervalli idonei, con un intervallo minimo di 1 secondo. Mantieni 150 ms di contesto ai lati di ogni intervallo; i dialoghi vengono riprodotti alla velocità di base.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Avanzamento rapido negli intervalli

Guarda l'intero video facendo avanzare rapidamente a 3× gli intervalli idonei, con un intervallo minimo di 1 secondo. Mantieni 150 ms di contesto ai lati di ogni intervallo; i dialoghi vengono riprodotti alla velocità di base.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Modalità lettura

Metti in pausa all'inizio di ogni sottotitolo per leggerlo e cercare le parole, poi riprendi manualmente per ascoltare l'audio con i sottotitoli visibili. Durante la riproduzione, anche passare il puntatore sui sottotitoli mette in pausa il video; allontanandolo, la riproduzione riprende.

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

### Modalità ascolto

Ascolta senza sottotitoli, poi metti automaticamente in pausa alla fine di ciascuno per mostrare il testo e verificare quanto hai capito. Quando vuoi, riprendi manualmente.

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

### Solo audio

Ascolta senza interruzioni, mantenendo i sottotitoli nascosti durante la riproduzione. Metti in pausa manualmente per mostrare il sottotitolo corrente quando ti serve aiuto.

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

### Ascolto intensivo

Ascolta ogni sottotitolo tre volte, con una pausa di 1 secondo dopo ogni riproduzione. I sottotitoli restano nascosti nelle prime due ripetizioni e appaiono nell'ultima per verificare quanto hai capito. La riproduzione riprende automaticamente dopo ogni pausa; puoi personalizzare la durata della pausa di 1 secondo.

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

### Ascolto preparato

Metti in pausa all'inizio di ogni sottotitolo per leggerlo nella tua lingua madre. Poi, quando scompare, ascolta l'audio senza sottotitoli. Il tempo di lettura è di 80 ms per carattere, con un minimo di 1 secondo e un massimo di 6 secondi. Dopo che il testo scompare, la riproduzione resta in pausa per altri 500 ms prima di riprendere automaticamente. Puoi modificare questi tempi mentre modifichi la ricetta.

In **Tracce dei sottotitoli interessate dalle modalità di riproduzione e dalle scorciatoie da tastiera**, scegli le tracce da usare per calcolare il tempo di lettura.

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

### Lettura ad alta voce

Leggi ogni sottotitolo ad alta voce prima di ascoltare l'audio originale, quindi confronta la pronuncia e il ritmo. La riproduzione si mette in pausa all'inizio con i sottotitoli visibili e riprende automaticamente dopo 80 ms per carattere, con un intervallo da 1 a 6 secondi. Ogni sottotitolo viene ripetuto una volta. Regola i tempi di pausa per avere abbastanza tempo per parlare.

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

### Ripetizione in contemporanea

Parla insieme all'audio originale o con un leggero ritardo, seguendone il ritmo e la pronuncia con i sottotitoli visibili. Ogni sottotitolo viene ripetuto una volta; al termine di ogni riproduzione viene inserita una pausa di 1 secondo prima che la riproduzione riprenda automaticamente.

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

### Richiamo

Ascolta l'audio, poi ripeti la battuta a memoria ad alta voce durante la pausa automatica alla fine. I sottotitoli restano nascosti durante la riproduzione e le pause automatiche. Il tempo per parlare è di 80 ms per carattere, con un intervallo da 1 a 6 secondi; ogni sottotitolo viene ripetuto una volta. Regola i tempi di pausa secondo necessità; durante una ripetizione, metti in pausa manualmente per mostrare il testo se ti serve aiuto.

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

## Ricette con annotazioni

Queste ricette richiedono che le [annotazioni](./annotation.md) siano attive, perché usano i relativi dati. Se vuoi condividere una ricetta o ti serve una funzione per crearne una adatta alle tue esigenze, puoi richiederla su <a href={project.urls.discord}>Discord</a> o su <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Carica i sottotitoli nella lingua che stai imparando come **Traccia 1**. Queste ricette usano tale traccia per la riproduzione e la selezione delle parole. **Non familiare** significa **Non raccolto** o **Sconosciuto**. Le altre preferenze di visualizzazione delle annotazioni, come letture e colori, usano le impostazioni di base.

### Recupero delle parole non familiari

Guarda con i sottotitoli visibili. Se una battuta contiene una parola non familiare, metti in pausa per 1 secondo alla fine e poi riproducila di nuovo una volta. Le altre battute proseguono senza interruzioni. Durante la pausa viene selezionata la prima parola non familiare per cercarne il significato. Se ti serve più tempo, regola la durata della pausa.

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

### Estrazione i+1

Concentrati sui sottotitoli che contengono esattamente una parola non raccolta. La riproduzione condensata salta da una battuta idonea all'altra e si mette in pausa alla fine di ogni battuta finché non riprendi manualmente; durante la pausa seleziona la parola non raccolta per esaminarla o estrarla.

Questa ricetta individua possibili frasi i+1, ma non garantisce che tutte le altre parole siano conosciute: una battuta può contenere anche parole sconosciute e le occorrenze ripetute della stessa parola non raccolta vengono conteggiate separatamente. L'estrazione resta un'azione manuale.

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

### Suggerimenti per le parole non familiari

Ascolta con le parole non familiari visibili e quelle familiari nascoste. Le battute con parole non familiari si fermano per 1 secondo alla fine, mostrando il testo completo, poi vengono riprodotte di nuovo una volta con i suggerimenti ripristinati. Durante la pausa viene selezionata la prima parola non familiare per cercarne il significato. Se la tokenizzazione è completa, le battute senza parole non familiari non mostrano sottotitoli.

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

### Completamento delle parole non familiari

Leggi le parti familiari di ogni sottotitolo mentre le parole non familiari restano nascoste e prova a ricostruire le parole mancanti dall'audio e dal contesto. Le battute con parole non familiari si fermano per 1 secondo alla fine per mostrare il testo completo, poi vengono riprodotte di nuovo una volta con gli spazi vuoti ripristinati. Le parole ignorate restano visibili.

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

### Ritmo di ascolto adattivo

Riproduci i dialoghi a 1× quando la comprensione stimata è pari o inferiore al 60%; aumenta gradualmente la velocità fino a 1,8× al 100%. La riproduzione condensata salta gli intervalli vuoti con un intervallo minimo di 1 secondo, mantenendo 150 ms di contesto ai lati. Gli intervalli idonei rimanenti vengono riprodotti a 1,8×.

Quando modifichi la ricetta, regola le velocità di base e di avanzamento rapido, mantenendo quest'ultima più alta della velocità di base.

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
