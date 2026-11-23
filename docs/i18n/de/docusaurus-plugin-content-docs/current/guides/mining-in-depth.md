---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Sentence Mining im Detail {#mining-in-depth}

Mit asbplayer können Sie Sentence Mining auf verschiedene Weise an Ihre Bedürfnisse und Vorlieben anpassen.

## Anki-Exportdialog öffnen {#opening-the-anki-export-dialog}

Es gibt mehrere Möglichkeiten, den **Anki-Exportdialog** zu öffnen:

1. Über die Schaltfläche **Untertitel auswerten** <NoteAddIcon /> in der **Untertitelliste** der **Seitenleiste** oder auf der Website.
2. Über die Schaltfläche **Untertitel auswerten** <NoteAddIcon /> in der **Overlay-Oberfläche** bei Streaming-Videos oder auf der mobilen Website.
3. Mit dem [Mining-Tastaturkürzel](../reference/settings.md#mining-keyboard-shortcuts) **Aktuellen Untertitel auswerten und Anki-Dialog öffnen** – standardmäßig `Ctrl + Shift + X`.
4. Bei einem Streaming-Video mit der rechten Maustaste klicken → asbplayer → **Untertitel auswerten**.

:::info
Mit den Methoden 1 und 2 wird der Dialog nur geöffnet, wenn die [Standardaktion der Mining-Schaltfläche](../reference/settings#mining-button-default-action) auf „Anki-Dialog anzeigen“ gesetzt ist.
:::

:::info
Wenn eine _leere_ Untertitelspur geladen und die Audioaufnahme aktiviert ist, starten alle oben genannten Aktionen beim ersten Auslösen die Audioaufnahme und öffnen beim zweiten Auslösen den Anki-Dialog.
:::

## Karten anpassen {#adjusting-cards}

Vor dem Export können Karten im Dialog angepasst werden.

### Ausgewählter Zeitbereich {#selected-time-range}

Mit dem **Schieberegler** am unteren Rand des Dialogs können Sie den ausgewählten Zeitbereich ändern.

- Das **Satzfeld** wird automatisch an den ausgewählten Zeitbereich angepasst, sofern Sie es nicht bereits manuell bearbeitet haben.
- Bei lokalen Dateien wird auch der Audioausschnitt automatisch aktualisiert.
- Bei Streaming-Videos kann der Audioausschnitt mit dem ausgewählten Zeitbereich neu aufgenommen werden.

### Audiofeld {#audio-field}

Das **Audiofeld** zeigt den aufgenommenen Audioausschnitt an und bietet drei Aktionsschaltflächen:

- **Wiedergabe/Pause** – spielt den Audioausschnitt direkt im Dialog zur Vorschau ab.
- **Erneut aufnehmen** – nimmt den Audioausschnitt mit dem aktuell ausgewählten Zeitbereich erneut auf (nur bei Streaming-Videos; wird angezeigt, wenn ein Rückruf zum erneuten Aufnehmen verfügbar ist).
- **Herunterladen** – lädt den Audioausschnitt als Datei auf Ihr Gerät herunter.

### Textfelder {#text-fields}

Alle Textfelder – Satz, Definition, Wort, benutzerdefinierte Felder, Quelle, URL und Tags – lassen sich bearbeiten. Für das Definitionsfeld wird meist eine separate Wörterbuch-App verwendet.

### Bildfeld {#image-field}

Bei lokalen Dateien können Sie über die **Vorschau-Schaltfläche** <ImageIcon /> im **Bildfeld** den Videozeitpunkt ändern, an dem der Screenshot aufgenommen wird.

## Karten exportieren {#exporting-cards}

Exportieren Sie die Karte über die Schaltflächen unten im Dialog. Es gibt drei Exportarten:

1. **Exportieren**: Exportiert die Karte mit dem Inhalt des Dialogs.
2. **Letzte Karte aktualisieren**: Aktualisiert die letzte Karte in Ihrem Anki-Deck mit dem Inhalt des Dialogs.
3. **In Anki öffnen**: Öffnet Ankis Kartenersteller, ausgefüllt mit dem Inhalt des Dialogs.

## Mining ohne Dialog {#dialog-less-mining-flows}

Mining-Abläufe ohne Dialog, die eine Wortdefinition einschließen und den Anki-Dialog überspringen, sind möglich, wenn asbplayer mit einer Wörterbuch-App verwendet wird, die ebenfalls in Anki integriert ist. Die derzeit beliebteste App mit dieser Funktion ist [Yomitan](https://yomitan.wiki/).

### Letzte Karte aktualisieren {#update-last-card}

Ein Mining-Ablauf ohne Dialog mit Yomitan sieht so aus:

1. Markieren Sie in Yomitan das Wort in den Untertiteln, das Sie auswerten möchten.
2. Erstellen Sie mit der Kartenerstellungs-Schaltfläche von Yomitan eine Karte.
3. Aktualisieren Sie die Karte sofort mit dem [Mining-Tastaturkürzel](../reference/settings.md#mining-keyboard-shortcuts) von asbplayer **Letzte Karte aktualisieren** – `Ctrl + Shift + U`.

Der Nachteil dieses Ablaufs ist, dass Sie beim Überspringen des Dialogs keine Gelegenheit haben, die Karte anzupassen. Es gibt jedoch Möglichkeiten, das zu umgehen:

- Statt die letzte Karte direkt im letzten Schritt zu aktualisieren, können Sie `Ctrl + Shift + X` verwenden, um den Dialog zu öffnen, die Karte anzupassen und anschließend über die Dialogoberfläche **Letzte Karte aktualisieren** auszuwählen. So verwenden Sie weiterhin den Dialog und profitieren zugleich von Yomitans automatisch bereitgestellter Wortdefinition.
- Den **Anki-Exportdialog** können Sie auch _nach_ dem Erstellen einer Karte mit dem [Mining-Tastaturkürzel](../reference/settings.md#mining-keyboard-shortcuts) **Screenshot manuell aufnehmen** öffnen – standardmäßig `Ctrl + Shift + V`.

### Mit einem Klick {#one-click}

Siehe den Leitfaden zum [Mining mit einem Klick](./one-click-mining.md).
