---
sidebar_position: 1
---

import project from '@site/src/project';

import NoteAddIcon from '@site/src/components/NoteAddIcon';

# Paramètres {#settings}

## <a href={new URL('?view=settings#anki-settings', project.urls.app).href}>Anki</a> {#anki}

### URL AnkiConnect {#ankiconnect-url}

URL du serveur AnkiConnect exécuté comme module complémentaire dans Anki.

### Clé API AnkiConnect {#ankiconnect-api-key}

Clé API configurée dans AnkiConnect lorsque la protection par clé API est activée.

### Actualiser le navigateur de cartes Anki après la mise à jour des cartes {#refresh-anki-card-browser}

Lorsque cette option est activée, le navigateur de cartes Anki ouvert est actualisé après la mise à jour d’une carte par asbplayer afin d’en afficher les valeurs actuelles. La fenêtre du navigateur de cartes peut alors passer au premier plan. Cette option est désactivée par défaut.

### Paquet {#deck}

Paquet Anki dans lequel les cartes sont envoyées.

### Type de note {#note-type}

Type de note Anki à utiliser pour les cartes. Un type de note définit un « modèle » et une « vue » pour les cartes. Plus précisément, il comprend un ensemble de champs et un modèle HTML qui détermine comment les afficher au recto et au verso de la carte.

### Champs de carte {#card-fields}

Chaque paramètre de champ de carte détermine quel contenu est associé à quel champ du type de note configuré. L’**étiquette du champ** — Sentence, Definition, Word, Image, Audio ou URL — correspond au **contenu**, et la **valeur du champ** correspond au **champ du type de note**.

Les champs apparaissent dans la **boîte de dialogue d’export Anki** dans l’ordre défini dans les paramètres. Vous pouvez modifier cet ordre depuis le **menu ⋮** → **Descendre** ou **Monter**.

| Champ                 | Contenu                                            |
| --------------------- | -------------------------------------------------- |
| Phrase (toutes les pistes) | Tous les sous-titres à l’horodatage extrait        |
| Définition            | Définition du mot fournie par l’utilisateur        |
| Mot                   | Mot fourni par l’utilisateur                       |
| Audio                 | Audio enregistré depuis la source vidéo            |
| Image                 | Capture d’écran de la source vidéo                 |
| Source                | Fichier de sous-titres ou nom et horodatage vidéo |
| URL                   | URL actuelle si la carte vient d’une vidéo en streaming |
| Piste de sous-titres 1 | Sous-titres de la piste 1 à l’horodatage extrait  |
| Piste de sous-titres 2 | Sous-titres de la piste 2 à l’horodatage extrait  |
| Piste de sous-titres 3 | Sous-titres de la piste 3 à l’horodatage extrait  |
| Champs personnalisés  | Valeurs fournies par l’utilisateur                 |

### Tags {#tags}

Tags à ajouter par défaut à chaque carte.

## <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>Mining</a> {#mining}

### Action par défaut du bouton de mining {#mining-button-default-action}

Le « bouton de mining » <NoteAddIcon/> désigne le bouton le plus à gauche de l’**interface superposée** et celui qui apparaît à côté des sous-titres dans la **liste des sous-titres**. Ce paramètre définit l’action de ces boutons.

| Paramètre              | Comportement                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Afficher la boîte de dialogue Anki | Enregistrer le sous-titre cible dans l’historique de mining et afficher la **boîte de dialogue d’export Anki**                                                                                                                               |
| Mettre à jour la dernière carte | Enregistrer le sous-titre cible dans l’historique de mining et mettre à jour la dernière carte du paquet configuré avec tout le contexte fourni par asbplayer, à l’exception de la définition, du mot et des champs personnalisés fournis par l’utilisateur |
| Afficher la boîte de dialogue de mise à jour | Enregistrer le sous-titre cible dans l’historique de mining et afficher la boîte de dialogue pour mettre à jour la dernière carte avec le contexte fourni par asbplayer                                                                                |
| Exporter la carte      | Enregistrer le sous-titre cible dans l’historique de mining et exporter une carte avec _uniquement_ le contexte fourni par asbplayer, à l’exception de la définition, du mot et des champs personnalisés fournis par l’utilisateur                            |
| Aucune                 | Enregistrer le sous-titre cible dans l’historique de mining                                                                                                                                                               |

### État de lecture après le mining {#post-mining-playback-state}

Définit l’état de lecture souhaité après le déclenchement d’une action de mining.

### Copier les sous-titres extraits dans le presse-papiers {#copy-mined-subtitles-to-clipboard}

Lorsque cette option est activée, le sous-titre cible est copié dans le presse-papiers à chaque déclenchement d’une action de mining.

### Toujours utiliser le texte des sous-titres dans le champ Sentence {#always-use-subtitle-text-for-sentence-field}

Lorsque cette option est activée, le champ Sentence contient le texte extrait de toutes les pistes, même si une application externe fournit un texte de phrase différent. Cette option est utile pour [faire du mining avec Yomitan](../guides/one-click-mining.md).

### Lors de la mise à jour de la dernière carte, mettre aussi à jour la phrase des cartes ayant le même texte de sous-titre {#update-sentence-for-cards-with-the-same-subtitle-text}

Lorsque cette option est activée, l’action de minage **Mettre à jour la dernière carte** remplace également le champ Phrase et les champs Piste de sous-titres 1 à 3 configurés dans les notes créées successivement dont la phrase existante correspond à la phrase exportée. La mise à jour tente de préserver les mises en évidence de chaque note. Les champs de piste sans texte exporté restent inchangés. Si un champ de sous-titre partage un champ Anki avec un champ sans sous-titre, comme Définition, la mise à jour de la phrase laisse ce champ inchangé dans les notes précédentes.

Ce paramètre copie la phrase sélectionnée pour l’export actuel. Activez [**Toujours utiliser le texte du sous-titre pour le champ Phrase**](#always-use-subtitle-text-for-sentence-field) pour utiliser le texte complet du sous-titre extrait. La [mise à jour de l’image et de l’audio](#update-all-cards-with-the-same-subtitle-text) est indépendante.

La comparaison utilise le champ Phrase principal, ignore son balisage et accepte qu’une phrase soit contenue dans l’autre. Ainsi, une note qui ne contient que la première ligne peut correspondre à un sous-titre complet. La recherche inclut les notes ajoutées au cours des deux derniers jours Anki et s’arrête dès qu’une phrase est différente ou manquante. Un champ Phrase doit être configuré et la phrase exportée ne doit pas être vide, y compris pour mettre à jour les champs de piste. Cette option est désactivée par défaut et n’affecte pas la mise à jour d’une carte sélectionnée spécifiquement.

### Lors de la mise à jour de la dernière carte, mettre aussi à jour l’image/l’audio des cartes ayant le même texte de sous-titre {#update-all-cards-with-the-same-subtitle-text}

Lorsque cette option est activée, l’action de minage **Mettre à jour la dernière carte** met également à jour les champs audio et image des notes créées successivement à partir de la même ligne de sous-titres. Chaque note précédente conserve son mot, sa définition et ses champs personnalisés. Ses champs de sous-titres restent inchangés, sauf si la [mise à jour de la phrase](#update-sentence-for-cards-with-the-same-subtitle-text) est également activée. La comparaison ignore le balisage de la phrase et accepte que celle-ci fasse partie du contexte du sous-titre extrait.

La recherche inclut les notes ajoutées au cours des deux derniers jours Anki et s’arrête dès qu’une phrase est différente ou manquante. Un champ Phrase doit être configuré et la phrase exportée doit contenir du texte, et pas seulement des espaces ou du balisage. Cette option est désactivée par défaut et n’affecte pas la mise à jour d’une carte sélectionnée spécifiquement.

### Lire l’audio pendant son enregistrement depuis une vidéo locale {#play-audio-while-recording-from-local-video}

asbplayer utilise l’API [MediaRecorder](https://developer.mozilla.org/ja/docs/Web/API/MediaRecorder) intégrée au navigateur pour enregistrer l’audio des fichiers vidéo locaux. Ce paramètre définit si le son est lu pendant l’enregistrement.

### Réencoder l’audio au format mp3 {#re-encode-audio-as-mp3}

Par défaut, l’audio enregistré n’est pas encodé au format `mp3`. Cette option le réencode en `mp3`. Il n’y a généralement aucune raison de désactiver ce paramètre, surtout si vous souhaitez réviser vos cartes sur iOS.

### Marge audio avant le sous-titre {#audio-padding-start}

Nombre de millisecondes **avant** le sous-titre cible auquel commencer l’enregistrement audio.

### Marge audio après le sous-titre {#audio-padding-end}

Nombre de millisecondes **après** le sous-titre cible auquel arrêter l’enregistrement audio.

### Format de capture d’image (site web uniquement) {#image-capture-format}

Définit le format de capture d’image des cartes extraites. Sur le site web, cette option n’est disponible que pour les fichiers vidéo locaux ; le seul format supplémentaire proposé est « extrait vidéo ».

### Largeur/hauteur maximale de capture {#max-capture-dimensions}

Largeur et hauteur maximales des captures d’écran, en pixels. `0` signifie « sans limite ».

### Recadrer les bandes noires des captures d’écran {#trim-black-bars-from-screenshots}

Lorsque cette option est activée, les bandes noires dues au letterboxing sont supprimées des captures d’écran.

### Rogner le début/la fin de l’extrait {#clip-trim-start-end}

Définit la durée à retrancher au début et à la fin de l’intervalle d’un sous-titre pour déterminer l’intervalle par défaut de l’extrait vidéo. Disponible uniquement lorsque le format de capture d’image « extrait vidéo » est sélectionné.

### Durée maximale de l’extrait {#max-clip-length}

Définit la durée maximale de l’extrait vidéo. Disponible uniquement lorsque le format de capture d’image « extrait vidéo » est sélectionné.

### Délai avant la capture d’écran {#screenshot-capture-delay}

Durée à attendre après l’apparition du sous-titre cible avant de prendre la capture d’écran.

### Nombre de sous-titres environnants {#surrounding-subtitles-count-radius}

Le bas de la **boîte de dialogue d’export Anki** comporte un curseur permettant d’ajuster l’intervalle de temps sélectionné. Il ajoute les sous-titres environnants comme contexte. Ce paramètre limite leur nombre.

### Intervalle temporel des sous-titres environnants {#surrounding-subtitles-time-radius}

Le bas de la **boîte de dialogue d’export Anki** comporte un curseur permettant d’ajuster l’intervalle de temps sélectionné. Il ajoute les sous-titres environnants comme contexte. Ce paramètre définit la plage temporelle dans laquelle ces sous-titres peuvent se trouver autour du sous-titre cible.

## <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>Apparence des sous-titres</a> {#subtitle-appearance}

### Piste de sous-titres {#subtitle-appearance-track}

asbplayer peut charger plusieurs pistes de sous-titres simultanément. Ce menu déroulant permet de sélectionner la ou les pistes auxquelles s’appliqueront les paramètres ci-dessous. La sélection par défaut est « Toutes ». Modifier un paramètre d’apparence avec « Toutes » sélectionné le modifie pour toutes les pistes. Dès qu’une valeur spécifique à une piste est définie, le paramètre correspondant disparaît de la page « Toutes ».

### Aperçu des sous-titres {#subtitle-preview}

Prévisualisez et modifiez le texte utilisé pour afficher l’effet des paramètres d’apparence.

### Style {#styling}

| Paramètre                         | Description                                                                          | Propriété CSS               |
| --------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Couleur des sous-titres           | Couleur                                                                               | `color`                     |
| Taille des sous-titres            | Taille en `px`                                                                        | `font-size`                 |
| Épaisseur de la police            | Épaisseur de la police                                                                | `font-weight`               |
| Couleur du contour des sous-titres | Couleur du trait                                                                      | `-webkit-text-stroke-color` |
| Épaisseur du contour des sous-titres | Épaisseur du trait                                                                | `-webkit-text-stroke-width` |
| Couleur de l’ombre                | Couleur de l’ombre                                                                    | `text-shadow`               |
| Épaisseur de l’ombre              | Épaisseur de l’ombre                                                                  | `text-shadow`               |
| Couleur d’arrière-plan des sous-titres | Couleur d’arrière-plan                                                         | `background-color`          |
| Opacité de l’arrière-plan         | Opacité de l’arrière-plan                                                            | `background`                |
| Famille de polices des sous-titres | Police. La liste des polices disponibles apparaît si l’accès aux polices locales est autorisé. | `font-family` |
| CSS:\<style key\>                 | Valeur textuelle d’une propriété CSS personnalisée ajoutée dans le menu **Ajouter un CSS personnalisé**. | Propriété personnalisée |
| Flou des sous-titres              | Applique un flou aux sous-titres. Le survol les rend nets.                           | `filter:blur(...)`          |
| Facteur d’échelle des sous-titres image | Modifie l’échelle des sous-titres sous forme d’image.                          | —                           |

### Mise en page {#layout}

| Paramètre                            | Description                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Alignement des sous-titres            | Place les sous-titres en haut ou en bas de l’élément vidéo.                   |
| Décalage vertical des sous-titres du bas | Distance entre le bas de l’élément vidéo et toutes les pistes de sous-titres du bas. |
| Décalage vertical des sous-titres du haut | Distance entre le haut de l’élément vidéo et toutes les pistes de sous-titres du haut. |
| Largeur des sous-titres                | Largeur du conteneur des sous-titres, en `%` ou en pixels.                    |

## <a href={new URL('?view=settings#keyboard-shortcuts', project.urls.app).href}>Raccourcis clavier</a> {#keyboard-shortcuts}

Les raccourcis clavier permettent d’accéder à la plupart des fonctionnalités d’asbplayer.

### Raccourcis clavier des <a href={new URL('?view=settings#subtitle-appearance', project.urls.app).href}>sous-titres</a> {#subtitles-keyboard-shortcuts}

| Action                               | Raccourci par défaut |
| ------------------------------------ | ---------------- |
| Sélectionner les pistes de sous-titres à charger. | Ctrl + Shift + F |
| Afficher/masquer les sous-titres     | ↓                |
| Afficher/masquer la piste de sous-titres 1 dans la vidéo | 1                |
| Afficher/masquer la piste de sous-titres 2 dans la vidéo | 2                |
| Afficher/masquer la piste de sous-titres 3 dans la vidéo | 3                |
| Afficher/masquer la piste de sous-titres 1 dans asbplayer | W + 1            |
| Afficher/masquer la piste de sous-titres 2 dans asbplayer | W + 2            |
| Afficher/masquer la piste de sous-titres 3 dans asbplayer | W + 3            |
| Retirer le flou de la piste de sous-titres 1 dans asbplayer | B + 1            |
| Retirer le flou de la piste de sous-titres 2 dans asbplayer | B + 2            |
| Retirer le flou de la piste de sous-titres 3 dans asbplayer | B + 3            |
| Déplacer les sous-titres du bas vers le haut |                  |
| Déplacer les sous-titres du bas vers le bas |                  |
| Déplacer les sous-titres du haut vers le haut |                  |
| Déplacer les sous-titres du haut vers le bas |                  |

### Raccourcis clavier de <a href={new URL('?view=settings#mining-settings', project.urls.app).href}>mining</a> {#mining-keyboard-shortcuts}

| Action                                                                               | Raccourci par défaut       |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Extraire le sous-titre actuel                                                                | Ctrl + Shift + Z (website) |
| Extraire le sous-titre actuel and open Anki dialog                                           | Ctrl + Shift + X           |
| Mettre à jour la dernière carte Anki créée avec la capture d’écran, l’audio, etc. capturés par asbplayer        | Ctrl + Shift + U           |
| Exporter la carte dans Anki sans ouvrir la boîte de dialogue.                                               |                            |
| Prendre une capture d’écran manuellement à la place de celle prise automatiquement lors du mining | Ctrl + Shift + V (website) |
| Démarrer/arrêter manuellement l’enregistrement audio, même lorsqu’un fichier de sous-titres est chargé.            | Ctrl + Shift + R (website) |

### Raccourcis clavier de <a href={new URL('?view=settings#playback', project.urls.app).href}>lecture</a> {#playback-keyboard-shortcuts}

| Action                          | Raccourci par défaut |
| ------------------------------- | ---------------- |
| Ouvrir/fermer le panneau latéral               | \`               |
| Lire/mettre en pause                      | Space            |
| Activer/désactiver la pause automatique               | Shift + P        |
| Activer/désactiver la lecture condensée       | Shift + O        |
| Activer/désactiver l’avance rapide    | Shift + F        |
| Activer/désactiver le mode répétition              | Shift + R        |
| Activer/désactiver l’affichage des sous-titres |                  |
| Parcourir les modes de reprise après pause automatique    |                  |
| Passer à la recette suivante   |                  |
| Passer à la recette précédente  |                  |
| Activer/désactiver la recette 1                 |                  |
| Activer/désactiver la recette 2                 |                  |
| Activer/désactiver la recette 3                 |                  |
| Activer/désactiver la recette 4                 |                  |
| Activer/désactiver la recette 5                 |                  |
| Activer/désactiver la recette 6                 |                  |
| Activer/désactiver la recette 7                 |                  |
| Activer/désactiver la recette 8                 |                  |
| Activer/désactiver la recette 9                 |                  |
| Activer/désactiver la recette 10                |                  |

### Raccourcis clavier de <a href={new URL('?view=settings#playback', project.urls.app).href}>déplacement</a> {#seek-keyboard-shortcuts}

| Action                                                                    | Raccourci par défaut |
| ------------------------------------------------------------------------- | ---------------- |
| Reculer (3 secondes par défaut, [configurable](#seek-interval-seconds)) | A                |
| Avancer (3 secondes par défaut, [configurable](#seek-interval-seconds))  | D                |
| Revenir au sous-titre précédent                                                 | ←                |
| Passer au sous-titre suivant                                                     | →                |
| Revenir au début du sous-titre actuel/précédent                            | ↑                |

### Raccourcis clavier de <a href={new URL('?view=settings#playback', project.urls.app).href}>vitesse de lecture</a> {#playback-rate-keyboard-shortcuts}

| Action                 | Raccourci par défaut |
| ---------------------- | ---------------- |
| Augmenter la vitesse de lecture | Ctrl + Shift + ] |
| Réduire la vitesse de lecture | Ctrl + Shift + [ |

### Raccourcis clavier de <a href={new URL('?view=settings#playback', project.urls.app).href}>décalage des sous-titres</a> {#subtitle-offset-keyboard-shortcuts}

| Behavior                                                                 | Default shortcut |
| ------------------------------------------------------------------------ | ---------------- |
| Régler le décalage des sous-titres pour aligner le sous-titre précédent sur l’horodatage actuel | Ctrl + ←         |
| Régler le décalage des sous-titres pour aligner le sous-titre suivant sur l’horodatage actuel     | Ctrl + →         |
| Augmenter le décalage des sous-titres de 100 ms                                         | Ctrl + Shift + ← |
| Réduire le décalage des sous-titres de 100 ms                                         | Ctrl + Shift + → |
| Réinitialiser le décalage des sous-titres                                                    | Ctrl + Shift + ↓ |

### Raccourcis clavier d’<a href={new URL('?view=settings#annotation', project.urls.app).href}>annotation</a> {#annotation-keyboard-shortcuts}

| Behavior                          | Default shortcut |
| --------------------------------- | ---------------- |
| Ouvrir les statistiques                   | Q + S            |
| Passer au mot suivant                 | Q + E            |
| Revenir au mot précédent             | Q + W            |
| Marquer le mot survolé comme Mature       | Q + 5            |
| Passer au mot Mature suivant          |                  |
| Revenir au mot Mature précédent      |                  |
| Marquer le mot survolé comme Young        | Q + 4            |
| Passer au mot Young suivant           |                  |
| Revenir au mot Young précédent       |                  |
| Marquer le mot survolé comme Graduated    | Q + 3            |
| Passer au mot Graduated suivant       |                  |
| Revenir au mot Graduated précédent   |                  |
| Marquer le mot survolé comme Learning     | Q + 2            |
| Passer au mot Learning suivant        |                  |
| Revenir au mot Learning précédent    |                  |
| Marquer le mot survolé comme Unknown      | Q + 1            |
| Passer au mot Unknown suivant         |                  |
| Revenir au mot Unknown précédent     |                  |
| Marquer le mot survolé comme Uncollected  | Q + 0            |
| Passer au mot Uncollected suivant     |                  |
| Revenir au mot Uncollected précédent |                  |
| Marquer le mot survolé comme Ignored    | Q + I            |
| Passer au mot Ignored suivant         |                  |
| Revenir au mot Ignored précédent     |                  |

### Intervalle de déplacement (secondes) {#seek-interval-seconds}

Définit l’intervalle utilisé par les [raccourcis clavier de déplacement](#seek-keyboard-shortcuts).

### Toujours reprendre la lecture avec « Revenir au début du sous-titre actuel/précédent » {#always-play-on-subtitle-seek}

Au lieu de conserver l’état de lecture actuel, la lecture reprend toujours lorsque vous utilisez le [raccourci clavier de déplacement](#seek-keyboard-shortcuts) qui revient au début du sous-titre actuel/précédent. Cela évite d’appuyer sur une touche supplémentaire.

### Incrément de réglage de la vitesse de lecture {#playback-speed-adjust-step}

Incrément utilisé par les [raccourcis clavier](#playback-rate-keyboard-shortcuts) « Augmenter/réduire la vitesse de lecture ».

### Raccourcis de l’extension {#extension-shortcuts}

Lorsque l’extension de navigateur est installée, certains raccourcis de mining (par exemple, extraire le sous-titre actuel ou l’extraire et ouvrir la boîte de dialogue Anki) sont implémentés comme des commandes du navigateur plutôt que comme de simples écouteurs d’événements clavier. Vous ne pouvez les modifier que dans l’éditeur de raccourcis des extensions du navigateur.

- Chrome : `chrome://extensions/shortcuts`
- Firefox : `about:addons` → `Gérer les raccourcis des extensions`

## <a href={new URL('?view=settings#annotation', project.urls.app).href}>Annotation</a> {#annotation}

### Navigateur de mots {#word-browser}

:::info
Seuls les mots locaux peuvent être modifiés ou supprimés. Les sources externes sont en lecture seule et ne peuvent être mises à jour que par [synchronisation](#re-build-anki-word-database).
:::

Ouvre le navigateur de mots, où vous pouvez consulter et gérer tous les mots de votre base de données locale et de la base synchronisée avec Anki.

:::tip
Vous pouvez rechercher des mots dans n’importe quel système d’écriture de la langue (par exemple, romaji, hiragana, katakana ou kanji pour le japonais).

Certaines substitutions courantes sont également effectuées automatiquement, par exemple `e -> é` ou `ss -> ß`.
:::

### Importer des mots {#import-words}

Importe des mots dans la **base de données de mots locale** d’asbplayer.

Les mots importés sont considérés comme locaux et prioritaires sur les sources externes lors de la détermination du statut d’un mot.

La boîte de dialogue d’importation permet de coller du texte quelconque (asbplayer le découpera en mots) et d’importer des fichiers précédemment exportés.

:::tip
Vous pouvez survoler les mots et utiliser les [raccourcis clavier d’annotation](#annotation-keyboard-shortcuts) pour modifier leur statut localement.
:::

### Exporter des mots {#export-words}

Exporte votre base de données de mots locale afin de la sauvegarder, de la transférer vers un autre appareil ou de la partager entre le site web et l’extension.

### Reconstruire la base de données de mots Anki {#re-build-anki-word-database}

Crée ou reconstruit le cache local des statuts de mots provenant d’Anki.

:::tip
Le cache est également mis à jour automatiquement pendant la lecture lorsqu’une piste est activée et qu’Anki est accessible.

Ce bouton est désactivé sauf si vos paramètres d’annotation [tirent parti de l’intégration à Anki](../common-issues.md#enable-or-disable-annotation-for-a-track).

Pour effacer les entrées Anki de la base de données de mots d’une piste, [suivez ces étapes](../common-issues.md#clear-anki-word-database).
:::

### Reconstruire la base de données de mots WaniKani {#re-build-wanikani-word-database}

Crée ou reconstruit le cache local du vocabulaire provenant de WaniKani.

:::tip
Le cache est également mis à jour automatiquement pendant la lecture lorsqu’une piste est activée et qu’un jeton est configuré.

Ce bouton est désactivé sauf si vos paramètres d’annotation [tirent parti de l’intégration à WaniKani](../common-issues.md#enable-or-disable-annotation-for-a-track).

Pour effacer les entrées WaniKani de la base de données de mots d’une piste, [suivez ces étapes](../common-issues.md#clear-wanikani-word-database).
:::

### Piste de sous-titres {#annotation-track}

Sélectionne la piste de sous-titres à laquelle s’appliquent ces paramètres d’annotation.

### Colorer les sous-titres selon les mots connus {#colorize-subtitles-based-on-known-words}

Active la mise en forme des mots selon leur statut (non collecté, inconnu, en cours d’apprentissage, etc.). Elle utilise le [**style de couleur des mots**](#word-color-style) et les [**couleurs des statuts de mots**](#word-status-colors) configurés.

### Générer automatiquement les statistiques {#generate-statistics-automatically}

Génère automatiquement les statistiques du média actuel lors de son chargement. Cela active également la superposition des statistiques. Le [raccourci clavier Ouvrir les statistiques](#annotation-keyboard-shortcuts) figure dans le groupe Annotation.

### Afficher la lecture des mots {#display-word-readings}

Affiche au-dessus des mots leur lecture (par exemple, les furigana) selon leur statut et leur état.

### Afficher la fréquence des mots {#display-word-frequency}

Affiche sous les mots une valeur de fréquence basée sur leur rang (si disponible) selon leur statut et leur état. Cela permet de déterminer quels mots méritent d’être appris en priorité.

:::tip
Les informations de fréquence nécessitent au moins un dictionnaire de fréquence basé sur le rang dans votre instance Yomitan. Si un dictionnaire de fréquence ne précise pas son mode, asbplayer essaie de déterminer s’il est basé sur le rang et l’utilise en conséquence.

Si plusieurs fréquences sont disponibles pour un mot, la valeur la plus basse (la plus fréquente) est utilisée.
:::

### Afficher l’accent tonal (japonais) {#display-pitch-accent-japanese}

:::note
Pour afficher l’accent tonal sur les furigana, activez [**Afficher la lecture des mots**](#display-word-readings).
:::

Affiche l’accent tonal sur les furigana ou sur les kana eux-mêmes, selon le statut et l’état des mots.

:::info
L’accent tonal de la particule attachée à un mot est déterminé par celui du mot, si les données sont disponibles.

En règle générale, seuls les kanji reçoivent des furigana. Avec cette option, tous les caractères d’un mot en reçoivent si au moins l’un d’eux est un kanji. Cela facilite la lecture de l’accent tonal dans les mots composés.
:::

### Afficher les définitions des mots {#display-word-definitions}

Détermine si de courtes définitions ou explications sont affichées pour chaque mot selon son statut et son état.

### Stratégie de recherche dans les champs de mots {#word-field-search-strategy}

Détermine comment asbplayer compare les mots des sous-titres à vos mots connus.

- **Forme exacte collectée** : le champ doit contenir la forme exacte du mot dans le sous-titre (running -> running).
- **Lemme collecté** : le lemme ou la forme de base doit être collecté (running -> run).
- **Lemme ou forme exacte collecté** : le mot est considéré comme collecté si le lemme ou la forme exacte correspond (l’un des cas ci-dessus).
- **N’importe quelle forme collectée** : le mot est considéré comme collecté si l’une de ses formes associées correspond (running -> run, ran, runs, etc.).

Lorsque **Lemme collecté**, **Lemme ou forme exacte collecté** ou **N’importe quelle forme collectée** est sélectionné, [**Correspondance entre les systèmes d’écriture**](#match-across-language-scripts) détermine si la recherche par lemme peut utiliser différents systèmes d’écriture d’une même langue (par exemple, kanji, hiragana ou katakana).

### Priorité de sélection des cartes {#card-choice-priority}

Si plusieurs cartes Anki correspondent à un mot, ce paramètre détermine quelle carte est utilisée pour définir son statut :

- **Le champ contient la forme exacte** (en cas de plusieurs cartes, utiliser la meilleure carte connue)
- **Le champ contient le lemme** (en cas de plusieurs cartes, utiliser la meilleure carte connue)
- **Meilleure carte connue**
- **Carte la moins connue**

### Stratégie de recherche dans les champs de phrases {#sentence-field-search-strategy}

Détermine comment asbplayer recherche dans vos [**champs de phrases Anki**](#anki-sentence-fields). Les options sont les mêmes que pour la [**stratégie de recherche dans les champs de mots**](#word-field-search-strategy).

Lorsque **Lemme collecté**, **Lemme ou forme exacte collecté** ou **N’importe quelle forme collectée** est sélectionné, [**Correspondance entre les systèmes d’écriture**](#match-across-language-scripts) détermine si la recherche par lemme peut utiliser différents systèmes d’écriture d’une même langue (par exemple, kanji, hiragana ou katakana).

:::tip
Comme une phrase contient plusieurs mots et que le statut de la carte est donc moins pertinent pour chacun d’eux, il est préférable de conserver **Forme exacte collectée**, sauf si vous n’avez que des cartes de phrases.
:::

### Correspondance entre systèmes d’écriture {#match-across-language-scripts}

Détermine si la recherche par lemme peut utiliser différents systèmes d’écriture d’une même langue (par exemple, kanji, hiragana ou katakana).

```
if true:
  - Kana subtitles can match kanji in collection, could be homophones but text processing can't handle it so we allow it.
  - Kanji subtitles only match with kanji in collection, prevents kana collected matches all kanji homophones.
if false:
  - Never match across scripts, downside is if kanji is collected kana will need to be collected too.
  - Essentially a strict mode where the you need to collect all script forms of a word.
```

### URL de l’API Yomitan {#yomitan-api-url}

URL du point de terminaison de l’API Yomitan. Si l’URL est invalide ou inaccessible, asbplayer affiche une erreur.

:::tip
Vous devez disposer d’une instance [Yomitan](https://yomitan.wiki/) configurée ainsi que de [yomitan-api](https://github.com/yomidevs/yomitan-api).
:::

### Analyseur Yomitan {#yomitan-parser}

Sélectionne l’analyseur Yomitan utilisé pour découper le texte des sous-titres en mots :

- **Analyseur de balayage (toutes les langues)** : analyseur interne de Yomitan qui recherche les mots les plus longs dans vos dictionnaires.
- **MeCab (japonais)** : utilise MeCab pour analyser le texte japonais. Nécessite une configuration de Yomitan prenant en charge MeCab, de préférence avec au moins un dictionnaire UniDic.

### Longueur maximale des mots {#max-word-length}

:::info
Ce paramètre s’applique uniquement à l’analyseur de balayage.
:::

Limite la longueur maximale des mots qu’asbplayer essaiera de repérer et de segmenter pour l’annotation.

:::tip
Une valeur trop faible empêchera de repérer les mots longs ; une valeur trop élevée peut entraîner des problèmes de performances.
:::

### Paquets Anki (facultatif) {#anki-decks}

Limite les recherches Anki aux paquets sélectionnés. Si la liste est vide, asbplayer recherche dans tous les paquets.

### Champs de mots Anki {#anki-word-fields}

Champs des notes Anki qui contiennent _uniquement_ le mot cible. C’est la méthode recommandée pour obtenir d’Anki les informations sur le statut des mots connus.

### Champs de phrases Anki {#anki-sentence-fields}

Champs des notes Anki qui contiennent une phrase (couramment utilisés pour les paquets de phrases). Ils servent de solution de repli si aucune carte ne contient le mot cible dans les [**champs de mots Anki**](#anki-word-fields).

### Stabilité/intervalle Anki pour le statut Mature (jours) {#mature-anki-stability-interval}

Définit le seuil (en jours) à partir duquel une carte Anki est considérée comme **Mature** plutôt que comme ayant un statut de maturité inférieur.

- **Non collecté** : introuvable dans Anki.
- **Inconnu** : trouvé dans Anki avec `is:new`.
- **En cours d’apprentissage** : trouvé dans Anki avec `is:learn`.
- **Étape franchie** : trouvé dans Anki avec `-is:new -is:learn prop:s<{ceil(cutoff / 2)}`.
- **Jeune** : trouvé dans Anki avec `-is:new -is:learn prop:s>=${ceil(cutoff / 2)} prop:s<${cutoff}`.
- **Mature** : trouvé dans Anki avec `-is:new -is:learn prop:s>=${cutoff}`.

:::tip
Si la stabilité FSRS d’une carte est disponible (sa dernière révision a été effectuée avec FSRS activé), elle est utilisée à la place de l’intervalle.

Pour en savoir plus sur les statuts des mots, consultez [**Couleurs des statuts de mots**](#word-status-colors).
:::

### Traiter les cartes Anki suspendues comme {#treat-suspended-anki-cards-as}

Détermine comment les cartes **suspendues** sont traitées lors de la création des statuts de mots depuis Anki :

- **Normal** : utiliser le statut Anki tel quel.
- Ou choisissez un statut de mot précis (par exemple **Mature**, **Inconnu**, etc.) pour attribuer ce statut aux cartes suspendues.

:::tip
Si seules certaines cartes d’un mot sont suspendues, elles sont exclues et le statut du mot est déterminé à partir des cartes non suspendues.

Pour en savoir plus sur les statuts des mots, consultez [**Couleurs des statuts de mots**](#word-status-colors).
:::

### Jeton API WaniKani {#wanikani-api-token}

Utilisez le jeton API WaniKani pour synchroniser vos mots connus depuis WaniKani. Pour le configurer, suivez les instructions du [guide sur les annotations](../guides/annotation.md#setup).

asbplayer utilise uniquement les types de sujets `vocabulary` et `kana_vocabulary` pour déterminer les mots connus. Les statuts sont calculés à partir du niveau SRS défini pour le sujet dans le [système de répétition espacée](https://docs.api.wanikani.com/20170710/#spaced-repetition-system) configuré. WaniKani détermine les statuts comme suit :

- **Non collecté** : introuvable dans WaniKani.
- **Inconnu** : trouvé dans WaniKani avec un niveau SRS inférieur à `Starting stage`.
- **En cours d’apprentissage** : trouvé dans WaniKani avec un niveau SRS égal ou supérieur à `Starting stage` et inférieur à `Passing stage`.
- **Étape franchie** : trouvé dans WaniKani avec un niveau SRS dans la moitié inférieure des niveaux entre `Passing stage` et `Burning stage`.
- **Jeune** : trouvé dans WaniKani avec un niveau SRS dans la moitié supérieure des niveaux entre `Passing stage` et `Burning stage`.
- **Mature** : trouvé dans WaniKani avec un niveau SRS égal ou supérieur à `Burning stage`.

:::tip
Pour en savoir plus sur les statuts des mots, consultez [**Couleurs des statuts de mots**](#word-status-colors).
:::

### Style de couleur des mots {#word-color-style}

Détermine comment les couleurs des statuts sont appliquées aux mots par [**Colorer les sous-titres selon les mots connus**](#colorize-subtitles-based-on-known-words) :

- **Texte** : modifie la couleur du mot.
- **Arrière-plan** : modifie la couleur derrière le mot.
- **Soulignement** : souligne le mot avec la couleur du statut.
- **Surlignement supérieur** : trace une ligne au-dessus du mot avec la couleur du statut.
- **Contour** : ajoute un contour autour du mot avec la couleur du statut.

:::tip
Avec **Contour**, vous devrez peut-être régler l’[**épaisseur du contour des sous-titres**](#subtitle-appearance-track) sur `0` pour obtenir le meilleur résultat.
:::

### Épaisseur {#thickness}

Définit l’épaisseur (en pixels) des styles **Soulignement**, **Surlignement supérieur** et **Contour**.

### Mettre les mots en évidence au survol {#highlight-words-on-hover}

:::info
Cette mise en évidence indique quel élément est actif pour recevoir les raccourcis clavier d’asbplayer. Si elle n’apparaît pas, cliquez sur le lecteur pour lui donner le focus. Selon l’élément actif, les raccourcis clavier ne fonctionnent que sur la vidéo ou sur la liste des sous-titres, mais pas sur les deux à la fois.

Cette mise en évidence sert principalement à vous indiquer quel mot vous survolez afin de le collecter. La cible du survol doit donc être un mot et la coloration doit être activée.
:::

Lorsque cette option est activée, le survol d’un mot le met en évidence et vous permet de voir comment Yomitan l’a segmenté.

### Afficher la couleur des mots uniquement au survol {#only-display-word-color-on-hover}

:::note
Ce paramètre s’applique uniquement si [**Colorer les sous-titres selon les mots connus**](#colorize-subtitles-based-on-known-words) est activé.
:::

Si cette option est activée pour la vidéo ou la liste des sous-titres, les couleurs des mots sont masquées par défaut et ne s’affichent que lorsque vous survolez le texte correspondant.

### Afficher la lecture des mots uniquement au survol {#only-display-word-reading-on-hover}

:::note
Ce paramètre s’applique uniquement si [**Afficher la lecture des mots**](#display-word-readings) est activé.
:::

Si cette option est activée pour la vidéo ou la liste des sous-titres, les lectures des mots sont masquées par défaut et ne s’affichent que lorsque vous survolez le texte correspondant.

### Afficher la fréquence des mots uniquement au survol {#only-display-word-frequency-on-hover}

:::note
Ce paramètre s’applique uniquement si [**Afficher la fréquence des mots**](#display-word-frequency) est activé.
:::

Si cette option est activée pour la vidéo ou la liste des sous-titres, les fréquences des mots sont masquées par défaut et ne s’affichent que lorsque vous survolez le texte correspondant.

### Afficher les définitions des mots uniquement au survol {#only-display-word-definitions-on-hover}

:::note
Ce paramètre s’applique uniquement si [**Afficher les définitions des mots**](#display-word-definitions) est activé.
:::

Si cette option est activée pour la vidéo ou la liste des sous-titres, les définitions des mots sont masquées par défaut et ne s’affichent que lorsque vous survolez le texte correspondant.

### Afficher l’accent tonal uniquement au survol {#only-display-pitch-accent-on-hover}

:::note
Ce paramètre s’applique uniquement si [**Afficher l’accent tonal (japonais)**](#display-pitch-accent-japanese) est activé.
:::

Si cette option est activée pour la vidéo ou la liste des sous-titres, l’accent tonal est masqué par défaut et ne s’affiche que lorsque vous survolez le texte correspondant.

### Taille de la lecture des mots {#word-reading-size}

Définit la taille des lectures (furigana) en unités em (% de la taille de la police des sous-titres).

### Taille de la fréquence des mots {#word-frequency-size}

Définit la taille de la fréquence des mots en unités em (% de la taille de la police des sous-titres).

### Taille des définitions des mots {#word-definition-size}

Définit la taille des définitions des mots en unités em (% de la taille de la police des sous-titres).

### Taille de l’accent tonal {#pitch-accent-size}

Définit la taille de l’accent tonal en unités em (% de la taille de la police des sous-titres).

### Couleurs des statuts des mots {#word-status-colors}

Chaque statut possède une couleur et une transparence configurables, utilisées par le [**style de couleur des mots**](#word-color-style), qui peuvent être activées ou désactivées individuellement.

- **Non collecté** : le mot ne figure pas dans votre base de données asbplayer.
- **Inconnu** : le mot figure dans la base, mais est considéré comme inconnu.
- **En cours d’apprentissage** : le mot est en cours d’apprentissage.
- **Étape franchie** : l’apprentissage du mot est terminé.
- **Jeune** : le mot est connu, mais pas encore mature.
- **Mature** : le mot est bien connu (mature).

:::tip
Vous pouvez désactiver les styles de statut selon vos préférences, par exemple désactiver **Mature** pour alléger l’affichage.

Vous pouvez réutiliser les couleurs (par exemple pour **Étape franchie** et **Jeune**) si vous ne souhaitez pas distinguer certains statuts.

Pour savoir comment les statuts des cartes Anki sont déterminés, consultez [**Stabilité/intervalle Anki pour le statut Mature (jours)**](#mature-anki-stability-interval).
Pour savoir comment les statuts WaniKani sont déterminés, consultez [**Jeton API WaniKani**](#wanikani-api-token).
:::

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Lecture</a> {#playback}

### Pistes de sous-titres concernées par les modes de lecture et les raccourcis clavier {#playback-subtitle-tracks}

Définit les pistes prises en compte lors de l’utilisation des raccourcis clavier des [sous-titres](#subtitles-keyboard-shortcuts) et du [déplacement](#seek-keyboard-shortcuts), ou des modes de lecture. Par exemple, lorsque la lecture condensée est activée, les passages ignorés automatiquement correspondent aux portions de la chronologie sans sous-titres sur les pistes sélectionnées ici.

### Mettre en pause au survol des sous-titres {#auto-pause-when-mousing-over-subtitles}

Définit le comportement de la pause automatique lorsque vous survolez les sous-titres. « Activée avec reprise automatique » signifie que la lecture reprend automatiquement lorsque vous éloignez le pointeur des sous-titres.

### Modes de lecture {#playback-modes}

Vous pouvez activer ou désactiver les modes de lecture avec les [raccourcis clavier de lecture](#playback-keyboard-shortcuts).

### Vitesse de lecture {#playback-rate}

Définit la vitesse normale du média, y compris celle utilisée pendant les sous-titres lorsque l’avance rapide est activée. Toute nouvelle lecture commence à cette vitesse. Utilisez les [raccourcis clavier de vitesse de lecture](#playback-rate-keyboard-shortcuts) pour la régler pendant le visionnage.

### Afficher une notification de vitesse de lecture {#show-playback-rate-notification}

Affiche une notification lorsque la vitesse de lecture change en dehors du mode avance rapide.

### Préférence de pause automatique {#auto-pause-preference}

Lorsque la pause automatique est activée, détermine si la lecture se met en pause au début, à la fin ou aux deux extrémités des sous-titres. Si les deux extrémités et la répétition sont activées, la lecture se met en pause à la fin avant de répéter le sous-titre, mais ignore la pause au début pour éviter une double pause.

### Nombre de répétitions {#repeat-count-preference}

Définit le nombre de répétitions de chaque sous-titre avant la reprise de la lecture. La valeur `0` entraîne une répétition indéfinie.

### Répétitions avant l’affichage des sous-titres {#repeats-before-showing-subtitles}

Masque les sous-titres d’un passage répété jusqu’au nombre de répétitions indiqué. `0` ne les masque jamais ; `1` les affiche dès la première répétition.

### Décalages de début et de fin des déclencheurs de sous-titres {#subtitle-trigger-start-and-end-offsets}

Décale en millisecondes les déclencheurs de début et de fin des sous-titres utilisés par la pause automatique et la répétition. Ces décalages sont appliqués après le décalage global des sous-titres. Les décalages de début et de fin se règlent séparément ; les valeurs positives retardent les actions de lecture et les valeurs négatives les avancent. Chaque extrémité décalée est limitée par les bords du média et les événements de sous-titres voisins. Si le début et la fin décalés se croisent, leur ordre chronologique est inversé.

### Intervalle minimal d’avance rapide {#fast-forward-minimum-skip-interval}

Accélère la lecture pendant toute la durée séparant deux sous-titres lorsque cet intervalle atteint cette valeur. Les intervalles plus courts restent à la vitesse normale.

### Vitesse de lecture en avance rapide {#fast-forward-playback-rate}

Définit la vitesse de lecture lorsque le mode avance rapide est activé.

### Intervalle minimal à ignorer en lecture condensée {#condensed-playback-minimum-skip-interval}

Lorsque la lecture condensée est activée, passe au sous-titre suivant uniquement si celui-ci commence au moins après cet intervalle.

### Décalages de début et de fin des déclencheurs de silence entre les sous-titres {#subtitle-gap-trigger-start-and-end-offsets}

Décale les déclencheurs de silence utilisés par l’avance rapide et la lecture condensée. Le décalage du début du silence est positif ou nul et retarde le déclencheur après la fin du sous-titre ; celui de la fin est négatif ou nul et avance le déclencheur avant le sous-titre suivant. Chaque silence est limité par les bords du média et les événements de sous-titres voisins.

### Mode de reprise après pause automatique {#auto-pause-resume-mode}

Détermine comment se termine une pause automatique.

- **Manuelle** : la lecture reste en pause jusqu’à ce que vous la repreniez.

- **Durée fixe** : chaque pause automatique dure le même temps, défini dans les paramètres.
  - Définit la [durée de pause fixe](#fixed-pause-duration) et le [délai de reprise après pause automatique](#resume-delay-after-auto-pause).

- **Durée du sous-titre** : la durée de la pause est calculée à partir du nombre de caractères du sous-titre. Seuls les sous-titres des pistes navigables sont comptabilisés ; une piste de traduction chargée avec la langue cible n’allonge donc pas la pause.
  - Définit la [durée minimale de pause](#minimum-pause-duration), la [durée maximale de pause](#maximum-pause-duration), le [temps de pause par caractère](#pause-time-per-character) et le [délai de reprise après pause automatique](#resume-delay-after-auto-pause).

### Durée de pause fixe {#fixed-pause-duration}

Durée d’une pause automatique en mode **Durée fixe**.

### Durée minimale de pause {#minimum-pause-duration}

Durée de pause la plus courte autorisée en mode **Durée du sous-titre**, quel que soit le nombre de caractères.

### Durée maximale de pause {#maximum-pause-duration}

Durée de pause la plus longue autorisée en mode **Durée du sous-titre**. La valeur `0` signifie qu’il n’y a pas de limite supérieure. Une valeur maximale non nulle ne peut pas être inférieure à la durée minimale de pause.

### Temps de pause par caractère {#pause-time-per-character}

Nombre de millisecondes attribué à chaque caractère en mode **Durée du sous-titre**. Le produit du nombre de caractères par cette valeur est limité aux durées minimale et maximale de pause.

### Délai de reprise après pause automatique {#resume-delay-after-auto-pause}

En modes **Durée fixe** et **Durée du sous-titre**, la pause automatique se déroule en deux temps : le sous-titre est affiché pendant la durée configurée, puis masqué pendant que la lecture reste en pause durant le délai de reprise. Ce paramètre définit la durée de cette deuxième phase.

### Afficher les sous-titres {#show-subtitles}

- **Pendant leur durée** : les sous-titres s’affichent pendant leur intervalle de temps.

- **Pendant la pause** : les sous-titres s’affichent uniquement pendant leur intervalle de temps et lorsque la lecture est en pause.

- **Pendant une pause manuelle** : les sous-titres s’affichent uniquement pendant leur intervalle de temps et lorsque la lecture est mise en pause manuellement.

## <a href={new URL('?view=settings#playback', project.urls.app).href}>Lecture > Annotation</a> {#playback-annotation}

Ces paramètres utilisent les statuts, les états et les fréquences des mots de la section [Annotation](#annotation) pour la piste de sous-titres sélectionnée. Les règles de pause automatique, de lecture condensée, d’avance rapide et de répétition s’appliquent lorsque leur mode de lecture est activé. **Aucun filtre de mots** signifie qu’aucun statut ni état n’est sélectionné pour cette piste. Les règles s’appliquent piste par piste : une piste navigable sans statut ni état sélectionné pour un mode conserve le comportement habituel de ce mode, même si elle est lue avec une piste qui a des règles.

### Piste de sous-titres {#playback-annotation-track}

Sélectionne la piste dont vous modifiez les paramètres de lecture des annotations. La piste sélectionnée est également utilisée dans l’onglet Annotation.

### Sélectionner le premier mot correspondant lors d’une pause {#select-first-matching-word-on-pause}

Sélectionne le premier mot correspondant à un statut ou à un état choisi chaque fois que la lecture se met en pause, y compris lors d’une pause manuelle et après un déplacement pendant une pause. Ne sélectionnez rien pour désactiver ce comportement. La sélection se fait dans le lecteur vidéo, ou dans le lecteur de sous-titres si aucune vidéo n’est chargée ou connectée.

Si une [règle de pause automatique basée sur les annotations](#auto-pause-subtitles-containing-these-words) déclenche la pause, le mot correspondant à cette règle est sélectionné à la place. Ce menu déroulant continue de contrôler la sélection lors des pauses manuelles.

Chacune des règles de mots ci-dessous possède sa propre sélection de statuts et d’états, ainsi que ses propres limites de nombre de mots et de fréquence. Un mot doit avoir un statut ou un état sélectionné et respecter les deux limites.

### Mettre en pause les sous-titres contenant ces mots {#auto-pause-subtitles-containing-these-words}

Lorsque la pause automatique est activée, met en pause uniquement les sous-titres contenant un mot correspondant et sélectionne le premier mot correspondant. Pour les pauses automatiques, cette règle est prioritaire sur [**Sélectionner le premier mot correspondant lors d’une pause**](#select-first-matching-word-on-pause) ; ce menu déroulant s’applique toujours aux pauses manuelles.

### Répéter les sous-titres contenant ces mots {#repeat-subtitles-containing-these-words}

Lorsque le mode répétition est activé, seuls les sous-titres contenant un mot correspondant sont répétés.

### Lire les sous-titres contenant ces mots en mode condensé {#play-subtitles-containing-these-words-in-condensed-mode}

Lorsque la lecture condensée est activée, conserve dans la chronologie condensée les sous-titres contenant un mot correspondant. Les autres sous-titres sont ignorés.

### Lire à vitesse normale en mode avance rapide les sous-titres contenant ces mots {#play-subtitles-containing-these-words-at-normal-speed-in-fast-forward-mode}

Lorsque l’avance rapide est activée, lit à vitesse normale les sous-titres contenant un mot correspondant. Les autres sous-titres sont lus en accéléré.

### Adapter la vitesse d’avance rapide selon la compréhension {#adjust-fast-forward-rate-by-comprehension}

Lorsque l’avance rapide est activée, utilise le score de compréhension de la phrase pour déterminer la vitesse de lecture de chaque sous-titre.

À la valeur [**Compréhension minimale**](#minimum-comprehension) ou en dessous, la lecture se fait à vitesse normale ; à 100 %, elle se fait à la vitesse d’avance rapide configurée. Les valeurs intermédiaires sont interpolées.

Modifier la vitesse d’un sous-titre dont la lecture dépend de la compréhension modifie la vitesse d’avance rapide configurée, puis recalcule la vitesse appliquée selon la compréhension. Cela s’applique également lorsque le sous-titre reste à vitesse normale en raison de sa compréhension. Les raccourcis clavier et les commandes de vitesse du lecteur ont le même effet ; la vitesse normale reste inchangée.

### Compréhension minimale {#minimum-comprehension}

Définit le pourcentage à partir duquel l’accélération commence (de 0 à 99 %, 60 % par défaut).

### Afficher ces mots pendant la lecture {#show-these-words-during-playback}

Sélectionne les statuts et les états des mots à laisser visibles.

### Masquer tout le sous-titre lorsque ce pourcentage de mots serait masqué {#whole-subtitle-hidden-percentage}

Masque le sous-titre entier lorsque la règle d’affichage masquerait au moins ce pourcentage de ses mots. Par exemple, à **80 %**, si quatre mots sur cinq sont masqués, tout le sous-titre l’est, y compris le mot sélectionné pour être affiché. La ponctuation et les autres caractères non alphabétiques ne sont pas comptabilisés.

### Masquer individuellement les mots non correspondants {#hide-non-matching-words-individually}

Lorsque cette option est activée, les mots qui ne respectent pas la règle d’affichage sont masqués individuellement tant que le sous-titre reste en dessous du seuil de masquage complet. Lorsqu’elle est désactivée, le sous-titre reste entièrement visible jusqu’à ce que ce seuil soit atteint.

### Nombre minimal de mots par catégorie sélectionnée {#minimum-words-per-selected-category}

Chaque catégorie sélectionnée (par exemple **Non collecté** ou **Ignoré**) est comptabilisée séparément dans un sous-titre. Si le nombre de mots de cette catégorie est inférieur à cette limite, ils ne déclenchent pas la règle. `0` désactive la limite.

### Nombre maximal de mots par catégorie sélectionnée {#maximum-words-per-selected-category}

Chaque catégorie sélectionnée (par exemple **Non collecté** ou **Ignoré**) est comptabilisée séparément dans un sous-titre. Si le nombre de mots de cette catégorie dépasse cette limite, ils ne déclenchent pas la règle. `0` désactive la limite.

### Uniquement si la fréquence du mot est au moins égale à {#only-when-word-frequency-is-at-least}

Un mot correspondant doit avoir une fréquence supérieure ou égale à cette valeur. Une fréquence manquante compte comme `1`. `0` désactive la limite.

### Uniquement si la fréquence du mot est au plus égale à {#only-when-word-frequency-is-at-most}

Un mot correspondant doit avoir une fréquence inférieure ou égale à cette valeur. Une fréquence manquante compte comme `1`. `0` désactive la limite.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Vidéo en streaming</a> (extension uniquement) {#streaming-video}

Les paramètres de vidéo en streaming ne sont disponibles que si l’extension de navigateur est installée.

### Ouvrir également la liste des sous-titres dans un nouvel onglet de l’application lors de leur chargement {#open-subtitle-list-in-tab}

Chaque fois que des sous-titres sont chargés dans un élément vidéo, le site web s’ouvre dans un nouvel onglet et les sous-titres chargés y sont synchronisés.

### URL de l’application {#app-url}

Détermine où l’extension récupère certains paramètres et quelle URL ouvrir pour synchroniser les sous-titres avec le site web dans un autre onglet. Il s’agit essentiellement de l’URL du site web.

### Activer la superposition des commandes {#enable-controls-overlay}

Affiche l’interface superposée sur les éléments vidéo contenant des sous-titres chargés.

### Afficher les sous-titres {#display-subtitles}

Affiche les sous-titres chargés sur les éléments vidéo.

### Enregistrer l’audio pendant le mining {#record-audio-when-mining}

Lors du mining d’un sous-titre, enregistre l’audio correspondant pour l’inclure dans la carte mémoire.

### Prendre une capture d’écran pendant le mining {#take-screenshot-when-mining}

Lors du mining d’un sous-titre, prend une capture d’écran à inclure dans la carte mémoire.

### Nettoyer la capture d’écran pendant le mining {#clean-screenshot-when-mining}

Lorsque les captures d’écran sont activées, supprime les éléments HTML superposés à la vidéo avant de prendre la capture d’écran d’un sous-titre extrait.

### Recadrer la capture d’écran pendant le mining {#crop-screenshot-when-mining}

Recadre la capture d’écran sur l’élément vidéo lors du mining d’un sous-titre.

### Format de capture d’image {#streaming-image-capture-format}

Définit le format de capture d’image des cartes extraites de vidéos en streaming. L’option supplémentaire « WebP animé » capture la vidéo lue dans l’onglet pendant l’intervalle du sous-titre, marges audio incluses, et l’enregistre sous forme d’image animée au lieu d’une capture unique.

Le WebP animé est utilisé uniquement si l’[enregistrement audio pendant le mining](#record-audio-when-mining) est activé ; sinon, une capture d’écran est prise comme d’habitude. Il s’applique à toutes les méthodes de mining qui enregistrent des médias, y compris l’enregistrement manuel démarré et arrêté avec le raccourci clavier correspondant. Celui-ci capture tout jusqu’à l’arrêt de l’enregistrement (30 secondes maximum). Un seul enregistrement peut être effectué à la fois. Le WebP animé n’est pas disponible dans Firefox et les vidéos protégées par DRM ne peuvent pas être capturées. L’onglet doit rester visible pendant la capture du clip, car Chrome cesse d’afficher les onglets masqués.

### Images par seconde des images animées {#animated-image-fps}

Nombre d’images par seconde à capturer pour les images WebP animées. Les clips longs utilisent automatiquement moins d’images afin de limiter la taille de la carte. Disponible uniquement lorsque le format de capture d’image WebP animé est sélectionné.

### Qualité des images animées {#animated-image-quality}

Qualité de chaque image d’un WebP animé, de `0.1` à `1`. Une valeur élevée améliore la qualité visuelle, mais produit un fichier plus volumineux. Disponible uniquement lorsque le format de capture d’image WebP animé est sélectionné.

### Autoriser le glisser-déposer des fichiers de sous-titres {#allow-subtitle-file-drag-and-drop}

Autorise le glisser-déposer de fichiers de sous-titres sur les éléments vidéo.

### Charger automatiquement les sous-titres détectés {#auto-load-detected-subtitles}

Si la détection automatique des sous-titres est prise en charge sur le site web actuel, les charge automatiquement. Si plusieurs pistes sont détectées, charge celle dans la langue préférée. Il s’agit de la langue de la dernière piste chargée avec la case « Mémoriser ces choix de pistes » cochée.

### Demander confirmation en cas d’échec du chargement automatique des sous-titres détectés {#prompt-on-subtitle-autoload-failure}

Lorsque le chargement automatique des sous-titres échoue, demande confirmation avant d’essayer de charger les sous-titres détectés.

## <a href={new URL('?view=settings#streaming-video', project.urls.app).href}>Vidéo en streaming > Pages</a> {#pages}

Paramètres des intégrations propres à certaines pages, comme YouTube ou Netflix. asbplayer utilise des paramètres par défaut préconfigurés pour chaque page ; la section Pages permet de les modifier.

### Codes des langues cibles pour la traduction automatique (YouTube uniquement) {#youtube-translation-languages}

Définit les langues cibles utilisées pour la traduction automatique de YouTube. Les langues indiquées ici apparaissent sous forme de pistes supplémentaires dans le sélecteur de pistes de sous-titres.

## <a href={new URL('?view=settings#misc-settings', project.urls.app).href}>Divers</a> {#misc}

### Importer/exporter les paramètres {#import-export-settings}

Importe ou exporte les paramètres dans un fichier `json`.

### Thème {#theme}

Affiche asbplayer avec un thème clair ou sombre.

### Langue {#language}

Langue d’affichage de l’interface.

Remarque : toutes les chaînes ne sont pas traduites dans toutes les langues prises en charge par asbplayer. Les chaînes non traduites s’affichent en anglais. Vous pouvez contribuer à la traduction sur le [projet Crowdin](https://crowdin.com/project/asbplayer).

### Agrandir automatiquement les vidéos locales {#auto-maximize-local-video}

Agrandit automatiquement la vidéo locale à l’ouverture du panneau de sous-titres.

### Afficher le bouton de mining dans la liste des sous-titres {#show-mining-button-in-subtitle-list}

Lorsque cette option est activée, affiche un bouton de mining à côté de chaque sous-titre dans la liste.

### Horodatages dans la liste des sous-titres {#subtitle-list-timestamps}

Détermine comment les horodatages s’affichent dans la liste des sous-titres.

- **Masqués** : ne sont pas affichés.
- **Début** : affiche uniquement l’horodatage de début du sous-titre.
- **Début et fin** : affiche les horodatages de début et de fin du sous-titre.

### Mémoriser le décalage des sous-titres {#remember-subtitle-offset}

Lorsque cette option est activée, le décalage de synchronisation est conservé. Les sous-titres sont chargés avec le dernier décalage utilisé.

### Mémoriser la dernière vitesse de lecture {#remember-last-playback-rate}

Met à jour le paramètre de vitesse de lecture lorsque celle-ci est modifiée pendant une vidéo. Si cette option est désactivée, la lecture commence toujours à la vitesse configurée, mais les changements effectués pendant le visionnage restent temporaires.

### Mémoriser les derniers modes de lecture {#remember-last-playback-modes}

Rétablit les derniers modes de lecture activés lors du prochain chargement. Si cette option est désactivée, la lecture démarre en mode normal.

### Copier automatiquement le sous-titre actuel dans le presse-papiers {#auto-copy-current-subtitle-to-clipboard}

Copie automatiquement le sous-titre dans le presse-papiers lorsqu’il s’affiche à l’écran. Pratique pour envoyer des sous-titres aux applications qui peuvent surveiller le presse-papiers.

### Pistes de sous-titres pouvant être copiées automatiquement {#subtitle-tracks-eligible-for-auto-copy}

Définit les pistes copiées automatiquement lorsque le paramètre [Copier automatiquement le sous-titre actuel dans le presse-papiers](#auto-copy-current-subtitle-to-clipboard) est activé.

### Afficher les miniatures d’aperçu {#show-preview-thumbnails}

Affiche des miniatures d’aperçu dans la liste des sous-titres.

### Sous-titre au-dessus de la miniature {#subtitle-above-thumbnail}

Affiche le sous-titre au-dessus de la miniature d’aperçu dans la liste des sous-titres.

### Filtre regex des sous-titres {#subtitle-regex-filter}

Les segments correspondant à cette regex sont remplacés par la valeur de [Texte de remplacement du filtre regex des sous-titres](#subtitle-regex-filter-text-replacement).

### Texte de remplacement du filtre regex des sous-titres {#subtitle-regex-filter-text-replacement}

Les segments correspondant à la regex ci-dessus sont remplacés par la valeur de ce paramètre. Si le champ est vide, les segments correspondants sont simplement supprimés.

### HTML des sous-titres {#subtitle-html}

Détermine comment traiter le HTML présent dans les fichiers de sous-titres.

### Détecter et afficher les ruby {#detect-and-display-ruby}

Lorsque cette option est activée, asbplayer détecte automatiquement les lectures de mots au format Netflix et les affiche à l’aide de balises `ruby`. Ces lectures sont fréquentes dans les sous-titres japonais et ressemblent à `花子（はなこ）` : la lecture entre parenthèses suit le mot.

### Activer le client WebSocket {#enable-websocket-client}

Active le client WebSocket, qui permet de contrôler asbplayer depuis l’interface WebSocket.

### URL du serveur WebSocket {#websocket-server-url}

URL du serveur WebSocket auquel se connecter lorsque le client WebSocket est activé. Il s’agit généralement d’une instance locale du [serveur WebSocket fourni](../guides/web-socket-server.md).

### Limite de stockage de l’historique de mining {#mining-history-storage-limit}

Limite le nombre de cartes enregistrées dans l’historique de mining.

### Nom de l’onglet {#name-of-the-tab}

Nom attribué à l’onglet de l’application.

## Profils {#profiles}

Un profil de paramètres est un ensemble de paramètres complètement distinct. Vous pouvez changer le profil actif depuis l’interface des paramètres ou depuis les boîtes de dialogue **Charger des sous-titres** et **Exporter vers Anki**.
