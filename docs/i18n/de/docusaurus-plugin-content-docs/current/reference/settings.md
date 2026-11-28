---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Einstellungen {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### AnkiConnect-URL {#ankiconnect-url}

URL zum AnkiConnect-Server, der als Add-on in Anki läuft.

### AnkiConnect-API-Schlüssel {#ankiconnect-api-key}

API-Schlüssel, der in AnkiConnect konfiguriert ist, wenn der API-Schlüsselschutz aktiviert ist.

### Anki-Kartenbrowser nach dem Aktualisieren von Karten neu laden {#refresh-anki-card-browser}

Wenn diese Option aktiviert ist, wird der geöffnete Anki-Kartenbrowser aktualisiert, nachdem asbplayer eine Karte aktualisiert hat, sodass die Felder ihre aktuellen Werte anzeigen. Dadurch kann das Fenster des Kartenbrowsers in den Vordergrund treten. Diese Option ist standardmäßig deaktiviert.

### Deck {#deck}

Anki-Deck, an das die Karten gesendet werden.

### Notiztyp {#note-type}

Anki-Notiztyp für die Karten. Ein Notiztyp legt ein „Modell“ und eine „Ansicht“ für Karten fest. Genauer gesagt definiert er eine Reihe von Kartenfeldern und eine HTML-Vorlage, die bestimmt, wie diese Felder auf Vorder- und Rückseite der Karte dargestellt werden.

### Kartenfelder {#card-fields}

Jede Einstellung für ein Kartenfeld bestimmt, welchem Feld des konfigurierten Notiztyps welcher Inhalt zugeordnet wird. Die **Feldbezeichnung** – Satz, Definition, Wort, Bild, Audio oder URL – entspricht dem **Inhalt**; der **Feldwert** entspricht dem **Feld im Notiztyp**.

Die Felder erscheinen im **Anki-Exportdialog** in der Reihenfolge, in der sie in den Einstellungen aufgeführt sind. Über das **⋮-Menü** → **Nach unten verschieben** oder **Nach oben verschieben** lässt sich die Reihenfolge ändern.

| Feld                  | Inhalt                                             |
| --------------------- | -------------------------------------------------- |
| Satz (alle Spuren)    | Alle Untertitel zum ausgewerteten Zeitstempel      |
| Definition            | Vom Nutzer angegebene Wortdefinition               |
| Wort                  | Vom Nutzer angegebenes Wort                        |
| Audio                 | Von der Videoquelle aufgenommener Ton              |
| Bild                  | Screenshot der Videoquelle                         |
| Quelle                | Untertiteldatei oder Videoname und Zeitstempel     |
| URL                   | Aktuelle URL, wenn die Karte aus einem Streaming-Video stammt |
| Untertitelspur 1      | Untertitel aus Spur 1 zum ausgewerteten Zeitstempel |
| Untertitelspur 2      | Untertitel aus Spur 2 zum ausgewerteten Zeitstempel |
| Untertitelspur 3      | Untertitel aus Spur 3 zum ausgewerteten Zeitstempel |
| Benutzerdefinierte Felder | Vom Nutzer angegebene Werte                    |

### Tags {#tags}

Standard-Tags, die jeder Karte hinzugefügt werden.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Mining</a> {#mining}

### Standardaktion der Mining-Schaltfläche {#mining-button-default-action}

„Mining-Schaltfläche“ <NoteAddIcon/> bezeichnet die Schaltfläche ganz links in der **Overlay-Oberfläche** sowie die Schaltfläche neben Untertiteln in der **Untertitelliste**. Mit dieser Einstellung legen Sie fest, was diese Schaltflächen bewirken.

| Einstellung             | Verhalten                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anki-Dialog anzeigen    | Zielsatz im Mining-Verlauf speichern und den **Anki-Exportdialog** anzeigen                                                                                                                             |
| Letzte Karte aktualisieren | Zielsatz im Mining-Verlauf speichern und die letzte Karte im konfigurierten Deck mit allen von asbplayer bereitgestellten Angaben aktualisieren – außer Definition, Wort und benutzerdefinierten Feldern des Nutzers |
| Dialog zum Aktualisieren der Karte anzeigen | Zielsatz im Mining-Verlauf speichern und den Dialog zum Aktualisieren der letzten Karte mit von asbplayer bereitgestellten Angaben anzeigen |
| Karte exportieren       | Zielsatz im Mining-Verlauf speichern und eine Karte _nur_ mit von asbplayer bereitgestellten Angaben exportieren – außer Definition, Wort und benutzerdefinierten Feldern des Nutzers |
| Keine                   | Zielsatz im Mining-Verlauf speichern                                                                                                                                                                   |

### Wiedergabezustand nach dem Mining {#post-mining-playback-state}

Legt den gewünschten Wiedergabezustand nach dem Auslösen einer Mining-Aktion fest.

### Ausgewertete Untertitel in die Zwischenablage kopieren {#copy-mined-subtitles-to-clipboard}

Wenn diese Option aktiviert ist, wird der Zieluntertitel bei jeder ausgelösten Mining-Aktion in die Zwischenablage kopiert.

### Für das Satzfeld immer den Untertiteltext verwenden {#always-use-subtitle-text-for-sentence-field}

Wenn diese Option aktiviert ist, wird das Satzfeld mit dem ausgewerteten Untertiteltext aller Spuren gefüllt, selbst wenn eine externe Anwendung einen anderen Satztext bereitstellt. Das ist nützlich beim [Mining mit Yomitan](../guides/one-click-mining.md).

### Beim Aktualisieren der letzten Karte auch den Satztext auf Karten mit demselben Untertiteltext aktualisieren {#update-sentence-for-cards-with-the-same-subtitle-text}

Wenn diese Option aktiviert ist, ersetzt die Aktion **Letzte Karte aktualisieren** auch das Satzfeld und alle konfigurierten Untertitelfeld 1–3 in aufeinanderfolgenden Notizen, deren vorhandener Satz mit dem exportierten Satz übereinstimmt. Die Aktualisierung versucht, die Hervorhebungen jeder Notiz beizubehalten. Untertitelfelder ohne exportierten Text bleiben unverändert. Wenn ein Untertitelfeld dasselbe Anki-Feld wie ein Feld ohne Untertitelinhalt verwendet, etwa Definition, lässt die Satzaktualisierung dieses Feld in früheren Notizen unverändert.

Diese Option übernimmt den für den aktuellen Export ausgewählten Satz. Aktivieren Sie [**Immer Untertiteltext für das Satzfeld verwenden**](#always-use-subtitle-text-for-sentence-field), um den vollständigen ausgewerteten Untertiteltext zu verwenden. Die [Bild-/Audioaktualisierung](#update-all-cards-with-the-same-subtitle-text) ist davon unabhängig.

Für den Abgleich wird das Hauptsatzfeld verwendet, Satz-Markup ignoriert und akzeptiert, dass ein Satz im anderen enthalten ist. Daher kann auch eine Notiz, die nur die erste Zeile enthält, einem vollständigen Untertitel entsprechen. Die Suche umfasst Notizen, die innerhalb der letzten beiden Anki-Tage hinzugefügt wurden, und endet beim ersten abweichenden oder fehlenden Satz. Auch für die Aktualisierung von Untertitelfeldern müssen ein Satzfeld konfiguriert und ein nichtleerer Exportsatz vorhanden sein. Diese Option ist standardmäßig deaktiviert und wirkt sich nicht auf Aktualisierungen einer gezielt ausgewählten Karte aus.

### Beim Aktualisieren der letzten Karte auch Bild und Audio von Karten mit demselben Untertiteltext aktualisieren {#update-all-cards-with-the-same-subtitle-text}

Wenn diese Option aktiviert ist, aktualisiert die Aktion **Letzte Karte aktualisieren** auch die Audio- und Bildfelder aufeinanderfolgender Notizen aus derselben Untertitelzeile. Jede vorherige Notiz behält ihr Wort, ihre Definition und ihre benutzerdefinierten Felder. Ihre Untertitelfelder bleiben unverändert, sofern nicht auch die [Satzaktualisierung](#update-sentence-for-cards-with-the-same-subtitle-text) aktiviert ist. Beim Abgleich wird Satz-Markup ignoriert; der Satz darf Teil des ausgewerteten Untertitelkontexts sein.

Die Suche umfasst Notizen, die innerhalb der letzten beiden Anki-Tage hinzugefügt wurden, und endet beim ersten abweichenden oder fehlenden Satz. Ein Satzfeld muss konfiguriert sein, und der Exportsatz muss Text enthalten, nicht nur Leerraum oder Markup. Diese Option ist standardmäßig deaktiviert und wirkt sich nicht auf Aktualisierungen einer gezielt ausgewählten Karte aus.

### Audio bei der Aufnahme aus lokalem Video abspielen {#play-audio-while-recording-from-local-video}

asbplayer verwendet die im Browser integrierte [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder)-API, um Audio aus lokalen Videodateien aufzunehmen. Mit dieser Einstellung legen Sie fest, ob während der Aufnahme Ton abgespielt wird.

### Audio erneut als MP3 codieren {#re-encode-audio-as-mp3}

Aufgenommenes Audio wird standardmäßig nicht als `mp3` codiert. Mit dieser Einstellung wird das Audio erneut als `mp3` codiert. Im Allgemeinen gibt es keinen Grund, diese Option zu deaktivieren, insbesondere wenn Sie Ihre Karten unter iOS wiederholen möchten.

### Audio-Vorlauf {#audio-padding-start}

Wie viele Millisekunden **vor** dem Zieluntertitel die Audioaufnahme beginnen soll.

### Audio-Nachlauf {#audio-padding-end}

Wie viele Millisekunden **nach** dem Zieluntertitel die Audioaufnahme enden soll.

### Bildaufnahmeformat (nur Website) {#image-capture-format}

Legt das Bildaufnahmeformat für ausgewertete Karten fest. Nur auf der Website für lokale Videodateien verfügbar; als zusätzliche Option steht dort nur „Videoclip“ zur Verfügung.

### Maximale Aufnahmebreite/-höhe {#max-capture-dimensions}

Maximale Breite/Höhe von Screenshots in Pixeln. `0` bedeutet „unbegrenzt“.

### Schwarze Balken aus Screenshots entfernen {#trim-black-bars-from-screenshots}

Wenn diese Option aktiviert ist, werden durch Letterboxing entstehende schwarze Balken aus Screenshots entfernt.

### Clip-Anfang/-Ende kürzen {#clip-trim-start-end}

Legt fest, wie viel Zeit am Anfang und Ende des Untertitelzeitraums abgezogen wird, um den Standardzeitraum für den Videoclip zu bestimmen. Nur verfügbar, wenn das Bildaufnahmeformat „Videoclip“ ausgewählt ist.

### Maximale Clip-Länge {#max-clip-length}

Legt die maximale Länge des Videoclips fest. Nur verfügbar, wenn das Bildaufnahmeformat „Videoclip“ ausgewählt ist.

### Verzögerung vor Screenshot-Aufnahme {#screenshot-capture-delay}

Wie lange nach dem Erscheinen des Zieluntertitels gewartet wird, bevor der Screenshot aufgenommen wird.

### Anzahl umgebender Untertitel {#surrounding-subtitles-count-radius}

Unten im **Anki-Exportdialog** können Sie mit einem Schieberegler den ausgewählten Zeitraum anpassen. Der Schieberegler bezieht umgebende Untertitel als zusätzlichen Kontext ein. Mit dieser Einstellung begrenzen Sie ihre Anzahl.

### Zeitbereich umgebender Untertitel {#surrounding-subtitles-time-radius}

Unten im **Anki-Exportdialog** können Sie mit einem Schieberegler den ausgewählten Zeitraum anpassen. Der Schieberegler bezieht umgebende Untertitel als zusätzlichen Kontext ein. Mit dieser Einstellung legen Sie den zulässigen Zeitbereich der umgebenden Untertitel um den Zieluntertitel fest.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Darstellung der Untertitel</a> {#subtitle-appearance}

### Untertitelspur {#subtitle-appearance-track}

asbplayer kann mehrere Untertitelspuren gleichzeitig laden. In diesem Dropdown-Menü wählen Sie die Spur(en) aus, für die die folgenden Einstellungen gelten. Standardmäßig ist „Alle“ ausgewählt. Wenn Sie bei ausgewähltem „Alle“ eine Darstellungseinstellung ändern, gilt die Änderung gleichzeitig für alle Spuren. Sobald Sie für eine Einstellung einen spurenspezifischen Wert festlegen, wird diese Einstellung auf der Seite „Alle“ ausgeblendet.

### Untertitelvorschau {#subtitle-preview}

Zeigen Sie eine Vorschau des Untertiteltexts an und bearbeiten Sie ihn, um die Wirkung der Darstellungseinstellungen zu prüfen.

### Gestaltung {#styling}

| Einstellung                       | Beschreibung                                                                         | CSS-Eigenschaft             |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Untertitelfarbe                   | Farbe                                                                                | `color`                     |
| Untertitelgröße                   | Größe in `px`                                                                        | `font-size`                 |
| Schriftstärke der Untertitel      | Schriftstärke                                                                        | `font-weight`               |
| Konturfarbe der Untertitel        | Farbe der Kontur                                                                     | `-webkit-text-stroke-color` |
| Konturstärke der Untertitel       | Stärke der Kontur                                                                    | `-webkit-text-stroke-width` |
| Schattierungsfarbe der Untertitel | Farbe des Schattens                                                                  | `text-shadow`               |
| Schattenstärke der Untertitel     | Stärke des Schattens                                                                  | `text-shadow`               |
| Hintergrundfarbe der Untertitel   | Hintergrundfarbe                                                                     | `background-color`          |
| Deckkraft des Untertitelhintergrunds | Deckkraft des Hintergrunds                                                        | `background`                |
| Untertitelschriftart              | Schriftart. Wenn der Zugriff auf lokale Schriftarten erlaubt ist, erscheint ein Dropdown-Menü mit verfügbaren Schriftarten. | `font-family` |
| CSS:\<style key\>                | Zeichenfolgenwert jeder benutzerdefinierten CSS-Eigenschaft, die über das Dropdown-Menü **Benutzerdefiniertes CSS hinzufügen** hinzugefügt wurde. | Benutzerdefinierte Eigenschaft |
| Untertitelunschärfe               | Wendet einen Unschärfeeffekt auf Untertitel an. Beim Darüberfahren mit dem Mauszeiger wird die Unschärfe aufgehoben. | `filter:blur(...)` |
| Skalierungsfaktor bildbasierter Untertitel | Skaliert bildbasierte Untertitel.                                                 | —                           |

### Layout {#layout}

| Einstellung                          | Beschreibung                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Untertitelausrichtung                | Legt fest, ob Untertitel oben oder unten im Videoelement angezeigt werden.    |
| Untertitelpositionsversatz von unten | Abstand aller unteren Untertitelspuren zum unteren Rand des Videoelements.    |
| Untertitelpositionsversatz von oben  | Abstand aller oberen Untertitelspuren zum oberen Rand des Videoelements.      |
| Untertitelbreite                     | Breite des Untertitelcontainers in `%` oder Pixeln.                           |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Tastaturkürzel</a> {#keyboard-shortcuts}

Mit Tastaturkürzeln können Sie auf die meisten Funktionen von asbplayer zugreifen.

### Tastaturkürzel für <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Untertitel</a> {#subtitles-keyboard-shortcuts}

| Verhalten                            | Standardkürzel   |
| ------------------------------------ | ---------------- |
| Untertitelspuren zum Laden auswählen | Ctrl + Shift + F |
| Untertitel umschalten                | ↓                |
| Untertitelspur 1 im Video umschalten | 1                |
| Untertitelspur 2 im Video umschalten | 2                |
| Untertitelspur 3 im Video umschalten | 3                |
| Untertitelspur 1 in asbplayer umschalten | W + 1         |
| Untertitelspur 2 in asbplayer umschalten | W + 2         |
| Untertitelspur 3 in asbplayer umschalten | W + 3         |
| Unschärfe von Untertitelspur 1 in asbplayer aufheben | B + 1 |
| Unschärfe von Untertitelspur 2 in asbplayer aufheben | B + 2 |
| Unschärfe von Untertitelspur 3 in asbplayer aufheben | B + 3 |
| Untere Untertitel nach oben verschieben |                  |
| Untere Untertitel nach unten verschieben |                |
| Obere Untertitel nach oben verschieben |                  |
| Obere Untertitel nach unten verschieben |                |
| Aktuellen Untertitel kopieren |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Mining</a>-Tastaturkürzel {#mining-keyboard-shortcuts}

| Verhalten                                                                            | Standardkürzel             |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Aktuellen Untertitel auswerten                                                       | Ctrl + Shift + Z (Website) |
| Aktuellen Untertitel auswerten und Anki-Dialog öffnen                                | Ctrl + Shift + X           |
| Zuletzt erstellte Anki-Karte mit Screenshot, Audio usw. von asbplayer aktualisieren  | Ctrl + Shift + U           |
| Karte ohne Dialog nach Anki exportieren                                              |                            |
| Screenshot manuell aufnehmen und den automatisch beim Mining aufgenommenen ersetzen | Ctrl + Shift + V (Website) |
| Audioaufnahme manuell starten/stoppen, auch wenn eine Untertiteldatei geladen ist    | Ctrl + Shift + R (Website) |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Wiedergabe</a>-Tastaturkürzel {#playback-keyboard-shortcuts}

| Verhalten                       | Standardkürzel   |
| ------------------------------- | ---------------- |
| Seitenleiste umschalten         | \`               |
| Wiedergabe/Pause                | Space            |
| Auto-Pause umschalten           | Shift + P        |
| Verdichtete Wiedergabe umschalten | Shift + O      |
| Vorspulwiedergabe umschalten    | Shift + F        |
| Wiederholmodus umschalten       | Shift + R        |
| Anzeigezeitpunkt der Untertitel umschalten |        |
| Auto-Pause-Fortsetzungsmodus durchgehen |          |
| Rezepte vorwärts durchgehen     |                  |
| Rezepte rückwärts durchgehen    |                  |
| Rezept 1 umschalten             |                  |
| Rezept 2 umschalten             |                  |
| Rezept 3 umschalten             |                  |
| Rezept 4 umschalten             |                  |
| Rezept 5 umschalten             |                  |
| Rezept 6 umschalten             |                  |
| Rezept 7 umschalten             |                  |
| Rezept 8 umschalten             |                  |
| Rezept 9 umschalten             |                  |
| Rezept 10 umschalten            |                  |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Spulen</a>-Tastaturkürzel {#seek-keyboard-shortcuts}

| Verhalten                                                                 | Standardkürzel   |
| ------------------------------------------------------------------------- | ---------------- |
| Zurückspulen (standardmäßig 3 Sekunden, [konfigurierbar](#seek-interval-seconds)) | A          |
| Vorspulen (standardmäßig 3 Sekunden, [konfigurierbar](#seek-interval-seconds))    | D          |
| Zum vorherigen Untertitel springen                                           | ←           |
| Zum nächsten Untertitel springen                                             | →           |
| Zum Anfang des aktuellen/vorherigen Untertitels springen                     | ↑           |

### Tastaturkürzel für die <a href={new URL('?view=settings#playback', project.urls.app).href}>Wiedergabegeschwindigkeit</a> {#playback-rate-keyboard-shortcuts}

| Verhalten              | Standardkürzel   |
| ---------------------- | ---------------- |
| Wiedergabegeschwindigkeit erhöhen | Ctrl + Shift + ] |
| Wiedergabegeschwindigkeit verringern | Ctrl + Shift + [ |

### Tastaturkürzel für den <a href={new URL('?view=settings#playback', project.urls.app).href}>Untertitelversatz</a> {#subtitle-offset-keyboard-shortcuts}

| Verhalten                                                                | Standardkürzel   |
| ------------------------------------------------------------------------ | ---------------- |
| Untertitelversatz anpassen, damit der vorherige Untertitel am aktuellen Zeitstempel liegt | Ctrl + ← |
| Untertitelversatz anpassen, damit der nächste Untertitel am aktuellen Zeitstempel liegt   | Ctrl + → |
| Untertitelversatz um +100 ms anpassen                                   | Ctrl + Shift + ← |
| Untertitelversatz um -100 ms anpassen                                   | Ctrl + Shift + → |
| Untertitelversatz zurücksetzen                                           | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotation</a>-Tastaturkürzel {#annotation-keyboard-shortcuts}

| Verhalten                         | Standardkürzel   |
| --------------------------------- | ---------------- |
| Statistiken öffnen               | Q + S            |
| Zum nächsten Wort springen       | Q + E            |
| Zum vorherigen Wort springen     | Q + W            |
| Wort unter dem Mauszeiger als ausgereift markieren | Q + 5       |
| Zum nächsten ausgereiften Wort springen |              |
| Zum vorherigen ausgereiften Wort springen |            |
| Wort unter dem Mauszeiger als jung markieren | Q + 4             |
| Zum nächsten jungen Wort springen |                    |
| Zum vorherigen jungen Wort springen |                  |
| Wort unter dem Mauszeiger als Wort mit abgeschlossener Lernphase markieren | Q + 3 |
| Zum nächsten Wort mit abgeschlossener Lernphase springen | |
| Zum vorherigen Wort mit abgeschlossener Lernphase springen | |
| Wort unter dem Mauszeiger als im Lernprozess markieren | Q + 2      |
| Zum nächsten Wort im Lernprozess springen |             |
| Zum vorherigen Wort im Lernprozess springen |           |
| Wort unter dem Mauszeiger als unbekannt markieren | Q + 1          |
| Zum nächsten unbekannten Wort springen |                 |
| Zum vorherigen unbekannten Wort springen |               |
| Wort unter dem Mauszeiger als nicht erfasst markieren | Q + 0      |
| Zum nächsten nicht erfassten Wort springen |           |
| Zum vorherigen nicht erfassten Wort springen |         |
| Wort unter dem Mauszeiger als ignoriert umschalten | Q + I         |
| Zum nächsten ignorierten Wort springen |                |
| Zum vorherigen ignorierten Wort springen |              |

### Spulintervall (Sekunden) {#seek-interval-seconds}

Legt das Intervall für die [Spul-Tastaturkürzel](#seek-keyboard-shortcuts) fest.

### Nach „Zum Anfang des aktuellen/vorherigen Untertitels springen“ immer abspielen {#always-play-on-subtitle-seek}

Anstatt den aktuellen Wiedergabezustand beizubehalten, wird bei Verwendung des [Spul-Tastaturkürzels](#seek-keyboard-shortcuts) zum Anfang des aktuellen oder vorherigen Untertitels immer abgespielt. Das spart einen Tastendruck.

### Schrittweite der Geschwindigkeitsanpassung {#playback-speed-adjust-step}

Schrittweite für die [Tastaturkürzel](#playback-rate-keyboard-shortcuts) zum Erhöhen oder Verringern der Wiedergabegeschwindigkeit.

### Erweiterungskürzel {#extension-shortcuts}

Wenn die Browsererweiterung installiert ist, sind einige Mining-Tastaturkürzel (z. B. aktuellen Untertitel auswerten oder aktuellen Untertitel auswerten und den Anki-Dialog öffnen) als Browserbefehle statt als gewöhnliche Tastaturereignis-Listener implementiert. Sie können nur im Editor für Erweiterungskürzel des Browsers bearbeitet werden.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Tastaturkürzel für Erweiterungen verwalten`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotation</a> {#annotation}

### Wörterbrowser {#word-browser}

:::info
Nur lokale Wörter können bearbeitet oder gelöscht werden. Externe Quellen sind schreibgeschützt und können nur über die [Synchronisierung](#re-build-anki-word-database) aktualisiert werden.
:::

Öffnet den Wörterbrowser, in dem Sie alle Wörter Ihrer lokalen und mit Anki synchronisierten Wörterdatenbank ansehen und verwalten können.

:::tip
Sie können Wörter in jeder Schrift der Sprache nachschlagen (z. B. Romaji, Hiragana, Katakana oder Kanji für Japanisch).

Einige gängige Ersetzungen zur Verbesserung der Bedienbarkeit erfolgen ebenfalls automatisch, etwa `e -> é` oder `ss -> ß`.
:::

### Wörter importieren {#import-words}

Importiert Wörter in die **lokale Wörterdatenbank** von asbplayer.

Importierte Wörter gelten als lokal und haben bei der Bestimmung des Wortstatus Vorrang vor externen Quellen.

Im Importdialog können Sie beliebigen Text einfügen (asbplayer zerlegt ihn in Wörter) und zuvor exportierte Dateien importieren.

:::tip
Sie können mit dem Mauszeiger auf Wörter zeigen und ihren Status mithilfe der [Annotation-Tastaturkürzel](#annotation-keyboard-shortcuts) lokal ändern.
:::

### Wörter exportieren {#export-words}

Exportiert Ihre lokale Wörterdatenbank, damit Sie eine Sicherung erstellen, sie auf ein anderes Gerät übertragen oder zwischen Website und Erweiterung teilen können.

### Anki-Wörterdatenbank neu erstellen {#re-build-anki-word-database}

Erstellt den lokalen Cache mit Wortstatusinformationen aus Anki oder baut ihn neu auf.

:::tip
Der Cache wird während der Wiedergabe auch automatisch aktualisiert, wenn eine Spur aktiviert und Anki erreichbar ist.

Diese Schaltfläche ist deaktiviert, wenn Ihre Annotationseinstellungen nicht von der [Anki-Integration profitieren](../common-issues.md#enable-or-disable-annotation-for-a-track).

Um die Einträge der Anki-Wörterdatenbank für eine Spur zu löschen, [führen Sie diese Schritte aus](../common-issues.md#clear-anki-word-database).
:::

### WaniKani-Wörterdatenbank neu erstellen {#re-build-wanikani-word-database}

Erstellt den lokalen Cache mit Vokabelinformationen aus WaniKani oder baut ihn neu auf.

:::tip
Der Cache wird während der Wiedergabe auch automatisch aktualisiert, wenn eine Spur aktiviert und ein API-Token konfiguriert ist.

Diese Schaltfläche ist deaktiviert, wenn Ihre Annotationseinstellungen nicht von der [WaniKani-Integration profitieren](../common-issues.md#enable-or-disable-annotation-for-a-track).

Um die Einträge der WaniKani-Wörterdatenbank für eine Spur zu löschen, [führen Sie diese Schritte aus](../common-issues.md#clear-wanikani-word-database).
:::

### Untertitelspur {#annotation-track}

Wählt die Untertitelspur aus, für die diese Annotationseinstellungen gelten.

### Untertitel anhand bekannter Wörter einfärben {#colorize-subtitles-based-on-known-words}

Aktiviert die Gestaltung anhand des Wortstatus (nicht erfasst, unbekannt, im Lernprozess usw.). Dafür werden die konfigurierten [**Wortfarbstile**](#word-color-style) und [**Wortstatusfarben**](#word-status-colors) verwendet.

### Statistiken automatisch erstellen {#generate-statistics-automatically}

Erstellt beim Laden automatisch Statistiken für das aktuelle Medium. Dadurch wird auch die Statistik-Overlay-Oberfläche aktiviert. Das [Tastaturkürzel zum Öffnen der Statistiken](#annotation-keyboard-shortcuts) befindet sich in der Gruppe „Annotation“.

### Wortlesungen anzeigen {#display-word-readings}

Zeigt abhängig von Wortstatus und Wortzuständen Lesungen (z. B. Furigana) über Wörtern an.

### Worthäufigkeit anzeigen {#display-word-frequency}

Zeigt abhängig von Status und Wortzuständen unter den Wörtern einen rangbasierten Häufigkeitswert an (sofern verfügbar). So können Sie entscheiden, welche Wörter Sie zuerst lernen möchten.

:::tip
Für Häufigkeitsangaben muss in Ihrer Yomitan-Instanz mindestens ein rangbasiertes Häufigkeitswörterbuch verfügbar sein. Wenn ein Häufigkeitswörterbuch seinen Modus nicht angibt, versucht asbplayer zu erkennen, ob es rangbasiert ist, und verwendet es entsprechend.

Wenn für ein Wort mehrere Häufigkeitswerte verfügbar sind, wird der niedrigste (häufigste) Wert verwendet.
:::

### Tonhöhenakzent anzeigen (Japanisch) {#display-pitch-accent-japanese}

:::note
Damit der Tonhöhenakzent auf Furigana angezeigt wird, muss [**Wortlesungen anzeigen**](#display-word-readings) aktiviert sein.
:::

Zeigt abhängig von Status und Wortzuständen den Tonhöhenakzent auf Furigana oder direkt auf Kana an.

:::info
Wenn entsprechende Daten verfügbar sind, richtet sich der Tonhöhenakzent eines an ein Wort angehängten Partikels nach dem Tonhöhenakzent des Wortes.

Normalerweise erhalten nur Kanji Furigana-Lesungen. Wenn diese Funktion aktiviert ist, erhalten alle Zeichen eines Wortes Furigana-Lesungen, sofern mindestens ein Zeichen ein Kanji ist. So lässt sich der Tonhöhenakzent zusammengesetzter Wörter leichter ablesen.
:::

### Wortdefinitionen anzeigen {#display-word-definitions}

Legt anhand des Wortstatus und der Wortzustände fest, ob kurze Definitionen oder Erklärungen für Wörter angezeigt werden.

### Suchstrategie für Wortfelder {#word-field-search-strategy}

Legt fest, wie asbplayer Wörter aus Untertiteln mit Ihren bekannten Wörtern abgleicht.

- **Exakte Form erfasst**: Das Feld muss die genaue Wortform aus dem Untertitel enthalten (running -> running).
- **Lemma erfasst**: Das Lemma bzw. die Grundform muss erfasst sein (running -> run).
- **Lemma oder exakte Form erfasst**: Das Wort gilt als erfasst, wenn entweder das Lemma oder die exakte Form übereinstimmt (eine der obigen Optionen).
- **Beliebige Form erfasst**: Das Wort gilt als erfasst, wenn eine verwandte Form übereinstimmt (running -> run, ran, runs usw.).

Wenn **Lemma erfasst**, **Lemma oder exakte Form erfasst** oder **Beliebige Form erfasst** ausgewählt ist, legt [**Schriftübergreifender Sprachabgleich**](#match-across-language-scripts) fest, ob der Lemma-Abgleich zwischen verschiedenen Schriften einer Sprache wechseln darf (z. B. Kanji, Hiragana und Katakana).

### Priorität der Kartenauswahl {#card-choice-priority}

Wenn mehrere Anki-Karten zu einem Wort passen, legt diese Einstellung fest, welche Karte zur Bestimmung des Wortstatus verwendet wird:

- **Feld enthält exakte Form** (bei mehreren Treffern wird die am besten bekannte Karte verwendet)
- **Feld enthält Lemma** (bei mehreren Treffern wird die am besten bekannte Karte verwendet)
- **Am besten bekannte Karte**
- **Am wenigsten bekannte Karte**

### Suchstrategie für Satzfelder {#sentence-field-search-strategy}

Legt fest, wie asbplayer Ihre konfigurierten [**Anki-Satzfelder**](#anki-sentence-fields) durchsucht. Es gelten dieselben Optionen wie bei der [**Suchstrategie für Wortfelder**](#word-field-search-strategy).

Wenn **Lemma erfasst**, **Lemma oder exakte Form erfasst** oder **Beliebige Form erfasst** ausgewählt ist, legt [**Schriftübergreifender Sprachabgleich**](#match-across-language-scripts) fest, ob der Lemma-Abgleich zwischen verschiedenen Schriften einer Sprache wechseln darf (z. B. Kanji, Hiragana und Katakana).

:::tip
Da Sätze mehrere Wörter enthalten und der Kartenstatus dadurch für einzelne Wörter weniger aussagekräftig ist, sollte diese Option auf **Exakte Form erfasst** bleiben, es sei denn, Sie verwenden ausschließlich Satzkarten.
:::

### Schriftübergreifender Sprachabgleich {#match-across-language-scripts}

Legt fest, ob der Lemma-Abgleich zwischen verschiedenen Schriften einer Sprache wechseln darf (z. B. Kanji, Hiragana und Katakana).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### Yomitan-API-URL {#yomitan-api-url}

URL des Yomitan-API-Endpunkts. Wenn die URL nicht erreichbar oder ungültig ist, zeigt asbplayer einen Fehler an.

:::tip
Sie benötigen eine konfigurierte [Yomitan](https://yomitan.wiki/)-Instanz und die [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Yomitan-Parser {#yomitan-parser}

Wählt den Yomitan-Parser aus, der den Untertiteltext in Wörter zerlegt:

- **Scanning Parser (alle Sprachen)**: Yomitans interner Parser, der die längsten Wörter aus Ihren Wörterbüchern erkennt.
- **MeCab (Japanisch)**: Verwendet MeCab, um japanischen Text zu parsen. Yomitan muss mit MeCab-Unterstützung konfiguriert sein, vorzugsweise mit mindestens einem UniDic-Wörterbuch.

### Maximale Wortlänge {#max-word-length}

:::info
Diese Einstellung gilt nur für den Scanning Parser.
:::

Begrenzt die maximale Wortlänge, die asbplayer bei der Annotation zu erkennen bzw. zu zerlegen versucht.

:::tip
Bei einem zu niedrigen Wert werden längere Wörter übersehen. Ein zu hoher Wert kann die Leistung beeinträchtigen.
:::

### Anki-Decks (optional) {#anki-decks}

Beschränkt Anki-Suchen auf die ausgewählten Decks. Wenn das Feld leer ist, durchsucht asbplayer alle Decks.

### Anki-Wortfelder {#anki-word-fields}

Anki-Notizfelder, die _nur_ das Zielwort enthalten. Dies ist die empfohlene Methode, um Statusinformationen aus Anki zu beziehen.

### Anki-Satzfelder {#anki-sentence-fields}

Anki-Notizfelder, die einen Satz enthalten (häufig in Satz-Decks verwendet). Sie dienen als Ersatz, wenn es keine Karten mit dem Zielwort in den [**Anki-Wortfeldern**](#anki-word-fields) gibt.

### Stabilität/Intervall ausgereifter Anki-Karten (Tage) {#mature-anki-stability-interval}

Legt den Grenzwert (in Tagen) fest, ab dem eine Anki-Karte als **ausgereift** statt als niedrigerer Reifestatus gilt.

- **Nicht erfasst**: nicht in Anki gefunden.
- **Unbekannt**: in Anki mit `is:new` gefunden.
- **Im Lernprozess**: in Anki mit `is:learn` gefunden.
- **Lernphase abgeschlossen**: in Anki mit `-is:new -is:learn prop:s<{ceil(cutoff / 2)}` gefunden.
- **Jung**: in Anki mit `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}` gefunden.
- **Ausgereift**: in Anki mit `-is:new -is:learn prop:s>=${cutoff}` gefunden.

:::tip
Wenn für eine Karte die FSRS-Stabilität verfügbar ist (die Karte wurde zuletzt mit aktiviertem FSRS wiederholt), wird sie anstelle des Intervalls verwendet.

Weitere Informationen zu Wortstatus finden Sie unter [**Wortstatusfarben**](#word-status-colors).
:::

### Ausgesetzte Anki-Karten behandeln als {#treat-suspended-anki-cards-as}

Legt fest, wie **ausgesetzte** Karten beim Ermitteln des Wortstatus aus Anki behandelt werden:

- **Normal**: Anki-Status unverändert übernehmen.
- Oder wählen Sie einen bestimmten Wortstatus (z. B. **Ausgereift**, **Unbekannt**), dem ausgesetzte Karten zugeordnet werden sollen.

:::tip
Wenn nur einige Karten für ein Wort ausgesetzt sind, werden sie herausgefiltert und der Wortstatus wird anhand der nicht ausgesetzten Karten bestimmt.

Weitere Informationen zu Wortstatus finden Sie unter [**Wortstatusfarben**](#word-status-colors).
:::

### WaniKani-API-Token {#wanikani-api-token}

Verwenden Sie das WaniKani-API-Token, um Ihre bekannten Wörter mit WaniKani zu synchronisieren. Richten Sie es gemäß der Anleitung unter [Annotation](../guides/annotation.md#setup) ein.

asbplayer verwendet nur die Subjekttypen `vocabulary` und `kana_vocabulary`, um bekannte Wörter zu bestimmen. Der Status richtet sich nach der SRS-Stufe des Subjekts im konfigurierten [Spaced-Repetition-System](https://docs.api.wanikani.com/20170710/#spaced-repetition-system). Die WaniKani-Status werden wie folgt bestimmt:

- **Nicht erfasst**: nicht in WaniKani gefunden.
- **Unbekannt**: in WaniKani mit einer SRS-Stufe unter `Starting stage` gefunden.
- **Im Lernprozess**: in WaniKani mit einer SRS-Stufe ab `Starting stage`, aber unter `Passing stage` gefunden.
- **Lernphase abgeschlossen**: in WaniKani mit einer SRS-Stufe in der unteren Hälfte der Stufen zwischen `Passing stage` und `Burning stage` gefunden.
- **Jung**: in WaniKani mit einer SRS-Stufe in der oberen Hälfte der Stufen zwischen `Passing stage` und `Burning stage` gefunden.
- **Ausgereift**: in WaniKani mit einer SRS-Stufe ab `Burning stage` gefunden.

:::tip
Weitere Informationen zu Wortstatus finden Sie unter [**Wortstatusfarben**](#word-status-colors).
:::

### Wortfarbstil {#word-color-style}

Legt fest, wie Statusfarben bei [**Untertitel anhand bekannter Wörter einfärben**](#colorize-subtitles-based-on-known-words) auf Wörter angewendet werden:

- **Text**: Die Farbe des Wortes wird geändert.
- **Hintergrund**: Die Farbe hinter dem Wort wird geändert.
- **Unterstreichen**: Das Wort wird in der Statusfarbe unterstrichen.
- **Überstreichen**: Das Wort wird in der Statusfarbe überstrichen.
- **Kontur**: Das Wort erhält eine Kontur in der Statusfarbe.

:::tip
Wenn Sie **Kontur** verwenden, müssen Sie für optimale Ergebnisse möglicherweise die [**Untertitelkonturstärke**](#subtitle-appearance-track) auf `0` setzen.
:::

### Stärke {#thickness}

Legt die Stärke (in Pixeln) der Gestaltung **Unterstreichen**, **Überstreichen** und **Kontur** fest.

### Wörter beim Darüberfahren hervorheben {#highlight-words-on-hover}

:::info
Diese Hervorhebung zeigt an, ob asbplayer den Fokus hat, um Tastaturkürzel zu erkennen. Wenn die Hervorhebung nicht erscheint, müssen Sie möglicherweise auf den Player klicken, um ihn zu fokussieren. Tastaturkürzel funktionieren je nach Fokus entweder im Video oder in der Untertitelliste, jedoch nicht gleichzeitig in beiden.

Die Hervorhebung soll vor allem zeigen, welches Wort Sie gerade zum Erfassen anvisieren. Daher muss das Ziel des Mauszeigers ein Wort sein und die Einfärbung aktiviert sein.
:::

Wenn diese Option aktiviert ist, wird ein Wort beim Darüberfahren hervorgehoben. So können Sie erkennen, wie Yomitan es zerlegt hat.

### Wortfarbe nur beim Darüberfahren anzeigen {#only-display-word-color-on-hover}

:::note
Diese Einstellung gilt nur, wenn [**Untertitel anhand bekannter Wörter einfärben**](#colorize-subtitles-based-on-known-words) aktiviert ist.
:::

Wenn diese Option für das Video oder die Untertitelliste aktiviert ist, sind Wortfarben standardmäßig ausgeblendet und erscheinen erst, wenn Sie im Video bzw. in der Untertitelliste mit dem Mauszeiger über den Untertiteltext fahren.

### Wortlesung nur beim Darüberfahren anzeigen {#only-display-word-reading-on-hover}

:::note
Diese Einstellung gilt nur, wenn [**Wortlesungen anzeigen**](#display-word-readings) aktiviert ist.
:::

Wenn diese Option für das Video oder die Untertitelliste aktiviert ist, sind Wortlesungen standardmäßig ausgeblendet und erscheinen erst, wenn Sie im Video bzw. in der Untertitelliste mit dem Mauszeiger über den Untertiteltext fahren.

### Worthäufigkeit nur beim Darüberfahren anzeigen {#only-display-word-frequency-on-hover}

:::note
Diese Einstellung gilt nur, wenn [**Worthäufigkeit anzeigen**](#display-word-frequency) aktiviert ist.
:::

Wenn diese Option für das Video oder die Untertitelliste aktiviert ist, ist die Worthäufigkeit standardmäßig ausgeblendet und erscheint erst, wenn Sie im Video bzw. in der Untertitelliste mit dem Mauszeiger über den Untertiteltext fahren.

### Wortdefinitionen nur beim Darüberfahren anzeigen {#only-display-word-definitions-on-hover}

:::note
Diese Einstellung gilt nur, wenn [**Wortdefinitionen anzeigen**](#display-word-definitions) aktiviert ist.
:::

Wenn diese Option für das Video oder die Untertitelliste aktiviert ist, sind Wortdefinitionen standardmäßig ausgeblendet und erscheinen erst, wenn Sie im Video bzw. in der Untertitelliste mit dem Mauszeiger über den Untertiteltext fahren.

### Tonhöhenakzent nur beim Darüberfahren anzeigen {#only-display-pitch-accent-on-hover}

:::note
Diese Einstellung gilt nur, wenn [**Tonhöhenakzent anzeigen (Japanisch)**](#display-pitch-accent-japanese) aktiviert ist.
:::

Wenn diese Option für das Video oder die Untertitelliste aktiviert ist, ist der Tonhöhenakzent standardmäßig ausgeblendet und erscheint erst, wenn Sie im Video bzw. in der Untertitelliste mit dem Mauszeiger über den Untertiteltext fahren.

### Größe der Wortlesung {#word-reading-size}

Legt die Größe der Wortlesungen (Furigana) in em-Einheiten fest (in % der Untertitelschriftgröße).

### Größe der Worthäufigkeit {#word-frequency-size}

Legt die Größe der Worthäufigkeit in em-Einheiten fest (in % der Untertitelschriftgröße).

### Größe der Wortdefinition {#word-definition-size}

Legt die Größe der Wortdefinitionen in em-Einheiten fest (in % der Untertitelschriftgröße).

### Größe des Tonhöhenakzents {#pitch-accent-size}

Legt die Größe des Tonhöhenakzents in em-Einheiten fest (in % der Untertitelschriftgröße).

### Wortstatusfarben {#word-status-colors}

Für jeden Status können Sie die von [**Wortfarbstil**](#word-color-style) verwendete Farbe und Transparenz festlegen und ihn einzeln aktivieren oder deaktivieren.

- **Nicht erfasst**: Das Wort ist nicht in Ihrer asbplayer-Datenbank enthalten.
- **Unbekannt**: Das Wort ist enthalten, gilt aber als unbekannt.
- **Im Lernprozess**: Das Wort wird derzeit gelernt.
- **Lernphase abgeschlossen**: Das Wort hat die Lernphase abgeschlossen.
- **Jung**: Das Wort ist bekannt, aber noch nicht ausgereift.
- **Ausgereift**: Das Wort ist vollständig bekannt.

:::tip
Sie können Statusgestaltungen nach Wunsch deaktivieren, zum Beispiel **Ausgereift**, um die Anzeige übersichtlicher zu halten.

Sie können Farben wiederverwenden (z. B. für **Lernphase abgeschlossen** und **Jung**), wenn Sie bestimmte Status nicht unterscheiden möchten.

Wie der Status von Anki-Karten bestimmt wird, erfahren Sie unter [**Stabilität/Intervall ausgereifter Anki-Karten (Tage)**](#mature-anki-stability-interval).
Wie WaniKani-Status bestimmt werden, erfahren Sie unter [**WaniKani-API-Token**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Wiedergabe</a> {#playback}

### Untertitelspuren, die von Wiedergabemodi und Tastaturkürzeln betroffen sind {#playback-subtitle-tracks}

Legt fest, welche Spuren bei Verwendung der Tastaturkürzel für [Untertitel](#subtitles-keyboard-shortcuts) und [Spulen](#seek-keyboard-shortcuts) oder bei Wiedergabemodi berücksichtigt werden. Wenn beispielsweise der verdichtete Modus aktiviert ist, gilt jeder Bereich der Zeitachse ohne Untertitel in den hier angegebenen Spuren als zu überspringender Leerraum.

### Beim Darüberfahren über Untertitel automatisch pausieren {#auto-pause-when-mousing-over-subtitles}

Legt fest, wie Auto-Pause beim Darüberfahren über Untertitel funktioniert. „Aktiviert mit automatischer Fortsetzung“ bedeutet, dass die Wiedergabe automatisch fortgesetzt wird, sobald Sie den Mauszeiger von den Untertiteln wegbewegen.

### Wiedergabemodi {#playback-modes}

Wiedergabemodi lassen sich mit den [Wiedergabe-Tastaturkürzeln](#playback-keyboard-shortcuts) umschalten.

### Wiedergabegeschwindigkeit {#playback-rate}

Legt die normale Wiedergabegeschwindigkeit des Mediums fest, einschließlich der Geschwindigkeit innerhalb von Untertiteln, während Vorspulen aktiviert ist. Jede Wiedergabe beginnt mit dieser Geschwindigkeit. Verwenden Sie während der Wiedergabe die [Tastaturkürzel für die Wiedergabegeschwindigkeit](#playback-rate-keyboard-shortcuts), um sie anzupassen.

### Meldung bei Änderung der Wiedergabegeschwindigkeit anzeigen {#show-playback-rate-notification}

Zeigt eine Meldung an, wenn sich die Wiedergabegeschwindigkeit außerhalb des Vorspulmodus ändert.

### Auto-Pause-Einstellung {#auto-pause-preference}

Legt fest, ob bei aktivierter Auto-Pause am Anfang, am Ende oder an beiden Rändern eines Untertitels pausiert wird. Sind beide Ränder und Wiederholen aktiviert, pausiert die Wiedergabe vor jeder Wiederholung am Ende des Untertitels. Die Pause am Anfang wird ausgelassen, damit nicht zweimal hintereinander pausiert wird.

### Anzahl der Wiederholungen {#repeat-count-preference}

Legt fest, wie oft jeder Untertitel wiederholt wird, bevor die Wiedergabe fortgesetzt wird. Bei `0` wird unbegrenzt oft wiederholt.

### Wiederholungen vor dem Einblenden der Untertitel {#repeats-before-showing-subtitles}

Blendet Untertitel in einem Wiederholungsabschnitt aus, bis dieser so oft wiederholt wurde. Bei `0` werden Untertitel nicht ausgeblendet, bei `1` sind sie ab der ersten Wiederholung wieder sichtbar.

### Start- und Endversatz für Untertitelereignisse {#subtitle-trigger-start-and-end-offsets}

Verschiebt die von Auto-Pause und Wiederholen verwendeten Start- und Endauslöser der Untertitel in Millisekunden. Diese Versätze werden nach dem globalen Untertitelversatz angewendet. Start- und Endversatz lassen sich unabhängig voneinander einstellen. Positive Werte lösen Wiedergabeeffekte später, negative Werte früher aus. Jede verschobene Kante wird durch die Grenzen des Mediums und benachbarte Untertitelereignisse begrenzt. Wenn sich verschobener Start und verschobenes Ende überkreuzen, werden ihre zeitlichen Rollen vertauscht.

### Mindestintervall zum Vorspulen {#fast-forward-minimum-skip-interval}

Spult die gesamte Lücke zwischen Untertiteln vor, wenn sie mindestens so lang ist. Kürzere Lücken werden mit normaler Wiedergabegeschwindigkeit abgespielt.

### Vorspulgeschwindigkeit {#fast-forward-playback-rate}

Legt fest, wie schnell im Vorspulmodus vorgespult wird.

### Mindestintervall zum Überspringen bei verdichteter Wiedergabe {#condensed-playback-minimum-skip-interval}

Bei aktivierter verdichteter Wiedergabe wird nur dann zum nächsten Untertitel gesprungen, wenn er mindestens so viel Zeit entfernt ist.

### Start- und Endversatz für Untertitellücken {#subtitle-gap-trigger-start-and-end-offsets}

Verschiebt die von Vorspulen und verdichteter Wiedergabe verwendeten Auslöser für Untertitellücken. Der Startversatz der Lücke ist nicht negativ und verschiebt den Auslöser nach dem Ende des Untertitels nach hinten. Der Endversatz ist nicht positiv und verschiebt den Auslöser vor dem nächsten Untertitel nach vorn. Jede Lücke wird durch die Grenzen des Mediums und benachbarter Untertitelereignisse begrenzt.

### Fortsetzungsmodus der Auto-Pause {#auto-pause-resume-mode}

Legt fest, wie eine automatische Pause endet.

- **Manuell**: Die Wiedergabe bleibt pausiert, bis Sie sie fortsetzen.

- **Fest**: Jede automatische Pause dauert gleich lang.
  - Über [Feste Pausendauer](#fixed-pause-duration) und [Verzögerung der Fortsetzung nach Auto-Pause](#resume-delay-after-auto-pause) konfigurierbar.

- **Untertitellänge**: Die Pausendauer wird anhand der Zeichenanzahl des Untertitels berechnet. Gezählt werden nur Untertitel auf durchsuchbaren Spuren. Eine zusätzlich zur Zielsprache geladene Übersetzungsspur verlängert die Pause daher nicht.
  - Über [Mindestpausendauer](#minimum-pause-duration), [Maximalpausendauer](#maximum-pause-duration), [Pausenzeit pro Zeichen](#pause-time-per-character) und [Verzögerung der Fortsetzung nach Auto-Pause](#resume-delay-after-auto-pause) konfigurierbar.

### Feste Pausendauer {#fixed-pause-duration}

Legt fest, wie lange eine automatische Pause im Modus **Fest** dauert.

### Mindestpausendauer {#minimum-pause-duration}

Legt die kürzeste Pause im Modus **Untertitellänge** fest, unabhängig von der Zeichenanzahl des Untertitels.

### Maximalpausendauer {#maximum-pause-duration}

Legt die längste Pause im Modus **Untertitellänge** fest. Bei `0` gibt es keine Obergrenze. Ein Wert ungleich null darf nicht unter der Mindestpausendauer liegen.

### Pausenzeit pro Zeichen {#pause-time-per-character}

Legt die Anzahl der Millisekunden pro Zeichen im Modus **Untertitellänge** fest. Das Produkt aus Zeichenanzahl und diesem Wert wird auf die Mindest- und Maximalpausendauer begrenzt.

### Verzögerung der Fortsetzung nach Auto-Pause {#resume-delay-after-auto-pause}

In den Modi **Fest** und **Untertitellänge** besteht eine automatische Pause aus zwei Phasen: Der Untertitel wird für die konfigurierte Pausendauer angezeigt und anschließend ausgeblendet, während die Wiedergabe für die Fortsetzungsverzögerung pausiert bleibt. Diese Einstellung legt die Dauer der zweiten Phase fest.

### Untertitel anzeigen {#show-subtitles}

- **Wenn fällig**: Untertitel werden angezeigt, solange ihr Zeitintervall aktiv ist.

- **Während einer Pause**: Untertitel werden nur angezeigt, wenn sie fällig sind und die Wiedergabe pausiert ist.

- **Während manueller Pause**: Untertitel werden nur angezeigt, wenn sie fällig sind und die Wiedergabe manuell pausiert wurde.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Wiedergabe > Annotation</a> {#playback-annotation}

Diese Einstellungen verwenden Wortstatus, Wortzustände und Häufigkeiten aus [Annotation](#annotation) für die ausgewählte Untertitelspur. Die Regeln für Auto-Pause, verdichtete Wiedergabe, Vorspulen und Wiederholen gelten, solange die jeweiligen Wiedergabemodi aktiviert sind. **Kein Wortfilter** bedeutet, dass für diese Spur keine Status oder Zustände ausgewählt sind. Regeln gelten pro Spur: Eine durchsuchbare Spur ohne ausgewählte Status oder Zustände für einen dieser Modi behält das übliche Verhalten des Modus bei, auch wenn gleichzeitig eine Spur mit Regeln abgespielt wird.

### Untertitelspur {#playback-annotation-track}

Wählt die Untertitelspur aus, deren Wiedergabeeinstellungen für Annotation Sie bearbeiten. Die ausgewählte Spur gilt auch im Tab „Annotation“.

### Beim Pausieren das erste passende Wort auswählen {#select-first-matching-word-on-pause}

Wählt bei jeder Pause das erste Wort aus, das einem der ausgewählten Status oder Zustände entspricht. Das gilt auch für manuelle Pausen und nach dem Spulen während einer Pause. Lassen Sie die Auswahl leer, um dieses Verhalten zu deaktivieren. Die Auswahl erfolgt im Videoplayer oder, wenn kein Video geladen oder verbunden ist, im Untertitelplayer.

Wenn eine [Annotationsregel für Auto-Pause](#auto-pause-subtitles-containing-these-words) die Pause auslöst, wird stattdessen das passende Wort ausgewählt. Dieses Dropdown-Menü steuert weiterhin die Auswahl bei manuellen Pausen.

Jede der folgenden Wortregeln hat eine eigene Auswahl für Status und Zustände sowie eigene Grenzen für Wortanzahl und Häufigkeit. Ein Wort muss einen ausgewählten Status oder Zustand haben und beide Grenzwerte erfüllen.

### Untertitel mit diesen Wörtern automatisch pausieren {#auto-pause-subtitles-containing-these-words}

Wenn der Auto-Pause-Modus aktiviert ist, wird nur bei Untertiteln mit einem passenden Wort pausiert und das erste passende Wort ausgewählt. Bei automatischen Pausen hat dies Vorrang vor [**Beim Pausieren das erste passende Wort auswählen**](#select-first-matching-word-on-pause). Bei manuellen Pausen gilt weiterhin die dortige Einstellung.

### Untertitel mit diesen Wörtern wiederholen {#repeat-subtitles-containing-these-words}

Wenn der Wiederholmodus aktiviert ist, werden nur Untertitel mit einem passenden Wort wiederholt.

### Untertitel mit diesen Wörtern im verdichteten Modus abspielen {#play-subtitles-containing-these-words-in-condensed-mode}

Wenn der verdichtete Modus aktiviert ist, bleiben Untertitel mit einem passenden Wort in der verdichteten Zeitachse erhalten. Andere Untertitel werden übersprungen.

### Untertitel mit diesen Wörtern im Vorspulmodus mit normaler Geschwindigkeit abspielen {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Wenn der Vorspulmodus aktiviert ist, werden Untertitel mit einem passenden Wort in normaler Geschwindigkeit abgespielt. Bei anderen Untertiteln wird vorgespult.

### Vorspulgeschwindigkeit anhand des Sprachverständnisses anpassen {#adjust-fast-forward-rate-by-comprehension}

Wenn der Vorspulmodus aktiviert ist, wird die Geschwindigkeit innerhalb eines Untertitels anhand des Sprachverständniswerts des Satzes gewählt.

Beim Wert [**Mindestverständnis**](#minimum-comprehension) oder darunter gilt die normale Wiedergabegeschwindigkeit; bei 100 % gilt die konfigurierte Vorspulgeschwindigkeit. Dazwischen werden die Geschwindigkeiten interpoliert.

Wenn Sie die Geschwindigkeit eines verständnisgesteuerten Untertitels ändern, wird die konfigurierte Vorspulgeschwindigkeit angepasst und anschließend anhand des Sprachverständnisses die angewendete Geschwindigkeit neu berechnet. Das gilt auch, wenn der Untertitel aufgrund des Sprachverständnisses mit normaler Geschwindigkeit abgespielt wird. Tastaturkürzel und Geschwindigkeitssteuerung des Players verhalten sich gleich. Die normale Geschwindigkeit bleibt unverändert.

### Mindestverständnis {#minimum-comprehension}

Legt fest, ab welchem Prozentwert die Beschleunigung beginnt (0–99 %, standardmäßig 60 %).

### Diese Wörter während der Wiedergabe anzeigen {#show-these-words-during-playback}

Wählen Sie die Status und Zustände aus, deren Wörter sichtbar bleiben sollen.

### Den gesamten Untertitel ausblenden, wenn mindestens dieser Wortanteil verborgen würde {#whole-subtitle-hidden-percentage}

Blendet den gesamten Untertitel aus, wenn der Anzeigeregel zufolge mindestens dieser Anteil der Wörter verborgen wäre. Bei **80 %** wird beispielsweise ein Untertitel mit fünf Wörtern vollständig ausgeblendet, wenn vier Wörter verborgen würden. Das gilt auch für das eine Wort, das angezeigt werden sollte. Satzzeichen und andere Zeichen, die keine Buchstaben sind, werden nicht mitgezählt.

### Nicht passende Wörter einzeln ausblenden {#hide-non-matching-words-individually}

Wenn diese Option aktiviert ist, werden Wörter, die die Anzeigeregel nicht erfüllen, einzeln ausgeblendet, solange der Untertitel unter dem Grenzwert für den gesamten Untertitel liegt. Andernfalls bleibt der gesamte Untertitel sichtbar, bis der Grenzwert erreicht ist.

### Mindestanzahl Wörter pro ausgewählter Kategorie {#minimum-words-per-selected-category}

Jede ausgewählte Kategorie (etwa **Nicht erfasst** oder **Ignoriert**) wird innerhalb eines Untertitels einzeln gezählt. Liegt ihre Anzahl unter diesem Grenzwert, lösen Wörter dieser Kategorie die Regel nicht aus. Bei `0` ist die Begrenzung deaktiviert.

### Höchstanzahl Wörter pro ausgewählter Kategorie {#maximum-words-per-selected-category}

Jede ausgewählte Kategorie (etwa **Nicht erfasst** oder **Ignoriert**) wird innerhalb eines Untertitels einzeln gezählt. Übersteigt ihre Anzahl diesen Grenzwert, lösen Wörter dieser Kategorie die Regel nicht aus. Bei `0` ist die Begrenzung deaktiviert.

### Nur wenn die Worthäufigkeit mindestens {#only-when-word-frequency-is-at-least}

Ein passendes Wort muss mindestens diese Häufigkeit haben. Eine fehlende Häufigkeit wird als `1` gewertet. Bei `0` ist die Begrenzung deaktiviert.

### Nur wenn die Worthäufigkeit höchstens {#only-when-word-frequency-is-at-most}

Ein passendes Wort darf höchstens diese Häufigkeit haben. Eine fehlende Häufigkeit wird als `1` gewertet. Bei `0` ist die Begrenzung deaktiviert.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Streaming-Video</a> (nur Erweiterung) {#streaming-video}

Einstellungen für Streaming-Videos sind nur verfügbar, wenn die Browsererweiterung installiert ist.

### Beim Laden von Untertiteln auch die Untertitelliste in einem separaten Tab in der App öffnen {#open-subtitle-list-in-tab}

Öffnet beim Laden von Untertiteln in ein Videoelement die Website in einem separaten Tab und synchronisiert die geladenen Untertitel mit der Website.

### App-URL {#app-url}

Legt fest, von welcher Adresse die Erweiterung bestimmte Konfigurationen abruft und welche URL geöffnet wird, wenn Untertitel mit der in einem separaten Tab geöffneten Website synchronisiert werden. Im Wesentlichen ist dies die Website-URL.

### Steuerungs-Overlay aktivieren {#enable-controls-overlay}

Zeigt die Overlay-Oberfläche auf Videoelementen mit geladenen Untertiteln an.

### Untertitel anzeigen {#display-subtitles}

Zeigt geladene Untertitel auf Videoelementen an.

### Beim Mining Audio aufnehmen {#record-audio-when-mining}

Nimmt beim Mining eines Untertitels das von ihm abgedeckte Audio auf, damit es der Lernkarte hinzugefügt werden kann.

### Beim Mining einen Screenshot aufnehmen {#take-screenshot-when-mining}

Nimmt beim Mining eines Untertitels einen Screenshot auf, damit er der Lernkarte hinzugefügt werden kann.

### Screenshot beim Mining bereinigen {#clean-screenshot-when-mining}

Wenn beim Mining eines Untertitels Screenshots aktiviert sind, wird der Screenshot „bereinigt“, indem vor der Aufnahme alle HTML-Elemente über dem Videoelement entfernt werden.

### Screenshot beim Mining zuschneiden {#crop-screenshot-when-mining}

Schneidet beim Mining eines Untertitels den Screenshot auf das Videoelement zu.

### Bildaufnahmeformat {#streaming-image-capture-format}

Legt das Bildaufnahmeformat für Karten fest, die aus Streaming-Videos erstellt werden. Als zusätzliche Option steht „Animiertes WebP“ zur Verfügung. Dabei wird das im Tab abgespielte Video für den Zeitraum des Untertitels – einschließlich des Audio-Vorlaufs und -Nachlaufs – aufgenommen und statt eines einzelnen Screenshots als animiertes Bild gespeichert.

Animiertes WebP wird nur verwendet, wenn [Audio beim Mining aufnehmen](#record-audio-when-mining) aktiviert ist. Andernfalls wird wie gewohnt ein Screenshot aufgenommen. Die Einstellung gilt für alle Mining-Abläufe, bei denen Medien aufgenommen werden. Dazu gehört auch eine manuell mit dem Aufnahme-Tastaturkürzel gestartete und gestoppte Aufnahme, die alles bis zum Ende der Aufnahme (höchstens 30 Sekunden) erfasst. Es kann jeweils nur eine Aufnahme laufen. Animiertes WebP ist in Firefox nicht verfügbar, und DRM-geschützte Videos können nicht aufgenommen werden. Während der Clip aufgenommen wird, muss der Tab sichtbar bleiben, da Chrome ausgeblendete Tabs nicht rendert.

### Bildrate animierter Bilder {#animated-image-fps}

Legt fest, wie viele Einzelbilder pro Sekunde für animierte WebP-Bilder aufgenommen werden. Bei längeren Clips wird die Anzahl der Einzelbilder automatisch verringert, damit die Karte klein bleibt. Nur verfügbar, wenn das Bildaufnahmeformat „Animiertes WebP“ ausgewählt ist.

### Qualität animierter Bilder {#animated-image-quality}

Legt die Qualität jedes Einzelbilds animierter WebP-Bilder zwischen `0.1` und `1` fest. Höhere Werte verbessern die Bildqualität, führen aber zu einer größeren Datei. Nur verfügbar, wenn das Bildaufnahmeformat „Animiertes WebP“ ausgewählt ist.

### Untertiteldateien per Drag-and-drop zulassen {#allow-subtitle-file-drag-and-drop}

Erlaubt, Untertiteldateien per Drag-and-drop in Videoelemente zu ziehen.

### Erkannte Untertitel automatisch laden {#auto-load-detected-subtitles}

Wenn die automatische Untertitelerkennung auf der aktuellen Website unterstützt wird, werden die Untertitel automatisch geladen. Werden mehrere Spuren erkannt, wird die Spur der bevorzugten Sprache geladen. Als bevorzugte Sprache gilt die zuletzt geladene Sprache, für die das Kästchen „Diese Spurauswahl merken“ aktiviert war.

### Bei fehlgeschlagenem automatischem Laden erkannter Untertitel nachfragen {#prompt-on-subtitle-autoload-failure}

Wenn das automatische Laden von Untertiteln fehlschlägt, wird vor dem Versuch, erkannte Untertitel zu laden, nachgefragt.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Streaming-Video > Seiten</a> {#pages}

Einstellungen für seitenspezifische Integrationen wie YouTube, Netflix usw. asbplayer enthält vorkonfigurierte Standardeinstellungen für jede Seite. Im Abschnitt „Seiten“ können Sie diese ändern.

### Zielsprachcodes für maschinelle Übersetzung (nur YouTube) {#youtube-translation-languages}

Legt die Zielsprachen für die maschinelle Übersetzung von YouTube fest. Wenn Sie hier Sprachen angeben, erscheinen zusätzliche Spuren für jede Zielsprache in der Auswahl der Untertitelspuren.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Sonstiges</a> {#misc}

### Einstellungen importieren/exportieren {#import-export-settings}

Importiert oder exportiert Einstellungen als `json`-Datei.

### Design {#theme}

Zeigt asbplayer in einem hellen oder dunklen Design an.

### Sprache {#language}

Sprache der Benutzeroberfläche.

Hinweis: Nicht alle Zeichenfolgen sind in allen von asbplayer unterstützten Sprachen übersetzt. Nicht übersetzte Texte werden auf Englisch angezeigt. Sie können bei der Übersetzung im [Crowdin-Projekt](https://crowdin.com/project/asbplayer) mithelfen.

### Lokales Video automatisch maximieren {#auto-maximize-local-video}

Maximiert das lokale Video automatisch, wenn das Untertitelfeld geöffnet wird.

### Mining-Schaltfläche in der Untertitelliste anzeigen {#show-mining-button-in-subtitle-list}

Wenn diese Option aktiviert ist, wird neben jedem Untertitel in der Untertitelliste eine Mining-Schaltfläche angezeigt.

### Zeitstempel der Untertitelliste {#subtitle-list-timestamps}

Legt fest, wie Zeitstempel in der Untertitelliste angezeigt werden.

- **Ausgeblendet**: Wird nicht angezeigt.
- **Anfang**: Zeigt nur den Anfangszeitstempel des Untertitels an.
- **Anfang und Ende**: Zeigt Anfangs- und Endzeitstempel des Untertitels an.

### Untertitelversatz merken {#remember-subtitle-offset}

Wenn diese Option aktiviert ist, bleibt der Zeitversatz erhalten. Untertitel werden mit dem zuletzt verwendeten Versatz geladen.

### Letzte Wiedergabegeschwindigkeit merken {#remember-last-playback-rate}

Aktualisiert die Einstellung der Wiedergabegeschwindigkeit, wenn sie bei einem Video geändert wird. Wenn diese Option deaktiviert ist, beginnt die Wiedergabe weiterhin mit der konfigurierten Geschwindigkeit, Änderungen während des Ansehens bleiben jedoch vorübergehend.

### Letzte Wiedergabemodi merken {#remember-last-playback-modes}

Stellt beim erneuten Laden der Wiedergabe die zuletzt aktivierten Wiedergabemodi wieder her. Wenn diese Option deaktiviert ist, beginnt die Wiedergabe im Normalmodus.

### Aktuellen Untertitel automatisch in die Zwischenablage kopieren {#auto-copy-current-subtitle-to-clipboard}

Kopiert Untertitel automatisch in die Zwischenablage, sobald sie auf dem Bildschirm erscheinen. Nützlich, um Untertitel an Apps zu senden, die die Zwischenablage überwachen können.

### Untertitelspuren, die automatisch kopiert werden können {#subtitle-tracks-eligible-for-auto-copy}

Legt fest, welche Spuren automatisch kopiert werden, wenn [Aktuellen Untertitel automatisch in die Zwischenablage kopieren](#auto-copy-current-subtitle-to-clipboard) aktiviert ist.

### Vorschaubilder anzeigen {#show-preview-thumbnails}

Zeigt Vorschaubilder in der Untertitelliste an.

### Untertitel über dem Vorschaubild {#subtitle-above-thumbnail}

Zeigt den Untertitel in der Untertitelliste über dem Vorschaubild an.

### Regex-Filter für Untertitel {#subtitle-regex-filter}

Teilzeichenfolgen, die diesem Regex entsprechen, werden durch den Wert von [Ersatztext für Regex-Filter](#subtitle-regex-filter-text-replacement) ersetzt.

### Ersatztext für Regex-Filter {#subtitle-regex-filter-text-replacement}

Teilzeichenfolgen, die dem obigen Regex entsprechen, werden durch den Wert dieser Einstellung ersetzt. Wenn das Feld leer bleibt, werden die Treffer einfach entfernt.

### Untertitel-HTML {#subtitle-html}

Legt fest, wie HTML in Untertiteldateien behandelt wird.

### Ruby erkennen und anzeigen {#detect-and-display-ruby}

Wenn diese Option aktiviert ist, erkennt asbplayer automatisch Lesungen im Netflix-Stil und zeigt sie mit `ruby`-Tags entsprechend an. Lesungen in diesem Stil erscheinen häufig in japanischen Untertiteln. Dabei folgt auf ein Wort eine Lesung in Klammern, etwa `花子（はなこ）`.

### WebSocket-Client aktivieren {#enable-websocket-client}

Aktiviert den WebSocket-Client. Damit kann asbplayer über die WebSocket-Schnittstelle gesteuert werden.

### WebSocket-Server-URL {#websocket-server-url}

URL des WebSocket-Servers, mit dem der Client verbunden wird. In der Regel handelt es sich um eine lokal laufende Instanz des [mitgelieferten WebSocket-Servers](../guides/web-socket-server.md).

### Speicherlimit für den Mining-Verlauf {#mining-history-storage-limit}

Begrenzt die Anzahl der Karten, die im Mining-Verlauf gespeichert werden können.

### Name des Tabs {#name-of-the-tab}

Legt den Namen des App-Tabs fest.

## Profile {#profiles}

Ein Einstellungsprofil ist ein vollständig separater Satz von Einstellungswerten. Das aktive Profil lässt sich in der Einstellungsoberfläche oder über die Dialoge **Untertitel laden** und **Anki-Export** wechseln.
