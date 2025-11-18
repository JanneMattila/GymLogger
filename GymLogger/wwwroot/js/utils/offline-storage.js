// IndexedDB wrapper for offline storage
class OfflineStorage {
    constructor() {
        this.dbName = 'GymLoggerDB';
        this.version = 2;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for cached API responses
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }

                // Store for pending sync operations
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Store for offline workout data
                if (!db.objectStoreNames.contains('offlineWorkouts')) {
                    const workoutStore = db.createObjectStore('offlineWorkouts', { keyPath: 'id' });
                    workoutStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Store for draft workout sessions (auto-save before submission)
                if (!db.objectStoreNames.contains('draftWorkouts')) {
                    const draftStore = db.createObjectStore('draftWorkouts', { keyPath: 'sessionId' });
                    draftStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async getFromCache(key) {
        console.log(`[OfflineStorage] ========== getFromCache ==========`);
        console.log(`[OfflineStorage] Key: ${key}`);
        console.log(`[OfflineStorage] DB initialized? ${!!this.db}`);
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            console.log(`[OfflineStorage] Creating transaction...`);
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                console.log(`[OfflineStorage] Raw IndexedDB result:`, result);
                
                if (!result) {
                    console.log(`[OfflineStorage] No entry found in IndexedDB`);
                    resolve(null);
                    return;
                }
                
                console.log(`[OfflineStorage] Entry found:`, {
                    key: result.key,
                    timestamp: result.timestamp,
                    ttl: result.ttl,
                    age: Date.now() - result.timestamp,
                    dataType: typeof result.data,
                    dataIsNull: result.data === null,
                    dataIsUndefined: result.data === undefined
                });
                
                console.log(`[OfflineStorage] Data value:`, result.data);
                
                const expired = this.isCacheExpired(result);
                console.log(`[OfflineStorage] Is expired? ${expired}`);
                
                if (expired) {
                    console.log(`[OfflineStorage] Cache EXPIRED - returning null`);
                    resolve(null);
                } else {
                    console.log(`[OfflineStorage] Cache VALID - returning data:`, result.data);
                    resolve(result.data);
                }
            };
            request.onerror = () => {
                console.error(`[OfflineStorage] IndexedDB error:`, request.error);
                reject(request.error);
            };
        });
    }

    async saveToCache(key, data, ttl = 3600000) { // Default 1 hour TTL
        console.log(`[OfflineStorage] saveToCache(${key})`, { ttl, dataType: typeof data });
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const cacheEntry = {
                key,
                data,
                timestamp: Date.now(),
                ttl
            };

            const request = store.put(cacheEntry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCacheEntry(key) {
        console.log(`[OfflineStorage] deleteCacheEntry(${key})`);
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');

            const request = store.delete(key);
            request.onsuccess = () => {
                console.log(`[OfflineStorage] Successfully deleted cache entry: ${key}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    isCacheExpired(cacheEntry) {
        return Date.now() - cacheEntry.timestamp > cacheEntry.ttl;
    }

    async addToSyncQueue(operation) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const syncItem = {
                ...operation,
                timestamp: Date.now()
            };

            const request = store.add(syncItem);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSyncQueue() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromSyncQueue(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveOfflineWorkout(workoutData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offlineWorkouts'], 'readwrite');
            const store = transaction.objectStore('offlineWorkouts');
            const workoutEntry = {
                id: `offline-${Date.now()}`,
                ...workoutData,
                timestamp: Date.now()
            };

            const request = store.put(workoutEntry);
            request.onsuccess = () => resolve(workoutEntry);
            request.onerror = () => reject(request.error);
        });
    }

    async getOfflineWorkouts() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offlineWorkouts'], 'readonly');
            const store = transaction.objectStore('offlineWorkouts');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeOfflineWorkout(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['offlineWorkouts'], 'readwrite');
            const store = transaction.objectStore('offlineWorkouts');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveDraftWorkout(sessionId, workoutData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['draftWorkouts'], 'readwrite');
            const store = transaction.objectStore('draftWorkouts');
            const draftEntry = {
                sessionId,
                ...workoutData,
                timestamp: Date.now()
            };

            const request = store.put(draftEntry);
            request.onsuccess = () => resolve(draftEntry);
            request.onerror = () => reject(request.error);
        });
    }

    async getDraftWorkout(sessionId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['draftWorkouts'], 'readonly');
            const store = transaction.objectStore('draftWorkouts');
            const request = store.get(sessionId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteDraftWorkout(sessionId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['draftWorkouts'], 'readwrite');
            const store = transaction.objectStore('draftWorkouts');
            const request = store.delete(sessionId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllDraftWorkouts() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['draftWorkouts'], 'readonly');
            const store = transaction.objectStore('draftWorkouts');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        if (!this.db) await this.init();

        const stores = ['cache', 'syncQueue', 'offlineWorkouts', 'draftWorkouts'];
        const promises = stores.map(storeName => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });

        return Promise.all(promises);
    }

    async deleteDatabase() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                reject(new Error('Database deletion blocked. Please close other Gym Logger tabs and try again.'));
            };
        });
    }
}

export const offlineStorage = new OfflineStorage();
