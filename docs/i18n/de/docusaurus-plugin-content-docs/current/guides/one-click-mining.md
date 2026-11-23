---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Mining mit einem Klick {#one-click-mining}

asbplayer kann Untertitel und Videoinhalte gut mit AnkiConnect verknüpfen, aber Wortdefinitionen nicht selbstständig bereitstellen. Deshalb erfordern die meisten Abläufe für Sentence Mining zwei oder drei Eingaben per Maus oder Tastatur.

Mining mit einem Klick ist möglich, wenn asbplayer mit einer anderen Anwendung kombiniert wird, die:

- die fehlenden Wortdefinitionen bereitstellt und
- bereits in AnkiConnect integriert ist.

[Yomitan](https://yomitan.wiki/) ist ein Beispiel für eine solche Anwendung.

## Yomitan installieren und konfigurieren {#install-and-configure-yomitan}

Befolgen Sie die Anweisungen auf der [Yomitan-Website](https://yomitan.wiki/), um Yomitan zu installieren und ein Wörterbuch für die Zielsprache einzurichten. Falls noch nicht geschehen, müssen Sie außerdem [AnkiConnect](https://ankiweb.net/shared/info/2055492159) zu Anki hinzufügen.

In den Anki-Einstellungen von Yomitan:

- Die Adresse des AnkiConnect-Servers sollte dem Standardwert entsprechen (<code>{ankiConnectUrl}</code>).
- Yomitan sollte denselben **Notiztyp** wie asbplayer verwenden.

## Das asbplayer-Anki-Add-on installieren {#install-the-asbplayer-anki-add-on}

Das Add-on erfordert mindestens Anki 25.02. Es ist noch nicht auf AnkiWeb verfügbar und muss daher aus einer Datei installiert werden:

1. Laden Sie die aktuelle `.ankiaddon`-Datei von der <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>Release-Seite</a> herunter.
2. Öffnen Sie die Datei und klicken Sie im Popup auf **Ja**.
3. Starten Sie Anki neu.

## asbplayer mit dem Add-on verbinden {#connect-asbplayer-to-the-add-on}

Aktivieren Sie den WebSocket-Client in den <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Sonstigen Einstellungen</a> der asbplayer-Erweiterung (ziemlich weit unten). Behalten Sie die Standard-URL des WebSocket-Servers bei (<code>{webSocketUrl}</code>), die mit dem Standardwert des Add-ons übereinstimmt.

## Wie gewohnt mit **Yomitan** auswerten {#mine-with-yomitan-as-usual}

Wenn Sie Sätze mit Yomitan auswerten, werden Karten erstellt, für die Wortdefinition, Bild und Audio bereits vorhanden sind.

Wenn im Feld „Satz“ immer der Untertiteltext von asbplayer verwendet werden soll, aktivieren Sie in den Einstellungen unter **Mining** die Option [**Für das Satzfeld immer den Untertiteltext verwenden**](../reference/settings#always-use-subtitle-text-for-sentence-field). Dadurch wird der von Yomitan bereitgestellte Satztext durch den ausgewerteten Untertiteltext aus allen Spuren ersetzt.

## Add-on-Einstellungen

Die Einstellungen des Add-ons können in Anki unter **Werkzeuge > Add-ons** geändert werden. Wählen Sie dazu das Add-on aus und klicken Sie auf **Konfigurieren**. `postMineAction` legt fest, welche Aktion asbplayer ausführt, nachdem Yomitan eine Karte hinzugefügt hat (Standard: <code>{project.services.webSocket.postMineAction}</code>). Setzen Sie den Wert für den Mining-Ablauf mit einem Klick auf `2` (letzte Karte aktualisieren). Wenn Sie `port` ändern, müssen Sie die URL des WebSocket-Servers von asbplayer entsprechend anpassen.
