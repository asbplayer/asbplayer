---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Server WebSocket {#websocket-server}

asbplayer sfrutta la comunicazione bidirezionale delle connessioni WebSocket per esporre un'interfaccia accessibile dall'esterno del browser.

In questa configurazione, asbplayer è un **client WebSocket** che mantiene una connessione con un **server WebSocket** in esecuzione sul computer dell'utente. Il server espone quindi un'interfaccia HTTP che invia comandi al client asbplayer. La documentazione tecnica del server preconfigurato è [disponibile qui](../reference/external-api.md).

Il server è stato creato inizialmente per consentire un flusso di lavoro di creazione di flashcard con un clic, che arricchisce le richieste `addNote` di AnkiConnect con contenuti multimediali forniti da asbplayer. Per questo, una delle sue funzioni principali è anche fare da **proxy AnkiConnect**.

:::note
Il metodo consigliato per creare flashcard con un clic è usare l'[add-on Anki di asbplayer](./one-click-mining.md#install-the-asbplayer-anki-add-on). Il proxy AnkiConnect descritto di seguito è un'alternativa.
:::

## Avviare il server {#run-the-server}

1. Clona il <a href={project.urls.repo}>repository di asbplayer</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Se non l'hai già fatto, installa [Golang](https://go.dev/dl/).
3. Avvia il server:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Il proxy è molto leggero, quindi puoi lasciarlo in esecuzione in background. Su Windows, puoi usare [RBTray](https://github.com/benbuck/rbtray) per ridurlo a icona nell'area di notifica.

## Collegare asbplayer al server {#connect-asbplayer-to-the-server}

Configura e attiva il client WebSocket di asbplayer dalle <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>impostazioni varie</a>. Per impostazione predefinita, asbplayer è già configurato con l'indirizzo IP e la porta predefiniti del server WebSocket; in genere basta attivare il client WebSocket.

## Creare flashcard con un clic tramite il proxy AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Segui le istruzioni sul [sito di Yomitan](https://yomitan.wiki/) per installarlo e configurare un dizionario per la lingua che stai imparando.

Poi configura Yomitan:

- L'URL di AnkiConnect deve puntare al proxy AnkiConnect anziché ad AnkiConnect. L'URL predefinito del proxy è <code>{webSocketHttpUrl}</code>.
- Yomitan deve usare lo stesso **Tipo di nota** di asbplayer.

Creando flashcard da frasi con Yomitan, le carte includeranno già la definizione della parola, l'immagine e l'audio. Per creare flashcard davvero con un solo clic, imposta `POST_MINE_ACTION` del proxy su `2` (aggiorna l'ultima carta). Consulta la [configurazione del server](#server-configuration) per i dettagli.

Per usare sempre il testo dei sottotitoli di asbplayer nel campo Sentence, attiva [**Usa sempre il testo dei sottotitoli nel campo della frase**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) nelle impostazioni di **Creazione flashcard**. Il testo della frase fornito da Yomitan verrà sostituito con il testo dei sottotitoli selezionati in tutte le tracce.

## Riferimento API {#api-reference}

Consulta il [riferimento tecnico](../reference/external-api.md#commands) per la descrizione dei comandi supportati che possono essere inviati ad asbplayer tramite la connessione WebSocket.

## API basata su HTTP {#http-based-api}

Il server WebSocket implementa un'API basata su HTTP che attiva i comandi descritti sopra.

- `POST asbplayer/load-subtitles` (`mediaId` facoltativo nel corpo della richiesta) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (`mediaId` facoltativo nel corpo della richiesta) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (`?mediaId=...&trackNumbers=0,1` facoltativo) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## Proxy AnkiConnect {#ankiconnect-proxy}

Il server WebSocket funge anche da proxy AnkiConnect che consente di arricchire le richieste `addNote` con il contesto fornito da asbplayer, ad esempio audio e screenshot.

Il proxy inoltra tutte le richieste AnkiConnect così come sono, tranne `addNote`. Il suo comportamento specifico per `addNote` dipende dal valore di `POST_MINE_ACTION` nella configurazione descritta qui sotto.

## Configurazione del server {#server-configuration}

Il server si configura tramite un file `.env` nella stessa directory. Di seguito trovi un esempio di file con la relativa spiegazione.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
