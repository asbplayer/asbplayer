---
sidebar_position: 11
---

import project from '@site/src/project';

# Verkkotekstitykset {#online-subtitles}

Tekstitystiedostoja ei tarvitse etsiä käsin: voit etsiä ja ladata niitä suoraan asbplayerista. Tekstitykset tarjoaa [Jimaku](https://jimaku.cc), yhteisön ylläpitämä tekstityssivusto, jonka sisältö kattaa pääasiassa animea ja japanilaisia draamasarjoja.

## Käyttö {#usage}

1. Avaa videon sisältävän sivun sivupaneeli ja napsauta **Lataa tekstitykset**.
2. Napsauta **Etsi verkkotekstityksiä** (löytyy myös tekstitysraitojen avattavasta valikosta).
3. Hakusana täytetään sivun otsikon perusteella. Muokkaa sitä tarvittaessa, valitse **Anime** tai **Draama** ja tee haku.
4. Avaa hakutuloksen tekstitystiedostot napsauttamalla tulosta ja lataa tiedosto napsauttamalla sitä.

Luettelossa näytetään vain `.srt`- ja `.ass`-tiedostot. Äskettäin avaamasi teokset näkyvät **Viimeisimmät**-kohdassa, joten voit ohittaa haun seuraavalla kerralla.

## Jimakun API-avaimen hankkiminen {#api-key}

Jimaku vaatii API-avaimen hakua ja lataamista varten.

1. Luo tili [jimaku.cc](https://jimaku.cc)-sivustolla ja kirjaudu sisään.
2. Avaa [tilisivusi](https://jimaku.cc/account) ja luo API-avain.
3. Liitä avain hakuvalintaikkunan **Jimakun API-avain** -kenttään.

Avain tallennetaan automaattisesti, joten tämä tarvitsee tehdä vain kerran. Avain on oletuksena piilotettu; näytä se silmäkuvakkeella.

## Jakson automaattinen tunnistus {#episode-detection}

Sarjoissa asbplayer yrittää lukea jakson numeron sivun otsikosta (esimerkiksi `S01E05`, `EP05` tai `第5話`/`第五集`). Jos numero löytyy:

- jakson ilmaisin poistetaan hakusanasta, joten haku kohdistuu vain sarjan nimeen;
- tiedostoluettelo suodatetaan kyseiseen jaksoon, joka näkyy **EP N** -merkintänä. Napsauta merkinnän ✕-kuvaketta nähdäksesi kaikki tiedostot.

Jos valitulle jaksolle ei löydy käyttökelpoisia tekstitystiedostoja, näytetään koko luettelo.

### Mukautettu jakson säännöllinen lauseke {#episode-regex}

Joillakin verkkosivustoilla käytetään otsikkomuotoa, jota sisäänrakennetut säännöt eivät tunnista. Tällöin jaksoa ei tunnisteta ja näet kaikki sarjan tiedostot. Mukautetulla säännöllisellä lausekkeella voit määrittää, miten asbplayer tunnistaa jakson näillä sivustoilla.

Kun olet avannut sarjan, näytä **Mukautettu jakson säännöllinen lauseke** -kenttä napsauttamalla tiedostoluettelon otsikon vieressä olevaa hammasrataskuvaketta. Kuvake korostuu, kun lauseke on asetettu.

- **Kaappausryhmän 1** on sisällettävä jakson numero (sekä arabialaiset että kanji-numerot käyvät).
- Säännöllistä lausekettasi kokeillaan ensin. Jos se on tyhjä, virheellinen tai ei vastaa otsikkoa, käytetään tavalliseen tapaan sisäänrakennettuja sääntöjä. Mukautus siis vain lisää tunnistuksen kattavuutta.
- Suodata nykyinen sarja uudelleen painamalla **Enter**. Muutos näkyy hakusanassa, kun avaat valintaikkunan seuraavan kerran.

:::tip
Sisäänrakennettuja sääntöjä on testattu vain muutamalla ominaisuuden kehittäjän käyttämällä verkkosivustolla. Jos sivuston otsikkomuotoa ei tunnisteta, <a href={`${project.urls.repo}/issues`}>ilmoita ongelmasta</a> ja lisää esimerkki sivun otsikosta (tai tee PR tiedostoon `common/subtitle-sources/jimaku-episode-patterns.ts`), jotta sisäänrakennettuja sääntöjä voidaan laajentaa.
:::

Jos sivuston sivujen otsikot ovat esimerkiksi muotoa `Some Show - Chapter 07 | SiteName`, käytä tätä:

```
Chapter (\d+)
```

## Kiitokset {#jimaku-acknowledgements}

Suuri kiitos [Rapptzille](https://github.com/Rapptz), joka loi ja ylläpitää [Jimakua](https://github.com/Rapptz/jimaku) sekä tarjoaa tämän ominaisuuden mahdollistavan API:n. Jos ominaisuus on hyödyllinen, harkitse sivuston tukemista ja omien tekstitysten lataamista sinne.
