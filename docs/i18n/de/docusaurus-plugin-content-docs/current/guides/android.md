---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

Die Bedienung ist zwar weniger komfortabel, aber asbplayer lässt sich auch auf Android-Geräten verwenden.

## Website {#website}

Die Website kann unverändert verwendet werden. Anstelle der standardmäßigen, für Desktopgeräte optimierten Videosteuerung wird die **Overlay-Oberfläche** angezeigt.

### Zum Startbildschirm hinzufügen {#add-to-home-screen}

Als progressive Web-App kann die Website zum Startbildschirm Ihres Android-Geräts hinzugefügt werden. Tippen Sie dazu im Browsermenü auf „Zum Startbildschirm hinzufügen“.

## Erweiterung {#extension}

:::warning
**Viele Funktionen fehlen**: die **Seitenleiste**, **Screenshots** und die **WebSocket-Schnittstelle**. Eine Übersicht der unterstützten und nicht unterstützten Funktionen in den einzelnen Browsern finden Sie im Abschnitt [Kompatibilität](../compatibility.md#browsers-and-features).
:::

Wie bei der Website erfolgt die Bedienung der asbplayer-Erweiterung hauptsächlich über die **Overlay-Oberfläche**. Da die Seitenleiste fehlt, **werden Untertitel stattdessen geladen, indem Sie im Erweiterungsmenü des Browsers die asbplayer-Schaltfläche auswählen.** Eine (Bluetooth-)Tastatur ist nicht erforderlich, kann aber hilfreich sein, wenn Sie die [Tastaturkürzel](../reference/settings.md#keyboard-shortcuts) mit der Erweiterung verwenden möchten.

Hier sind Android-Browser aufgeführt, in denen asbplayer installiert werden kann.

### Firefox für Android {#firefox-for-android}

Installieren Sie asbplayer über die <a href={project.extension.firefoxAndroid.storeUrl}>AMO-Seite</a>. Für Firefox auf Android gelten dieselben Einschränkungen wie für Firefox: Audio kann nicht von DRM-geschützten Streams aufgenommen werden.

### Edge Canary {#edge-canary}

Edge Canary ist ein weiterer Chromium-basierter mobiler Browser, der Erweiterungen ausführen kann. Zum Zeitpunkt der Erstellung dieses Artikels unterstützt asbplayer in Edge Canary keine Audioaufnahme.
So installieren Sie asbplayer in Edge Canary:

1. Laden Sie die asbplayer-`crx`-Datei von der <a href={`${project.urls.repo}/releases/latest`}>Release-Seite</a> herunter.
2. Aktivieren Sie gegebenenfalls den Entwicklermodus in den Edge-Canary-Einstellungen. Öffnen Sie dazu „Über Microsoft Edge“ und tippen Sie mehrmals auf die Build-Version.
3. Tippen Sie unter **Entwickleroptionen** auf **Erweiterungsinstallation über CRX** und wählen Sie die soeben heruntergeladene `crx`-Datei aus.

### Kiwi Browser (eingestellt) {#kiwi-browser-discontinued}

Kiwi Browser ist ein Chromium-basierter mobiler Browser, der Erweiterungen ausführen kann. Die Entwicklung wurde jedoch eingestellt. Er ist nur noch auf der [GitHub-Seite](https://github.com/kiwibrowser/src.next/releases) erhältlich. Nach der Installation von Kiwi Browser können Sie asbplayer aus dem Chrome-<a href={project.extension.chrome.storeUrl}>Web Store</a> installieren.

## Anki-Integration {#anki-integration}

Installieren Sie [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid), um Anki zu integrieren.
