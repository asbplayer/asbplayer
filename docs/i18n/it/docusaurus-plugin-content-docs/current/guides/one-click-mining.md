---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Creazione di flashcard con un clic {#one-click-mining}

asbplayer è ottimo per collegare sottotitoli e video ad AnkiConnect, ma non è in grado di fornire autonomamente le definizioni delle parole. Per questo motivo, la maggior parte dei flussi di lavoro per creare flashcard da frasi richiede due o tre input da tastiera o clic del mouse da parte dell'utente.

È possibile creare flashcard con un solo clic combinando asbplayer con un'altra applicazione che:

- fornisca le definizioni delle parole mancanti e
- sia già integrata con AnkiConnect.

[Yomitan](https://yomitan.wiki/) è un esempio di applicazione di questo tipo.

## Installare e configurare Yomitan {#install-and-configure-yomitan}

Segui le istruzioni sul [sito di Yomitan](https://yomitan.wiki/) per installarlo e configurare un dizionario per la lingua che stai imparando. Se non l'hai già fatto, dovrai anche aggiungere [AnkiConnect](https://ankiweb.net/shared/info/2055492159) ad Anki.

Nelle impostazioni di Anki di Yomitan:

- L'indirizzo del server AnkiConnect deve essere quello predefinito (<code>{ankiConnectUrl}</code>).
- Yomitan deve usare lo stesso **Tipo di nota** di asbplayer.

## Installare l'add-on Anki di asbplayer {#install-the-asbplayer-anki-add-on}

L'add-on richiede almeno Anki 25.02. Non è ancora disponibile su AnkiWeb, quindi deve essere installato da un file:

1. Scarica il file `.ankiaddon` più recente dalla <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>pagina delle release</a>.
2. Apri il file e premi **Sì** nella finestra popup.
3. Riavvia Anki.

## Collegare asbplayer all'add-on {#connect-asbplayer-to-the-add-on}

Attiva il client WebSocket nelle <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>impostazioni varie</a> dell'estensione asbplayer (verso il fondo della pagina). Mantieni l'URL predefinito del server WebSocket (<code>{webSocketUrl}</code>), che corrisponde a quello predefinito dell'add-on.

## Crea flashcard con **Yomitan** come al solito {#mine-with-yomitan-as-usual}

Creando flashcard da frasi con Yomitan, le carte includeranno già la definizione della parola, l'immagine e l'audio.

Per usare sempre il testo dei sottotitoli di asbplayer nel campo Sentence, attiva [**Usa sempre il testo dei sottotitoli nel campo della frase**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) nelle impostazioni di **Creazione flashcard**. Il testo della frase fornito da Yomitan verrà sostituito con il testo dei sottotitoli selezionati in tutti i canali.

Se estrai più parole dallo stesso sottotitolo, **Aggiorna l'ultima carta** può aggiornare anche le carte corrispondenti create in precedenza. Attiva gli [**aggiornamenti della frase**](../reference/settings.md#update-sentence-for-cards-with-the-same-subtitle-text) per condividere la frase e le tracce dei sottotitoli configurate, oppure gli [**aggiornamenti di immagine e audio**](../reference/settings.md#update-all-cards-with-the-same-subtitle-text) per condividere lo screenshot e la clip audio.

## Impostazioni dell'add-on

Puoi modificare le impostazioni dell'add-on in Anki da **Strumenti > Componenti aggiuntivi**: seleziona l'add-on e premi **Configura**. `postMineAction` è l'azione eseguita da asbplayer dopo che Yomitan ha aggiunto una carta (predefinita: <code>{project.services.webSocket.postMineAction}</code>). Impostala su `2` (aggiorna l'ultima carta) per creare flashcard con un solo clic. Se modifichi `port`, devi aggiornare di conseguenza l'URL del server WebSocket di asbplayer.
