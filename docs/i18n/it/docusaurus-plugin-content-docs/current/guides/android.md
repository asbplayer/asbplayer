---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

Anche se l'esperienza d'uso è peggiore, è possibile usare asbplayer sui dispositivi Android.

## Sito web {#website}

Il sito web può essere usato così com'è. Al posto dei controlli video predefiniti ottimizzati per desktop verrà visualizzata l'**interfaccia in sovrimpressione**.

### Aggiungere alla schermata Home {#add-to-home-screen}

Essendo una progressive web app, il sito web può essere aggiunto alla schermata Home del dispositivo Android. Dal menu del browser, tocca «Aggiungi a schermata Home».

## Estensione {#extension}

:::warning
**Mancano molte funzionalità**: il **pannello laterale**, gli **screenshot** e l'**interfaccia WebSocket**. Consulta la sezione [compatibilità](../compatibility.md#browsers-and-features) per una tabella delle funzionalità supportate e non supportate in ciascun browser.
:::

Come per il sito web, il modo principale per interagire con l'estensione di asbplayer è tramite l'**interfaccia in sovrimpressione**. Il pannello laterale non è disponibile, quindi **per caricare i sottotitoli seleziona il pulsante asbplayer nel menu delle estensioni del browser.**. L'uso di una tastiera (Bluetooth) non è necessario, ma può essere molto utile se preferisci usare le [scorciatoie da tastiera](../reference/settings.md#keyboard-shortcuts) con l'estensione.

Di seguito sono elencati i browser Android su cui è possibile installare asbplayer.

### Firefox per Android {#firefox-for-android}

Installa asbplayer dalla <a href={project.extension.firefoxAndroid.storeUrl}>pagina AMO</a>. Firefox per Android ha le stesse limitazioni di Firefox: non è possibile registrare l'audio dai flussi protetti da DRM.

### Edge Canary {#edge-canary}

Edge Canary è un altro browser mobile basato su Chromium che può eseguire estensioni. Al momento della stesura, asbplayer su Edge Canary non supporta la registrazione audio.
Per installare asbplayer su Edge Canary:

1. Scarica il file `crx` di asbplayer dalla <a href={`${project.urls.repo}/releases/latest`}>pagina delle release</a>.
2. Se non l'hai già fatto, attiva la modalità sviluppatore nelle impostazioni di Edge Canary andando su «Informazioni su Microsoft Edge» e toccando più volte la stringa della versione della build.
3. In **Opzioni sviluppatore**, tocca **Installazione estensione da crx** e seleziona il file `crx` appena scaricato.

### Kiwi Browser (non più sviluppato) {#kiwi-browser-discontinued}

Kiwi Browser è un browser mobile basato su Chromium che può eseguire estensioni. Tuttavia, il suo sviluppo è stato interrotto e l'unico modo per installarlo è dalla [pagina GitHub](https://github.com/kiwibrowser/src.next/releases). Una volta installato Kiwi Browser, puoi installare asbplayer dal <a href={project.extension.chrome.storeUrl}>Chrome Web Store</a>.

## Integrazione con Anki {#anki-integration}

Per integrare Anki, installa [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid).
