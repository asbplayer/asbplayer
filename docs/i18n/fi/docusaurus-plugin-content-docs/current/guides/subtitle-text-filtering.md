---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Tekstitystekstin suodatus {#subtitle-text-filtering}

Jos haluat suodattaa tiettyjä kohtia tekstitystekstistä, voit käyttää säännöllistä lauseketta (Regex). asbplayer voi etsiä määritettyä Regex-mallia vastaavat merkkijonot ja poistaa osumat.

## Regex-suodattimen määrittäminen {#configure-the-regex-filter}

Etsi asbplayerin asetusten <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Muut</a>-osiosta ”Tekstityksen Regex-suodatin” -tekstikenttä. Suodata haluamasi sisältö kirjoittamalla kenttään sopiva Regex.
Voit korvata suodatetun sisällön kirjoittamalla merkkijonon ”Tekstityksen Regex-suodattimen tekstikorvaus” -kenttään. Jos kenttä jätetään tyhjäksi, sisältö poistetaan.

### Poista puhujien nimet {#remove-speaker-names}

Poista sulkeissa olevat puhujien nimet (esimerkiksi ”**（山田）**　元気ですか？”).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Säilytä japaninkieliset lukutavat {#preserve-japanese-readings}

Poista sulkeissa olevat nimet tai kuvaukset, mutta säilytä japaninkielisen tekstin jälkeen välittömästi tulevat lukutavat. Esimerkiksi `（山田）漢字(かんじ)を読む。` muuttuu muotoon `漢字(かんじ)を読む。`. Sekä `(かんじ)` että `（かんじ）` säilytetään, kun niitä edeltää välittömästi Regexissä määritettyyn kanji-, hiragana- tai katakana-alueeseen kuuluva merkki.

Tämä on heuristiikka: se säilyttää myös heti japaninkielisen tekstin jälkeiset kuvaukset, kuten `こんにちは（笑）`, ja poistaa lukutavat, joiden ja perusmuodon välissä on välilyönti. Sisäkkäisiä sulkeita ei käsitellä. Jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Yhdistä tekstitysrivit {#merge-subtitle-lines}

Joissakin tekstityksissä teksti on jaettu useille riveille. Tämä Regex yhdistää ne yhdeksi riviksi. Suodatin toimii vain, jos kirjoitat myös `$1 $2` ”Tekstityksen Regex-suodattimen tekstikorvaus” -kenttään.

Kun yhdistät tämän mallin muihin, sijoita se viimeiseksi, jotta tarkempi vaihtoehto voi osua ensin samassa kohdassa. Vaihtoehtoja ei suoriteta erillisinä suodatuskierroksina. Kaikki osumat käyttävät samaa korvaustekstiä, ja kaappausryhmien lisääminen muihin vaihtoehtoihin muuttaa `$1 $2` -viittauksissa tarvittavia numeroita.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Poista rivinvaihdot {#remove-newlines}

Poista kaikki rivinvaihtomerkit lisäämättä välilyöntejä. Esimerkiksi rivit `こんにちは` ja `世界` yhdistyvät muotoon `こんにちは世界`. Jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi. Jos haluat lisätä rivien väliin välilyönnin, käytä [tekstitysrivien yhdistämisesimerkkiä](#merge-subtitle-lines).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Poista hakasulkeissa olevat kuvaukset {#remove-bracketed-descriptions}

Poista hakasulkeissa olevat kuvaukset, jotka kertovat soivista äänistä tai musiikista (esimerkiksi ”**\[LEIKKISÄÄ MUSIIKKIA]**” tai ”**\-[HENGÄHDYS]**”).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Poista suuraakkosilla kirjoitetut kuvaukset {#remove-uppercase-descriptions}

Voit vaihtoehtoisesti suodattaa suuraakkosilla kirjoitetut kuvaukset, joissa ei ole hakasulkeita (esimerkiksi ”**LEIKKISÄÄ MUSIIKKIA**”). Jos kielessäsi on muita tarkkeellisia kirjaimia, voit lisätä ne tähän luetteloon.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Poista musiikkimerkit {#remove-music-symbols}

Poistaa kaikki yksinään esiintyvät musiikkia ilmaisevat merkit ja niiden yhdistelmät (esimerkiksi `♪♬♪`).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Poista äänitehostemerkinnät {#remove-sound-effect-cues}

Poista tekstitykset, jotka sisältävät vain hakasulkeissa olevan kuvauksen tai musiikkimerkkejä, kuten `[UKKONEN JYRÄHTÄÄ]`, `-[HENGÄHDYS]` tai `♪♬♪`. Ankkurit `^` ja `$` vaativat, että koko tekstitys vastaa mallia, joten vuorosanat, kuten `Hello [GASPS]` tai `♪ Hello ♪`, säilytetään. Jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Poista vasemmalta oikealle -merkit {#remove-left-to-right-marks}

Poista U+200E eli näkymätön vasemmalta oikealle -merkki (LRM). Esimerkiksi teksti `Hello`, LRM-merkki ja `world` muuttuvat muotoon `Helloworld`. Kirjoita Regex-kenttään escape-sekvenssi `\u200E` ja jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Poista kaksisuuntaisen tekstin ohjausmerkit {#remove-bidi-controls}

Poista kaikki Unicode-kaksisuuntaisuuden ohjausmerkit, kuten vasemmalta oikealle -merkki (U+200E), oikealta vasemmalle -merkki (U+200F) sekä upotus-, ohitus- ja eristysmerkit. Jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi. Nämä merkit voivat vaikuttaa oikealta vasemmalle luettavan tai suunnaltaan vaihtelevan tekstin järjestykseen, joten käytä suodatinta vain, jos haluat poistaa ne.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Regexien yhdistäminen {#combining-regexes}

Säännölliset lausekkeet voi yhdistää merkillä `|` (välejä ei tarvita). Jos haluat esimerkiksi käyttää kahta yllä olevaa Regexiä, voit kirjoittaa `-?\[.*\]|[♪♬#～〜]+`. Voit yhdistää tällä tavoin niin monta Regexiä kuin haluat.

### Poista sulkeissa oleva teksti ja rivinvaihdot {#remove-parenthesized-text-and-newlines}

Poista sulkeissa oleva teksti ja kaikki rivinvaihdot yhdessä näin:

Jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi. Esimerkiksi rivinvaihdolla erotettu teksti `（山田）こんにちは` ja `世界` yhdistyy muotoon `こんにちは世界`. Tämä poistaa sekä ASCII- että täysleveät sulkeet sisältöineen, myös japaninkieliset lukutavat, ja yhdistää rivit lisäämättä välilyöntejä. Sisäkkäisiä sulkeita ei käsitellä; käytä niihin [puhujien nimien esimerkkiä](#remove-speaker-names).

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Yhdistä kaikki poistavat suodattimet {#combine-all-removal-filters}

Poista samalla myös kaksisuuntaisen tekstin ohjausmerkit, sulkeissa olevat puhujien nimet (myös sisäkkäiset), hakasulkeissa olevat kuvaukset ja musiikkimerkit näin:

Jätä ”Tekstityksen Regex-suodattimen tekstikorvaus” tyhjäksi. Tämä yhdistää yllä olevat poistoesimerkit ja yhdistää rivit lisäämättä välilyöntejä. Se poistaa myös japaninkieliset lukutavat; käytä [lukutavat säilyttävää esimerkkiä](#preserve-japanese-readings), jos haluat pitää ne.

<details>
<summary>Use this filter</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Näkymättömät merkit ja tyhjät tekstitykset {#invisible-characters}

Tyhjältä näyttävä tekstitys voi sisältää näkymättömiä merkkejä, kuten LRM-merkin. asbplayer poistaa jäsennyksen ja suodatuksen jälkeen tekstitykset, joissa on vain välilyöntejä, ohjausmerkkejä tai oletusarvoisesti ohitettavia Unicode-merkkejä. Merkityksellisen tekstin sisällä olevat suunnan merkit säilytetään, ellei Regex poista niitä erikseen.

Tekstityksen alussa tai lopussa olevat näkymättömät merkit voivat estää ankkuroitua mallia, kuten `^\[.+\]$`, vastaamasta. Jos malli ei vastaa, asbplayer yrittää uudelleen ilman ympäröiviä välilyöntejä ja näkymättömiä ohjausmerkkejä, mutta poistaa tekstityksen vain, jos uudelleenyrityksessä ei jää merkityksellistä tekstiä. Esimerkiksi `[THUNDER]` ja sitä seuraava LRM poistetaan tällä mallilla, kun korvaus on tyhjä. Uudelleenyritys säilyttää alkuperäisen tekstityksen, jos korvauksessa olisi merkityksellistä tekstiä.

Kun yhdistät ankkuroitua mallia kaksisuuntaisuuden merkkejä poistavaan vaihtoehtoon, muista, että korvaukset tehdään yhdellä kierroksella. Esimerkiksi malli `^\[.+\]$|\u200E` poistaa `[THUNDER]`-tekstin perässä olevan LRM-merkin, mutta ei yritä sen jälkeen uudelleen poistaa hakasulkeissa olevaa kuvausta. Poista molemmat samalla kierroksella käyttämällä ankkuroimatonta mallia `\[.+\]|\p{Bidi_Control}` tyhjällä korvaustekstillä. Tämä poistaa myös vuorosanojen sisällä olevat hakasulkeissa olevat kuvaukset.

## Opi lisää {#learn}

Opi kirjoittamaan ja testaamaan mukautettuja säännöllisiä lausekkeita sivustolla [Regex Learn - Playground](https://regexlearn.com/playground).
