---
sidebar_position: 1
---

import project from '@site/src/project';

# Annotation {#annotation}

asbplayer peut annoter les sous-titres pour faciliter l’apprentissage des langues. Les fonctionnalités d’annotation comprennent :

- **Mise en forme des mots** : couleur, soulignement, contour, etc. selon le statut du mot
    - les statuts connus peuvent provenir d’Anki ou de WaniKani, être synchronisés avec ces services et/ou être suivis localement dans asbplayer (des fonctions d’importation et d’exportation permettent d’ajouter des mots connus)
- **Annotation de lecture** : lectures affichées au-dessus de chaque mot ou selon son statut
- **Annotation de fréquence** : fréquence basée sur le rang, affichée sous chaque mot ou selon son statut (nécessite au moins un dictionnaire de fréquence basé sur le rang)
- **Annotation de l’accent tonal** : motifs accentuels affichés sur les furigana ou les mots en kana (nécessite au moins un dictionnaire d’accent tonal)
- **Annotation de glossaire** : courtes définitions ou explications affichées pour chaque mot
- **Statistiques et compréhension** : informations sur les mots que vous connaissez dans le média actuel.
- **Lecture adaptative** : utilise les modes de lecture et les données d’annotation pour optimiser votre apprentissage.
- **Navigateur de mots** : gestion des mots locaux et consultation des mots synchronisés depuis des sources externes.
- **Et bien d’autres fonctionnalités à venir !**

:::info
L’annotation nécessite une instance [Yomitan](https://yomitan.wiki/) configurée ainsi que [yomitan-api](https://github.com/yomidevs/yomitan-api).

Si vous utilisez la **base de données de mots locale**, il est recommandé d’installer l’extension de navigateur asbplayer afin de réduire le risque que votre navigateur supprime les mots enregistrés. Si vous ne pouvez pas installer l’extension, pensez à exporter régulièrement vos paramètres et/ou vos mots locaux en guise de sauvegarde.
:::

## Configuration {#setup}

1. Ouvrez les **paramètres** d’asbplayer.
2. Accédez à la section **Annotation**.
3. Sélectionnez la piste à configurer.
4. Configurez l’**URL Yomitan** pour cette piste.
    - Vous devez disposer d’une instance [Yomitan](https://yomitan.wiki/) configurée ainsi que de [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - Si l’URL est invalide ou inaccessible, asbplayer affiche une erreur à côté du paramètre.
    - Les informations de fréquence nécessitent au moins un dictionnaire de fréquence basé sur le rang dans votre instance Yomitan.
5. (Utilisateurs d’Anki) Configurez les cartes qui serviront à déterminer les statuts connus.
    - En général, laissez [`Paquets Anki`](../reference/settings.md#anki-decks) vide pour utiliser tous les paquets ; le filtrage par champs suffit généralement.
    - [`Champs de mots Anki`](../reference/settings.md#anki-word-fields) désigne le champ de la note Anki qui contient uniquement le mot cible.
    - [`Champs de phrases Anki`](../reference/settings.md#anki-sentence-fields) ne doivent être utilisés que pour les notes Anki sans champ dédié au mot (comme les paquets de phrases). Les mots qu’ils contiennent servent de solution de repli si un mot ne figure pas dans les champs de mots Anki.
    - Pour remplir la base de données, utilisez [`Reconstruire la base de données de mots Anki`](../reference/settings.md#re-build-anki-word-database) après avoir configuré ces champs.
6. (Utilisateurs de WaniKani) Accédez à [WaniKani > Paramètres > Jetons API](https://www.wanikani.com/settings/personal_access_tokens) pour créer un jeton pour asbplayer.
    - Dans le champ `Token Description`, saisissez `asbplayer` et laissez toutes les `Permissions` décochées : asbplayer a uniquement besoin d’un accès en lecture à votre compte WaniKani.
    - Cliquez sur `Generate token`, puis copiez le jeton généré dans [`Jeton API WaniKani`](../reference/settings.md#wanikani-api-token).
    - Pour remplir la base de données, utilisez [`Reconstruire la base de données de mots WaniKani`](../reference/settings.md#re-build-wanikani-word-database) après avoir configuré le jeton API.
7. Activez les fonctions d’annotation souhaitées (mise en forme, lecture, fréquence, accent tonal, etc.) pour cette piste. Configurez les autres paramètres comme vous le souhaitez.
8. Pour obtenir une explication détaillée de chaque option, consultez la section [Annotation](../reference/settings.md#annotation) de la référence des paramètres. Les raccourcis clavier sont répertoriés dans le groupe [Raccourcis clavier d’annotation](../reference/settings.md#annotation-keyboard-shortcuts).

## Dépannage {#troubleshooting}

Pour résoudre les problèmes d’annotation, consultez la section [Problèmes fréquents](../common-issues.md#annotation) de la documentation. Si vous n’y trouvez pas de solution, contactez-nous sur <a href={project.urls.discord}>Discord</a> ou envoyez un <a href={`${project.urls.repo}/issues`}>rapport de bug</a> en décrivant le problème et les étapes permettant de le reproduire.
