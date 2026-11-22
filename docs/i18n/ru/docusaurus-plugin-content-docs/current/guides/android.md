---
sidebar_position: 7.5
---

import project from '@site/src/project';

# Android {#android}

На устройствах Android asbplayer тоже можно использовать, хотя удобство работы будет ниже.

## Сайт {#website}

Сайт можно использовать без дополнительной настройки. Вместо стандартных элементов управления видео, оптимизированных для компьютеров, будет отображаться **интерфейс поверх видео**.

### Добавление на главный экран {#add-to-home-screen}

Как прогрессивное веб-приложение, сайт можно добавить на главный экран устройства Android. Откройте меню браузера и нажмите «Добавить на главный экран».

## Расширение {#extension}

:::warning
**Многие функции недоступны**: **боковая панель**, **снимки экрана** и **интерфейс WebSocket**. Список функций, которые поддерживаются и не поддерживаются в разных браузерах, приведён в разделе [совместимости](../compatibility.md#browsers-and-features).
:::

Как и на сайте, основной способ взаимодействовать с расширением asbplayer — через **интерфейс поверх видео**. Боковой панели нет, поэтому **субтитры загружаются нажатием кнопки asbplayer в меню расширений браузера**. Клавиатура (в том числе Bluetooth) необязательна, но может быть полезна тем, кто предпочитает использовать [сочетания клавиш](../reference/settings.md#keyboard-shortcuts) расширения.

Ниже перечислены браузеры Android, в которые можно установить asbplayer.

### Firefox для Android {#firefox-for-android}

Установите asbplayer со <a href={project.extension.firefoxAndroid.storeUrl}>страницы AMO</a>. У Firefox для Android те же ограничения, что и у Firefox: нельзя записывать аудио из потоков, защищённых DRM.

### Edge Canary {#edge-canary}

Edge Canary — ещё один мобильный браузер на базе Chromium, поддерживающий расширения. На момент написания этой статьи запись аудио в asbplayer для Edge Canary не поддерживается.
Чтобы установить asbplayer в Edge Canary:

1. Скачайте файл `crx` asbplayer со <a href={`${project.urls.repo}/releases/latest`}>страницы релизов</a>.
2. Если режим разработчика ещё не включён, откройте настройки Edge Canary, перейдите в раздел «О Microsoft Edge» и несколько раз нажмите на строку с номером сборки.
3. В разделе **Параметры разработчика** нажмите **Установка расширения из crx** и выберите скачанный файл `crx`.

### Kiwi Browser (разработка прекращена) {#kiwi-browser-discontinued}

Kiwi Browser — мобильный браузер на базе Chromium, поддерживающий расширения. Его разработка прекращена, и установить его можно только со [страницы GitHub](https://github.com/kiwibrowser/src.next/releases). После установки Kiwi Browser asbplayer можно установить из <a href={project.extension.chrome.storeUrl}>интернет-магазина Chrome</a>.

## Интеграция с Anki {#anki-integration}

Для интеграции с Anki установите [AnkiConnect Android](https://github.com/KamWithK/AnkiconnectAndroid).
