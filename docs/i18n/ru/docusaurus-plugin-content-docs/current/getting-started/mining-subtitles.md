---
sidebar_position: 2
---

import project, { appOrigin } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Майнинг субтитров {#mining-subtitles}

**Майнинг предложений** — создание карточек по предложениям. asbplayer позволяет создавать качественные карточки с предложениями, объединяя видео, аудио и субтитры. asbplayer интегрируется с **Anki** — популярным приложением для карточек.

## Настройка Anki {#setup-anki}

1. Установите [Anki](https://apps.ankiweb.net/).
2. Добавьте в Anki [AnkiConnect](https://ankiweb.net/shared/info/2055492159).
3. Если вы майните по видеофайлам, добавьте <code>{appOrigin}</code> в `webCorsOriginList` в настройках AnkiConnect:

   <CodeBlock language="json">{JSON.stringify({
     apiKey: null,
     apiLogPath: null,
     ignoreOriginList: [],
     webBindAddress: project.services.ankiConnect.host,
     webBindPort: project.services.ankiConnect.port,
     webCorsOriginList: [appOrigin],
   }, null, 2)}</CodeBlock>

4. Добавьте **колоду**.
5. Добавьте **тип заметки**.
   Рекомендуем создать собственный тип заметки или использовать готовый. Чтобы быстро начать, выполните следующие действия и создайте простой тип заметки:
   1. Нажмите Инструменты → Управление типами заметок.
   2. Добавьте тип заметки «Основная».
   3. Настройте **Поля**:
      - Предложение
      - Слово
      - Определение
      - Изображение
      - Аудио
      - Источник
      - URL
   4. Настройте **Карточку**:
      - Лицевая сторона:
        ```
        {{Sentence}}
        ```
      - Оборотная сторона:
        ```
        {{FrontSide}}
        <hr id=answer>
        {{Definition}}
        <p/>
        <div class="image">
        {{Image}}
        </div>
        <p/>
        {{Audio}}
        <p/>
        {{Source}}
        <p/>
        {{URL}}
        ```

## Настройка asbplayer {#configure-asbplayer}

1. Откройте <a href={new URL('?view=settings', project.urls.app).href}>настройки asbplayer</a>.
2. Выберите созданные **колоду** и **тип заметки**.
3. Для каждого поля — **Предложение**, **Определение**, **Слово**, **Аудио**, **Изображение**, **Источник** и **URL** — выберите соответствующее поле типа заметки.

## Установка словарного приложения {#install-a-dictionary-app}

В asbplayer нет встроенного словаря. Рекомендуем установить словарное приложение, чтобы проще заполнять поле **Определение** в карточках. Вот несколько популярных вариантов:

- [Yomitan](https://yomitan.wiki/) — расширение браузера, позволяющее находить слова при наведении на них. Изначально оно было создано для японского языка, но теперь начинает поддерживать и другие языки.
- [VocabSieve](https://docs.freelanguagetools.org/) — отдельное приложение для изучения языков с поддержкой европейских языков.

## Майнинг субтитров {#mine-subtitles}

1. [Загрузите субтитры](./loading-subtitles.md) к любому видео.
2. Нажмите кнопку **Майнить субтитр** <NoteAddIcon />.
3. Заполните появившийся диалог и нажмите **Экспортировать**.
