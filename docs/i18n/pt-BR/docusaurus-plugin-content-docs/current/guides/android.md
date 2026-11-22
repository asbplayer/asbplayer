---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

Embora a experiência de uso não seja tão boa, é possível usar o asbplayer em dispositivos Android.

## Site {#website}

O site pode ser usado normalmente. A **interface sobreposta** será exibida no lugar dos controles de vídeo padrão, otimizados para computadores.

### Adicionar à tela inicial {#add-to-home-screen}

Como aplicativo web progressivo, o site pode ser adicionado à tela inicial do seu dispositivo Android. No menu do navegador, toque em "Adicionar à tela inicial".

## Extensão {#extension}

:::warning
**Vários recursos estão indisponíveis**: o **painel lateral**, as **capturas de tela** e a **interface WebSocket**. Consulte a seção [compatibilidade](../compatibility.md#browsers-and-features) para ver uma tabela com os recursos compatíveis e incompatíveis em cada navegador.
:::

Assim como no site, a principal forma de interagir com a extensão do asbplayer é pela **interface sobreposta**. Como o painel lateral não está disponível, **carregue legendas selecionando o botão do asbplayer no menu de extensões do navegador**. Não é necessário usar um teclado (Bluetooth), mas ele pode ser muito útil para quem prefere usar os [atalhos de teclado](../reference/settings.md#keyboard-shortcuts) da extensão.

Abaixo estão os navegadores para Android nos quais é possível instalar o asbplayer.

### Firefox for Android {#firefox-for-android}

Instale o asbplayer pela <a href={project.extension.firefoxAndroid.storeUrl}>página da AMO</a>. O Firefox para Android tem as mesmas limitações do Firefox: não é possível gravar áudio de transmissões protegidas por DRM.

### Edge Canary {#edge-canary}

O Edge Canary é outro navegador móvel baseado no Chromium que pode executar extensões. No momento da redação deste texto, o asbplayer no Edge Canary não oferece suporte à gravação de áudio.
Para instalar o asbplayer no Edge Canary:

1. Baixe o arquivo `crx` do asbplayer na <a href={`${project.urls.repo}/releases/latest`}>página de versões</a>.
2. Se ainda não estiver ativado, habilite o modo de desenvolvedor nas configurações do Edge Canary. Para isso, acesse "Sobre o Microsoft Edge" e toque várias vezes no número da versão.
3. Em **Opções do desenvolvedor**, toque em **Instalar extensão por CRX** e selecione o arquivo `crx` que acabou de baixar.

### Kiwi Browser (descontinuado) {#kiwi-browser-discontinued}

O Kiwi Browser é um navegador móvel baseado no Chromium que pode executar extensões. No entanto, seu desenvolvimento foi descontinuado e a única forma de instalá-lo é pela [página no GitHub](https://github.com/kiwibrowser/src.next/releases). Depois de instalar o Kiwi Browser, você pode instalar o asbplayer pela <a href={project.extension.chrome.storeUrl}>loja virtual</a> do Chrome.

## Integração com o Anki {#anki-integration}

Instale o [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid) para integrar com o Anki.
