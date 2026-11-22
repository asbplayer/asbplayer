---
sidebar_position: 5
---

import project from '@site/src/project';

# Problemi comuni {#common-issues}

## Generale {#general}

### I sottotitoli non vengono visualizzati {#subtitles-arent-showing-up}

Puoi nascondere i sottotitoli in asbplayer in diversi modi:

- La scorciatoia da tastiera [`Mostra/Nascondi sottotitoli`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Le scorciatoie da tastiera [`Mostra/Nascondi traccia sottotitoli X nel video`](./reference/settings.md#subtitles-keyboard-shortcuts).
- L'opzione [`Mostra sottotitoli`](./reference/settings.md#show-subtitles) in `Riproduzione > Modalità di riproduzione`.

### asbplayer non riesce a connettersi ad Anki e mostra un messaggio di errore, ad esempio «Failed to fetch» {#anki-connection-failed}

La causa potrebbe essere un blocco degli annunci:

- Se usi Brave, verifica che Shield non stia bloccando asbplayer.
- Controlla che il browser o un blocco degli annunci non stia bloccando la richiesta. Puoi iniziare aprendo la console per sviluppatori del browser e cercando eventuali errori.

Configurazione errata:

- Se usi il sito web, assicurati che AnkiConnect consenta asbplayer, come descritto [qui](./getting-started/mining-subtitles.md).

Oppure un bug:

- Al momento della stesura, è noto che l'attivazione delle funzionalità sperimentali della piattaforma web causa questo problema. Prova a disattivare il flag da `chrome://flags`.
- Nelle versioni più recenti di macOS, AnkiConnect non risponde quando Anki è in background ([Note per utenti MacOS](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### La carta non si aggiorna in Anki quando uso la funzione «Aggiorna l'ultima carta» {#card-not-updating}

Quando usi «Aggiorna l'ultima carta», assicurati che il browser delle carte di Anki sia chiuso. Esiste un [problema noto](https://github.com/FooSoft/anki-connect/issues/82) con AnkiConnect per cui le carte sembrano non aggiornarsi se il browser delle carte è aperto.

### Quando carico un file locale, asbplayer mostra una schermata nera o non riproduce l'audio {#local-video-playback-issues}

La capacità dei browser di decodificare determinati formati video e audio varia. Consulta la [sezione sulla compatibilità](./compatibility.md#browsers-and-media-formats).

### La mia estensione di dizionario popup (ad es. Yomitan) non funziona nel pannello laterale {#popup-dictionary-in-side-panel}

Per motivi di sicurezza, i browser non permettono di iniettare gli script di un'estensione nelle pagine di altre estensioni, quindi non c'è una soluzione. Se vuoi analizzare il testo con altre estensioni, devi farlo dai sottotitoli mostrati nell'elemento video o dall'elenco dei sottotitoli sul sito web di asbplayer.

### asbplayer non rileva i video in streaming {#asbplayer-isnt-detecting-streaming-video}

Nelle impostazioni dell'estensione, verifica che l'estensione possa accedere a tutti i siti.

### Le scorciatoie da tastiera non funzionano {#keyboard-shortcuts-arent-working}

Controlla le <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>impostazioni delle scorciatoie da tastiera</a> o il [riferimento alle scorciatoie da tastiera](./reference/settings.md#keyboard-shortcuts).

Inoltre, se usi l'estensione:

- In Chrome, controlla `chrome://extensions/shortcuts`; in Firefox, vai su `about:addons` → icona a forma di ingranaggio → `Gestisci scorciatoie estensioni`.
- Prova ad aggiornare la pagina e a caricare di nuovo i sottotitoli.
- Prova a disinstallare e reinstallare l'estensione, quindi riavvia il browser.
- Assicurati che l'estensione non sia installata due volte.

### asbplayer non ritaglia correttamente gli screenshot dei video in streaming {#screenshot-cropping-issues}

Assicurati che lo zoom del browser sia al 100%. Puoi disattivare del tutto il ritaglio dalle <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>impostazioni dell'estensione</a>.

### Ho problemi a creare carte usando il tipo di nota JP mining {#jp-mining-note-issues}

Consulta questa [segnalazione](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer continua a chiedermi il permesso di registrare l'audio {#repeated-audio-permission-prompts}

Al momento asbplayer non è compatibile con l'estensione Volume Master. Dovrai disattivarla.

### Le registrazioni audio sono distorte, gracchianti o a tratti interrotte {#garbled-audio-recordings}

Di solito la causa è una CPU non abbastanza potente. Se usi un portatile, assicurati che sia collegato all'alimentazione. In generale, verifica che la modalità di risparmio energetico non limiti la CPU.

### Quando uso una scorciatoia da tastiera per aprire asbplayer con un video in streaming, non succede nulla e la pagina smette di rispondere {#streaming-shortcut-unresponsive}

La causa potrebbe essere il flag `Experimental Web Platform features` attivo in `chrome://flags`. Verifica che sia disattivato e riprova.

## Annotazioni {#annotation}

### Attivare o disattivare le annotazioni per una traccia {#enable-or-disable-annotation-for-a-track}

Le annotazioni sono disattivate se le impostazioni seguenti hanno i valori indicati:

- In [`Impostazioni > Annotazioni`](./reference/settings.md#annotation):
  - [`Colora i sottotitoli in base alle parole conosciute`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Disattivato**
  - [`Genera statistiche automaticamente`](./reference/settings.md#generate-statistics-automatically): **Disattivato**
  - [`Mostra la lettura delle parole`](./reference/settings.md#display-word-readings): _Nessuna selezione_ (valore vuoto)
  - [`Mostra la frequenza delle parole`](./reference/settings.md#display-word-frequency): _Nessuna selezione_ (valore vuoto)
  - [`Mostra l'accento tonale (giapponese)`](./reference/settings.md#display-pitch-accent-japanese): _Nessuna selezione_ (valore vuoto)
  - [`Mostra le definizioni delle parole`](./reference/settings.md#display-word-definitions): _Nessuna selezione_ (valore vuoto)
- In [`Impostazioni > Riproduzione > Annotazioni`](./reference/settings.md#playback-annotation):
  - [`Seleziona la prima parola corrispondente durante la pausa`](./reference/settings.md#select-first-matching-word-on-pause): Mai
  - [`Metti in pausa i sottotitoli che contengono queste parole`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Nessun filtro parole
  - [`Riproduci in modalità condensata i sottotitoli che contengono queste parole`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Nessun filtro parole
  - [`Riproduci a velocità normale, in modalità avanzamento rapido, i sottotitoli che contengono queste parole`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Nessun filtro parole
  - [`Ripeti i sottotitoli che contengono queste parole`](./reference/settings.md#repeat-subtitles-containing-these-words): Nessun filtro parole
  - [`Mostra queste parole durante la riproduzione`](./reference/settings.md#show-these-words-during-playback): Nessun filtro parole
  - [`Regola la velocità di avanzamento rapido in base alla comprensione`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Disattivato**

Per attivare le annotazioni per una traccia, imposta almeno una delle opzioni qui sopra su un valore diverso da quello disattivato. Alcune annotazioni potrebbero essere visibili solo al passaggio del puntatore, se [configurate in questo modo](./reference/settings.md#only-display-word-color-on-hover).

:::tip
I pulsanti [`Ricostruisci database parole Anki`](./reference/settings.md#re-build-anki-word-database) e [`Ricostruisci database parole WaniKani`](./reference/settings.md#re-build-wanikani-word-database) sono disattivati se le impostazioni qui sopra non hanno valori che permettano di usare la relativa integrazione.
:::

### Cancellare il database delle parole Anki {#clear-anki-word-database}

Per cancellare le voci del database delle parole Anki di una traccia, imposta su vuoto i [`Campi parola Anki`](./reference/settings.md#anki-word-fields) e i [`Campi frase Anki`](./reference/settings.md#anki-sentence-fields), quindi usa il pulsante [`Ricostruisci database parole Anki`](./reference/settings.md#re-build-anki-word-database). Se il pulsante è disattivato, [segui questi passaggi](#enable-or-disable-annotation-for-a-track) per attivare prima le annotazioni per la traccia.

### Cancellare il database delle parole WaniKani {#clear-wanikani-word-database}

Per cancellare le voci del database delle parole WaniKani di una traccia, imposta su vuoto il [token API di WaniKani](./reference/settings.md#wanikani-api-token), quindi usa il pulsante [`Ricostruisci database parole WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Se il pulsante è disattivato, [segui questi passaggi](#enable-or-disable-annotation-for-a-track) per attivare prima le annotazioni per la traccia.

### Eliminare le parole salvate localmente {#delete-locally-tracked-words}

Puoi eliminare una parola salvata localmente passandoci sopra con il puntatore e usando le [scorciatoie da tastiera per le annotazioni](./reference/settings.md#annotation-keyboard-shortcuts) per impostarne lo stato su **Non raccolto** e disattivare **Ignorato**, se era attivo.

Per eliminare in blocco le parole salvate localmente, usa il [`Browser delle parole`](./reference/settings.md#word-browser) per impostare lo stato su **Non raccolto** e rimuoverne gli stati. Puoi anche usare la funzione [`Importa parole`](./reference/settings.md#import-words).

### Tutte le parole sono non raccolte {#everything-is-uncollected}

Se hai attivato le annotazioni per errore, [segui questi passaggi](#enable-or-disable-annotation-for-a-track) per disattivarle.

Se lo stato delle parole resta sempre **Non raccolto**:

- Se usi lo stato locale, importa le parole nel database locale oppure usa il puntatore e le [scorciatoie da tastiera per le annotazioni](./reference/settings.md#annotation-keyboard-shortcuts) per impostarne lo stato.
- Se usi Anki per lo stato, assicurati che Anki sia in esecuzione e che l'**URL di AnkiConnect** sia corretto.
    - Configura i [`Campi parola Anki`](./reference/settings.md#anki-word-fields) (consigliato) e/o i [`Campi frase Anki`](./reference/settings.md#anki-sentence-fields).
    - Esegui [`Ricostruisci database parole Anki`](./reference/settings.md#re-build-anki-word-database).
    - Non è necessario tenere Anki in esecuzione dopo aver creato il database, ma lasciandolo aperto durante la riproduzione manterrai asbplayer sincronizzato.
- Se usi WaniKani per lo stato, assicurati che il [`token API di WaniKani`](./reference/settings.md#wanikani-api-token) sia corretto.
    - Esegui [`Ricostruisci database parole WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - asbplayer si sincronizza automaticamente con WaniKani durante la riproduzione.

### Appare uno stile barrato rosso {#red-strikethrough-styling-appears}

Se hai attivato le annotazioni per errore, [segui questi passaggi](#enable-or-disable-annotation-for-a-track) per disattivarle.

Questo indica che si è verificato un errore durante l'elaborazione dei sottotitoli, molto probabilmente a causa di un problema di connessione a Yomitan. Controlla se nella console del browser ci sono messaggi di errore e, se non riesci a risolvere il problema, chiedi aiuto sul Discord di asbplayer.
