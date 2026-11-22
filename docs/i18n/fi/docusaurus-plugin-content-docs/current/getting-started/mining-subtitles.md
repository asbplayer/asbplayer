---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Tekstitysten louhinta {#mining-subtitles}

**Lauseiden louhinta** tarkoittaa muistikorttien luomista lauseista. asbplayerilla voit luoda laadukkaita lausekortteja yhdistämällä videon, äänen ja tekstitykset yhdeksi kortiksi. asbplayer integroituu suosittuun **Anki**-muistikorttisovellukseen.

## Ankin käyttöönotto {#setup-anki}

1. Asenna [Anki](https://apps.ankiweb.net/).
2. Lisää [AnkiConnect](https://ankiweb.net/shared/info/2055492159) Ankiin.
3. Jos louhit kortteja videotiedostoista, lisää <code>{appOrigin}</code> AnkiConnectin asetusten `webCorsOriginList`-luetteloon:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Lisää **pakka**.
5. Lisää **muistiinpanotyyppi**.
   Suosittelemme luomaan oman muistiinpanotyypin tai käyttämään valmista tyyppiä. Jos haluat päästä nopeasti alkuun, luo perustyyppi seuraavasti:
   1. Valitse Työkalut → Hallitse muistiinpanotyyppejä.
   2. Lisää ”Perus”-muistiinpanotyyppi.
   3. Määritä **kentät**:
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. Määritä **kortti**:
      - Etupuoli:
        ```
        {{Sentence}}
        ```
      - Kääntöpuoli:
        ```
        {{FrontSide}}
        <hr id=answer>
        {{Definition}}
        <p/>
        <div class="image">
        {{Image}}
        </div>
        <p/>
        {{Audio}}
        <p/>
        {{Source}}
        <p/>
        {{URL}}
        ```

## asbplayerin määrittäminen {#configure-asbplayer}

1. Avaa <a href={new URL('?view=settings', project.urls.app).href}>asbplayerin asetukset</a>.
2. Valitse juuri luomasi **pakka** ja **muistiinpanotyyppi**.
3. Valitse muistiinpanotyypistä vastaava kenttä kullekin **lauseen**, **määritelmän**, **sanan**, **äänen**, **kuvan**, **lähteen** ja **URL-osoitteen** kentälle.

## Sanakirjasovelluksen asentaminen {#install-a-dictionary-app}

asbplayerissa ei ole sisäänrakennettua sanakirjaa. Suosittelemme asentamaan sanakirjasovelluksen, jotta korttien **Määritelmä**-kentän täyttäminen on helppoa. Tässä on kaksi suosittua vaihtoehtoa:

- [Yomitan](https://yomitan.wiki/) on selainlaajennus, jolla voit etsiä sanoja viemällä osoittimen niiden päälle. Se kehitettiin alun perin japanille, mutta se alkaa tukea myös muita kieliä.
- [VocabSieve](https://docs.freelanguagetools.org/) on itsenäinen kieltenoppimissovellus, joka tukee eurooppalaisia kieliä.

## Tekstitysten louhinta {#mine-subtitles}

1. [Lataa tekstitykset](./loading-subtitles.md) mihin tahansa videolähteeseen.
2. Napsauta **Lähetä tekstitykset Ankin** <NoteAddIcon /> -painiketta.
3. Täytä avautuva valintaikkuna ja napsauta **Vie**.
