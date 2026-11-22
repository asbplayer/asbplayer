---
sidebar_position: 3
---

import NoteAddIcon from '@site/src/components/NoteAddIcon';
import ImageIcon from '@site/src/components/ImageIcon';

# Mineração em detalhes {#mining-in-depth}

Com o asbplayer, você pode minerar frases de várias maneiras, conforme suas necessidades e preferências.

## Abrir a caixa de diálogo de exportação do Anki {#opening-the-anki-export-dialog}

Há várias formas de abrir a **caixa de diálogo de exportação do Anki**:

1. O botão **Minerar legenda** <NoteAddIcon /> na **lista de legendas** do **painel lateral** ou no site.
2. O botão **Minerar legenda** <NoteAddIcon /> na **interface sobreposta** em vídeos em streaming ou no site para dispositivos móveis.
3. O [atalho de teclado de mineração](../reference/settings.md#mining-keyboard-shortcuts) **Minerar legenda atual e abrir a caixa de diálogo do Anki** — `Ctrl + Shift + X` por padrão.
4. Clique com o botão direito em um vídeo em streaming → asbplayer → **Minerar legenda**.

:::info
Os métodos 1 e 2 só abrem a caixa de diálogo se a [ação padrão do botão de mineração](../reference/settings#mining-button-default-action) estiver definida como "Mostrar caixa de diálogo do Anki".
:::

:::info
Quando uma faixa de legendas _vazia_ está carregada e a gravação de áudio está ativada, todas as ações acima começam a gravar áudio na primeira vez que são acionadas e abrem a caixa de diálogo do Anki na segunda.
:::

## Ajustar cartões {#adjusting-cards}

Antes de exportar, você pode ajustar os cartões na caixa de diálogo.

### Intervalo de tempo selecionado {#selected-time-range}

Use o **controle deslizante** na parte inferior da caixa de diálogo para alterar o intervalo de tempo selecionado.

- O **campo Sentence** será atualizado automaticamente para corresponder ao intervalo de tempo selecionado, se ainda não tiver sido editado manualmente.
- Em arquivos locais, o trecho de áudio também será atualizado automaticamente.
- Em vídeos em streaming, é possível gravar novamente o trecho de áudio usando o intervalo de tempo selecionado.

### Campo de áudio {#audio-field}

O **campo Audio** mostra o trecho de áudio gravado e oferece três botões de ação:

- **Reproduzir/Pausar** — pré-visualize o trecho de áudio diretamente na caixa de diálogo.
- **Gravar novamente** — grave o áudio novamente usando o intervalo de tempo selecionado (somente em vídeos em streaming; exibido quando a opção de gravar novamente está disponível).
- **Baixar** — baixe o trecho de áudio como arquivo para seu dispositivo.

### Campos de texto {#text-fields}

É possível editar qualquer campo de texto: frase, definição, palavra, campos personalizados, fonte, URL e etiquetas. Em geral, usa-se um aplicativo de dicionário separado para preencher o campo de definição.

### Campo de imagem {#image-field}

Em arquivos locais, clique no **botão de pré-visualização** <ImageIcon /> do **campo Image** para alterar o horário do vídeo usado para extrair a captura de tela.

## Exportar cartões {#exporting-cards}

Use os botões na parte inferior da caixa de diálogo para exportar o cartão. Há três tipos de exportação:

1. **Exportar**: exporta um cartão com o conteúdo da caixa de diálogo.
2. **Atualizar último cartão**: atualiza o último cartão do seu baralho do Anki com o conteúdo da caixa de diálogo.
3. **Abrir no Anki**: abre o criador de cartões do Anki preenchido com o conteúdo da caixa de diálogo.

## Fluxos de mineração sem caixa de diálogo {#dialog-less-mining-flows}

É possível minerar sem abrir a caixa de diálogo do Anki e ainda incluir uma definição combinando o asbplayer com um aplicativo de dicionário que também se integre ao Anki. Atualmente, o aplicativo de dicionário mais popular com esse recurso é o [Yomitan](https://yomitan.wiki/).

### Atualizar último cartão {#update-last-card}

Um fluxo de mineração com o Yomitan sem caixa de diálogo funciona assim:

1. No Yomitan, selecione nas legendas a palavra que deseja minerar.
2. Use o botão de criação de cartões do Yomitan para criar um cartão.
3. Em seguida, use o [atalho de teclado de mineração](../reference/settings.md#mining-keyboard-shortcuts) **Atualizar último cartão** do asbplayer — `Ctrl + Shift + U` — para atualizar o cartão com o conteúdo fornecido pelo asbplayer.

Uma desvantagem desse fluxo é que, ao pular a caixa de diálogo, você também perde a oportunidade de modificar o cartão. Há algumas formas de contornar isso:

- Em vez de atualizar diretamente o último cartão na etapa final, você pode usar `Ctrl + Shift + X` para abrir a caixa de diálogo, ajustar o cartão e, por fim, **atualizar o último cartão** pela interface. Assim, você ainda usa a caixa de diálogo e mantém a definição da palavra fornecida automaticamente pelo Yomitan.
- Você também pode abrir a **caixa de diálogo de exportação do Anki** _depois_ de criar o cartão com o [atalho de teclado de mineração](../reference/settings.md#mining-keyboard-shortcuts) **Capturar tela manualmente** — `Ctrl + Shift + V` por padrão.

### Um clique {#one-click}

Consulte o guia de [mineração com um clique](./one-click-mining.md).
