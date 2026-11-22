---
sidebar_position: 11
---

import project from '@site/src/project';

# Legendas online {#online-subtitles}

Em vez de procurar arquivos de legenda manualmente, você pode pesquisá-los e carregá-los diretamente pelo asbplayer. As legendas são fornecidas pelo [Jimaku](https://jimaku.cc), um site comunitário de legendas que cobre principalmente anime e dramas japoneses.

## Uso {#usage}

1. Abra o painel lateral em uma página com vídeo e clique em **Carregar legendas**.
2. Clique em **Pesquisar legendas online** (também disponível no menu suspenso das faixas de legenda).
3. O termo de pesquisa é preenchido com o título da página. Ajuste-o se necessário, escolha **Anime** ou **Drama** e pesquise.
4. Clique em um resultado da pesquisa para ver os arquivos de legenda e, em seguida, clique em um arquivo para carregá-lo.

Somente arquivos `.srt` e `.ass` são listados. As obras abertas recentemente aparecem em **Recentes**, para que você possa pular a pesquisa na próxima vez.

## Obter uma chave de API do Jimaku {#api-key}

O Jimaku requer uma chave de API para pesquisar e baixar arquivos.

1. Crie uma conta em [jimaku.cc](https://jimaku.cc) e entre.
2. Abra a [página da sua conta](https://jimaku.cc/account) e gere uma chave de API.
3. Cole a chave no campo **Chave de API do Jimaku** da caixa de pesquisa.

A chave é salva automaticamente, então você só precisa fazer isso uma vez. Ela fica oculta por padrão; use o ícone de olho para exibi-la.

## Detecção automática de episódios {#episode-detection}

Em séries, o asbplayer tenta identificar o número do episódio no título da página (por exemplo, `S01E05`, `EP05` ou `第5話`/`第五集`). Se encontrar um:

- o marcador do episódio é removido do termo de pesquisa, que passa a conter somente o nome da série;
- a lista de arquivos é filtrada para esse episódio, indicado por uma etiqueta **EP N**. Clique no ✕ da etiqueta para ver todos os arquivos.

Se não houver arquivos de legenda utilizáveis para o episódio escolhido, a lista completa será exibida.

### Expressão regular personalizada para episódios {#episode-regex}

Alguns sites usam formatos de título que as regras integradas não reconhecem. Nesse caso, nenhum episódio é detectado e você vê todos os arquivos da série. Uma expressão regular personalizada ensina o asbplayer a identificar o episódio nesses sites.

Depois de abrir uma série, clique no ícone de engrenagem ao lado do cabeçalho da lista de arquivos para exibir o campo **Expressão regular personalizada para episódios**. O ícone fica realçado enquanto uma expressão regular estiver definida.

- O **grupo de captura 1** deve conter o número do episódio (são aceitos algarismos arábicos e kanji).
- Sua expressão regular é testada primeiro. Se estiver vazia, inválida ou não corresponder ao título, as regras integradas serão usadas normalmente; portanto, ela só pode ampliar a cobertura.
- Pressione **Enter** para filtrar novamente a série atual. O termo de pesquisa atualizado será usado na próxima vez que você abrir a caixa de diálogo.

:::tip
As regras integradas foram testadas apenas nos poucos sites usados pelo autor desse recurso. Se o formato de título de um site não for reconhecido, <a href={`${project.urls.repo}/issues`}>abra uma issue</a> com um exemplo de título de página (ou envie um PR para `common/subtitle-sources/jimaku-episode-patterns.ts`) para que as regras integradas possam ser ampliadas.
:::

Por exemplo, se um site usar o título `Some Show - Chapter 07 | SiteName`, use:

```
Chapter (\d+)
```

## Agradecimentos {#jimaku-acknowledgements}

Muito obrigado a [Rapptz](https://github.com/Rapptz), que criou e mantém o [Jimaku](https://github.com/Rapptz/jimaku) e fornece a API que possibilita esse recurso. Se você achar o recurso útil, considere apoiar o site e enviar suas próprias legendas.
