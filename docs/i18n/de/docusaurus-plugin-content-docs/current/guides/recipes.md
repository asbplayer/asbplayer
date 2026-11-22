---
sidebar_position: 1.5
title: Rezepte
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

# Rezepte

Rezepte kombinieren Wiedergabemodi und Wiedergabeeinstellungen, damit Sie zwischen verschiedenen Lernaktivitäten wechseln können. Wählen Sie ein Rezept unter **Einstellungen > Wiedergabe**, neben den Wiedergabemodi in den Player-Steuerelementen oder im mobilen Overlay aus. Wählen Sie **Deaktiviert**, um zu Ihren zugrunde liegenden Einstellungen zurückzukehren. Ihre gespeicherten Wiedergabeeinstellungen, die gespeicherte Wiedergabegeschwindigkeit und die gespeicherten Modi bleiben aktiv, solange ein Rezept ausgewählt ist.

## Rezept erstellen und bearbeiten

Wählen Sie im Tab „Wiedergabe“ die Option **Rezept bearbeiten** aus. Wenn ein Rezept ausgewählt ist, bildet es die Grundlage. Andernfalls beginnen Sie mit Ihren aktuellen Wiedergabeeinstellungen. Wählen Sie die Wiedergabemodi und ändern Sie die Einstellungen, die Sie einschließen möchten. Die Änderungen bleiben ein Entwurf und wirken sich erst nach dem Speichern auf die Wiedergabe aus.

Wählen Sie **Rezept speichern**, um die Einstellungen zu überprüfen und einen Namen mit bis zu 100 Zeichen einzugeben. In der Vorschau können Sie einzelne Einstellungen entfernen. Für ausgelassene Einstellungen gelten Ihre zugrunde liegenden Einstellungen. Wiedergabemodi werden immer als vollständige Kombination angegeben.

Wenn Sie ein vorhandenes Rezept bearbeiten, wird es aktualisiert, wenn Sie den Namen unverändert lassen. Sobald Sie in das Namensfeld schreiben, wird ein neues Rezept erstellt, auch wenn Sie den ursprünglichen Namen wieder eingeben. Wählen Sie **Abbrechen**, um den Entwurf zu verwerfen.

## Importieren und teilen

Wählen Sie **Rezept importieren**, fügen Sie das JSON des Rezepts ein, überprüfen Sie die Einstellungen und bestätigen Sie den Import. Vor dem Import können Sie den Namen ändern und Einstellungen entfernen. Importierte Rezepte werden an Ihre Liste angehängt und ausgewählt. Unbekannte Einstellungen und ungültige Einstellungswerte werden ignoriert. Der Name und die Wiedergabemodi müssen gültig sein.

Sie können auch einen Importlink öffnen. Dadurch wird die Web-App mit geöffnetem Tab „Wiedergabe“ und vorbereiteter Importvorschau gestartet. Das Rezept wird nach Bestätigung des Imports aktiviert.

Öffnen Sie im Dropdown-Menü die Vorschau eines Rezepts, um sein JSON zu kopieren oder den Importlink zu teilen. In derselben Vorschau können Sie das Rezept nach einer Bestätigung löschen. Mit den Aufwärts-/Abwärtsschaltflächen oder per Ziehen im Dropdown-Menü können Sie Rezepte verschieben. Wird ein Rezept verschoben, bleibt es ausgewählt. Wenn Sie das ausgewählte Rezept löschen, werden Rezepte deaktiviert.

## Tastaturkürzel

Konfigurieren Sie unter **Tastaturkürzel > Wiedergabe** die Optionen **Rezepte vorwärts durchgehen**, **Rezepte rückwärts durchgehen** und **Rezept Nr. 1 umschalten** bis **Nr. 10**. Wenn Sie das aktive Rezept umschalten, werden Rezepte deaktiviert. Beim Durchgehen wird der Listenreihenfolge gefolgt und **Deaktiviert** eingeschlossen. Tastaturkürzel für Wiedergabeeinstellungen und -modi zeigen eine Meldung an, solange ein Rezept aktiv ist. Bearbeiten oder deaktivieren Sie das Rezept, um diese Einstellungen zu ändern.

## Häufig verwendete Rezepte

Hier finden Sie nützliche voreingestellte Rezepte für gängige Lernaktivitäten. Wenn Sie eigene Rezepte teilen möchten oder eine fehlende Funktion für das perfekte Rezept benötigen, können Sie dies auf <a href={project.urls.discord}>Discord</a> oder auf <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a> anfragen.

### Normalmodus

Verwenden Sie Ihre üblichen Wiedergabeeinstellungen ohne automatischen Lernmodus. Wir empfehlen, Ihre Einstellungen außerhalb von Rezepten möglichst einfach zu halten, damit `Deaktiviert` dem normalen Wiedergabeverhalten entspricht.

### Dialogfokus

Konzentrieren Sie sich auf Dialoge, indem Sie verdichtete Wiedergabe und Vorspulen kombinieren. Überspringen Sie Lücken mit einem Mindestintervall von 5 Sekunden und spulen Sie verbleibende passende Lücken mit 3× vor, bei einem Mindestintervall von 1 Sekunde. Behalten Sie auf beiden Seiten jeder Lücke 150 ms Kontext bei. Dialoge werden mit Ihrer zugrunde liegenden Wiedergabegeschwindigkeit abgespielt.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Lücken vorspulen

Sehen Sie das gesamte Video an und spulen Sie passende Lücken mit 3× vor, bei einem Mindestintervall von 1 Sekunde. Behalten Sie auf beiden Seiten jeder Lücke 150 ms Kontext bei. Dialoge werden mit Ihrer zugrunde liegenden Wiedergabegeschwindigkeit abgespielt.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Lesemodus

Pausieren Sie am Anfang jedes Untertitels, um ihn zu lesen und Wörter nachzuschlagen. Setzen Sie die Wiedergabe manuell fort, um den Ton mit eingeblendeten Untertiteln zu hören. Wenn Sie während der Wiedergabe mit dem Mauszeiger über Untertitel fahren, wird das Video ebenfalls pausiert. Sobald Sie den Mauszeiger wegbewegen, läuft es weiter.

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

### Hörmodus

Hören Sie ohne Untertitel zu. Am Ende jedes Untertitels wird die Wiedergabe automatisch pausiert, der Text eingeblendet und so können Sie Ihr Verständnis überprüfen. Setzen Sie die Wiedergabe manuell fort, wenn Sie bereit sind.

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

### Nur Audio

Hören Sie ohne Untertitel durchgehend weiter. Wenn Sie Hilfe benötigen, pausieren Sie manuell, um den aktuellen Untertitel einzublenden.

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

### Intensives Zuhören

Hören Sie sich jeden Untertitel dreimal an und pausieren Sie nach jedem Durchlauf eine Sekunde. Bei den ersten beiden Durchläufen bleiben die Untertitel ausgeblendet. Bei der letzten Wiederholung werden sie eingeblendet, damit Sie Ihr Verständnis überprüfen können. Nach jeder Pause wird die Wiedergabe automatisch fortgesetzt. Passen Sie die Pausendauer von einer Sekunde nach Bedarf an.

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

### Vorbereitetes Zuhören

Pausieren Sie am Anfang jedes Untertitels, um ihn in Ihrer Muttersprache zu lesen. Lassen Sie ihn ausblenden und hören Sie sich anschließend das Audio ohne Untertitel an. Die Lesezeit beträgt 80 ms pro Zeichen, mindestens eine und höchstens sechs Sekunden. Nachdem der Text ausgeblendet wurde, bleibt die Wiedergabe weitere 500 ms pausiert und wird dann automatisch fortgesetzt. Diese Zeitangaben können Sie beim Bearbeiten des Rezepts anpassen.

Wählen Sie unter **Untertitelspuren, die von Wiedergabemodi und Tastaturkürzeln betroffen sind** die Spuren aus, die zur Berechnung der Lesezeit verwendet werden.

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

### Laut lesen

Lesen Sie jeden Untertitel laut vor, bevor Sie das Originalaudio hören, und vergleichen Sie anschließend Aussprache und Rhythmus. Die Wiedergabe pausiert am Anfang bei eingeblendeten Untertiteln und wird nach 80 ms pro Zeichen automatisch fortgesetzt, mindestens nach einer und höchstens nach sechs Sekunden. Jeder Untertitel wird einmal wiederholt. Passen Sie die Pausenzeiten an, damit Sie genug Zeit zum Sprechen haben.

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

### Shadowing

Sprechen Sie zusammen mit oder leicht versetzt zum Originalaudio und ahmen Sie bei sichtbaren Untertiteln dessen Rhythmus und Aussprache nach. Jeder Untertitel wird einmal wiederholt. Am Ende jedes Durchlaufs pausiert die Wiedergabe eine Sekunde und wird dann automatisch fortgesetzt.

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

### Abrufen

Hören Sie sich das Audio an und sprechen Sie die Zeile während der automatischen Pause am Ende aus dem Gedächtnis nach. Während der Wiedergabe und der automatischen Pausen bleiben Untertitel ausgeblendet. Die Sprechzeit beträgt 80 ms pro Zeichen, mindestens eine und höchstens sechs Sekunden. Jeder Untertitel wird einmal wiederholt. Passen Sie die Pausenzeiten nach Bedarf an. Wenn Sie Hilfe benötigen, pausieren Sie während einer Wiederholung manuell, um den Text einzublenden.

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

## Annotationsrezepte

Diese Voreinstellungen verwenden Annotationsdaten und setzen daher voraus, dass [Annotation](./annotation.md) aktiviert ist. Wenn Sie eigene Rezepte teilen möchten oder eine fehlende Funktion für das perfekte Rezept benötigen, können Sie dies auf <a href={project.urls.discord}>Discord</a> oder auf <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a> anfragen.

Laden Sie die Untertitel Ihrer Zielsprache als **Spur 1**. Diese Voreinstellungen verwenden diese Spur für die Wiedergabe und die Wortauswahl. **Unvertraut** bedeutet **Nicht erfasst** oder **Unbekannt**. Andere Einstellungen zur Anzeige von Annotationen, etwa Lesungen und Farben, richten sich nach Ihren zugrunde liegenden Einstellungen.

### Unbekannte Wörter wiederholen

Sehen Sie sich das Video mit eingeblendeten Untertiteln an. Wenn eine Zeile ein unvertrautes Wort enthält, pausiert die Wiedergabe am Ende eine Sekunde und die Zeile wird anschließend einmal wiederholt. Andere Zeilen werden ohne Unterbrechung abgespielt. Während der Pause wird das erste unvertraute Wort zum Nachschlagen ausgewählt. Passen Sie die Pausendauer an, wenn Sie mehr Zeit benötigen.

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

### i+1-Mining

Konzentrieren Sie sich auf Untertitel mit genau einem nicht erfassten Token. Die verdichtete Wiedergabe überspringt die Abschnitte zwischen passenden Zeilen. Am Ende jeder Zeile pausiert die Wiedergabe, bis Sie sie manuell fortsetzen. Dabei wird das nicht erfasste Token zur Untersuchung oder zum Mining ausgewählt.

Damit werden mögliche i+1-Sätze gefunden. Es ist nicht garantiert, dass jedes andere Wort bekannt ist: Eine Zeile kann auch unbekannte Wörter enthalten, und wiederholte Vorkommen desselben nicht erfassten Wortes zählen einzeln. Das Mining muss weiterhin manuell ausgelöst werden.

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

### Hinweise auf unbekannte Wörter

Hören Sie mit eingeblendeten unvertrauten und ausgeblendeten vertrauten Wörtern zu. Zeilen mit unvertrauten Wörtern pausieren am Ende eine Sekunde lang und zeigen den vollständigen Text. Anschließend werden sie mit wieder eingeblendeten Hinweisen einmal wiederholt. Während der Pause wird das erste unvertraute Wort zum Nachschlagen ausgewählt. Bei vollständig tokenisierten Zeilen ohne unvertraute Wörter wird keine Beschriftung angezeigt.

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

### Lückentext mit unbekannten Wörtern

Lesen Sie die vertrauten Teile jedes Untertitels, während unvertraute Wörter ausgeblendet bleiben. Versuchen Sie, die fehlenden Wörter aus dem Audio und dem Kontext zu erschließen. Zeilen mit unvertrauten Wörtern pausieren am Ende eine Sekunde lang, um den vollständigen Text einzublenden. Anschließend werden sie mit erneut eingefügten Lücken einmal wiederholt. Ignorierte Wörter bleiben sichtbar.

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

### Adaptives Hörtempo

Spielen Sie Dialoge mit 1× ab, wenn das geschätzte Sprachverständnis höchstens 60 % beträgt. Bei 100 % wird die Geschwindigkeit schrittweise auf 1,8× erhöht. Die verdichtete Wiedergabe überspringt Lücken mit einem Mindestintervall von einer Sekunde und behält auf beiden Seiten jeweils 150 ms Kontext bei. Passende Lücken, die übrig bleiben, werden mit 1,8× abgespielt.

Passen Sie beim Bearbeiten des Rezepts die Grundgeschwindigkeit und die Vorspulgeschwindigkeit an. Die Vorspulgeschwindigkeit muss höher als die Grundgeschwindigkeit sein.

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
