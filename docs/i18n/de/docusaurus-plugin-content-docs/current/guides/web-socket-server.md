---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# WebSocket-Server {#websocket-server}

asbplayer nutzt die bidirektionale Kommunikation von WebSocket-Verbindungen, um eine von außerhalb des Browsers zugängliche Schnittstelle bereitzustellen.

In diesem Aufbau ist asbplayer ein **WebSocket-Client**, der eine Verbindung zu einem **WebSocket-Server** aufrechterhält, der lokal auf dem Computer des Nutzers läuft. Der Server stellt dann eine HTTP-Schnittstelle bereit, über die Befehle an asbplayer, den Client, gesendet werden können. Eine technische Referenz zum mitgelieferten Server finden Sie [hier](../reference/external-api.md).

Der Server wurde ursprünglich entwickelt, um einen Mining-Ablauf mit einem Klick zu ermöglichen, bei dem `addNote`-Anfragen von AnkiConnect um von asbplayer bereitgestellte Medien ergänzt werden. Daher dient er auch als **AnkiConnect-Proxy**.

:::note
Für Mining mit einem Klick empfiehlt sich das [asbplayer-Anki-Add-on](./one-click-mining.md#install-the-asbplayer-anki-add-on). Der unten beschriebene AnkiConnect-Proxy ist eine Alternative.
:::

## Server starten {#run-the-server}

1. Klonen Sie das <a href={project.urls.repo}>asbplayer-Repository</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Installieren Sie [Golang](https://go.dev/dl/), falls noch nicht geschehen.
3. Starten Sie den Server:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Der Proxy benötigt nur sehr wenige Ressourcen und kann daher problemlos im Hintergrund laufen. Unter Windows können Sie ihn mit [RBTray](https://github.com/benbuck/rbtray) in die Taskleiste minimieren.

## asbplayer mit dem Server verbinden {#connect-asbplayer-to-the-server}

Konfigurieren und aktivieren Sie den WebSocket-Client von asbplayer in den <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Sonstigen Einstellungen</a>. Standardmäßig verwendet asbplayer bereits die Standard-IP-Adresse und den Standardport des WebSocket-Servers. Im Allgemeinen müssen Sie daher nur den WebSocket-Client aktivieren.

## Mining mit einem Klick über den AnkiConnect-Proxy {#one-click-mining-with-the-ankiconnect-proxy}

Befolgen Sie die Anweisungen auf der [Yomitan-Website](https://yomitan.wiki/), um Yomitan zu installieren und ein Wörterbuch für Ihre Zielsprache einzurichten.

Konfigurieren Sie anschließend Yomitan:

- Die AnkiConnect-URL sollte auf den AnkiConnect-Proxy statt auf AnkiConnect verweisen. Die Standard-Proxy-URL lautet <code>{webSocketHttpUrl}</code>.
- Yomitan sollte denselben **Notiztyp** wie asbplayer verwenden.

Wenn Sie Sätze mit Yomitan auswerten, werden Karten erstellt, für die Wortdefinition, Bild und Audio bereits vorhanden sind. Ein Mining-Ablauf mit nur einem Klick ist möglich, wenn `POST_MINE_ACTION` des Proxys auf `2` (letzte Karte aktualisieren) gesetzt ist. Weitere Informationen finden Sie unter [Serverkonfiguration](#server-configuration).

Wenn im Feld „Satz“ immer der Untertiteltext von asbplayer verwendet werden soll, aktivieren Sie in den Einstellungen unter **Mining** die Option [**Für das Satzfeld immer den Untertiteltext verwenden**](../reference/settings.md#always-use-subtitle-text-for-sentence-field). Dadurch wird der von Yomitan bereitgestellte Satztext durch den ausgewerteten Untertiteltext aus allen Spuren ersetzt.

## API-Referenz {#api-reference}

Eine Beschreibung der unterstützten Befehle, die über die WebSocket-Verbindung an asbplayer gesendet werden können, finden Sie in der [technischen Referenz](../reference/external-api.md#commands).

## HTTP-basierte API {#http-based-api}

Der WebSocket-Server implementiert eine HTTP-basierte API, die die oben beschriebenen Befehle auslöst.

- `POST asbplayer/load-subtitles` (optionales `mediaId` im Anfragekörper) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>Skript</a>)
- `POST asbplayer/seek` (optionales `mediaId` im Anfragekörper) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>Skript</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>Skript</a>)
- `GET asbplayer/subtitles` (optionales `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>Skript</a>)

## AnkiConnect-Proxy {#ankiconnect-proxy}

Der WebSocket-Server fungiert außerdem als AnkiConnect-Proxy. Dadurch können `addNote`-Anfragen um Kontext von asbplayer, etwa Audio und Screenshots, ergänzt werden.

Der Proxy leitet alle AnkiConnect-Anfragen unverändert weiter, außer `addNote`. Das genaue Verhalten des Proxys bei `addNote` hängt vom Wert von `POST_MINE_ACTION` in der unten beschriebenen Konfiguration ab.

## Serverkonfiguration {#server-configuration}

Der Server wird über eine `.env`-Datei konfiguriert, die im selben Verzeichnis neben ihm liegt. Hier sehen Sie eine Beispieldatei mit Erläuterungen.

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
