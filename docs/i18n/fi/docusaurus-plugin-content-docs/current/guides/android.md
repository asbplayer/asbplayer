---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

asbplayeriä voi käyttää myös Android-laitteilla, vaikka käyttökokemus ei ole yhtä hyvä.

## Verkkosivusto {#website}

Verkkosivustoa voi käyttää sellaisenaan. Oletusarvoisten työpöytäkäyttöön optimoitujen videosäätimien sijaan näytetään **peittokuvan käyttöliittymä**.

### Lisää aloitusnäyttöön {#add-to-home-screen}

Progressiivisena verkkosovelluksena verkkosivuston voi lisätä Android-laitteen aloitusnäyttöön. Valitse selaimen valikosta ”Lisää aloitusnäyttöön”.

## Selainlaajennus {#extension}

:::warning
**Monia ominaisuuksia puuttuu**: **sivupaneeli**, **kuvakaappaukset** ja **WebSocket-käyttöliittymä**. Katso [yhteensopivuus](../compatibility.md#browsers-and-features)-osiosta kunkin selaimen tuettujen ja puuttuvien ominaisuuksien taulukko.
:::

Kuten verkkosivustolla, ensisijainen tapa käyttää asbplayerin selainlaajennusta on **peittokuvan käyttöliittymä**. Sivupaneelia ei ole, joten **tekstitykset ladataan valitsemalla asbplayer-painike selaimen laajennusvalikosta.** Bluetooth-näppäimistöä ei tarvita, mutta siitä voi olla paljon hyötyä, jos haluat käyttää laajennuksen [pikanäppäimiä](../reference/settings.md#keyboard-shortcuts).

asbplayerin voi asentaa seuraaviin Android-selaimiin.

### Firefox for Android {#firefox-for-android}

Asenna asbplayer <a href={project.extension.firefoxAndroid.storeUrl}>AMO-sivulta</a>. Firefox for Androidissa on samat rajoitukset kuin Firefoxissa: ääntä ei voi tallentaa DRM-suojatuista suoratoistoista.

### Edge Canary {#edge-canary}

Edge Canary on toinen Chromium-pohjainen mobiiliselain, joka tukee laajennuksia. Tätä kirjoitettaessa asbplayer ei tue äänen tallentamista Edge Canaryssa.
Asenna asbplayer Edge Canaryyn näin:

1. Lataa asbplayerin `crx`-tiedosto <a href={`${project.urls.repo}/releases/latest`}>julkaisusivulta</a>.
2. Ota kehittäjätila käyttöön Edge Canaryn asetuksissa, jos se ei ole jo käytössä. Avaa ”Tietoja Microsoft Edgestä” ja napauta koontiversion merkkijonoa useita kertoja.
3. Valitse **Developer Options** -kohdasta **Extension install by crx** ja valitse juuri lataamasi `crx`-tiedosto.

### Kiwi Browser (discontinued) {#kiwi-browser-discontinued}

Kiwi Browser on Chromium-pohjainen mobiiliselain, joka tukee laajennuksia. Sen kehitys on kuitenkin lopetettu, ja sen voi asentaa vain [GitHub-sivulta](https://github.com/kiwibrowser/src.next/releases). Kun Kiwi Browser on asennettu, asbplayerin voi asentaa Chromen <a href={project.extension.chrome.storeUrl}>verkkokaupasta</a>.

## Anki-integraatio {#anki-integration}

Asenna [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid) Anki-integraatiota varten.
