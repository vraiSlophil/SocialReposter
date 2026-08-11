# Étude de faisabilité — téléchargement TikTok

Ce dépôt compare deux méthodes de téléchargement d'une vidéo TikTok publique :

1. `yt-dlp`, utilitaire non officiel éprouvé ;
2. une méthode maison utilisant Chromium et Playwright, sans API payante et sans appeler `yt-dlp`.

L'objectif est uniquement de vérifier la faisabilité technique et de comparer le résultat, la vitesse et les ressources consommées. Ce dépôt n'est pas le logiciel final de republication.

Utiliser uniquement des contenus que vous êtes autorisé à télécharger et à republier. TikTok ne fournit pas ici d'API officielle de téléchargement : ces deux méthodes peuvent cesser de fonctionner après une évolution du site.

## Prérequis

- Docker avec Docker Compose ;
- l'image `unclecode/crawl4ai:0.9.0` déjà présente sur la machine ;
- un accès réseau à TikTok pour effectuer les essais.

Aucune installation locale de Python ou Node.js n'est nécessaire. Le service utilise exclusivement l'image Docker locale configurée avec `pull_policy: never`.

## Construction

```sh
docker compose build tiktok-downloader
```

La construction réutilise l'image locale `unclecode/crawl4ai:0.9.0` et ne télécharge donc pas de nouvelle image de base. Si la couche n'est pas déjà en cache, `pip` doit néanmoins télécharger la version épinglée de `yt-dlp` ; cette couche est ensuite réutilisée par Docker.

## Méthode 1 — yt-dlp

```sh
docker compose run --rm tiktok-downloader yt-dlp \
  'https://www.tiktok.com/@utilisateur/video/1234567890123456789'
```

Résultats :

- vidéo : `downloads/yt-dlp/<id>.<extension>` ;
- métadonnées : `downloads/yt-dlp/<id>.info.json` ;
- diagnostic d'échec : `downloads/yt-dlp/<id>.failure.json`.

Les mesures de performance sont placées dans `_feasibility.resource_usage` du fichier `info.json`.

## Méthode 2 — navigateur Chromium

```sh
docker compose run --rm tiktok-downloader browser \
  'https://www.tiktok.com/@utilisateur/video/1234567890123456789'
```

Cette méthode :

1. ouvre la page avec Chromium headless ;
2. retrouve les données structurées associées à l'identifiant du post ;
3. classe les variantes déclarées par le post, de la meilleure qualité disponible à la moins bonne ;
4. télécharge un candidat dans un fichier temporaire ;
5. vérifie ses dimensions, sa durée et ses pistes audio avant de l'accepter ;
6. remplace l'ancien fichier uniquement après validation.

Les dimensions, le ratio et la durée attendus ne sont pas codés en dur. Ils proviennent des données du post testé. Lorsqu'un candidat ne peut pas être relié à ces données structurées, il n'est accepté comme solution de repli que si une piste audio est détectée. Cela évite de considérer une animation d'interface ou le logo TikTok comme la vidéo du post.

Résultats :

- vidéo validée : `downloads/browser/<id>.mp4` ;
- métadonnées et détail de la validation : `downloads/browser/<id>.info.json` ;
- diagnostic d'échec : `downloads/browser/<id>.failure.json` ;
- capture de diagnostic, si possible : `downloads/browser/<id>.failure.png`.

Le fichier `info.json` indique notamment :

- la source du candidat sélectionné ;
- les caractéristiques annoncées par le post ;
- les caractéristiques réellement lues dans le MP4 ;
- les candidats essayés et la décision de validation ;
- les ressources consommées dans `resource_usage`.

## Comparaison

Exécuter les deux méthodes avec exactement la même URL, puis générer le rapport avec l'URL ou l'identifiant numérique :

```sh
docker compose run --rm tiktok-downloader compare \
  'https://www.tiktok.com/@utilisateur/video/1234567890123456789'
```

ou :

```sh
docker compose run --rm tiktok-downloader compare \
  '1234567890123456789'
```

Le résultat est affiché dans le terminal sous forme de tableau texte aligné, sans syntaxe Markdown. La meilleure valeur comparable de chaque ligne apparaît en vert lorsque la sortie est connectée à un terminal ; les ex æquo sont tous les deux colorés. Les couleurs sont automatiquement désactivées lors d'une redirection vers un fichier. Elles peuvent aussi être désactivées avec `NO_COLOR=1` ou forcées avec `FORCE_COLOR=1`.

Les rapports détaillés sont enregistrés dans :

- `downloads/comparison/<id>.md` : tableau lisible ;
- `downloads/comparison/<id>.json` : données complètes exploitables par un programme.

### Critères comparés

- réussite et validation du résultat ;
- taille du fichier ;
- résolution ;
- présence d'une piste audio ;
- durée réelle du téléchargement ;
- temps CPU ;
- utilisation CPU moyenne ;
- pic mémoire ;
- lectures et écritures disque ;
- temps CPU par Mio produit.

Le filigrane reste un contrôle visuel : une détection automatique simple ne serait pas assez fiable pour conclure à la faisabilité.

### Mesures de performance

Sous Linux avec cgroup v2, le script lit les compteurs du conteneur :

- `cpu.stat` pour le temps CPU ;
- `memory.peak` pour le pic mémoire ;
- `io.stat` pour les lectures et écritures disque.

Ces mesures couvrent le processus principal et ses enfants, notamment Chromium. Un repli basé sur les statistiques des processus est utilisé lorsque cgroup v2 n'est pas disponible.

Le temps CPU est seulement un proxy de consommation énergétique. Il ne représente pas une mesure électrique en watts ou en joules.

### Score indicatif

Le rapport donne d'abord une conclusion factuelle : méthode seule à réussir ou méthode qui n'est moins bonne sur aucun indicateur comparable, résultat inclus.

Un score indicatif sur 100 est ensuite calculé avec la pondération suivante :

- résultat : 40 % ;
- vitesse : 25 % ;
- temps CPU : 20 % ;
- mémoire : 10 % ;
- entrées/sorties disque : 5 %.

Dans la note de résultat, la réussite compte pour 60 %, l'audio pour 20 % et la résolution relative pour 20 %. Une catégorie indisponible est retirée pour les deux méthodes et le score est renormalisé. Une méthode en échec reçoit toujours un score global nul.

## Emplacement des données de performance

Les mesures brutes sont conservées avec chaque exécution :

- yt-dlp : `downloads/yt-dlp/<id>.info.json`, sous `_feasibility.resource_usage` ;
- navigateur : `downloads/browser/<id>.info.json`, sous `resource_usage` ;
- échec : `downloads/<méthode>/<id>.failure.json`.

La commande `compare` recopie ensuite ces données dans `downloads/comparison/<id>.json` et en présente un résumé dans le rapport Markdown.

Une nouvelle exécution sur le même identifiant remplace le résultat précédent. Le projet ne conserve pas encore un historique de plusieurs mesures. Pour limiter l'influence du réseau, du cache et de la charge de la machine, exécuter idéalement chaque méthode au moins trois fois dans des conditions comparables et comparer les médianes.

## Organisation

```text
compose.yaml
docker/feasibility/
  Dockerfile
  entrypoint.sh
scripts/
  download_with_ytdlp.py
  download_with_browser.py
  tiktok_page_candidates.py
  media_inspection.py
  resource_metrics.py
  compare_downloads.py
downloads/
  yt-dlp/
  browser/
  comparison/
```
