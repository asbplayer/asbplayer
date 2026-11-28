---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Impostazioni {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### URL di AnkiConnect {#ankiconnect-url}

URL del server AnkiConnect, eseguito come add-on all'interno di Anki.

### Chiave API di AnkiConnect {#ankiconnect-api-key}

Chiave API configurata in AnkiConnect quando è attiva la protezione tramite chiave API.

### Aggiornare il browser delle carte Anki dopo aver modificato le carte {#refresh-anki-card-browser}

Se attiva, aggiorna il browser delle carte Anki aperto dopo che asbplayer modifica una carta, così i campi mostrano i valori correnti. La finestra del browser delle carte potrebbe passare in primo piano. Questa impostazione è disattivata per impostazione predefinita.

### Mazzo {#deck}

Mazzo Anki a cui vengono inviate le carte.

### Tipo di nota {#note-type}

Tipo di nota Anki da usare per le carte. Un tipo di nota definisce un «modello» e una «visualizzazione» per le carte: più precisamente, un insieme di campi e un modello HTML che stabilisce come mostrarli sul fronte e sul retro della carta.

### Campi della carta {#card-fields}

Ogni impostazione dei campi della carta determina quale contenuto viene associato a ciascun campo del tipo di nota configurato. L’**etichetta del campo** — Frase, Definizione, Parola, Immagine, Audio o URL — indica il **contenuto**, mentre il **valore del campo** indica il **campo nel tipo di nota**.

I campi appaiono nella **finestra di esportazione Anki** nello stesso ordine delle impostazioni. Puoi modificarlo dal **menu ⋮** → **Sposta giù** o **Sposta su**.

| Campo                 | Contenuto                                          |
| --------------------- | -------------------------------------------------- |
| Frase (tutte le tracce) | Tutti i sottotitoli al momento dell’estrazione     |
| Definizione            | Definizione della parola inserita dall’utente      |
| Parola                 | Parola inserita dall’utente                        |
| Audio                 | Audio registrato dalla sorgente video              |
| Image                 | Screenshot della sorgente video                    |
| Sorgente               | Nome del file dei sottotitoli o del video e marca temporale |
| URL                   | URL corrente se la carta è stata estratta da un video in streaming |
| Traccia sottotitoli 1  | Sottotitoli della traccia 1 al momento dell’estrazione |
| Traccia sottotitoli 2  | Sottotitoli della traccia 2 al momento dell’estrazione |
| Traccia sottotitoli 3  | Sottotitoli della traccia 3 al momento dell’estrazione |
| Campi personalizzati  | Valori inseriti dall’utente                        |

### Tag {#tags}

Tag predefiniti da aggiungere a ogni carta.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Estrazione</a> {#mining}

### Azione predefinita del pulsante di estrazione {#mining-button-default-action}

Il «pulsante di estrazione» <NoteAddIcon/> è il pulsante più a sinistra nell’**interfaccia in sovrimpressione** e quello accanto ai sottotitoli nell’**elenco dei sottotitoli**. Questa impostazione definisce l’azione di entrambi.

| Impostazione           | Comportamento                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mostra finestra Anki   | Registra il sottotitolo selezionato nella cronologia di estrazione e mostra la **finestra di esportazione Anki**                            |
| Aggiorna ultima carta  | Registra il sottotitolo selezionato nella cronologia di estrazione e aggiorna l’ultima carta del mazzo configurato con il contesto di asbplayer: tutti i campi tranne definizione, parola e campi personalizzati inseriti dall’utente |
| Mostra finestra di aggiornamento | Registra il sottotitolo selezionato nella cronologia di estrazione e mostra la finestra per aggiornare l’ultima carta con il contesto di asbplayer |
| Esporta carta          | Registra il sottotitolo selezionato nella cronologia di estrazione ed esporta una carta _solo_ con il contesto di asbplayer: tutti i campi tranne definizione, parola e campi personalizzati inseriti dall’utente |
| Nessuna                | Registra il sottotitolo selezionato nella cronologia di estrazione                                                                                                                                   |

### Stato di riproduzione dopo l’estrazione {#post-mining-playback-state}

Configura lo stato di riproduzione desiderato dopo un’azione di estrazione.

### Copiare negli appunti i sottotitoli estratti {#copy-mined-subtitles-to-clipboard}

Se attiva, copia negli appunti il sottotitolo selezionato ogni volta che viene avviata un’azione di estrazione.

### Usare sempre il testo dei sottotitoli nel campo della frase {#always-use-subtitle-text-for-sentence-field}

Se attiva, inserisce nel campo Sentence il testo estratto da tutte le tracce, anche se un’applicazione esterna fornisce un testo diverso. È utile quando [crei carte con Yomitan](../guides/one-click-mining.md).

### Quando aggiorni l’ultima carta, aggiorna anche la frase delle carte con lo stesso testo dei sottotitoli {#update-sentence-for-cards-with-the-same-subtitle-text}

Se attiva, l’azione di estrazione **Aggiorna l'ultima carta** sostituisce anche il campo Frase e i campi Traccia sottotitoli 1–3 configurati nelle note create consecutivamente la cui frase esistente corrisponde a quella esportata. L’aggiornamento cerca di mantenere le evidenziazioni di ogni nota. I campi delle tracce senza testo esportato restano invariati. Se un campo dei sottotitoli condivide un campo Anki con un campo non relativo ai sottotitoli, come Definizione, l’aggiornamento della frase lascia quel campo invariato nelle note precedenti.

Questa impostazione copia la frase selezionata per l’esportazione corrente. Attiva [**Usa sempre il testo dei sottotitoli per il campo Frase**](#always-use-subtitle-text-for-sentence-field) per usare il testo completo dei sottotitoli estratti. L’[aggiornamento di immagine e audio](#update-all-cards-with-the-same-subtitle-text) è indipendente.

La corrispondenza usa il campo Frase principale, ignora il markup della frase e accetta che una frase sia contenuta nell’altra. Quindi una nota che contiene solo la prima riga può corrispondere a un sottotitolo completo. La ricerca include le note aggiunte negli ultimi due giorni Anki e si interrompe alla prima frase diversa o mancante. Per aggiornare i campi delle tracce è necessario configurare un campo frase e avere una frase esportata non vuota. Questa impostazione è disattivata per impostazione predefinita e non influisce sugli aggiornamenti di una carta selezionata in modo specifico.

### Quando aggiorni l’ultima carta, aggiorna anche l’immagine e l’audio delle carte con lo stesso testo dei sottotitoli {#update-all-cards-with-the-same-subtitle-text}

Se attiva, l’azione di estrazione **Aggiorna l'ultima carta** aggiorna anche i campi audio e immagine delle note create consecutivamente dalla stessa riga di sottotitoli. Ogni nota precedente mantiene la parola, la definizione e i campi personalizzati. I campi dei sottotitoli restano invariati, a meno che non sia attivo anche l’[aggiornamento della frase](#update-sentence-for-cards-with-the-same-subtitle-text). La corrispondenza ignora il markup della frase e consente che la frase faccia parte del contesto dei sottotitoli estratto.

La ricerca include le note aggiunte negli ultimi due giorni Anki e si interrompe alla prima frase diversa o mancante. È necessario configurare un campo frase e la frase esportata deve contenere testo, non solo spazi o markup. Questa impostazione è disattivata per impostazione predefinita e non influisce sugli aggiornamenti di una carta selezionata in modo specifico.

### Riprodurre l’audio durante la registrazione da un video locale {#play-audio-while-recording-from-local-video}

asbplayer usa l’API [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) integrata nel browser per registrare l’audio dai file video locali. Questa impostazione definisce se l’audio deve essere riprodotto durante la registrazione.

### Ricodificare l’audio in mp3 {#re-encode-audio-as-mp3}

Per impostazione predefinita, l’audio registrato non viene codificato come `mp3`. Questa impostazione lo ricodifica in `mp3`. In genere non c’è motivo di disattivarla, soprattutto se vuoi rivedere le carte su iOS.

### Margine audio iniziale {#audio-padding-start}

Quanti millisecondi **prima** del sottotitolo selezionato iniziare a registrare l’audio.

### Margine audio finale {#audio-padding-end}

Quanti millisecondi **dopo** il sottotitolo selezionato interrompere la registrazione audio.

### Formato di acquisizione dell’immagine (solo sito web) {#image-capture-format}

Specifica il formato di acquisizione delle immagini per le carte estratte. È disponibile solo sul sito web per i file video locali; l’unica opzione aggiuntiva è «video clip».

### Larghezza/altezza massima di acquisizione {#max-capture-dimensions}

Larghezza/altezza massima degli screenshot in pixel. `0` significa «nessun limite».

### Ritagliare le bande nere dagli screenshot {#trim-black-bars-from-screenshots}

Se attiva, ritaglia le bande nere dovute al letterboxing negli screenshot.

### Taglio iniziale/finale del clip {#clip-trim-start-end}

Specifica quanto tempo rimuovere dall’inizio e dalla fine dell’intervallo di un sottotitolo per determinare l’intervallo predefinito del video clip. È disponibile solo se è selezionato il formato di acquisizione video clip.

### Durata massima del clip {#max-clip-length}

Specifica la durata massima del video clip. È disponibile solo se è selezionato il formato di acquisizione video clip.

### Ritardo di acquisizione dello screenshot {#screenshot-capture-delay}

Quanto attendere dopo la comparsa del sottotitolo selezionato prima di acquisire lo screenshot.

### Numero massimo di sottotitoli circostanti {#surrounding-subtitles-count-radius}

In fondo alla **finestra di esportazione Anki** è presente un cursore per regolare l’intervallo di tempo selezionato. Include i sottotitoli circostanti come contesto aggiuntivo. Questa impostazione limita il numero di sottotitoli circostanti.

### Intervallo temporale dei sottotitoli circostanti {#surrounding-subtitles-time-radius}

In fondo alla **finestra di esportazione Anki** è presente un cursore per regolare l’intervallo di tempo selezionato. Include i sottotitoli circostanti come contesto aggiuntivo. Questa impostazione limita l’intervallo di tempo ammesso intorno al sottotitolo selezionato per includere quelli circostanti.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Aspetto dei sottotitoli</a> {#subtitle-appearance}

### Traccia dei sottotitoli {#subtitle-appearance-track}

asbplayer può caricare più tracce di sottotitoli contemporaneamente. Questo menu a discesa seleziona le tracce a cui si applicano le impostazioni seguenti. Per impostazione predefinita è selezionato «Tutte». Se modifichi un’impostazione di aspetto mentre è selezionato «Tutte», la modifica si applica a tutte le tracce. Quando imposti un valore specifico per una traccia, l’impostazione scompare dalla pagina «Tutte».

### Anteprima dei sottotitoli {#subtitle-preview}

Visualizza in anteprima e modifica il testo dei sottotitoli usato per mostrare l’effetto delle impostazioni di aspetto.

### Stile {#styling}

| Impostazione                     | Descrizione                                                                          | Proprietà CSS               |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Colore dei sottotitoli           | Colore                                                                               | `color`                     |
| Dimensione dei sottotitoli       | Dimensione in `px`                                                                   | `font-size`                 |
| Spessore del carattere           | Spessore del carattere                                                               | `font-weight`               |
| Colore del contorno              | Colore del tratto                                                                    | `-webkit-text-stroke-color` |
| Spessore del contorno            | Spessore del tratto                                                                  | `-webkit-text-stroke-width` |
| Colore dell’ombra                | Colore dell’ombra                                                                    | `text-shadow`               |
| Spessore dell’ombra              | Spessore dell’ombra                                                                  | `text-shadow`               |
| Colore dello sfondo              | Colore dello sfondo                                                                  | `background-color`          |
| Opacità dello sfondo             | Opacità dello sfondo                                                                 | `background`                |
| Famiglia del carattere           | Carattere. Se è consentito l’accesso ai font locali, appare un menu con quelli disponibili. | `font-family`          |
| CSS:\<style key\>                | Valore di qualsiasi proprietà CSS personalizzata aggiunta dal menu **Aggiungi CSS personalizzato**. | Proprietà personalizzata |
| Sfocatura dei sottotitoli        | Applica una sfocatura ai sottotitoli. Al passaggio del puntatore, la sfocatura viene rimossa. | `filter:blur(...)` |
| Fattore di scala dei sottotitoli basati su immagini | Ridimensiona i sottotitoli basati su immagini. | — |

### Layout {#layout}

| Impostazione                        | Descrizione                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Allineamento dei sottotitoli        | Stabilisce se posizionare i sottotitoli in alto o in basso nell’elemento video. |
| Scostamento dal bordo inferiore     | Distanza dal bordo inferiore dell’elemento video per tutte le tracce posizionate in basso. |
| Scostamento dal bordo superiore    | Distanza dal bordo superiore dell’elemento video per tutte le tracce posizionate in alto. |
| Larghezza dei sottotitoli            | Larghezza del contenitore dei sottotitoli, in `%` o pixel.                  |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Scorciatoie da tastiera</a> {#keyboard-shortcuts}

Puoi usare le scorciatoie da tastiera per accedere alla maggior parte delle funzioni di asbplayer.

### <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Sottotitoli</a> scorciatoie da tastiera {#subtitles-keyboard-shortcuts}

| Azione                               | Scorciatoia predefinita |
| ------------------------------------ | ---------------- |
| Seleziona le tracce di sottotitoli da caricare. | Ctrl + Shift + F |
| Mostra/Nascondi sottotitoli          | ↓                |
| Mostra/Nascondi traccia 1 nel video  | 1                |
| Mostra/Nascondi traccia 2 nel video  | 2                |
| Mostra/Nascondi traccia 3 nel video  | 3                |
| Mostra/Nascondi traccia 1 in asbplayer | W + 1            |
| Mostra/Nascondi traccia 2 in asbplayer | W + 2            |
| Mostra/Nascondi traccia 3 in asbplayer | W + 3            |
| Rimuovi sfocatura dalla traccia 1 in asbplayer | B + 1            |
| Rimuovi sfocatura dalla traccia 2 in asbplayer | B + 2            |
| Rimuovi sfocatura dalla traccia 3 in asbplayer | B + 3            |
| Sposta in alto i sottotitoli inferiori |                  |
| Sposta in basso i sottotitoli inferiori |                  |
| Sposta in alto i sottotitoli superiori |                  |
| Sposta in basso i sottotitoli superiori |                  |
| Copia il sottotitolo corrente |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Estrazione</a> scorciatoie da tastiera {#mining-keyboard-shortcuts}

| Azione                                                                              | Scorciatoia predefinita     |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Estrai il sottotitolo corrente                                                     | Ctrl + Shift + Z (sito web) |
| Estrai il sottotitolo corrente e apri la finestra di dialogo Anki                   | Ctrl + Shift + X           |
| Aggiorna l’ultima carta Anki con screenshot, audio e altro acquisiti da asbplayer   | Ctrl + Shift + U           |
| Esporta una carta in Anki senza aprire la finestra di dialogo                       |                            |
| Acquisisci manualmente uno screenshot al posto di quello automatico durante l’estrazione | Ctrl + Shift + V (sito web) |
| Avvia/interrompi manualmente la registrazione audio, anche se è caricato un file di sottotitoli | Ctrl + Shift + R (sito web) |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Riproduzione</a> scorciatoie da tastiera {#playback-keyboard-shortcuts}

| Azione                          | Scorciatoia predefinita |
| ------------------------------- | ---------------- |
| Mostra/Nascondi pannello laterale | \`             |
| Riproduci/Metti in pausa         | Space            |
| Attiva/Disattiva pausa automatica | Shift + P       |
| Attiva/Disattiva riproduzione condensata | Shift + O |
| Attiva/Disattiva avanzamento rapido | Shift + F     |
| Attiva/Disattiva modalità di ripetizione | Shift + R |
| Attiva/Disattiva la visualizzazione dei sottotitoli |                  |
| Scorri le modalità di ripresa dopo la pausa automatica |                  |
| Passa alla ricetta successiva   |                  |
| Passa alla ricetta precedente  |                  |
| Attiva/Disattiva ricetta 1      |                  |
| Attiva/Disattiva ricetta 2      |                  |
| Attiva/Disattiva ricetta 3      |                  |
| Attiva/Disattiva ricetta 4      |                  |
| Attiva/Disattiva ricetta 5      |                  |
| Attiva/Disattiva ricetta 6      |                  |
| Attiva/Disattiva ricetta 7      |                  |
| Attiva/Disattiva ricetta 8      |                  |
| Attiva/Disattiva ricetta 9      |                  |
| Attiva/Disattiva ricetta 10     |                  |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Ricerca</a> scorciatoie da tastiera {#seek-keyboard-shortcuts}

| Azione                                                                    | Scorciatoia predefinita |
| ------------------------------------------------------------------------- | ---------------- |
| Torna indietro (3 secondi per impostazione predefinita, [configurabili](#seek-interval-seconds)) | A |
| Avanza (3 secondi per impostazione predefinita, [configurabili](#seek-interval-seconds)) | D |
| Vai al sottotitolo precedente                                              | ←                |
| Vai al sottotitolo successivo                                              | →                |
| Vai all’inizio del sottotitolo corrente/precedente                         | ↑                |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Velocità di riproduzione</a> scorciatoie da tastiera {#playback-rate-keyboard-shortcuts}

| Azione                 | Scorciatoia predefinita |
| ---------------------- | ---------------- |
| Aumenta la velocità di riproduzione | Ctrl + Shift + ] |
| Riduci la velocità di riproduzione  | Ctrl + Shift + [ |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Scostamento dei sottotitoli</a> scorciatoie da tastiera {#subtitle-offset-keyboard-shortcuts}

| Azione                                                                   | Scorciatoia predefinita |
| ------------------------------------------------------------------------ | ---------------- |
| Regola lo scostamento dei sottotitoli per allineare il precedente alla marca temporale corrente | Ctrl + ← |
| Regola lo scostamento dei sottotitoli per allineare il successivo alla marca temporale corrente | Ctrl + → |
| Aumenta lo scostamento dei sottotitoli di 100 ms                           | Ctrl + Shift + ← |
| Riduci lo scostamento dei sottotitoli di 100 ms                            | Ctrl + Shift + → |
| Reimposta lo scostamento dei sottotitoli                                   | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotazioni</a> scorciatoie da tastiera {#annotation-keyboard-shortcuts}

| Azione                            | Scorciatoia predefinita |
| --------------------------------- | ---------------- |
| Apri le statistiche                 | Q + S            |
| Vai alla parola successiva           | Q + E            |
| Vai alla parola precedente           | Q + W            |
| Imposta la parola sotto il puntatore su Maturo | Q + 5 |
| Vai alla parola Maturo successiva |                  |
| Vai alla parola Maturo precedente |                  |
| Imposta la parola sotto il puntatore su Giovane | Q + 4 |
| Vai alla parola Giovane successiva |                  |
| Vai alla parola Giovane precedente |                  |
| Imposta la parola sotto il puntatore su Progredito | Q + 3 |
| Vai alla parola Progredito successiva |                  |
| Vai alla parola Progredito precedente |                  |
| Imposta la parola sotto il puntatore su In apprendimento | Q + 2 |
| Vai alla parola In apprendimento successiva |                  |
| Vai alla parola In apprendimento precedente |                  |
| Imposta la parola sotto il puntatore su Sconosciuto | Q + 1 |
| Vai alla parola Sconosciuto successiva |                  |
| Vai alla parola Sconosciuto precedente |                  |
| Imposta la parola sotto il puntatore su Non raccolto | Q + 0 |
| Vai alla parola Non raccolto successiva |                  |
| Vai alla parola Non raccolto precedente |                  |
| Attiva/disattiva lo stato Ignorato per la parola sotto il puntatore | Q + I |
| Vai alla parola Ignorato successiva |                  |
| Vai alla parola Ignorato precedente |                  |

### Intervallo di ricerca (secondi) {#seek-interval-seconds}

Controlla l’intervallo usato dalle [scorciatoie da tastiera per la ricerca](#seek-keyboard-shortcuts).

### Riprodurre sempre dopo aver usato «Vai all’inizio del sottotitolo corrente/precedente» {#always-play-on-subtitle-seek}

Invece di mantenere lo stato di riproduzione corrente, avvia sempre la riproduzione quando usi la [scorciatoia da tastiera per la ricerca](#seek-keyboard-shortcuts) che va all’inizio del sottotitolo corrente/precedente. Ti fa risparmiare la pressione di un tasto.

### Incremento di regolazione della velocità di riproduzione {#playback-speed-adjust-step}

Incremento usato dalle [scorciatoie da tastiera](#playback-rate-keyboard-shortcuts) «Aumenta/Riduci la velocità di riproduzione».

### Scorciatoie dell’estensione {#extension-shortcuts}

Quando è installata l’estensione per browser, alcune scorciatoie di estrazione (ad es. estrai il sottotitolo corrente, estrai il sottotitolo corrente e apri la finestra Anki) sono implementate come comandi del browser anziché come normali listener degli eventi da tastiera. Puoi modificarle solo nell’editor delle scorciatoie delle estensioni del browser.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Gestisci scorciatoie estensioni`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotazioni</a> {#annotation}

### Browser delle parole {#word-browser}

:::info
Puoi modificare o eliminare solo le parole locali; le fonti esterne sono di sola lettura e possono essere aggiornate solo tramite la [sincronizzazione](#re-build-anki-word-database).
:::

Apre il browser delle parole, dove puoi visualizzare e gestire tutte le parole presenti nel database locale e in quello sincronizzato con Anki.

:::tip
Puoi cercare le parole in qualsiasi sistema di scrittura della lingua (ad es. romaji, hiragana, katakana o kanji per il giapponese).

Vengono applicate automaticamente anche alcune sostituzioni comuni per migliorare l’esperienza d’uso, come `e -> é` o `ss -> ß`.
:::

### Importare parole {#import-words}

Importa parole nel **database locale delle parole** di asbplayer.

Le parole importate sono considerate locali e hanno la precedenza sulle fonti esterne nel determinare lo stato della parola.

La finestra di importazione permette di incollare testo qualsiasi (asbplayer lo suddivide in parole) e di importare file esportati in precedenza.

:::tip
Puoi passare il puntatore sulle parole e usare le [scorciatoie da tastiera per le annotazioni](#annotation-keyboard-shortcuts) per modificarne localmente lo stato.
:::

### Esportare parole {#export-words}

Esporta il database locale delle parole per farne una copia di backup, trasferirlo su un altro dispositivo o condividerlo tra il sito web e l’estensione.

### Ricostruire il database delle parole Anki {#re-build-anki-word-database}

Crea o ricrea la cache locale delle informazioni sullo stato delle parole ottenute da Anki.

:::tip
La cache viene aggiornata automaticamente anche durante la riproduzione, se una traccia è attiva e Anki è raggiungibile.

Questo pulsante è disattivato se le impostazioni delle annotazioni non [usano l’integrazione con Anki](../common-issues.md#enable-or-disable-annotation-for-a-track).

Per cancellare le voci Anki dal database delle parole di una traccia, [segui questi passaggi](../common-issues.md#clear-anki-word-database).
:::

### Ricostruire il database delle parole WaniKani {#re-build-wanikani-word-database}

Crea o ricrea la cache locale delle informazioni sul vocabolario ottenute da WaniKani.

:::tip
La cache viene aggiornata automaticamente anche durante la riproduzione, se una traccia è attiva e hai configurato un token.

Questo pulsante è disattivato se le impostazioni delle annotazioni non [usano l’integrazione con WaniKani](../common-issues.md#enable-or-disable-annotation-for-a-track).

Per cancellare le voci WaniKani dal database delle parole di una traccia, [segui questi passaggi](../common-issues.md#clear-wanikani-word-database).
:::

### Traccia dei sottotitoli {#annotation-track}

Seleziona la traccia di sottotitoli a cui si applicano queste impostazioni di annotazione.

### Colorare i sottotitoli in base alle parole conosciute {#colorize-subtitles-based-on-known-words}

Attiva lo stile basato sullo stato delle parole (non raccolte, sconosciute, in apprendimento e così via). Lo stile usa [**Stile del colore delle parole**](#word-color-style) e [**Colori dello stato delle parole**](#word-status-colors).

### Generare automaticamente le statistiche {#generate-statistics-automatically}

Genera automaticamente le statistiche per il contenuto corrente al caricamento. Attiva anche le statistiche in sovrimpressione. La [scorciatoia da tastiera per aprire le statistiche](#annotation-keyboard-shortcuts) si trova nel gruppo Annotazioni.

### Mostrare la lettura delle parole {#display-word-readings}

Mostra sopra le parole le letture (ad es. i furigana) in base al loro stato.

### Mostrare la frequenza delle parole {#display-word-frequency}

Mostra sotto le parole un valore di frequenza basato sul rango (se disponibile), in base al loro stato. È utile per stabilire quali parole vale la pena imparare.

:::tip
Per visualizzare la frequenza, nell’istanza di Yomitan deve essere disponibile almeno un dizionario di frequenza basato sul rango. Se un dizionario di frequenza non specifica la modalità, asbplayer prova a stabilire se è basato sul rango e lo usa di conseguenza.

Se per una parola sono disponibili più valori di frequenza, viene usato il più basso (quello più frequente).
:::

### Mostrare l’accento tonale (giapponese) {#display-pitch-accent-japanese}

:::note
Per vedere l’accento tonale sui furigana, devi attivare [**Mostrare la lettura delle parole**](#display-word-readings).
:::

Mostra l’accento tonale sui furigana o direttamente sui kana in base allo stato della parola.

:::info
Se sono disponibili i dati, l’accento tonale della particella che segue una parola viene determinato in base all’accento della parola.

Di solito i furigana vengono mostrati solo sui kanji, ma con questa funzione attiva vengono mostrati su tutti i caratteri della parola se almeno uno è un kanji. In questo modo è più facile leggere l’accento tonale delle parole composte.
:::

### Mostrare le definizioni delle parole {#display-word-definitions}

Determina se mostrare brevi definizioni o spiegazioni per ogni parola in base al suo stato.

### Strategia di ricerca nei campi parola {#word-field-search-strategy}

Determina come asbplayer confronta le parole dei sottotitoli con quelle che conosci.

- **Forma esatta raccolta**: il campo deve contenere la forma esatta presente nei sottotitoli (running -> running).
- **Lemma raccolto**: devi aver raccolto la forma base o lemma (running -> run).
- **Lemma o forma esatta raccolti**: la parola è considerata raccolta se corrisponde il lemma o la forma esatta (una delle due opzioni precedenti).
- **Una qualsiasi forma raccolta**: la parola è considerata raccolta se corrisponde a una qualsiasi forma correlata (running -> run, ran, runs e così via).

Se selezioni **Lemma raccolto**, **Lemma o forma esatta raccolti** o **Una qualsiasi forma raccolta**, [**Corrispondenza tra sistemi di scrittura**](#match-across-language-scripts) stabilisce se il confronto basato sul lemma può avvenire tra sistemi di scrittura diversi della stessa lingua (ad es. kanji, hiragana e katakana).

### Priorità nella scelta delle carte {#card-choice-priority}

Se più carte Anki corrispondono a una parola, questa impostazione determina quale carta usare per stabilirne lo stato:

- **Il campo contiene la forma esatta** (se le corrispondenze sono più di una, usa la carta con lo stato migliore)
- **Il campo contiene il lemma** (se le corrispondenze sono più di una, usa la carta con lo stato migliore)
- **Carta con lo stato migliore**
- **Carta con lo stato peggiore**

### Strategia di ricerca nei campi frase {#sentence-field-search-strategy}

Determina come asbplayer cerca nei [**Campi frase Anki**](#anki-sentence-fields) configurati. Sono disponibili le stesse opzioni di [**Strategia di ricerca nei campi parola**](#word-field-search-strategy).

Se selezioni **Lemma raccolto**, **Lemma o forma esatta raccolti** o **Una qualsiasi forma raccolta**, [**Corrispondenza tra sistemi di scrittura**](#match-across-language-scripts) stabilisce se il confronto basato sul lemma può avvenire tra sistemi di scrittura diversi della stessa lingua (ad es. kanji, hiragana e katakana).

:::tip
Poiché le frasi contengono più parole e lo stato della carta è quindi meno pertinente per ciascuna parola, è preferibile lasciare **Forma esatta raccolta**, a meno che tu non abbia solo carte con frasi.
:::

### Corrispondenza tra sistemi di scrittura {#match-across-language-scripts}

Determina se il confronto basato sul lemma può avvenire tra sistemi di scrittura diversi della stessa lingua (ad es. kanji, hiragana e katakana).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### URL dell’API Yomitan {#yomitan-api-url}

URL dell’endpoint API di Yomitan. Se l’URL non è valido o non è raggiungibile, asbplayer mostra un errore.

:::tip
Devi configurare un’istanza di [Yomitan](https://yomitan.wiki/) e [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Parser Yomitan {#yomitan-parser}

Seleziona il parser Yomitan da usare per suddividere in parole il testo dei sottotitoli:

- **Scanning Parser (tutte le lingue)**: parser interno di Yomitan che trova le parole più lunghe nei tuoi dizionari.
- **MeCab (giapponese)**: usa MeCab per analizzare il testo giapponese. Yomitan deve essere configurato con il supporto a MeCab, preferibilmente con almeno un dizionario UniDic.

### Lunghezza massima delle parole {#max-word-length}

:::info
Questa impostazione si applica solo a Scanning Parser.
:::

Limita la lunghezza massima delle parole che asbplayer prova a rilevare e suddividere per le annotazioni.

:::tip
Se imposti un valore troppo basso, le parole più lunghe non verranno rilevate; se lo imposti troppo alto, potrebbero verificarsi problemi di prestazioni.
:::

### Mazzi Anki (facoltativo) {#anki-decks}

Limita le ricerche di Anki ai mazzi selezionati. Se il campo è vuoto, asbplayer cerca in tutti i mazzi.

### Campi parola Anki {#anki-word-fields}

Campi delle note Anki che contengono _solo_ la parola da imparare. È il metodo consigliato per ottenere da Anki informazioni sullo stato di conoscenza.

### Campi frase Anki {#anki-sentence-fields}

Campi delle note Anki che contengono una frase (usati comunemente nei mazzi di frasi). Vengono usati come alternativa se non ci sono carte con la parola da imparare nei [**Campi parola Anki**](#anki-word-fields).

### Stabilità/intervallo per la maturità delle carte Anki (giorni) {#mature-anki-stability-interval}

Stabilisce la soglia (in giorni) per considerare una carta Anki **Matura** invece che assegnarle uno stato di maturità inferiore.

- **Non raccolto**: non trovato in Anki.
- **Sconosciuto**: trovato in Anki con `is:new`.
- **In apprendimento**: trovato in Anki con `is:learn`.
- **Progredito**: trovato in Anki con `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Giovane**: trovato in Anki con `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Maturo**: trovato in Anki con `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Se è disponibile la stabilità FSRS di una carta (l’ultima revisione è stata eseguita con FSRS attivo), viene usata al posto dell’intervallo.

Per ulteriori informazioni sugli stati delle parole, consulta [**Colori dello stato delle parole**](#word-status-colors).
:::

### Considerare le carte Anki sospese come {#treat-suspended-anki-cards-as}

Determina come considerare le carte **sospese** quando si costruisce lo stato delle parole da Anki:

- **Normale**: usa lo stato Anki così com’è.
- Oppure scegli uno stato specifico (ad es. **Maturo**, **Sconosciuto** e così via) da assegnare alle carte sospese.

:::tip
Se solo alcune carte di una parola sono sospese, vengono escluse e lo stato della parola viene determinato in base alle carte non sospese.

Per ulteriori informazioni sugli stati delle parole, consulta [**Colori dello stato delle parole**](#word-status-colors).
:::

### Token API di WaniKani {#wanikani-api-token}

Usa il token API di WaniKani per sincronizzare le parole conosciute da WaniKani. Per configurarlo, segui le istruzioni nella [guida alle annotazioni](../guides/annotation.md#setup).

asbplayer usa solo i tipi di soggetto `vocabulary` e `kana_vocabulary` per determinare le parole conosciute. Lo stato viene determinato in base al livello SRS previsto dal [sistema di ripetizione dilazionata](https://docs.api.wanikani.com/20170710/#spaced-repetition-system) configurato per il soggetto. Gli stati WaniKani sono determinati come segue:

- **Non raccolto**: non trovato in WaniKani.
- **Sconosciuto**: trovato in WaniKani con un livello SRS inferiore a `Starting stage`.
- **In apprendimento**: trovato in WaniKani con un livello SRS pari o superiore a `Starting stage` e inferiore a `Passing stage`.
- **Progredito**: trovato in WaniKani con un livello SRS nella metà inferiore dei livelli tra `Passing stage` e `Burning stage`.
- **Giovane**: trovato in WaniKani con un livello SRS nella metà superiore dei livelli tra `Passing stage` e `Burning stage`.
- **Maturo**: trovato in WaniKani con un livello SRS pari o superiore a `Burning stage`.

:::tip
Per ulteriori informazioni sugli stati delle parole, consulta [**Colori dello stato delle parole**](#word-status-colors).
:::

### Stile del colore delle parole {#word-color-style}

Determina come applicare i colori dello stato alle parole con [**Colorare i sottotitoli in base alle parole conosciute**](#colorize-subtitles-based-on-known-words):

- **Testo**: cambia il colore della parola.
- **Sfondo**: cambia il colore dietro la parola.
- **Sottolineato**: sottolinea la parola con il colore dello stato.
- **Soprallineato**: traccia una linea sopra la parola con il colore dello stato.
- **Contorno**: traccia il contorno della parola con il colore dello stato.

:::tip
Se usi **Contorno**, per ottenere il risultato migliore potrebbe essere necessario impostare su `0` lo [**spessore del contorno dei sottotitoli**](#subtitle-appearance-track).
:::

### Spessore {#thickness}

Determina lo spessore in pixel dello stile **Sottolineato**, **Soprallineato** e **Contorno**.

### Evidenziare le parole al passaggio del puntatore {#highlight-words-on-hover}

:::info
L’evidenziazione indica quale elemento ha il focus di asbplayer per ricevere le scorciatoie da tastiera. Se non appare, potrebbe essere necessario fare clic sul lettore per assegnargli il focus. Le scorciatoie funzionano sul video o sull’elenco dei sottotitoli, ma non su entrambi contemporaneamente, a seconda di quale elemento ha il focus.

L’evidenziazione serve soprattutto a mostrare quale parola stai indicando per raccoglierla. Perciò, il puntatore deve trovarsi su una parola e la colorazione deve essere attiva.
:::

Se attiva, la parola viene evidenziata quando ci passi sopra con il puntatore; così puoi vedere come Yomitan l’ha suddivisa.

### Mostrare il colore delle parole solo al passaggio del puntatore {#only-display-word-color-on-hover}

:::note
Questa impostazione si applica solo se è attiva [**Colorare i sottotitoli in base alle parole conosciute**](#colorize-subtitles-based-on-known-words).
:::

Se attiva per il video o per l’elenco dei sottotitoli, i colori delle parole sono nascosti per impostazione predefinita e appaiono solo quando passi il puntatore sul testo dei sottotitoli nel video o nell’elenco, rispettivamente.

### Mostrare la lettura delle parole solo al passaggio del puntatore {#only-display-word-reading-on-hover}

:::note
Questa impostazione si applica solo se è attivo [**Mostrare la lettura delle parole**](#display-word-readings).
:::

Se attiva per il video o per l’elenco dei sottotitoli, le letture delle parole sono nascoste per impostazione predefinita e appaiono solo quando passi il puntatore sul testo dei sottotitoli nel video o nell’elenco, rispettivamente.

### Mostrare la frequenza delle parole solo al passaggio del puntatore {#only-display-word-frequency-on-hover}

:::note
Questa impostazione si applica solo se è attivo [**Mostrare la frequenza delle parole**](#display-word-frequency).
:::

Se attiva per il video o per l’elenco dei sottotitoli, la frequenza delle parole è nascosta per impostazione predefinita e appare solo quando passi il puntatore sul testo dei sottotitoli nel video o nell’elenco, rispettivamente.

### Mostrare le definizioni delle parole solo al passaggio del puntatore {#only-display-word-definitions-on-hover}

:::note
Questa impostazione si applica solo se è attivo [**Mostrare le definizioni delle parole**](#display-word-definitions).
:::

Se attiva per il video o per l’elenco dei sottotitoli, le definizioni delle parole sono nascoste per impostazione predefinita e appaiono solo quando passi il puntatore sul testo dei sottotitoli nel video o nell’elenco, rispettivamente.

### Mostrare l’accento tonale solo al passaggio del puntatore {#only-display-pitch-accent-on-hover}

:::note
Questa impostazione si applica solo se è attivo [**Mostrare l’accento tonale (giapponese)**](#display-pitch-accent-japanese).
:::

Se attiva per il video o per l’elenco dei sottotitoli, l’accento tonale è nascosto per impostazione predefinita e appare solo quando passi il puntatore sul testo dei sottotitoli nel video o nell’elenco, rispettivamente.

### Dimensione della lettura delle parole {#word-reading-size}

Determina la dimensione delle letture delle parole (furigana) in unità em (% della dimensione del carattere dei sottotitoli).

### Dimensione della frequenza delle parole {#word-frequency-size}

Determina la dimensione della frequenza delle parole in unità em (% della dimensione del carattere dei sottotitoli).

### Dimensione delle definizioni delle parole {#word-definition-size}

Determina la dimensione delle definizioni delle parole in unità em (% della dimensione del carattere dei sottotitoli).

### Dimensione dell’accento tonale {#pitch-accent-size}

Determina la dimensione dell’accento tonale in unità em (% della dimensione del carattere dei sottotitoli).

### Colori dello stato delle parole {#word-status-colors}

Ogni stato ha un colore e una trasparenza configurabili per [**Stile del colore delle parole**](#word-color-style); puoi attivare o disattivare ogni stato singolarmente.

- **Non raccolto**: la parola non è presente nel database di asbplayer.
- **Sconosciuto**: la parola è presente ma viene considerata sconosciuta.
- **In apprendimento**: la parola è in fase di apprendimento.
- **Progredito**: la parola ha completato la fase di apprendimento.
- **Giovane**: la parola è conosciuta ma non è ancora matura.
- **Maturo**: la parola è pienamente conosciuta (matura).

:::tip
Puoi disattivare gli stili degli stati secondo le tue preferenze, ad esempio disattivare **Maturo** per ridurre gli elementi visualizzati.

Puoi riutilizzare i colori (ad es. per **Progredito** e **Giovane**) se non vuoi distinguere alcuni stati.

Per sapere come vengono determinati gli stati delle carte Anki, consulta [**Stabilità/intervallo per la maturità delle carte Anki (giorni)**](#mature-anki-stability-interval).
Per sapere come vengono determinati gli stati WaniKani, consulta [**Token API di WaniKani**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Riproduzione</a> {#playback}

### Tracce dei sottotitoli interessate dalle modalità di riproduzione e dalle scorciatoie da tastiera {#playback-subtitle-tracks}

Specifica quali tracce considerare quando usi le scorciatoie da tastiera per [Sottotitoli](#subtitles-keyboard-shortcuts) e [Ricerca](#seek-keyboard-shortcuts), o le modalità di riproduzione. Ad esempio, quando è attiva la modalità condensata, gli intervalli da saltare automaticamente sono le parti della sequenza temporale prive di sottotitoli nelle tracce selezionate qui.

### Mettere in pausa automaticamente al passaggio del puntatore sui sottotitoli {#auto-pause-when-mousing-over-subtitles}

Definisce il comportamento della pausa automatica quando il puntatore passa sui sottotitoli. «Attiva con ripresa automatica» significa che la riproduzione riprende automaticamente quando il puntatore viene allontanato dai sottotitoli.

### Modalità di riproduzione {#playback-modes}

Puoi attivare e disattivare le modalità di riproduzione con le [scorciatoie da tastiera per la riproduzione](#playback-keyboard-shortcuts).

### Velocità di riproduzione {#playback-rate}

Controlla la velocità normale di riproduzione, compresa quella usata nei sottotitoli quando è attivo l’avanzamento rapido. Ogni nuova riproduzione inizia a questa velocità. Per regolarla mentre guardi, usa le [scorciatoie da tastiera per la velocità di riproduzione](#playback-rate-keyboard-shortcuts).

### Mostrare una notifica quando cambia la velocità di riproduzione {#show-playback-rate-notification}

Mostra una notifica quando la velocità di riproduzione cambia al di fuori della modalità di avanzamento rapido.

### Preferenza per la pausa automatica {#auto-pause-preference}

Quando è attiva la pausa automatica, determina se mettere in pausa all’inizio, alla fine o a entrambi i margini dei sottotitoli. Se sono attivi entrambi i margini e la ripetizione, prima di ripetere viene inserita una pausa alla fine, ma quella iniziale viene saltata per evitare una doppia pausa.

### Numero di ripetizioni {#repeat-count-preference}

Determina quante volte ripetere ogni sottotitolo prima di continuare la riproduzione. Il valore `0` ripete senza limiti.

### Ripetizioni prima di mostrare i sottotitoli {#repeats-before-showing-subtitles}

Nasconde i sottotitoli in un segmento ripetuto finché non è stato riprodotto questo numero di volte. `0` non li nasconde; `1` li mostra già alla prima ripetizione.

### Scostamenti iniziale e finale dell’attivazione dei sottotitoli {#subtitle-trigger-start-and-end-offsets}

Sposta in millisecondi gli eventi iniziale e finale dei sottotitoli usati per la pausa automatica e la ripetizione. Gli scostamenti vengono applicati dopo quello globale dei sottotitoli. Puoi configurare separatamente i margini iniziale e finale: i valori positivi attivano gli effetti di riproduzione più tardi, quelli negativi prima. Ogni margine spostato è limitato dai confini del contenuto e dagli eventi dei sottotitoli vicini. Se i margini spostati si incrociano, i loro ruoli cronologici vengono invertiti.

### Intervallo minimo da saltare con l’avanzamento rapido {#fast-forward-minimum-skip-interval}

Usa l’avanzamento rapido per l’intero intervallo tra i sottotitoli se questo è almeno pari alla durata indicata. Gli intervalli più brevi restano alla velocità di riproduzione normale.

### Velocità di riproduzione con avanzamento rapido {#fast-forward-playback-rate}

Velocità dell’avanzamento rapido quando è attiva la relativa modalità.

### Intervallo minimo da saltare con la riproduzione condensata {#condensed-playback-minimum-skip-interval}

Quando è attiva la riproduzione condensata, passa al sottotitolo successivo solo se manca almeno l’intervallo indicato.

### Scostamenti iniziale e finale dell’attivazione degli intervalli tra sottotitoli {#subtitle-gap-trigger-start-and-end-offsets}

Sposta gli eventi degli intervalli tra sottotitoli usati per l’avanzamento rapido e la riproduzione condensata. Lo scostamento iniziale dell’intervallo è non negativo e ritarda l’attivazione rispetto alla fine del sottotitolo; quello finale è non positivo e anticipa l’attivazione rispetto al momento precedente al sottotitolo successivo. Ogni intervallo è limitato dai confini del contenuto e dagli eventi dei sottotitoli vicini.

### Modalità di ripresa dopo la pausa automatica {#auto-pause-resume-mode}

Determina come termina una pausa automatica.

- **Manuale**: la riproduzione resta in pausa finché non la riprendi.

- **Fissa**: ogni pausa automatica dura lo stesso intervallo configurato.
    - Controlla [Durata fissa della pausa](#fixed-pause-duration) e [Ritardo di ripresa dopo la pausa automatica](#resume-delay-after-auto-pause).

- **Durata sottotitolo**: la durata della pausa viene calcolata in base al numero di caratteri del sottotitolo. Vengono conteggiati solo i sottotitoli delle tracce selezionabili, quindi una traccia di traduzione caricata insieme alla lingua di destinazione non allunga la pausa.
    - Controlla [Durata minima della pausa](#minimum-pause-duration), [Durata massima della pausa](#maximum-pause-duration), [Tempo di pausa per carattere](#pause-time-per-character) e [Ritardo di ripresa dopo la pausa automatica](#resume-delay-after-auto-pause).

### Durata fissa della pausa {#fixed-pause-duration}

Durata di una pausa automatica nella modalità **Fissa**.

### Durata minima della pausa {#minimum-pause-duration}

Durata minima consentita nella modalità **Durata sottotitolo**, indipendentemente dal numero di caratteri.

### Durata massima della pausa {#maximum-pause-duration}

Durata massima consentita nella modalità **Durata sottotitolo**. Il valore `0` non impone un limite massimo. Un valore massimo diverso da zero non può essere inferiore alla durata minima della pausa.

### Tempo di pausa per carattere {#pause-time-per-character}

Numero di millisecondi assegnato a ogni carattere nella modalità **Durata sottotitolo**. Il prodotto tra il numero di caratteri e questo valore viene limitato alle durate minima e massima della pausa.

### Ritardo di ripresa dopo la pausa automatica {#resume-delay-after-auto-pause}

Nelle modalità **Fissa** e **Durata sottotitolo**, la pausa automatica avviene in due fasi: il sottotitolo viene mostrato per la durata configurata, poi nascosto mentre la riproduzione resta in pausa per il ritardo di ripresa. Questa impostazione controlla la durata della seconda fase.

### Mostrare i sottotitoli {#show-subtitles}

- **Quando previsti**: i sottotitoli appaiono durante il rispettivo intervallo temporale.

- **Durante la pausa**: i sottotitoli appaiono solo durante il rispettivo intervallo temporale e quando la riproduzione è in pausa.

- **Durante la pausa manuale**: i sottotitoli appaiono solo durante il rispettivo intervallo temporale e quando la riproduzione è stata messa in pausa manualmente.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Riproduzione > Annotazioni</a> {#playback-annotation}

Queste impostazioni usano gli stati, le condizioni e le frequenze delle parole definiti in [Annotazioni](#annotation) per la traccia di sottotitoli selezionata. Le regole per pausa automatica, riproduzione condensata, avanzamento rapido e ripetizione si applicano quando è attiva la relativa modalità di riproduzione. **Nessun filtro parole** significa che per quella traccia non sono selezionati stati o condizioni. Le regole si applicano a ogni traccia separatamente: una traccia selezionabile senza stati o condizioni selezionati per una modalità mantiene il comportamento abituale, anche se viene riprodotta insieme a una traccia con regole.

### Traccia dei sottotitoli {#playback-annotation-track}

Seleziona la traccia di sottotitoli di cui stai modificando le impostazioni di riproduzione basate sulle annotazioni. La traccia selezionata è condivisa con la scheda Annotazioni.

### Selezionare la prima parola corrispondente durante la pausa {#select-first-matching-word-on-pause}

Seleziona la prima parola che corrisponde a uno degli stati scelti ogni volta che la riproduzione viene messa in pausa, anche manualmente, e dopo una ricerca mentre il video è in pausa. Lascia vuoto il campo per disattivare questo comportamento. La selezione avviene nel lettore video o, se non è caricato o collegato alcun video, nel lettore dei sottotitoli.

Se la pausa è causata da una [regola di pausa automatica basata sulle annotazioni](#auto-pause-subtitles-containing-these-words), viene selezionata la parola corrispondente alla regola. Questo menu a discesa continua a controllare la selezione durante le pause manuali.

Ognuna delle regole seguenti ha una propria selezione di stati e condizioni, un limite al numero di parole e un limite di frequenza. Una parola deve avere uno stato o una condizione selezionati e rispettare entrambi i limiti.

### Mettere in pausa automaticamente i sottotitoli che contengono queste parole {#auto-pause-subtitles-containing-these-words}

Quando è attiva la pausa automatica, mette in pausa solo sui sottotitoli che contengono una parola corrispondente e seleziona la prima parola corrispondente. Durante le pause automatiche, questa regola ha la precedenza su [**Selezionare la prima parola corrispondente durante la pausa**](#select-first-matching-word-on-pause); il menu a discesa continua ad applicarsi alle pause manuali.

### Ripetere i sottotitoli che contengono queste parole {#repeat-subtitles-containing-these-words}

Quando è attiva la modalità di ripetizione, ripete solo i sottotitoli che contengono una parola corrispondente.

### Riprodurre in modalità condensata i sottotitoli che contengono queste parole {#play-subtitles-containing-these-words-in-condensed-mode}

Quando è attiva la modalità condensata, mantiene nella sequenza temporale condensata i sottotitoli che contengono una parola corrispondente e salta gli altri.

### Riprodurre a velocità normale, in modalità avanzamento rapido, i sottotitoli che contengono queste parole {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Quando è attiva la modalità di avanzamento rapido, riproduce a velocità normale i sottotitoli che contengono una parola corrispondente e fa avanzare rapidamente gli altri.

### Regolare la velocità di avanzamento rapido in base alla comprensione {#adjust-fast-forward-rate-by-comprehension}

Quando è attiva la modalità di avanzamento rapido, usa il punteggio di comprensione della frase per determinare la velocità all’interno di un sottotitolo.

A un valore pari o inferiore a [**Comprensione minima**](#minimum-comprehension), usa la velocità di riproduzione normale; al 100%, usa la velocità di avanzamento rapido configurata. Tra questi valori, le velocità vengono interpolate.

Se modifichi la velocità in un sottotitolo regolato in base alla comprensione, cambia la velocità di avanzamento rapido configurata; quella applicata viene poi ricalcolata in base alla comprensione. Questo vale anche quando la comprensione mantiene il sottotitolo alla velocità normale. Le scorciatoie da tastiera e i controlli della velocità del lettore seguono lo stesso comportamento; la velocità normale non cambia.

### Comprensione minima {#minimum-comprehension}

Imposta la percentuale da cui inizia l’accelerazione (0–99%; predefinita: 60%).

### Mostrare queste parole durante la riproduzione {#show-these-words-during-playback}

Seleziona gli stati e le condizioni delle parole da mantenere visibili.

### Nascondere l’intero sottotitolo se verrebbe nascosta almeno questa percentuale di parole {#whole-subtitle-hidden-percentage}

Nasconde l’intero sottotitolo se la regola di visualizzazione nasconderebbe almeno la percentuale indicata delle sue parole. Ad esempio, con **80%**, se in un sottotitolo di cinque parole ne verrebbero nascoste quattro, viene nascosto l’intero sottotitolo, compresa l’unica parola selezionata per essere mostrata. La punteggiatura e gli altri caratteri non alfabetici non vengono conteggiati.

### Nascondere singolarmente le parole non corrispondenti {#hide-non-matching-words-individually}

Se attiva, le parole che non rispettano la regola di visualizzazione vengono nascoste singolarmente finché il sottotitolo non raggiunge la soglia di occultamento totale. Se disattivata, il sottotitolo resta interamente visibile fino al raggiungimento della soglia.

### Numero minimo di parole per categoria selezionata {#minimum-words-per-selected-category}

Ogni categoria selezionata (ad es. **Non raccolto** o **Ignorato**) viene conteggiata separatamente nel sottotitolo. Se il numero di parole della categoria è inferiore a questo limite, non attiva la regola. `0` disattiva il limite.

### Numero massimo di parole per categoria selezionata {#maximum-words-per-selected-category}

Ogni categoria selezionata (ad es. **Non raccolto** o **Ignorato**) viene conteggiata separatamente nel sottotitolo. Se il numero di parole della categoria supera questo limite, non attiva la regola. `0` disattiva il limite.

### Solo se la frequenza della parola è almeno {#only-when-word-frequency-is-at-least}

La frequenza di una parola corrispondente deve essere pari o superiore a questo valore. Se manca il dato della frequenza, viene considerato `1`. `0` disattiva il limite.

### Solo se la frequenza della parola è al massimo {#only-when-word-frequency-is-at-most}

La frequenza di una parola corrispondente deve essere pari o inferiore a questo valore. Se manca il dato della frequenza, viene considerato `1`. `0` disattiva il limite.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Video in streaming</a> (solo estensione) {#streaming-video}

Le impostazioni dei video in streaming sono disponibili solo se è installata l’estensione per browser.

### Aprire l’elenco dei sottotitoli in una scheda separata dell’app quando vengono caricati {#open-subtitle-list-in-tab}

Ogni volta che carichi sottotitoli in un elemento video, apre il sito web in una scheda separata e sincronizza i sottotitoli caricati con il sito.

### URL dell’app {#app-url}

Determina da dove l’estensione recupera alcune impostazioni e quale URL aprire per sincronizzare i sottotitoli con il sito web in una scheda separata. In pratica, è l’URL del sito web.

### Attivare l’interfaccia dei controlli in sovrimpressione {#enable-controls-overlay}

Mostra l’interfaccia in sovrimpressione sugli elementi video con sottotitoli caricati.

### Mostrare i sottotitoli {#display-subtitles}

Mostra i sottotitoli caricati sugli elementi video.

### Registrare l’audio durante l’estrazione {#record-audio-when-mining}

Quando estrai un sottotitolo, registra l’audio corrispondente per aggiungerlo alla carta.

### Acquisire uno screenshot durante l’estrazione {#take-screenshot-when-mining}

Quando estrai un sottotitolo, acquisisci uno screenshot da aggiungere alla carta.

### Acquisire screenshot puliti durante l’estrazione {#clean-screenshot-when-mining}

Quando estrai un sottotitolo con gli screenshot attivi, acquisisci uno screenshot «pulito» rimuovendo gli elementi HTML sovrapposti al video.

### Ritagliare lo screenshot durante l’estrazione {#crop-screenshot-when-mining}

Quando estrai un sottotitolo, ritaglia lo screenshot in base all’elemento video.

### Formato di acquisizione dell’immagine {#streaming-image-capture-format}

Specifica il formato di acquisizione delle immagini per le carte estratte da video in streaming. L’opzione aggiuntiva è «WebP animato»: acquisisce il video riprodotto nella scheda per l’intervallo del sottotitolo, compreso il margine audio, e lo salva come immagine animata invece che come singolo screenshot.

Il WebP animato viene usato solo se è attiva la [registrazione audio durante l’estrazione](#record-audio-when-mining); altrimenti viene acquisito un normale screenshot. Si applica a tutti i metodi di estrazione che registrano contenuti multimediali, compresa la registrazione manuale avviata e interrotta con la relativa scorciatoia da tastiera, che acquisisce tutto fino all’interruzione (massimo 30 secondi). È possibile eseguire una sola registrazione alla volta. Il WebP animato non è disponibile in Firefox e non è possibile acquisire video protetti da DRM. Durante l’acquisizione del clip, la scheda deve restare visibile, perché Chrome interrompe il rendering delle schede nascoste.

### FPS delle immagini animate {#animated-image-fps}

Numero di fotogrammi al secondo da acquisire per le immagini WebP animate. I clip più lunghi usano automaticamente meno fotogrammi per mantenere piccole le carte. Disponibile solo se è selezionato il formato WebP animato.

### Qualità delle immagini animate {#animated-image-quality}

Qualità di ogni fotogramma delle immagini WebP animate, da `0.1` a `1`. Un valore più alto migliora la qualità visiva ma crea file più grandi. Disponibile solo se è selezionato il formato WebP animato.

### Consentire di trascinare i file dei sottotitoli {#allow-subtitle-file-drag-and-drop}

Consente di trascinare i file dei sottotitoli sugli elementi video.

### Caricare automaticamente i sottotitoli rilevati {#auto-load-detected-subtitles}

Se il sito web corrente supporta il rilevamento automatico dei sottotitoli, li carica automaticamente. Se vengono rilevate più tracce, carica quella nella lingua preferita. La lingua preferita è quella dell’ultima traccia caricata selezionando la casella «Ricorda queste scelte di traccia».

### Chiedere conferma se il caricamento automatico dei sottotitoli rilevati non riesce {#prompt-on-subtitle-autoload-failure}

Se il caricamento automatico dei sottotitoli non riesce, chiede conferma prima di provare a caricare quelli rilevati.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Video in streaming > Pagine</a> {#pages}

Impostazioni per le integrazioni specifiche di siti come YouTube e Netflix. asbplayer ha impostazioni predefinite per ogni sito, che puoi modificare nella sezione Pagine.

### Codici lingua di destinazione per la traduzione automatica (solo YouTube) {#youtube-translation-languages}

Specifica le lingue di destinazione per la traduzione automatica di YouTube. Se indichi delle lingue qui, nel selettore delle tracce dei sottotitoli appariranno ulteriori tracce per ciascuna lingua.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Varie</a> {#misc}

### Importare/esportare le impostazioni {#import-export-settings}

Importa o esporta le impostazioni come file `json`.

### Tema {#theme}

Visualizza asbplayer con un tema chiaro o scuro.

### Lingua {#language}

Lingua dell’interfaccia utente.

Nota: non tutte le stringhe sono state tradotte in tutte le lingue supportate da asbplayer. Quelle non tradotte vengono mostrate in inglese. Puoi contribuire alla localizzazione nel [progetto Crowdin](https://crowdin.com/project/asbplayer).

### Ingrandire automaticamente il video locale {#auto-maximize-local-video}

Ingrandisce automaticamente il video locale quando si apre il pannello dei sottotitoli.

### Mostrare il pulsante di estrazione nell’elenco dei sottotitoli {#show-mining-button-in-subtitle-list}

Se attiva, mostra un pulsante di estrazione accanto a ogni sottotitolo nell’elenco.

### Marche temporali nell’elenco dei sottotitoli {#subtitle-list-timestamps}

Determina come mostrare le marche temporali nell’elenco dei sottotitoli.

- **Nascoste**: non vengono mostrate.
- **Inizio**: mostra solo la marca temporale iniziale del sottotitolo.
- **Inizio e fine**: mostra le marche temporali iniziale e finale del sottotitolo.

### Ricordare lo scostamento dei sottotitoli {#remember-subtitle-offset}

Se attiva, lo scostamento temporale è persistente: i sottotitoli vengono caricati con l’ultimo scostamento usato.

### Ricordare l’ultima velocità di riproduzione {#remember-last-playback-rate}

Aggiorna l’impostazione della velocità di riproduzione quando la modifichi durante la visione di un video. Se disattivata, la riproduzione inizia comunque alla velocità configurata, ma le modifiche apportate durante la visione restano temporanee.

### Ricordare le ultime modalità di riproduzione {#remember-last-playback-modes}

Ripristina le ultime modalità di riproduzione attive quando carichi di nuovo un video. Se disattivata, la riproduzione inizia in modalità normale.

### Copiare automaticamente il sottotitolo corrente negli appunti {#auto-copy-current-subtitle-to-clipboard}

Copia automaticamente i sottotitoli negli appunti quando appaiono sullo schermo. È utile per inviarli alle app che monitorano gli appunti.

### Tracce dei sottotitoli idonee alla copia automatica {#subtitle-tracks-eligible-for-auto-copy}

Specifica quali tracce copiare automaticamente quando è attiva l’impostazione [Copiare automaticamente il sottotitolo corrente negli appunti](#auto-copy-current-subtitle-to-clipboard).

### Mostrare le miniature di anteprima {#show-preview-thumbnails}

Mostra le miniature di anteprima nell’elenco dei sottotitoli.

### Mostrare il sottotitolo sopra la miniatura {#subtitle-above-thumbnail}

Mostra il sottotitolo sopra la miniatura di anteprima nell’elenco.

### Filtro regex dei sottotitoli {#subtitle-regex-filter}

Le parti di testo che corrispondono a questa regex vengono sostituite con il valore di [Testo sostitutivo del filtro regex dei sottotitoli](#subtitle-regex-filter-text-replacement).

### Testo sostitutivo del filtro regex dei sottotitoli {#subtitle-regex-filter-text-replacement}

Le parti di testo che corrispondono alla regex qui sopra vengono sostituite con il valore di questa impostazione. Se il campo è vuoto, le parti corrispondenti vengono rimosse.

### HTML dei sottotitoli {#subtitle-html}

Determina come gestire l’HTML presente nei file dei sottotitoli.

### Rilevare e mostrare il ruby {#detect-and-display-ruby}

Se attiva, asbplayer rileva automaticamente le letture delle parole nel formato usato da Netflix e le mostra con tag `ruby`. Queste letture sono comuni nei sottotitoli giapponesi e hanno forme come `花子（はなこ）`, in cui la lettura tra parentesi segue la parola.

### Attivare il client WebSocket {#enable-websocket-client}

Attiva il client WebSocket, che consente di controllare asbplayer tramite l’interfaccia WebSocket.

### URL del server WebSocket {#websocket-server-url}

URL del server WebSocket a cui connettersi quando attivi il client. Di solito è un’istanza locale del [server WebSocket preconfigurato](../guides/web-socket-server.md).

### Limite di archiviazione della cronologia di estrazione {#mining-history-storage-limit}

Limita il numero di carte salvabili nella cronologia di estrazione.

### Nome della scheda {#name-of-the-tab}

Nome da assegnare alla scheda dell’app.

## Profili {#profiles}

Un profilo è un insieme di impostazioni completamente distinto. Puoi cambiare il profilo attivo dall’interfaccia delle impostazioni o dalle finestre **Carica sottotitoli** e **Esportazione Anki**.
