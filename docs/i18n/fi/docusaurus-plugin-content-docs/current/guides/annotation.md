---
sidebar_position: 1
---

import project from '@site/src/project';

# Annotointi {#annotation}

asbplayer voi annotoida tekstityksiä ja auttaa näin kielten oppimisessa. Annotointiominaisuuksia ovat:

- **Sanojen tyyli**: väri, alleviivaus, ääriviiva ja muut tyylit sanan tilan perusteella
    - Tunnettujen sanojen tiedot voidaan hakea ja synkronoida Ankista tai WaniKanista ja/tai tallentaa paikallisesti asbplayeriin (sisältää tuonti- ja vientiominaisuudet tunnettujen sanojen lisäämiseksi).
- **Lukutapojen annotointi**: lukutavat näytetään kunkin sanan yläpuolella tai sanan tilan perusteella.
- **Yleisyysannotointi**: yleisyys sijoituksen perusteella näytetään kunkin sanan alapuolella tai sanan tilan perusteella (vaatii vähintään yhden sijoitukseen perustuvan yleisyyssanakirjan).
- **Korkoaksentin annotointi**: aksenttikuviot näytetään furiganassa tai kana-merkkisissä sanoissa (vaatii vähintään yhden korkoaksenttisanakirjan).
- **Sanastoannotointi**: kunkin sanan lyhyt määritelmä tai selitys.
- **Tilastot ja ymmärtäminen**: tietoa nykyisen median tunnetuista sanoistasi.
- **Mukautuva toisto**: optimoi oppimiskokemusta toistotilojen ja annotointitietojen avulla.
- **Sanat selain**: hallitse paikallisia sanoja ja tarkastele ulkoisista lähteistä synkronoituja sanoja.
- **Paljon muita ominaisuuksia on tulossa!**

:::info
Annotointi vaatii määritetyn [Yomitan](https://yomitan.wiki/)-asennuksen ja [yomitan-api](https://github.com/yomidevs/yomitan-api)-rajapinnan.

Jos käytät **paikallista sanatietokantaa**, suosittelemme asentamaan asbplayerin selainlaajennuksen, jotta selaimesi ei todennäköisesti poista tallennettuja sanoja. Jos laajennuksen asentaminen ei onnistu, harkitse asetusten ja/tai paikallisten sanojen säännöllistä vientiä varmuuskopioksi.
:::

## Käyttöönotto {#setup}

1. Avaa asbplayerin **Asetukset**.
2. Siirry **Annotointi**-osioon.
3. Valitse määritettävä raita.
4. Määritä raidan **Yomitan-URL**.
    - Tarvitset määritetyn [Yomitan](https://yomitan.wiki/)-asennuksen ja [yomitan-api](https://github.com/yomidevs/yomitan-api)-rajapinnan.
    - Jos URL-osoite on virheellinen tai siihen ei saada yhteyttä, asbplayer näyttää asetuksen vieressä virheilmoituksen.
    - Yleisyystiedot vaativat, että Yomitan-asennuksessa on käytettävissä vähintään yksi sijoitukseen perustuva yleisyyssanakirja.
5. (Ankin käyttäjät) Määritä, mistä korteista tunnettujen sanojen tilatiedot haetaan.
    - [`Anki-pakat`](../reference/settings.md#anki-decks) kannattaa yleensä jättää tyhjäksi, jotta tiedot haetaan kaikista pakoista; kenttien suodatus riittää tavallisesti.
    - [`Ankin sanakentät`](../reference/settings.md#anki-word-fields) viittaavat Anki-muistiinpanon kenttään, joka sisältää vain kohdesanan.
    - [`Ankin lausekenttiä`](../reference/settings.md#anki-sentence-fields) tulee käyttää vain Anki-muistiinpanoissa, joissa ei ole erillistä sanakenttää (kuten lausepakoissa). Näitä sanoja käytetään varalla, jos sanaa ei löydy Ankin sanakentistä.
    - Täytä tietokanta käyttämällä [`Rakenna Ankin sanatietokanta uudelleen`](../reference/settings.md#re-build-anki-word-database), kun olet määrittänyt kentät.
6. (WaniKanin käyttäjät) Luo asbplayerille tunniste sivulla [WaniKani > Asetukset > API-tunnisteet](https://www.wanikani.com/settings/personal_access_tokens).
    - Kirjoita `Token Description` -kenttään `asbplayer` ja jätä kaikki `Permissions`-kohdat valitsematta; asbplayer tarvitsee vain lukuoikeuden WaniKani-tilillesi.
    - Valitse `Generate token` ja kopioi luotu tunniste kohtaan [`WaniKani API -tunniste`](../reference/settings.md#wanikani-api-token).
    - Täytä tietokanta käyttämällä [`Rakenna WaniKanin sanatietokanta uudelleen`](../reference/settings.md#re-build-wanikani-word-database), kun olet määrittänyt API-tunnisteen.
7. Ota raidan haluamasi annotointiominaisuudet käyttöön (tyyli, lukutavat, yleisyys, korkoaksentti jne.). Muokkaa muita asetuksia tarpeen mukaan.
8. Katso kunkin asetuksen tarkemmat kuvaukset asetusoppaan [Annotointi](../reference/settings.md#annotation)-osiosta. Näppäintoiminnot löytyvät [annotoinnin pikanäppäimet](../reference/settings.md#annotation-keyboard-shortcuts) -ryhmästä.

## Vianmääritys {#troubleshooting}

Katso annotointiin liittyvien ongelmien vianmääritys dokumentaation [yleiset ongelmat](../common-issues.md#annotation)-osiosta. Jos et löydä sieltä ratkaisua, ota yhteyttä <a href={project.urls.discord}>Discordissa</a> tai lähetä <a href={`${project.urls.repo}/issues`}>virheraportti</a>, jossa kuvaat ongelman yksityiskohtaisesti ja kerrot, miten sen voi toistaa.
