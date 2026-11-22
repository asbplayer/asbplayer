---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

L’expérience est moins bonne, mais asbplayer peut être utilisé sur les appareils Android.

## Site web {#website}

Le site web peut être utilisé tel quel. L’**interface superposée** s’affichera à la place des commandes vidéo optimisées pour ordinateur.

### Ajouter à l’écran d’accueil {#add-to-home-screen}

Le site web étant une application web progressive, vous pouvez l’ajouter à l’écran d’accueil de votre appareil Android. Dans le menu du navigateur, appuyez sur « Ajouter à l’écran d’accueil ».

## Extension {#extension}

:::warning
**De nombreuses fonctionnalités manquent** : le **panneau latéral**, les **captures d’écran** et l’**interface WebSocket**. Consultez la section [Compatibilité](../compatibility.md#browsers-and-features) pour voir les fonctionnalités prises en charge par chaque navigateur.
:::

Comme sur le site web, l’**interface superposée** est le principal moyen d’interagir avec l’extension asbplayer. Le panneau latéral n’étant pas disponible, **chargez les sous-titres en sélectionnant le bouton asbplayer dans le menu des extensions du navigateur**. Un clavier (Bluetooth) n’est pas nécessaire, mais il peut être très utile si vous préférez utiliser les [raccourcis clavier](../reference/settings.md#keyboard-shortcuts) de l’extension.

Voici les navigateurs Android sur lesquels asbplayer peut être installé.

### Firefox for Android {#firefox-for-android}

Installez asbplayer depuis la <a href={project.extension.firefoxAndroid.storeUrl}>page AMO</a>. Firefox pour Android présente les mêmes limites que Firefox : l’enregistrement audio des flux protégés par DRM est impossible.

### Edge Canary {#edge-canary}

Edge Canary est un autre navigateur mobile basé sur Chromium qui prend en charge les extensions. À la date de rédaction, asbplayer sur Edge Canary ne prend pas en charge l’enregistrement audio.
Pour installer asbplayer sur Edge Canary :

1. Téléchargez le fichier `crx` d’asbplayer depuis la <a href={`${project.urls.repo}/releases/latest`}>page des versions publiées</a>.
2. Si ce n’est pas déjà fait, activez le mode développeur dans les paramètres d’Edge Canary : ouvrez « À propos de Microsoft Edge », puis appuyez plusieurs fois sur le numéro de version.
3. Dans les **Options pour les développeurs**, appuyez sur **Installation d’extension par crx** et sélectionnez le fichier `crx` que vous venez de télécharger.

### Kiwi Browser (discontinued) {#kiwi-browser-discontinued}

Kiwi Browser est un navigateur mobile basé sur Chromium qui prend en charge les extensions. Son développement a toutefois été abandonné et il ne peut être installé que depuis la [page GitHub](https://github.com/kiwibrowser/src.next/releases). Une fois Kiwi Browser installé, vous pouvez installer asbplayer depuis le <a href={project.extension.chrome.storeUrl}>Chrome Web Store</a>.

## Intégration avec Anki {#anki-integration}

Installez [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid) pour intégrer Anki.
