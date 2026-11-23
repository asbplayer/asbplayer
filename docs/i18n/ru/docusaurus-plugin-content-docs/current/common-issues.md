---
sidebar_position: 5
---

import project from '@site/src/project';

# Частые проблемы {#common-issues}

## Общие вопросы {#general}

### Не отображаются субтитры {#subtitles-arent-showing-up}

Субтитры в asbplayer можно скрыть несколькими способами:

- сочетанием клавиш [`Показать/скрыть субтитры`](./reference/settings.md#subtitles-keyboard-shortcuts);
- сочетаниями клавиш [`Показать/скрыть дорожку субтитров X в видео`](./reference/settings.md#subtitles-keyboard-shortcuts);
- параметром [`Показывать субтитры`](./reference/settings.md#show-subtitles) в разделе `Воспроизведение > Режимы воспроизведения`.

### asbplayer не подключается к Anki и показывает ошибку, например «Failed to fetch» {#anki-connection-failed}

Причиной могут быть блокировщики рекламы:

- Если вы используете Brave, убедитесь, что Shields не блокирует asbplayer.
- Проверьте, не блокирует ли запрос браузер или блокировщик рекламы. Для начала откройте инструменты разработчика браузера и проверьте сообщения об ошибках.

Неправильная настройка:

- При использовании сайта убедитесь, что AnkiConnect разрешает подключение asbplayer, как описано [здесь](./getting-started/mining-subtitles.md).

Также причиной могут быть ошибки:

- На момент написания этой статьи известно, что включение экспериментальных функций веб-платформы вызывает эту проблему. Попробуйте отключить этот флаг на странице `chrome://flags`.
- В новых версиях macOS AnkiConnect не отвечает, когда Anki работает в фоновом режиме ([заметки для пользователей MacOS](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### После использования функции «Обновить последнюю карточку» карточка не обновляется в Anki {#card-not-updating}

Перед использованием функции «Обновить последнюю карточку» закройте браузер карточек Anki. В AnkiConnect есть [известная проблема](https://github.com/FooSoft/anki-connect/issues/82): при открытом браузере карточек может казаться, что карточки не обновляются.

### При загрузке локального файла asbplayer показывает чёрный экран или не воспроизводит аудио {#local-video-playback-issues}

Возможности браузеров декодировать некоторые форматы видео и аудио различаются. См. раздел [совместимости](./compatibility.md#browsers-and-media-formats).

### Всплывающий словарь (например, Yomitan) не работает в боковой панели {#popup-dictionary-in-side-panel}

Из соображений безопасности браузеры не позволяют внедрять скрипты расширений на страницы других расширений, поэтому исправить это нельзя. Чтобы сканировать текст с помощью других расширений, используйте субтитры внутри видеоплеера или список субтитров на сайте asbplayer.

### asbplayer не обнаруживает потоковое видео {#asbplayer-isnt-detecting-streaming-video}

В сведениях о расширении убедитесь, что ему разрешён доступ ко всем сайтам.

### Не работают сочетания клавиш {#keyboard-shortcuts-arent-working}

Проверьте <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>настройки сочетаний клавиш</a> или [справочник по сочетаниям клавиш](./reference/settings.md#keyboard-shortcuts).

Если вы используете расширение, также:

- Проверьте `chrome://extensions/shortcuts` в Chrome или `about:addons` → значок шестерёнки → `Управление сочетаниями клавиш расширений` в Firefox.
- Обновите страницу и снова загрузите субтитры.
- Попробуйте удалить и заново установить расширение, а затем перезапустить браузер.
- Убедитесь, что расширение не установлено дважды.

### asbplayer неправильно обрезает снимки экрана потокового видео {#screenshot-cropping-issues}

Убедитесь, что масштаб браузера равен 100%. Обрезку можно полностью отключить в <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>настройках расширения</a>.

### Не удаётся создавать карточки с типом заметки JP mining {#jp-mining-note-issues}

См. этот [issue](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer постоянно запрашивает разрешение на запись аудио {#repeated-audio-permission-prompts}

Сейчас asbplayer несовместим с расширением Volume Master. Отключите его.

### Записи аудио звучат искажённо, с треском или с пропусками {#garbled-audio-recordings}

Обычно это связано с недостаточной производительностью процессора. Если вы используете ноутбук, подключите его к источнику питания. Убедитесь, что режим экономии заряда и другие настройки не ограничивают производительность процессора.

### При открытии asbplayer сочетанием клавиш на странице потокового видео ничего не происходит, а страница перестаёт отвечать {#streaming-shortcut-unresponsive}

Это может происходить, если на странице `chrome://flags` включён флаг `Experimental Web Platform features`. Отключите его и попробуйте снова.

## Аннотации {#annotation}

### Включение и отключение аннотаций для дорожки {#enable-or-disable-annotation-for-a-track}

Аннотации отключены, если для параметров ниже выбраны указанные значения:

- В разделе [`Настройки > Аннотации`](./reference/settings.md#annotation):
  - [`Окрашивать субтитры по известным словам`](./reference/settings.md#colorize-subtitles-based-on-known-words): **Выкл.**
  - [`Автоматически создавать статистику`](./reference/settings.md#generate-statistics-automatically): **Выкл.**
  - [`Показывать чтение слов`](./reference/settings.md#display-word-readings): _Ничего не выбрано_ (пустое значение)
  - [`Показывать частотность слов`](./reference/settings.md#display-word-frequency): _Ничего не выбрано_ (пустое значение)
  - [`Показывать тоновый акцент (японский)`](./reference/settings.md#display-pitch-accent-japanese): _Ничего не выбрано_ (пустое значение)
  - [`Показывать определения слов`](./reference/settings.md#display-word-definitions): _Ничего не выбрано_ (пустое значение)
- В разделе [`Настройки > Воспроизведение > Аннотации`](./reference/settings.md#playback-annotation):
  - [`Выбирать первое совпавшее слово при паузе`](./reference/settings.md#select-first-matching-word-on-pause): Никогда
  - [`Приостанавливать субтитры с этими словами`](./reference/settings.md#auto-pause-subtitles-containing-these-words): фильтр слов не задан
  - [`Воспроизводить субтитры с этими словами в сжатом режиме`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode): фильтр слов не задан
  - [`Воспроизводить субтитры с этими словами на обычной скорости в ускоренном режиме`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode): фильтр слов не задан
  - [`Повторять субтитры с этими словами`](./reference/settings.md#repeat-subtitles-containing-these-words): фильтр слов не задан
  - [`Показывать эти слова во время воспроизведения`](./reference/settings.md#show-these-words-during-playback): фильтр слов не задан
  - [`Настраивать скорость ускоренного воспроизведения по пониманию`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension): **Выкл.**

Чтобы включить аннотации для дорожки, измените хотя бы один из указанных параметров. Некоторые аннотации отображаются только при наведении, если это [настроено](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Кнопки [`Перестроить базу слов Anki`](./reference/settings.md#re-build-anki-word-database) и [`Перестроить базу слов WaniKani`](./reference/settings.md#re-build-wanikani-word-database) будут отключены, если для параметров выше не заданы значения, использующие соответствующую интеграцию.
:::

### Очистка базы слов Anki {#clear-anki-word-database}

Чтобы удалить слова Anki для дорожки, задайте пустые значения для параметров [`Поля слов Anki`](./reference/settings.md#anki-word-fields) и [`Поля предложений Anki`](./reference/settings.md#anki-sentence-fields), затем нажмите [`Перестроить базу слов Anki`](./reference/settings.md#re-build-anki-word-database). Если кнопка отключена, сначала [выполните эти действия](#enable-or-disable-annotation-for-a-track), чтобы включить аннотации для дорожки.

### Очистка базы слов WaniKani {#clear-wanikani-word-database}

Чтобы удалить слова WaniKani для дорожки, задайте пустое значение для [токена API WaniKani](./reference/settings.md#wanikani-api-token), затем нажмите [`Перестроить базу слов WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Если кнопка отключена, сначала [выполните эти действия](#enable-or-disable-annotation-for-a-track), чтобы включить аннотации для дорожки.

### Удаление слов, отслеживаемых локально {#delete-locally-tracked-words}

Чтобы удалить слово, отслеживаемое локально, наведите на него указатель и с помощью [сочетаний клавиш для аннотаций](./reference/settings.md#annotation-keyboard-shortcuts) задайте ему состояние **Не собрано**. Если для него включено состояние **Игнорировать**, отключите его.

Чтобы удалить сразу несколько локально отслеживаемых слов, откройте [`Обозреватель слов`](./reference/settings.md#word-browser), задайте словам состояние **Не собрано** и удалите их состояния. Также можно воспользоваться функцией [`Импорт слов`](./reference/settings.md#import-words).

### Все слова имеют состояние «Не собрано» {#everything-is-uncollected}

Если вы случайно включили аннотации, [выполните эти действия](#enable-or-disable-annotation-for-a-track), чтобы отключить их.

Если состояние слов не меняется с **Не собрано**:

- Если вы используете локальные состояния, импортируйте слова в локальную базу или задайте состояние при наведении с помощью [сочетаний клавиш для аннотаций](./reference/settings.md#annotation-keyboard-shortcuts).
- Если состояние берётся из Anki, убедитесь, что Anki запущен и указан правильный **URL AnkiConnect**.
    - Настройте [`Поля слов Anki`](./reference/settings.md#anki-word-fields) (рекомендуется) и/или [`Поля предложений Anki`](./reference/settings.md#anki-sentence-fields).
    - Нажмите [`Перестроить базу слов Anki`](./reference/settings.md#re-build-anki-word-database).
    - После построения базы Anki можно закрыть, но если оставить его открытым во время воспроизведения, asbplayer будет синхронизировать данные.
- Если состояние берётся из WaniKani, убедитесь, что указан правильный [`токен API WaniKani`](./reference/settings.md#wanikani-api-token).
    - Нажмите [`Перестроить базу слов WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - Во время воспроизведения asbplayer будет автоматически синхронизироваться с WaniKani.

### Появляется красное зачёркивание {#red-strikethrough-styling-appears}

Если вы случайно включили аннотации, [выполните эти действия](#enable-or-disable-annotation-for-a-track), чтобы отключить их.

Это означает, что при обработке субтитров произошла ошибка, вероятнее всего, из-за проблемы с подключением к Yomitan. Проверьте сообщения об ошибках в консоли браузера. Если не удаётся решить проблему, обратитесь за помощью в Discord asbplayer.
