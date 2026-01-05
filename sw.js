// NextMeet Service Worker
const CACHE_NAME = 'nextmeet-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/meeting.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/rtc.js',
    '/js/media.js',
    '/js/chat.js',
    '/js/settings.js',
    '/js/ui.js',
    '/js/transcription.js',
    '/js/whiteboard.js',
    '/js/recording.js',
    '/manifest.json'
];

// Install Event - Cache assets
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim())
    );
});

// Fetch Event - Network first, then cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response
                const responseToCache = response.clone();
                
                // Cache the fetched response
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                
                return response;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        
                        // Return offline fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Background Sync for reconnection
self.addEventListener('sync', (event) => {
    if (event.tag === 'reconnect-meeting') {
        console.log('[ServiceWorker] Attempting to reconnect to meeting');
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'RECONNECT_MEETING'
                    });
                });
            })
        );
    }
});

// Push Notifications (for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'New notification',
            icon: '/assets/icons/icon-192.png',
            badge: '/assets/icons/badge-72.png',
            vibrate: [100, 50, 100],
            data: data.data || {},
            actions: [
                { action: 'join', title: '参加する' },
                { action: 'dismiss', title: '閉じる' }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'NextMeet', options)
        );
    }
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'join') {
        const meetingUrl = event.notification.data.meetingUrl;
        if (meetingUrl) {
            event.waitUntil(
                self.clients.openWindow(meetingUrl)
            );
        }
    }
});
