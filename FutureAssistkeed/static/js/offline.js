// Offline functionality for FutureAssist
// Handles service worker registration, offline storage, and data synchronization

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.syncInProgress = false;
        this.dbName = 'FutureAssistDB';
        this.dbVersion = 1;
        this.db = null;
        
        this.init();
    }
    
    async init() {
        // Initialize IndexedDB
        await this.initDB();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load offline queue from localStorage
        this.loadOfflineQueue();
        
        // Initial online status check
        this.updateOnlineStatus();
        
        console.log('OfflineManager initialized');
    }
    
    // Initialize IndexedDB for offline storage
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores for offline data
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    transactionStore.createIndex('timestamp', 'timestamp', { unique: false });
                    transactionStore.createIndex('synced', 'synced', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('forecasts')) {
                    const forecastStore = db.createObjectStore('forecasts', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    forecastStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                console.log('IndexedDB schema created');
            };
        });
    }
    
    // Setup event listeners for online/offline status
    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateOnlineStatus();
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateOnlineStatus();
        });
        
        // Intercept form submissions for offline handling
        document.addEventListener('submit', (e) => {
            if (!this.isOnline) {
                this.handleOfflineFormSubmission(e);
            }
        });
        
        // Intercept API calls for offline queueing
        this.interceptFetchRequests();
    }
    
    // Update UI based on online status
    updateOnlineStatus() {
        const offlineIndicator = document.getElementById('offline-indicator');
        const onlineStatusElements = document.querySelectorAll('[data-online-only]');
        const offlineStatusElements = document.querySelectorAll('[data-offline-only]');
        
        if (this.isOnline) {
            if (offlineIndicator) {
                offlineIndicator.style.display = 'none';
            }
            
            onlineStatusElements.forEach(el => {
                el.style.display = '';
                el.disabled = false;
            });
            
            offlineStatusElements.forEach(el => {
                el.style.display = 'none';
            });
            
            // Show sync notification if there's offline data
            if (this.offlineQueue.length > 0) {
                this.showSyncNotification();
            }
        } else {
            if (offlineIndicator) {
                offlineIndicator.style.display = 'block';
            }
            
            onlineStatusElements.forEach(el => {
                el.style.display = 'none';
                el.disabled = true;
            });
            
            offlineStatusElements.forEach(el => {
                el.style.display = '';
            });
            
            this.showOfflineNotification();
        }
    }
    
    // Handle form submissions when offline
    handleOfflineFormSubmission(event) {
        const form = event.target;
        const action = form.action || window.location.href;
        const method = form.method || 'GET';
        
        // Only handle transaction-related forms offline
        if (action.includes('/api/transactions') || form.id === 'addTransactionForm') {
            event.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            this.saveTransactionOffline(data);
            
            if (window.FutureAssist && window.FutureAssist.showToast) {
                window.FutureAssist.showToast(
                    'Transaction saved offline. It will be synced when you\'re back online.',
                    'info'
                );
            }
            
            // Reset form
            form.reset();
            
            // Close modal if it's in one
            const modal = form.closest('.modal');
            if (modal) {
                const bootstrapModal = bootstrap.Modal.getInstance(modal);
                if (bootstrapModal) {
                    bootstrapModal.hide();
                }
            }
        }
    }
    
    // Save transaction to offline storage
    async saveTransactionOffline(transactionData) {
        const transaction = {
            ...transactionData,
            timestamp: new Date().toISOString(),
            synced: false,
            offline: true
        };
        
        try {
            // Save to IndexedDB
            await this.saveToIndexedDB('transactions', transaction);
            
            // Add to sync queue
            this.offlineQueue.push({
                type: 'transaction',
                data: transaction,
                endpoint: '/api/transactions',
                method: 'POST'
            });
            
            this.saveOfflineQueue();
            this.updateOfflineCounter();
            
            console.log('Transaction saved offline:', transaction);
        } catch (error) {
            console.error('Failed to save transaction offline:', error);
        }
    }
    
    // Save data to IndexedDB
    async saveToIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Get data from IndexedDB
    async getFromIndexedDB(storeName, query = null) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = query ? store.get(query) : store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Load offline data for display
    async loadOfflineTransactions() {
        try {
            const transactions = await this.getFromIndexedDB('transactions');
            const offlineTransactions = transactions.filter(t => !t.synced);
            
            return offlineTransactions.map(t => ({
                ...t,
                description: t.description + ' (Offline)',
                amount: parseFloat(t.amount || t.transactionAmount || 0)
            }));
        } catch (error) {
            console.error('Failed to load offline transactions:', error);
            return [];
        }
    }
    
    // Sync offline data when back online
    async syncOfflineData() {
        if (this.syncInProgress || !this.isOnline || this.offlineQueue.length === 0) {
            return;
        }
        
        this.syncInProgress = true;
        let syncedCount = 0;
        let failedCount = 0;
        
        console.log(`Starting sync of ${this.offlineQueue.length} items`);
        
        for (let i = 0; i < this.offlineQueue.length; i++) {
            const item = this.offlineQueue[i];
            
            try {
                const response = await fetch(item.endpoint, {
                    method: item.method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(item.data)
                });
                
                if (response.ok) {
                    // Mark as synced in IndexedDB
                    await this.markAsSynced(item.type, item.data.id || item.data.timestamp);
                    syncedCount++;
                } else {
                    failedCount++;
                    console.error('Failed to sync item:', response.statusText);
                }
            } catch (error) {
                failedCount++;
                console.error('Sync error:', error);
            }
        }
        
        // Remove successfully synced items from queue
        this.offlineQueue = this.offlineQueue.filter((item, index) => index >= syncedCount);
        this.saveOfflineQueue();
        this.updateOfflineCounter();
        
        this.syncInProgress = false;
        
        // Show sync results
        if (syncedCount > 0) {
            if (window.FutureAssist && window.FutureAssist.showToast) {
                window.FutureAssist.showToast(
                    `Successfully synced ${syncedCount} item(s)!`,
                    'success'
                );
            }
            
            // Reload page data
            setTimeout(() => {
                if (typeof loadTransactions === 'function') {
                    loadTransactions();
                }
                if (typeof loadDashboardData === 'function') {
                    loadDashboardData();
                }
            }, 1000);
        }
        
        if (failedCount > 0) {
            if (window.FutureAssist && window.FutureAssist.showToast) {
                window.FutureAssist.showToast(
                    `Failed to sync ${failedCount} item(s). Will retry later.`,
                    'warning'
                );
            }
        }
        
        console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);
    }
    
    // Mark item as synced in IndexedDB
    async markAsSynced(type, identifier) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            
            const storeName = type === 'transaction' ? 'transactions' : type;
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Find and update the record
            const index = store.index('timestamp');
            const request = index.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    if (record.timestamp === identifier || record.id === identifier) {
                        record.synced = true;
                        const updateRequest = cursor.update(record);
                        updateRequest.onsuccess = () => resolve();
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        cursor.continue();
                    }
                } else {
                    resolve(); // Record not found, but that's ok
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // Intercept fetch requests for offline handling
    interceptFetchRequests() {
        const originalFetch = window.fetch;
        
        window.fetch = async (url, options = {}) => {
            try {
                const response = await originalFetch(url, options);
                
                // Cache successful GET requests for offline viewing
                if (response.ok && options.method === 'GET' && url.includes('/api/')) {
                    this.cacheResponse(url, response.clone());
                }
                
                return response;
            } catch (error) {
                // If offline and it's a GET request, try to serve from cache
                if (!this.isOnline && (!options.method || options.method === 'GET')) {
                    const cachedResponse = await this.getCachedResponse(url);
                    if (cachedResponse) {
                        return new Response(cachedResponse, {
                            status: 200,
                            statusText: 'OK (Cached)',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
                
                throw error;
            }
        };
    }
    
    // Cache API responses
    async cacheResponse(url, response) {
        try {
            const data = await response.json();
            localStorage.setItem(`cache_${url}`, JSON.stringify({
                data: data,
                timestamp: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            }));
        } catch (error) {
            console.error('Failed to cache response:', error);
        }
    }
    
    // Get cached API response
    async getCachedResponse(url) {
        try {
            const cached = localStorage.getItem(`cache_${url}`);
            if (cached) {
                const cacheData = JSON.parse(cached);
                if (Date.now() < cacheData.expires) {
                    return JSON.stringify(cacheData.data);
                } else {
                    localStorage.removeItem(`cache_${url}`);
                }
            }
        } catch (error) {
            console.error('Failed to get cached response:', error);
        }
        return null;
    }
    
    // Save offline queue to localStorage
    saveOfflineQueue() {
        try {
            localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }
    
    // Load offline queue from localStorage
    loadOfflineQueue() {
        try {
            const stored = localStorage.getItem('offline_queue');
            if (stored) {
                this.offlineQueue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.offlineQueue = [];
        }
    }
    
    // Update offline counter in UI
    updateOfflineCounter() {
        const counter = document.getElementById('offline-counter');
        if (counter) {
            if (this.offlineQueue.length > 0) {
                counter.textContent = this.offlineQueue.length;
                counter.style.display = 'inline';
            } else {
                counter.style.display = 'none';
            }
        }
    }
    
    // Show offline notification
    showOfflineNotification() {
        if (window.FutureAssist && window.FutureAssist.showToast) {
            window.FutureAssist.showToast(
                'You are now offline. You can still add transactions and they will be synced when you\'re back online.',
                'warning',
                10000
            );
        }
    }
    
    // Show sync notification
    showSyncNotification() {
        if (window.FutureAssist && window.FutureAssist.showToast) {
            window.FutureAssist.showToast(
                `You have ${this.offlineQueue.length} item(s) to sync. Syncing now...`,
                'info'
            );
        }
    }
    
    // Clear all offline data (for testing or reset)
    async clearOfflineData() {
        try {
            // Clear IndexedDB
            if (this.db) {
                const transaction = this.db.transaction(['transactions', 'forecasts', 'settings'], 'readwrite');
                await Promise.all([
                    new Promise(resolve => {
                        const clear = transaction.objectStore('transactions').clear();
                        clear.onsuccess = resolve;
                    }),
                    new Promise(resolve => {
                        const clear = transaction.objectStore('forecasts').clear();
                        clear.onsuccess = resolve;
                    }),
                    new Promise(resolve => {
                        const clear = transaction.objectStore('settings').clear();
                        clear.onsuccess = resolve;
                    })
                ]);
            }
            
            // Clear offline queue
            this.offlineQueue = [];
            this.saveOfflineQueue();
            
            // Clear cached responses
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('cache_')) {
                    localStorage.removeItem(key);
                }
            });
            
            console.log('All offline data cleared');
        } catch (error) {
            console.error('Failed to clear offline data:', error);
        }
    }
    
    // Get offline statistics
    getOfflineStats() {
        return {
            isOnline: this.isOnline,
            queueLength: this.offlineQueue.length,
            syncInProgress: this.syncInProgress,
            hasOfflineData: this.offlineQueue.length > 0
        };
    }
}

// Initialize offline manager
const offlineManager = new OfflineManager();

// Export for global access
window.OfflineManager = offlineManager;

// Add offline status to page load events
document.addEventListener('DOMContentLoaded', function() {
    // Add offline counter to navbar if not present
    const navbar = document.querySelector('.navbar');
    if (navbar && !document.getElementById('offline-counter')) {
        const counter = document.createElement('span');
        counter.id = 'offline-counter';
        counter.className = 'badge bg-warning ms-2';
        counter.style.display = 'none';
        counter.title = 'Items waiting to sync';
        
        const navbarBrand = navbar.querySelector('.navbar-brand');
        if (navbarBrand) {
            navbarBrand.appendChild(counter);
        }
    }
    
    // Update initial counter
    offlineManager.updateOfflineCounter();
});

console.log('Offline.js initialized successfully');
