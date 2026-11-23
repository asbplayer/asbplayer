---
sidebar_position: 5
---

import project from '@site/src/project';

# Problemas comuns {#common-issues}

## Geral {#general}

### As legendas não aparecem {#subtitles-arent-showing-up}

Há algumas formas de ocultar as legendas no asbplayer:

- O atalho de teclado [`Alternar legendas`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Os atalhos de teclado [`Alternar faixa de legenda X no vídeo`](./reference/settings.md#subtitles-keyboard-shortcuts).
- A opção [`Mostrar legendas`](./reference/settings.md#show-subtitles) em `Reprodução > Modos de reprodução`.

### O asbplayer não consegue se conectar ao Anki. Uma mensagem de erro é exibida, por exemplo, 'Failed to fetch.' {#anki-connection-failed}

Isso pode acontecer por causa de bloqueadores de anúncios:

- Se estiver usando o Brave, verifique se o Shield não está bloqueando o asbplayer.
- Verifique se o navegador ou algum bloqueador de anúncios não está bloqueando a solicitação. Um bom começo é abrir o console do desenvolvedor do navegador e procurar erros.

Configuração incorreta:

- Se estiver usando o site, confira se o AnkiConnect permite o asbplayer, conforme descrito [aqui](./getting-started/mining-subtitles.md).

Possíveis bugs:

- No momento da redação deste texto, sabe-se que ativar os recursos experimentais da plataforma web causa esse problema. Tente desativar essa opção em `chrome://flags`.
- Nas versões mais recentes do macOS, o AnkiConnect não responde quando o Anki está em segundo plano ([Notas para usuários do macOS](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### O cartão não é atualizado no Anki ao usar o recurso 'atualizar último cartão'. {#card-not-updating}

Verifique se o navegador de cartões do Anki está fechado ao usar "atualizar último cartão". Há um [problema conhecido](https://github.com/FooSoft/anki-connect/issues/82) no AnkiConnect que impede os cartões de parecerem atualizados quando o navegador de cartões está aberto.

### Ao carregar um arquivo local, o asbplayer mostra uma tela preta ou não reproduz o áudio. {#local-video-playback-issues}

Os navegadores têm capacidades diferentes para decodificar determinados formatos de vídeo e áudio. Consulte a seção [compatibilidade](./compatibility.md#browsers-and-media-formats).

### Minha extensão de dicionário pop-up (por exemplo, Yomitan) não funciona no painel lateral {#popup-dictionary-in-side-panel}

Por motivos de segurança, os navegadores não permitem que scripts de uma extensão sejam inseridos nas páginas de outra extensão, então não há como corrigir isso. Para analisar o texto com outras extensões, use as legendas exibidas dentro do elemento de vídeo ou a lista de legendas no site do asbplayer.

### O asbplayer não está detectando o vídeo em streaming. {#asbplayer-isnt-detecting-streaming-video}

Nas informações da extensão, confira se ela tem acesso a todos os sites.

### Os atalhos de teclado não funcionam. {#keyboard-shortcuts-arent-working}

Confira as <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>configurações dos atalhos de teclado</a> ou a [referência de atalhos de teclado](./reference/settings.md#keyboard-shortcuts).

Além disso, se estiver usando a extensão:

- Confira `chrome://extensions/shortcuts` no Chrome ou `about:addons` → ícone de engrenagem → `Gerenciar atalhos de extensão` no Firefox.
- Tente atualizar a página e carregar as legendas novamente.
- Tente desinstalar e reinstalar a extensão e reiniciar o navegador.
- Verifique se a extensão não está instalada duas vezes.

### O asbplayer não recorta corretamente capturas de tela de vídeos em streaming. {#screenshot-cropping-issues}

Verifique se o zoom do navegador está em 100%. Você pode desativar totalmente o recorte nas <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>configurações da extensão</a>.

### Estou com problemas para criar cartões usando o tipo de nota JP Mining. {#jp-mining-note-issues}

Consulte esta [issue](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### O asbplayer continua pedindo permissão para gravar áudio {#repeated-audio-permission-prompts}

Atualmente, o asbplayer não é compatível com a extensão Volume Master. Portanto, será necessário desativá-la.

### As gravações de áudio ficam distorcidas, chiadas ou falhas {#garbled-audio-recordings}

Isso geralmente acontece por falta de capacidade de processamento. Se estiver usando um laptop, verifique se ele está conectado à energia. Em geral, confira se o modo de economia de bateria ou algo semelhante não está limitando o desempenho da CPU.

### Quando uso um atalho de teclado para abrir o asbplayer em um vídeo em streaming, nada acontece e a página para de responder. {#streaming-shortcut-unresponsive}

Isso pode acontecer porque `Experimental Web Platform features` está ativado em `chrome://flags`. Verifique se está desativado e tente novamente.

## Anotação {#annotation}

### Ativar ou desativar a anotação de uma faixa {#enable-or-disable-annotation-for-a-track}

A anotação é considerada desativada quando as configurações a seguir estão definidas com estes valores:

- Em [`Configurações > Anotação`](./reference/settings.md#annotation):
- Em [`Configurações > Anotação`](./reference/settings.md#annotation):
  - [`Colorir legendas com base nas palavras conhecidas`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Desativado**
  - [`Gerar estatísticas automaticamente`](./reference/settings.md#generate-statistics-automatically): **Desativado**
  - [`Exibir leituras das palavras`](./reference/settings.md#display-word-readings): _Nada selecionado_ (valor vazio)
  - [`Exibir frequência das palavras`](./reference/settings.md#display-word-frequency): _Nada selecionado_ (valor vazio)
  - [`Exibir acento tonal (japonês)`](./reference/settings.md#display-pitch-accent-japanese): _Nada selecionado_ (valor vazio)
  - [`Exibir definições das palavras`](./reference/settings.md#display-word-definitions): _Nada selecionado_ (valor vazio)
- Em [`Configurações > Reprodução > Anotação`](./reference/settings.md#playback-annotation):
  - [`Selecionar a primeira palavra correspondente ao pausar`](./reference/settings.md#select-first-matching-word-on-pause): Nunca
  - [`Pausar automaticamente legendas que contenham estas palavras`](./reference/settings.md#auto-pause-subtitles-containing-these-words): Sem filtro de palavras
  - [`Reproduzir legendas que contenham estas palavras no modo condensado`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): Sem filtro de palavras
  - [`Reproduzir legendas que contenham estas palavras em velocidade normal no modo de avanço rápido`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): Sem filtro de palavras
  - [`Repetir legendas que contenham estas palavras`](./reference/settings.md#repeat-subtitles-containing-these-words): Sem filtro de palavras
  - [`Mostrar estas palavras durante a reprodução`](./reference/settings.md#show-these-words-during-playback): Sem filtro de palavras
  - [`Ajustar a velocidade do avanço rápido pela compreensão`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Desativado**

Para ativar a anotação de uma faixa, altere pelo menos uma das configurações acima para um valor diferente do valor desativado. Algumas anotações podem aparecer somente ao passar o cursor, se estiverem [configuradas dessa forma](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Os botões [`Reconstruir banco de dados de palavras do Anki`](./reference/settings.md#re-build-anki-word-database) e [`Reconstruir banco de dados de palavras do WaniKani`](./reference/settings.md#re-build-wanikani-word-database) ficam desativados, a menos que as configurações acima tenham valores específicos que se beneficiem dessa integração.
:::

### Limpar o banco de dados de palavras do Anki {#clear-anki-word-database}

Para limpar as entradas do banco de dados de palavras do Anki de uma faixa, deixe vazios os [`campos de palavras do Anki`](./reference/settings.md#anki-word-fields) e os [`campos de frases do Anki`](./reference/settings.md#anki-sentence-fields) e use o botão [`Reconstruir banco de dados de palavras do Anki`](./reference/settings.md#re-build-anki-word-database). Se o botão estiver desativado, [siga estas etapas](#enable-or-disable-annotation-for-a-track) para ativar primeiro a anotação da faixa.

### Limpar o banco de dados de palavras do WaniKani {#clear-wanikani-word-database}

Para limpar as entradas do banco de dados de palavras do WaniKani de uma faixa, deixe vazio o [token da API do WaniKani](./reference/settings.md#wanikani-api-token) e use o botão [`Reconstruir banco de dados de palavras do WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Se o botão estiver desativado, [siga estas etapas](#enable-or-disable-annotation-for-a-track) para ativar primeiro a anotação da faixa.

### Excluir palavras registradas localmente {#delete-locally-tracked-words}

Você pode excluir uma palavra registrada localmente passando o cursor sobre ela e usando os [atalhos de teclado da anotação](./reference/settings.md#annotation-keyboard-shortcuts) para definir o estado como **Não coletada** e desativar **Ignorada**, caso esteja ativado.

Para excluir em lote palavras registradas localmente, use o [`navegador de palavras`](./reference/settings.md#word-browser) para marcá-las como **Não coletadas** e remover seus estados. Você também pode usar o recurso [`Importar palavras`](./reference/settings.md#import-words).

### Todas as palavras estão como não coletadas {#everything-is-uncollected}

Se você ativou a anotação por acidente, [siga estas etapas](#enable-or-disable-annotation-for-a-track) para desativá-la.

Se o estado das palavras nunca muda de **Não coletada**:

- Se você usa estados locais, importe palavras para o banco de dados local ou passe o cursor sobre elas e use os [atalhos de teclado da anotação](./reference/settings.md#annotation-keyboard-shortcuts) para definir os estados.
- Se você usa o Anki para definir os estados, verifique se ele está em execução e se o **URL do AnkiConnect** está correto.
    - Configure os [`campos de palavras do Anki`](./reference/settings.md#anki-word-fields) (recomendado) e/ou os [`campos de frases do Anki`](./reference/settings.md#anki-sentence-fields).
    - Execute [`Reconstruir banco de dados de palavras do Anki`](./reference/settings.md#re-build-anki-word-database).
    - Não é necessário manter o Anki em execução depois de criar o banco de dados, mas deixá-lo aberto durante a reprodução manterá o asbplayer sincronizado.
- Se você usa o WaniKani para definir os estados, verifique se o [`token da API do WaniKani`](./reference/settings.md#wanikani-api-token) está correto.
    - Execute [`Reconstruir banco de dados de palavras do WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - O asbplayer sincroniza automaticamente com o WaniKani durante a reprodução.

### Aparece um estilo tachado vermelho {#red-strikethrough-styling-appears}

Se você ativou a anotação por acidente, [siga estas etapas](#enable-or-disable-annotation-for-a-track) para desativá-la.

Isso indica que ocorreu um erro ao processar as legendas, provavelmente devido a um problema de conexão com o Yomitan. Confira se há mensagens de erro no console do navegador e procure ajuda no Discord do asbplayer se não conseguir resolver o problema.
