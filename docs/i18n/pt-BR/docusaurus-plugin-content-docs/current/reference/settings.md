---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Configurações {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### URL do AnkiConnect {#ankiconnect-url}

URL do servidor AnkiConnect executado como complemento no Anki.

### Chave de API do AnkiConnect {#ankiconnect-api-key}

Chave de API configurada no AnkiConnect quando a proteção por chave de API está ativada.

### Atualizar o navegador de cartões do Anki após atualizar cartões {#refresh-anki-card-browser}

Quando ativada, atualiza o navegador de cartões do Anki aberto depois que o asbplayer atualiza um cartão, para que os campos exibam os valores atuais. Isso pode trazer a janela do navegador de cartões para o primeiro plano. Essa configuração fica desativada por padrão.

### Baralho {#deck}

Baralho do Anki para o qual os cartões são enviados.

### Tipo de nota {#note-type}

Tipo de nota do Anki usado para os cartões. Um tipo de nota define um "modelo" e uma "visualização" dos cartões. Mais especificamente, define um conjunto de campos e um modelo HTML que determina como esses campos serão exibidos na frente e no verso do cartão.

### Campos do cartão {#card-fields}

Cada configuração de campo do cartão determina qual conteúdo será associado a cada campo do tipo de nota configurado. O **rótulo do campo** — Sentence, Definition, Word, Image, Audio ou URL — é o **conteúdo**, e o **valor do campo** é o **campo do tipo de nota**.

Os campos aparecem na **caixa de diálogo de exportação do Anki** na ordem em que aparecem nas configurações. Altere a ordem pelo **menu ⋮** → **Mover para baixo** ou **Mover para cima**.

| Campo                 | Conteúdo                                            |
| --------------------- | -------------------------------------------------- |
| Sentence (all tracks) | Todas as legendas no horário da mineração          |
| Definition            | Definição da palavra fornecida pelo usuário        |
| Word                  | Palavra fornecida pelo usuário                     |
| Audio                 | Áudio gravado da fonte de vídeo                    |
| Image                 | Captura de tela da fonte de vídeo                  |
| Source                | Nome do arquivo de legenda ou vídeo e horário      |
| URL                   | URL atual se o cartão foi minerado de um vídeo em streaming |
| Subtitle Track 1      | Legendas da faixa 1 no horário da mineração        |
| Subtitle Track 2      | Legendas da faixa 2 no horário da mineração        |
| Subtitle Track 3      | Legendas da faixa 3 no horário da mineração        |
| Custom Fields         | Valores fornecidos pelo usuário                    |

### Tags {#tags}

Etiquetas padrão incluídas em cada cartão.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Mineração</a> {#mining}

### Ação padrão do botão de mineração {#mining-button-default-action}

"Botão de mineração" <NoteAddIcon/> refere-se ao botão mais à esquerda da **interface sobreposta** e ao botão exibido ao lado das legendas na **lista de legendas**. Essa configuração determina o que esses botões fazem.

| Configuração            | Comportamento                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mostrar caixa de diálogo do Anki | Registra a legenda selecionada no histórico de mineração e mostra a **caixa de diálogo de exportação do Anki** |
| Atualizar último cartão | Registra a legenda selecionada no histórico de mineração e atualiza o último cartão do baralho configurado com todo o contexto fornecido pelo asbplayer, exceto definição, palavra e campos personalizados fornecidos pelo usuário |
| Mostrar caixa para atualizar cartão | Registra a legenda selecionada no histórico de mineração e mostra a caixa para atualizar o último cartão com o contexto fornecido pelo asbplayer |
| Exportar cartão         | Registra a legenda selecionada no histórico de mineração e exporta um cartão _somente_ com o contexto fornecido pelo asbplayer, exceto definição, palavra e campos personalizados fornecidos pelo usuário |
| Nenhuma                 | Registra a legenda selecionada no histórico de mineração |

### Estado de reprodução após a mineração {#post-mining-playback-state}

Configura o estado de reprodução desejado após acionar uma ação de mineração.

### Copiar legendas mineradas para a área de transferência {#copy-mined-subtitles-to-clipboard}

Quando ativada, copia a legenda selecionada para a área de transferência sempre que uma ação de mineração é acionada.

### Sempre usar o texto das legendas no campo da frase {#always-use-subtitle-text-for-sentence-field}

Quando ativada, preenche o campo Sentence com o texto minerado das legendas de todas as faixas, mesmo que um aplicativo externo forneça outro texto para a frase. Isso é útil ao [minerar com o Yomitan](../guides/one-click-mining.md).

### Ao atualizar o último cartão, atualizar também imagem/áudio de cartões com o mesmo texto de legenda {#update-all-cards-with-the-same-subtitle-text}

Quando ativada, a ação de mineração **Atualizar último cartão** também atualiza os campos de áudio e imagem das notas criadas em sequência a partir da mesma linha de legenda. Cada nota anterior mantém sua frase, palavra, definição e campos personalizados. A correspondência ignora a marcação da frase e permite que ela faça parte do contexto de legendas minerado.

A pesquisa inclui notas adicionadas nos últimos dois dias do Anki e para na primeira frase diferente ou ausente. É necessário configurar um campo de frase. Essa opção fica desativada por padrão e não afeta a atualização de um cartão selecionado especificamente.

### Reproduzir áudio durante a gravação de vídeo local {#play-audio-while-recording-from-local-video}

O asbplayer usa a API [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) integrada ao navegador para gravar áudio de arquivos de vídeo locais. Essa configuração determina se o som será reproduzido durante a gravação.

### Recodificar áudio como mp3 {#re-encode-audio-as-mp3}

Por padrão, o áudio gravado não é codificado como `mp3`. Essa configuração faz com que o áudio seja recodificado como `mp3`. Em geral, não há motivo para desativá-la, especialmente se você quiser revisar seus cartões no iOS.

### Margem inicial do áudio {#audio-padding-start}

Quantos milissegundos **antes** da legenda selecionada começar a gravação do áudio.

### Margem final do áudio {#audio-padding-end}

Quantos milissegundos **depois** da legenda selecionada parar a gravação do áudio.

### Formato de captura de imagem (somente no site) {#image-capture-format}

Especifica o formato de captura de imagem dos cartões minerados. Disponível somente no site para arquivos de vídeo locais, com "clipe de vídeo" como única opção adicional.

### Largura/altura máxima da captura {#max-capture-dimensions}

Largura/altura máxima das capturas de tela em pixels. `0` significa "sem limite".

### Remover barras pretas das capturas de tela {#trim-black-bars-from-screenshots}

Quando ativada, remove das capturas de tela as barras pretas causadas pelo letterboxing.

### Corte do início/fim do clipe {#clip-trim-start-end}

Especifica quanto tempo deve ser removido do início e do fim do intervalo da legenda para determinar o intervalo padrão do clipe de vídeo. Disponível somente quando o formato de captura de imagem de clipe de vídeo está selecionado.

### Duração máxima do clipe {#max-clip-length}

Especifica a duração máxima do clipe de vídeo. Disponível somente quando o formato de captura de imagem de clipe de vídeo está selecionado.

### Atraso da captura de tela {#screenshot-capture-delay}

Quanto tempo aguardar após a legenda selecionada aparecer antes de capturar a tela.

### Limite de legendas ao redor {#surrounding-subtitles-count-radius}

Na parte inferior da **caixa de diálogo de exportação do Anki**, há um controle deslizante para ajustar o intervalo de tempo selecionado. Ele inclui legendas ao redor como contexto adicional. Essa configuração limita a quantidade dessas legendas.

### Intervalo de tempo das legendas ao redor {#surrounding-subtitles-time-radius}

Na parte inferior da **caixa de diálogo de exportação do Anki**, há um controle deslizante para ajustar o intervalo de tempo selecionado. Ele inclui legendas ao redor como contexto adicional. Essa configuração determina o intervalo de tempo permitido entre a legenda selecionada e essas legendas.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Aparência das legendas</a> {#subtitle-appearance}

### Faixa de legendas {#subtitle-appearance-track}

O asbplayer pode carregar várias faixas de legendas ao mesmo tempo. Nesse menu suspenso, selecione a(s) faixa(s) às quais as configurações abaixo serão aplicadas. A seleção padrão é "Todas". Quando "Todas" está selecionado, qualquer alteração de aparência é aplicada a todas as faixas. Ao definir um valor específico para uma faixa, essa configuração deixa de aparecer na página "Todas".

### Pré-visualização das legendas {#subtitle-preview}

Pré-visualize e edite o texto usado para mostrar o efeito das configurações de aparência.

### Estilo {#styling}

| Configuração                      | Descrição                                                                            | Propriedade CSS             |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Cor da legenda                    | Cor                                                                                  | `color`                     |
| Tamanho da legenda                | Tamanho em `px`                                                                      | `font-size`                 |
| Espessura da fonte da legenda     | Espessura da fonte                                                                   | `font-weight`               |
| Cor do contorno da legenda        | Cor do traço                                                                         | `-webkit-text-stroke-color` |
| Espessura do contorno da legenda  | Espessura do traço                                                                   | `-webkit-text-stroke-width` |
| Cor da sombra da legenda          | Cor da sombra                                                                        | `text-shadow`               |
| Espessura da sombra da legenda   | Espessura da sombra                                                                  | `text-shadow`               |
| Cor do fundo da legenda           | Cor do fundo                                                                         | `background-color`          |
| Opacidade do fundo da legenda     | Opacidade do fundo                                                                   | `background`                |
| Família de fontes da legenda     | Fonte. Um menu suspenso com as fontes disponíveis aparece quando o acesso a fontes locais é permitido. | `font-family`               |
| CSS:\<style key\>                 | Valor em texto de qualquer propriedade CSS personalizada adicionada pelo menu **Adicionar CSS personalizado**. | Propriedade personalizada |
| Desfoque da legenda               | Aplica um efeito de desfoque às legendas. O desfoque é removido ao passar o cursor.   | `filter:blur(...)`          |
| Fator de escala de legendas em imagem | Ajusta a escala das legendas em imagem.                                            | —                           |

### Layout {#layout}

| Configuração                         | Descrição                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Alinhamento das legendas             | Define se as legendas aparecem no topo ou na parte inferior do elemento de vídeo. |
| Deslocamento da posição da legenda a partir de baixo | Distância entre a parte inferior do elemento de vídeo e todas as faixas de legenda inferiores. |
| Deslocamento da posição da legenda a partir de cima | Distância entre a parte superior do elemento de vídeo e todas as faixas de legenda superiores. |
| Largura das legendas                 | Largura do contêiner das legendas em `%` ou pixels.                           |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Atalhos de teclado</a> {#keyboard-shortcuts}

Os atalhos de teclado dão acesso à maioria dos recursos do asbplayer.

### Atalhos de teclado para <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>legendas</a> {#subtitles-keyboard-shortcuts}

| Ação                                 | Atalho padrão    |
| ------------------------------------ | ---------------- |
| Selecionar faixas de legenda para carregar | Ctrl + Shift + F |
| Alternar legendas                     | ↓                |
| Alternar faixa de legenda 1 no vídeo  | 1                |
| Alternar faixa de legenda 2 no vídeo  | 2                |
| Alternar faixa de legenda 3 no vídeo  | 3                |
| Alternar faixa de legenda 1 no asbplayer | W + 1            |
| Alternar faixa de legenda 2 no asbplayer | W + 2            |
| Alternar faixa de legenda 3 no asbplayer | W + 3            |
| Remover desfoque da faixa de legenda 1 no asbplayer | B + 1            |
| Remover desfoque da faixa de legenda 2 no asbplayer | B + 2            |
| Remover desfoque da faixa de legenda 3 no asbplayer | B + 3            |
| Mover legendas inferiores para cima   |                  |
| Mover legendas inferiores para baixo  |                  |
| Mover legendas superiores para cima   |                  |
| Mover legendas superiores para baixo  |                  |

### Atalhos de teclado para <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>mineração</a> {#mining-keyboard-shortcuts}

| Ação                                                                                 | Atalho padrão               |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Minerar legenda atual                                                                | Ctrl + Shift + Z (site)    |
| Minerar legenda atual e abrir a caixa de diálogo do Anki                              | Ctrl + Shift + X           |
| Atualizar o último cartão do Anki com captura de tela, áudio etc. obtidos pelo asbplayer | Ctrl + Shift + U       |
| Exportar cartão para o Anki sem abrir a caixa de diálogo.                             |                            |
| Capturar a tela manualmente, substituindo a captura feita automaticamente ao minerar  | Ctrl + Shift + V (site)    |
| Iniciar/parar manualmente a gravação de áudio, mesmo com arquivo de legenda carregado | Ctrl + Shift + R (site) |

### Atalhos de teclado para <a href={new URL('?view=settings#playback', project.urls.app).href}>reprodução</a> {#playback-keyboard-shortcuts}

| Ação                            | Atalho padrão    |
| ------------------------------- | ---------------- |
| Alternar painel lateral         | \`               |
| Reproduzir/pausar               | Espaço           |
| Alternar pausa automática       | Shift + P        |
| Alternar reprodução condensada | Shift + O        |
| Alternar avanço rápido          | Shift + F        |
| Alternar modo de repetição      | Shift + R        |
| Alternar exibição das legendas  |                  |
| Alternar modo de retomada da pausa automática |                  |
| Avançar pelas receitas          |                  |
| Voltar pelas receitas           |                  |
| Alternar receita 1               |                  |
| Alternar receita 2               |                  |
| Alternar receita 3               |                  |
| Alternar receita 4               |                  |
| Alternar receita 5               |                  |
| Alternar receita 6               |                  |
| Alternar receita 7               |                  |
| Alternar receita 8               |                  |
| Alternar receita 9               |                  |
| Alternar receita 10              |                  |

### Atalhos de teclado para <a href={new URL('?view=settings#playback', project.urls.app).href}>buscar</a> {#seek-keyboard-shortcuts}

| Ação                                                                      | Atalho padrão    |
| ------------------------------------------------------------------------- | ---------------- |
| Retroceder (3 segundos por padrão, [configurável](#seek-interval-seconds)) | A                |
| Avançar (3 segundos por padrão, [configurável](#seek-interval-seconds))    | D                |
| Ir para a legenda anterior                                                 | ←                |
| Ir para a próxima legenda                                                  | →                |
| Ir para o início da legenda atual/anterior                                | ↑                |

### Atalhos de teclado para <a href={new URL('?view=settings#playback', project.urls.app).href}>velocidade de reprodução</a> {#playback-rate-keyboard-shortcuts}

| Ação                   | Atalho padrão    |
| ---------------------- | ---------------- |
| Aumentar a velocidade de reprodução | Ctrl + Shift + ] |
| Diminuir a velocidade de reprodução | Ctrl + Shift + [ |

### Atalhos de teclado para <a href={new URL('?view=settings#playback', project.urls.app).href}>atraso das legendas</a> {#subtitle-offset-keyboard-shortcuts}

| Ação                                                                     | Atalho padrão    |
| ------------------------------------------------------------------------ | ---------------- |
| Ajustar o atraso para alinhar a legenda anterior ao horário atual        | Ctrl + ←         |
| Ajustar o atraso para alinhar a próxima legenda ao horário atual         | Ctrl + →         |
| Aumentar o atraso da legenda em 100 ms                                   | Ctrl + Shift + ← |
| Diminuir o atraso da legenda em 100 ms                                   | Ctrl + Shift + → |
| Redefinir o atraso das legendas                                         | Ctrl + Shift + ↓ |

### Atalhos de teclado para <a href={new URL('?view=settings#annotation', project.urls.app).href}>anotação</a> {#annotation-keyboard-shortcuts}

| Ação                              | Atalho padrão    |
| --------------------------------- | ---------------- |
| Abrir estatísticas                 | Q + S            |
| Ir para a próxima palavra           | Q + E            |
| Ir para a palavra anterior          | Q + W            |
| Marcar a palavra sob o cursor como madura | Q + 5       |
| Ir para a próxima palavra madura   |                  |
| Ir para a palavra madura anterior |                  |
| Marcar a palavra sob o cursor como jovem | Q + 4       |
| Ir para a próxima palavra jovem   |                  |
| Ir para a palavra jovem anterior |                  |
| Marcar a palavra sob o cursor como graduada | Q + 3    |
| Ir para a próxima palavra graduada |                  |
| Ir para a palavra graduada anterior |                  |
| Marcar a palavra sob o cursor como em aprendizado | Q + 2 |
| Ir para a próxima palavra em aprendizado |               |
| Ir para a palavra em aprendizado anterior |             |
| Marcar a palavra sob o cursor como desconhecida | Q + 1 |
| Ir para a próxima palavra desconhecida |                |
| Ir para a palavra desconhecida anterior |              |
| Marcar a palavra sob o cursor como não coletada | Q + 0 |
| Ir para a próxima palavra não coletada |                 |
| Ir para a palavra não coletada anterior |               |
| Alternar estado ignorado da palavra sob o cursor | Q + I |
| Ir para a próxima palavra ignorada |                     |
| Ir para a palavra ignorada anterior |                    |

### Intervalo de busca (segundos) {#seek-interval-seconds}

Controla o intervalo usado pelos [atalhos de teclado para busca](#seek-keyboard-shortcuts).

### Sempre reproduzir após usar 'Ir para o início da legenda atual/anterior' {#always-play-on-subtitle-seek}

Em vez de manter o estado de reprodução atual, sempre inicia a reprodução ao usar o [atalho de teclado para busca](#seek-keyboard-shortcuts) que vai para o início da legenda atual/anterior. Isso economiza um toque de tecla.

### Incremento de ajuste da velocidade de reprodução {#playback-speed-adjust-step}

Incremento usado pelos [atalhos de teclado](#playback-rate-keyboard-shortcuts) para aumentar/diminuir a velocidade de reprodução.

### Atalhos da extensão {#extension-shortcuts}

Quando a extensão para navegador está instalada, alguns atalhos de mineração (por exemplo, minerar a legenda atual ou minerar a legenda atual e abrir a caixa de diálogo do Anki) são implementados como comandos do navegador, em vez de ouvintes comuns de eventos de teclado, e só podem ser editados no editor de atalhos de extensão do navegador.

- Chrome: `chrome://extensions/shortcuts`
- Firefox: `about:addons` → `Manage Extension Shortcuts`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Anotação</a> {#annotation}

### Navegador de palavras {#word-browser}

:::info
Somente palavras locais podem ser editadas ou excluídas. As fontes externas são somente para leitura e só podem ser atualizadas por [sincronização](#re-build-anki-word-database).
:::

Abre o navegador de palavras, onde você pode ver e gerenciar todas as palavras dos bancos de dados local e sincronizado com o Anki.

:::tip
Você pode pesquisar palavras em qualquer sistema de escrita do idioma (por exemplo, romaji, hiragana, katakana ou kanji em japonês).

Também há outras substituições comuns para melhorar a experiência, como `e -> é` ou `ss -> ß`, feitas automaticamente.
:::

### Importar palavras {#import-words}

Importa palavras para o **banco de dados de palavras local** do asbplayer.

As palavras importadas são consideradas locais e têm prioridade sobre fontes externas ao determinar o estado da palavra.

A caixa de diálogo de importação permite colar qualquer texto (o asbplayer fará a tokenização) e importar arquivos exportados anteriormente.

:::tip
Você pode passar o cursor sobre as palavras e usar os [atalhos de teclado da anotação](#annotation-keyboard-shortcuts) para alterar localmente o estado delas.
:::

### Exportar palavras {#export-words}

Exporta seu banco de dados de palavras local para que você possa fazer uma cópia de segurança, transferi-lo para outro dispositivo ou compartilhá-lo entre o site e a extensão.

### Reconstruir banco de dados de palavras do Anki {#re-build-anki-word-database}

Cria ou reconstrói o cache local de informações sobre o estado das palavras obtidas do Anki.

:::tip
O cache também é atualizado automaticamente durante a reprodução quando uma faixa está ativada e o Anki pode ser acessado.

Esse botão fica desativado, a menos que suas configurações de anotação [se beneficiem da integração com o Anki](../common-issues.md#enable-or-disable-annotation-for-a-track).

Para limpar as entradas do banco de dados de palavras do Anki de uma faixa, [siga estas etapas](../common-issues.md#clear-anki-word-database).
:::

### Reconstruir banco de dados de palavras do WaniKani {#re-build-wanikani-word-database}

Cria ou reconstrói o cache local de informações de vocabulário obtidas do WaniKani.

:::tip
O cache também é atualizado automaticamente durante a reprodução quando uma faixa está ativada e um token está configurado.

Esse botão fica desativado, a menos que suas configurações de anotação [se beneficiem da integração com o WaniKani](../common-issues.md#enable-or-disable-annotation-for-a-track).

Para limpar as entradas do banco de dados de palavras do WaniKani de uma faixa, [siga estas etapas](../common-issues.md#clear-wanikani-word-database).
:::

### Faixa de legendas {#annotation-track}

Seleciona a faixa de legendas à qual as configurações de anotação se aplicam.

### Colorir legendas com base nas palavras conhecidas {#colorize-subtitles-based-on-known-words}

Ativa o estilo das palavras de acordo com o estado (não coletada, desconhecida, em aprendizado etc.). O estilo usa o [**estilo de cor das palavras**](#word-color-style) e as [**cores dos estados das palavras**](#word-status-colors) configurados.

### Gerar estatísticas automaticamente {#generate-statistics-automatically}

Gera automaticamente estatísticas da mídia atual ao carregá-la. Isso também ativa a sobreposição de estatísticas. O [atalho de teclado para abrir estatísticas](#annotation-keyboard-shortcuts) está no grupo Anotação.

### Exibir leituras das palavras {#display-word-readings}

Exibe leituras (por exemplo, furigana) acima das palavras com base no estado e nas condições da palavra.

### Exibir frequência das palavras {#display-word-frequency}

Exibe abaixo das palavras um valor de frequência baseado na classificação, quando disponível, de acordo com o estado e as condições. Isso ajuda a priorizar quais palavras valem a pena aprender.

:::tip
As informações de frequência requerem pelo menos um dicionário de frequência baseado em classificação na sua instância do Yomitan. Se um dicionário de frequência não declarar seu modo, o asbplayer tentará determinar se ele é baseado em classificação e usá-lo de acordo.

Se houver vários valores de frequência para uma palavra, será usado o menor (mais frequente).
:::

### Exibir acento tonal (japonês) {#display-pitch-accent-japanese}

:::note
Para ver o acento tonal na furigana, ative a opção [**Exibir leituras das palavras**](#display-word-readings).
:::

Exibe o acento tonal na furigana ou no próprio kana, de acordo com o estado e as condições.

:::info
Se houver dados disponíveis, o acento tonal da partícula que acompanha a palavra é determinado pelo acento tonal da própria palavra.

Normalmente, somente os kanji recebem leituras em furigana, mas com esse recurso ativado todos os caracteres de uma palavra receberão leituras em furigana se pelo menos um deles for kanji. Isso facilita a leitura do acento tonal em palavras compostas.
:::

### Exibir definições das palavras {#display-word-definitions}

Controla se definições ou explicações breves serão exibidas para cada palavra, de acordo com seu estado e condições.

### Estratégia de pesquisa no campo de palavras {#word-field-search-strategy}

Controla como o asbplayer compara uma palavra da legenda às suas palavras conhecidas.

- **Forma exata coletada**: o campo deve conter a forma exata exibida na legenda (running -> running).
- **Lema coletado**: o lema ou forma base deve estar coletado (running -> run).
- **Lema ou forma exata coletados**: considera a palavra coletada se o lema ou a forma exata corresponderem (qualquer uma das opções acima).
- **Qualquer forma coletada**: considera a palavra coletada se qualquer forma relacionada corresponder (running -> run, ran, runs etc.).

Quando **Lema coletado**, **Lema ou forma exata coletados** ou **Qualquer forma coletada** está selecionado, [**Comparar entre sistemas de escrita**](#match-across-language-scripts) controla se a correspondência por lema pode cruzar sistemas de escrita diferentes do mesmo idioma (por exemplo, kanji, hiragana e katakana).

### Prioridade de escolha do cartão {#card-choice-priority}

Se vários cartões do Anki corresponderem a uma palavra, essa opção determina qual cartão será usado para definir o estado da palavra:

- **O campo contém a forma exata** (se houver mais de um, usa o cartão mais conhecido como alternativa)
- **O campo contém o lema** (se houver mais de um, usa o cartão mais conhecido como alternativa)
- **Cartão mais conhecido**
- **Cartão menos conhecido**

### Estratégia de pesquisa no campo de frases {#sentence-field-search-strategy}

Controla como o asbplayer pesquisa nos [**campos de frases do Anki**](#anki-sentence-fields) configurados. As opções são as mesmas da [**estratégia de pesquisa no campo de palavras**](#word-field-search-strategy).

Quando **Lema coletado**, **Lema ou forma exata coletados** ou **Qualquer forma coletada** está selecionado, [**Comparar entre sistemas de escrita**](#match-across-language-scripts) controla se a correspondência por lema pode cruzar sistemas de escrita diferentes do mesmo idioma (por exemplo, kanji, hiragana e katakana).

:::tip
Como as frases contêm várias palavras, o estado do cartão tem menos relevância para cada palavra individual. Por isso, é melhor manter **Forma exata coletada**, a menos que você tenha somente cartões de frases.
:::

### Comparar entre sistemas de escrita {#match-across-language-scripts}

Controla se a correspondência por lema pode cruzar sistemas de escrita diferentes do mesmo idioma (por exemplo, kanji, hiragana e katakana).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### URL da API do Yomitan {#yomitan-api-url}

URL do endpoint da API do Yomitan. Se o URL estiver inacessível ou for inválido, o asbplayer exibirá um erro.

:::tip
You will need a configured [Yomitan](https://yomitan.wiki/) instance and the [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Analisador do Yomitan {#yomitan-parser}

Seleciona o analisador do Yomitan usado para tokenizar o texto das legendas:

- **Analisador de varredura (todos os idiomas)**: analisador interno do Yomitan que busca as palavras mais longas nos seus dicionários.
- **MeCab (japonês)**: usa o MeCab para analisar texto em japonês. Requer que o Yomitan esteja configurado com suporte ao MeCab, de preferência com pelo menos um dicionário UniDic.

### Comprimento máximo da palavra {#max-word-length}

:::info
Essa configuração se aplica somente ao analisador de varredura.
:::

Limita o comprimento máximo das palavras que o asbplayer tentará analisar ou tokenizar para fazer anotações.

:::tip
Um valor muito baixo fará com que palavras mais longas não sejam identificadas; um valor muito alto pode causar problemas de desempenho.
:::

### Baralhos do Anki (opcional) {#anki-decks}

Restringe as pesquisas do Anki aos baralhos selecionados. Se ficar em branco, o asbplayer pesquisará em todos os baralhos.

### Campos de palavras do Anki {#anki-word-fields}

Campos das notas do Anki que contêm _somente_ a palavra desejada. Essa é a forma recomendada de obter do Anki informações sobre o estado de conhecimento.

### Campos de frases do Anki {#anki-sentence-fields}

Campos das notas do Anki que contêm uma frase (comumente usados em baralhos de frases). Eles serão usados como alternativa se nenhum cartão com a palavra desejada estiver nos [**campos de palavras do Anki**](#anki-word-fields).

### Estabilidade/intervalo para cartões maduros do Anki (dias) {#mature-anki-stability-interval}

Controla o limite (em dias) para considerar um cartão do Anki **maduro** em vez de atribuir um estado de maturidade inferior.

- **Não coletada**: não encontrada no Anki.
- **Desconhecida**: encontrada no Anki com `is:new`.
- **Em aprendizado**: encontrada no Anki com `is:learn`.
- **Graduada**: encontrada no Anki com `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Jovem**: encontrada no Anki com `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Madura**: encontrada no Anki com `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Se a estabilidade FSRS de um cartão estiver disponível (a última revisão do cartão foi feita com FSRS ativado), ela será usada em vez do intervalo.

Para saber mais sobre os estados das palavras, consulte [**Cores dos estados das palavras**](#word-status-colors).
:::

### Tratar cartões suspensos do Anki como {#treat-suspended-anki-cards-as}

Controla como os cartões **suspensos** são tratados ao criar estados de palavras a partir do Anki:

- **Normal**: usa o estado do Anki sem alterações.
- Ou escolha um estado específico (por exemplo, **Madura**, **Desconhecida** etc.) para forçar o tratamento dos cartões suspensos como esse estado.

:::tip
Se somente alguns cartões de uma palavra estiverem suspensos, eles serão filtrados e o estado da palavra será determinado com base nos cartões não suspensos.

Para saber mais sobre os estados das palavras, consulte [**Cores dos estados das palavras**](#word-status-colors).
:::

### Token da API do WaniKani {#wanikani-api-token}

Use o token da API do WaniKani para sincronizar suas palavras conhecidas do WaniKani. Para configurá-lo, siga as instruções no [guia de anotações](../guides/annotation.md#setup).

O asbplayer usa somente os tipos de assunto `vocabulary` e `kana_vocabulary` para determinar as palavras conhecidas. Os estados são determinados pelo estágio SRS do sistema de [repetição espaçada](https://docs.api.wanikani.com/20170710/#spaced-repetition-system) configurado para o assunto. Os estados do WaniKani são definidos assim:

- **Não coletada**: não encontrada no WaniKani.
- **Desconhecida**: encontrada no WaniKani com um estágio SRS anterior a `Starting stage`.
- **Em aprendizado**: encontrada no WaniKani com um estágio SRS igual ou posterior a `Starting stage` e anterior a `Passing stage`.
- **Graduada**: encontrada no WaniKani com um estágio SRS na metade inferior dos estágios entre `Passing stage` e `Burning stage`.
- **Jovem**: encontrada no WaniKani com um estágio SRS na metade superior dos estágios entre `Passing stage` e `Burning stage`.
- **Madura**: encontrada no WaniKani com um estágio SRS igual ou posterior a `Burning stage`.

:::tip
Para saber mais sobre os estados das palavras, consulte [**Cores dos estados das palavras**](#word-status-colors).
:::

### Estilo de cor das palavras {#word-color-style}

Controla como as cores dos estados são aplicadas às palavras em [**Colorir legendas com base nas palavras conhecidas**](#colorize-subtitles-based-on-known-words):

- **Texto**: altera a cor da palavra.
- **Fundo**: altera a cor atrás da palavra.
- **Sublinhado**: sublinha a palavra com a cor do estado.
- **Sublinhar acima**: adiciona um traço acima da palavra com a cor do estado.
- **Contorno**: contorna a palavra com a cor do estado.

:::tip
Ao usar **Contorno**, talvez seja necessário definir [**Espessura do contorno da legenda**](#subtitle-appearance-track) como `0` para obter o melhor resultado.
:::

### Espessura {#thickness}

Controla a espessura (em pixels) dos estilos **Sublinhado**, **Sublinhar acima** e **Contorno**.

### Realçar palavras ao passar o cursor {#highlight-words-on-hover}

:::info
Esse realce indica qual elemento está em foco para que o asbplayer registre os atalhos de teclado. Se o realce não aparecer, talvez seja necessário clicar no player para colocá-lo em foco. Os atalhos de teclado funcionam no vídeo ou na lista de legendas, mas não nos dois ao mesmo tempo, dependendo de onde está o foco.

O realce serve principalmente para mostrar qual palavra está sob o cursor para ser coletada. Portanto, o item sob o cursor deve ser uma palavra e a opção de colorização precisa estar ativada.
:::

Quando ativada, essa opção realça a palavra sob o cursor para ajudar a entender como o Yomitan a tokenizou.

### Exibir a cor da palavra somente ao passar o cursor {#only-display-word-color-on-hover}

:::note
Essa configuração se aplica somente se [**Colorir legendas com base nas palavras conhecidas**](#colorize-subtitles-based-on-known-words) estiver ativado.
:::

Quando ativada para o vídeo ou para a lista de legendas, as cores das palavras ficam ocultas por padrão e aparecem somente quando você passa o cursor sobre o texto das legendas no vídeo ou na lista, respectivamente.

### Exibir a leitura da palavra somente ao passar o cursor {#only-display-word-reading-on-hover}

:::note
Essa configuração se aplica somente se [**Exibir leituras das palavras**](#display-word-readings) estiver ativado.
:::

Quando ativada para o vídeo ou para a lista de legendas, as leituras das palavras ficam ocultas por padrão e aparecem somente quando você passa o cursor sobre o texto das legendas no vídeo ou na lista, respectivamente.

### Exibir a frequência da palavra somente ao passar o cursor {#only-display-word-frequency-on-hover}

:::note
Essa configuração se aplica somente se [**Exibir frequência das palavras**](#display-word-frequency) estiver ativado.
:::

Quando ativada para o vídeo ou para a lista de legendas, a frequência das palavras fica oculta por padrão e aparece somente quando você passa o cursor sobre o texto das legendas no vídeo ou na lista, respectivamente.

### Exibir as definições das palavras somente ao passar o cursor {#only-display-word-definitions-on-hover}

:::note
Essa configuração se aplica somente se [**Exibir definições das palavras**](#display-word-definitions) estiver ativado.
:::

Quando ativada para o vídeo ou para a lista de legendas, as definições das palavras ficam ocultas por padrão e aparecem somente quando você passa o cursor sobre o texto das legendas no vídeo ou na lista, respectivamente.

### Exibir o acento tonal somente ao passar o cursor {#only-display-pitch-accent-on-hover}

:::note
Essa configuração se aplica somente se [**Exibir acento tonal (japonês)**](#display-pitch-accent-japanese) estiver ativado.
:::

Quando ativada para o vídeo ou para a lista de legendas, o acento tonal fica oculto por padrão e aparece somente quando você passa o cursor sobre o texto das legendas no vídeo ou na lista, respectivamente.

### Tamanho da leitura da palavra {#word-reading-size}

Controla o tamanho das leituras das palavras (furigana) em unidades em (% do tamanho da fonte das legendas).

### Tamanho da frequência da palavra {#word-frequency-size}

Controla o tamanho da frequência das palavras em unidades em (% do tamanho da fonte das legendas).

### Tamanho da definição da palavra {#word-definition-size}

Controla o tamanho das definições das palavras em unidades em (% do tamanho da fonte das legendas).

### Tamanho do acento tonal {#pitch-accent-size}

Controla o tamanho do acento tonal em unidades em (% do tamanho da fonte das legendas).

### Cores dos estados das palavras {#word-status-colors}

Cada estado tem uma cor e transparência configuráveis usadas pelo [**estilo de cor das palavras**](#word-color-style), que pode ser ativado ou desativado individualmente.

- **Não coletada**: a palavra não está no banco de dados do asbplayer.
- **Desconhecida**: a palavra está no banco de dados, mas é considerada desconhecida.
- **Em aprendizado**: a palavra está sendo aprendida.
- **Graduada**: a palavra concluiu a etapa de aprendizado.
- **Jovem**: a palavra é conhecida, mas ainda não está madura.
- **Madura**: a palavra é totalmente conhecida (madura).

:::tip
Você pode desativar os estilos de estado como preferir, por exemplo, desativar **Madura** para reduzir a poluição visual.

Você pode reutilizar cores (por exemplo, para **Graduada** e **Jovem**) se não quiser diferenciar determinados estados.

Para saber como os estados dos cartões do Anki são determinados, consulte [**Estabilidade/intervalo para cartões maduros do Anki (dias)**](#mature-anki-stability-interval).
Para saber como os estados do WaniKani são determinados, consulte [**Token da API do WaniKani**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Reprodução</a> {#playback}

### Faixas de legenda afetadas pelos modos de reprodução e atalhos de teclado {#playback-subtitle-tracks}

Especifica quais faixas serão consideradas ao usar os atalhos de teclado de [legendas](#subtitles-keyboard-shortcuts) e [busca](#seek-keyboard-shortcuts), ou os modos de reprodução. Por exemplo, quando o modo condensado está ativado, os espaços sem legendas nas faixas especificadas aqui são pulados automaticamente.

### Pausa automática ao passar o cursor sobre as legendas {#auto-pause-when-mousing-over-subtitles}

Define o comportamento da pausa automática ao passar o cursor sobre as legendas. "Ativada com retomada automática" significa que a reprodução será retomada automaticamente quando o cursor sair das legendas.

### Modos de reprodução {#playback-modes}

Os modos de reprodução podem ser alternados pelos [atalhos de teclado de reprodução](#playback-keyboard-shortcuts).

### Velocidade de reprodução {#playback-rate}

Controla a velocidade normal de reprodução da mídia, incluindo a velocidade usada nas legendas quando o avanço rápido está ativado. A reprodução sempre começa nessa velocidade. Use os [atalhos de teclado de velocidade de reprodução](#playback-rate-keyboard-shortcuts) para ajustá-la enquanto assiste.

### Mostrar notificação de velocidade de reprodução {#show-playback-rate-notification}

Mostra uma notificação quando a velocidade de reprodução muda fora do modo de avanço rápido.

### Preferência de pausa automática {#auto-pause-preference}

Quando a pausa automática está ativada, define se a pausa ocorre no início, no fim ou em ambas as extremidades das legendas. Quando ambas as extremidades e a repetição estão ativadas, a reprodução pausa no fim antes de repetir, mas ignora a pausa no início para evitar duas pausas seguidas.

### Preferência de quantidade de repetições {#repeat-count-preference}

Controla quantas vezes cada legenda será repetida antes de a reprodução continuar. O valor `0` repete indefinidamente.

### Repetições antes de exibir legendas {#repeats-before-showing-subtitles}

Oculta as legendas em um trecho repetido até que ele seja repetido esse número de vezes. `0` não oculta; `1` deixa de ocultar a partir da primeira repetição.

### Deslocamentos dos acionadores de início e fim das legendas {#subtitle-trigger-start-and-end-offsets}

Desloca em milissegundos os acionadores de início e fim das legendas usados pela pausa automática e pela repetição. Esses deslocamentos são aplicados depois do atraso global das legendas. Os deslocamentos inicial e final podem ser configurados separadamente: valores positivos acionam os efeitos de reprodução mais tarde e valores negativos, mais cedo. Cada extremidade deslocada é limitada pelos limites da mídia e dos eventos de legendas vizinhos. Se o início e o fim deslocados se cruzarem, suas funções cronológicas serão invertidas.

### Intervalo mínimo para pular no avanço rápido {#fast-forward-minimum-skip-interval}

Avança rapidamente por todo o intervalo entre legendas quando ele tiver pelo menos essa duração. Intervalos mais curtos mantêm a velocidade normal de reprodução.

### Velocidade de reprodução no avanço rápido {#fast-forward-playback-rate}

Velocidade do avanço rápido quando esse modo está ativado.

### Intervalo mínimo para pular na reprodução condensada {#condensed-playback-minimum-skip-interval}

Quando a reprodução condensada está ativada, avança para a próxima legenda somente se ela estiver a pelo menos esse intervalo de tempo.

### Deslocamentos dos acionadores de início e fim dos intervalos entre legendas {#subtitle-gap-trigger-start-and-end-offsets}

Desloca os acionadores dos intervalos entre legendas usados pelo avanço rápido e pela reprodução condensada. O deslocamento do início do intervalo não pode ser negativo e move o acionador para depois do momento em que a legenda termina; o deslocamento do fim não pode ser positivo e move o acionador para antes do momento anterior à próxima legenda. Cada intervalo é limitado pelos limites da mídia e dos eventos de legendas vizinhos.

### Modo de retomada da pausa automática {#auto-pause-resume-mode}

Controla como uma pausa automática termina.

- **Manual**: a reprodução permanece pausada até você retomá-la.

- **Fixa**: todas as pausas automáticas duram o mesmo intervalo configurado.
  - Controlada por [Duração fixa da pausa](#fixed-pause-duration) e [Atraso para retomar após pausa automática](#resume-delay-after-auto-pause).

- **Duração da legenda**: a duração da pausa é calculada pela quantidade de caracteres da legenda. Somente legendas em faixas buscáveis são contadas; assim, uma faixa de tradução carregada junto com o idioma de estudo não aumenta a pausa.
  - Controlada por [Duração mínima da pausa](#minimum-pause-duration), [Duração máxima da pausa](#maximum-pause-duration), [Tempo de pausa por caractere](#pause-time-per-character) e [Atraso para retomar após pausa automática](#resume-delay-after-auto-pause).

### Duração fixa da pausa {#fixed-pause-duration}

Quanto tempo dura uma pausa automática no modo **Fixa**.

### Duração mínima da pausa {#minimum-pause-duration}

A pausa mais curta permitida no modo **Duração da legenda**, independentemente da quantidade de caracteres.

### Duração máxima da pausa {#maximum-pause-duration}

A pausa mais longa permitida no modo **Duração da legenda**. O valor `0` significa que não há limite superior. Um valor máximo diferente de zero não pode ser menor que a duração mínima da pausa.

### Tempo de pausa por caractere {#pause-time-per-character}

Quantidade de milissegundos atribuída a cada caractere no modo **Duração da legenda**. A quantidade de caracteres multiplicada por esse valor é limitada pelas durações mínima e máxima da pausa.

### Atraso para retomar após pausa automática {#resume-delay-after-auto-pause}

Nos modos **Fixa** e **Duração da legenda**, a pausa automática tem duas etapas: a legenda é exibida durante o tempo configurado para a pausa e, em seguida, fica oculta enquanto a reprodução permanece pausada pelo tempo de retomada. Essa configuração controla a duração da segunda etapa.

### Mostrar legendas {#show-subtitles}

- **Quando previstas**: as legendas aparecem durante seu intervalo de exibição.

- **Enquanto pausadas**: as legendas aparecem somente durante seu intervalo de exibição e quando a reprodução está pausada.

- **Enquanto pausadas manualmente**: as legendas aparecem somente durante seu intervalo de exibição e quando a reprodução foi pausada manualmente.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Reprodução > Anotação</a> {#playback-annotation}

Essas configurações usam os estados, condições e frequências das palavras da seção [Anotação](#annotation) para a faixa de legendas selecionada. As regras de pausa automática, reprodução condensada, avanço rápido e repetição entram em vigor quando seus modos de reprodução estão ativados. **Sem filtro de palavras** significa que nenhum estado ou condição foi selecionado para essa faixa. As regras são aplicadas por faixa: uma faixa buscável sem estados ou condições selecionados para um dos modos mantém o comportamento normal desse modo, mesmo quando é reproduzida junto com uma faixa que tem regras.

### Faixa de legendas {#playback-annotation-track}

Seleciona a faixa de legendas cujas configurações de reprodução por anotação você está editando. A faixa selecionada é compartilhada com a aba Anotação.

### Selecionar a primeira palavra correspondente ao pausar {#select-first-matching-word-on-pause}

Seleciona a primeira palavra correspondente a qualquer estado ou condição escolhido sempre que a reprodução pausa, inclusive em pausas manuais e após buscar enquanto pausado. Deixe a seleção vazia para desativar esse comportamento. A seleção ocorre no player de vídeo ou, quando nenhum vídeo está carregado ou conectado, no player de legendas.

Quando uma [regra de pausa automática baseada em anotações](#auto-pause-subtitles-containing-these-words) causa a pausa, a palavra correspondente a essa regra é selecionada. Esse menu suspenso continua controlando a seleção em pausas manuais.

Cada regra de palavras abaixo tem sua própria seleção de estado e condição, limite de quantidade de palavras e limite de frequência. Uma palavra precisa ter um estado ou condição selecionado e atender aos dois limites.

### Pausar automaticamente legendas que contenham estas palavras {#auto-pause-subtitles-containing-these-words}

Quando o modo de pausa automática está ativado, pausa somente em legendas que contenham uma palavra correspondente e seleciona a primeira palavra correspondente. Nas pausas automáticas, essa opção tem prioridade sobre [**Selecionar a primeira palavra correspondente ao pausar**](#select-first-matching-word-on-pause); esse menu suspenso continua valendo para pausas manuais.

### Repetir legendas que contenham estas palavras {#repeat-subtitles-containing-these-words}

Quando o modo de repetição está ativado, repete somente legendas que contenham uma palavra correspondente.

### Reproduzir legendas que contenham estas palavras no modo condensado {#play-subtitles-containing-these-words-in-condensed-mode}

Quando o modo condensado está ativado, mantém na linha do tempo condensada as legendas que contenham uma palavra correspondente. Pula as demais legendas.

### Reproduzir legendas que contenham estas palavras em velocidade normal no modo de avanço rápido {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Quando o modo de avanço rápido está ativado, reproduz em velocidade normal as legendas que contenham uma palavra correspondente. Avança rapidamente pelas demais legendas.

### Ajustar a velocidade do avanço rápido pela compreensão {#adjust-fast-forward-rate-by-comprehension}

Quando o modo de avanço rápido está ativado, usa a pontuação de compreensão da frase para escolher a velocidade dentro de uma legenda.

No valor de [**Compreensão mínima**](#minimum-comprehension) ou abaixo dele, usa a velocidade normal de reprodução; em 100%, usa a velocidade de avanço rápido configurada. As velocidades entre esses valores são interpoladas.

Alterar a velocidade em uma legenda controlada pela compreensão altera a velocidade de avanço rápido configurada e, em seguida, recalcula a velocidade aplicada com base na compreensão. Isso também vale quando a compreensão mantém a legenda na velocidade normal. Os atalhos de teclado e os controles de velocidade do player funcionam da mesma forma; a velocidade normal não muda.

### Compreensão mínima {#minimum-comprehension}

Define a porcentagem em que a aceleração começa (0–99%, padrão de 60%).

### Mostrar estas palavras durante a reprodução {#show-these-words-during-playback}

Selecione os estados e as condições das palavras que devem permanecer visíveis.

### Ocultar a legenda inteira quando pelo menos esta porcentagem das palavras ficaria oculta {#whole-subtitle-hidden-percentage}

Oculta a legenda inteira quando pelo menos esta porcentagem das palavras ficaria oculta pela regra de exibição. Por exemplo, em **80%**, se quatro palavras de uma legenda com cinco palavras ficariam ocultas, a legenda inteira desaparece, inclusive a palavra selecionada para ser exibida. Pontuação e outros caracteres que não sejam letras não são contados.

### Ocultar individualmente palavras sem correspondência {#hide-non-matching-words-individually}

Quando ativada, as palavras que não atendem à regra de exibição são ocultadas individualmente enquanto a legenda estiver abaixo do limite para ocultar a legenda inteira. Quando desativada, a legenda permanece totalmente visível até atingir esse limite.

### Mínimo de palavras por categoria selecionada {#minimum-words-per-selected-category}

Cada categoria selecionada (como **Não coletada** ou **Ignorada**) é contada separadamente em cada legenda. Se a quantidade ficar abaixo desse limite, as palavras da categoria não acionam a regra. `0` desativa o limite.

### Máximo de palavras por categoria selecionada {#maximum-words-per-selected-category}

Cada categoria selecionada (como **Não coletada** ou **Ignorada**) é contada separadamente em cada legenda. Se a quantidade ultrapassar esse limite, as palavras da categoria não acionam a regra. `0` desativa o limite.

### Somente quando a frequência da palavra for pelo menos {#only-when-word-frequency-is-at-least}

Uma palavra correspondente deve ter uma frequência igual ou superior a esse valor. A frequência ausente é considerada `1`. `0` desativa o limite.

### Somente quando a frequência da palavra for no máximo {#only-when-word-frequency-is-at-most}

Uma palavra correspondente deve ter uma frequência igual ou inferior a esse valor. A frequência ausente é considerada `1`. `0` desativa o limite.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Vídeo em streaming</a> (somente na extensão) {#streaming-video}

As configurações de vídeo em streaming só ficam disponíveis quando a extensão para navegador está instalada.

### Ao carregar legendas, abrir também a lista de legendas no aplicativo em outra aba {#open-subtitle-list-in-tab}

Sempre que as legendas forem carregadas em um elemento de vídeo, abre o site em outra aba e sincroniza as legendas carregadas com ele.

### URL do aplicativo {#app-url}

Determina de onde a extensão obtém algumas configurações e qual URL abrir ao sincronizar as legendas com o site em outra aba. Em resumo, é o URL do site.

### Ativar controles sobrepostos {#enable-controls-overlay}

Exibe a interface sobreposta nos elementos de vídeo que têm legendas carregadas.

### Exibir legendas {#display-subtitles}

Exibe as legendas carregadas nos elementos de vídeo.

### Gravar áudio ao minerar {#record-audio-when-mining}

Ao minerar uma legenda, grava o áudio correspondente para incluí-lo no cartão de memorização.

### Capturar a tela ao minerar {#take-screenshot-when-mining}

Ao minerar uma legenda, captura a tela para incluí-la no cartão de memorização.

### Limpar captura de tela ao minerar {#clean-screenshot-when-mining}

Ao minerar uma legenda com as capturas de tela ativadas, remove todos os elementos HTML sobrepostos ao vídeo antes de capturar a tela, para que a imagem fique "limpa".

### Recortar captura de tela ao minerar {#crop-screenshot-when-mining}

Ao minerar uma legenda, recorta a captura de tela na área do elemento de vídeo.

### Formato de captura de imagem {#streaming-image-capture-format}

Especifica o formato de captura de imagem para cartões minerados de vídeos em streaming. A opção adicional é "WebP animado", que captura o vídeo reproduzido na aba durante o intervalo da legenda — incluindo as margens de áudio — e salva o resultado como uma imagem animada em vez de uma única captura de tela.

O WebP animado só é usado quando [gravar áudio ao minerar](#record-audio-when-mining) está ativado; caso contrário, é feita uma captura de tela normal. Esse recurso se aplica a todas as formas de mineração que gravam mídia, incluindo a gravação manual iniciada e parada pelo atalho de teclado de gravação, que captura tudo até o momento em que a gravação é interrompida (até 30 segundos). Só é possível fazer uma gravação de cada vez. O WebP animado não está disponível no Firefox e não é possível capturar vídeos protegidos por DRM. A aba precisa permanecer visível durante a captura do clipe, pois o Chrome para de renderizar abas ocultas.

### FPS da imagem animada {#animated-image-fps}

Quantidade de quadros por segundo a capturar em imagens WebP animadas. Clipes mais longos usam automaticamente menos quadros para manter o cartão pequeno. Disponível somente quando o formato de captura de imagem WebP animado está selecionado.

### Qualidade da imagem animada {#animated-image-quality}

Qualidade de cada quadro das imagens WebP animadas, de `0.1` a `1`. Um valor maior melhora a imagem, mas gera um arquivo maior. Disponível somente quando o formato de captura de imagem WebP animado está selecionado.

### Permitir arrastar e soltar arquivos de legenda {#allow-subtitle-file-drag-and-drop}

Permite arrastar e soltar arquivos de legenda nos elementos de vídeo.

### Carregar automaticamente legendas detectadas {#auto-load-detected-subtitles}

Se o site atual oferecer suporte à detecção automática de legendas, carrega-as automaticamente. Se várias faixas forem detectadas, carrega a faixa do idioma preferido. O idioma preferido é o último carregado com a opção "lembrar estas escolhas de faixa" marcada.

### Perguntar quando o carregamento automático de legendas detectadas falhar {#prompt-on-subtitle-autoload-failure}

Quando o carregamento automático de legendas falha, pergunta antes de tentar carregar as legendas detectadas.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Vídeo em streaming > Páginas</a> {#pages}

Configurações para integrações específicas de páginas, como YouTube e Netflix. O asbplayer tem configurações padrão predefinidas para cada página; nesta seção, você pode alterá-las.

### Códigos dos idiomas de destino para tradução automática (somente YouTube) {#youtube-translation-languages}

Especifica quais idiomas de destino usar na tradução automática do YouTube. Quando há idiomas especificados, faixas adicionais para cada idioma de destino aparecem no seletor de faixas de legenda.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Diversas</a> {#misc}

### Importar/exportar configurações {#import-export-settings}

Importa ou exporta configurações em um arquivo `json`.

### Tema {#theme}

Exibe o asbplayer inteiro em um tema claro ou escuro.

### Idioma {#language}

Idioma da interface.

Observação: nem todas as strings foram localizadas em todos os idiomas compatíveis com o asbplayer. As strings sem tradução serão exibidas em inglês. Ajude na localização pelo [projeto no Crowdin](https://crowdin.com/project/asbplayer).

### Maximizar automaticamente vídeo local {#auto-maximize-local-video}

Maximiza automaticamente o vídeo local quando o painel de legendas é aberto.

### Mostrar botão de mineração na lista de legendas {#show-mining-button-in-subtitle-list}

Quando ativada, mostra um botão de mineração ao lado de cada legenda na lista.

### Horários na lista de legendas {#subtitle-list-timestamps}

Controla como os horários são exibidos na lista de legendas.

- **Ocultos**: não são exibidos.
- **Início**: exibe somente o horário inicial da legenda.
- **Início e fim**: exibe os horários inicial e final da legenda.

### Lembrar atraso das legendas {#remember-subtitle-offset}

Quando ativada, o atraso é "mantido". As legendas são carregadas com o último atraso usado.

### Lembrar última velocidade de reprodução {#remember-last-playback-rate}

Atualiza a configuração de velocidade de reprodução quando a velocidade é alterada em um vídeo. Quando desativada, a reprodução ainda começa na velocidade configurada, mas as alterações feitas durante a exibição são temporárias.

### Lembrar últimos modos de reprodução {#remember-last-playback-modes}

Restaura os últimos modos de reprodução ativados ao iniciar a reprodução novamente. Quando desativada, a reprodução começa no modo normal.

### Copiar automaticamente a legenda atual para a área de transferência {#auto-copy-current-subtitle-to-clipboard}

Copia automaticamente a legenda para a área de transferência quando ela aparece na tela. É útil para enviar legendas a aplicativos que monitoram a área de transferência.

### Faixas de legenda que podem ser copiadas automaticamente {#subtitle-tracks-eligible-for-auto-copy}

Especifica quais faixas serão copiadas automaticamente quando a opção [Copiar automaticamente a legenda atual para a área de transferência](#auto-copy-current-subtitle-to-clipboard) estiver ativada.

### Mostrar miniaturas de pré-visualização {#show-preview-thumbnails}

Mostra miniaturas de pré-visualização na lista de legendas.

### Legenda acima da miniatura {#subtitle-above-thumbnail}

Mostra a legenda acima da miniatura de pré-visualização na lista de legendas.

### Filtro de expressão regular das legendas {#subtitle-regex-filter}

Os trechos correspondentes a esta expressão regular serão substituídos pelo valor de [Substituição de texto do filtro de expressão regular das legendas](#subtitle-regex-filter-text-replacement).

### Substituição de texto do filtro de expressão regular das legendas {#subtitle-regex-filter-text-replacement}

Os trechos correspondentes à expressão regular acima são substituídos pelo valor desta configuração. Se ficar em branco, os trechos correspondentes serão removidos.

### HTML das legendas {#subtitle-html}

Como tratar o HTML presente nos arquivos de legenda.

### Detectar e exibir ruby {#detect-and-display-ruby}

Quando ativada, o asbplayer detecta automaticamente leituras no estilo da Netflix e as exibe com estilo usando tags `ruby`. Essas leituras aparecem com frequência em legendas japonesas e têm o formato `花子（はなこ）`, com a leitura entre parênteses depois da palavra.

### Ativar cliente WebSocket {#enable-websocket-client}

Ativa o cliente WebSocket. Permite controlar o asbplayer pela interface WebSocket.

### URL do servidor WebSocket {#websocket-server-url}

URL do servidor WebSocket ao qual se conectar quando o cliente WebSocket for ativado. Normalmente, será uma instância local do [servidor WebSocket incluído](../guides/web-socket-server.md).

### Limite de armazenamento do histórico de mineração {#mining-history-storage-limit}

Limita o número de cartões que podem ser salvos no histórico de mineração.

### Nome da aba {#name-of-the-tab}

Nome usado na aba do aplicativo.

## Perfis {#profiles}

Um perfil de configurações é um conjunto completamente diferente de valores de configuração. O perfil ativo pode ser alterado na interface de configurações ou nas caixas de diálogo **Carregar legendas** e **Exportar do Anki**.
