---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Le mining en détail {#mining-in-depth}

Avec asbplayer, vous pouvez faire du sentence mining de différentes manières, selon vos besoins et vos préférences.

## Ouvrir la boîte de dialogue d’export Anki {#opening-the-anki-export-dialog}

Vous pouvez ouvrir la **boîte de dialogue d’export Anki** de plusieurs façons :

1. Le bouton **Extraire le sous-titre** <NoteAddIcon /> dans la **liste des sous-titres** du **panneau latéral** ou sur le site web.
2. Le bouton **Extraire le sous-titre** <NoteAddIcon /> dans l’**interface superposée** des vidéos en streaming ou du site web mobile.
3. Le [raccourci clavier de mining](../reference/settings.md#mining-keyboard-shortcuts) **Extraire le sous-titre actuel et ouvrir la boîte de dialogue Anki** — `Ctrl + Shift + X` par défaut.
4. Sur une vidéo en streaming, faites un clic droit → asbplayer → **Extraire le sous-titre**.

:::info
Les méthodes 1 et 2 n’ouvrent la boîte de dialogue que si [l’action par défaut du bouton de mining](../reference/settings#mining-button-default-action) est réglée sur « Afficher la boîte de dialogue Anki ».  
:::

:::info
Lorsqu’une piste de sous-titres _vide_ est chargée et que l’enregistrement audio est activé, les actions ci-dessus démarrent l’enregistrement audio au premier déclenchement et ouvrent la boîte de dialogue Anki au deuxième.
:::

## Modifier les cartes {#adjusting-cards}

Vous pouvez modifier les cartes dans la boîte de dialogue avant de les exporter.

### Plage de temps sélectionnée {#selected-time-range}

Le **curseur** en bas de la boîte de dialogue permet de modifier la plage de temps sélectionnée.

- Le **champ Sentence** est automatiquement mis à jour en fonction de la plage de temps sélectionnée, sauf s’il a déjà été modifié manuellement.
- Pour les fichiers locaux, l’extrait audio est également mis à jour automatiquement.
- Pour les vidéos en streaming, l’extrait audio peut être réenregistré selon la plage de temps sélectionnée.

### Champ audio {#audio-field}

Le **champ Audio** affiche l’extrait audio enregistré et propose trois boutons :

- **Lire/Mettre en pause** — écouter l’extrait audio directement dans la boîte de dialogue.
- **Réenregistrer** — enregistrer à nouveau l’audio selon la plage de temps sélectionnée (vidéos en streaming uniquement ; le bouton s’affiche si le réenregistrement est disponible).
- **Télécharger** — télécharger l’extrait audio sur votre appareil.

### Champs de texte {#text-fields}

Vous pouvez modifier tous les champs de texte : phrase, définition, mot, champs personnalisés, source, URL et tags. En général, une application de dictionnaire distincte sert à remplir le champ de définition.

### Champ image {#image-field}

Pour les fichiers locaux, cliquez sur le **bouton d’aperçu** <ImageIcon /> du **champ Image** pour modifier l’horodatage vidéo auquel la capture d’écran est prise.

## Exporter des cartes {#exporting-cards}

Utilisez les boutons au bas de la boîte de dialogue pour exporter la carte. Trois options sont disponibles :

1. **Exporter** : exporter une carte avec le contenu de la boîte de dialogue.
2. **Mettre à jour la dernière carte** : mettre à jour la dernière carte de votre paquet Anki avec le contenu de la boîte de dialogue.
3. **Ouvrir dans Anki** : ouvrir le créateur de cartes d’Anki prérempli avec le contenu de la boîte de dialogue.

## Mining sans boîte de dialogue {#dialog-less-mining-flows}

Vous pouvez faire du mining sans boîte de dialogue, avec une définition du mot, en associant asbplayer à une application de dictionnaire qui s’intègre également à Anki. L’application la plus populaire qui le permet est actuellement [Yomitan](https://yomitan.wiki/).

### Mettre à jour la dernière carte {#update-last-card}

Voici comment faire du mining sans boîte de dialogue avec Yomitan :

1. Avec Yomitan, sélectionnez le mot que vous voulez extraire dans les sous-titres.
2. Utilisez le bouton de création de cartes de Yomitan pour créer une carte.
3. Utilisez immédiatement le [raccourci clavier de mining](../reference/settings.md#mining-keyboard-shortcuts) **Mettre à jour la dernière carte** d’asbplayer — `Ctrl + Shift + U` — pour ajouter à la carte les médias fournis par asbplayer.

Cette méthode ne permet pas de modifier la carte dans la boîte de dialogue. Vous pouvez toutefois contourner cette limite :

- À la dernière étape, au lieu de mettre directement à jour la dernière carte, utilisez `Ctrl + Shift + X` pour ouvrir la boîte de dialogue, modifier la carte, puis **mettre à jour la dernière carte** depuis l’interface. Vous passez ainsi par la boîte de dialogue tout en conservant la définition fournie automatiquement par Yomitan.
- Vous pouvez toujours ouvrir la **boîte de dialogue d’export Anki** _après_ la création de la carte avec le [raccourci clavier de mining](../reference/settings.md#mining-keyboard-shortcuts) **Prendre une capture d’écran manuellement** — `Ctrl + Shift + V` par défaut.

### En un clic {#one-click}

Consultez le guide du [mining en un clic](./one-click-mining.md).
