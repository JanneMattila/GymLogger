// IndexedDB wrapper for offline storage
class OfflineStorage {
    constructor() {
        this.dbName = 'GymLoggerDB';
        this.version = 3;
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

                // Store for last workout weights per program (for instant weight pre-fill)
                if (!db.objectStoreNames.contains('lastWorkoutWeights')) {
                    const weightsStore = db.createObjectStore('lastWorkoutWeights', { keyPath: 'programId' });
                    weightsStore.createIndex('timestamp', 'timestamp', { unique: false });
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

    async deleteCacheEntriesByPrefix(prefix) {
        console.log(`[OfflineStorage] deleteCacheEntriesByPrefix(${prefix})`);
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.openCursor();
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.key.startsWith(prefix)) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    console.log(`[OfflineStorage] Deleted ${deletedCount} cache entries with prefix: ${prefix}`);
                    resolve(deletedCount);
                }
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

        // Invalidate caches so dashboard shows correct status
        // - active_session_me: needed for cancel (deleteSession doesn't clear it)
        // - programs_me: needed for program updates
        // - sessions_me_*: needed for complete (to show workout as done today)
        await this.deleteCacheEntry('active_session_me');
        await this.deleteCacheEntry('programs_me');
        await this.deleteCacheEntriesByPrefix('sessions_me_');

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

        const stores = ['cache', 'syncQueue', 'offlineWorkouts', 'draftWorkouts', 'lastWorkoutWeights'];
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

    /**
     * Save the last workout weights for a program.
     * @param {string} programId - The program ID
     * @param {Object} weightsMap - Map of exerciseId -> { weight, reps, timestamp }
     */
    async saveLastWorkoutWeights(programId, weightsMap) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lastWorkoutWeights'], 'readwrite');
            const store = transaction.objectStore('lastWorkoutWeights');
            const entry = {
                programId,
                weights: weightsMap,
                timestamp: Date.now()
            };

            const request = store.put(entry);
            request.onsuccess = () => {
                console.log(`[OfflineStorage] Saved last workout weights for program ${programId}`);
                resolve(entry);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get the last workout weights for a program.
     * @param {string} programId - The program ID
     * @returns {Object|null} Map of exerciseId -> { weight, reps, timestamp } or null if not found
     */
    async getLastWorkoutWeights(programId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['lastWorkoutWeights'], 'readonly');
            const store = transaction.objectStore('lastWorkoutWeights');
            const request = store.get(programId);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log(`[OfflineStorage] Found last workout weights for program ${programId}`);
                    resolve(result.weights);
                } else {
                    console.log(`[OfflineStorage] No last workout weights found for program ${programId}`);
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
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
