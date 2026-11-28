---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Asetukset {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### AnkiConnect-URL {#ankiconnect-url}

Ankin lisäosana toimivan AnkiConnect-palvelimen URL-osoite.

### AnkiConnect API -avain {#ankiconnect-api-key}

AnkiConnectissa määritetty API-avain, kun API-avaimen suojaus on käytössä.

### Päivitä Ankin korttiselain korttien päivityksen jälkeen {#refresh-anki-card-browser}

Kun tämä on käytössä, asbplayer päivittää avoimen Ankin korttiselaimen kortin päivityksen jälkeen, jolloin kentissä näkyvät niiden nykyiset arvot. Tämä voi tuoda korttiselainikkunan etualalle. Asetus on oletuksena poissa käytöstä.

### Pakka {#deck}

Anki-pakka, johon kortit lähetetään.

### Muistiinpanotyyppi {#note-type}

Korteissa käytettävä Ankin muistiinpanotyyppi. Muistiinpanotyyppi määrittää kortin ”mallin” ja ”näkymän”, eli kortin kentät sekä HTML-mallin, joka määrittää kenttien esitystavan kortin etu- ja kääntöpuolella.

### Korttikentät {#card-fields}

Kukin korttikentän asetus määrittää, mikä sisältö liitetään määritetyn muistiinpanotyypin kenttään. **Kentän otsikko** — Lause, Määritelmä, Sana, Kuva, Ääni tai URL — tarkoittaa **sisältöä**, ja **kentän arvo** on **muistiinpanotyypin kenttä**.

Kentät näkyvät **Anki-vientivalintaikkunassa** samassa järjestyksessä kuin asetuksissa. Järjestystä voi muuttaa valitsemalla **⋮-valikosta** → **Siirrä alas** tai **Siirrä ylös**.

| Kenttä                | Sisältö                                            |
| --------------------- | -------------------------------------------------- |
| Lause (kaikki raidat) | Kaikki tekstitykset louhintahetkellä                |
| Määritelmä            | Käyttäjän antama sanan määritelmä                  |
| Sana                  | Käyttäjän antama sana                              |
| Ääni                  | Videolähteestä tallennettu ääni                    |
| Kuva                  | Kuvakaappaus videolähteestä                        |
| Lähde                 | Tekstitystiedoston tai videon nimi ja aikaleima    |
| URL                   | Nykyinen URL-osoite, jos kortti louhittiin suoratoistovideosta |
| Tekstitysraita 1      | Raidan 1 tekstitykset louhintahetkellä              |
| Tekstitysraita 2      | Raidan 2 tekstitykset louhintahetkellä              |
| Tekstitysraita 3      | Raidan 3 tekstitykset louhintahetkellä              |
| Mukautetut kentät     | Käyttäjän antamat arvot                            |

### Tunnisteet {#tags}

Jokaisen kortin mukana lisättävät oletustunnisteet.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Louhinta</a> {#mining}

### Louhintapainikkeen oletustoiminto {#mining-button-default-action}

”Louhintapainike” <NoteAddIcon/> tarkoittaa **peittokuvan käyttöliittymän** vasemmanpuoleisinta painiketta ja **tekstityslistassa** tekstitysten vieressä näkyvää painiketta. Tällä asetuksella määritetään niiden toiminto.

| Asetus                  | Toiminta                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Näytä Anki-valintaikkuna | Tallenna kohdetekstitys louhintahistoriaan ja näytä **Anki-vientivalintaikkuna**                                                           |
| Päivitä viimeisin kortti | Tallenna kohdetekstitys louhintahistoriaan ja päivitä määritetyn pakan viimeisin kortti kaikella asbplayerin tarjoamalla kontekstilla — paitsi käyttäjän antamalla määritelmällä, sanalla ja mukautetuilla kentillä |
| Näytä kortin päivitysvalintaikkuna | Tallenna kohdetekstitys louhintahistoriaan ja näytä valintaikkuna, jossa viimeisin kortti päivitetään asbplayerin tarjoamalla kontekstilla |
| Vie kortti              | Tallenna kohdetekstitys louhintahistoriaan ja vie kortti _vain_ asbplayerin tarjoamalla kontekstilla — paitsi käyttäjän antamalla määritelmällä, sanalla ja mukautetuilla kentillä |
| Ei mitään               | Tallenna kohdetekstitys louhintahistoriaan                                                                                                   |

### Toistotila louhinnan jälkeen {#post-mining-playback-state}

Määrittää halutun toistotilan louhintatoiminnon jälkeen.

### Kopioi louhitut tekstitykset leikepöydälle {#copy-mined-subtitles-to-clipboard}

Kun tämä on käytössä, kohdetekstitys kopioidaan leikepöydälle aina louhintatoiminnon yhteydessä.

### Käytä lausekentässä aina tekstitystekstiä {#always-use-subtitle-text-for-sentence-field}

Kun tämä on käytössä, Lause-kenttään lisätään louhintahetken tekstitysteksti kaikilta raidoilta, vaikka ulkoinen sovellus tarjoaisi eri lausetekstin. Tämä on hyödyllistä, kun [louhit kortteja Yomitanilla](../guides/one-click-mining.md).

### Päivitä edellisen kortin lisäksi samaa tekstitystä käyttävien korttien lauseet {#update-sentence-for-cards-with-the-same-subtitle-text}

Kun tämä on käytössä, **Päivitä edellinen kortti** -louhintatoiminto korvaa myös lausekentän ja määritetyt tekstitysraita 1–3 -kentät peräkkäin luoduissa muistiinpanoissa, joiden nykyinen lause vastaa vietyä lausetta. Päivitys yrittää säilyttää kunkin muistiinpanon korostukset. Raitakentät, joihin ei viedä tekstiä, pysyvät ennallaan. Jos tekstityskenttä käyttää samaa Anki-kenttää kuin muu kuin tekstityskenttä, kuten määritelmä, lausepäivitys jättää kentän ennalleen aiemmissa muistiinpanoissa.

Tämä asetus kopioi nykyiseen vientiin valitun lauseen. Ota [**Käytä tekstityksen tekstiä aina lausekentässä**](#always-use-subtitle-text-for-sentence-field) käyttöön, jos haluat käyttää koko louhittua tekstitystä. [Kuvan ja äänen päivitys](#update-all-cards-with-the-same-subtitle-text) toimii tästä asetuksesta riippumatta.

Vastaavuus tarkistetaan pääasiallisesta lausekentästä, lauseen merkkaus ohitetaan ja myös toisen lauseen sisältävä lause hyväksytään. Siksi vain ensimmäisen rivin sisältävä muistiinpano voi vastata koko tekstitystä. Haku sisältää kahden viimeisen Anki-päivän aikana lisätyt muistiinpanot ja päättyy ensimmäiseen erilaiseen tai puuttuvaan lauseeseen. Myös raitakenttien päivitys edellyttää määritettyä lausekenttää ja ei-tyhjää vientilausetta. Asetus on oletuksena poissa käytöstä, eikä se vaikuta erikseen valitun kortin päivitykseen.

### Päivitä viimeisimmän kortin lisäksi kuvat ja äänet korteista, joissa on sama tekstitys {#update-all-cards-with-the-same-subtitle-text}

Kun tämä on käytössä, **Päivitä edellinen kortti** -louhintatoiminto päivittää myös samasta tekstitysrivistä peräkkäin luotujen muistiinpanojen ääni- ja kuvakentät. Kunkin edeltävän muistiinpanon sana, määritelmä ja mukautetut kentät säilyvät. Sen tekstityskentät pysyvät ennallaan, ellei myös [lausepäivitys](#update-sentence-for-cards-with-the-same-subtitle-text) ole käytössä. Vastaavuuden haussa ohitetaan lauseen merkkaus, ja lause voi olla osa louhittua tekstityskontekstia.

Haku sisältää kahden viimeisen Anki-päivän aikana lisätyt muistiinpanot ja päättyy ensimmäiseen erilaiseen tai puuttuvaan lauseeseen. Lausekenttä on määritettävä, ja vientilauseessa on oltava tekstiä, ei vain välilyöntejä tai merkkausta. Asetus on oletuksena poissa käytöstä, eikä se vaikuta erikseen valitun kortin päivitykseen.

### Toista ääntä tallennettaessa paikallisesta videosta {#play-audio-while-recording-from-local-video}

asbplayer tallentaa paikallisten videotiedostojen ääntä selaimen sisäänrakennetulla [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder)-rajapinnalla. Tällä asetuksella määritetään, toistetaanko ääntä tallennuksen aikana.

### Koodaa ääni uudelleen mp3-muotoon {#re-encode-audio-as-mp3}

Tallennettua ääntä ei oletuksena koodata `mp3`-muotoon. Tämä asetus koodaa äänen uudelleen `mp3`-muotoon. Yleensä tätä asetusta ei ole syytä poistaa käytöstä, varsinkaan jos haluat kerrata kortteja iOS-laitteella.

### Äänen alkuun lisättävä aika {#audio-padding-start}

Kuinka monta millisekuntia ennen kohdetekstitystä äänen tallennus aloitetaan.

### Äänen loppuun lisättävä aika {#audio-padding-end}

Kuinka monta millisekuntia kohdetekstityksen jälkeen äänen tallennus lopetetaan.

### Kuvan kaappausmuoto (vain verkkosivusto) {#image-capture-format}

Määrittää louhittujen korttien kuvan kaappausmuodon. Saatavilla vain verkkosivustolla paikallisille videotiedostoille, jolloin ainoa lisävaihtoehto on ”videoleike”.

### Kuvan kaappauksen enimmäisleveys ja -korkeus {#max-capture-dimensions}

Kuvakaappausten enimmäisleveys ja -korkeus pikseleinä. `0` tarkoittaa, ettei rajaa ole.

### Rajaa mustat palkit kuvakaappauksista {#trim-black-bars-from-screenshots}

Kun tämä on käytössä, kuvakaappauksista rajataan pois mustat palkit, jotka johtuvat kuvan sovittamisesta kuvasuhteeseen.

### Leikkeen alun ja lopun rajaus {#clip-trim-start-end}

Määrittää, kuinka paljon aikaa tekstityksen aikavälin alusta ja lopusta rajataan pois, kun videoleikkeen oletusaikaväliä lasketaan. Saatavilla vain, kun kuvan kaappausmuodoksi on valittu videoleike.

### Leikkeen enimmäiskesto {#max-clip-length}

Määrittää videoleikkeen enimmäiskeston. Saatavilla vain, kun kuvan kaappausmuodoksi on valittu videoleike.

### Kuvakaappauksen viive {#screenshot-capture-delay}

Kuinka kauan odotetaan kohdetekstityksen ilmestymisen jälkeen ennen kuvakaappauksen ottamista.

### Ympäröivien tekstitysten lukumäärä {#surrounding-subtitles-count-radius}

**Anki-vientivalintaikkunan** alareunassa oleva liukusäädin muuttaa valittua aikaväliä. Säätimellä voi sisällyttää ympäröiviä tekstityksiä lisäkontekstiksi. Tämä asetus rajoittaa mukaan otettavien ympäröivien tekstitysten määrää.

### Ympäröivien tekstitysten aikaväli {#surrounding-subtitles-time-radius}

**Anki-vientivalintaikkunan** alareunassa oleva liukusäädin muuttaa valittua aikaväliä. Säätimellä voi sisällyttää ympäröiviä tekstityksiä lisäkontekstiksi. Tämä asetus määrittää kohdetekstityksen ympärille sallittavan aikavälin näille tekstityksille.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Tekstitysten ulkoasu</a> {#subtitle-appearance}

### Tekstitysraita {#subtitle-appearance-track}

asbplayer voi ladata useita tekstitysraitoja samanaikaisesti. Tästä avattavasta valikosta valitaan raita tai raidat, joihin alla olevia asetuksia sovelletaan. Oletusvalinta on ”Kaikki”. Kun ”Kaikki” on valittuna, ulkoasuasetuksen muuttaminen muuttaa sen arvoa kaikilla raidoilla. Kun asetukselle määritetään raidakohtainen arvo, kyseinen asetus poistuu ”Kaikki”-sivulta.

### Tekstityksen esikatselu {#subtitle-preview}

Esikatsele ja muokkaa tekstitystekstiä, jolla ulkoasuasetusten vaikutusta näytetään.

### Tyyli {#styling}

| Asetus                            | Kuvaus                                                                               | CSS-ominaisuus              |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Tekstityksen väri                 | Väri                                                                                 | `color`                     |
| Tekstityksen koko                 | Koko `px`-yksikköinä                                                                 | `font-size`                 |
| Tekstityksen fontin paksuus       | Fontin paksuus                                                                       | `font-weight`               |
| Tekstityksen ääriviivan väri      | Ääriviivan väri                                                                      | `-webkit-text-stroke-color` |
| Tekstityksen ääriviivan paksuus   | Ääriviivan paksuus                                                                   | `-webkit-text-stroke-width` |
| Tekstityksen varjon väri          | Varjon väri                                                                          | `text-shadow`               |
| Tekstityksen varjon paksuus       | Varjon paksuus                                                                       | `text-shadow`               |
| Tekstityksen taustaväri           | Taustaväri                                                                           | `background-color`          |
| Tekstityksen taustan peittävyys   | Taustan peittävyys                                                                   | `background`                |
| Tekstityksen fonttiperhe          | Fontti. Käytettävissä olevat fontit näytetään avattavassa valikossa, kun paikallisten fonttien käyttö on sallittu. | `font-family` |
| CSS:\<tyylin avain\>             | Merkkijonoarvo mille tahansa mukautetulle CSS-ominaisuudelle, joka on lisätty **Lisää mukautettu CSS** -valikosta. | Mukautettu ominaisuus |
| Tekstityksen sumennus             | Sumennustehoste tekstityksille. Teksti tarkentuu, kun osoitin viedään sen päälle.    | `filter:blur(...)`          |
| Kuvapohjaisen tekstityksen skaalauskerroin | Muuttaa kuvapohjaisen tekstityksen kokoa.                                    | —                           |

### Asettelu {#layout}

| Asetus                               | Kuvaus                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Tekstityksen tasaus                  | Sijoitetaanko tekstitys videoelementin ylä- vai alareunaan.                  |
| Tekstityksen sijainnin siirtymä alhaalta | Kaikkien alareunan tekstitysraitojen etäisyys videoelementin alareunasta. |
| Tekstityksen sijainnin siirtymä ylhäältä | Kaikkien yläreunan tekstitysraitojen etäisyys videoelementin yläreunasta. |
| Tekstityksen leveys                  | Tekstityssäiliön leveys prosentteina (`%`) tai pikseleinä.                    |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Pikanäppäimet</a> {#keyboard-shortcuts}

Useimpia asbplayerin ominaisuuksia voi käyttää pikanäppäimillä.

### <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Tekstitysten</a> pikanäppäimet {#subtitles-keyboard-shortcuts}

| Toiminto                             | Oletuspikanäppäin |
| ------------------------------------ | ---------------- |
| Valitse ladattavat tekstitysraidat.  | Ctrl + Shift + F |
| Näytä/piilota tekstitykset           | ↓                |
| Näytä/piilota videon tekstitysraita 1 | 1               |
| Näytä/piilota videon tekstitysraita 2 | 2               |
| Näytä/piilota videon tekstitysraita 3 | 3               |
| Näytä/piilota asbplayerin tekstitysraita 1 | W + 1        |
| Näytä/piilota asbplayerin tekstitysraita 2 | W + 2        |
| Näytä/piilota asbplayerin tekstitysraita 3 | W + 3        |
| Poista asbplayerin tekstitysraidan 1 sumennus | B + 1     |
| Poista asbplayerin tekstitysraidan 2 sumennus | B + 2     |
| Poista asbplayerin tekstitysraidan 3 sumennus | B + 3     |
| Siirrä alareunan tekstityksiä ylös   |                  |
| Siirrä alareunan tekstityksiä alas   |                  |
| Siirrä yläreunan tekstityksiä ylös   |                  |
| Siirrä yläreunan tekstityksiä alas   |                  |
| Kopioi nykyinen tekstitys |                  |

### <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Louhinnan</a> pikanäppäimet {#mining-keyboard-shortcuts}

| Toiminto                                                                            | Oletuspikanäppäin           |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Lähetä nykyinen tekstitys                                                             | Ctrl + Shift + Z (verkkosivusto) |
| Lähetä nykyinen tekstitys Anki-valintaikkunaan                                        | Ctrl + Shift + X           |
| Päivitä viimeksi luotu Anki-kortti asbplayerin ottamalla kuvakaappauksella, äänellä jne. | Ctrl + Shift + U        |
| Vie kortti Ankiin ohittaen valintaikkunan.                                           |                            |
| Ota kuvakaappaus manuaalisesti automaattisesti otettavan kuvan sijaan                | Ctrl + Shift + V (verkkosivusto) |
| Käynnistä tai lopeta äänen tallennus manuaalisesti myös tekstitystiedoston ollessa ladattuna. | Ctrl + Shift + R (verkkosivusto) |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Toiston</a> pikanäppäimet {#playback-keyboard-shortcuts}

| Toiminto                        | Oletuspikanäppäin |
| ------------------------------- | ---------------- |
| Näytä/piilota sivupaneeli       | \`               |
| Toista/tauko                    | Välilyönti       |
| Näytä/piilota automaattipysäytys   | Shift + P        |
| Näytä/piilota tiivistetty toisto | Shift + O       |
| Näytä/piilota pikakelaus        | Shift + F        |
| Näytä/piilota uudelleentoisto   | Shift + R        |
| Vaihda tekstitysten näyttötapaa |                  |
| Selaa automaattipysäytyksen jatkamistiloja |              |
| Siirry seuraavaan reseptiin     |                  |
| Siirry edelliseen reseptiin     |                  |
| Ota resepti 1 käyttöön/pois käytöstä |              |
| Ota resepti 2 käyttöön/pois käytöstä |              |
| Ota resepti 3 käyttöön/pois käytöstä |              |
| Ota resepti 4 käyttöön/pois käytöstä |              |
| Ota resepti 5 käyttöön/pois käytöstä |              |
| Ota resepti 6 käyttöön/pois käytöstä |              |
| Ota resepti 7 käyttöön/pois käytöstä |              |
| Ota resepti 8 käyttöön/pois käytöstä |              |
| Ota resepti 9 käyttöön/pois käytöstä |              |
| Ota resepti 10 käyttöön/pois käytöstä |             |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Siirtymisen</a> pikanäppäimet {#seek-keyboard-shortcuts}

| Toiminto                                                                  | Oletuspikanäppäin |
| ------------------------------------------------------------------------- | ---------------- |
| Siirry taaksepäin (oletus 3 sekuntia, [määritettävissä](#seek-interval-seconds)) | A          |
| Siirry eteenpäin (oletus 3 sekuntia, [määritettävissä](#seek-interval-seconds)) | D          |
| Siirry edelliseen tekstitykseen                                           | ←                |
| Siirry seuraavaan tekstitykseen                                           | →                |
| Siirry nykyisen tai edellisen tekstityksen alkuun                         | ↑                |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Toistonopeuden</a> pikanäppäimet {#playback-rate-keyboard-shortcuts}

| Toiminto               | Oletuspikanäppäin |
| ---------------------- | ---------------- |
| Nosta toistonopeutta   | Ctrl + Shift + ] |
| Laske toistonopeutta   | Ctrl + Shift + [ |

### <a href={new URL('?view=settings#playback', project.urls.app).href}>Tekstityksen siirtymän</a> pikanäppäimet {#subtitle-offset-keyboard-shortcuts}

| Toiminto                                                                 | Oletuspikanäppäin |
| ------------------------------------------------------------------------ | ---------------- |
| Säädä tekstityksen siirtymää niin, että edellinen tekstitys osuu nykyiseen aikaleimaan | Ctrl + ← |
| Säädä tekstityksen siirtymää niin, että seuraava tekstitys osuu nykyiseen aikaleimaan | Ctrl + → |
| Siirrä tekstitystä +100 ms                                                | Ctrl + Shift + ← |
| Siirrä tekstitystä -100 ms                                                | Ctrl + Shift + → |
| Palauta tekstityksen siirtymä                                             | Ctrl + Shift + ↓ |

### <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotoinnin</a> pikanäppäimet {#annotation-keyboard-shortcuts}

| Toiminto                          | Oletuspikanäppäin |
| --------------------------------- | ---------------- |
| Avaa tilastot                     | Q + S            |
| Siirry seuraavaan sanaan          | Q + E            |
| Siirry edelliseen sanaan          | Q + W            |
| Merkitse osoittimen alla oleva sana kypsäksi | Q + 5 |
| Siirry seuraavaan kypsään sanaan  |                  |
| Siirry edelliseen kypsään sanaan  |                  |
| Merkitse osoittimen alla oleva sana nuoreksi | Q + 4 |
| Siirry seuraavaan nuoreen sanaan  |                  |
| Siirry edelliseen nuoreen sanaan  |                  |
| Merkitse osoittimen alla oleva sana valmistuneeksi | Q + 3 |
| Siirry seuraavaan valmistuneeseen sanaan |              |
| Siirry edelliseen valmistuneeseen sanaan |              |
| Merkitse osoittimen alla oleva sana opittavaksi | Q + 2 |
| Siirry seuraavaan opittavaan sanaan |                  |
| Siirry edelliseen opittavaan sanaan |                 |
| Merkitse osoittimen alla oleva sana tuntemattomaksi | Q + 1 |
| Siirry seuraavaan tuntemattomaan sanaan |               |
| Siirry edelliseen tuntemattomaan sanaan |               |
| Merkitse osoittimen alla oleva sana keräämättömäksi | Q + 0 |
| Siirry seuraavaan keräämättömään sanaan |               |
| Siirry edelliseen keräämättömään sanaan |               |
| Merkitse osoittimen alla oleva sana ohitetuksi | Q + I |
| Siirry seuraavaan ohitettuun sanaan |                  |
| Siirry edelliseen ohitettuun sanaan |                 |

### Siirtymän pituus (sekuntia) {#seek-interval-seconds}

Määrittää [siirtymisen pikanäppäimissä](#seek-keyboard-shortcuts) käytettävän aikavälin.

### Aloita toisto aina käytettäessä toimintoa ”Siirry nykyisen/edellisen tekstityksen alkuun” {#always-play-on-subtitle-seek}

Nykyisen toistotilan säilyttämisen sijaan aloita aina toisto, kun käytät [siirtymisen pikanäppäintä](#seek-keyboard-shortcuts), jolla siirrytään nykyisen tai edellisen tekstityksen alkuun. Tämä säästää yhden näppäinpainalluksen.

### Toistonopeuden säätöaskel {#playback-speed-adjust-step}

Muutosaskel, jota käytetään [toistonopeuden lisäämisen ja vähentämisen pikanäppäimillä](#playback-rate-keyboard-shortcuts).

### Laajennuksen pikanäppäimet {#extension-shortcuts}

Kun selainlaajennus on asennettu, jotkin louhinnan pikanäppäimet (esimerkiksi nykyisen tekstityksen louhinta ja nykyisen tekstityksen louhinta Anki-valintaikkunaan) toteutetaan selaimen komentoina tavallisten näppäintapahtumien kuuntelijoiden sijaan. Niitä voi muokata vain selaimen laajennusten pikanäppäineditorissa.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Hallitse laajennusten pikanäppäimiä`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotointi</a> {#annotation}

### Sanat selain {#word-browser}

:::info
Vain paikallisia sanoja voi muokata tai poistaa. Ulkoisista lähteistä tuodut sanat ovat vain luettavissa, ja ne päivittyvät vain [synkronoinnin](#re-build-anki-word-database) kautta.
:::

Avaa Sanat selaimen, jossa voit tarkastella ja hallita paikallisen sanatietokannan sanoja sekä Ankin kanssa synkronoituja sanoja.

:::tip
Voit etsiä sanoja millä tahansa kielen kirjoitusjärjestelmällä (esimerkiksi japanissa romajilla, hiraganalla, katakanalla tai kanjilla).

Lisäksi tehdään automaattisesti joitakin yleisiä elämänlaatua parantavia korvauksia, kuten `e -> é` tai `ss -> ß`.
:::

### Tuo sanoja {#import-words}

Tuo sanoja asbplayerin **paikalliseen sanatietokantaan**.

Tuotuja sanoja käsitellään paikallisina, ja niiden tietoja käytetään ulkoisten lähteiden sijaan sanan tilaa määritettäessä.

Tuontivalintaikkunassa voi liittää mitä tahansa tekstiä (asbplayer jakaa sen sanoiksi) tai tuoda aiemmin vietyjä tiedostoja.

:::tip
Voit viedä osoittimen sanojen päälle ja muuttaa niiden paikallista tilaa [annotoinnin pikanäppäimillä](#annotation-keyboard-shortcuts).
:::

### Vie sanoja {#export-words}

Vie paikallisen sanatietokantasi, jotta voit varmuuskopioida sen, siirtää sen toiseen laitteeseen tai jakaa sen verkkosivuston ja laajennuksen välillä.

### Rakenna Ankin sanatietokanta uudelleen {#re-build-anki-word-database}

Luo tai rakentaa uudelleen Ankista haettujen sanatilatietojen paikallisen välimuistin.

:::tip
Välimuisti päivittyy automaattisesti toiston aikana, kun raita on käytössä ja Ankiin saa yhteyden.

Painike ei ole käytössä, elleivät annotointiasetuksesi [hyödy Anki-integraatiosta](../common-issues.md#enable-or-disable-annotation-for-a-track).

Tyhjennä raidan Ankin sanatietokannan merkinnät [näiden ohjeiden avulla](../common-issues.md#clear-anki-word-database).
:::

### Rakenna WaniKanin sanatietokanta uudelleen {#re-build-wanikani-word-database}

Luo tai rakentaa uudelleen WaniKanista haettujen sanastotietojen paikallisen välimuistin.

:::tip
Välimuisti päivittyy automaattisesti toiston aikana, kun raita on käytössä ja tunniste on määritetty.

Painike ei ole käytössä, elleivät annotointiasetuksesi [hyödy WaniKani-integraatiosta](../common-issues.md#enable-or-disable-annotation-for-a-track).

Tyhjennä raidan WaniKanin sanatietokannan merkinnät [näiden ohjeiden avulla](../common-issues.md#clear-wanikani-word-database).
:::

### Tekstitysraita {#annotation-track}

Valitsee tekstitysraidan, johon näitä annotointiasetuksia sovelletaan.

### Väritä tekstitykset tunnettujen sanojen mukaan {#colorize-subtitles-based-on-known-words}

Ottaa käyttöön sanojen tilaan perustuvan tyylin (ei kerätty, tuntematon, opettelussa jne.). Tyyli käyttää määritettyjä [**sanan väritapoja**](#word-color-style) ja [**sanojen tilavärejä**](#word-status-colors).

### Luo tilastot automaattisesti {#generate-statistics-automatically}

Luo nykyisestä mediasta tilastot automaattisesti latauksen yhteydessä. Tämä ottaa käyttöön myös tilastojen peittokuvan. [Tilastojen avaamisen pikanäppäin](#annotation-keyboard-shortcuts) löytyy Annotointi-ryhmästä.

### Näytä sanojen lukutavat {#display-word-readings}

Näyttää sanojen yläpuolella lukutavat (esimerkiksi furiganan) sanan tilan ja tilamerkintöjen perusteella.

### Näytä sanojen yleisyys {#display-word-frequency}

Näyttää sijoitukseen perustuvan yleisyysarvon sanojen alapuolella (kun se on saatavilla) tilan ja tilamerkintöjen mukaan. Tämä auttaa priorisoimaan, mitkä sanat kannattaa opetella.

:::tip
Yleisyystiedot vaativat, että Yomitan-asennuksessa on käytettävissä vähintään yksi sijoitukseen perustuva yleisyyssanakirja. Jos sanakirja ei ilmoita toimintatapaansa, asbplayer yrittää päätellä, perustuuko se sijoitukseen, ja käyttää sitä sen mukaisesti.

Jos sanalle on saatavilla useita yleisyyslukuja, käytetään pienintä eli yleisintä lukua.
:::

### Näytä korkoaksentti (japani) {#display-pitch-accent-japanese}

:::note
Jos haluat nähdä korkoaksentin furiganassa, ota se käyttöön asetuksella [**Näytä sanojen lukutavat**](#display-word-readings).
:::

Näyttää korkoaksentin furiganassa tai itse kanassa sanan tilan ja tilamerkintöjen mukaan.

:::info
Sanaa seuraavan liitepartikkelin korkoaksentti määräytyy sanan korkoaksentin perusteella, jos tieto on saatavilla.

Tavallisesti furigana lisätään vain kanjeihin, mutta tämän ominaisuuden ollessa käytössä kaikki sanan merkit saavat furigana-lukemistavan, jos vähintään yksi merkki on kanji. Näin yhdyssanojen korkoaksenttia on helpompi lukea.
:::

### Näytä sanojen määritelmät {#display-word-definitions}

Määrittää, näytetäänkö kunkin sanan lyhyt määritelmä tai selitys sanan tilan ja tilamerkintöjen perusteella.

### Sanakentän hakustrategia {#word-field-search-strategy}

Määrittää, miten asbplayer vertaa tekstityksen sanoja tunnettuihin sanoihisi.

- **Tarkka muoto kerätty**: kentän on sisällettävä tekstityksessä esiintyvä tarkka taivutusmuoto (running -> running).
- **Perusmuoto kerätty**: perusmuodon on oltava kerättynä (running -> run).
- **Perusmuoto tai tarkka muoto kerätty**: sana katsotaan kerätyksi, jos joko perusmuoto tai tarkka muoto vastaa (jompikumpi yllä olevista).
- **Mikä tahansa muoto kerätty**: sana katsotaan kerätyksi, jos jokin siihen liittyvä muoto vastaa (running -> run, ran, runs jne.).

Kun valittuna on **Perusmuoto kerätty**, **Perusmuoto tai tarkka muoto kerätty** tai **Mikä tahansa muoto kerätty**, asetuksella [**Täsmää kielten eri kirjoitusjärjestelmien välillä**](#match-across-language-scripts) määritetään, voiko perusmuotoon perustuva vastaavuus ylittää kielen eri kirjoitusjärjestelmien rajat (esimerkiksi kanjin, hiraganan ja katakanan).

### Kortin valintaprioriteetti {#card-choice-priority}

Jos sanaa vastaa useita Anki-kortteja, tällä määritetään, mitä korttia käytetään sanan tilan määrittämiseen:

- **Kentässä on tarkka muoto** (jos sopivia kortteja on useita, käytä parhaiten tunnettua)
- **Kentässä on perusmuoto** (jos sopivia kortteja on useita, käytä parhaiten tunnettua)
- **Parhaiten tunnettu kortti**
- **Vähiten tunnettu kortti**

### Lausekentän hakustrategia {#sentence-field-search-strategy}

Määrittää, miten asbplayer hakee määrittämistäsi [**Ankin lausekentistä**](#anki-sentence-fields). Käytettävissä ovat samat vaihtoehdot kuin [**sanakentän hakustrategiassa**](#word-field-search-strategy).

Kun valittuna on **Perusmuoto kerätty**, **Perusmuoto tai tarkka muoto kerätty** tai **Mikä tahansa muoto kerätty**, asetuksella [**Täsmää kielten eri kirjoitusjärjestelmien välillä**](#match-across-language-scripts) määritetään, voiko perusmuotoon perustuva vastaavuus ylittää kielen eri kirjoitusjärjestelmien rajat (esimerkiksi kanjin, hiraganan ja katakanan).

:::tip
Koska lauseissa on useita sanoja, kortin tilan merkitys yksittäisen sanan kannalta heikkenee. Siksi tämä kannattaa jättää arvoon **Tarkka muoto kerätty**, paitsi jos käytössäsi on vain lausekortteja.
:::

### Täsmää kielten eri kirjoitusjärjestelmien välillä {#match-across-language-scripts}

Määrittää, voiko perusmuotoon perustuva vastaavuus ylittää kielen eri kirjoitusjärjestelmien rajat (esimerkiksi kanjin, hiraganan ja katakanan).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### Yomitan API -URL {#yomitan-api-url}

Yomitan API -päätepisteen URL-osoite. Jos osoite on virheellinen tai siihen ei saada yhteyttä, asbplayer näyttää virheen.

:::tip
Tarvitset määritetyn [Yomitan](https://yomitan.wiki/)-asennuksen ja [yomitan-api](https://github.com/yomidevs/yomitan-api)-rajapinnan.
:::

### Yomitan-jäsennin {#yomitan-parser}

Valitsee tekstitystekstin sanastamiseen käytettävän Yomitan-jäsentimen:

- **Skannausjäsennin (kaikki kielet)**: Yomitanin sisäinen jäsennin, joka etsii pisimmät sanakirjoistasi löytyvät sanat.
- **MeCab (japani)**: Jäsentää japaninkielisen tekstin MeCabilla. Vaatii, että Yomitan on määritetty tukemaan MeCabia. Suosittelemme vähintään yhtä UniDic-sanakirjaa.

### Sanan enimmäispituus {#max-word-length}

:::info
Tämä asetus koskee vain skannausjäsennintä.
:::

Rajoittaa niiden sanojen enimmäispituutta, joita asbplayer yrittää etsiä ja sanastaa annotointia varten.

:::tip
Aivan liian pieni arvo jättää pidempiä sanoja tunnistamatta, ja liian suuri arvo voi aiheuttaa suorituskykyongelmia.
:::

### Anki-pakat (valinnainen) {#anki-decks}

Rajaa Anki-haut valittuihin pakkoihin. Jos tämä jätetään tyhjäksi, asbplayer hakee kaikista pakoista.

### Ankin sanakentät {#anki-word-fields}

Anki-muistiinpanon kentät, jotka sisältävät _vain_ kohdesanan. Tämä on suositeltu tapa hakea Ankin kautta tietoa sanojen tunnettuudesta.

### Ankin lausekentät {#anki-sentence-fields}

Anki-muistiinpanon kentät, jotka sisältävät lauseen (käytetään yleensä lausepakoissa). Näitä käytetään varalla, jos [**Ankin sanakentistä**](#anki-word-fields) ei löydy kohdesanaa sisältäviä kortteja.

### Kypsän Anki-kortin vakaus tai väli (päivää) {#mature-anki-stability-interval}

Määrittää päivärajat, joiden perusteella Anki-kortti luokitellaan **Kypsäksi** tai alempaan kypsyystilaan.

- **Ei kerätty**: ei löydy Ankista.
- **Tuntematon**: löytyy Ankin haulla `is:new`.
- **Opettelussa**: löytyy Ankin haulla `is:learn`.
- **Valmistunut**: löytyy Ankin haulla `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Nuori**: löytyy Ankin haulla `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Kypsä**: löytyy Ankin haulla `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Jos kortin FSRS-vakaus on saatavilla (kortti kerrattiin viimeksi FSRS:n ollessa käytössä), sitä käytetään aikavälin sijaan.

Lisätietoja sanojen tiloista on kohdassa [**Sanojen tilavärit**](#word-status-colors).
:::

### Käsittele hyllytetyt Anki-kortit tilana {#treat-suspended-anki-cards-as}

Määrittää, miten **hyllytettyjä** kortteja käsitellään muodostettaessa sanojen tiloja Ankin perusteella:

- **Normaali**: käytä Ankin tilaa sellaisenaan.
- Valitse jokin tietty sanan tila (esimerkiksi **Kypsä**, **Tuntematon** jne.), jos haluat käsitellä hyllytettyjä kortteja kyseisenä tilana.

:::tip
Jos vain osa sanan korteista on hyllytetty, hyllytetyt kortit suodatetaan pois ja sanan tila määräytyy muiden korttien perusteella.

Lisätietoja sanojen tiloista on kohdassa [**Sanojen tilavärit**](#word-status-colors).
:::

### WaniKani API -tunniste {#wanikani-api-token}

Synkronoi WaniKanin tunnetut sanasi WaniKani API -tunnisteella. Katso määritysohjeet [annotointioppaasta](../guides/annotation.md#setup).

asbplayer käyttää tunnettujen sanojen määrittämiseen vain aihetyyppejä `vocabulary` ja `kana_vocabulary`. Tilat määräytyvät aiheen SRS-vaiheen ja määritetyn [kertaamisjärjestelmän](https://docs.api.wanikani.com/20170710/#spaced-repetition-system) perusteella seuraavasti:

- **Ei kerätty**: ei löydy WaniKanista.
- **Tuntematon**: löytyy WaniKanista, ja sen SRS-vaihe on ennen vaihetta `Starting stage`.
- **Opettelussa**: löytyy WaniKanista, ja sen SRS-vaihe on vähintään `Starting stage` mutta ennen vaihetta `Passing stage`.
- **Valmistunut**: löytyy WaniKanista, ja sen SRS-vaihe on vaiheiden `Passing stage` ja `Burning stage` välisen alueen alemmalla puoliskolla.
- **Nuori**: löytyy WaniKanista, ja sen SRS-vaihe on vaiheiden `Passing stage` ja `Burning stage` välisen alueen ylemmällä puoliskolla.
- **Kypsä**: löytyy WaniKanista, ja sen SRS-vaihe on vähintään `Burning stage`.

:::tip
Lisätietoja sanojen tiloista on kohdassa [**Sanojen tilavärit**](#word-status-colors).
:::

### Sanan väritapa {#word-color-style}

Määrittää, miten tilavärejä käytetään sanoihin asetuksella [**Väritä tekstitykset tunnettujen sanojen mukaan**](#colorize-subtitles-based-on-known-words):

- **Teksti**: sanan väriä muutetaan.
- **Tausta**: sanan taustaväriä muutetaan.
- **Alleviivaus**: alleviivaa sana tilavärillä.
- **Yliviivaus yläpuolelta**: lisää sanan yläpuolelle tilavärisen viivan.
- **Ääriviiva**: lisää sanalle tilavärisen ääriviivan.

:::tip
Kun käytät **Ääriviiva**-tyyliä, paras tulos voi edellyttää, että asetat [**Tekstityksen ääriviivan paksuudeksi**](#subtitle-appearance-track) `0`.
:::

### Paksuus {#thickness}

Määrittää **Alleviivaus**-, **Yliviivaus yläpuolelta-** ja **Ääriviiva**-tyylien paksuuden pikseleinä.

### Korosta sanoja osoittimen alla {#highlight-words-on-hover}

:::info
Korostus osoittaa, missä asbplayerin kohdistuksen on oltava pikanäppäinten tunnistamista varten. Jos korostus ei näy, napsauta soitinta kohdistaaksesi sen. Pikanäppäimet toimivat joko videossa tai tekstityslistassa sen mukaan, kumpaan kohdistus on asetettu, mutta eivät molemmissa yhtä aikaa.

Korostuksen tarkoitus on auttaa näkemään, minkä sanan olet valinnut kerättäväksi osoittamalla sitä. Siksi osoittimen alla täytyy olla sana ja väritys on otettava käyttöön.
:::

Kun tämä on käytössä, osoittimen alla oleva sana korostetaan, mikä auttaa hahmottamaan, miten Yomitan on sanastanut sen.

### Näytä sanan väri vain osoittimen alla {#only-display-word-color-on-hover}

:::note
Tämä asetus koskee vain tilannetta, jossa [**Väritä tekstitykset tunnettujen sanojen mukaan**](#colorize-subtitles-based-on-known-words) on käytössä.
:::

Kun asetus on käytössä videolle tai tekstityslistalle, sanojen värit ovat oletuksena piilossa ja näkyvät vain, kun osoitin viedään vastaavasti videon tai tekstityslistan tekstitystekstin päälle.

### Näytä sanan lukutapa vain osoittimen alla {#only-display-word-reading-on-hover}

:::note
Tämä asetus koskee vain tilannetta, jossa [**Näytä sanojen lukutavat**](#display-word-readings) on käytössä.
:::

Kun asetus on käytössä videolle tai tekstityslistalle, sanojen lukutavat ovat oletuksena piilossa ja näkyvät vain, kun osoitin viedään vastaavasti videon tai tekstityslistan tekstitystekstin päälle.

### Näytä sanan yleisyys vain osoittimen alla {#only-display-word-frequency-on-hover}

:::note
Tämä asetus koskee vain tilannetta, jossa [**Näytä sanojen yleisyys**](#display-word-frequency) on käytössä.
:::

Kun asetus on käytössä videolle tai tekstityslistalle, sanojen yleisyys on oletuksena piilossa ja näkyy vain, kun osoitin viedään vastaavasti videon tai tekstityslistan tekstitystekstin päälle.

### Näytä sanan määritelmä vain osoittimen alla {#only-display-word-definitions-on-hover}

:::note
Tämä asetus koskee vain tilannetta, jossa [**Näytä sanojen määritelmät**](#display-word-definitions) on käytössä.
:::

Kun asetus on käytössä videolle tai tekstityslistalle, sanojen määritelmät ovat oletuksena piilossa ja näkyvät vain, kun osoitin viedään vastaavasti videon tai tekstityslistan tekstitystekstin päälle.

### Näytä korkoaksentti vain osoittimen alla {#only-display-pitch-accent-on-hover}

:::note
Tämä asetus koskee vain tilannetta, jossa [**Näytä korkoaksentti (japani)**](#display-pitch-accent-japanese) on käytössä.
:::

Kun asetus on käytössä videolle tai tekstityslistalle, korkoaksentti on oletuksena piilossa ja näkyy vain, kun osoitin viedään vastaavasti videon tai tekstityslistan tekstitystekstin päälle.

### Sanan lukutavan koko {#word-reading-size}

Määrittää sanojen lukutapojen (furiganan) koon em-yksikköinä (prosentteina tekstityksen fonttikoosta).

### Sanan yleisyyden koko {#word-frequency-size}

Määrittää sanan yleisyyden koon em-yksikköinä (prosentteina tekstityksen fonttikoosta).

### Sanan määritelmän koko {#word-definition-size}

Määrittää sanan määritelmän koon em-yksikköinä (prosentteina tekstityksen fonttikoosta).

### Korkoaksentin koko {#pitch-accent-size}

Määrittää korkoaksentin koon em-yksikköinä (prosentteina tekstityksen fonttikoosta).

### Sanojen tilavärit {#word-status-colors}

Kullekin tilalle voi määrittää värin ja läpinäkyvyyden, joita käytetään asetuksessa [**Sanan väritapa**](#word-color-style). Kukin tila voidaan ottaa käyttöön tai poistaa käytöstä erikseen.

- **Ei kerätty**: sanaa ei ole asbplayerin tietokannassa.
- **Tuntematon**: sana on tietokannassa, mutta se katsotaan tuntemattomaksi.
- **Opettelussa**: sanaa opetellaan parhaillaan.
- **Valmistunut**: sanan opettelu on päättynyt.
- **Nuori**: sana tunnetaan, mutta se ei ole vielä kypsä.
- **Kypsä**: sana tunnetaan täysin.

:::tip
Voit poistaa tilojen tyylit käytöstä mieltymystesi mukaan; voit esimerkiksi poistaa **Kypsä**-tilan käytöstä näkymän selkeyttämiseksi.

Voit käyttää samaa väriä eri tiloille (esimerkiksi **Valmistunut** ja **Nuori**), jos et halua erotella niitä toisistaan.

Katso, miten Anki-korttien tilat määräytyvät kohdasta [**Kypsän Anki-kortin vakaus tai väli (päivää)**](#mature-anki-stability-interval).
Katso, miten WaniKani-tilat määräytyvät kohdasta [**WaniKani API -tunniste**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Toisto</a> {#playback}

### Toistotilojen ja pikanäppäinten käyttämät tekstitysraidat {#playback-subtitle-tracks}

Määrittää, mitkä raidat huomioidaan [tekstitysten](#subtitles-keyboard-shortcuts) ja [siirtymisen](#seek-keyboard-shortcuts) pikanäppäimissä sekä toistotiloissa. Kun esimerkiksi tiivistetty toisto on käytössä, automaattisesti ohitettavaksi tyhjäksi kohdaksi lasketaan mikä tahansa tämän asetuksen raidoista kohta, jossa ei ole tekstityksiä.

### Automaattipysäytys osoitettaessa tekstityksiä {#auto-pause-when-mousing-over-subtitles}

Määrittää automaattipysäytyksen toiminnan, kun osoitin viedään tekstitysten päälle. ”Käytössä automaattisella jatkamisella” tarkoittaa, että toisto jatkuu automaattisesti, kun osoitin siirretään pois tekstityksistä.

### Toistotilat {#playback-modes}

Toistotiloja voi vaihtaa [toiston pikanäppäimillä](#playback-keyboard-shortcuts).

### Toistonopeus {#playback-rate}

Määrittää median normaalin toistonopeuden, myös tekstitysten aikana käytettävän nopeuden pikakelauksen ollessa käytössä. Uusi toisto alkaa aina tällä nopeudella. Voit muuttaa nopeutta katselun aikana [toistonopeuden pikanäppäimillä](#playback-rate-keyboard-shortcuts).

### Näytä ilmoitus toistonopeudesta {#show-playback-rate-notification}

Näyttää ilmoituksen, kun toistonopeus muuttuu muulloin kuin pikakelauksessa.

### Automaattipysäytyksen asetus {#auto-pause-preference}

Määrittää, pysäytetäänkö toisto automaattisesti tekstityksen alussa, lopussa vai molemmissa kohdissa automaattipysäytyksen ollessa käytössä. Kun molemmat kohdat ja toisto ovat käytössä, tekstitys pysähtyy lopussa ennen uudelleentoistoa, mutta alun tauko ohitetaan kaksoistauon välttämiseksi.

### Uudelleentoistojen määrä {#repeat-count-preference}

Määrittää, kuinka monta kertaa kukin tekstitys toistetaan ennen toiston jatkumista. Arvo `0` toistaa rajattomasti.

### Toistot ennen tekstitysten näyttämistä {#repeats-before-showing-subtitles}

Piilottaa tekstitykset toistettavassa kohdassa, kunnes se on toistettu näin monta kertaa. `0` ei piilota tekstityksiä, `1` poistaa piilotuksen ensimmäiseltä uudelleentoistolta.

### Tekstityksen käynnistyskohtien alku- ja loppusiirtymät {#subtitle-trigger-start-and-end-offsets}

Siirtää automaattipysäytyksen ja uudelleentoiston käyttämiä tekstityksen alku- ja loppukäynnistimiä millisekunteina. Siirtymät lisätään tekstityksen yleisen siirtymän jälkeen. Alku- ja loppusiirtymät voi määrittää erikseen: positiiviset arvot käynnistävät toistotoiminnot myöhemmin ja negatiiviset aiemmin. Median ja viereisten tekstitystapahtumien rajat rajoittavat siirrettyjä kohtia. Jos siirretty alku ja loppu menevät ristiin, niiden aikajärjestys vaihdetaan.

### Pikakelauksen vähimmäisohitusväli {#fast-forward-minimum-skip-interval}

Kelaa tekstitysten välinen koko tyhjä kohta, jos se on vähintään tämän pituinen. Lyhyemmät välit toistetaan normaalinopeudella.

### Pikakelauksen nopeus {#fast-forward-playback-rate}

Määrittää pikakelauksen nopeuden pikakelaustilan ollessa käytössä.

### Tiivistetyn toiston vähimmäisohitusväli {#condensed-playback-minimum-skip-interval}

Tiivistetyn toiston ollessa käytössä siirrytään seuraavaan tekstitykseen vain, jos siihen on vähintään tämän verran aikaa.

### Tekstitysaukkojen käynnistimien alku- ja loppusiirtymät {#subtitle-gap-trigger-start-and-end-offsets}

Siirtää pikakelauksen ja tiivistetyn toiston käyttämiä tekstitysaukkojen käynnistimiä. Aukon alun siirtymä ei voi olla negatiivinen, ja se siirtää käynnistintä myöhemmäksi tekstityksen päättymisestä. Aukon lopun siirtymä ei voi olla positiivinen, ja se siirtää käynnistintä aiemmaksi ennen seuraavaa tekstitystä. Median ja viereisten tekstitystapahtumien rajat rajoittavat kutakin aukkoa.

### Automaattipysäytyksen jatkamistapa {#auto-pause-resume-mode}

Määrittää, miten automaattipysäytys päättyy.

- **Manuaalinen**: toisto pysyy tauolla, kunnes jatkat sitä.

- **Kiinteä**: jokainen automaattipysäytys kestää saman määritetyn ajan.
  - Määrittää [kiinteän tauon keston](#fixed-pause-duration) ja [jatkamisviiveen automaattipysäytyksen jälkeen](#resume-delay-after-auto-pause).

- **Tekstityksen pituus**: tauon kesto lasketaan tekstityksen merkkimäärästä. Mukaan lasketaan vain siirrettävillä raidoilla olevat tekstitykset, joten kohdekielen rinnalle ladattu käännösraita ei pidennä taukoa.
  - Määrittää [tauon vähimmäiskeston](#minimum-pause-duration), [tauon enimmäiskeston](#maximum-pause-duration), [taukoajan merkkiä kohden](#pause-time-per-character) ja [jatkamisviiveen automaattipysäytyksen jälkeen](#resume-delay-after-auto-pause).

### Kiinteän tauon kesto {#fixed-pause-duration}

Automaattipysäytyksen kesto **Kiinteä**-tilassa.

### Tauon vähimmäiskesto {#minimum-pause-duration}

Tauon lyhin mahdollinen kesto **Tekstityksen pituus** -tilassa tekstityksen merkkimäärästä riippumatta.

### Tauon enimmäiskesto {#maximum-pause-duration}

Tauon pisin mahdollinen kesto **Tekstityksen pituus** -tilassa. Arvo `0` tarkoittaa, ettei ylärajaa ole. Nollasta poikkeava enimmäiskesto ei voi olla lyhyempi kuin tauon vähimmäiskesto.

### Taukoaika merkkiä kohden {#pause-time-per-character}

**Tekstityksen pituus** -tilassa kullekin merkille varattava aika millisekunteina. Merkkimäärä kerrottuna tällä arvolla rajataan tauon vähimmäis- ja enimmäiskestojen väliin.

### Jatkamisviive automaattipysäytyksen jälkeen {#resume-delay-after-auto-pause}

**Kiinteä**- ja **Tekstityksen pituus** -tiloissa automaattipysäytyksessä on kaksi vaihetta: tekstitys näytetään määritetyn tauon ajan, minkä jälkeen se piilotetaan ja toisto pysyy tauolla jatkamisviiveen ajan. Tämä asetus määrittää toisen vaiheen keston.

### Näytä tekstitykset {#show-subtitles}

- **Ajankohtana**: tekstitykset näkyvät niiden ajoituksen ollessa aktiivinen.

- **Tauolla**: tekstitykset näkyvät vain niiden ollessa ajankohtaisia ja toiston ollessa tauolla.

- **Manuaalisen tauon aikana**: tekstitykset näkyvät vain niiden ollessa ajankohtaisia ja toiston ollessa manuaalisesti tauotettu.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Toisto > Annotointi</a> {#playback-annotation}

Näissä asetuksissa käytetään valitun tekstitysraidan [annotoinnin](#annotation) sanan tiloja, tilamerkintöjä ja yleisyyksiä. Automaattipysäytyksen, tiivistetyn toiston, pikakelauksen ja uudelleentoiston säännöt vaikuttavat, kun vastaava toistotila on käytössä. **Ei sanarajauksia** tarkoittaa, ettei kyseiselle raidalle ole valittu tiloja tai tilamerkintöjä. Säännöt koskevat kutakin raitaa erikseen: siirrettävä raita, jolle ei ole valittu tiloja kyseiseen tilaan, säilyttää toistotilan tavallisen toiminnan, vaikka rinnalla toistettaisiin sääntöjä käyttävää raitaa.

### Tekstitysraita {#playback-annotation-track}

Valitsee tekstitysraidan, jonka annotoinnin toistoasetuksia muokkaat. Valittu raita on sama kuin Annotointi-välilehdellä.

### Valitse tauolla ensimmäinen vastaava sana {#select-first-matching-word-on-pause}

Valitsee ensimmäisen valittua tilaa tai tilamerkintää vastaavan sanan aina, kun toisto pysähtyy, myös manuaalisen tauon aikana ja tauolla tehdyn siirtymisen jälkeen. Poista valinta käytöstä jättämällä valinta tyhjäksi. Sana valitaan videosoittimessa tai tekstityssoittimessa, jos videota ei ole ladattu tai yhdistetty.

Kun tauko johtuu [annotointiin perustuvasta automaattipysäytyssäännöstä](#auto-pause-subtitles-containing-these-words), valitaan sen vastaava sana. Tämä avattava valikko määrittää edelleen manuaalisen tauon aikana tehtävän valinnan.

Kullakin alla olevalla sanarajauksella on omat tila- ja tilamerkintävalintansa sekä sana- ja yleisyysrajansa. Sanan on oltava valitussa tilassa tai tilamerkinnässä ja täytettävä molemmat rajat.

### Pysäytä automaattisesti näitä sanoja sisältävät tekstitykset {#auto-pause-subtitles-containing-these-words}

Automaattipysäytyksen ollessa käytössä pysäytä toisto vain tekstitysten kohdalla, jotka sisältävät vastaavan sanan, ja valitse ensimmäinen vastaava sana. Automaattisissa tauoissa tämä ohittaa asetuksen [**Valitse tauolla ensimmäinen vastaava sana**](#select-first-matching-word-on-pause); kyseinen asetus vaikuttaa edelleen manuaalisiin taukoihin.

### Toista uudelleen näitä sanoja sisältävät tekstitykset {#repeat-subtitles-containing-these-words}

Uudelleentoiston ollessa käytössä toista uudelleen vain tekstitykset, jotka sisältävät vastaavan sanan.

### Toista tiivistetyssä tilassa näitä sanoja sisältävät tekstitykset {#play-subtitles-containing-these-words-in-condensed-mode}

Tiivistetyn toiston ollessa käytössä säilytä vastaavan sanan sisältävät tekstitykset tiivistetyllä aikajanalla. Ohita muut tekstitykset.

### Toista normaalinopeudella pikakelauksessa näitä sanoja sisältävät tekstitykset {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Pikakelauksen ollessa käytössä toista vastaavan sanan sisältävät tekstitykset normaalilla toistonopeudella. Kelaa muut tekstitykset nopeasti eteenpäin.

### Säädä pikakelausnopeutta ymmärtämisen perusteella {#adjust-fast-forward-rate-by-comprehension}

Pikakelauksen ollessa käytössä valitse tekstityksen aikainen toistonopeus lauseen ymmärtämispisteiden perusteella.

Käytä normaalia toistonopeutta, kun ymmärtämispisteet ovat enintään [**Ymmärtämisen vähimmäistasolla**](#minimum-comprehension), ja määritettyä pikakelausnopeutta 100 %:n kohdalla. Näiden pisteiden välinen nopeus lasketaan interpoloimalla.

Nopeuden muuttaminen ymmärtämisen perusteella ohjatussa tekstityksessä muuttaa määritettyä pikakelausnopeutta, minkä jälkeen käytettävä nopeus lasketaan uudelleen ymmärtämispisteiden perusteella. Tämä koskee myös tilannetta, jossa tekstitystä toistetaan ymmärtämispisteiden vuoksi normaalinopeudella. Pikanäppäimet ja soittimen nopeussäätimet toimivat samalla tavalla; normaali nopeus ei muutu.

### Ymmärtämisen vähimmäistaso {#minimum-comprehension}

Asettaa prosenttirajan, jonka ylityttyä nopeutta aletaan kasvattaa (0–99 %, oletus 60 %).

### Näytä nämä sanat toiston aikana {#show-these-words-during-playback}

Valitse tilat ja tilamerkinnät, joiden sanat pidetään näkyvissä.

### Piilota koko tekstitys, jos vähintään tämä osuus sanoista piilotettaisiin {#whole-subtitle-hidden-percentage}

Piilota koko tekstitys, jos näyttösääntö piilottaisi vähintään tämän prosenttiosuuden sen sanoista. Jos arvo on esimerkiksi **80 %**, viisisanaisesta tekstityksestä piilotetaan koko tekstitys, jos neljä sanaa piilotettaisiin, myös yksi sana, joka on valittu näytettäväksi. Välimerkkejä ja muita merkkejä, jotka eivät ole kirjaimia, ei lasketa mukaan.

### Piilota ehdot täyttämättömät sanat yksitellen {#hide-non-matching-words-individually}

Kun tämä on käytössä, näyttösäännön ehtoja täyttämättömät sanat piilotetaan yksitellen niin kauan kuin tekstitys jää koko tekstityksen piilotuskynnyksen alapuolelle. Kun asetus ei ole käytössä, tekstitys pysyy kokonaan näkyvissä kynnyksen ylittymiseen asti.

### Sanojen vähimmäismäärä valitussa luokassa {#minimum-words-per-selected-category}

Kukin valittu luokka (kuten **Ei kerätty** tai **Ohitettu**) lasketaan tekstityksessä erikseen. Jos sanoja on tätä rajaa vähemmän, kyseisen luokan sanat eivät käynnistä sääntöä. `0` poistaa rajan käytöstä.

### Sanojen enimmäismäärä valitussa luokassa {#maximum-words-per-selected-category}

Kukin valittu luokka (kuten **Ei kerätty** tai **Ohitettu**) lasketaan tekstityksessä erikseen. Jos sanoja on tätä rajaa enemmän, kyseisen luokan sanat eivät käynnistä sääntöä. `0` poistaa rajan käytöstä.

### Vain jos sanan yleisyys on vähintään {#only-when-word-frequency-is-at-least}

Vastaavan sanan yleisyyden on oltava vähintään tämä arvo. Puuttuva yleisyys lasketaan arvoksi `1`. `0` poistaa rajan käytöstä.

### Vain jos sanan yleisyys on enintään {#only-when-word-frequency-is-at-most}

Vastaavan sanan yleisyyden on oltava enintään tämä arvo. Puuttuva yleisyys lasketaan arvoksi `1`. `0` poistaa rajan käytöstä.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Suoratoistovideo</a> (vain laajennus) {#streaming-video}

Suoratoistovideon asetukset ovat käytettävissä vain, kun selainlaajennus on asennettu.

### Avaa tekstitysten lataamisen yhteydessä tekstityslista sovelluksessa uuteen välilehteen {#open-subtitle-list-in-tab}

Kun tekstitykset ladataan videoelementtiin, avaa verkkosivuston ja synkronoi ladatut tekstitykset siihen erillisessä välilehdessä.

### Sovelluksen URL {#app-url}

Määrittää, mistä laajennus noutaa joitakin asetuksia ja minkä URL-osoitteen se avaa synkronoidessaan tekstitykset erillisessä välilehdessä toimivaan verkkosovellukseen. Käytännössä tämä on verkkosivuston URL-osoite.

### Ota säätimien peittokuva käyttöön {#enable-controls-overlay}

Näyttää peittokuvan käyttöliittymän videoelementeissä, joihin on ladattu tekstityksiä.

### Näytä tekstitykset {#display-subtitles}

Näyttää ladatut tekstitykset videoelementeissä.

### Tallenna ääni louhittaessa {#record-audio-when-mining}

Tallentaa tekstityksen kattaman äänen muistikorttiin lisättäväksi, kun tekstitystä louhitaan.

### Ota kuvakaappaus louhittaessa {#take-screenshot-when-mining}

Ottaa kuvakaappauksen muistikorttiin lisättäväksi, kun tekstitystä louhitaan.

### Siisti kuvakaappaus louhittaessa {#clean-screenshot-when-mining}

Kun tekstitystä louhitaan ja kuvakaappaukset ovat käytössä, siisti kuvakaappaus poistamalla videon päällä olevat HTML-elementit ennen kuvan ottamista.

### Rajaa kuvakaappaus louhittaessa {#crop-screenshot-when-mining}

Rajaa kuvakaappaus videoelementin kokoiseksi, kun tekstitystä louhitaan.

### Kuvan kaappausmuoto {#streaming-image-capture-format}

Määrittää suoratoistovideosta louhittujen korttien kuvan kaappausmuodon. Lisävaihtoehto on ”Animoitu WebP”, joka tallentaa välilehdellä toistuvan videon tekstityksen aikaväliltä, äänen lisäajat mukaan lukien, ja tallentaa sen animoituna kuvana yksittäisen kuvakaappauksen sijaan.

Animoitua WebP-muotoa käytetään vain, kun [äänen tallennus louhittaessa](#record-audio-when-mining) on käytössä. Muussa tapauksessa otetaan tavallinen kuvakaappaus. Asetus koskee kaikkia mediaa tallentavia louhintatapoja, myös manuaalista tallennusta, joka aloitetaan ja lopetetaan tallennuksen pikanäppäimellä. Se tallentaa kaiken tallennuksen lopettamiseen asti, enintään 30 sekuntia. Vain yksi tallennus voi olla käynnissä kerrallaan. Animoitu WebP ei ole käytettävissä Firefoxissa, eikä DRM-suojattuja videoita voi tallentaa. Välilehden on pysyttävä näkyvissä leikkeen tallennuksen ajan, koska Chrome lakkaa renderöimästä piilotettuja välilehtiä.

### Animoidun kuvan kuvataajuus {#animated-image-fps}

Animoituihin WebP-kuviin sekunnissa tallennettavien kuvien määrä. Pidemmissä leikkeissä tallennetaan automaattisesti vähemmän kuvia, jotta kortin koko pysyy pienenä. Käytettävissä vain, kun kuvan kaappausmuodoksi on valittu Animoitu WebP.

### Animoidun kuvan laatu {#animated-image-quality}

Animoitujen WebP-kuvien kunkin ruudun laatu välillä `0.1`–`1`. Suurempi arvo parantaa kuvan laatua mutta kasvattaa tiedostoa. Käytettävissä vain, kun kuvan kaappausmuodoksi on valittu Animoitu WebP.

### Salli tekstitystiedostojen vetäminen ja pudottaminen {#allow-subtitle-file-drag-and-drop}

Sallii tekstitystiedostojen vetämisen ja pudottamisen videoelementteihin.

### Lataa tunnistetut tekstitykset automaattisesti {#auto-load-detected-subtitles}

Jos tekstitysten automaattista tunnistusta tuetaan nykyisellä verkkosivustolla, lataa tunnistetut tekstitykset automaattisesti. Jos raitoja tunnistetaan useita, lataa ensisijaisen kielen raita. Ensisijainen kieli on se, joka ladattiin viimeksi, kun ”Muista nämä raitavalinnat” -ruutu oli valittuna.

### Kysy, kun tunnistettujen tekstitysten automaattinen lataus epäonnistuu {#prompt-on-subtitle-autoload-failure}

Jos tekstitysten automaattinen lataus epäonnistuu, pyydä vahvistus ennen tunnistettujen tekstitysten lataamisen yrittämistä.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Suoratoistovideo > Sivut</a> {#pages}

Sivukohtaisten integraatioiden asetukset esimerkiksi YouTubea ja Netflixiä varten. asbplayerissa on kullekin sivulle valmiit oletusasetukset, joita voi muokata Sivut-osiossa.

### Konekäännöksen kohdekielten koodit (vain YouTube) {#youtube-translation-languages}

Määrittää YouTuben konekäännöksessä käytettävät kohdekielet. Kun kielet määritetään tässä, kukin niistä näkyy lisäraitana tekstitysraitojen valitsimessa.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Muut</a> {#misc}

### Tuo tai vie asetukset {#import-export-settings}

Tuo tai vie asetukset `json`-tiedostona.

### Teema {#theme}

Näyttää asbplayerin vaalealla tai tummalla teemalla.

### Kieli {#language}

Käyttöliittymän kieli.

Huomaa, ettei kaikkia merkkijonoja ole käännetty kaikille asbplayerin tukemille kielille. Kääntämättömät merkkijonot näytetään englanniksi. Voit osallistua kääntämiseen [Crowdin-projektissa](https://crowdin.com/project/asbplayer).

### Suurenna paikallinen video automaattisesti {#auto-maximize-local-video}

Suurentaa paikallisen videon automaattisesti, kun tekstityspaneeli avataan.

### Näytä louhintapainike tekstityslistassa {#show-mining-button-in-subtitle-list}

Kun tämä on käytössä, tekstityslistan jokaisen tekstityksen vieressä näkyy louhintapainike.

### Tekstityslistan aikaleimat {#subtitle-list-timestamps}

Määrittää, miten aikaleimat näytetään tekstityslistassa.

- **Piilotettu**: ei näytetä.
- **Alku**: näyttää vain tekstityksen alkamisajan.
- **Alku ja loppu**: näyttää tekstityksen alkamis- ja päättymisajat.

### Muista tekstityksen siirtymä {#remember-subtitle-offset}

Kun tämä on käytössä, ajoituksen siirtymä säilyy. Tekstitykset ladataan viimeksi käytetyllä siirtymällä.

### Muista viimeisin toistonopeus {#remember-last-playback-rate}

Päivittää toistonopeusasetuksen, kun nopeutta muutetaan videon aikana. Kun tämä ei ole käytössä, toisto alkaa silti määritetyllä nopeudella, mutta katselun aikana tehdyt muutokset ovat tilapäisiä.

### Muista viimeisimmät toistotilat {#remember-last-playback-modes}

Palauttaa viimeksi käytössä olleet toistotilat, kun toisto ladataan uudelleen. Kun tämä ei ole käytössä, toisto alkaa normaalitilassa.

### Kopioi nykyinen tekstitys automaattisesti leikepöydälle {#auto-copy-current-subtitle-to-clipboard}

Kopioi tekstityksen automaattisesti leikepöydälle, kun se ilmestyy näytölle. Tämä on hyödyllistä, kun haluat lähettää tekstityksiä sovelluksiin, jotka voivat seurata leikepöytää.

### Automaattisesti kopioitavat tekstitysraidat {#subtitle-tracks-eligible-for-auto-copy}

Määrittää, mitkä raidat kopioidaan automaattisesti, kun asetus [Kopioi nykyinen tekstitys automaattisesti leikepöydälle](#auto-copy-current-subtitle-to-clipboard) on käytössä.

### Näytä esikatselupikkukuvat {#show-preview-thumbnails}

Näyttää esikatselupikkukuvat tekstityslistassa.

### Näytä tekstitys pikkukuvan yläpuolella {#subtitle-above-thumbnail}

Näyttää tekstityksen tekstityslistan esikatselupikkukuvan yläpuolella.

### Tekstityksen Regex-suodatin {#subtitle-regex-filter}

Tähän Regexiin vastaavat merkkijonon osat korvataan asetuksen [Tekstityksen Regex-suodattimen tekstikorvaus](#subtitle-regex-filter-text-replacement) arvolla.

### Tekstityksen Regex-suodattimen tekstikorvaus {#subtitle-regex-filter-text-replacement}

Yllä olevaan Regexiin vastaavat merkkijonon osat korvataan tämän asetuksen arvolla. Jos arvo jätetään tyhjäksi, vastaavat osat poistetaan.

### Tekstityksen HTML {#subtitle-html}

Määrittää, miten tekstitystiedostoissa esiintyvää HTML-koodia käsitellään.

### Tunnista ja näytä Ruby-merkinnät {#detect-and-display-ruby}

Kun tämä on käytössä, asbplayer tunnistaa automaattisesti Netflix-tyyliset sanojen lukutavat ja näyttää ne tyyliteltyinä `ruby`-tageilla. Tällaisia lukutapoja esiintyy usein japaninkielisissä tekstityksissä. Esimerkiksi `花子（はなこ）`, jossa sanan jälkeen on sulkeissa sen lukutapa.

### Ota WebSocket-asiakas käyttöön {#enable-websocket-client}

Ottaa WebSocket-asiakkaan käyttöön. asbplayeria voi tällöin ohjata WebSocket-käyttöliittymän kautta.

### WebSocket-palvelimen URL {#websocket-server-url}

WebSocket-palvelimen URL-osoite, johon yhdistetään, kun WebSocket-asiakas otetaan käyttöön. Yleensä kyseessä on paikallisesti käynnissä oleva [valmiiksi pakattu WebSocket-palvelin](../guides/web-socket-server.md).

### Louhintahistorian tallennusraja {#mining-history-storage-limit}

Rajoittaa louhintahistoriaan tallennettavien korttien määrää.

### Välilehden nimi {#name-of-the-tab}

Sovelluksen välilehdessä käytettävä nimi.

## Profiilit {#profiles}

Asetusprofiili sisältää erilliset asetusarvot. Aktiivisen asetusprofiilin voi vaihtaa asetuskäyttöliittymästä tai **Lataa tekstitykset**- ja **Anki-vienti**-valintaikkunoista.
