---
sidebar_position: 5
---

import project from '@site/src/project';

# Häufige Probleme {#common-issues}

## Allgemein {#general}

### Untertitel werden nicht angezeigt {#subtitles-arent-showing-up}

Untertitel können in asbplayer auf verschiedene Arten ausgeblendet werden:

- Mit dem Tastaturkürzel [`Untertitel umschalten`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Mit den Tastaturkürzeln [`Untertitelspur X im Video umschalten`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Über die Option [`Untertitel anzeigen`](./reference/settings.md#show-subtitles) unter `Wiedergabe > Wiedergabemodi`.

### asbplayer kann keine Verbindung zu Anki herstellen und zeigt eine Fehlermeldung wie „Failed to fetch.“ an {#anki-connection-failed}

Das kann an Werbeblockern liegen:

- Wenn Sie Brave verwenden, prüfen Sie, ob Shield asbplayer blockiert.
- Prüfen Sie, ob Ihr Browser oder ein Werbeblocker die Anfrage blockiert. Öffnen Sie dazu am besten die Entwicklerkonsole Ihres Browsers und suchen Sie nach Fehlern.

Falsche Konfiguration:

- Wenn Sie die Website verwenden, stellen Sie sicher, dass AnkiConnect asbplayer erlaubt, wie [hier](./getting-started/mining-subtitles.md) beschrieben.

Oder Fehler:

- Zum Zeitpunkt der Erstellung dieses Artikels ist bekannt, dass aktivierte experimentelle Webplattformfunktionen dieses Problem verursachen können. Deaktivieren Sie diese Option unter `chrome://flags`.
- In neueren macOS-Versionen antwortet AnkiConnect nicht, wenn Anki im Hintergrund ausgeführt wird ([Hinweise für Mac-Nutzer](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### Die Karte wird in Anki nicht aktualisiert, wenn ich die Funktion „Letzte Karte aktualisieren“ verwende. {#card-not-updating}

Schließen Sie den Anki-Kartenbrowser, wenn Sie „Letzte Karte aktualisieren“ verwenden. Es gibt ein [bekanntes Problem](https://github.com/FooSoft/anki-connect/issues/82) mit AnkiConnect: Bei geöffnetem Kartenbrowser scheinen Karten nicht aktualisiert zu werden.

### Beim Laden einer lokalen Datei zeigt asbplayer einen schwarzen Bildschirm oder gibt keinen Ton wieder. {#local-video-playback-issues}

Browser können bestimmte Video- und Audioformate unterschiedlich gut decodieren. Siehe den Abschnitt [Kompatibilität](./compatibility.md#browsers-and-media-formats).

### Meine Popup-Wörterbucherweiterung (z. B. Yomitan) funktioniert nicht in der Seitenleiste. {#popup-dictionary-in-side-panel}

Aus Sicherheitsgründen erlauben Browser nicht, Erweiterungsskripte in die Seiten anderer Erweiterungen einzufügen. Dafür gibt es keine Lösung. Wenn Sie Text mit anderen Erweiterungen untersuchen möchten, müssen Sie dies über die im Videoelement angezeigten Untertitel oder über die Untertitelliste auf der asbplayer-Website tun.

### asbplayer erkennt kein Streaming-Video. {#asbplayer-isnt-detecting-streaming-video}

Stellen Sie in den Erweiterungsdetails sicher, dass die Erweiterung Zugriff auf alle Websites hat.

### Tastaturkürzel funktionieren nicht. {#keyboard-shortcuts-arent-working}

Prüfen Sie die <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Einstellungen für Tastaturkürzel</a> oder die [Referenz zu Tastaturkürzeln](./reference/settings.md#keyboard-shortcuts).

Wenn Sie die Erweiterung verwenden:

- Prüfen Sie in Chrome `chrome://extensions/shortcuts` oder in Firefox `about:addons` → Zahnradsymbol → `Tastaturkürzel für Erweiterungen verwalten`.
- Aktualisieren Sie die Seite und laden Sie die Untertitel erneut.
- Deinstallieren Sie die Erweiterung, installieren Sie sie erneut und starten Sie den Browser neu.
- Stellen Sie sicher, dass die Erweiterung nicht zweimal installiert ist.

### asbplayer schneidet Screenshots von Streaming-Videos nicht richtig zu. {#screenshot-cropping-issues}

Stellen Sie sicher, dass die Browser-Zoomstufe auf 100 % eingestellt ist. Das Zuschneiden kann in den <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Erweiterungseinstellungen</a> vollständig deaktiviert werden.

### Ich habe Probleme beim Erstellen von Karten mit der JP-Mining-Notiz. {#jp-mining-note-issues}

Siehe dieses [Issue](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer fragt ständig nach der Berechtigung zur Audioaufnahme. {#repeated-audio-permission-prompts}

asbplayer ist derzeit nicht mit der Erweiterung Volume Master kompatibel. Sie müssen sie daher deaktivieren.

### Audioaufnahmen sind verzerrt, kratzig oder abgehackt. {#garbled-audio-recordings}

Meist liegt das an einer unzureichenden CPU-Leistung. Wenn Sie einen Laptop verwenden, schließen Sie ihn an eine Stromquelle an. Achten Sie generell darauf, dass der Energiesparmodus oder Ähnliches die CPU nicht drosselt.

### Wenn ich ein Tastaturkürzel verwende, um asbplayer für ein Streaming-Video zu öffnen, passiert nichts und die Seite reagiert nicht mehr. {#streaming-shortcut-unresponsive}

Das kann passieren, wenn `Experimental Web Platform features` unter `chrome://flags` aktiviert ist. Stellen Sie sicher, dass die Option deaktiviert ist, und versuchen Sie es erneut.

## Annotation {#annotation}

### Annotation für eine Spur aktivieren oder deaktivieren {#enable-or-disable-annotation-for-a-track}

Annotation gilt als deaktiviert, wenn die folgenden Einstellungen diese Werte haben:

- Unter [`Einstellungen > Annotation`](./reference/settings.md#annotation):
  - [`Untertitel anhand bekannter Wörter einfärben`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Aus**
  - [`Statistiken automatisch erstellen`](./reference/settings.md#generate-statistics-automatically): **Aus**
  - [`Wortlesungen anzeigen`](./reference/settings.md#display-word-readings): _Nichts ausgewählt_ (leerer Wert)
  - [`Worthäufigkeit anzeigen`](./reference/settings.md#display-word-frequency): _Nichts ausgewählt_ (leerer Wert)
  - [`Tonhöhenakzent (Japanisch) anzeigen`](./reference/settings.md#display-pitch-accent-japanese): _Nichts ausgewählt_ (leerer Wert)
  - [`Wortdefinitionen anzeigen`](./reference/settings.md#display-word-definitions): _Nichts ausgewählt_ (leerer Wert)
- Unter [`Einstellungen > Wiedergabe > Annotation`](./reference/settings.md#playback-annotation):
  - [`Beim Pausieren das erste passende Wort auswählen`](./reference/settings.md#select-first-matching-word-on-pause): Nie
  - [`Untertitel mit diesen Wörtern automatisch pausieren`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Kein Wortfilter
  - [`Untertitel mit diesen Wörtern im verdichteten Modus abspielen`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Kein Wortfilter
  - [`Untertitel mit diesen Wörtern im Vorspulmodus mit normaler Geschwindigkeit abspielen`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Kein Wortfilter
  - [`Untertitel mit diesen Wörtern wiederholen`](./reference/settings.md#repeat-subtitles-containing-these-words): Kein Wortfilter
  - [`Diese Wörter während der Wiedergabe anzeigen`](./reference/settings.md#show-these-words-during-playback): Kein Wortfilter
  - [`Vorspulgeschwindigkeit anhand des Sprachverständnisses anpassen`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Aus**

Um Annotation für eine Spur zu aktivieren, stellen Sie mindestens eine der obigen Einstellungen auf einen anderen Wert als den deaktivierten Wert. Bestimmte Annotationen werden möglicherweise nur beim Darüberfahren mit der Maus angezeigt, wenn dies [so eingestellt ist](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Die Schaltflächen [`Anki-Wörterdatenbank neu erstellen`](./reference/settings.md#re-build-anki-word-database) und [`WaniKani-Wörterdatenbank neu erstellen`](./reference/settings.md#re-build-wanikani-word-database) sind deaktiviert, solange die obigen Einstellungen nicht auf Werte gesetzt sind, die von der jeweiligen Integration profitieren.
:::

### Anki-Wörterdatenbank leeren {#clear-anki-word-database}

Um die Einträge der Anki-Wörterdatenbank für eine Spur zu löschen, leeren Sie die Felder [`Anki-Wortfelder`](./reference/settings.md#anki-word-fields) und [`Anki-Satzfelder`](./reference/settings.md#anki-sentence-fields) und verwenden Sie die Schaltfläche [`Anki-Wörterdatenbank neu erstellen`](./reference/settings.md#re-build-anki-word-database). Wenn die Schaltfläche deaktiviert ist, [führen Sie zuerst diese Schritte aus](#enable-or-disable-annotation-for-a-track), um Annotation für die Spur zu aktivieren.

### WaniKani-Wörterdatenbank leeren {#clear-wanikani-word-database}

Um die Einträge der WaniKani-Wörterdatenbank für eine Spur zu löschen, leeren Sie das Feld [WaniKani-API-Token](./reference/settings.md#wanikani-api-token) und verwenden Sie die Schaltfläche [`WaniKani-Wörterdatenbank neu erstellen`](./reference/settings.md#re-build-wanikani-word-database). Wenn die Schaltfläche deaktiviert ist, [führen Sie zuerst diese Schritte aus](#enable-or-disable-annotation-for-a-track), um Annotation für die Spur zu aktivieren.

### Lokal gespeicherte Wörter löschen {#delete-locally-tracked-words}

Um ein lokal gespeichertes Wort zu löschen, fahren Sie mit der Maus darüber und verwenden Sie die [Annotation-Tastaturkürzel](./reference/settings.md#annotation-keyboard-shortcuts), um seinen Status auf **Nicht erfasst** zu setzen und **Ignoriert** umzuschalten, falls diese Option aktiviert war.

Um mehrere lokal gespeicherte Wörter auf einmal zu löschen, markieren Sie sie im [`Wörterbrowser`](./reference/settings.md#word-browser) als **Nicht erfasst** und entfernen Sie ihre Zustände. Sie können auch die Funktion [`Wörter importieren`](./reference/settings.md#import-words) verwenden.

### Alle Wörter sind nicht erfasst {#everything-is-uncollected}

Wenn Sie Annotation versehentlich aktiviert haben, [führen Sie diese Schritte aus](#enable-or-disable-annotation-for-a-track), um sie zu deaktivieren.

Wenn sich Wortstatus nie von **Nicht erfasst** ändern:

- Wenn Sie lokale Status verwenden, importieren Sie Wörter in die lokale Wörterdatenbank oder verwenden Sie die Maus und die [Annotation-Tastaturkürzel](./reference/settings.md#annotation-keyboard-shortcuts), um Status festzulegen.
- Wenn Sie Anki für Status verwenden, stellen Sie sicher, dass Anki läuft und die **AnkiConnect-URL** korrekt ist.
    - Richten Sie [`Anki-Wortfelder`](./reference/settings.md#anki-word-fields) (empfohlen) und/oder [`Anki-Satzfelder`](./reference/settings.md#anki-sentence-fields) ein.
    - Führen Sie [`Anki-Wörterdatenbank neu erstellen`](./reference/settings.md#re-build-anki-word-database) aus.
    - Anki muss nach dem Erstellen der Datenbank nicht weiterlaufen. Wenn Anki während der Wiedergabe geöffnet bleibt, hält asbplayer die Daten jedoch synchron.
- Wenn Sie WaniKani für Status verwenden, stellen Sie sicher, dass Ihr [`WaniKani-API-Token`](./reference/settings.md#wanikani-api-token) korrekt ist.
    - Führen Sie [`WaniKani-Wörterdatenbank neu erstellen`](./reference/settings.md#re-build-wanikani-word-database) aus.
    - asbplayer synchronisiert sich während der Wiedergabe automatisch mit WaniKani.

### Rote Durchstreichungen erscheinen {#red-strikethrough-styling-appears}

Wenn Sie Annotation versehentlich aktiviert haben, [führen Sie diese Schritte aus](#enable-or-disable-annotation-for-a-track), um sie zu deaktivieren.

Das weist auf einen Fehler bei der Verarbeitung der Untertitel hin, wahrscheinlich aufgrund eines Verbindungsproblems mit Yomitan. Prüfen Sie die Browserkonsole auf Fehlermeldungen und bitten Sie im asbplayer-Discord um Hilfe, wenn Sie das Problem nicht selbst lösen können.
