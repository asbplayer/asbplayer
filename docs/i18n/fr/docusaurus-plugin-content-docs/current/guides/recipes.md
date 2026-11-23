---
sidebar_position: 1.5
title: Recettes
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

# Recettes

Les recettes combinent des modes et des paramètres de lecture pour vous permettre de passer d’une activité d’apprentissage à une autre. Choisissez une recette dans **Paramètres > Lecture**, à côté des modes de lecture dans les commandes du lecteur ou dans l’interface superposée mobile. Choisissez **Désactivé** pour revenir à vos paramètres habituels. Vos paramètres de lecture enregistrés, votre vitesse de lecture mémorisée et vos modes mémorisés sont préservés tant qu’une recette est active.

## Créer et modifier une recette

Dans l’onglet Lecture, sélectionnez **Modifier la recette**. Si une recette est sélectionnée, vous partez de celle-ci ; sinon, vous partez des paramètres de lecture actuels. Choisissez les modes de lecture et modifiez les paramètres à inclure. Ces modifications restent dans un brouillon et ne changent pas la lecture tant qu’elles ne sont pas enregistrées.

Sélectionnez **Enregistrer la recette** pour vérifier les paramètres et saisir un nom de 100 caractères maximum. Vous pouvez retirer certains paramètres de l’aperçu ; ceux qui sont omis utilisent vos paramètres habituels. Les modes de lecture sont toujours définis comme une combinaison complète.

Lorsque vous modifiez une recette existante, ne changez pas son nom pour la mettre à jour. Saisir un nom crée une nouvelle recette, même si vous rétablissez ensuite le nom d’origine. Sélectionnez **Annuler** pour abandonner le brouillon.

## Importer et partager

Sélectionnez **Importer une recette**, collez le JSON de la recette, vérifiez ses paramètres et confirmez. Vous pouvez modifier son nom et retirer des paramètres avant l’importation. Les recettes importées sont ajoutées à la fin de votre liste et sélectionnées. Les paramètres inconnus et les valeurs non valides sont ignorés. Le nom et les modes de lecture doivent être valides.

Vous pouvez également ouvrir un lien d’importation. L’application web s’ouvre dans l’onglet Lecture avec l’aperçu d’importation prêt ; la recette prend effet après confirmation de l’importation.

Ouvrez l’aperçu d’une recette depuis le menu déroulant pour copier son JSON ou partager son URL d’importation. Vous pouvez également supprimer la recette depuis cet aperçu, après confirmation. Déplacez les recettes avec les boutons haut/bas ou en les faisant glisser dans le menu. La sélection suit la recette lorsqu’elle est déplacée ; la suppression de la recette sélectionnée désactive les recettes.

## Raccourcis clavier

Configurez **Passer à la recette suivante**, **Passer à la recette précédente** et **Activer/désactiver la recette n° 1** à **10** dans **Raccourcis clavier > Lecture**. Le raccourci d’activation/désactivation de la recette active désactive les recettes. Le cycle suit l’ordre de la liste et comprend **Désactivé**. Les raccourcis des paramètres et des modes de lecture affichent une notification lorsqu’une recette est active ; modifiez ou désactivez la recette pour changer ces paramètres.

## Recettes courantes

Voici des recettes prédéfinies utiles pour des activités d’apprentissage courantes. Si vous souhaitez partager une recette ou demander une fonctionnalité manquante pour créer la recette idéale, vous pouvez le faire sur <a href={project.urls.discord}>Discord</a> ou sur <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Mode normal

Utilisez vos paramètres habituels sans mode d’apprentissage automatique. Nous vous recommandons de garder des paramètres simples en dehors des recettes afin que `Désactivé` corresponde à un comportement de lecture normal.

### Se concentrer sur les dialogues

Concentrez-vous sur les dialogues en combinant la lecture condensée et l’avance rapide. Ignorez les silences d’au moins 5 secondes, puis accélérez les autres silences admissibles à 3×, avec un intervalle minimum d’une seconde. Conservez 150 ms de contexte de part et d’autre de chaque silence et lisez les dialogues à votre vitesse habituelle.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Avance rapide dans les silences

Regardez toute la vidéo en accélérant à 3× les silences admissibles d’au moins une seconde. Conservez 150 ms de contexte de part et d’autre de chaque silence et lisez les dialogues à votre vitesse habituelle.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Mode lecture

Mettez la lecture en pause au début de chaque sous-titre pour le lire et rechercher des mots, puis reprenez-la manuellement pour entendre l’audio avec les sous-titres visibles. Survoler les sous-titres pendant la lecture met également la vidéo en pause ; éloigner le pointeur reprend la lecture.

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

### Mode écoute

Écoutez sans sous-titres, puis mettez automatiquement la lecture en pause à la fin de chaque sous-titre pour afficher le texte et vérifier votre compréhension. Reprenez manuellement lorsque vous êtes prêt.

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

### Audio uniquement

Écoutez sans interruption, avec les sous-titres masqués pendant la lecture. Mettez manuellement la lecture en pause pour afficher le sous-titre actuel si vous avez besoin d’aide.

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

### Écoute intensive

Écoutez chaque sous-titre trois fois, avec une pause d’une seconde après chaque passage. Les sous-titres restent masqués lors des deux premiers passages et apparaissent à la dernière répétition pour vérifier votre compréhension. La lecture reprend automatiquement après chaque pause ; adaptez la durée de la pause d’une seconde si nécessaire.

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

### Écoute préparée

Mettez la lecture en pause au début de chaque sous-titre pour le lire dans votre langue maternelle, puis écoutez l’audio sans sous-titres après sa disparition. Le temps de lecture est de 80 ms par caractère, avec un minimum d’une seconde et un maximum de six secondes. Après la disparition du texte, la lecture reste en pause pendant 500 ms supplémentaires avant de reprendre automatiquement. Vous pouvez modifier ces durées en modifiant la recette.

Choisissez les pistes utilisées pour calculer le temps de lecture dans **Pistes de sous-titres concernées par les modes de lecture et les raccourcis clavier**.

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

### Lire à voix haute

Lisez chaque sous-titre à voix haute avant d’entendre l’audio d’origine, puis comparez votre prononciation et votre rythme. La lecture se met en pause au début, sous-titres visibles, puis reprend automatiquement après 80 ms par caractère, dans une limite de 1 à 6 secondes. Chaque sous-titre est répété une fois. Ajustez les durées de pause pour avoir suffisamment de temps pour parler.

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

### Répétition simultanée

Parlez en même temps que l’audio d’origine ou avec un léger décalage, en imitant son rythme et sa prononciation, sous-titres visibles. Chaque sous-titre est répété une fois, avec une pause d’une seconde à la fin de chaque passage avant la reprise automatique.

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

### Rappel

Écoutez l’audio, puis répétez la réplique de mémoire à voix haute pendant la pause automatique à la fin du sous-titre. Les sous-titres restent masqués pendant la lecture et les pauses automatiques. Le temps de parole est de 80 ms par caractère, dans une limite de 1 à 6 secondes, et chaque sous-titre est répété une fois. Ajustez les durées de pause si nécessaire ; mettez manuellement la lecture en pause pendant une répétition pour afficher le texte si vous avez besoin d’aide.

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

## Recettes d’annotation

Ces préréglages nécessitent l’activation de l’[annotation](./annotation.md), car ils utilisent ses données. Si vous souhaitez partager une recette ou demander une fonctionnalité manquante pour créer la recette idéale, vous pouvez le faire sur <a href={project.urls.discord}>Discord</a> ou sur <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Chargez les sous-titres dans la langue que vous apprenez sur la **Piste 1**. Ces préréglages utilisent cette piste pour la lecture et la sélection des mots. **Inconnu** signifie **Non collecté** ou **Inconnu**. Les autres préférences d’affichage des annotations, comme les lectures et les couleurs, suivent vos paramètres habituels.

### Repérer les mots inconnus

Regardez la vidéo avec les sous-titres visibles. Lorsqu’une réplique contient un mot inconnu, la lecture se met en pause pendant une seconde à la fin, puis la réplique est répétée une fois. Les autres répliques continuent sans interruption. Le premier mot inconnu est sélectionné pendant la pause afin de pouvoir le rechercher. Augmentez la durée de pause si vous avez besoin de plus de temps.

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

### Mining i+1

Concentrez-vous sur les sous-titres contenant exactement un mot **Non collecté**. La lecture condensée passe d’une réplique admissible à l’autre et se met en pause à la fin de chacune jusqu’à ce que vous la repreniez manuellement. Le mot **Non collecté** est sélectionné pour que vous puissiez l’examiner ou l’extraire.

Cette méthode repère des phrases candidates i+1, sans garantir que tous les autres mots sont connus : une réplique peut aussi contenir des mots **Inconnus**, et les répétitions d’un même mot **Non collecté** sont comptées séparément. Le mining reste manuel.

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

### Indices sur les mots inconnus

Écoutez avec les mots inconnus visibles et les mots familiers masqués. Les répliques contenant un mot inconnu se mettent en pause pendant une seconde à la fin pour révéler le texte complet, puis sont répétées une fois avec les indices rétablis. Le premier mot inconnu est sélectionné pendant la pause pour être recherché. Les répliques sans mot inconnu n’affichent pas de sous-titre si elles sont entièrement analysées.

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

### Texte à trous avec des mots inconnus

Lisez les parties familières de chaque sous-titre tandis que les mots inconnus restent masqués, et essayez de retrouver les mots manquants grâce à l’audio et au contexte. Les répliques contenant des mots inconnus se mettent en pause pendant une seconde à la fin pour révéler le texte complet, puis sont répétées une fois avec les blancs rétablis. Les mots ignorés restent visibles.

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

### Rythme d’écoute adaptatif

Lisez les dialogues à 1× lorsque leur compréhension estimée est inférieure ou égale à 60 %, puis augmentez progressivement jusqu’à 1,8× à 100 %. La lecture condensée ignore les silences d’au moins une seconde en conservant 150 ms de contexte de chaque côté. Les silences admissibles restants sont lus à 1,8×.

Lorsque vous modifiez la recette, ajustez les vitesses de base et d’avance rapide en veillant à ce que cette dernière soit supérieure à la vitesse de base.

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
