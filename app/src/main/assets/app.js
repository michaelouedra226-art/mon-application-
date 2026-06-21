/**
 * Cœur applicatif de l'application Mon IPTV Pro.
 * Gère l'état global, la base de données IndexedDB, le lecteur Shaka, et les fonctionnalités IPTV.
 */

// Configuration Globale
const PROXY_URL = 'https://ton-proxy.workers.dev/?url=';
const PLACEHOLDER_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%23444"><rect width="100" height="100" rx="15"/><text x="40%" y="55%" font-size="30" fill="%23fff">📺</text></svg>';

// Variables Globales
let db;
let currentChannels = [];
let currentCategory = 'Toutes';
let activeView = 'channels'; // 'channels', 'favorites', 'epg'
const favoriteUrls = new Set();

// Éléments du Lecteur Shaka
let shakaPlayer = null;
let shakaUI = null;
let videoElement = null;

// Initialisation de la Base de Données IndexedDB avec idb CDN
async function initDB() {
    db = await idb.openDB('iptv-db', 2, {
        upgrade(db, oldVersion, newVersion) {
            if (oldVersion < 1) {
                db.createObjectStore('channels', { keyPath: 'id', autoIncrement: true });
                db.createObjectStore('favorites', { keyPath: 'url' });
            }
            if (oldVersion < 2) {
                db.createObjectStore('epg', { keyPath: 'id', autoIncrement: true });
            }
        }
    });
}

// Lancement au chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log("Mon IPTV Pro : Démarrage...");
        
        // Initialiser la base de données
        await initDB();

        // Enregistrement du Service Worker
        registerServiceWorker();

        // Éléments d'interface indispensables
        videoElement = document.getElementById('video-player');
        
        // Vérification de compatibilité de Shaka Player
        shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()) {
            initPlayer();
        } else {
            alert('Attention : Ce navigateur ne prend pas en charge les fonctionnalités nécessaires de Shaka Player.');
        }

        // Configurer les écouteurs d'événements
        setupEventListeners();

        // Gérer le statut de connexion réseau
        setupNetworkStatus();

        // Charger les données depuis la base locale
        await loadFavorites();
        await loadChannelsFromDB();

        // Masquer le loader et afficher l'application
        document.getElementById('loader').style.display = 'none';
        document.getElementById('app').style.display = 'flex';

    } catch (e) {
        console.error("Erreur durant l'initialisation : ", e);
        document.getElementById('loader').innerHTML = `
            <div class="empty-icon" style="color: #ff3b30">⚠️</div>
            <h3>Erreur lors de l'initialisation</h3>
            <p>${e.message}</p>
        `;
    }
});

// Enregistrement du Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker enregistré avec succès ! Portée :', reg.scope))
            .catch(err => console.warn('Échec de l\'enregistrement du Service Worker :', err));
    }
}

// Initialisation du Lecteur Shaka Player UI
function initPlayer() {
    const container = document.querySelector('[data-shaka-player-container]');
    videoElement = document.getElementById('video-player');

    shakaPlayer = new shaka.Player(videoElement);
    
    // Attacher des gestionnaires d'erreurs au player
    shakaPlayer.addEventListener('error', onPlayerErrorEvent);

    // Initialisation de l'interface Shaka par défaut
    shakaUI = new shaka.ui.Overlay(shakaPlayer, container, videoElement);
    const controls = shakaUI.getControls();
    
    // Quelques configurations par défaut sur l'UI Shaka
    const config = {
        'controlPanelElements': ['play_pause', 'time_and_duration', 'mute', 'volume', 'fullscreen', 'overflow_menu']
    };
    shakaUI.configure(config);
}

function onPlayerErrorEvent(event) {
    onPlayerError(event.detail);
}

function onPlayerError(error) {
    console.error('Code d\'erreur Shaka Player :', error.code, 'Détails :', error);
    alert('Erreur lors du décodage ou du chargement du flux vidéo. Code: ' + error.code);
    closePlayer();
}

// Configuration des écouteurs UI
function setupEventListeners() {
    // Boutons d'Importation
    document.getElementById('btn-import').addEventListener('click', importPlaylistPrompt);
    document.getElementById('btn-epg').addEventListener('click', importEPGPrompt);

    // Navigation de la Barre Latérale
    document.getElementById('nav-all-channels').addEventListener('click', () => switchView('channels'));
    document.getElementById('nav-favorites').addEventListener('click', () => switchView('favorites'));
    document.getElementById('nav-epg-guide').addEventListener('click', () => switchView('epg'));

    // Contrôles personnalisés du lecteur
    document.getElementById('btn-back').addEventListener('click', closePlayer);
    document.getElementById('btn-pip').addEventListener('click', togglePictureInPicture);
    document.getElementById('btn-audio-only').addEventListener('click', toggleAudioOnly);

    // Contrôle de la résolution manuelle
    const btnRes = document.getElementById('btn-resolution');
    if (btnRes) {
        btnRes.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleResolutionMenu();
        });
    }

    // Menu contextuel personnalisé sur le lecteur
    const playerContainer = document.getElementById('player-container');
    if (playerContainer) {
        playerContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showCustomContextMenu(e);
        });
    }

    // Fermeture du menu contextuel au clic ailleurs
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('resolution-menu');
        if (menu && menu.classList.contains('show')) {
            const btnRes = document.getElementById('btn-resolution');
            if (!menu.contains(e.target) && e.target !== btnRes) {
                menu.classList.remove('show');
            }
        }
    });
}

// Gestion des statuts réseau
function setupNetworkStatus() {
    const updateStatus = () => {
        const el = document.getElementById('network-status');
        if (navigator.onLine) {
            el.textContent = "Connexion active";
            el.classList.remove('offline');
        } else {
            el.textContent = "Hors ligne";
            el.classList.add('offline');
        }
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// Commuter de Vue principale (Chaînes, Favoris, Guide EPG)
function switchView(view) {
    activeView = view;
    
    // Nettoyer l'état actif sur les boutons
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Masquer toutes les sections connexes de contenu
    document.getElementById('channel-view').style.display = 'none';
    document.getElementById('epg-view').style.display = 'none';

    if (view === 'channels') {
        document.getElementById('nav-all-channels').classList.add('active');
        document.getElementById('channel-view').style.display = 'flex';
        document.getElementById('view-title').textContent = "Toutes les chaînes";
        displayChannels();
    } else if (view === 'favorites') {
        document.getElementById('nav-favorites').classList.add('active');
        document.getElementById('channel-view').style.display = 'flex';
        document.getElementById('view-title').textContent = "Mes Chaînes Favorites";
        displayChannels();
    } else if (view === 'epg') {
        document.getElementById('nav-epg-guide').classList.add('active');
        document.getElementById('epg-view').style.display = 'flex';
        displayEPGGuide();
    }
}

// Favoris - Chargement initial
async function loadFavorites() {
    favoriteUrls.clear();
    const favs = await db.getAll('favorites');
    favs.forEach(f => favoriteUrls.add(f.url));
}

// Charger les chaînes depuis IndexedDB
async function loadChannelsFromDB() {
    currentChannels = await db.getAll('channels');
    updateCategories();
    displayChannels();
}

// Récupération des catégories uniques
function updateCategories() {
    const categoriesSet = new Set();
    currentChannels.forEach(c => {
        if (c.group) categoriesSet.add(c.group);
    });

    const categories = Array.from(categoriesSet).sort();
    const container = document.getElementById('category-list');
    container.innerHTML = '';

    // Ajouter l'option "Toutes"
    const allLi = document.createElement('li');
    allLi.className = `nav-item ${currentCategory === 'Toutes' ? 'active' : ''}`;
    allLi.innerHTML = `<span class="nav-icon">🏷️</span> Toutes`;
    allLi.addEventListener('click', () => {
        currentCategory = 'Toutes';
        // Nettoyer sur les catégories de liste
        document.querySelectorAll('#category-list .nav-item').forEach(li => li.classList.remove('active'));
        allLi.classList.add('active');
        displayChannels();
    });
    container.appendChild(allLi);

    // Générer chaque catégorie
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.className = `nav-item ${currentCategory === cat ? 'active' : ''}`;
        li.innerHTML = `<span class="nav-icon">📁</span> ${cat}`;
        li.addEventListener('click', () => {
            currentCategory = cat;
            document.querySelectorAll('#sidebar .nav-item').forEach(item => item.classList.remove('active'));
            li.classList.add('active');
            displayChannels();
        });
        container.appendChild(li);
    });
}

// Générer la grille d'affichage des chaînes
function displayChannels() {
    const grid = document.getElementById('channel-grid');
    grid.innerHTML = '';

    let listToDisplay = currentChannels;

    // Étape 1 : Filtrer si vue favoris
    if (activeView === 'favorites') {
        listToDisplay = listToDisplay.filter(c => favoriteUrls.has(c.url));
    }

    // Étape 2 : Filtrer par catégorie sélectionnée
    if (currentCategory !== 'Toutes') {
        listToDisplay = listToDisplay.filter(c => c.group === currentCategory);
    }

    // Si aucune chaîne n'est trouvée
    if (listToDisplay.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h3>Aucune chaîne à afficher</h3>
                <p>Essayez de changer de catégorie ou d'importer une playlist valide.</p>
            </div>
        `;
        return;
    }

    // Génération du HTML des cartes
    listToDisplay.forEach(channel => {
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.setAttribute('data-id', channel.id);

        const isFav = favoriteUrls.has(channel.url);

        card.innerHTML = `
            <button class="btn-star ${isFav ? 'favorited' : ''}" title="Ajouter aux favoris">
                ${isFav ? '★' : '☆'}
            </button>
            <div class="channel-logo-container">
                <img class="channel-logo" src="${channel.logo || PLACEHOLDER_LOGO}" alt="${channel.name}" onerror="this.src='${PLACEHOLDER_LOGO}'">
            </div>
            <div class="channel-name">${channel.name}</div>
            <div class="channel-group">${channel.group}</div>
        `;

        // Événement clic sur l'étoile
        card.querySelector('.btn-star').addEventListener('click', (e) => {
            e.stopPropagation(); // Évite de démarrer la vidéo en cliquant sur le favoris
            toggleFavorite(channel, e.currentTarget);
        });

        // Événement clic sur la carte pour démarrer le flux
        card.addEventListener('click', () => {
            playChannel(channel);
        });

        grid.appendChild(card);
    });
}

// Ajouter / Retirer des favoris
async function toggleFavorite(channel, buttonElement) {
    const isFav = favoriteUrls.has(channel.url);

    if (isFav) {
        favoriteUrls.delete(channel.url);
        await db.delete('favorites', channel.url);
        buttonElement.classList.remove('favorited');
        buttonElement.textContent = '☆';
    } else {
        favoriteUrls.add(channel.url);
        await db.put('favorites', { url: channel.url, name: channel.name, logo: channel.logo, group: channel.group });
        buttonElement.classList.add('favorited');
        buttonElement.textContent = '★';
    }

    // Rafraichir les chaînes en temps réel si l'utilisateur est sur l'onglet des favoris
    if (activeView === 'favorites') {
        displayChannels();
    }
}

// Invite pour Importer une Playlist M3U via URL
async function importPlaylistPrompt() {
    const url = prompt("Veuillez saisir l'URL du fichier playlist M3U (.m3u / .m3u8) :");
    if (!url) return;

    // Afficher message d'importation
    document.getElementById('loader').style.display = 'flex';
    document.getElementById('loader').querySelector('.loader-subtext').textContent = 'Téléchargement de la playlist M3U...';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Réponse réseau non valide");
        
        const m3uContent = await response.text();
        const parsed = parseM3U(m3uContent);

        if (parsed.length === 0) {
            alert("Aucune chaîne valide n'a pu être extraite de cette playlist.");
            document.getElementById('loader').style.display = 'none';
            return;
        }

        // Nettoyer l'ancienne base de chaînes et insérer les nouvelles
        const tx = db.transaction('channels', 'readwrite');
        await tx.store.clear();
        for (const item of parsed) {
            await tx.store.add(item);
        }
        await tx.done;

        // Mise à jour de l'interface
        currentCategory = 'Toutes';
        await loadChannelsFromDB();
        alert(`Félicitations ! ${parsed.length} chaînes importées avec succès.`);

    } catch (err) {
        console.error(err);
        alert("Erreur réseau. Vérifiez votre connexion internet ou le partage CORS du serveur hébergeant votre playlist M3U.");
    } finally {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    }
}

// Invite pour Importer le guide EPG (XMLTV)
async function importEPGPrompt() {
    const url = prompt("Veuillez saisir l'URL du guide EPG XMLTV (.xml / .xml.gz / .gz) :");
    if (!url) return;

    document.getElementById('loader').style.display = 'flex';
    document.getElementById('loader').querySelector('.loader-subtext').textContent = 'Téléchargement et décodage de l\'EPG XMLTV...';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Flux réseau de l'EPG injoignable");

        const xmlString = await response.text();
        const programs = parseXMLTV(xmlString);

        if (programs.length === 0) {
            alert("Aucun programme n'a été trouvé dans ce fichier EPG XMLTV.");
            document.getElementById('loader').style.display = 'none';
            return;
        }

        // Stocker les programmes dans la table EPG
        const tx = db.transaction('epg', 'readwrite');
        await tx.store.clear();
        for (const prog of programs) {
            await tx.store.add(prog);
        }
        await tx.done;

        alert(`Excellent ! ${programs.length} entrées de guide TV ajoutées.`);
        if (activeView === 'epg') {
            displayEPGGuide();
        }

    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'import EPG. Veuillez vérifier l'URL et votre connexion réseau.");
    } finally {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
    }
}

// Affichage du guide TV EPG intégré
async function displayEPGGuide() {
    const container = document.getElementById('epg-content');
    container.innerHTML = '';

    const allPrograms = await db.getAll('epg');
    if (allPrograms.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <h3>Guide vide</h3>
                <p>Importez votre fichier d'EPG XMLTV pour voir les émissions de télévision prévues.</p>
            </div>
        `;
        return;
    }

    // Regrouper par identifiant de chaîne
    const grouped = {};
    allPrograms.forEach(prog => {
        if (!grouped[prog.channelId]) {
            grouped[prog.channelId] = [];
        }
        grouped[prog.channelId].push(prog);
    });

    // Chercher et associer un nom de chaine et logo
    for (const channelId in grouped) {
        const programs = grouped[channelId].slice(0, 5); // Limiter à 5 programmes par chaîne
        const matchedChannel = currentChannels.find(c => c.tvgId === channelId);
        const name = matchedChannel ? matchedChannel.name : `Canal ID: ${channelId}`;
        const logo = matchedChannel ? matchedChannel.logo : PLACEHOLDER_LOGO;

        const row = document.createElement('div');
        row.className = 'epg-channel-row';

        let progHTML = '';
        programs.forEach(p => {
            progHTML += `
                <div class="epg-program-item">
                    <span class="epg-program-time">${p.start} - ${p.stop}</span>
                    <span class="epg-program-title">${p.title}</span>
                    <span class="epg-program-desc">${p.desc}</span>
                </div>
            `;
        });

        row.innerHTML = `
            <div class="epg-channel-header">
                <img class="epg-channel-logo" src="${logo}" alt="${name}" onerror="this.src='${PLACEHOLDER_LOGO}'">
                <span class="epg-channel-name">${name}</span>
            </div>
            <div class="epg-program-list">
                ${progHTML}
            </div>
        `;

        container.appendChild(row);
    }
}

// Fonction pour démarrer la lecture du flux IPTV
async function playChannel(channel) {
    if (!shakaPlayer) {
        alert("Lecteur multimédia absent ou incompatible.");
        return;
    }

    try {
        // Validation et proxy CORS anti-blocage si flux HTTP
        let streamUrl = channel.url;
        if (streamUrl.startsWith('http://')) {
            console.log("Flux non-secours (HTTP) : Application du Proxy CORS");
            streamUrl = PROXY_URL + encodeURIComponent(streamUrl);
        }

        // Afficher l'interface de lecture (classe active pour les transitions fluides)
        document.getElementById('player-container').classList.add('active');
        
        // Mettre à jour l'overlay d'informations
        document.getElementById('playing-channel-name').textContent = channel.name;
        document.getElementById('playing-channel-logo-container').innerHTML = `
            <img src="${channel.logo || PLACEHOLDER_LOGO}" alt="${channel.name}" onerror="this.src='${PLACEHOLDER_LOGO}'" style="max-width:100%; max-height:100%;">
        `;
        const btnRes = document.getElementById('btn-resolution');
        if (btnRes) btnRes.textContent = '⚙️ Qualité : Auto';

        // Charger la source dans Shaka Player
        await shakaPlayer.load(streamUrl);
        console.log(`Lecture initiée du flux : ${channel.name}`);

        // Initialisation de la Media Session API (pour l'écran verrouillé de l'appareil Android / Mobile)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: channel.name,
                artist: channel.group || 'IPTV Stream',
                artwork: [
                    { src: channel.logo || PLACEHOLDER_LOGO, sizes: '128x128', type: 'image/png' }
                ]
            });

            // Configurer les écouteurs de contrôles Système
            navigator.mediaSession.setActionHandler('play', () => videoElement.play());
            navigator.mediaSession.setActionHandler('pause', () => videoElement.pause());
            navigator.mediaSession.setActionHandler('stop', () => closePlayer());
        }

    } catch (error) {
        console.error("Erreur de chargement du flux : ", error);
        alert(`Échec de lecture du flux.\n${error.message || 'Verifiez l\'accessibilité de l\'adresse.'}`);
        closePlayer();
    }
}

// Arrêter et fermer le Player
async function closePlayer() {
    if (shakaPlayer) {
        try {
            await shakaPlayer.unload();
        } catch (e) {
            console.warn("Erreur lors de la déconnexion du flux : ", e);
        }
    }
    
    // Rétablir la visibilité complète de la balise vidéo
    videoElement.style.display = 'block';
    
    // Masquer le player et réafficher le canal grid (classe active pour les transitions fluides)
    document.getElementById('player-container').classList.remove('active');
}

// Option Picture-In-Picture Intégrée
async function togglePictureInPicture() {
    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
    } else if (videoElement) {
        try {
            await videoElement.requestPictureInPicture();
        } catch (err) {
            console.error("Erreur Picture in Picture", err);
            alert("Picture-in-Picture non supporté sur ce flux ou cet appareil.");
        }
    }
}

// Option Audio Seul (Masquer / Afficher l'aspect physique de la balise vidéo)
function toggleAudioOnly() {
    if (videoElement) {
        if (videoElement.style.display === 'none') {
            videoElement.style.display = 'block';
            document.getElementById('btn-audio-only').textContent = '🎧 Audio Seul';
        } else {
            videoElement.style.display = 'none';
            document.getElementById('btn-audio-only').textContent = '📺 Afficher Vidéo';
        }
    }
}

// Affiche/Masque le menu de résolution sous le bouton qualité
function toggleResolutionMenu() {
    const menu = document.getElementById('resolution-menu');
    if (!menu) return;

    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
    } else {
        updateResolutionMenu();

        // Positionnement au-dessus du bouton de résolution
        const btn = document.getElementById('btn-resolution');
        const playerContainer = document.getElementById('player-container');
        if (btn && playerContainer) {
            const btnRect = btn.getBoundingClientRect();
            const containerRect = playerContainer.getBoundingClientRect();

            const x = btnRect.left - containerRect.left;
            // On le positionne au-dessus
            menu.style.left = `${x}px`;
            menu.style.top = 'auto';
            menu.style.bottom = `${containerRect.height - (btnRect.top - containerRect.top) + 12}px`;
            menu.classList.add('show');
        }
    }
}

// Affiche le menu contextuel au clic droit / appui long sur l'écran du player
function showCustomContextMenu(e) {
    const menu = document.getElementById('resolution-menu');
    const playerContainer = document.getElementById('player-container');
    if (!menu || !playerContainer || !shakaPlayer) return;

    updateResolutionMenu();

    const rect = playerContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Ajustement pour ne pas dépasser les limites physiques du lecteur
    const menuWidth = 210;
    const menuHeight = 220;
    if (x + menuWidth > rect.width) x -= menuWidth;
    if (y + menuHeight > rect.height) y -= menuHeight;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.bottom = 'auto';
    menu.classList.add('show');
}

// Met à jour la liste des pistes de résolution disponibles via Shaka Player API
function updateResolutionMenu() {
    const menu = document.getElementById('resolution-menu');
    if (!menu) return;

    menu.innerHTML = '';

    if (!shakaPlayer) return;

    // Récupérer toutes les pistes de variantes vidéo disponibles
    let tracks = shakaPlayer.getVariantTracks();

    // Trier par hauteur de résolution (haute qualité d'abord)
    tracks.sort((a, b) => b.height - a.height);

    // Option automatique (ABR activé par défaut)
    const isAbrEnabled = shakaPlayer.getConfiguration().abr.enabled;
    const autoItem = document.createElement('div');
    autoItem.className = 'res-menu-item' + (isAbrEnabled ? ' active' : '');
    autoItem.textContent = 'Auto (Adaptatif)';
    autoItem.addEventListener('click', () => {
        shakaPlayer.configure({ abr: { enabled: true } });
        const btn = document.getElementById('btn-resolution');
        if (btn) btn.textContent = '⚙️ Qualité : Auto';
        menu.classList.remove('show');
    });
    menu.appendChild(autoItem);

    // Identifier la hauteur active du flux
    const activeTrack = tracks.find(t => t.active);
    const activeHeight = activeTrack ? activeTrack.height : null;

    // Dédupliquer les hauteurs de résolutions pour une interface simplifiée et robuste
    const seenHeights = new Set();

    tracks.forEach(track => {
        if (!track.height) return; // Ignore l'audio pur ou pistes invalides

        const heightKey = track.height;
        if (seenHeights.has(heightKey)) return;
        seenHeights.add(heightKey);

        const bandwidthKbps = Math.round(track.videoBandwidth / 1000);
        const label = `${track.height}p (${bandwidthKbps} kbps)`;

        const item = document.createElement('div');
        const isActive = !isAbrEnabled && activeHeight === track.height;
        
        item.className = 'res-menu-item' + (isActive ? ' active' : '');
        item.textContent = label;

        item.addEventListener('click', () => {
            // Désactiver l'ABR pour verrouiller manuellement le débit et la résolution
            shakaPlayer.configure({ abr: { enabled: false } });
            
            // Forcer la sélection de la piste de variante choisie par l'utilisateur
            shakaPlayer.selectVariantTrack(track, /* clearBuffer= */ true);
            
            const btn = document.getElementById('btn-resolution');
            if (btn) btn.textContent = `⚙️ Qualité : ${track.height}p`;
            
            menu.classList.remove('show');
        });
        menu.appendChild(item);
    });

    // Si aucune piste n'est disponible (ex: flux d'origine MP4 ou résolution fixe non-adaptative)
    if (menu.children.length === 1) {
        const fallbackItem = document.createElement('div');
        fallbackItem.className = 'res-menu-item disabled';
        fallbackItem.textContent = 'Unique résolution disponible';
        menu.appendChild(fallbackItem);
    }
}
