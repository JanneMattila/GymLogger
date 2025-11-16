const CACHE_VERSION = 'v00000000000000';
const CACHE_NAME = `gymlogger-${CACHE_VERSION}`;
const STATIC_CACHE = `gymlogger-static-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json',
    '/images/favicon-16x16.png',
    '/images/favicon-32x32.png',
    '/images/android-chrome-192x192.png',
    '/images/android-chrome-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== STATIC_CACHE && cache !== CACHE_NAME) {
                            console.log('Service Worker: Clearing old cache:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Taking control of all pages');
                return self.clients.claim();
            })
    );
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome extensions and other origins
    if (url.origin !== location.origin) {
        return;
    }

    // Static assets - cache first
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) || 
        url.pathname.startsWith('/css/') || 
        url.pathname.startsWith('/js/') || 
        url.pathname.startsWith('/images/')) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetch(request)
                    .then(fetchResponse => {
                        return caches.open(STATIC_CACHE).then(cache => {
                            cache.put(request, fetchResponse.clone());
                            return fetchResponse;
                        });
                    })
                )
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // API requests - network first, cache fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Only cache successful GET responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Try to serve from cache if offline
                    return caches.match(request)
                        .then(response => {
                            if (response) {
                                // Add offline header to cached responses
                                const headers = new Headers(response.headers);
                                headers.set('X-Offline-Response', 'true');
                                return new Response(response.body, {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: headers
                                });
                            }
                            // Return offline response
                            return new Response(
                                JSON.stringify({ error: 'Offline', offline: true }),
                                { 
                                    status: 503, 
                                    headers: { 'Content-Type': 'application/json' }
                                }
                            );
                        });
                })
        );
        return;
    }

    // Default - network first
    event.respondWith(
        fetch(request)
            .catch(() => caches.match(request))
            .catch(() => caches.match('/index.html'))
    );
});

// Message event for cache updates
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
