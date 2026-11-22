---
sidebar_position: 11
---

import project from '@site/src/project';

# Sous-titres en ligne {#online-subtitles}

Au lieu de chercher manuellement des fichiers de sous-titres, vous pouvez les rechercher et les charger directement depuis asbplayer. Ils sont fournis par [Jimaku](https://jimaku.cc), un site communautaire consacré principalement aux sous-titres d’anime et de séries japonaises.

## Utilisation {#usage}

1. Ouvrez le panneau latéral sur une page contenant une vidéo, puis cliquez sur **Charger des sous-titres**.
2. Cliquez sur **Rechercher des sous-titres en ligne** (également accessible depuis le menu déroulant des pistes de sous-titres).
3. Le titre de la page est proposé comme terme de recherche. Modifiez-le si nécessaire, choisissez **Anime** ou **Série**, puis lancez la recherche.
4. Cliquez sur un résultat pour afficher ses fichiers de sous-titres, puis sur un fichier pour le charger.

Seuls les fichiers `.srt` et `.ass` sont répertoriés. Les œuvres ouvertes récemment apparaissent sous **Récents**, afin que vous puissiez ignorer la recherche la prochaine fois.

## Obtenir une clé API Jimaku {#api-key}

Jimaku nécessite une clé API pour effectuer des recherches et des téléchargements.

1. Créez un compte sur [jimaku.cc](https://jimaku.cc), puis connectez-vous.
2. Ouvrez votre [page de compte](https://jimaku.cc/account) et générez une clé API.
3. Collez la clé dans le champ **Clé API Jimaku** de la boîte de dialogue de recherche.

La clé est enregistrée automatiquement, vous n’avez donc à effectuer cette opération qu’une fois. Elle est masquée par défaut ; utilisez l’icône en forme d’œil pour l’afficher.

## Détection automatique des épisodes {#episode-detection}

Pour les séries, asbplayer essaie de lire le numéro de l’épisode dans le titre de la page (par exemple `S01E05`, `EP05` ou `第5話`/`第五集`). Si un numéro est détecté :

- le numéro d’épisode est supprimé du terme de recherche, qui ne contient alors que le nom de la série ;
- la liste des fichiers est filtrée pour cet épisode, indiqué par une pastille **EP N**. Cliquez sur le ✕ de la pastille pour afficher tous les fichiers.

Si aucun fichier de sous-titres utilisable n’est disponible pour l’épisode choisi, la liste complète s’affiche.

### Expression régulière personnalisée pour les épisodes {#episode-regex}

Certains sites utilisent des formats de titre que les règles intégrées ne reconnaissent pas. Aucun épisode n’est alors détecté et tous les fichiers de la série s’affichent. Une expression régulière personnalisée permet à asbplayer de reconnaître les épisodes sur ces sites.

Après avoir ouvert une série, cliquez sur l’icône d’engrenage à côté de l’en-tête de la liste des fichiers pour afficher le champ **Expression régulière personnalisée pour les épisodes**. L’engrenage est mis en évidence lorsqu’une expression est définie.

- Le **groupe de capture 1** doit contenir le numéro de l’épisode (les chiffres arabes et les chiffres kanji sont acceptés).
- Votre expression est essayée en premier. Si elle est vide, invalide ou ne correspond pas au titre, les règles intégrées sont utilisées comme d’habitude ; elle ne peut donc qu’améliorer la détection.
- Appuyez sur **Entrée** pour filtrer à nouveau la série actuelle. Le terme de recherche sera mis à jour à la prochaine ouverture de la boîte de dialogue.

:::tip
Les règles intégrées n’ont été testées que sur les quelques sites utilisés par l’auteur de cette fonctionnalité. Si le format du titre d’un site n’est pas reconnu, veuillez <a href={`${project.urls.repo}/issues`}>ouvrir un ticket</a> avec un exemple de titre de page (ou proposer une PR sur `common/subtitle-sources/jimaku-episode-patterns.ts`) afin d’améliorer ces règles.
:::

Par exemple, si un site intitule ses pages `Some Show - Chapter 07 | SiteName`, utilisez :

```
Chapter (\d+)
```

## Remerciements {#jimaku-acknowledgements}

Un grand merci à [Rapptz](https://github.com/Rapptz), qui a créé et maintient [Jimaku](https://github.com/Rapptz/jimaku) et fournit l’API qui rend cette fonctionnalité possible. Si elle vous est utile, pensez à soutenir le site et à y partager vos propres sous-titres.
