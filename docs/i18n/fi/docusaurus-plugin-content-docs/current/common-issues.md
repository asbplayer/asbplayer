---
sidebar_position: 5
---

import project from '@site/src/project';

# Yleiset ongelmat {#common-issues}

## Yleistä {#general}

### Tekstitykset eivät näy {#subtitles-arent-showing-up}

Tekstitykset voi piilottaa asbplayerissa muutamalla tavalla:

- Pikanäppäin [`Näytä/piilota tekstitykset`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Pikanäppäimet [`Vaihda videon tekstitysraidan X näkyvyyttä`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Asetus [`Näytä tekstitykset`](./reference/settings.md#show-subtitles) kohdassa `Toisto > Toistotilat`.

### asbplayer ei saa yhteyttä Ankiin. Näyttöön tulee esimerkiksi virheilmoitus ”Failed to fetch.” {#anki-connection-failed}

Syynä voivat olla mainosten estot:

- Jos käytät Bravea, varmista, ettei Shield estä asbplayeriä.
- Tarkista, estääkö selain tai mainosten esto pyynnön. Aloita avaamalla selaimen kehittäjäkonsoli ja etsimällä virheitä.

Virheelliset asetukset:

- Jos käytät verkkosivustoa, varmista, että AnkiConnect sallii asbplayerin [kuvauksen mukaisesti](./getting-started/mining-subtitles.md).

Tai virheet:

- Tätä kirjoitettaessa kokeellisten verkkoympäristöominaisuuksien käyttöönotto aiheuttaa tämän ongelman. Kokeile poistaa asetus käytöstä osoitteessa `chrome://flags`.
- Uudemmissa macOS-versioissa AnkiConnect ei vastaa, kun Anki on taustalla ([Huomautuksia macOS-käyttäjille](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### Kortti ei päivity Ankiin, kun käytän ”päivitä viimeisin kortti” -ominaisuutta. {#card-not-updating}

Varmista, että Ankin korttiselain on suljettu, kun käytät ”päivitä viimeisin kortti” -toimintoa. AnkiConnectissa on [tunnettu ongelma](https://github.com/FooSoft/anki-connect/issues/82), jonka vuoksi kortit eivät näytä päivittyvän korttiselaimen ollessa auki.

### Paikallisen tiedoston lataamisen jälkeen asbplayer näyttää mustan ruudun tai ei toista ääntä. {#local-video-playback-issues}

Selainten kyky purkaa tiettyjä video- ja äänimuotoja vaihtelee. Katso [yhteensopivuusosiosta](./compatibility.md#browsers-and-media-formats) lisätietoja.

### Ponnahdussanakirjalaajennukseni (esimerkiksi Yomitan) ei toimi sivupaneelissa {#popup-dictionary-in-side-panel}

Selaimet eivät turvallisuussyistä salli laajennusten komentosarjojen lisäämistä muiden laajennusten sivuille, joten tähän ei ole korjausta. Jos haluat tarkastella tekstiä muilla laajennuksilla, tee se videon sisällä näkyvistä tekstityksistä tai asbplayerin verkkosivuston tekstityslistasta.

### asbplayer ei tunnista suoratoistovideota. {#asbplayer-isnt-detecting-streaming-video}

Varmista laajennuksen tiedoista, että laajennuksella on pääsy kaikille sivustoille.

### Pikanäppäimet eivät toimi. {#keyboard-shortcuts-arent-working}

Tarkista <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>pikanäppäinasetukset</a> tai [pikanäppäinviite](./reference/settings.md#keyboard-shortcuts).

Jos käytät selainlaajennusta, tarkista lisäksi seuraavat:

- Tarkista Chromessa `chrome://extensions/shortcuts` tai Firefoxissa `about:addons` → hammasrataskuvake → `Hallitse laajennusten pikanäppäimiä`.
- Päivitä sivu ja yritä ladata tekstitykset uudelleen.
- Kokeile poistaa laajennus ja asentaa se uudelleen sekä käynnistää selain uudelleen.
- Varmista, ettei laajennusta ole asennettu kahdesti.

### asbplayer ei rajaa suoratoistovideon kuvakaappauksia oikein. {#screenshot-cropping-issues}

Varmista, että selaimen zoomaus on 100 %. Rajauksen voi poistaa kokonaan käytöstä <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>laajennuksen asetuksissa</a>.

### JP mining note -muistiinpanotyypillä on ongelmia korttien luomisessa. {#jp-mining-note-issues}

Katso tämä [ongelmailmoitus](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer pyytää jatkuvasti lupaa äänen tallennukseen {#repeated-audio-permission-prompts}

asbplayer ei tällä hetkellä ole yhteensopiva Volume Master -laajennuksen kanssa, joten se on poistettava käytöstä.

### Äänitallenteet ovat vääristyneitä, rahisevia tai katkonaisia {#garbled-audio-recordings}

Syynä on yleensä suorittimen riittämätön teho. Jos käytät kannettavaa tietokonetta, varmista, että se on kytketty virtalähteeseen. Varmista yleensäkin, ettei virransäästötila tai muu vastaava rajoita suorittimen toimintaa.

### Suoratoistovideon asbplayer-pikanäppäin ei tee mitään ja sivu lakkaa vastaamasta. {#streaming-shortcut-unresponsive}

Syynä voi olla, että `Experimental Web Platform features` on käytössä osoitteessa `chrome://flags`. Varmista, että se on poistettu käytöstä, ja yritä uudelleen.

## Annotointi {#annotation}

### Annotoinnin ottaminen käyttöön tai poistaminen käytöstä raidalla {#enable-or-disable-annotation-for-a-track}

Annotointi katsotaan poistetuksi käytöstä, kun seuraavien asetusten arvot ovat nämä:

  - Kohdassa [`Asetukset > Annotointi`](./reference/settings.md#annotation):
  - [`Väritä tekstitykset tunnettujen sanojen perusteella`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Pois**
  - [`Luo tilastot automaattisesti`](./reference/settings.md#generate-statistics-automatically): **Pois**
  - [`Näytä sanojen lukutavat`](./reference/settings.md#display-word-readings): _Ei mitään valittuna_ (tyhjä arvo)
  - [`Näytä sanojen yleisyys`](./reference/settings.md#display-word-frequency): _Ei mitään valittuna_ (tyhjä arvo)
  - [`Näytä korkoaksentti (japani)`](./reference/settings.md#display-pitch-accent-japanese): _Ei mitään valittuna_ (tyhjä arvo)
  - [`Näytä sanojen määritelmät`](./reference/settings.md#display-word-definitions): _Ei mitään valittuna_ (tyhjä arvo)
  - Kohdassa [`Asetukset > Toisto > Annotointi`](./reference/settings.md#playback-annotation):
  - [`Valitse tauolla ensimmäinen vastaava sana`](./reference/settings.md#select-first-matching-word-on-pause): Ei koskaan
  - [`Pysäytä automaattisesti näitä sanoja sisältävät tekstitykset`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Ei sanarajauksia
  - [`Toista tiivistetysti näitä sanoja sisältävät tekstitykset`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Ei sanarajauksia
  - [`Toista normaalinopeudella pikakelauksen aikana näitä sanoja sisältävät tekstitykset`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Ei sanarajauksia
  - [`Toista näitä sanoja sisältävät tekstitykset uudelleen`](./reference/settings.md#repeat-subtitles-containing-these-words): Ei sanarajauksia
  - [`Näytä nämä sanat toiston aikana`](./reference/settings.md#show-these-words-during-playback): Ei sanarajauksia
  - [`Säädä pikakelausnopeutta ymmärtämisen mukaan`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Pois**

Ota raidan annotointi käyttöön asettamalla vähintään yksi yllä olevista asetuksista muuhun kuin käytöstä poistavaan arvoon. Jotkin annotoinnit näytetään vain osoittimen ollessa sanan päällä, jos ne on [määritetty niin](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Painikkeet [`Rakenna Ankin sanatietokanta uudelleen`](./reference/settings.md#re-build-anki-word-database) ja [`Rakenna WaniKanin sanatietokanta uudelleen`](./reference/settings.md#re-build-wanikani-word-database) eivät ole käytössä, elleivät yllä olevat asetukset sisällä integraatiosta hyötyviä arvoja.
:::

### Ankin sanatietokannan tyhjentäminen {#clear-anki-word-database}

Tyhjennä raidan Ankin sanatietokannan merkinnät tyhjentämällä [`Ankin sanakentät`](./reference/settings.md#anki-word-fields) ja [`Ankin lausekentät`](./reference/settings.md#anki-sentence-fields) ja käyttämällä painiketta [`Rakenna Ankin sanatietokanta uudelleen`](./reference/settings.md#re-build-anki-word-database). Jos painike ei ole käytössä, [ota ensin annotointi käyttöön raidalla](#enable-or-disable-annotation-for-a-track).

### WaniKanin sanatietokannan tyhjentäminen {#clear-wanikani-word-database}

Tyhjennä raidan WaniKanin sanatietokannan merkinnät tyhjentämällä [WaniKani API -tunniste](./reference/settings.md#wanikani-api-token) ja käyttämällä painiketta [`Rakenna WaniKanin sanatietokanta uudelleen`](./reference/settings.md#re-build-wanikani-word-database). Jos painike ei ole käytössä, [ota ensin annotointi käyttöön raidalla](#enable-or-disable-annotation-for-a-track).

### Paikallisesti seurattujen sanojen poistaminen {#delete-locally-tracked-words}

Voit poistaa paikallisesti seurattavan sanan viemällä osoittimen sen päälle ja asettamalla sen tilaksi **Ei kerätty** [annotoinnin pikanäppäimillä](./reference/settings.md#annotation-keyboard-shortcuts). Poista myös **Ohitettu**-tila, jos se oli käytössä.

Voit poistaa useita paikallisesti seurattuja sanoja kerralla merkitsemällä ne [`Sanat selaimessa`](./reference/settings.md#word-browser) tilaan **Ei kerätty** ja poistamalla niiden tilat. Voit käyttää myös [`Tuo sanoja`](./reference/settings.md#import-words) -ominaisuutta.

### Kaikki sanat ovat tilassa Ei kerätty {#everything-is-uncollected}

Jos otit annotoinnin vahingossa käyttöön, [poista se käytöstä näillä ohjeilla](#enable-or-disable-annotation-for-a-track).

Jos sanojen tilat eivät koskaan vaihdu tilasta **Ei kerätty**:

- Jos käytät paikallisia tilatietoja, tuo sanoja paikalliseen sanatietokantaan tai aseta niiden tilat viemällä osoitin sanojen päälle ja käyttämällä [annotoinnin pikanäppäimiä](./reference/settings.md#annotation-keyboard-shortcuts).
- Jos käytät tilatietoihin Ankia, varmista, että Anki on käynnissä ja **AnkiConnect-URL** on oikein.
    - Määritä [`Ankin sanakentät`](./reference/settings.md#anki-word-fields) (suositeltu) ja/tai [`Ankin lausekentät`](./reference/settings.md#anki-sentence-fields).
    - Suorita [`Rakenna Ankin sanatietokanta uudelleen`](./reference/settings.md#re-build-anki-word-database).
    - Ankia ei tarvitse pitää käynnissä tietokannan luomisen jälkeen, mutta asbplayer pysyy synkronoituna, jos Anki on auki toiston aikana.
- Jos käytät tilatietoihin WaniKania, varmista, että [`WaniKani API -tunniste`](./reference/settings.md#wanikani-api-token) on oikein.
    - Suorita [`Rakenna WaniKanin sanatietokanta uudelleen`](./reference/settings.md#re-build-wanikani-word-database).
    - asbplayer synkronoituu automaattisesti WaniKanin kanssa toiston aikana.

### Sanoissa näkyy punainen yliviivaus {#red-strikethrough-styling-appears}

Jos otit annotoinnin vahingossa käyttöön, [poista se käytöstä näillä ohjeilla](#enable-or-disable-annotation-for-a-track).

Tämä tarkoittaa, että tekstitysten käsittelyssä tapahtui virhe, todennäköisesti Yomitaniin yhdistämisen ongelman vuoksi. Tarkista virheilmoitukset selaimen konsolista ja pyydä apua asbplayerin Discordissa, jos et saa ongelmaa ratkaistua.
