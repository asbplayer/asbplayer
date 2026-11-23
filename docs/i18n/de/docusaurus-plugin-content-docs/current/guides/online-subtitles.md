---
sidebar_position: 11
---

import project from '@site/src/project';

# Online-Untertitel {#online-subtitles}

Anstatt manuell nach Untertiteldateien zu suchen, können Sie sie direkt in asbplayer suchen und laden. Die Untertitel stammen von [Jimaku](https://jimaku.cc), einer Community-Seite für Untertitel, die sich hauptsächlich mit Anime und japanischen Dramaserien befasst.

## Verwendung {#usage}

1. Öffnen Sie auf einer Seite mit einem Video die Seitenleiste und klicken Sie auf **Untertitel laden**.
2. Klicken Sie auf **Online-Untertitel suchen** (auch über das Dropdown-Menü der Untertitelspur verfügbar).
3. Der Suchbegriff wird aus dem Seitentitel übernommen. Passen Sie ihn bei Bedarf an, wählen Sie **Anime** oder **Drama** und starten Sie die Suche.
4. Klicken Sie auf ein Suchergebnis, um die Untertiteldateien anzuzeigen, und anschließend auf eine Datei, um sie zu laden.

Es werden nur Dateien im `.srt`- und `.ass`-Format angezeigt. Zuletzt geöffnete Werke erscheinen unter **Zuletzt verwendet**, sodass Sie bei der nächsten Suche direkt darauf zugreifen können.

## Jimaku-API-Schlüssel abrufen {#api-key}

Für die Suche und den Download ist ein API-Schlüssel von Jimaku erforderlich.

1. Erstellen Sie ein Konto auf [jimaku.cc](https://jimaku.cc) und melden Sie sich an.
2. Öffnen Sie Ihre [Kontoseite](https://jimaku.cc/account) und erstellen Sie einen API-Schlüssel.
3. Fügen Sie den Schlüssel im Suchdialog in das Feld **Jimaku-API-Schlüssel** ein.

Der Schlüssel wird automatisch gespeichert, Sie müssen dies also nur einmal tun. Standardmäßig ist er verborgen. Über das Augensymbol können Sie ihn anzeigen.

## Folgen automatisch erkennen {#episode-detection}

Bei Serien versucht asbplayer, die Folgennummer aus dem Seitentitel zu lesen (zum Beispiel `S01E05`, `EP05` oder `第5話`/`第五集`). Wird eine Nummer gefunden:

- wird die Folgenmarkierung aus dem Suchbegriff entfernt, sodass nur nach dem Seriennamen gesucht wird;
- wird die Dateiliste nach dieser Folge gefiltert und als **EP N**-Markierung angezeigt. Klicken Sie auf das ✕ der Markierung, um alle Dateien anzuzeigen.

Wenn für die ausgewählte Folge keine verwendbaren Untertiteldateien vorhanden sind, wird stattdessen die vollständige Liste angezeigt.

### Benutzerdefinierter Folgen-Regex {#episode-regex}

Einige Websites verwenden Titel, die von den integrierten Regeln nicht erkannt werden. Dann wird keine Folge erkannt und Sie sehen alle Dateien der Serie. Mit einem benutzerdefinierten Regex können Sie asbplayer beibringen, die Folgen auf diesen Websites zu erkennen.

Nachdem Sie eine Serie geöffnet haben, klicken Sie auf das Zahnradsymbol neben der Überschrift der Dateiliste, um das Feld **Benutzerdefinierter Folgen-Regex** anzuzeigen. Das Zahnradsymbol ist hervorgehoben, solange ein Regex festgelegt ist.

- **Erfassungsgruppe 1** muss die Folgenummer enthalten (arabische und Kanji-Ziffern werden unterstützt).
- Ihr Regex wird zuerst angewendet. Ist es leer, ungültig oder gibt es keine Übereinstimmung, werden wie gewohnt die integrierten Regeln verwendet. So können Sie nur zusätzliche Fälle abdecken.
- Drücken Sie **Enter**, um die aktuelle Serie erneut zu filtern. Der Suchbegriff übernimmt die Änderung, wenn Sie den Dialog das nächste Mal öffnen.

:::tip
Die integrierten Regeln wurden nur auf den wenigen Websites getestet, die der Autor der Funktion verwendet. Wenn das Titelformat einer Website nicht erkannt wird, <a href={`${project.urls.repo}/issues`}>erstellen Sie bitte ein Issue</a> mit einem Beispieltitel (oder einen PR für `common/subtitle-sources/jimaku-episode-patterns.ts`), damit die integrierten Regeln erweitert werden können.
:::

Wenn eine Website ihre Seiten beispielsweise `Some Show - Chapter 07 | SiteName` nennt, verwenden Sie:

```
Chapter (\d+)
```

## Danksagungen {#jimaku-acknowledgements}

Vielen Dank an [Rapptz](https://github.com/Rapptz), der [Jimaku](https://github.com/Rapptz/jimaku) entwickelt hat, weiterhin betreut und die API bereitstellt, die diese Funktion ermöglicht. Wenn Sie die Seite nützlich finden, unterstützen Sie sie gerne und laden Sie eigene Untertitel hoch.
