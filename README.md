# exif_change

PWA (Progressive Web App) permettant de **visualiser** et **modifier** les données de géolocalisation EXIF d'une photo.

Traitement **100 % local** : aucune image n'est envoyée sur un serveur.

## Fonctionnalités

- Import d'une photo (JPEG, TIFF, HEIC, WebP, RAW…)
- Affichage de la photo aux dimensions de l'écran
- Lecture des données EXIF GPS (via [exifr](https://github.com/MikeKovarik/exifr))
  - Si présentes : marqueur sur carte Leaflet + latitude / longitude en degrés décimaux (`XX.XXXX`, `YYY.YYYY`)
  - Sinon : message *« Pas de données de géolocalisation »*
- Carte interactive (Leaflet) avec marqueur **repositionnable**
- Fonds de carte au choix :
  - OpenStreetMap
  - IGN Plan V2
  - IGN BD Ortho
- Saisie manuelle des coordonnées (lat / lon)
- Sauvegarde de la photo avec les coordonnées retenues  
  → nom de fichier = original + suffixe `_loc`  
  → écriture EXIF GPS supportée pour **JPEG** uniquement (via [piexifjs](https://github.com/hMatoba/piexifjs))

## Déploiement GitHub Pages

1. Créer un dépôt GitHub nommé `exif_change` (ou autre).
2. Pousser le contenu de ce dossier à la racine (ou dans `/docs`).
3. Dans *Settings → Pages* : source = branche `main` / dossier `/` (ou `/docs`).
4. L'application sera accessible à `https://<user>.github.io/exif_change/`.

> **Important** : le service worker et le manifeste utilisent des chemins relatifs (`./`).  
> Si le site est servi sous un sous-chemin, cela fonctionne tel quel.

## Service Worker « brise-caches »

Le fichier `sw.js` applique une stratégie **network-first** pour le HTML et se purifie à chaque activation :

- `skipWaiting()` + `clients.claim()`
- suppression de tous les caches dont le nom n'est pas celui de la version courante

Cela force le rechargement des assets après chaque déploiement.

## Structure

```
exif_change/
├── index.html
├── css/style.css
├── js/app.js
├── sw.js
├── manifest.json
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

## Limitations

| Format | Lecture GPS | Écriture GPS | Aperçu |
|--------|-------------|--------------|--------|
| JPEG   | oui         | oui          | oui    |
| WebP   | partiel     | non          | oui    |
| TIFF   | oui         | non          | variable |
| HEIC   | oui*        | non          | limité (navigateur) |
| RAW    | variable    | non          | souvent non |

\* Selon le support du navigateur / de la librairie.

## Licence

Code libre – à adapter selon vos besoins.
