---
sidebar_position: 3
---

import project from '@site/src/project';

import CodeBlock from '@theme/CodeBlock'; // Empty fenced code blocks lose their title and copy button; CodeBlock preserves both.

# Filtrer le texte des sous-titres {#subtitle-text-filtering}

Pour filtrer certaines parties du texte des sous-titres, vous pouvez utiliser une expression régulière (regex). asbplayer peut repérer les séquences correspondant à une regex donnée et les supprimer.

## Configurer le filtre regex {#configure-the-regex-filter}

Dans la section <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Divers</a> des paramètres d’asbplayer, repérez le champ « Filtre regex des sous-titres ». Saisissez une regex adaptée pour filtrer le contenu souhaité.
Vous pouvez remplacer le contenu filtré en saisissant une chaîne dans le champ « Texte de remplacement du filtre regex des sous-titres ». Si vous le laissez vide, le contenu sera simplement supprimé.

### Supprimer les noms des locuteurs {#remove-speaker-names}

Supprimez les noms de locuteurs entre parenthèses (par exemple, « **（山田）**　元気ですか？ »).

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Conserver les lectures japonaises {#preserve-japanese-readings}

Supprimez les noms ou descriptions entre parenthèses tout en conservant les lectures japonaises qui suivent immédiatement un texte japonais. Par exemple, `（山田）漢字(かんじ)を読む。` devient `漢字(かんじ)を読む。`. Les parenthèses ASCII `(かんじ)` et pleine chasse `（かんじ）` sont conservées lorsqu’elles sont précédées immédiatement d’un caractère appartenant aux plages de kanji, hiragana ou katakana indiquées dans la regex.

Il s’agit d’une heuristique : elle conserve également les descriptions qui suivent immédiatement un texte japonais, comme `こんにちは（笑）`, et supprime les lectures séparées de leur texte de base par un espace. Les parenthèses imbriquées ne sont pas prises en charge. Laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ».

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
(?<![一-龯ぁ-ゟ゠-ヿ])[\(（][^\)）]*[\)）]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Fusionner les lignes de sous-titres {#merge-subtitle-lines}

Certains sous-titres sont répartis sur plusieurs lignes ; cette regex les fusionne en une seule. Pour que le filtre fonctionne, saisissez également `$1 $2` dans le champ « Texte de remplacement du filtre regex des sous-titres ».

Lorsque vous combinez ce motif avec d’autres, placez-le en dernier afin qu’une alternative plus précise puisse correspondre d’abord au même emplacement. Les alternatives ne s’appliquent pas lors de passes de filtrage distinctes. Chaque correspondance utilise le même texte de remplacement, et l’ajout de groupes de capture dans d’autres alternatives modifie les numéros à utiliser dans `$1 $2`.

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
(.*)\n+(?!-)(.*)
```

```text title="Subtitle regex filter text replacement"
$1 $2
```

</details>

### Supprimer les retours à la ligne {#remove-newlines}

Supprimez tous les caractères de retour à la ligne sans insérer d’espace. Par exemple, deux lignes contenant `こんにちは` et `世界` deviennent `こんにちは世界`. Laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ». Pour insérer un espace entre les lignes, utilisez l’[exemple de fusion de lignes de sous-titres](#merge-subtitle-lines).

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Supprimer les descriptions entre crochets {#remove-bracketed-descriptions}

Supprimez les indications entre crochets décrivant un son ou une musique en cours (par exemple « **\[MUSIQUE ENJOUÉE]** » ou « **\-[SURSAUTS]** »).

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
-?\[.*\]
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Supprimer les descriptions en majuscules {#remove-uppercase-descriptions}

Vous pouvez aussi filtrer les descriptions écrites en majuscules, mais sans crochets (par exemple « **MUSIQUE ENJOUÉE** »). Si votre langue comporte d’autres lettres avec des signes diacritiques, vous pouvez les ajouter à cette liste.

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
^[\-\(\)\.\s\p{Lu}]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Supprimer les symboles musicaux {#remove-music-symbols}

Toute combinaison de symboles utilisés seuls pour représenter de la musique (par exemple `♪♬♪`).

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
[♪♬#～〜]+
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Supprimer les indications d’effets sonores {#remove-sound-effect-cues}

Supprimez les sous-titres constitués entièrement d’une description entre crochets ou de symboles musicaux, tels que `[TONNERRE GRONDANT]`, `-[SURSAUTS]` ou `♪♬♪`. Les ancres `^` et `$` exigent que tout le texte du sous-titre corresponde au motif : les dialogues comme `Hello [GASPS]` ou `♪ Hello ♪` sont donc conservés. Laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ».

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
^-?\[.+\]$|^[♪♬#～〜]+$
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Supprimer les marques gauche-droite {#remove-left-to-right-marks}

Supprimez U+200E, la marque gauche-droite invisible (LRM). Par exemple, un texte contenant `Hello`, une LRM et `world` devient `Helloworld`. Saisissez la séquence d’échappement littérale `\u200E` dans le champ regex et laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ».

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
\u200E
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Supprimer les caractères de contrôle bidirectionnels {#remove-bidi-controls}

Supprimez tous les caractères de contrôle bidirectionnels Unicode, y compris la marque gauche-droite (U+200E), la marque droite-gauche (U+200F) et les caractères de contrôle d’inclusion, de remplacement et d’isolation. Laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ». Ces caractères peuvent modifier l’ordre d’affichage des textes de droite à gauche ou mixtes ; n’utilisez donc ce filtre que si vous souhaitez les supprimer.

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combiner des regex {#combining-regexes}

Vous pouvez combiner des expressions régulières avec le caractère `|` (sans espace entre elles). Par exemple, pour utiliser les deux regex de la liste ci-dessus, vous pouvez saisir `-?\[.*\]|[♪♬#～〜]+`. Vous pouvez combiner autant de regex que vous le souhaitez.

### Supprimer le texte entre parenthèses et les retours à la ligne {#remove-parenthesized-text-and-newlines}

Pour supprimer à la fois le texte entre parenthèses et tous les retours à la ligne, utilisez :

Laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ». Par exemple, `（山田）こんにちは` suivi d’un retour à la ligne puis de `世界` devient `こんにちは世界`. Le filtre supprime les parenthèses ASCII et pleine chasse ainsi que leur contenu, y compris les lectures japonaises, puis joint les lignes sans ajouter d’espace. Il ne gère pas les parenthèses imbriquées ; pour celles-ci, utilisez l’[exemple de suppression des noms de locuteurs](#remove-speaker-names).

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
[\(（][^\)）]*[\)）]|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

### Combiner tous les filtres de suppression {#combine-all-removal-filters}

Pour supprimer également les contrôles bidirectionnels, les noms de locuteurs entre parenthèses (y compris les parenthèses imbriquées), les descriptions entre crochets et les symboles musicaux, utilisez :

Laissez vide le champ « Texte de remplacement du filtre regex des sous-titres ». Cette regex combine les exemples de suppression ci-dessus et joint les lignes sans ajouter d’espace. Elle supprime également les lectures japonaises ; utilisez l’[exemple de conservation des lectures](#preserve-japanese-readings) si vous souhaitez les garder.

<details>
<summary>Utiliser ce filtre</summary>

```text title="Subtitle regex filter"
\p{Bidi_Control}|([\(（]([^\(\)（）]|(([\(（][^\(\)（）]+[\)）])))+[\)）])|-?\[.*\]|[♪♬#～〜]+|\n
```

<CodeBlock language="text" title="Subtitle regex filter text replacement">
  {''}
</CodeBlock>

</details>

## Caractères invisibles et sous-titres vides {#invisible-characters}

Un sous-titre qui semble vide peut contenir des caractères invisibles comme une LRM. Après l’analyse et le filtrage, asbplayer supprime les éléments de texte qui ne contiennent que des espaces, des caractères de contrôle ou des caractères Unicode ignorables par défaut. Les marques directionnelles intégrées à un texte utile sont conservées, sauf si votre regex les supprime explicitement.

Des caractères invisibles au début ou à la fin d’un sous-titre peuvent empêcher un motif ancré comme `^\[.+\]$` de correspondre. Si le motif ne correspond pas, asbplayer réessaie sans les espaces ni les caractères de contrôle invisibles environnants, mais ne supprime le sous-titre que si cette nouvelle tentative ne laisse aucun texte utile. Par exemple, `[THUNDER]` suivi d’une LRM est supprimé par ce motif avec un remplacement vide. La nouvelle tentative conserve le sous-titre d’origine si le remplacement produisait un texte utile.

Lorsque vous combinez un motif ancré avec une alternative de suppression des contrôles bidirectionnels, gardez à l’esprit que les remplacements se font en une seule passe. Par exemple, appliqué à `[THUNDER]` suivi d’une LRM, le motif `^\[.+\]$|\u200E` supprime la LRM, mais ne réessaie pas ensuite de supprimer la description entre crochets. Pour supprimer les deux dans la même passe, utilisez le motif non ancré `\[.+\]|\p{Bidi_Control}` avec un remplacement vide. Il supprimera aussi les descriptions entre crochets au sein des dialogues.

## En savoir plus {#learn}

Apprenez à écrire et à tester vos propres expressions régulières dans [Regex Learn - Playground](https://regexlearn.com/playground).
