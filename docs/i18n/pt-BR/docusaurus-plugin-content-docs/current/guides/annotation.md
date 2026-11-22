---
sidebar_position: 1
---

import project from '@site/src/project';

# Anotação {#annotation}

O asbplayer pode anotar legendas para ajudar no aprendizado de idiomas. Os recursos de anotação incluem:

- **Estilização de palavras**: cor, sublinhado, contorno etc. com base no estado da palavra
    - O estado de conhecimento pode vir do Anki ou do WaniKani, ser sincronizado com eles e/ou ser registrado localmente no asbplayer (inclui recursos de importação e exportação para preencher a lista de palavras conhecidas).
- **Anotação de leitura**: leituras exibidas acima de cada palavra ou com base no estado.
- **Anotação de frequência**: frequência baseada na classificação, exibida abaixo de cada palavra ou de acordo com o estado (requer pelo menos um dicionário de frequência baseado em classificação).
- **Anotação de acento tonal**: padrões de acento exibidos sobre palavras em furigana ou kana (requer pelo menos um dicionário de acento tonal).
- **Anotação de glossário**: definições ou explicações breves exibidas para cada palavra.
- **Estatísticas e compreensão**: oferece informações sobre as palavras que você conhece no conteúdo atual.
- **Reprodução adaptativa**: usa modos de reprodução e dados de anotação para otimizar sua experiência de aprendizado.
- **Navegador de palavras**: gerencie palavras locais e visualize palavras sincronizadas de fontes externas.
- **Muitos outros recursos estão previstos para versões futuras!**

:::info
O recurso de anotação requer uma instância configurada do [Yomitan](https://yomitan.wiki/) e a [yomitan-api](https://github.com/yomidevs/yomitan-api).

Se você usa o **banco de dados de palavras local**, recomendamos instalar a extensão de navegador do asbplayer para reduzir a chance de o navegador excluir as palavras armazenadas. Se não puder instalar a extensão, considere exportar periodicamente suas configurações e/ou palavras locais como cópia de segurança.
:::

## Configuração {#setup}

1. Abra as **Configurações** do asbplayer.
2. Acesse a seção **Anotação**.
3. Selecione a faixa que deseja configurar.
4. Configure a **URL do Yomitan** para essa faixa.
    - Você precisará de uma instância configurada do [Yomitan](https://yomitan.wiki/) e da [yomitan-api](https://github.com/yomidevs/yomitan-api).
    - Se a URL for inválida ou estiver inacessível, o asbplayer mostrará um erro ao lado da configuração.
    - As informações de frequência requerem que sua instância do Yomitan tenha pelo menos um dicionário de frequência baseado em classificação.
5. (Para usuários do Anki) Configure de quais cartões serão obtidas as informações do estado de conhecimento.
    - Em geral, deixe [`baralhos do Anki`](../reference/settings.md#anki-decks) em branco para usar todos os baralhos; normalmente, basta filtrar pelos campos.
    - [`Campos de palavras do Anki`](../reference/settings.md#anki-word-fields) correspondem ao campo da nota do Anki que contém apenas a palavra desejada.
    - Use [`campos de frases do Anki`](../reference/settings.md#anki-sentence-fields) somente para notas sem um campo específico para palavras, como baralhos de frases. Essas palavras são usadas como alternativa quando uma palavra não está nos campos de palavras do Anki.
    - Para preencher o banco de dados, use [`Reconstruir banco de dados de palavras do Anki`](../reference/settings.md#re-build-anki-word-database) depois de configurar esses campos.
6. (Para usuários do WaniKani) Acesse [WaniKani > Settings > API Tokens](https://www.wanikani.com/settings/personal_access_tokens) para criar um token para o asbplayer.
    - No campo `Token Description`, digite `asbplayer` e deixe todas as `Permissions` desmarcadas. O asbplayer precisa apenas de acesso de leitura à sua conta do WaniKani.
    - Clique em `Generate token` e copie o token gerado para [`Token da API do WaniKani`](../reference/settings.md#wanikani-api-token).
    - Para preencher o banco de dados, use [`Reconstruir banco de dados de palavras do WaniKani`](../reference/settings.md#re-build-wanikani-word-database) depois de configurar o token da API.
7. Ative os recursos de anotação desejados (estilização, leitura, frequência, acento tonal etc.) para essa faixa. Personalize as outras configurações como preferir.
8. Para explicações detalhadas de cada opção, consulte a seção [Anotação](../reference/settings.md#annotation) da referência de configurações. As ações do teclado estão listadas no grupo [Atalhos de teclado da anotação](../reference/settings.md#annotation-keyboard-shortcuts).

## Solução de problemas {#troubleshooting}

Consulte a seção de [problemas comuns](../common-issues.md#annotation) da documentação para solucionar problemas de anotação. Se não encontrar uma solução, entre em contato pelo <a href={project.urls.discord}>Discord</a> ou envie um <a href={`${project.urls.repo}/issues`}>relatório de bug</a> com detalhes sobre o problema e as etapas para reproduzi-lo.
