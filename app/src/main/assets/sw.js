/**
 * Service Worker pour Mon IPTV Pro.
 * Met en cache l'application, les feuilles de style, les CDN et les images de façon dynamique pour un chargement instantané.
 */

const CACHE_NAME = 'mon-iptv-pro-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './m3u-parser.js',
    './epg-parser.js',
    './app.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/shaka-player@4.7.0/dist/controls.css',
    'https://cdn.jsdelivr.net/npm/shaka-player@4.7.0/dist/shaka-player.ui.js',
    'https://cdn.jsdelivr.net/npm/idb@8/build/umd.js'
];

// Enregistrement et mise en cache initiale lors de l'installation du SW
self.addEventListener('install', event => {
    console.log('[Service Worker] Installation...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Pré-mise en cache des ressources d\'interface');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Nettoyage des anciens caches lors de l'activation
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activation et nettoyage...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Suppression de l\'ancien cache', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interception des requêtes HTTP
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Stratégie spécifique pour les flux vidéo et fichiers de playlists (M3U8, TS, MPD)
    // Nous ne voulons JAMAIS mettre en cache les flux de diffusion en direct (live streaming)
    if (
        url.pathname.endsWith('.m3u8') || 
        url.pathname.endsWith('.ts') || 
        url.pathname.endsWith('.mpd') || 
        url.pathname.endsWith('.m3u') ||
        url.search.includes('url=')
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Stratégie Cache-First avec repli Réseau pour les ressources de l'application et les logos
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            // Réalisation de la requête réseau
            return fetch(event.request).then(response => {
                // Mettre en cache de façon dynamique les images/logos chargés à la volée
                if (
                    response.ok && 
                    (event.request.destination === 'image' || 
                     url.pathname.endsWith('.png') || 
                     url.pathname.endsWith('.jpg') || 
                     url.pathname.endsWith('.jpeg') || 
                     url.pathname.endsWith('.svg') || 
                     url.pathname.endsWith('.webp'))
                ) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(err => {
                console.warn('[Service Worker] Échec de la récupération réseau pour :', event.request.url, err);
                // Vous pouvez retourner un fallback ici si nécessaire
            });
        })
    );
});
