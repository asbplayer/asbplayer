---
sidebar_position: 8
---

# One-click mining

asbplayer is great at connecting subtitle and video content to AnkiConnect, but is not able to automatically provide word definitions on its own. For this reason, most sentence mining flows require at two or three mouse or keyboard inputs from the user.

One-click mining is possible if asbplayer is combined with another application that:

- supplies the missing word definition information, and
- already integrates with AnkiConnect.

[Yomitan](https://yomitan.wiki/) is an example of one such application.

## Install and configure Yomitan

Follow the directions on [Yomitan's website](https://yomitan.wiki/) to install Yomitan and configure it with a dictionary for your target language.

## Run asbplayer's AnkiConnect proxy

Follow the [WebSocket server guide](./web-socket-server) to setup an AnkiConnect proxy that allows asbplayer to enrich AnkiConnect cards before they finally reach AnkiConnect.

## Point Yomitan at the proxy

Configure Yomitan:

- The AnkiConnect URL should point at the AnkiConnect proxy rather than AnkiConnect. The default proxy URL is `http://127.0.0.1:8766`.
- Yomitan should be using the same **Note Type** as asbplayer.

## Mine with **Yomitan** as usual

Mining sentences using Yomitan will create cards with word definition, image, and audio already provided. A truly one-click mining flow can be achieved if the proxy's `POST_MINE_ACTION` is `2` (update last card).

## Keep the Yomitan pop-up out of screenshots

Because you mine by clicking inside Yomitan's pop-up, the pop-up is usually still on screen when asbplayer captures its screenshot — so it ends up baked into the image. asbplayer's **Clean screenshot when mining** option only hides asbplayer's own UI, not overlays drawn by other extensions.

To hide the pop-up, use the **Hide elements during clean screenshots** setting (under **Settings → Streaming video → Mining**) and add Yomitan's pop-up selector:

```
.yomitan-popup
```

This requires turning off Yomitan's **"Use a secure container around popups"** option (under the **Security** section of Yomitan's settings, after clicking **More…**), which otherwise keeps the pop-up out of reach of page-side scripts such as asbplayer.

That option is a security feature, so rather than disabling it globally, use a [Yomitan profile](https://yomitan.wiki/) with a URL condition to effectively whitelist only the sites you mine from: create a profile whose condition matches those domains, turn the option off in that profile, and leave it on everywhere else.
