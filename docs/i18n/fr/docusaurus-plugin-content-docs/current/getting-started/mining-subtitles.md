---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Extraire des sous-titres {#mining-subtitles}

Le **sentence mining** consiste à créer des cartes mémoire à partir de phrases. asbplayer vous permet de créer des cartes de phrases de qualité en réunissant la vidéo, l’audio et les sous-titres sur une même carte. asbplayer s’intègre à **Anki**, une application de cartes mémoire populaire.

## Configurer Anki {#setup-anki}

1. Installez [Anki](https://apps.ankiweb.net/).
2. Ajoutez [AnkiConnect](https://ankiweb.net/shared/info/2055492159) à Anki.
3. Si vous faites du mining à partir de fichiers vidéo, ajoutez <code>{appOrigin}</code> à `webCorsOriginList` dans les paramètres d’AnkiConnect :

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Ajoutez un **paquet**.
5. Ajoutez un **type de note**.
   Nous vous encourageons à créer votre propre type de note ou à en utiliser un prédéfini. Pour commencer rapidement, suivez les étapes ci-dessous afin de créer un type de note de base :
   1. Cliquez sur Outils → Gérer les types de note.
   2. Ajoutez un type de note « Basique ».
   3. Configurez les **champs** :
      - Sentence
      - Word
      - Definition
      - Image
      - Audio
      - Source
      - URL
   4. Configurez la **carte** :
      - Recto :
        ```
        {{Sentence}}
        ```
      - Verso :
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

## Configurer asbplayer {#configure-asbplayer}

1. Ouvrez les <a href={new URL('?view=settings', project.urls.app).href}>paramètres d’asbplayer</a>.
2. Sélectionnez le **paquet** et le **type de note** que vous venez de créer.
3. Pour chacun des champs **Sentence**, **Definition**, **Word**, **Audio**, **Image**, **Source** et **URL**, sélectionnez le champ correspondant dans le type de note.

## Installer une application de dictionnaire {#install-a-dictionary-app}

asbplayer n’intègre pas de dictionnaire. Nous vous recommandons d’en installer un pour remplir facilement le champ **Definition** des cartes. En voici quelques-uns parmi les plus populaires :

- [Yomitan](https://yomitan.wiki/) est une extension de navigateur qui permet de rechercher un mot en le survolant. Elle a d’abord été conçue pour le japonais, mais prend progressivement en charge d’autres langues.
- [VocabSieve](https://docs.freelanguagetools.org/) est une application autonome d’apprentissage des langues qui prend en charge les langues européennes.

## Extraire des sous-titres {#mine-subtitles}

1. [Chargez des sous-titres](./loading-subtitles.md) sur n’importe quelle source vidéo.
2. Cliquez sur le bouton **Extraire le sous-titre** <NoteAddIcon />.
3. Remplissez la boîte de dialogue qui s’affiche, puis cliquez sur **Exporter**.
