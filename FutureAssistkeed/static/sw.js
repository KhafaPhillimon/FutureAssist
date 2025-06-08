// Service Worker for FutureAssist PWA
// Handles caching, offline functionality, and background sync

const CACHE_NAME = 'futureassist-v1.0.0';
const DYNAMIC_CACHE = 'futureassist-dynamic-v1.0.0';

// Files to cache immediately (critical resources)
const STATIC_ASSETS = [
    '/',
    '/static/css/style.css',
    '/static/js/main.js',
    '/static/js/charts.js',
    '/static/js/offline.js',
    '/static/manifest.json',
    '/static/icons/icon-192.svg',
    '/static/icons/icon-512.svg',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Routes to cache dynamically
const DYNAMIC_ROUTES = [
    '/transactions',
    '/forecast',
    '/settings'
];

// API endpoints that should be cached for offline viewing
const CACHEABLE_APIS = [
    '/api/transactions',
    '/api/forecast',
    '/api/alerts/settings'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle different types of requests
    if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
    } else if (isAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isDynamicRoute(url)) {
        event.respondWith(handleDynamicRoute(request));
    } else {
        event.respondWith(handleOtherRequests(request));
    }
});

// Check if request is for a static asset
function isStaticAsset(url) {
    return url.pathname.startsWith('/static/') || 
           url.hostname !== location.hostname ||
           STATIC_ASSETS.some(asset => url.pathname === asset);
}

// Check if request is for an API endpoint
function isAPIRequest(url) {
    return url.pathname.startsWith('/api/');
}

// Check if request is for a dynamic route
function isDynamicRoute(url) {
    return DYNAMIC_ROUTES.includes(url.pathname);
}

// Handle static assets (cache first strategy)
async function handleStaticAsset(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Static asset fetch failed:', error);
        
        // Return cached version if available
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback for CSS/JS
        if (request.destination === 'style') {
            return new Response('/* Offline - styles unavailable */', {
                headers: { 'Content-Type': 'text/css' }
            });
        }
        
        if (request.destination === 'script') {
            return new Response('console.log("Offline - script unavailable");', {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        throw error;
    }
}

// Handle API requests (network first, then cache)
async function handleAPIRequest(request) {
    const url = new URL(request.url);
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok && shouldCacheAPI(url.pathname)) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: API request failed, checking cache...');
        
        // Try to return cached data for GET requests
        if (request.method === 'GET') {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                console.log('Service Worker: Returning cached API response');
                return cachedResponse;
            }
        }
        
        // Return offline fallback for specific endpoints
        return getOfflineFallback(url.pathname);
    }
}

// Handle dynamic routes (network first, cache fallback, offline page)
async function handleDynamicRoute(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Dynamic route failed, checking cache...');
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page
        return getOfflinePage();
    }
}

// Handle other requests (network only with fallback)
async function handleOtherRequests(request) {
    try {
        return await fetch(request);
    } catch (error) {
        // Return generic offline response
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Check if API endpoint should be cached
function shouldCacheAPI(pathname) {
    return CACHEABLE_APIS.some(api => pathname.startsWith(api));
}

// Get offline fallback for API endpoints
function getOfflineFallback(pathname) {
    if (pathname.includes('/api/transactions')) {
        return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    }
    
    if (pathname.includes('/api/forecast')) {
        return new Response(JSON.stringify({
            current_balance: 0,
            daily_forecasts: [],
            insights: [{
                type: 'info',
                title: 'Offline Mode',
                message: 'You are offline. Connect to the internet to get updated forecasts.',
                severity: 'low'
            }]
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    }
    
    if (pathname.includes('/api/alerts')) {
        return new Response(JSON.stringify({
            alert_threshold: 100,
            sms_alerts: false,
            whatsapp_alerts: false
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    }
    
    return new Response(JSON.stringify({
        error: 'Service unavailable offline'
    }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503
    });
}

// Get offline page
function getOfflinePage() {
    const offlineHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - FutureAssist</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background-color: #F5F7FA;
                    color: #2C3E50;
                    text-align: center;
                    padding: 20px;
                }
                .offline-container {
                    max-width: 400px;
                }
                .offline-icon {
                    font-size: 4rem;
                    color: #0a4d68;
                    margin-bottom: 1rem;
                }
                h1 {
                    color: #0a4d68;
                    margin-bottom: 1rem;
                }
                p {
                    line-height: 1.6;
                    margin-bottom: 2rem;
                }
                .retry-btn {
                    background-color: #0a4d68;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 1rem;
                    text-decoration: none;
                    display: inline-block;
                    transition: background-color 0.2s;
                }
                .retry-btn:hover {
                    background-color: #003d52;
                }
                .offline-features {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 2rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .offline-features h3 {
                    color: #0a4d68;
                    margin-bottom: 1rem;
                }
                .offline-features ul {
                    text-align: left;
                    margin: 0;
                    padding-left: 20px;
                }
                .offline-features li {
                    margin-bottom: 0.5rem;
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="offline-icon">📱</div>
                <h1>You're Offline</h1>
                <p>
                    Don't worry! FutureAssist works offline too. 
                    You can still add transactions and they'll be synced when you're back online.
                </p>
                
                <a href="/" class="retry-btn" onclick="window.location.reload()">
                    Try Again
                </a>
                
                <div class="offline-features">
                    <h3>Available Offline:</h3>
                    <ul>
                        <li>Add new transactions</li>
                        <li>View cached transaction history</li>
                        <li>Access saved forecasts</li>
                        <li>Modify settings</li>
                    </ul>
                </div>
            </div>
            
            <script>
                // Auto-retry when back online
                window.addEventListener('online', function() {
                    window.location.reload();
                });
                
                // Check if we can navigate to home
                if (window.location.pathname !== '/') {
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 5000);
                }
            </script>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        headers: { 'Content-Type': 'text/html' },
        status: 200
    });
}

// Background sync for offline transactions
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync-transactions') {
        event.waitUntil(syncOfflineTransactions());
    }
});

// Sync offline transactions
async function syncOfflineTransactions() {
    try {
        // Get offline transactions from IndexedDB
        const offlineTransactions = await getOfflineTransactions();
        
        if (offlineTransactions.length === 0) {
            console.log('Service Worker: No offline transactions to sync');
            return;
        }
        
        console.log(`Service Worker: Syncing ${offlineTransactions.length} offline transactions`);
        
        const syncPromises = offlineTransactions.map(async (transaction) => {
            try {
                const response = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(transaction.data)
                });
                
                if (response.ok) {
                    // Mark as synced
                    await markTransactionAsSynced(transaction.id);
                    console.log('Service Worker: Transaction synced successfully');
                } else {
                    console.error('Service Worker: Failed to sync transaction:', response.statusText);
                }
            } catch (error) {
                console.error('Service Worker: Sync error:', error);
            }
        });
        
        await Promise.all(syncPromises);
        
        // Notify clients about successful sync
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                success: true
            });
        });
        
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
    }
}

// Get offline transactions from IndexedDB
async function getOfflineTransactions() {
    // This would interact with IndexedDB
    // For now, return empty array as fallback
    return [];
}

// Mark transaction as synced
async function markTransactionAsSynced(transactionId) {
    // This would update the transaction in IndexedDB
    console.log('Service Worker: Marking transaction as synced:', transactionId);
}

// Handle push notifications
self.addEventListener('push', event => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'You have a new financial alert',
            icon: '/static/icons/icon-192.svg',
            badge: '/static/icons/icon-192.svg',
            image: data.image,
            data: data,
            actions: [
                {
                    action: 'view',
                    title: 'View',
                    icon: '/static/icons/icon-192.svg'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ],
            tag: data.tag || 'futureassist-notification',
            renotify: true,
            requireInteraction: data.requireInteraction || false
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'FutureAssist', options)
        );
    } catch (error) {
        console.error('Service Worker: Push notification error:', error);
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle messages from clients
self.addEventListener('message', event => {
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: CACHE_NAME
            });
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({
                    success: true
                });
            });
            break;
            
        default:
            console.log('Service Worker: Unknown message type:', type);
    }
});

// Clear all caches
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('Service Worker: All caches cleared');
}

console.log('Service Worker: Loaded successfully');
