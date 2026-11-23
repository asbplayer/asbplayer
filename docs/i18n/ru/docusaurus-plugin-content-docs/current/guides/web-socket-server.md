---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Сервер WebSocket {#websocket-server}

asbplayer использует двусторонние соединения WebSocket, чтобы предоставить интерфейс, доступный за пределами браузера.

В этой схеме asbplayer выступает как **клиент WebSocket**, подключённый к локальному **серверу WebSocket** на компьютере пользователя. Сервер предоставляет интерфейс HTTP для отправки команд клиенту asbplayer. Техническое описание готового сервера находится [здесь](../reference/external-api.md).

Изначально сервер был создан для майнинга в один клик: он дополняет запросы AnkiConnect `addNote` медиафайлами, предоставляемыми asbplayer. Поэтому одна из его основных функций — работа в качестве **прокси AnkiConnect**.

:::note
Рекомендуемый способ майнинга в один клик — [дополнение asbplayer для Anki](./one-click-mining.md#install-the-asbplayer-anki-add-on). Описанный ниже прокси AnkiConnect — альтернативный вариант.
:::

## Запуск сервера {#run-the-server}

1. Клонируйте <a href={project.urls.repo}>репозиторий asbplayer</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Если Golang ещё не установлен, [установите его](https://go.dev/dl/).
3. Запустите сервер:

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Прокси почти не использует ресурсы, поэтому его можно оставить работающим в фоновом режиме. В Windows можно использовать [RBTray](https://github.com/benbuck/rbtray), чтобы сворачивать его в область уведомлений.

## Подключение asbplayer к серверу {#connect-asbplayer-to-the-server}

Настройте и включите клиент WebSocket asbplayer в <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>прочих настройках</a>. По умолчанию asbplayer уже использует стандартные IP-адрес и порт сервера WebSocket; обычно достаточно включить клиент.

## Майнинг в один клик через прокси AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Следуйте инструкциям на [сайте Yomitan](https://yomitan.wiki/), чтобы установить его и настроить словарь для изучаемого языка.

Then configure Yomitan:

- В поле URL AnkiConnect укажите адрес прокси AnkiConnect, а не самого AnkiConnect. Стандартный URL прокси: <code>{webSocketHttpUrl}</code>.
- В Yomitan должен быть выбран тот же **тип заметки**, что и в asbplayer.

При майнинге предложений с помощью Yomitan создаются карточки с определением слова, изображением и аудио. Для майнинга в один клик задайте прокси значение `2` параметра `POST_MINE_ACTION` (обновить последнюю карточку). Подробнее см. в разделе [Настройка сервера](#server-configuration).

Чтобы всегда использовать текст субтитров asbplayer в поле «Предложение», включите параметр [**Всегда использовать текст субтитров для поля предложения**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) в настройках **Майнинга**. Текст предложения от Yomitan будет заменён смайненным текстом со всех дорожек.

## Справочник API {#api-reference}

Описание команд, которые можно отправлять в asbplayer через WebSocket, см. в [техническом справочнике](../reference/external-api.md#commands).

## API на основе HTTP {#http-based-api}

Сервер WebSocket реализует API на основе HTTP, которое запускает описанные выше команды.

- `POST asbplayer/load-subtitles` (необязательный `mediaId` в теле запроса) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>скрипт</a>)
- `POST asbplayer/seek` (необязательный `mediaId` в теле запроса) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>скрипт</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>скрипт</a>)
- `GET asbplayer/subtitles` (необязательный `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>скрипт</a>)

## Прокси AnkiConnect {#ankiconnect-proxy}

Сервер WebSocket также работает как прокси AnkiConnect и позволяет дополнять запросы `addNote` данными asbplayer, например аудио и снимками экрана.

Прокси передаёт все запросы AnkiConnect без изменений, кроме `addNote`. Поведение прокси для `addNote` зависит от значения `POST_MINE_ACTION`, описанного ниже.

## Настройка сервера {#server-configuration}

Настройки сервера задаются в файле `.env` в той же папке. Ниже приведён пример с пояснениями.

```
# Port that the proxy will listen on
PORT=8766

# AnkiConnect URL
ANKI_CONNECT_URL=http://127.0.0.1:8765

# Action for asbplayer to take when the proxy receives an addNote request
# 0 = 'None'
# 1 = 'Open Anki dialog'
# 2 = 'Update last card' (updates last card with asbplayer media AFTER passing through original addNote request)
# 3 = 'Export card'
POST_MINE_ACTION=2
```
