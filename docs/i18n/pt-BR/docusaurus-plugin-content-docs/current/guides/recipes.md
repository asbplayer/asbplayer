---
sidebar_position: 1.5
title: Receitas
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

# Receitas

As receitas combinam modos e configurações de reprodução para que você possa alternar entre atividades de aprendizado. Escolha uma receita em **Configurações > Reprodução**, ao lado dos modos de reprodução nos controles do player ou na interface sobreposta para dispositivos móveis. Escolha **Desativado** para voltar às configurações subjacentes. Suas configurações salvas de reprodução, a velocidade de reprodução lembrada e os modos lembrados são preservados enquanto uma receita estiver ativa.

## Criar e editar uma receita

Selecione **Editar receita** na aba Reprodução. Se uma receita estiver selecionada, você começará com ela; caso contrário, começará com as configurações de reprodução atuais. Escolha os modos de reprodução e altere as configurações que deseja incluir. Essas alterações ficam em um rascunho e não afetam a reprodução até serem salvas.

Selecione **Salvar receita** para revisar as configurações e digitar um nome de até 100 caracteres. Você pode remover configurações individuais da pré-visualização; as configurações omitidas usarão os valores subjacentes. Os modos de reprodução são sempre especificados como uma combinação completa.

Ao editar uma receita existente, manter o nome original a atualiza. Digitar no campo de nome cria uma nova receita, mesmo que você volte ao nome original. Selecione **Cancelar** para descartar o rascunho.

## Importar e compartilhar

Selecione **Importar receita**, cole o JSON da receita, revise as configurações e confirme. Você pode alterar o nome e remover configurações antes de importar. As receitas importadas são adicionadas ao fim da lista e selecionadas. Configurações desconhecidas e valores inválidos são ignorados. O nome e os modos de reprodução precisam ser válidos.

Você também pode abrir um link de importação. Ele abre o aplicativo web na aba Reprodução, com a pré-visualização da importação pronta; a receita entra em vigor depois que você confirma a importação.

Abra o ícone de pré-visualização de uma receita no menu suspenso para copiar seu JSON ou compartilhar o URL de importação. Nessa pré-visualização, você também pode excluir a receita após confirmar. Mova as receitas com os botões para cima/baixo ou arraste-as no menu suspenso. A seleção acompanha a receita quando ela é movida; excluir a receita selecionada desativa as receitas.

## Atalhos de teclado

Configure **Avançar pelas receitas**, **Voltar pelas receitas** e **Alternar receita #1** até **#10** em **Atalhos de teclado > Reprodução**. Alternar a receita ativa desativa as receitas. A alternância segue a ordem da lista e inclui **Desativado**. Os atalhos de configurações e modos de reprodução exibem uma notificação enquanto uma receita está ativa; edite ou desative a receita para alterar essas configurações.

## Receitas comuns

Estas receitas predefinidas são úteis para atividades de aprendizado comuns. Se você quiser compartilhar alguma ou precisar de um recurso que falta para criar a receita ideal, faça uma solicitação no <a href={project.urls.discord}>Discord</a> ou no <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

### Modo normal

Use suas configurações de reprodução habituais, sem um modo de aprendizado automático. Recomendamos manter as configurações fora das receitas o mais simples possível para que `Desativado` corresponda ao comportamento normal da reprodução.

### Foco no diálogo

Concentre-se no diálogo combinando reprodução condensada e avanço rápido. Pule intervalos usando um mínimo de 5 segundos e avance rapidamente pelos demais intervalos qualificados a 3×, com um mínimo de 1 segundo. Mantenha 150 ms de contexto em cada lado do intervalo e reproduza o diálogo na velocidade subjacente.

<RecipePreset
  recipe={{
    ...dialogueFocusRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...dialogueFocusRecipe.settings,
    },
  }}
/>

### Avanço rápido nos intervalos

Assista ao vídeo inteiro enquanto avança rapidamente pelos intervalos qualificados a 3×, com um mínimo de 1 segundo. Mantenha 150 ms de contexto em cada lado do intervalo e reproduza o diálogo na velocidade subjacente.

<RecipePreset
  recipe={{
    ...gapFastForwardRecipe,
    settings: {
      ...nonAnnotationPlaybackSettings,
      ...gapFastForwardRecipe.settings,
    },
  }}
/>

### Modo de leitura

Pause no início de cada legenda para ler e consultar palavras; em seguida, retome manualmente para ouvir o áudio com as legendas visíveis. Passar o cursor sobre as legendas durante a reprodução também pausa o vídeo; afastá-lo retoma a reprodução.

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

### Modo de escuta

Escute sem legendas e pause automaticamente no fim de cada uma para revelar o texto e conferir sua compreensão. Retome manualmente quando estiver pronto.

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

### Somente áudio

Escute continuamente com as legendas ocultas durante a reprodução. Pause manualmente para revelar a legenda atual quando precisar de ajuda.

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

### Escuta intensiva

Escute cada legenda três vezes, com uma pausa de 1 segundo após cada reprodução. As legendas ficam ocultas nas duas primeiras reproduções e aparecem na última para que você confira sua compreensão. A reprodução é retomada automaticamente após cada pausa. Ajuste a duração da pausa de 1 segundo conforme necessário.

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

### Escuta preparada

Pause no início de cada legenda para lê-la no seu idioma nativo. Espere que ela desapareça e, então, escute o áudio sem legendas. O tempo de leitura é de 80 ms por caractere, com mínimo de 1 segundo e máximo de 6 segundos. Depois que o texto desaparece, a reprodução permanece pausada por mais 500 ms antes de retomar automaticamente. Você pode ajustar esses tempos ao editar a receita.

Escolha as faixas usadas para calcular o tempo de leitura em **Faixas de legenda afetadas pelos modos de reprodução e atalhos de teclado**.

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

### Ler em voz alta

Leia cada legenda em voz alta antes de ouvir o áudio original e, em seguida, compare sua pronúncia e ritmo. A reprodução pausa no início, com as legendas visíveis, e retoma automaticamente após 80 ms por caractere, entre 1 e 6 segundos. Cada legenda é repetida uma vez. Ajuste os tempos de pausa para ter tempo suficiente para falar.

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

### Imitação simultânea

Fale junto com o áudio original ou um pouco depois dele, acompanhando o ritmo e a pronúncia com as legendas visíveis. Cada legenda é repetida uma vez, com uma pausa de 1 segundo no fim de cada reprodução antes de a reprodução retomar automaticamente.

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

### Recordação

Escute o áudio e, durante a pausa automática no fim da legenda, repita a frase em voz alta de memória. As legendas permanecem ocultas durante a reprodução e as pausas automáticas. O tempo para falar é de 80 ms por caractere, entre 1 e 6 segundos, e cada legenda é repetida uma vez. Ajuste os tempos de pausa conforme necessário; pause manualmente durante uma repetição para revelar o texto quando precisar de ajuda.

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

## Receitas de anotação

Essas predefinições requerem que a [anotação](./annotation.md) esteja ativada, pois usam seus dados. Se você quiser compartilhar alguma ou precisar de um recurso que falta para criar a receita ideal, faça uma solicitação no <a href={project.urls.discord}>Discord</a> ou no <a href={`${project.urls.repo}/issues/new/choose`}>GitHub</a>.

Carregue as legendas do idioma que está aprendendo como **Faixa 1**. Essas predefinições usam essa faixa para reprodução e seleção de palavras. **Desconhecida para você** significa **Não coletada** ou **Desconhecida**. Outras preferências de exibição de anotações, como leituras e cores, usam as configurações subjacentes.

### Resgate de palavras desconhecidas

Assista com as legendas visíveis. Quando uma linha contiver uma palavra desconhecida, pause por 1 segundo no fim e reproduza-a novamente uma vez. As outras linhas continuam sem interrupção. A primeira palavra desconhecida é selecionada durante a pausa para consulta. Ajuste a duração da pausa se precisar de mais tempo.

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

### Mineração i+1

Concentre-se em legendas que contenham exatamente um token não coletado. A reprodução condensada pula entre as linhas qualificadas, e a reprodução pausa no fim de cada linha até você retomá-la manualmente, selecionando o token não coletado para examinar ou minerar.

Isso encontra frases candidatas a i+1, mas não garante que todas as outras palavras sejam conhecidas: uma linha também pode conter palavras desconhecidas, e ocorrências repetidas da mesma palavra não coletada são contadas separadamente. A mineração continua sendo uma ação manual.

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

### Dicas de palavras desconhecidas

Escute com as palavras desconhecidas visíveis e as conhecidas ocultas. As linhas com palavras desconhecidas pausam por 1 segundo no fim, revelando o texto completo, e depois são reproduzidas uma vez com as dicas restauradas. A primeira palavra desconhecida é selecionada durante a pausa para consulta. Linhas sem palavras desconhecidas não exibem legenda quando são totalmente tokenizadas.

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

### Lacunas para palavras desconhecidas

Leia as partes conhecidas de cada legenda enquanto as palavras desconhecidas permanecem ocultas e tente preencher as palavras que faltam com base no áudio e no contexto. As linhas com palavras desconhecidas pausam por 1 segundo no fim para revelar o texto completo e depois são reproduzidas uma vez com as lacunas restauradas. As palavras ignoradas permanecem visíveis.

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

### Ritmo de escuta adaptável

Reproduz o diálogo a 1× quando a compreensão estimada for de 60% ou menos, aumentando gradualmente até 1,8× em 100%. A reprodução condensada pula intervalos com duração mínima de 1 segundo e mantém 150 ms de contexto em cada lado. Os intervalos qualificados restantes são reproduzidos a 1,8×.

Ao editar a receita, ajuste as velocidades normal e de avanço rápido, mantendo a velocidade de avanço rápido acima da velocidade normal.

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
