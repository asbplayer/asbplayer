---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# WebSocket-palvelin {#websocket-server}

asbplayer hyödyntää WebSocket-yhteyksien kaksisuuntaisuutta ja tarjoaa siten käyttöliittymän, johon pääsee selaimen ulkopuolelta.

Tässä ratkaisussa asbplayer on **WebSocket-asiakas**, joka ylläpitää yhteyttä käyttäjän tietokoneella paikallisesti toimivaan **WebSocket-palvelimeen**. Palvelin tarjoaa HTTP-käyttöliittymän, jonka kautta asiakasohjelmalle eli asbplayerille voi lähettää komentoja. Valmiiksi pakatun palvelimen tekninen kuvaus löytyy [täältä](../reference/external-api.md).

Palvelin kehitettiin alun perin mahdollistamaan yhden napsautuksen louhinta, jossa AnkiConnectin `addNote`-pyyntöihin lisätään asbplayerin tarjoamaa mediaa. Siksi yksi sen päätoiminnoista on myös toimia **AnkiConnect-välityspalvelimena**.

:::note
Suositeltu tapa louhia kortteja yhdellä napsautuksella on käyttää [asbplayerin Anki-lisäosaa](./one-click-mining.md#install-the-asbplayer-anki-add-on). Alla kuvattu AnkiConnect-välityspalvelin on vaihtoehtoinen tapa.
:::

## Palvelimen käynnistäminen {#run-the-server}

1. Kloonaa <a href={project.urls.repo}>asbplayer-arkisto</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Asenna [Golang](https://go.dev/dl/), jos sitä ei ole vielä asennettu.
3. Käynnistä palvelin:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Välityspalvelin on hyvin kevyt, joten sen voi jättää toimimaan taustalla. Windowsissa sen voi pienentää tehtäväpalkkiin [RBTray](https://github.com/benbuck/rbtray)-ohjelmalla.

## asbplayerin yhdistäminen palvelimeen {#connect-asbplayer-to-the-server}

Määritä ja ota asbplayerin WebSocket-asiakas käyttöön <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>muissa asetuksissa</a>. Oletuksena asbplayer käyttää jo WebSocket-palvelimen IP-osoitetta ja porttia, joten yleensä riittää, että otat WebSocket-asiakkaan käyttöön.

## Louhinta yhdellä napsautuksella AnkiConnect-välityspalvelimen avulla {#one-click-mining-with-the-ankiconnect-proxy}

Asenna Yomitan ja määritä siihen kohdekielesi sanakirja [Yomitanin verkkosivuston](https://yomitan.wiki/) ohjeiden mukaan.

Määritä sitten Yomitan näin:

- AnkiConnect-URL-osoitteen tulee osoittaa AnkiConnectin sijaan AnkiConnect-välityspalvelimeen. Välityspalvelimen oletusosoite on <code>{webSocketHttpUrl}</code>.
- Yomitanin tulee käyttää samaa **muistiinpanotyyppiä** kuin asbplayer.

Kun louhit lauseita Yomitanilla, kortteihin lisätään valmiiksi sanan määritelmä, kuva ja ääni. Todellinen yhden napsautuksen louhinta onnistuu, jos välityspalvelimen `POST_MINE_ACTION` on `2` (päivitä viimeisin kortti). Katso lisätietoja [palvelimen määrityksistä](#server-configuration).

Jos haluat käyttää Lause-kentässä aina asbplayerin tekstitystekstiä, ota **Louhinta**-asetuksissa käyttöön [**Käytä tekstitystekstiä aina lausekentässä**](../reference/settings.md#always-use-subtitle-text-for-sentence-field). Se korvaa Yomitanin lisäämän lausetekstin kaikilta raidoilta louhitulla tekstitystekstillä.

## API-viite {#api-reference}

Katso [teknisestä viitteestä](../reference/external-api.md#commands) kuvaus komennoista, joita asbplayerille voi lähettää WebSocket-yhteyden kautta.

## HTTP-pohjainen API {#http-based-api}

WebSocket-palvelin toteuttaa HTTP-pohjaisen API:n, jolla voi suorittaa yllä kuvattuja komentoja.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## AnkiConnect-välityspalvelin {#ankiconnect-proxy}

WebSocket-palvelin toimii myös AnkiConnect-välityspalvelimena, joka lisää `addNote`-pyyntöihin asbplayerin tarjoamaa kontekstia, kuten ääntä ja kuvakaappauksia.

Välityspalvelin välittää kaikki AnkiConnect-pyynnöt sellaisinaan `addNote`-pyyntöjä lukuun ottamatta. `addNote`-pyynnön yhteydessä välityspalvelimen toiminta määräytyy alla kuvatussa määrityksessä olevan `POST_MINE_ACTION`-arvon mukaan.

## Palvelimen määritys {#server-configuration}

Palvelin määritetään samaan hakemistoon sijoitettavalla `.env`-tiedostolla. Alla on esimerkkitiedosto selityksineen.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
