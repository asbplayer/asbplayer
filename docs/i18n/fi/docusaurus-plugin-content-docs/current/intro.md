---
sidebar_position: 1
---

import project from '@site/src/project';

# Mikä asbplayer on? {#what-is-asbplayer}

## Kieltenoppimisen apuväline {#a-language-learning-assistant}

**asbplayer** on kieltenoppimisen apuväline, joka helpottaa kielten opiskelua tekstitettyjen videoiden avulla. Sen alkuperäinen tekijä loi sen omaan käyttöönsä japanin opiskeluun [AJATT](https://tatsumoto-ren.github.io/blog/whats-ajatt.html)-menetelmällä. Myöhemmin siitä tuli tunnettu [Refold](https://refold.la/)-yhteisössä japanin opiskeluun tarkoitetuista **lauseiden louhinta-** ja **tekstitystyökaluistaan**. asbplayerin ominaisuudet kehittyvät jatkuvasti. asbplayerilla voit:

- **Luoda helposti laadukkaita multimedia-muistikortteja** tekstitetyistä videoista.
- **Ladata tekstivalittavat tekstitykset useimpiin videolähteisiin**, myös suoratoistoon. Voit käyttää suosittujen suoratoistopalveluiden, kuten Netflixin ja YouTuben, **automaattisesti tunnistettuja tekstityksiä** tai omia **tekstitystiedostojasi**. Yleinen varamenetelmä tunnistaa tekstitykset 85 prosentissa muista suoratoistopalveluista.
- **Siirtyä tekstityksissä** navigoitavan **tekstityslistan** avulla.
- **Käyttää mukautettavia [pikanäppäimiä](./reference/settings.md#keyboard-shortcuts)** useimpien asbplayerin ominaisuuksien hallintaan.
- **Tehostaa kielenoppimista** esimerkiksi seuraavilla **toistotiloilla**:
    - **Tiivistetty toisto**: ohita videon tekstittämättömät kohdat.
    - **Pikakelaus**: kelaa videon tekstittämättömät kohdat nopeasti eteenpäin.
    - **Automaattipysäytys**: pysäytä toisto automaattisesti jokaisen tekstityksen alussa tai lopussa.
    - **Toisto**: toista tekstitykset automaattisesti rajattomasti tai määritetyn määrän kertoja.
- **Luoda ja tuoda mukautettavia [reseptejä](./guides/recipes.md)**, jotka hyödyntävät asbplayerin monipuolisia toistotoimintoja.
- **Annotoida tekstityksiä** esimerkiksi [Yomitan](https://yomitan.wiki/)-työkalulla:
    - **Sanojen tyylitys** (väri, alleviivaus, ääriviiva jne.) sanan tilan perusteella (ei kerätty, tuntematon, opettelussa jne.). Tiedot synkronoidaan Ankista, WaniKanista ja/tai tallennetaan paikallisesti asbplayeriin.
    - **Lukutapa-annotointi**, joka näyttää kunkin sanan lukutavan tai määräytyy sanan tilan mukaan.
    - **Aksenttiannotointi**, kuten korkoaksentti.
    - **Yleisyysannotointi**, joka näyttää sanan sijoitukseen perustuvan yleisyyden sen alapuolella tai sanan tilan mukaan.
    - **Sanastoannotointi**, joka näyttää sanan lyhyen määritelmän tai selityksen.
    - **Tilastot ja ymmärtäminen** nykyisen median tunnettujen sanojen perusteella.
    - **Mukautuva toisto**, joka optimoi oppimiskokemustasi **toistotilojen** ja annotointitietojen avulla.
    - **Sanaselain**, jolla voit hallita paikallisia sanoja ja tarkastella ulkoisista lähteistä synkronoituja sanoja.
    - Lisää ominaisuuksia on tulossa tulevissa julkaisuissa. Suunnitteilla ovat esimerkiksi:
        - **Automaattinen louhinta** sanoista, joita ei ole kerätty, joita ei tunneta tai joita opetellaan.
        - **Monipuolisten Anki-korttien luonti** laadukkaiden muistikorttien muodostamiseen annotoiduista tekstityksistä.
        - **Tilastot ja ymmärtäminen** tunnetuista sanoistasi eri medioissa.

## Verkkosivusto ja selainlaajennus {#a-website-and-browser-extension}

Jotta asbplayer olisi mahdollisimman laajasti käytettävissä, siitä on kaksi versiota: paikallisten videotiedostojen kanssa toimiva <a href={project.urls.app}>verkkosivusto</a> ja suoratoistovideon kanssa toimiva <a href={project.extension.chrome.storeUrl}>selainlaajennus</a>. Kumpikaan ei edellytä toisen käyttöä, mutta yhdessä ne tarjoavat mahdollisimman sujuvan asbplayer-käyttökokemuksen.

## Miksi käyttää asbplayeriä? {#why-use-asbplayer}

- Haluat katsoa videoita tekstivalittavien tekstitysten kanssa.
- Haluat luoda videoista ja tekstityksistä laadukkaita multimedia-muistikortteja.
- Käyttämäsi videolähteet ovat harvinaisia, eivätkä muut vastaavat työkalut tue niitä.
- Hallitset työkalujen käyttöä. Täydellinen kieltenoppimisen työkalupaketti vaatii todennäköisesti asbplayerin yhdistämistä muihin työkaluihin, kuten sanakirjasovellukseen.
- Et halua maksaa. asbplayer on ilmainen ja avoimen lähdekoodin ohjelma.
