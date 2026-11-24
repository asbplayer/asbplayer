---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Mineração com um clique {#one-click-mining}

O asbplayer é ótimo para conectar legendas e conteúdo de vídeo ao AnkiConnect, mas não consegue fornecer definições de palavras automaticamente por conta própria. Por isso, a maioria dos fluxos de mineração de frases exige duas ou três ações do usuário com o mouse ou teclado.

É possível minerar com um clique se o asbplayer for combinado com outro aplicativo que:

- forneça as definições de palavras necessárias; e
- já se integre ao AnkiConnect.

O [Yomitan](https://yomitan.wiki/) é um exemplo desse tipo de aplicativo.

## Instalar e configurar o Yomitan {#install-and-configure-yomitan}

Siga as instruções no [site do Yomitan](https://yomitan.wiki/) para instalá-lo e configurá-lo com um dicionário para o idioma que está aprendendo. Se ainda não fez isso, adicione também o [AnkiConnect](https://ankiweb.net/shared/info/2055492159) ao Anki.

Nas configurações do Anki no Yomitan:

- O endereço do servidor AnkiConnect deve ser o padrão (<code>{ankiConnectUrl}</code>).
- O Yomitan deve usar o mesmo **tipo de nota** que o asbplayer.

## Instalar o complemento do Anki do asbplayer {#install-the-asbplayer-anki-add-on}

O complemento requer pelo menos o Anki 25.02. Ele ainda não está disponível no AnkiWeb, então precisa ser instalado a partir de um arquivo:

1. Baixe o arquivo `.ankiaddon` mais recente na <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>página de versões</a>.
2. Abra o arquivo e clique em **Sim** na janela exibida.
3. Reinicie o Anki.

## Conectar o asbplayer ao complemento {#connect-asbplayer-to-the-add-on}

Ative o cliente WebSocket nas <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>configurações diversas</a> da extensão do asbplayer (perto do fim da página). Mantenha o URL padrão do servidor WebSocket (<code>{webSocketUrl}</code>), que corresponde ao padrão do complemento.

## Minere normalmente com o **Yomitan** {#mine-with-yomitan-as-usual}

Ao minerar frases com o Yomitan, os cartões já serão criados com a definição da palavra, a imagem e o áudio.

Para sempre usar o texto das legendas do asbplayer no campo Sentence, ative [**Sempre usar o texto das legendas no campo da frase**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) nas configurações de **Mineração**. Isso substitui o texto da frase fornecido pelo Yomitan pelo texto minerado das legendas em todas as faixas.

Se você minerar várias palavras da mesma legenda, **Atualizar último card** também poderá atualizar cartões correspondentes anteriores. Ative [**atualizações de frase**](../reference/settings.md#update-sentence-for-cards-with-the-same-subtitle-text) para compartilhar a frase e as faixas de legenda configuradas, ou [**atualizações de imagem/áudio**](../reference/settings.md#update-all-cards-with-the-same-subtitle-text) para compartilhar a captura de tela e o clipe de áudio.

## Configurações do complemento

As configurações do complemento podem ser alteradas no Anki. Acesse **Ferramentas > Complementos**, selecione o complemento e clique em **Configurar**. `postMineAction` é a ação executada pelo asbplayer depois que o Yomitan adiciona um cartão (padrão: <code>{project.services.webSocket.postMineAction}</code>). Defina o valor como `2` (atualizar último cartão) para usar o fluxo de mineração com um clique. Se `port` for alterado, ajuste o URL do servidor WebSocket do asbplayer para corresponder.
