---
sidebar_position: 9
---

import project, { webSocketHttpUrl } from '@site/src/project';
import CodeBlock from '@theme/CodeBlock';

# Serveur WebSocket {#websocket-server}

asbplayer tire parti de la communication bidirectionnelle des connexions WebSocket pour exposer une interface accessible depuis l’extérieur du navigateur.

Dans cette architecture, asbplayer est un **client WebSocket** qui maintient une connexion avec un **serveur WebSocket** exécuté localement sur l’ordinateur de l’utilisateur. Le serveur expose ensuite une interface HTTP qui déclenche des commandes sur asbplayer, le client. La documentation technique du serveur fourni est [ici](../reference/external-api.md).

Le serveur a été créé à l’origine pour permettre le mining en un clic, en enrichissant les requêtes `addNote` d’AnkiConnect avec des médias fournis par asbplayer. Il fait donc également office de **proxy AnkiConnect**.

:::note
La méthode recommandée pour faire du mining en un clic consiste à utiliser le [module complémentaire Anki d’asbplayer](./one-click-mining.md#install-the-asbplayer-anki-add-on). Le proxy AnkiConnect décrit ci-dessous est une solution de remplacement.
:::

## Exécuter le serveur {#run-the-server}

1. Clonez le <a href={project.urls.repo}>dépôt asbplayer</a>.

    <CodeBlock language="bash">{`git clone ${project.urls.repo}.git asbplayer`}</CodeBlock>

2. Si ce n’est pas déjà fait, installez [Golang](https://go.dev/dl/).
3. Exécutez le serveur :

    ```
    cd asbplayer/scripts/web-socket-server
    go run .
    ```

Le proxy est très léger et peut rester exécuté en arrière-plan. Sous Windows, vous pouvez utiliser [RBTray](https://github.com/benbuck/rbtray) pour le réduire dans la barre des tâches.

## Connecter asbplayer au serveur {#connect-asbplayer-to-the-server}

Configurez et activez le client WebSocket d’asbplayer depuis les <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>paramètres divers</a>. Par défaut, asbplayer utilise déjà l’adresse IP et le port du serveur WebSocket ; il suffit donc généralement d’activer le client WebSocket.

## Mining en un clic avec le proxy AnkiConnect {#one-click-mining-with-the-ankiconnect-proxy}

Suivez les instructions du [site de Yomitan](https://yomitan.wiki/) pour installer Yomitan et le configurer avec un dictionnaire dans la langue que vous apprenez.

Configurez ensuite Yomitan :

- L’URL AnkiConnect doit pointer vers le proxy AnkiConnect plutôt que vers AnkiConnect. L’URL du proxy par défaut est <code>{webSocketHttpUrl}</code>.
- Yomitan doit utiliser le même **type de note** qu’asbplayer.

Le mining de phrases avec Yomitan crée des cartes contenant déjà la définition du mot, une image et un fichier audio. Pour obtenir un processus réellement en un clic, définissez `POST_MINE_ACTION` du proxy sur `2` (mettre à jour la dernière carte). Consultez la [configuration du serveur](#server-configuration) pour en savoir plus.

Pour toujours utiliser le texte des sous-titres d’asbplayer dans le champ Sentence, activez [**Toujours utiliser le texte des sous-titres pour le champ de la phrase**](../reference/settings.md#always-use-subtitle-text-for-sentence-field) dans les paramètres de **Mining**. Le texte fourni par Yomitan sera remplacé par celui des sous-titres extraits de toutes les pistes.

## Référence de l’API {#api-reference}

Consultez la [documentation technique](../reference/external-api.md#commands) pour obtenir la description des commandes qui peuvent être envoyées à asbplayer par la connexion WebSocket.

## API HTTP {#http-based-api}

Le serveur WebSocket fournit une API HTTP qui déclenche les commandes décrites ci-dessus.

- `POST asbplayer/load-subtitles` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/load-subtitles`}>script</a>)
- `POST asbplayer/seek` (optional `mediaId` in the request body) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/seek`}>script</a>)
- `GET asbplayer/bound-media` (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/bound-media`}>script</a>)
- `GET asbplayer/subtitles` (optional `?mediaId=...&trackNumbers=0,1`) (<a href={`${project.urls.repo}/blob/main/scripts/web-socket-server/cli/subtitles`}>script</a>)

## Proxy AnkiConnect {#ankiconnect-proxy}

Le serveur WebSocket fait également office de proxy AnkiConnect. Il permet d’enrichir les requêtes `addNote` avec des données fournies par asbplayer, comme l’audio et les captures d’écran.

Le proxy transmet telles quelles toutes les requêtes AnkiConnect, à l’exception de `addNote`. Son comportement pour `addNote` dépend de la valeur de `POST_MINE_ACTION` dans la configuration décrite ci-dessous.

## Configuration du serveur {#server-configuration}

Le serveur se configure avec un fichier `.env` placé dans le même répertoire. Voici un exemple accompagné d’explications.

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
