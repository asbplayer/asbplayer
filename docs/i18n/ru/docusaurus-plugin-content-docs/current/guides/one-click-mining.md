---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Майнинг в один клик {#one-click-mining}

asbplayer умеет связывать субтитры и видео с AnkiConnect, но сам не может автоматически предоставить определения слов. Поэтому для майнинга предложений обычно требуется два или три действия мышью или клавиатурой.

Майнинг в один клик возможен, если использовать asbplayer вместе с приложением, которое:

- предоставляет недостающие определения слов;
- уже интегрировано с AnkiConnect.

[Yomitan](https://yomitan.wiki/) — пример такого приложения.

## Установка и настройка Yomitan {#install-and-configure-yomitan}

Следуйте инструкциям на [сайте Yomitan](https://yomitan.wiki/), чтобы установить Yomitan и настроить словарь для изучаемого языка. Если вы ещё этого не сделали, установите в Anki также [AnkiConnect](https://ankiweb.net/shared/info/2055492159).

В настройках Anki в Yomitan:

- укажите стандартный адрес сервера AnkiConnect (<code>{ankiConnectUrl}</code>);
- выберите тот же **тип заметки**, что и в asbplayer.

## Установка дополнения asbplayer для Anki {#install-the-asbplayer-anki-add-on}

Для дополнения требуется Anki версии не ниже 25.02. Оно пока недоступно на AnkiWeb, поэтому его нужно установить из файла:

1. Скачайте последний файл `.ankiaddon` со <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>страницы релизов</a>.
2. Откройте файл и нажмите **Да** во всплывающем окне.
3. Перезапустите Anki.

## Подключение asbplayer к дополнению {#connect-asbplayer-to-the-add-on}

Включите клиент WebSocket в <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>разделе прочих настроек</a> расширения asbplayer (внизу страницы). Оставьте стандартный URL сервера WebSocket (<code>{webSocketUrl}</code>), совпадающий со стандартным URL дополнения.

## Майнинг с **Yomitan** в обычном режиме {#mine-with-yomitan-as-usual}

При майнинге предложений с помощью Yomitan будут создаваться карточки, в которые уже добавлены определение слова, изображение и аудио.

Чтобы всегда использовать текст субтитров asbplayer в поле «Предложение», включите параметр [**Всегда использовать текст субтитров для поля предложения**](../reference/settings#always-use-subtitle-text-for-sentence-field) в настройках **Майнинга**. Текст предложения, переданный Yomitan, будет заменён текстом смайненных субтитров со всех дорожек.

## Настройки дополнения

Настройки дополнения можно изменить в Anki: откройте **Инструменты > Дополнения**, выберите дополнение и нажмите **Настроить**. `postMineAction` — действие, которое asbplayer выполняет после добавления карточки через Yomitan (по умолчанию: <code>{project.services.webSocket.postMineAction}</code>). Для майнинга в один клик задайте значение `2` (обновить последнюю карточку). Если изменить `port`, URL сервера WebSocket в asbplayer тоже нужно изменить.
