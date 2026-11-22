---
sidebar_position: 5
---

import project from '@site/src/project';

# Problèmes fréquents {#common-issues}

## Généralités {#general}

### Les sous-titres ne s’affichent pas {#subtitles-arent-showing-up}

Vous pouvez masquer les sous-titres dans asbplayer de plusieurs façons :

- Le raccourci clavier [`Afficher/masquer les sous-titres`](./reference/settings.md#subtitles-keyboard-shortcuts).
- Les raccourcis clavier [`Afficher/masquer la piste de sous-titres X dans la vidéo`](./reference/settings.md#subtitles-keyboard-shortcuts).
- L’option [`Afficher les sous-titres`](./reference/settings.md#show-subtitles) dans `Lecture > Modes de lecture`

### asbplayer ne parvient pas à se connecter à Anki et affiche une erreur telle que « Failed to fetch » {#anki-connection-failed}

Cela peut être dû à un bloqueur de publicités :

- Si vous utilisez Brave, vérifiez que Shield ne bloque pas asbplayer.
- Vérifiez que votre navigateur ou un bloqueur de publicités ne bloque pas la requête. Commencez par ouvrir la console de développement du navigateur et rechercher des erreurs.

Mauvaise configuration :

- Si vous utilisez le site web, vérifiez qu’AnkiConnect autorise asbplayer, comme indiqué [ici](./getting-started/mining-subtitles.md).

Ou bugs :

- À la date de rédaction, l’activation des fonctionnalités expérimentales de la plateforme web est connue pour provoquer ce problème. Essayez de désactiver cette option dans `chrome://flags`.
- Sur les versions récentes de macOS, AnkiConnect ne répond pas lorsque Anki est en arrière-plan ([Notes pour les utilisateurs de macOS](https://git.sr.ht/~foosoft/anki-connect#notes-for-macos-users)).

### La carte ne se met pas à jour dans Anki avec la fonction « Mettre à jour la dernière carte » {#card-not-updating}

Vérifiez que le navigateur de cartes d’Anki est fermé lorsque vous utilisez « Mettre à jour la dernière carte ». En raison d’un [problème connu](https://github.com/FooSoft/anki-connect/issues/82) dans AnkiConnect, les cartes semblent ne pas se mettre à jour quand le navigateur de cartes est ouvert.

### L’écran est noir ou le son ne fonctionne pas lors du chargement d’un fichier local {#local-video-playback-issues}

Les navigateurs ne prennent pas tous en charge les mêmes formats vidéo et audio. Consultez la [section sur la compatibilité](./compatibility.md#browsers-and-media-formats).

### Mon extension de dictionnaire contextuel (par exemple Yomitan) ne fonctionne pas dans le panneau latéral {#popup-dictionary-in-side-panel}

Pour des raisons de sécurité, les navigateurs n’autorisent pas l’injection des scripts d’une extension dans les pages d’une autre extension. Il n’y a donc pas de solution à ce problème. Pour analyser du texte avec d’autres extensions, utilisez les sous-titres affichés dans la vidéo ou la liste des sous-titres sur le site web asbplayer.

### asbplayer ne détecte pas la vidéo en streaming {#asbplayer-isnt-detecting-streaming-video}

Dans les détails de l’extension, vérifiez qu’elle a accès à tous les sites.

### Les raccourcis clavier ne fonctionnent pas {#keyboard-shortcuts-arent-working}

Consultez les <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>paramètres des raccourcis clavier</a> ou la [référence des raccourcis clavier](./reference/settings.md#keyboard-shortcuts).

Si vous utilisez l’extension, vérifiez également les points suivants :

- Dans Chrome, vérifiez `chrome://extensions/shortcuts`. Dans Firefox, ouvrez `about:addons` → icône d’engrenage → `Gérer les raccourcis des extensions`.
- Actualisez la page et chargez à nouveau les sous-titres.
- Essayez de désinstaller puis de réinstaller l’extension, et de redémarrer le navigateur.
- Vérifiez que l’extension n’est pas installée en double.

### asbplayer ne recadre pas correctement les captures d’écran des vidéos en streaming {#screenshot-cropping-issues}

Vérifiez que le zoom du navigateur est réglé sur 100 %. Vous pouvez désactiver complètement le recadrage dans les <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>paramètres de l’extension</a>.

### J’ai du mal à créer des cartes avec la note JP mining {#jp-mining-note-issues}

Consultez ce [ticket](https://github.com/asbplayer/asbplayer/issues/220#issuecomment-1501124166).

### asbplayer me redemande sans cesse l’autorisation d’enregistrer l’audio {#repeated-audio-permission-prompts}

asbplayer n’est pas compatible avec l’extension Volume Master pour le moment. Vous devez donc la désactiver.

### Les enregistrements audio sont déformés, grésillants ou saccadés {#garbled-audio-recordings}

Cela est généralement dû à un manque de puissance du processeur. Si vous utilisez un ordinateur portable, vérifiez qu’il est branché. Assurez-vous que le mode d’économie d’énergie ne limite pas les performances du processeur.

### Le raccourci clavier pour ouvrir asbplayer sur une vidéo en streaming ne fait rien et bloque la page {#streaming-shortcut-unresponsive}

Cela peut se produire si `Experimental Web Platform features` est activé dans `chrome://flags`. Vérifiez que cette option est désactivée, puis réessayez.

## Annotation {#annotation}

### Activer ou désactiver l’annotation pour une piste {#enable-or-disable-annotation-for-a-track}

L’annotation est considérée comme désactivée lorsque les paramètres suivants ont ces valeurs :

- Dans [`Paramètres > Annotation`](./reference/settings.md#annotation):
  - [`Colorer les sous-titres selon les mots connus`](./reference/settings.md#colorize-subtitles-based-on-known-words) : **Désactivé**
  - [`Générer automatiquement les statistiques`](./reference/settings.md#generate-statistics-automatically) : **Désactivé**
  - [`Afficher la lecture des mots`](./reference/settings.md#display-word-readings) : _Aucune sélection_ (valeur vide)
  - [`Afficher la fréquence des mots`](./reference/settings.md#display-word-frequency) : _Aucune sélection_ (valeur vide)
  - [`Afficher l’accent tonal (japonais)`](./reference/settings.md#display-pitch-accent-japanese) : _Aucune sélection_ (valeur vide)
  - [`Afficher les définitions des mots`](./reference/settings.md#display-word-definitions) : _Aucune sélection_ (valeur vide)
- Dans [`Paramètres > Lecture > Annotation`](./reference/settings.md#playback-annotation):
  - [`Sélectionner le premier mot correspondant lors d’une pause`](./reference/settings.md#select-first-matching-word-on-pause) : Jamais
  - [`Mettre en pause les sous-titres contenant ces mots`](./reference/settings.md#auto-pause-subtitles-containing-these-words) : Aucun filtre de mots
  - [`Lire les sous-titres contenant ces mots en mode condensé`](./reference/settings.md#play-subtitles-containing-these-words-in-condensed-mode) : Aucun filtre de mots
  - [`Lire à vitesse normale en mode avance rapide les sous-titres contenant ces mots`](./reference/settings.md#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode) : Aucun filtre de mots
  - [`Répéter les sous-titres contenant ces mots`](./reference/settings.md#repeat-subtitles-containing-these-words) : Aucun filtre de mots
  - [`Afficher ces mots pendant la lecture`](./reference/settings.md#show-these-words-during-playback) : Aucun filtre de mots
  - [`Adapter la vitesse d’avance rapide selon la compréhension`](./reference/settings.md#adjust-fast-forward-rate-by-comprehension) : **Désactivé**

Pour activer l’annotation d’une piste, modifiez la valeur d’au moins un des paramètres ci-dessus. Certaines annotations peuvent s’afficher uniquement au survol si elles sont [configurées ainsi](./reference/settings.md#only-display-word-color-on-hover).

:::tip
Les boutons [`Reconstruire la base de données de mots Anki`](./reference/settings.md#re-build-anki-word-database) et [`Reconstruire la base de données de mots WaniKani`](./reference/settings.md#re-build-wanikani-word-database) sont désactivés tant que les paramètres ci-dessus n’ont pas de valeurs qui tirent parti de leur intégration.
:::

### Effacer la base de données de mots Anki {#clear-anki-word-database}

Pour effacer les entrées de la base de données de mots Anki d’une piste, videz les valeurs de [`Champs de mots Anki`](./reference/settings.md#anki-word-fields) et de [`Champs de phrases Anki`](./reference/settings.md#anki-sentence-fields), puis cliquez sur [`Reconstruire la base de données de mots Anki`](./reference/settings.md#re-build-anki-word-database). Si le bouton est désactivé, [suivez ces étapes](#enable-or-disable-annotation-for-a-track) pour activer d’abord l’annotation de la piste.

### Effacer la base de données de mots WaniKani {#clear-wanikani-word-database}

Pour effacer les entrées de la base de données de mots WaniKani d’une piste, videz le champ [Jeton API WaniKani](./reference/settings.md#wanikani-api-token), puis cliquez sur [`Reconstruire la base de données de mots WaniKani`](./reference/settings.md#re-build-wanikani-word-database). Si le bouton est désactivé, [suivez ces étapes](#enable-or-disable-annotation-for-a-track) pour activer d’abord l’annotation de la piste.

### Supprimer les mots suivis localement {#delete-locally-tracked-words}

Pour supprimer un mot suivi localement, survolez-le et utilisez les [raccourcis clavier d’annotation](./reference/settings.md#annotation-keyboard-shortcuts) pour définir son statut sur **Non collecté** et désactiver **Ignoré** si cette option était activée.

Pour supprimer plusieurs mots suivis localement à la fois, utilisez le [`Navigateur de mots`](./reference/settings.md#word-browser) pour les marquer comme **Non collectés** et effacer leur statut. Vous pouvez aussi utiliser la fonction [`Importer des mots`](./reference/settings.md#import-words).

### Tous les mots sont non collectés {#everything-is-uncollected}

Si vous avez activé l’annotation par erreur, [suivez ces étapes](#enable-or-disable-annotation-for-a-track) pour la désactiver.

Si le statut des mots reste toujours **Non collecté** :

- Si vous utilisez les statuts locaux, importez des mots dans la base de données locale ou survolez-les et utilisez les [raccourcis clavier d’annotation](./reference/settings.md#annotation-keyboard-shortcuts) pour définir leur statut.
- Si vous utilisez Anki pour déterminer les statuts, vérifiez qu’Anki est ouvert et que l’**URL AnkiConnect** est correcte.
    - Configurez [`Champs de mots Anki`](./reference/settings.md#anki-word-fields) (recommandé) et/ou [`Champs de phrases Anki`](./reference/settings.md#anki-sentence-fields).
    - Lancez [`Reconstruire la base de données de mots Anki`](./reference/settings.md#re-build-anki-word-database).
    - Vous n’avez pas besoin de laisser Anki ouvert une fois la base de données créée, mais le garder ouvert pendant la lecture permet à asbplayer de rester synchronisé.
- Si vous utilisez WaniKani pour déterminer les statuts, vérifiez que votre [`Jeton API WaniKani`](./reference/settings.md#wanikani-api-token) est correct.
    - Lancez [`Reconstruire la base de données de mots WaniKani`](./reference/settings.md#re-build-wanikani-word-database).
    - asbplayer se synchronise automatiquement avec WaniKani pendant la lecture.

### Un barré rouge apparaît {#red-strikethrough-styling-appears}

Si vous avez activé l’annotation par erreur, [suivez ces étapes](#enable-or-disable-annotation-for-a-track) pour la désactiver.

Cela indique une erreur lors du traitement des sous-titres, probablement liée à un problème de connexion à Yomitan. Consultez les messages d’erreur dans la console du navigateur et demandez de l’aide sur le Discord d’asbplayer si vous ne parvenez pas à résoudre le problème.
