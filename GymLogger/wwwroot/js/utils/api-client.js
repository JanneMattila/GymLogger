// API client for making HTTP requests
import { eventBus } from './event-bus.js?v=00000000000000';
import { userContext } from './user-context.js?v=00000000000000';
import { offlineManager } from './offline-manager.js?v=00000000000000';
import { offlineStorage } from './offline-storage.js?v=00000000000000';

const API_BASE = '/api';

class ApiClient {
    // User ID is now managed entirely by backend via authentication cookies
    // Frontend uses /api/users/me/... endpoints instead of passing user IDs


    async get(url, options = { cacheKey: null, cacheTTL: 3600000, showLoader: true, skipCache: false, preferCache: false }) {
        const showLoader = options.showLoader !== false;
        const skipCache = options.skipCache === true;
        const preferCache = options.preferCache === true;
        const online = navigator.onLine;
        
        if (showLoader) eventBus.emit('api:start');
        
        try {
            // Cache-first (stale-while-revalidate)
            if (preferCache && options.cacheKey && !skipCache) {
                const cached = await offlineManager.getCachedData(options.cacheKey);
                if (cached != null) {
                    if (showLoader) eventBus.emit('api:offline');
                    if (showLoader) eventBus.emit('api:end');

                    // Revalidate in background if online
                    if (online) {
                        this._revalidateGet(url, options.cacheKey, options.cacheTTL).catch(err => {
                            console.warn('[API] Revalidate failed:', err);
                        });
                    }

                    return {
                        source: 'cache',
                        online,
                        success: true,
                        data: cached
                    };
                }
            }

            // Network-first strategy when online
            if (online) {
                const response = await fetch(`${API_BASE}${url}`, {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    // Network error - try cache fallback (unless skipCache is true)
                    if (options.cacheKey && !skipCache) {
                        const cached = await offlineManager.getCachedData(options.cacheKey);
                        if (cached != null) {
                            if (showLoader) eventBus.emit('api:offline');
                            if (showLoader) eventBus.emit('api:end');
                            return {
                                source: 'cache',
                                online: true,
                                success: true,
                                data: cached
                            };
                        }
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                // Cache successful responses (unless skipCache is true)
                if (options.cacheKey && !skipCache) {
                    await offlineManager.cacheData(options.cacheKey, data, options.cacheTTL);
                }

                if (showLoader) eventBus.emit('api:success');
                if (showLoader) eventBus.emit('api:end');
                
                return {
                    source: 'network',
                    online: true,
                    success: true,
                    data: data
                };
            }
            
            // Offline - try cache (unless skipCache is true)
            if (options.cacheKey && !skipCache) {
                const cached = await offlineManager.getCachedData(options.cacheKey);
                if (cached != null) {
                    if (showLoader) eventBus.emit('api:offline');
                    if (showLoader) eventBus.emit('api:end');
                    return {
                        source: 'cache',
                        online: false,
                        success: true,
                        data: cached
                    };
                }
            }
            
            // Offline, no cache
            if (showLoader) eventBus.emit('api:offline');
            if (showLoader) eventBus.emit('api:end');
            return {
                source: 'none',
                online: false,
                success: false,
                data: null,
                error: 'No cached data available'
            };
            
        } catch (error) {
            console.error(`[API] Error fetching ${url}:`, error.message);
            
            // Try cache fallback on error (if online and fetch failed)
            if (online && options.cacheKey) {
                const cached = await offlineManager.getCachedData(options.cacheKey);
                if (cached !== undefined && cached !== null) {
                    if (showLoader) eventBus.emit('api:offline');
                    if (showLoader) eventBus.emit('api:end');
                    return {
                        source: 'cache',
                        online: true,
                        success: true,
                        data: cached
                    };
                }
            }
            
            if (showLoader) eventBus.emit('api:error', error);
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'none',
                online: online,
                success: false,
                data: null,
                error: error.message
            };
        }
    }

    // Background revalidation for preferCache (stale-while-revalidate)
    async _revalidateGet(url, cacheKey, cacheTTL) {
        const response = await fetch(`${API_BASE}${url}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (cacheKey) {
            await offlineManager.cacheData(cacheKey, data, cacheTTL);
        }
        return data;
    }

    async post(url, data, options = { showLoader: true, queueOffline: false }) {
        const showLoader = options.showLoader !== false;
        const online = navigator.onLine;
        
        if (showLoader) eventBus.emit('api:start');
        
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            if (showLoader) eventBus.emit('api:success');
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'network',
                online: true,
                success: true,
                data: result
            };
        } catch (error) {
            // Queue operation if offline and queueOffline is enabled
            const isNetworkError = error.message.includes('Failed to fetch') || 
                                   error.message.includes('NetworkError') || 
                                   !online;
            
            if (options.queueOffline && isNetworkError) {
                await offlineManager.queueOperation({
                    method: 'POST',
                    url: `${API_BASE}${url}`,
                    body: data,
                    headers: { 'Content-Type': 'application/json' }
                });
                eventBus.emit('api:queued');
                if (showLoader) eventBus.emit('api:end');
                
                return {
                    source: 'queued',
                    online: false,
                    success: true,
                    data: { queued: true }
                };
            }
            
            console.error(`[API] POST ${url} failed:`, error.message);
            eventBus.emit('api:error', error);
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'none',
                online: online,
                success: false,
                data: null,
                error: error.message
            };
        }
    }

    async put(url, data, options = { showLoader: true, queueOffline: false }) {
        const showLoader = options.showLoader !== false;
        const online = navigator.onLine;
        
        if (showLoader) eventBus.emit('api:start');
        
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            if (showLoader) eventBus.emit('api:success');
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'network',
                online: true,
                success: true,
                data: result
            };
        } catch (error) {
            // Queue operation if offline and queueOffline is enabled
            const isNetworkError = error.message.includes('Failed to fetch') || 
                                   error.message.includes('NetworkError') || 
                                   !online;
            
            if (options.queueOffline && isNetworkError) {
                await offlineManager.queueOperation({
                    method: 'PUT',
                    url: `${API_BASE}${url}`,
                    body: data,
                    headers: { 'Content-Type': 'application/json' }
                });
                eventBus.emit('api:queued');
                if (showLoader) eventBus.emit('api:end');
                
                return {
                    source: 'queued',
                    online: false,
                    success: true,
                    data: { queued: true }
                };
            }
            
            eventBus.emit('api:error', error);
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'none',
                online: online,
                success: false,
                data: null,
                error: error.message
            };
        }
    }

    async patch(url) {
        const online = navigator.onLine;
        eventBus.emit('api:start');
        
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'PATCH',
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            eventBus.emit('api:success');
            eventBus.emit('api:end');
            
            // Check if response has content
            const contentType = response.headers.get('content-type');
            let result = null;
            if (response.status !== 204 && contentType && contentType.includes('application/json')) {
                result = await response.json();
            }
            
            return {
                source: 'network',
                online: true,
                success: true,
                data: result
            };
        } catch (error) {
            eventBus.emit('api:error', error);
            eventBus.emit('api:end');
            
            return {
                source: 'none',
                online: online,
                success: false,
                data: null,
                error: error.message
            };
        }
    }

    async delete(url, options = { showLoader: true, queueOffline: false }) {
        const showLoader = options.showLoader !== false;
        const online = navigator.onLine;
        
        if (showLoader) eventBus.emit('api:start');
        
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            if (showLoader) eventBus.emit('api:success');
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'network',
                online: true,
                success: true,
                data: true
            };
        } catch (error) {
            // Queue operation if offline and queueOffline is enabled
            const isNetworkError = error.message.includes('Failed to fetch') || 
                                   error.message.includes('NetworkError') || 
                                   !online;
            
            if (options.queueOffline && isNetworkError) {
                await offlineManager.queueOperation({
                    method: 'DELETE',
                    url: `${API_BASE}${url}`,
                    headers: {}
                });
                eventBus.emit('api:queued');
                if (showLoader) eventBus.emit('api:end');
                
                return {
                    source: 'queued',
                    online: false,
                    success: true,
                    data: { queued: true }
                };
            }
            
            eventBus.emit('api:error', error);
            if (showLoader) eventBus.emit('api:end');
            
            return {
                source: 'none',
                online: online,
                success: false,
                data: false,
                error: error.message
            };
        }
    }

    // Helper methods for common endpoints
    async getExercises(options = {}) {
        const response = await this.get('/exercises', { 
            cacheKey: 'exercises', 
            cacheTTL: 2592000000, // 30 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async createExercise(exercise) {
        return this.post('/exercises', exercise, { queueOffline: true });
    }

    async getPrograms(dayOfWeek = null, options = {}) {
        const query = dayOfWeek !== null ? `?day=${dayOfWeek}` : '';
        const response = await this.get(`/users/me/programs${query}`, {
            cacheKey: `programs_me`,
            cacheTTL: 2592000000, // 30 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async getProgram(programId, options = {}) {
        return this.get(`/users/me/programs/${programId}`, {
            cacheKey: `program_${programId}`,
            cacheTTL: 2592000000, // 30 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
    }

    async createProgram(program) {
        const response = await this.post(`/users/me/programs`, program, { queueOffline: true });
        // Invalidate programs cache after creating (only if successful and not queued)
        if (response.success && response.source !== 'queued') {
            await this.invalidateProgramsCache();
        }
        return response;
    }

    async updateProgram(programId, program) {
        const response = await this.put(`/users/me/programs/${programId}`, program, { queueOffline: true });
        // Invalidate programs cache after updating (only if successful and not queued)
        if (response.success && response.source !== 'queued') {
            await this.invalidateProgramsCache();
        }
        return response;
    }

    async invalidateProgramsCache() {
        const cacheKey = 'programs_me';
        await offlineStorage.deleteCacheEntry(cacheKey);
    }

    async setDefaultProgram(programId) {
        return this.patch(`/users/me/programs/${programId}/set-default`);
    }

    async getActiveSession(options = {}) {
        return this.get(`/users/me/sessions/active`, {
            cacheKey: `active_session_me`,
            cacheTTL: 604800000, // 7 days
            showLoader: options.showLoader,
            skipCache: options.skipCache,
            preferCache: options.preferCache
        });
    }

    async getLastSessionForProgram(programId, options = {}) {
        return this.get(`/users/me/sessions/last-for-program/${programId}`, {
            cacheKey: `last_session_program_me_${programId}`,
            cacheTTL: 604800000, // 7 days
            showLoader: options.showLoader,
            skipCache: options.skipCache,
            preferCache: options.preferCache
        });
    }

    async createSession(session) {
        const response = await this.post(`/users/me/sessions`, session, { showLoader: false, queueOffline: true });
        
        // If queued offline, create temporary session with ID for offline use
        if (response.source === 'queued') {
            const tempSession = {
                ...session,
                id: `temp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                startedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                _pendingSync: true
            };
            return {
                ...response,
                data: tempSession
            };
        }
        
        // If online and successful, update active session cache
        if (response.success && response.source === 'network') {
            const cacheKey = `active_session_me`;
            await offlineStorage.saveToCache(cacheKey, response.data, 604800000);
        }
        
        return response;
    }

    async updateSession(sessionId, session) {
        // Completing or canceling workout is online-only operation
        const isCompletingOrCanceling = session.status === 'completed' || session.status === 'cancelled';
        const queueOffline = !isCompletingOrCanceling;
        
        console.log(`[updateSession] Before PUT - Status: ${session.status}, Completing/Canceling: ${isCompletingOrCanceling}`);
        
        const response = await this.put(`/users/me/sessions/${sessionId}`, session, { showLoader: false, queueOffline });
        
        console.log(`[updateSession] After PUT - Success: ${response.success}, Source: ${response.source}`);
        
        // If online and successful, update cache immediately
        if (response.success && response.source === 'network') {
            const cacheKey = `active_session_me`;
            
            // If session was completed or cancelled, there's no active session anymore
            // Always cache null to ensure dashboard shows no active session
            if (isCompletingOrCanceling) {
                console.log(`[updateSession] Setting cache to null for completed/cancelled workout`);
                await offlineStorage.saveToCache(cacheKey, null, 604800000);
            } else {
                // Otherwise update the cache with the updated session
                console.log(`[updateSession] Updating cache with session data`);
                await offlineStorage.saveToCache(cacheKey, response.data, 604800000);
            }
        }
        
        console.log(`[updateSession] Cache update complete`);
        return response;
    }

    async cleanupSession(sessionId) {
        // Cleanup is online-only operation - check connection first
        if (!navigator.onLine) {
            throw new Error('Cannot cancel workout while offline. Please connect to the internet.');
        }
        
        const response = await fetch(`${API_BASE}/users/me/sessions/${sessionId}/cleanup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Update the active session cache to null (no active session after cleanup)
        // Always update to ensure dashboard shows no active session
        await offlineStorage.saveToCache('active_session_me', null, 604800000);
        
        // Cleanup returns Ok() with no body, check if there's JSON to parse
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return true;
    }

    /**
     * Sync a local session with all its sets to the server in a single batch operation.
     * This is called when completing a workout that was created locally.
     * @param {Object} session - The local session to sync
     * @param {Array} sets - The sets to sync with the session
     * @returns {Object} Response with server-assigned IDs for session and sets
     */
    async syncLocalSession(session, sets) {
        if (!navigator.onLine) {
            return {
                success: false,
                error: 'Cannot sync session while offline.'
            };
        }

        eventBus.emit('api:start');
        
        try {
            // Prepare the batch payload
            const payload = {
                session: {
                    programId: session.programId,
                    programName: session.programName,
                    sessionDate: session.sessionDate,
                    status: session.status,
                    startedAt: session.startedAt
                },
                sets: sets.map(set => ({
                    exerciseId: set.exerciseId,
                    programExerciseId: set.programExerciseId,
                    setNumber: set.setNumber,
                    weight: set.weight,
                    reps: set.reps,
                    isWarmup: set.isWarmup || false,
                    restSeconds: set.restSeconds,
                    notes: set.notes,
                    timestamp: set.loggedAt || set.createdAt
                }))
            };

            const response = await fetch(`${API_BASE}/users/me/sessions/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Update active session cache with the new server session
            await offlineStorage.saveToCache('active_session_me', result.session, 604800000);

            eventBus.emit('api:success');
            eventBus.emit('api:end');
            
            return {
                success: true,
                source: 'network',
                data: result
            };
        } catch (error) {
            console.error('[API] Error syncing local session:', error);
            eventBus.emit('api:error', error);
            eventBus.emit('api:end');
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getSetsForSession(sessionId, options = {}) {
        const response = await this.get(`/users/me/sessions/${sessionId}/sets`, {
            cacheKey: `sets_${sessionId}`,
            cacheTTL: 604800000, // 7 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async addSet(sessionId, set) {
        const response = await this.post(`/users/me/sessions/${sessionId}/sets`, set, { showLoader: false, queueOffline: true });
        
        // If online and successful, refresh active session cache
        if (response.success && response.source === 'network') {
            try {
                const activeSession = await this.get(`/users/me/sessions/active`, { showLoader: false });
                if (activeSession.success && activeSession.data) {
                    const cacheKey = `active_session_me`;
                    await offlineStorage.saveToCache(cacheKey, activeSession.data, 604800000);
                }
            } catch (error) {
                console.warn('API - Could not refresh active session cache:', error);
            }
        }
        
        // If queued offline, return response with temporary ID in data
        if (response.source === 'queued') {
            return {
                ...response,
                data: {
                    ...set,
                    id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    _pendingSync: true
                }
            };
        }
        
        return response;
    }

    async updateSet(sessionId, setId, set) {
        const response = await this.put(`/users/me/sessions/${sessionId}/sets/${setId}`, set, { showLoader: false, queueOffline: true });
        
        // If online and successful, refresh active session cache
        if (response.success && response.source === 'network') {
            try {
                const activeSession = await this.get(`/users/me/sessions/active`, { showLoader: false });
                if (activeSession.success && activeSession.data) {
                    const cacheKey = `active_session_me`;
                    await offlineStorage.saveToCache(cacheKey, activeSession.data, 604800000);
                }
            } catch (error) {
                console.warn('API - Could not refresh active session cache:', error);
            }
        }
        
        return response;
    }

    async deleteSet(sessionId, setId) {
        const response = await this.delete(`/users/me/sessions/${sessionId}/sets/${setId}`, { showLoader: false, queueOffline: true });
        
        // If online and successful, refresh active session cache
        if (response.success && response.source === 'network') {
            try {
                const activeSession = await this.get(`/users/me/sessions/active`, { showLoader: false });
                if (activeSession.success && activeSession.data) {
                    const cacheKey = `active_session_me`;
                    await offlineStorage.saveToCache(cacheKey, activeSession.data, 604800000);
                }
            } catch (error) {
                console.warn('API - Could not refresh active session cache:', error);
            }
        }
        
        return response;
    }

    async deleteSession(sessionId) {
        return this.delete(`/users/me/sessions/${sessionId}`, { showLoader: true, queueOffline: true });
    }

    async getPreferences(options = {}) {
        const response = await this.get(`/users/me/preferences`, {
            cacheKey: `preferences_me`,
            cacheTTL: 2592000000, // 30 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
        
        // Backend returns { userId, preferences }, extract preferences
        if (response.success && response.data) {
            return {
                ...response,
                data: response.data.preferences || response.data
            };
        }
        
        return response;
    }

    async updatePreferences(preferences) {
        return this.put(`/users/me/preferences`, preferences, { queueOffline: true });
    }

    async getTemplates(options = {}) {
        const response = await this.get('/templates', {
            cacheKey: 'templates',
            cacheTTL: 2592000000, // 30 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async getStatsByExercise() {
        const response = await this.get(`/users/me/stats/by-exercise`, {
            cacheKey: `stats_exercise_me`,
            cacheTTL: 3600000 // 1 hour
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async getStatsByProgram(programId) {
        return this.get(`/users/me/stats/by-program/${programId}`, {
            cacheKey: `stats_program_${programId}`,
            cacheTTL: 3600000 // 1 hour
        });
    }

    async getStatsByMuscle(muscleGroup) {
        const response = await this.get(`/users/me/stats/by-muscle?muscleGroup=${muscleGroup}`, {
            cacheKey: `stats_muscle_${muscleGroup}`,
            cacheTTL: 3600000 // 1 hour
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async getExerciseHistory(exerciseId) {
        const response = await this.get(`/users/me/stats/history/${exerciseId}`, {
            cacheKey: `history_${exerciseId}`,
            cacheTTL: 3600000 // 1 hour
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async getBodyMap() {
        return this.get(`/users/me/stats/body-map`, {
            cacheKey: `bodymap_me`,
            cacheTTL: 3600000 // 1 hour
        });
    }

    async getStrengthStandards() {
        return this.get(`/users/me/stats/strength-standards`, {
            cacheKey: `strength_standards`,
            cacheTTL: 86400000 // 24 hours - these rarely change
        });
    }

    async getSessions(startDate, endDate, options = {}) {
        const response = await this.get(`/users/me/sessions?startDate=${startDate}&endDate=${endDate}`, {
            cacheKey: `sessions_me_${startDate}_${endDate}`,
            cacheTTL: 604800000, // 7 days
            showLoader: options.showLoader,
            preferCache: options.preferCache
        });
        // Collection endpoint - guarantee empty array
        return {
            ...response,
            data: response.data || []
        };
    }

    async deleteProgram(programId) {
        const response = await this.delete(`/users/me/programs/${programId}`, { queueOffline: true });
        // Invalidate programs cache after deleting (only if successful and not queued)
        if (response.success && response.source !== 'queued') {
            await this.invalidateProgramsCache();
        }
        return response;
    }

    async exportAllPrograms() {
        return await this.get('/users/me/programs/export');
    }

    async exportProgram(programId) {
        return await this.get(`/users/me/programs/${programId}/export`);
    }

    async importPrograms(programs) {
        const response = await this.post('/users/me/programs/import', programs);
        // Invalidate programs cache after importing
        if (response.success) {
            await this.invalidateProgramsCache();
        }
        return response;
    }

    // Clear all cached data (for debugging or manual refresh)
    async clearAllCache() {
        await offlineStorage.clearAll();
        console.log('[API] All caches cleared - please refresh the page');
    }

    async submitWorkoutIntegration(sessionId) {
        // Integration submission is online-only
        if (!navigator.onLine) {
            return {
                success: false,
                error: 'Cannot submit integration while offline. Please connect to the internet.'
            };
        }

        eventBus.emit('api:start');
        
        try {
            const response = await fetch(`${API_BASE}/users/me/sessions/${sessionId}/submit-integration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({})
            });

            const data = await response.json();
            
            if (!response.ok) {
                eventBus.emit('api:error');
                eventBus.emit('api:end');
                return {
                    success: false,
                    error: data.error || `HTTP error! status: ${response.status}`
                };
            }

            eventBus.emit('api:success');
            eventBus.emit('api:end');
            
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('[API] Error submitting workout integration:', error);
            eventBus.emit('api:error');
            eventBus.emit('api:end');
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export const api = new ApiClient();
