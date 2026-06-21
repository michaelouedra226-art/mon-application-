# Mon IPTV Pro 📺
> Lecteur multimédia IPTV PWA professionnel, élégant, fluide et performant.

Mon IPTV Pro est une Progressive Web App (PWA) de lecture de flux de diffusion en direct (IPTV) conçue avec des technologies Web Vanilla (HTML5, CSS3, JavaScript) sans aucune étape de build ou de compilation complexe requise. Elle exploite la puissance du lecteur industriel **Shaka Player** via CDN et stocke ses données de manière ultra-sécurisée et performante en local via **IndexedDB** (`idb`).

Ce dépôt inclut tout le nécessaire pour être déployé en un clic sur **GitHub Pages** et compilé automatiquement sous forme d'application **Android native (.apk)** via Bubblewrap (Trusted Web Activity) grâce aux workflows GitHub Actions fournis !

---

## 🚀 Fonctionnalités principales

1. **Interface Moderne Sombre** : Design haut de gamme fortement inspiré de TiviMate ou d'IPTV Smarters, optimisé pour l'accessibilité sur mobiles et tablettes.
2. **Gestion Complète des Playlists** : Importation de playlists M3U/M3U8 via URL avec tri par catégories, logos automatiques et recherche intégrée.
3. **Lecteur Vidéo Haute Performance** : Shaka Player 4.7.0 pré-configuré pour lire les flux HLS, DASH ainsi que les formats standards avec gestion robuste des échecs de chargement.
4. **CORS Anti-Blocage** : Un proxy anti-CORS est prêt et configurable (via la constante globale `PROXY_URL` dans `app.js`).
5. **Guide TV (EPG XMLTV)** : Importez un guide TV standard XMLTV pour afficher les émissions prévues associés à vos chaînes d'IPTV préférées.
6. **Interaction Native Android (Media Session API)** : Permet le contrôle des flux (lecture, pause, arrêt) direct depuis le volet de notifications Android ou l'écran verrouillé.
7. **Picture-In-Picture intégrée** : Regardez vos émissions favorites en fenêtré tout en utilisant d'autres applications.
8. **Aucune Dépendance Interne Locale** : Pas besoin de `npm`, pas de framework lourd. Toutes les librairies externes sont chargées de façon asynchrone par CDN optimisés.
9. **Option Audio Seul** : Permet de désactiver l'affichage de la vidéo pour économiser de la batterie et écouter vos radios ou émissions de télé favorite en tâche de fond.

---

## 🛠️ Déploiement automatique sur GitHub Pages

Pour mettre en ligne votre instance de l'application IPTV immédiatement et gratuitement :

1. **Créer un dépôt GitHub** et copiez-y l'intégralité des fichiers de ce dépôt.
2. Activez **GitHub Pages** dans l'onglet des paramètres de votre dépôt :
   - Allez sur **Settings (Paramètres)** > **Pages**.
   - Dans la section **Build and deployment**, sous **Source**, sélectionnez **GitHub Actions**.
3. Effectuez un simple push sur la branche principale `main` : le workflow `.github/workflows/deploy.yml` va démarrer automatiquement et déployer votre PWA !
4. L'URL finale de votre application sera de la forme : `https://VOTRE_PSEUDO.github.io/mon-iptv-pro/`

---

## 🤖 Génération d'un fichier APK Android (TWA)

Pour convertir votre PWA déployée en une application Android native installable sans code ni outil local :

1. Rendez-vous dans l'onglet **Actions** de votre dépôt GitHub.
2. Sélectionnez le workflow nommé **"Généner APK Android (TWA)"** sur la gauche.
3. Cliquez sur le menu déroulant **Run workflow** à droite.
4. Renseignez l'URL exacte où votre PWA a été déployée (ex: `https://COMPTE.github.io/mon-iptv-pro/`).
5. Cliquez sur le bouton Vert **Run workflow** pour lancer la compilation.
6. Une fois terminé (généralement en moins de 3 minutes), faites défiler le résumé de l'exécution vers le bas et téléchargez l'artefact **`mon-iptv-pro-apk`** qui contient votre fichier `.apk` Android prêt à être copié et installé sur n'importe quel téléphone portable !

---

## 📂 Structure du Projet

- `index.html` : L'interface squelette structurée avec Shaka Player et les menus d'importation.
- `style.css` : Thème visuel haut de gamme sombre avec animations élégantes.
- `m3u-parser.js` : Parseur performant de listes M3U/M3U8.
- `epg-parser.js` : Parseur pour guide TV XMLTV.
- `app.js` : Contrôleur principal incluant la gestion IndexedDB et l'intégration Shaka Player.
- `sw.js` : Service Worker gérant la mise en cache locale pour le fonctionnement hors ligne.
- `manifest.json` : Manifest de l'application PWA enrichie de logos universels encodés d'origine.
- `.github/workflows/` : Contient les instructions d'intégration et de build GitHub Actions pour Pages et le compilateur d'APK.
