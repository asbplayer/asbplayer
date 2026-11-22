---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Louhinta yhdellä napsautuksella {#one-click-mining}

asbplayer yhdistää tekstitykset ja videon sisällön AnkiConnectiin, mutta se ei pysty itse lisäämään sanojen määritelmiä automaattisesti. Siksi useimmat lauseiden louhintatavat vaativat käyttäjältä kaksi tai kolme hiiren tai näppäimistön syötettä.

Louhinta yhdellä napsautuksella onnistuu, kun asbplayeria käytetään yhdessä toisen sovelluksen kanssa, joka:

- tarjoaa puuttuvat sanamääritelmät ja
- integroituu jo AnkiConnectiin.

[Yomitan](https://yomitan.wiki/) on esimerkki tällaisesta sovelluksesta.

## Yomitanin asentaminen ja määrittäminen {#install-and-configure-yomitan}

Asenna Yomitan ja määritä siihen kohdekielesi sanakirja [Yomitanin verkkosivuston](https://yomitan.wiki/) ohjeiden mukaan. Lisää myös [AnkiConnect](https://ankiweb.net/shared/info/2055492159) Ankiin, jos et ole vielä tehnyt niin.

Määritä Yomitanin Anki-asetuksissa seuraavat:

- AnkiConnect-palvelimen osoitteena tulee olla oletusarvo (<code>{ankiConnectUrl}</code>).
- Yomitanin tulee käyttää samaa **muistiinpanotyyppiä** kuin asbplayer.

## asbplayerin Anki-lisäosan asentaminen {#install-the-asbplayer-anki-add-on}

Lisäosa vaatii vähintään Ankin version 25.02. Se ei ole vielä saatavilla AnkiWebissä, joten se on asennettava tiedostosta:

1. Lataa uusin `.ankiaddon`-tiedosto <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>julkaisusivulta</a>.
2. Avaa tiedosto ja valitse ponnahdusikkunasta **Kyllä**.
3. Käynnistä Anki uudelleen.

## asbplayerin yhdistäminen lisäosaan {#connect-asbplayer-to-the-add-on}

Ota WebSocket-asiakas käyttöön asbplayer-laajennuksen <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>muissa asetuksissa</a> (lähellä sivun alaosaa). Käytä WebSocket-palvelimen oletusosoitetta (<code>{webSocketUrl}</code>), joka vastaa lisäosan oletusarvoa.

## Louhi kortteja **Yomitanilla** tavalliseen tapaan {#mine-with-yomitan-as-usual}

Kun louhit lauseita Yomitanilla, kortteihin lisätään valmiiksi sanan määritelmä, kuva ja ääni.

Jos haluat käyttää Lause-kentässä aina asbplayerin tekstitystekstiä, ota **Louhinta**-asetuksissa käyttöön [**Käytä tekstitystekstiä aina lausekentässä**](../reference/settings#always-use-subtitle-text-for-sentence-field). Se korvaa Yomitanin lisäämän lausetekstin kaikilta raidoilta louhitulla tekstitystekstillä.

## Lisäosan asetukset

Lisäosan asetuksia voi muuttaa Ankissa valitsemalla **Työkalut > Lisäosat**, valitsemalla lisäosan ja napsauttamalla **Määritä**. `postMineAction` määrittää, mitä asbplayer tekee sen jälkeen, kun Yomitan lisää kortin (oletus: <code>{project.services.webSocket.postMineAction}</code>). Aseta arvoksi `2` (päivitä viimeisin kortti), jotta voit louhia kortteja yhdellä napsautuksella. Jos muutat `port`-arvoa, muuta asbplayerin WebSocket-palvelimen URL-osoite vastaamaan sitä.
