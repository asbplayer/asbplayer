---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Tekstitysten louhinta perusteellisesti {#mining-in-depth}

asbplayerilla voit louhia lauseita monella tavalla tarpeidesi ja mieltymystesi mukaan.

## Anki-vientivalintaikkunan avaaminen {#opening-the-anki-export-dialog}

**Anki-vientivalintaikkunan** voi avata usealla tavalla:

1. **Lähetä tekstitykset Ankin** <NoteAddIcon /> -painike, joka löytyy **sivupaneelin** **tekstityslistasta** tai verkkosivustolta.
2. **Lähetä tekstitykset Ankin** <NoteAddIcon /> -painike **peittokuvan käyttöliittymässä** suoratoistovideolla tai mobiilisivustolla.
3. **Lähetä nykyinen tekstitys Anki-valintaikkunaan** -toiminnon [louhinnan pikanäppäin](../reference/settings.md#mining-keyboard-shortcuts), oletuksena `Ctrl + Shift + X`.
4. Napsauta suoratoistovideota hiiren kakkospainikkeella ja valitse asbplayer → **Lähetä tekstitykset Ankin**.

:::info
Menetelmät 1 ja 2 avaavat valintaikkunan vain, jos [louhintapainikkeen oletustoiminnoksi](../reference/settings#mining-button-default-action) on asetettu ”Näytä Anki-valintaikkuna”.
:::

:::info
Kun ladattuna on _tyhjä_ tekstitysraita ja äänen tallennus on käytössä, kaikki yllä mainitut toiminnot käynnistävät äänen tallennuksen ensimmäisellä käyttökerralla ja avaavat Anki-valintaikkunan toisella käyttökerralla.
:::

## Korttien muokkaaminen {#adjusting-cards}

Kortteja voi muokata valintaikkunassa ennen niiden viemistä.

### Valittu aikaväli {#selected-time-range}

Aikaväliä voi muuttaa valintaikkunan alareunassa olevalla **liukusäätimellä**.

- **Lausekenttä** päivittyy automaattisesti vastaamaan valittua aikaväliä, jos sitä ei ole jo muokattu käsin.
- Paikallisissa tiedostoissa myös äänileike päivittyy automaattisesti.
- Suoratoistovideolla äänileikkeen voi tallentaa uudelleen valitulla aikavälillä.

### Äänikenttä {#audio-field}

**Äänikentässä** näkyy tallennettu äänileike, ja siinä on kolme toimintopainiketta:

- **Toista/tauko** — kuuntele äänileikkeen esikatselu suoraan valintaikkunassa.
- **Tallenna uudelleen** — tallenna ääni uudelleen valitulla aikavälillä (vain suoratoistovideolla; näkyy, kun uudelleentallennuksen takaisinkutsu on käytettävissä).
- **Lataa** — lataa äänileike tiedostona laitteellesi.

### Tekstikentät {#text-fields}

Kaikkia tekstikenttiä — lausetta, määritelmää, sanaa, mukautettuja kenttiä, lähdettä, URL-osoitetta ja tunnisteita — voi muokata. Määritelmäkentän täyttämiseen käytetään yleensä erillistä sanakirjasovellusta.

### Kuvakenttä {#image-field}

Paikallisissa tiedostoissa **Kuvakentän** **Esikatselu-painikkeella** <ImageIcon /> voi vaihtaa videon aikaleimaa, josta kuvakaappaus otetaan.

## Korttien vieminen {#exporting-cards}

Vie kortti lopuksi valintaikkunan alareunan painikkeilla. Vientitapoja on kolme:

1. **Vie**: vie kortti valintaikkunan sisällöllä.
2. **Päivitä viimeisin kortti**: päivitä Anki-pakkasi viimeisin kortti valintaikkunan sisällöllä.
3. **Avaa Ankissa**: avaa Ankin kortinluontinäkymän, jonka kentät on täytetty valintaikkunan sisällöllä.

## Louhinta ilman valintaikkunaa {#dialog-less-mining-flows}

Louhinta ilman valintaikkunaa ja sanan määritelmän lisääminen onnistuvat, kun asbplayeria käytetään Ankiin integroituvan sanakirjasovelluksen kanssa. Tällä hetkellä suosituin tällainen sovellus on [Yomitan](https://yomitan.wiki/).

### Päivitä viimeisin kortti {#update-last-card}

Louhinta Yomitanilla ilman valintaikkunaa toimii näin:

1. Valitse Yomitanilla tekstityksestä sana, josta haluat tehdä kortin.
2. Luo kortti Yomitanin kortinluontipainikkeella.
3. Päivitä kortti heti asbplayerin **Päivitä viimeisin kortti** -toiminnolla. Sen [louhinnan pikanäppäin](../reference/settings.md#mining-keyboard-shortcuts) on oletuksena `Ctrl + Shift + U`. Korttiin lisätään asbplayerin tarjoama sisältö.

Tässä toimintatavassa valintaikkunan ohittaminen tarkoittaa, ettei korttia voi muokata valintaikkunassa. Tähän on kuitenkin vaihtoehtoja:

- Viimeisen kortin suoran päivittämisen sijaan voit avata valintaikkunan näppäimillä `Ctrl + Shift + X`, muokata korttia ja valita sitten **Päivitä viimeisin kortti** valintaikkunassa. Näin käytät edelleen valintaikkunaa, mutta saat Yomitanin automaattisesti lisäämän sanan määritelmän.
- **Anki-vientivalintaikkunan** voi avata kortin luomisen _jälkeen_ myös **Ota kuvakaappaus manuaalisesti** -toiminnolla. Sen [louhinnan pikanäppäin](../reference/settings.md#mining-keyboard-shortcuts) on oletuksena `Ctrl + Shift + V`.

### Yhdellä napsautuksella {#one-click}

Katso [yhden napsautuksen louhintaopas](./one-click-mining.md).
