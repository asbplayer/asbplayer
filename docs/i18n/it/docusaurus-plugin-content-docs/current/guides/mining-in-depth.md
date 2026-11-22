---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Creazione di flashcard: approfondimento {#mining-in-depth}

Con asbplayer puoi creare flashcard da frasi in diversi modi, in base alle tue esigenze e preferenze.

## Aprire la finestra di esportazione Anki {#opening-the-anki-export-dialog}

Puoi aprire la **finestra di esportazione Anki** in diversi modi:

1. Con il pulsante **Estrai sottotitolo** <NoteAddIcon />, disponibile nell'**elenco dei sottotitoli** del **pannello laterale** o sul sito web.
2. Con il pulsante **Estrai sottotitolo** <NoteAddIcon /> nell'**interfaccia in sovrimpressione** dei video in streaming o sul sito web per dispositivi mobili.
3. Con la [scorciatoia da tastiera per l'estrazione](../reference/settings.md#mining-keyboard-shortcuts) **Estrai il sottotitolo corrente e apri la finestra di dialogo Anki**: per impostazione predefinita `Ctrl + Shift + X`.
4. Facendo clic con il pulsante destro del mouse su un video in streaming e selezionando asbplayer → **Estrai sottotitolo**.

:::info
I metodi 1 e 2 aprono la finestra solo se [l'azione predefinita del pulsante di estrazione](../reference/settings#mining-button-default-action) è impostata su «Mostra finestra di dialogo Anki».  
:::

:::info
Se è caricata una traccia di sottotitoli _vuota_ e la registrazione audio è attiva, la prima volta che usi una delle azioni qui sopra verrà avviata la registrazione audio; la seconda volta si aprirà la finestra di dialogo Anki.
:::

## Modificare le carte {#adjusting-cards}

Prima di esportarle, puoi modificare le carte dalla finestra di dialogo.

### Intervallo di tempo selezionato {#selected-time-range}

Puoi usare il **cursore** in fondo alla finestra per modificare l'intervallo di tempo selezionato.

- Il **campo Sentence** verrà aggiornato automaticamente per corrispondere all'intervallo selezionato, a meno che non sia già stato modificato manualmente.
- Con i file locali, anche il clip audio verrà aggiornato automaticamente.
- Con i video in streaming, puoi registrare di nuovo il clip audio usando l'intervallo selezionato.

### Campo Audio {#audio-field}

Il **campo Audio** mostra il clip audio registrato e offre tre pulsanti:

- **Riproduci/Pausa** — ascolta un'anteprima del clip audio direttamente nella finestra di dialogo.
- **Registra di nuovo** — registra di nuovo l'audio usando l'intervallo selezionato (solo per video in streaming; il pulsante è mostrato quando è disponibile una funzione di richiamata per la nuova registrazione).
- **Scarica** — scarica il clip audio come file sul dispositivo.

### Campi di testo {#text-fields}

Puoi modificare qualsiasi campo di testo: frase, definizione, parola, campi personalizzati, fonte, URL e tag. Di solito si usa un'app di dizionario separata per compilare il campo della definizione.

### Campo Immagine {#image-field}

Con i file locali, puoi fare clic sul **pulsante di anteprima** <ImageIcon /> nel **campo Immagine** per cambiare la marca temporale del video da cui acquisire lo screenshot.

## Esportare le carte {#exporting-cards}

Usa i pulsanti in fondo alla finestra di dialogo per esportare la carta. Sono disponibili tre tipi di esportazione:

1. **Esporta**: esporta una carta con il contenuto della finestra di dialogo.
2. **Aggiorna l'ultima carta**: aggiorna l'ultima carta del mazzo Anki con il contenuto della finestra di dialogo.
3. **Apri in Anki**: apre il creatore di carte di Anki con il contenuto della finestra di dialogo già compilato.

## Flussi di estrazione senza finestra di dialogo {#dialog-less-mining-flows}

Puoi creare flussi di estrazione senza finestra di dialogo, che includono una definizione della parola e saltano completamente la finestra Anki, combinando asbplayer con un'app di dizionario integrata con Anki. Attualmente, l'app di dizionario più usata che offre questa funzione è [Yomitan](https://yomitan.wiki/).

### Aggiornare l'ultima carta {#update-last-card}

Un flusso di estrazione senza finestra di dialogo con Yomitan funziona così:

1. Con Yomitan, evidenzia nei sottotitoli la parola da cui vuoi creare una carta.
2. Usa il pulsante di creazione delle carte di Yomitan.
3. Subito dopo, usa la [scorciatoia da tastiera per l'estrazione](../reference/settings.md#mining-keyboard-shortcuts) di asbplayer **Aggiorna l'ultima carta** — `Ctrl + Shift + U` — per aggiungere alla carta i contenuti forniti da asbplayer.

Lo svantaggio di questo flusso è che saltando la finestra di dialogo perdi la possibilità di modificare la carta. Ci sono però alcuni modi per aggirare il problema:

- Nell'ultimo passaggio, invece di aggiornare direttamente l'ultima carta, puoi usare `Ctrl + Shift + X` per aprire la finestra di dialogo, modificare la carta e infine fare clic su **Aggiorna l'ultima carta** nell'interfaccia. In questo modo usi comunque la finestra, ma benefici della definizione della parola fornita automaticamente da Yomitan.
- Puoi aprire la **finestra di esportazione Anki** anche _dopo_ aver creato la carta, usando la [scorciatoia da tastiera per l'estrazione](../reference/settings.md#mining-keyboard-shortcuts) **Acquisisci screenshot manualmente**; per impostazione predefinita è `Ctrl + Shift + V`.

### Un clic {#one-click}

Consulta la guida alla [creazione di flashcard con un clic](./one-click-mining.md).
