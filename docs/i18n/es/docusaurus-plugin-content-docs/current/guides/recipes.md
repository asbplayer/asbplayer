---
sidebar_position: 1.5
title: Recetas
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

# Recetas

Las recetas combinan modos y ajustes de reproducción para que puedas cambiar entre actividades de aprendizaje. Elige una receta en **Ajustes > Reproducción**, junto a los modos de reproducción en los controles del reproductor o en la interfaz superpuesta para móviles. Elige **Desactivado** para volver a los ajustes habituales. Mientras una receta esté activa, se conservan los ajustes de reproducción guardados, la velocidad de reproducción recordada y los modos recordados.

## Crear y editar una receta

Selecciona **Editar receta** en la pestaña Reproducción. Si hay una receta seleccionada, partirás de ella; de lo contrario, partirás de los ajustes de reproducción actuales. Elige los modos de reproducción y cambia los ajustes que quieras incluir. Estos cambios quedan como borrador y no afectan a la reproducción hasta que los guardes.

Selecciona **Guardar receta** para revisar los ajustes e introducir un nombre de hasta 100 caracteres. Puedes quitar ajustes individuales de la vista previa; los ajustes omitidos usan tus valores habituales. Los modos de reproducción siempre se especifican como una combinación completa.

Al editar una receta existente, si dejas el nombre tal como está, se actualizará esa receta. Si escribes algo en el campo del nombre, se crea una receta nueva, aunque después vuelvas a escribir el nombre original. Selecciona **Cancelar** para descartar el borrador.

## Importar y compartir

Selecciona **Importar receta**, pega el JSON de la receta, revisa sus ajustes y confirma. Puedes cambiar el nombre y quitar ajustes antes de importarla. Las recetas importadas se añaden al final de la lista y quedan seleccionadas. Se ignoran los ajustes desconocidos y los valores no válidos. El nombre y los modos de reproducción deben ser válidos.

También puedes abrir un enlace de importación. Se abrirá la aplicación web en la pestaña Reproducción, con la vista previa de importación preparada; la receta se aplicará cuando confirmes la importación.

Abre el icono de vista previa de una receta en el menú desplegable para copiar su JSON o compartir su URL de importación. En la misma vista previa puedes eliminar la receta tras confirmar. Cambia el orden con los botones de subir y bajar o arrastra las recetas en el menú desplegable. La selección acompaña a la receta cuando se mueve; si eliminas la receta seleccionada, se desactivan las recetas.

## Atajos de teclado

Configura **Recorrer las recetas hacia delante**, **Recorrer las recetas hacia atrás** y **Alternar receta n.º 1** a **n.º 10** en **Atajos de teclado > Reproducción**. Alternar la receta activa desactiva las recetas. El recorrido sigue el orden de la lista e incluye **Desactivado**. Los atajos de los ajustes y modos de reproducción muestran una notificación mientras hay una receta activa; edita o desactiva la receta para cambiar esos ajustes.

## Recetas habituales

Aquí encontrarás recetas preestablecidas útiles para actividades de aprendizaje habituales. Si quieres compartir una receta o necesitas una función para crear la receta ideal, puedes solicitarla en <a href={project.urls.discord}>Discord</a> o en <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Modo normal

Usa tus ajustes de reproducción habituales sin un modo de aprendizaje automático. Te recomendamos mantener los ajustes que no pertenezcan a recetas lo más sencillos posible para que `Desactivado` corresponda al comportamiento normal de reproducción.

### Enfoque en el diálogo

Concéntrate en el diálogo combinando la reproducción condensada con el avance rápido. Omite los intervalos con una duración mínima de 5 segundos y avanza rápidamente por los intervalos restantes que cumplan los criterios a 3×, con un intervalo mínimo de 1 segundo. Conserva 150 ms de contexto a cada lado de cada intervalo y reproduce el diálogo a la velocidad habitual.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Avance rápido en los intervalos

Mira el vídeo completo mientras avanzas rápidamente por los intervalos que cumplan los criterios a 3×, con una duración mínima de 1 segundo. Conserva 150 ms de contexto a cada lado de cada intervalo y reproduce el diálogo a la velocidad habitual.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Modo de lectura

Pausa al principio de cada subtítulo para leer y buscar palabras. Después, reanuda manualmente la reproducción para escuchar el audio con los subtítulos visibles. Si pasas el cursor sobre los subtítulos durante la reproducción, el vídeo también se pausa; al apartarlo, se reanuda.

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

### Modo de escucha

Escucha sin subtítulos y, al final de cada uno, pausa automáticamente para mostrar el texto y comprobar tu comprensión. Cuando estés listo, reanuda la reproducción manualmente.

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

### Solo audio

Escucha de forma continua con los subtítulos ocultos durante la reproducción. Si necesitas ayuda, pausa manualmente para mostrar el subtítulo actual.

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

### Escucha intensiva

Escucha cada subtítulo tres veces y pausa durante 1 segundo después de cada reproducción. Los subtítulos permanecen ocultos durante las dos primeras reproducciones y aparecen en la última para que compruebes tu comprensión. La reproducción se reanuda automáticamente después de cada pausa. Ajusta la duración de 1 segundo según lo necesites.

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

### Escucha preparada

Pausa al principio de cada subtítulo para leerlo en tu lengua materna. Deja que desaparezca y luego escucha el audio sin subtítulos. El tiempo de lectura es de 80 ms por carácter, con un mínimo de 1 segundo y un máximo de 6 segundos. Cuando el texto desaparece, la reproducción permanece pausada otros 500 ms y luego se reanuda automáticamente. Puedes ajustar estos tiempos al editar la receta.

Elige qué pistas se usan para calcular el tiempo de lectura en **Pistas de subtítulos afectadas por los modos de reproducción y los atajos de teclado**.

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

### Leer en voz alta

Lee cada subtítulo en voz alta antes de escuchar el audio original y luego compara tu pronunciación y ritmo. La reproducción se pausa al principio con los subtítulos visibles y se reanuda automáticamente después de 80 ms por carácter, con un límite de entre 1 y 6 segundos. Cada subtítulo se repite una vez. Ajusta las pausas para tener tiempo suficiente para hablar.

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

### Imitación simultánea

Habla al mismo tiempo que el audio original o ligeramente después, imitando su ritmo y pronunciación con los subtítulos visibles. Cada subtítulo se repite una vez y, al final de cada reproducción, hay una pausa de 1 segundo antes de que la reproducción se reanude automáticamente.

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

### Recordar

Escucha el audio y luego repite la frase en voz alta de memoria durante la pausa automática al final. Los subtítulos permanecen ocultos durante la reproducción y las pausas automáticas. El tiempo para hablar es de 80 ms por carácter, con un límite de entre 1 y 6 segundos, y cada subtítulo se repite una vez. Ajusta las pausas según lo necesites; si necesitas ayuda, pausa manualmente durante una repetición para mostrar el texto.

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

## Recetas con anotaciones

Estas recetas preestablecidas requieren que estén activadas las [anotaciones](./annotation.md), ya que usan sus datos. Si quieres compartir alguna o necesitas una función para crear la receta ideal, puedes solicitarla en <a href={project.urls.discord}>Discord</a> o en <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Carga los subtítulos del idioma que estás aprendiendo como **Pista 1**. Estas recetas preestablecidas usan esa pista para la reproducción y la selección de palabras. **Poco familiar** significa **Sin recopilar** o **Desconocida**. Las demás preferencias de visualización de anotaciones, como las lecturas y los colores, usan tus ajustes habituales.

### Repaso de palabras poco familiares

Mira el vídeo con los subtítulos visibles. Cuando una línea contenga una palabra poco familiar, pausa durante 1 segundo al final y luego reprodúcela una vez más. Las demás líneas continúan sin interrupciones. Durante la pausa se selecciona la primera palabra poco familiar para que puedas buscarla. Ajusta la duración de la pausa si necesitas más tiempo.

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

### Minado i+1

Concéntrate en los subtítulos que contengan exactamente un token **Sin recopilar**. La reproducción condensada omite lo que hay entre las líneas que cumplen los criterios y se pausa al final de cada línea hasta que la reanudes manualmente. Se selecciona el token **Sin recopilar** para que lo examines o crees una tarjeta a partir de él.

Esto encuentra posibles ejemplos i+1, pero no garantiza que conozcas todas las demás palabras: una línea también puede contener palabras **Desconocidas**, y las repeticiones de una misma palabra **Sin recopilar** se cuentan por separado. El minado sigue siendo una acción manual.

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

### Pistas para palabras poco familiares

Escucha con las palabras poco familiares visibles y las familiares ocultas. Las líneas que contengan palabras poco familiares se pausan durante 1 segundo al final para mostrar el texto completo y luego se reproducen una vez más con las pistas restablecidas. Durante la pausa se selecciona la primera palabra poco familiar para que puedas buscarla. Si todas las palabras se han analizado, las líneas sin palabras poco familiares no muestran subtítulos.

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

### Completar palabras poco familiares

Lee las partes familiares de cada subtítulo mientras las palabras poco familiares permanecen ocultas e intenta completarlas a partir del audio y el contexto. Las líneas que contengan palabras poco familiares se pausan durante 1 segundo al final para mostrar el texto completo y luego se reproducen una vez más con los espacios en blanco restablecidos. Las palabras ignoradas permanecen visibles.

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

### Ritmo de escucha adaptativo

Reproduce el diálogo a 1× cuando la comprensión estimada sea del 60 % o menos y aumenta gradualmente la velocidad hasta 1,8× cuando llegue al 100 %. La reproducción condensada omite los intervalos con una duración mínima de 1 segundo y conserva 150 ms de contexto a cada lado. Los intervalos restantes que cumplan los criterios se reproducen a 1,8×.

Al editar la receta, ajusta las velocidades base y de avance rápido. La velocidad de avance rápido debe ser mayor que la velocidad base.

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
