---
sidebar_position: 8
---

import project, { ankiConnectUrl, webSocketUrl } from '@site/src/project';

# Mining en un clic {#one-click-mining}

asbplayer relie efficacement les sous-titres et la vidéo à AnkiConnect, mais ne peut pas fournir automatiquement les définitions des mots. C’est pourquoi la plupart des processus de sentence mining nécessitent deux ou trois actions de la souris ou du clavier.

Le mining en un clic est possible si asbplayer est associé à une autre application qui :

- fournit les définitions manquantes des mots et
- s’intègre déjà à AnkiConnect.

[Yomitan](https://yomitan.wiki/) est un exemple de ce type d’application.

## Installer et configurer Yomitan {#install-and-configure-yomitan}

Suivez les instructions du [site de Yomitan](https://yomitan.wiki/) pour installer Yomitan et le configurer avec un dictionnaire dans la langue que vous apprenez. Si ce n’est pas déjà fait, ajoutez également [AnkiConnect](https://ankiweb.net/shared/info/2055492159) à Anki.

Dans les paramètres Anki de Yomitan :

- L’adresse du serveur AnkiConnect doit être celle par défaut (<code>{ankiConnectUrl}</code>).
- Yomitan doit utiliser le même **type de note** qu’asbplayer.

## Installer le module complémentaire Anki d’asbplayer {#install-the-asbplayer-anki-add-on}

Le module complémentaire nécessite Anki 25.02 ou une version ultérieure. Il n’est pas encore disponible sur AnkiWeb ; il faut donc l’installer depuis un fichier :

1. Téléchargez le dernier fichier `.ankiaddon` depuis la <a href={`${project.urls.repo}/releases?q=${encodeURIComponent(project.releases.ankiAddon.releaseTitlePrefix)}`}>page des versions publiées</a>.
2. Ouvrez le fichier et cliquez sur **Oui** dans la fenêtre qui s’affiche.
3. Redémarrez Anki.

## Connecter asbplayer au module complémentaire {#connect-asbplayer-to-the-add-on}

Activez le client WebSocket dans les <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>paramètres divers</a> de l’extension asbplayer (vers le bas). Conservez l’URL du serveur WebSocket par défaut (<code>{webSocketUrl}</code>), qui correspond à celle du module complémentaire.

## Faites du mining avec **Yomitan** comme d’habitude {#mine-with-yomitan-as-usual}

Le mining de phrases avec Yomitan crée des cartes contenant déjà la définition du mot, une image et un fichier audio.

Pour toujours utiliser le texte des sous-titres d’asbplayer dans le champ Sentence, activez [**Toujours utiliser le texte des sous-titres pour le champ de la phrase**](../reference/settings#always-use-subtitle-text-for-sentence-field) dans les paramètres de **Mining**. Le texte de la phrase fourni par Yomitan sera remplacé par le texte des sous-titres extraits de toutes les pistes.

## Paramètres du module complémentaire

Les paramètres du module complémentaire se modifient dans Anki, sous **Outils > Modules complémentaires**. Sélectionnez le module, puis cliquez sur **Configurer**. `postMineAction` définit l’action effectuée par asbplayer après l’ajout d’une carte par Yomitan (valeur par défaut : <code>{project.services.webSocket.postMineAction}</code>). Définissez cette option sur `2` (mettre à jour la dernière carte) pour utiliser le mining en un clic. Si vous modifiez `port`, vous devez aussi modifier l’URL du serveur WebSocket d’asbplayer.
