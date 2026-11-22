---
sidebar_position: 1.5
title: Przepisy
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

# Przepisy

Przepisy łączą tryby i ustawienia odtwarzania, dzięki czemu możesz przełączać się między aktywnościami edukacyjnymi. Wybierz przepis w **Ustawienia > Odtwarzanie**, obok trybów odtwarzania w elementach sterujących odtwarzacza lub w nakładce mobilnej. Wybierz **Wyłączone**, aby wrócić do podstawowych ustawień. Zapisane ustawienia odtwarzania, zapamiętana prędkość i tryby pozostają zachowane podczas korzystania z przepisu.

## Tworzenie i edytowanie przepisu

Wybierz **Edytuj przepis** na karcie Odtwarzanie. Jeśli wybrano przepis, edycja rozpocznie się od jego ustawień; w przeciwnym razie użyte zostaną bieżące ustawienia odtwarzania. Wybierz tryby odtwarzania i zmień ustawienia, które chcesz uwzględnić. Zmiany pozostają wersją roboczą i nie wpływają na odtwarzanie, dopóki ich nie zapiszesz.

Wybierz **Zapisz przepis**, aby przejrzeć ustawienia i podać nazwę o długości do 100 znaków. Możesz usunąć poszczególne ustawienia z podglądu; pominięte ustawienia będą korzystać z wartości podstawowych. Tryby odtwarzania są zawsze określane jako pełny zestaw.

Podczas edytowania istniejącego przepisu pozostawienie jego nazwy bez zmian spowoduje jego aktualizację. Wpisanie nazwy tworzy nowy przepis, nawet jeśli wpiszesz pierwotną nazwę. Wybierz **Anuluj**, aby odrzucić wersję roboczą.

## Importowanie i udostępnianie

Wybierz **Importuj przepis**, wklej jego JSON, przejrzyj ustawienia i zatwierdź. Przed importem możesz zmienić nazwę i usunąć ustawienia. Zaimportowane przepisy są dodawane na końcu listy i wybierane. Nieznane ustawienia i nieprawidłowe wartości są pomijane. Nazwa i tryby odtwarzania muszą być prawidłowe.

Możesz też otworzyć link importu. Otworzy on aplikację internetową z kartą Odtwarzanie i podglądem importu; przepis zacznie działać po zatwierdzeniu importu.

Otwórz podgląd przepisu za pomocą jego ikony na liście, aby skopiować JSON lub udostępnić URL importu. W tym samym podglądzie możesz usunąć przepis po potwierdzeniu. Zmieniaj kolejność przepisów przyciskami góra/dół albo przeciągając je na liście. Po przeniesieniu przepis pozostaje wybrany; usunięcie wybranego przepisu wyłącza przepisy.

## Skróty klawiszowe

Skonfiguruj opcje **Przejdź do następnego przepisu**, **Przejdź do poprzedniego przepisu** oraz **Przełącz przepis od 1 do 10** w sekcji **Skróty klawiszowe > Odtwarzanie**. Przełączenie aktywnego przepisu wyłącza przepisy. Przechodzenie między nimi odbywa się w kolejności z listy i obejmuje opcję **Wyłączone**. Gdy przepis jest aktywny, skróty do ustawień i trybów odtwarzania wyświetlają powiadomienie; aby zmienić te ustawienia, edytuj lub wyłącz przepis.

## Popularne przepisy

Poniżej znajdziesz przydatne przykładowe przepisy do popularnych aktywności edukacyjnych. Jeśli chcesz udostępnić własny przepis lub potrzebujesz nowej funkcji, aby utworzyć odpowiedni przepis, możesz napisać na <a href={project.urls.discord}>Discordzie</a> lub zgłosić prośbę w serwisie <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Tryb normalny

Używaj zwykłych ustawień odtwarzania bez automatycznego trybu nauki. Zalecamy pozostawienie podstawowych ustawień możliwie prostymi, aby `Wyłączone` odpowiadało normalnemu odtwarzaniu.

### Skupienie na dialogach

Skup się na dialogach, łącząc odtwarzanie skondensowane z przyspieszonym. Pomijaj przerwy o długości co najmniej 5 sekund, a pozostałe kwalifikujące się przerwy odtwarzaj z prędkością 3×, przy minimalnym odstępie 1 sekundy. Zachowaj 150 ms kontekstu po obu stronach każdej przerwy, a dialogi odtwarzaj z podstawową prędkością.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Przyspieszenie przerw

Obejrzyj cały film, przyspieszając kwalifikujące się przerwy do 3× przy minimalnym odstępie 1 sekundy. Zachowaj 150 ms kontekstu po obu stronach każdej przerwy, a dialogi odtwarzaj z podstawową prędkością.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Tryb czytania

Wstrzymuj odtwarzanie na początku każdego napisu, aby go przeczytać i wyszukać słowa, a następnie wznawiaj ręcznie, by usłyszeć dźwięk z widocznymi napisami. Najechanie kursorem na napisy podczas odtwarzania również wstrzymuje wideo; odsunięcie kursora wznawia odtwarzanie.

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

### Tryb słuchania

Słuchaj bez napisów, a na końcu każdego napisu wstrzymaj odtwarzanie automatycznie, aby wyświetlić tekst i sprawdzić zrozumienie. Wznów ręcznie, gdy będziesz gotowy.

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

### Tylko dźwięk

Słuchaj bez przerw, ukrywając napisy podczas odtwarzania. Wstrzymaj odtwarzanie ręcznie, aby wyświetlić bieżący napis, gdy potrzebujesz pomocy.

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

### Intensywne słuchanie

Odsłuchaj każdy napis trzy razy, z jednosekundową pauzą po każdym odtworzeniu. Napisy pozostają ukryte podczas dwóch pierwszych odtworzeń i pojawiają się przy ostatnim powtórzeniu, aby sprawdzić zrozumienie. Odtwarzanie wznawia się automatycznie po każdej pauzie. W razie potrzeby zmień jej długość.

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

### Słuchanie po przygotowaniu

Wstrzymaj odtwarzanie na początku każdego napisu, przeczytaj go w swoim języku ojczystym, poczekaj, aż zniknie, a następnie słuchaj bez napisów. Czas czytania wynosi 80 ms na znak, od minimum 1 sekundy do maksimum 6 sekund. Po zniknięciu tekstu odtwarzanie pozostaje wstrzymane przez kolejne 500 ms, po czym wznawia się automatycznie. Podczas edycji przepisu możesz zmienić te czasy.

W sekcji **Ścieżki napisów używane przez tryby odtwarzania i skróty klawiszowe** wybierz ścieżki, na podstawie których obliczany jest czas czytania.

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

### Czytanie na głos

Przeczytaj każdy napis na głos przed wysłuchaniem oryginalnego dźwięku, a następnie porównaj wymowę i rytm. Odtwarzanie zatrzymuje się na początku napisu z widocznymi napisami i wznawia automatycznie po 80 ms na znak, w zakresie od 1 do 6 sekund. Każdy napis jest powtarzany raz. Dostosuj czas pauzy, aby mieć wystarczająco dużo czasu na mówienie.

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

### Mówienie równolegle

Mów równolegle z oryginalnym dźwiękiem lub nieco za nim, naśladując jego rytm i wymowę przy widocznych napisach. Każdy napis jest powtarzany raz, a po każdym odtworzeniu następuje jednosekundowa pauza, po której odtwarzanie wznawia się automatycznie.

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

### Odtwarzanie z pamięci

Wysłuchaj dźwięku, a następnie odtwórz kwestię z pamięci na głos podczas automatycznej pauzy na jej końcu. Napisy pozostają ukryte podczas odtwarzania i automatycznych pauz. Czas na wypowiedź wynosi 80 ms na znak, od 1 do 6 sekund, a każdy napis jest powtarzany raz. W razie potrzeby dostosuj czasy pauz. Jeśli potrzebujesz pomocy, wstrzymaj powtórkę ręcznie, aby wyświetlić tekst.

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

## Przepisy z adnotacjami

Te ustawienia wymagają włączenia [adnotacji](./annotation.md), ponieważ korzystają z ich danych. Jeśli chcesz udostępnić własny przepis lub potrzebujesz nowej funkcji, aby utworzyć odpowiedni przepis, napisz na <a href={project.urls.discord}>Discordzie</a> lub zgłoś prośbę w serwisie <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Wczytaj napisy w języku docelowym jako **Ścieżkę 1**. Te ustawienia używają tej ścieżki do odtwarzania i wybierania słów. **Nieznane** oznacza **Niezebrane** lub **Nieznane**. Pozostałe preferencje wyświetlania adnotacji, takie jak odczyty i kolory, korzystają z ustawień podstawowych.

### Pomoc przy nieznanych słowach

Oglądaj z widocznymi napisami. Jeśli wiersz zawiera nieznane słowo, wstrzymaj odtwarzanie na jego końcu na 1 sekundę, a następnie powtórz go raz. Pozostałe wiersze są odtwarzane bez przerw. Podczas pauzy pierwsze nieznane słowo zostaje zaznaczone do wyszukania. Jeśli potrzebujesz więcej czasu, zmień długość pauzy.

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

### Kopanie i+1

Skup się na napisach zawierających dokładnie jeden token o statusie Niezebrane. Odtwarzanie skondensowane przeskakuje między pasującymi wierszami, a na końcu każdego z nich odtwarzanie wstrzymuje się do ręcznego wznowienia. Token Niezebrane zostaje zaznaczony do sprawdzenia lub utworzenia z niego fiszki.

Ten przepis wskazuje kandydatów i+1, ale nie gwarantuje, że wszystkie pozostałe słowa są znane: wiersz może zawierać także słowa Nieznane, a powtórzenia tego samego słowa Niezebrane są liczone osobno. Tworzenie fiszki nadal wymaga ręcznego działania.

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

### Podpowiedzi dla nieznanych słów

Słuchaj z widocznymi nieznanymi słowami i ukrytymi znanymi słowami. Wiersze zawierające nieznane słowa zatrzymują się na końcu na 1 sekundę, wyświetlając cały tekst, a następnie są powtarzane raz z przywróconymi podpowiedziami. Podczas pauzy pierwsze nieznane słowo zostaje zaznaczone do wyszukania. Wiersze bez nieznanych słów nie mają napisów, jeśli zostały w pełni podzielone na tokeny.

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

### Uzupełnianie nieznanych słów

Czytaj znane fragmenty każdego napisu, pozostawiając nieznane słowa ukryte, i spróbuj uzupełnić je na podstawie dźwięku i kontekstu. Wiersze zawierające nieznane słowa zatrzymują się na końcu na 1 sekundę, aby wyświetlić cały tekst, a następnie są powtarzane raz z przywróconymi lukami. Zignorowane słowa pozostają widoczne.

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

### Adaptacyjne tempo słuchania

Odtwarzaj dialogi z prędkością 1×, gdy szacowany poziom rozumienia wynosi 60% lub mniej, i stopniowo zwiększaj prędkość do 1,8× przy 100%. Odtwarzanie skondensowane pomija przerwy o minimalnej długości 1 sekundy, zachowując 150 ms kontekstu po obu stronach. Pozostałe kwalifikujące się przerwy są odtwarzane z prędkością 1,8×.

Podczas edycji przepisu zmień prędkość podstawową i przyspieszoną, dbając o to, by prędkość przyspieszona była większa.

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
