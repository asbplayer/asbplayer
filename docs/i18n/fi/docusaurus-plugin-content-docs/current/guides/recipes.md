---
sidebar_position: 1.5
title: Reseptit
---

import project from '@site/src/project';

import RecipePreset, { dialogueFocusRecipe, gapFastForwardRecipe } from '@site/src/components/RecipePreset';

export const nonAnnotationPlaybackSettings = {
  dictionaryTracks: Array.from({ length: 3 }, () => ({
    dictionaryPlaybackConfig: Object.fromEntries(
      ['autoPause', 'repeat', 'condensed', 'fastForward', 'wordVisibility'].map((feature) => [
        feature,
        {
          onStatuses: Array.from({ length: 6 }, () => ({ enabled: false })),
          onStates: [{ enabled: false }],
          ...(feature === 'fastForward' ? { rateByComprehension: { enabled: false } } : {}),
        },
      ])
    ),
  })),
};

export const annotationPlaybackRule = (statuses, rules = {}) => ({
  rules: { minWords: 0, maxWords: 0, minFrequency: 0, maxFrequency: 0, ...rules },
  onStatuses: Array.from({ length: 6 }, (_, status) => ({ enabled: statuses.includes(status) })),
  onStates: [{ enabled: false }],
});

export const annotationPlaybackSelection = (statuses) => ({
  onStatuses: Array.from({ length: 6 }, (_, status) => ({ enabled: statuses.includes(status) })),
  onStates: [{ enabled: false }],
});

export const annotationPlaybackSettings = (playbackConfig) => ({
  seekableTracks: 1,
  dictionaryTracks: nonAnnotationPlaybackSettings.dictionaryTracks.map((track, index) => ({
    dictionaryPlaybackConfig: {
      ...Object.fromEntries(
        Object.entries(track.dictionaryPlaybackConfig).map(([feature, config]) => [
          feature,
          { ...config, ...(index === 0 ? playbackConfig[feature] : {}) },
        ])
      ),
      ...(index === 0 && playbackConfig.selectOnPause !== undefined
        ? { selectOnPause: playbackConfig.selectOnPause }
        : {}),
    },
  })),
});

export const unfamiliarWordPlaybackConfig = {
  autoPause: annotationPlaybackRule([0, 1]),
  repeat: annotationPlaybackRule([0, 1]),
};

export const unfamiliarWordRepeatSettings = {
  autoPausePreference: 2,
  autoPauseResumeMode: 'fixed',
  autoPauseFixedDurationMs: 1000,
  autoPauseResumeDelayMs: 0,
  repeatCountPreference: 1,
  repeatsBeforeShowingSubtitles: 0,
  subtitleVisibility: 'whenDue',
  subtitleTriggerStartOffset: 0,
  subtitleTriggerEndOffset: 0,
};

# Reseptit

Reseptit yhdistävät toistotiloja ja toistoasetuksia, jotta voit vaihtaa oppimistehtävästä toiseen. Valitse resepti kohdassa **Asetukset > Toisto**, soittimen säätimissä toistotilojen vieressä tai mobiilin peittokuvan käyttöliittymässä. Palaa käyttämiisi asetuksiin valitsemalla **Ei käytössä**. Tallennetut toistoasetukset, muistiin tallennettu toistonopeus ja toistotilat säilyvät reseptin ollessa käytössä.

## Reseptin luominen ja muokkaaminen

Valitse Toisto-välilehdellä **Muokkaa reseptiä**. Jos resepti on valittuna, aloitat sen pohjalta; muussa tapauksessa käytössä ovat nykyiset toistoasetuksesi. Valitse toistotilat ja muuta mukaan haluamiasi asetuksia. Muutokset pysyvät luonnoksessa eivätkä vaikuta toistoon ennen tallentamista.

Valitse **Tallenna resepti** tarkistaaksesi asetukset ja kirjoittaaksesi enintään 100 merkin nimen. Voit poistaa yksittäisiä asetuksia esikatselusta; pois jätetyissä asetuksissa käytetään omia asetuksiasi. Toistotilat määritetään aina kokonaisena yhdistelmänä.

Kun muokkaat olemassa olevaa reseptiä etkä muuta sen nimeä, päivität kyseisen reseptin. Nimikenttään kirjoittaminen luo uuden reseptin, vaikka palauttaisit alkuperäisen nimen. Hylkää luonnos valitsemalla **Peruuta**.

## Tuonti ja jakaminen

Valitse **Tuo resepti**, liitä reseptin JSON, tarkista sen asetukset ja vahvista. Voit muuttaa nimeä ja poistaa asetuksia ennen tuontia. Tuodut reseptit lisätään luettelon loppuun ja valitaan käyttöön. Tuntemattomat asetukset ja virheelliset asetusarvot ohitetaan. Nimen ja toistotilojen on oltava kelvollisia.

Voit myös avata tuontilinkin. Se avaa verkkosovelluksen Toisto-välilehdelle, jossa tuonnin esikatselu on valmiina. Resepti otetaan käyttöön, kun vahvistat tuonnin.

Avaa reseptin esikatselukuvake avattavassa valikossa kopioidaksesi sen JSONin tai jakaaksesi sen tuonti-URL-osoitteen. Esikatselussa voit myös poistaa reseptin vahvistuksen jälkeen. Siirrä reseptejä ylös- ja alas-painikkeilla tai vedä ne haluamaasi kohtaan valikossa. Valinta seuraa reseptiä sen siirtyessä; valitun reseptin poistaminen poistaa reseptit käytöstä.

## Pikanäppäimet

Määritä **Selaa reseptejä eteenpäin**, **Selaa reseptejä taaksepäin** ja **Vaihda reseptiä #1** – **#10** kohdassa **Pikanäppäimet > Toisto**. Aktiivisen reseptin vaihtaminen poistaa reseptit käytöstä. Selaaminen noudattaa luettelon järjestystä ja sisältää **Ei käytössä** -vaihtoehdon. Toistoasetusten ja -tilojen pikanäppäimet näyttävät ilmoituksen reseptin ollessa aktiivinen. Muokkaa reseptiä tai poista se käytöstä muuttaaksesi kyseisiä asetuksia.

## Yleisiä reseptejä

Alla on hyödyllisiä valmiita reseptejä tavallisiin oppimistehtäviin. Jos haluat jakaa omia reseptejäsi tai tarvitset puuttuvan ominaisuuden täydellisen reseptin luomiseen, voit pyytää niitä <a href={project.urls.discord}>Discordissa</a> tai <a href={`${project.urls.repo}/issues/new/choose`}>GitHubissa</a>.

### Normaalitila

Käytä tavallisia toistoasetuksia ilman automaattista oppimistilaa. Suosittelemme pitämään reseptien ulkopuoliset asetukset mahdollisimman yksinkertaisina, jotta `Ei käytössä` vastaa normaalia toistoa.

### Keskity vuoropuheluun

Keskity vuoropuheluun yhdistämällä tiivistetty toisto ja pikakelaus. Ohita aukot, joiden vähimmäispituus on 5 sekuntia, ja kelaa muut ehdot täyttävät aukot 3-kertaisella nopeudella, kun niiden pituus on vähintään sekunti. Säilytä aukon kummallakin puolella 150 ms kontekstia ja toista vuoropuhelu käyttäen normaalia toistonopeutta.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Aukkojen pikakelaus

Katso koko video ja kelaa ehdot täyttävät aukot 3-kertaisella nopeudella, kun niiden pituus on vähintään sekunti. Säilytä aukon kummallakin puolella 150 ms kontekstia ja toista vuoropuhelu käyttäen normaalia toistonopeutta.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Lukutila

Pysäytä toisto jokaisen tekstityksen alussa, jotta voit lukea sen ja etsiä sanoja. Jatka sitten toistoa manuaalisesti kuullaksesi äänen tekstitysten näkyessä. Osoittimen vieminen tekstitysten päälle pysäyttää videon myös toiston aikana; osoittimen siirtäminen pois jatkaa toistoa.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Reading mode',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'manual',
      pauseOnHoverMode: 1,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Kuuntelutila

Kuuntele ilman tekstityksiä. Pysähdy sitten automaattisesti kunkin tekstityksen lopussa nähdäksesi tekstin ja tarkistaaksesi ymmärtämisesi. Jatka toistoa, kun olet valmis.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Listening mode',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'manual',
      subtitleVisibility: 'whilePaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Pelkkä ääni

Kuuntele keskeytyksettä tekstitysten ollessa piilossa. Pysäytä toisto manuaalisesti nähdäksesi nykyisen tekstityksen, kun tarvitset apua.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Audio only',
    playbackModes: [1],
    settings: {
      ...nonAnnotationPlaybackSettings,
      subtitleVisibility: 'whileManuallyPaused',
    },
  }}
/>

### Tehokuuntelu

Kuuntele kukin tekstitys kolmesti ja pidä kuuntelukertojen välissä sekunnin tauko. Tekstitykset pysyvät piilossa kahdella ensimmäisellä kerralla ja näkyvät viimeisellä kerralla, jolloin voit tarkistaa ymmärtämisesi. Toisto jatkuu automaattisesti jokaisen tauon jälkeen; muuta sekunnin tauon kestoa tarpeen mukaan.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Intensive listening',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'fixed',
      autoPauseFixedDurationMs: 1000,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 2,
      repeatsBeforeShowingSubtitles: 2,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Valmistava kuuntelu

Pysäytä toisto jokaisen tekstityksen alussa ja lue se omalla äidinkielelläsi. Anna tekstityksen kadota ja kuuntele sitten ääntä ilman tekstityksiä. Lukuaika on 80 ms merkkiä kohden, vähintään sekunti ja enintään kuusi sekuntia. Kun teksti katoaa, toisto pysyy tauolla vielä 500 ms ennen automaattista jatkumista. Voit muuttaa näitä aikoja reseptiä muokatessasi.

Valitse lukuaikaan käytettävät raidat kohdassa **Toistotilojen ja pikanäppäinten käyttämät tekstitysraidat**.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Primed listening',
    playbackModes: [3],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 500,
      subtitleVisibility: 'whilePaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Lue ääneen

Lue kukin tekstitys ääneen ennen alkuperäisen äänen kuulemista ja vertaa sitten ääntämystäsi ja rytmiäsi. Toisto pysähtyy alussa tekstitysten ollessa näkyvissä ja jatkuu automaattisesti 80 ms:n kuluttua merkkiä kohden, kuitenkin 1–6 sekunnin rajoissa. Kukin tekstitys toistetaan kerran. Muuta tauon kestoa, jotta ehdit puhua.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Read aloud',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 1,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      repeatsBeforeShowingSubtitles: 0,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Varjostusharjoittelu

Puhu alkuperäisen äänen kanssa tai hieman sen jäljessä ja jäljittele sen rytmiä ja ääntämystä tekstitysten näkyessä. Kukin tekstitys toistetaan kerran, ja jokaisen toistokerran lopussa on sekunnin tauko ennen toiston automaattista jatkumista.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Shadowing',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'fixed',
      autoPauseFixedDurationMs: 1000,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      repeatsBeforeShowingSubtitles: 0,
      subtitleVisibility: 'whenDue',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

### Palautus mieleen

Kuuntele ääntä ja toista vuorosanat sitten ääneen muistista automaattisen lopputauon aikana. Tekstitykset pysyvät piilossa toiston ja automaattipysäytysjen aikana. Puheaika on 80 ms merkkiä kohden, 1–6 sekunnin rajoissa, ja kukin tekstitys toistetaan kerran. Muuta taukoaikoja tarpeen mukaan. Pysäytä toisto manuaalisesti uudelleentoiston aikana, jos haluat nähdä tekstin.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Recall',
    playbackModes: [3, 5],
    settings: {
      ...nonAnnotationPlaybackSettings,
      autoPausePreference: 2,
      autoPauseResumeMode: 'subtitleLength',
      autoPauseMinimumDurationMs: 1000,
      autoPauseMaximumDurationMs: 6000,
      autoPauseTimePerCharacterMs: 80,
      autoPauseResumeDelayMs: 0,
      repeatCountPreference: 1,
      subtitleVisibility: 'whileManuallyPaused',
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
    },
  }}
/>

## Annotointireseptit

Nämä valmiit reseptit edellyttävät, että [annotointi](./annotation.md) on käytössä, koska ne hyödyntävät sen tietoja. Jos haluat jakaa omia reseptejäsi tai tarvitset puuttuvan ominaisuuden täydellisen reseptin luomiseen, voit pyytää niitä <a href={project.urls.discord}>Discordissa</a> tai <a href={`${project.urls.repo}/issues/new/choose`}>GitHubissa</a>.

Lataa kohdekieliset tekstitykset **Raidalle 1**. Nämä reseptit käyttävät tätä raitaa toistoon ja sanojen valintaan. **Ennestään tuntematon** tarkoittaa tilaa **Ei kerätty** tai **Tuntematon**. Muissa annotoinnin näyttöasetuksissa, kuten lukutavoissa ja väreissä, käytetään omia asetuksiasi.

### Ennestään tuntemattomien sanojen pelastus

Katso tekstitykset näkyvissä. Jos rivillä on ennestään tuntematon sana, pysäytä toisto sen lopussa sekunniksi ja toista rivi kerran uudelleen. Muut rivit toistetaan keskeytyksettä. Tauon aikana valitaan ensimmäinen ennestään tuntematon sana, jotta voit etsiä sen. Muuta tauon kestoa, jos tarvitset enemmän aikaa.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word rescue',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        selectOnPause: annotationPlaybackSelection([0, 1]),
      }),
    },
  }}
/>

### i+1-louhinta

Keskity tekstityksiin, joissa on täsmälleen yksi **Ei kerätty** -token. Tiivistetty toisto siirtyy ehtoja täyttävältä riviltä toiselle. Toisto pysähtyy kunkin rivin lopussa, kunnes jatkat sitä manuaalisesti; samalla valitaan tarkasteltava tai louhittava **Ei kerätty** -token.

Tämä etsii i+1-ehdokkaita, mutta ei takaa, että kaikki muut sanat tunnetaan: rivillä voi olla myös **Tuntemattomia** sanoja, ja saman **Ei kerätty** -sanan toistuvat esiintymät lasketaan erikseen. Louhinta tehdään edelleen manuaalisesti.

<RecipePreset
  recipe={{
    name: 'i+1 mining',
    playbackModes: [2, 3],
    settings: {
      ...annotationPlaybackSettings({
        autoPause: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        condensed: annotationPlaybackRule([0], { minWords: 1, maxWords: 1 }),
        selectOnPause: annotationPlaybackSelection([0]),
      }),
      autoPausePreference: 2,
      autoPauseResumeMode: 'manual',
      subtitleVisibility: 'whenDue',
      streamingCondensedPlaybackMinimumSkipIntervalMs: 0,
      subtitleTriggerStartOffset: 0,
      subtitleTriggerEndOffset: 0,
      subtitleTriggerGapStartOffset: 0,
      subtitleTriggerGapEndOffset: 0,
    },
  }}
/>

### Ennestään tuntemattomien sanojen vihjeet

Kuuntele niin, että ennestään tuntemattomat sanat näkyvät ja tutut sanat on piilotettu. Ennestään tuntemattomia sanoja sisältävät rivit pysähtyvät sekunniksi lopussa, jolloin koko teksti paljastuu, ja toistetaan sitten kerran vihjeet palautettuina. Tauon aikana valitaan ensimmäinen ennestään tuntematon sana sen etsimistä varten. Täysin sanastetuilla riveillä, joissa ei ole ennestään tuntemattomia sanoja, ei näytetä tekstitystä.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word hints',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        selectOnPause: annotationPlaybackSelection([0, 1]),
        wordVisibility: {
          ...annotationPlaybackRule([0, 1]),
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### Ennestään tuntemattomien sanojen aukkotehtävä

Lue kunkin tekstityksen tutut osat, kun ennestään tuntemattomat sanat ovat piilossa, ja yritä täydentää puuttuvat sanat äänen ja asiayhteyden perusteella. Ennestään tuntemattomia sanoja sisältävät rivit pysähtyvät sekunniksi lopussa koko tekstin paljastamiseksi ja toistetaan sitten kerran aukot palautettuina. Ohitetut sanat pysyvät näkyvissä.

<RecipePreset
  gapVariants
  recipe={{
    name: 'Unfamiliar-word cloze',
    playbackModes: [3, 5],
    settings: {
      ...unfamiliarWordRepeatSettings,
      ...annotationPlaybackSettings({
        ...unfamiliarWordPlaybackConfig,
        wordVisibility: {
          ...annotationPlaybackRule([2, 3, 4, 5]),
          onStates: [{ enabled: true }],
          hideWordsIndividuallyUntilThreshold: true,
          wholeSubtitleMatchThreshold: 1,
        },
      }),
    },
  }}
/>

### Mukautuva kuuntelutahti

Toista vuoropuhelu 1-kertaisella nopeudella, kun sen arvioitu ymmärrettävyys on enintään 60 %. Kasvata nopeutta vähitellen 1,8-kertaiseksi 100 %:n kohdalla. Tiivistetty toisto ohittaa vähintään sekunnin mittaiset aukot ja säilyttää niiden molemmilla puolilla 150 ms kontekstia. Jäljelle jäävät ehdot täyttävät aukot toistetaan 1,8-kertaisella nopeudella.

Muuta perusnopeutta ja pikakelausnopeutta reseptiä muokatessasi. Pikakelausnopeuden on oltava perusnopeutta suurempi.

<RecipePreset
  recipe={{
    name: 'Adaptive listening pace',
    playbackModes: [2, 4],
    settings: {
      ...annotationPlaybackSettings({ fastForward: { rateByComprehension: { enabled: true } } }),
      playbackRate: 1,
      fastForwardModePlaybackRate: 1.8,
      fastForwardPlaybackMinimumSkipIntervalMs: 1000,
      streamingCondensedPlaybackMinimumSkipIntervalMs: 1000,
      subtitleTriggerGapStartOffset: 150,
      subtitleTriggerGapEndOffset: -150,
    },
  }}
/>
