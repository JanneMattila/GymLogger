import { offlineStorage } from './offline-storage.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';
import { eventBus } from './event-bus.js?v=00000000000000';

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            console.log('Connection restored');
            this.isOnline = true;
            notification.success('Connection restored! Syncing data...');
            this.syncPendingOperations();
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            this.isOnline = false;
            notification.warning('You are offline. Changes will be saved locally.');
        });
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered:', registration);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('New service worker found, installing...');
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New service worker installed, showing update notification');
                            this.showUpdateNotification();
                        }
                    });
                });

                // Check for updates when page becomes visible
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) {
                        console.log('Page visible, checking for updates...');
                        registration.update();
                    }
                });

                return registration;
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    async init() {
        await this.registerServiceWorker();
        await offlineStorage.init();
        
        // Sync any pending operations on startup
        if (this.isOnline) {
            await this.syncPendingOperations();
        }
    }

    async cacheData(key, data, ttl) {
        try {
            await offlineStorage.saveToCache(key, data, ttl);
        } catch (error) {
            console.error('Failed to cache data:', error);
        }
    }

    async getCachedData(key) {
        try {
            const result = await offlineStorage.getFromCache(key);
            return result;
        } catch (error) {
            console.error('[OfflineManager] Error getting cached data:', error);
            return null;
        }
    }

    async queueOperation(operation) {
        try {
            const id = await offlineStorage.addToSyncQueue(operation);
            console.log('Operation queued for sync:', id);
            return id;
        } catch (error) {
            console.error('Failed to queue operation:', error);
            throw error;
        }
    }

    showUpdateNotification() {
        // Create a modal overlay for mandatory app updates
        const overlay = document.createElement('div');
        overlay.id = 'app-update-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease-out;
        `;
        
        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: 40px;
                max-width: 500px;
                margin: 20px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: scaleIn 0.3s ease-out;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                ">
                    🎉
                </div>
                <h2 style="
                    margin: 0 0 16px;
                    font-size: 24px;
                    color: #1a1a1a;
                    font-weight: 700;
                ">Update Available</h2>
                <p style="
                    margin: 0 0 32px;
                    font-size: 16px;
                    color: #666;
                    line-height: 1.6;
                ">
                    A new version of Gym Logger is available with improvements and fixes. 
                    Please update now to continue using the app.
                </p>
                <button id="update-app-btn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 16px 48px;
                    border-radius: 28px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
                    width: 100%;
                    max-width: 300px;
                ">Update Now</button>
                <p style="
                    margin: 20px 0 0;
                    font-size: 13px;
                    color: #999;
                ">This update is required to continue</p>
            </div>
        `;
        
        // Remove any existing overlay
        const existing = document.getElementById('app-update-overlay');
        if (existing) existing.remove();
        
        document.body.appendChild(overlay);
        
        // Add hover effect
        const updateBtn = document.getElementById('update-app-btn');
        updateBtn.addEventListener('mouseenter', () => {
            updateBtn.style.transform = 'scale(1.05)';
            updateBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
        });
        updateBtn.addEventListener('mouseleave', () => {
            updateBtn.style.transform = 'scale(1)';
            updateBtn.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
        });
        
        updateBtn.addEventListener('click', () => {
            console.log('User clicked update, reloading page...');
            window.location.reload();
        });
        
        // Add animations
        if (!document.getElementById('update-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'update-modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                @keyframes scaleIn {
                    from {
                        transform: scale(0.9);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    async syncPendingOperations() {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }

        this.syncInProgress = true;

        try {
            const queue = await offlineStorage.getSyncQueue();
            
            if (queue.length === 0) {
                return;
            }

            console.log(`Syncing ${queue.length} pending operations...`);

            let successCount = 0;
            let failCount = 0;
            const failureDetails = [];

            for (const item of queue) {
                try {
                    const response = await fetch(item.url, {
                        method: item.method,
                        headers: item.headers || { 'Content-Type': 'application/json' },
                        body: item.body ? JSON.stringify(item.body) : undefined,
                        credentials: 'include'
                    });

                    if (response.ok) {
                        await offlineStorage.removeFromSyncQueue(item.id);
                        
                        // If it was an offline workout, remove it too
                        if (item.offlineWorkoutId) {
                            await offlineStorage.removeOfflineWorkout(item.offlineWorkoutId);
                        }
                        
                        successCount++;
                    } else {
                        failCount++;
                        const detail = await this.buildFailureDetail(item, response);
                        failureDetails.push(detail);
                        console.error('Sync failed for operation:', detail);
                    }
                } catch (error) {
                    failCount++;
                    const detail = this.buildFailureDetailFromError(item, error);
                    failureDetails.push(detail);
                    console.error('Error syncing operation:', detail);
                }
            }

            if (successCount > 0) {
                notification.success(`Synced ${successCount} pending operation(s)`);
            }
            if (failCount > 0) {
                const detailMsg = this.formatFailureSummary(failureDetails[0]);
                notification.warning(`Failed to sync ${failCount} operation(s).${detailMsg}`);
            }

            // Emit event to update UI
            eventBus.emit('sync:completed', { successCount, failCount, failures: failureDetails });

        } catch (error) {
            console.error('Error during sync:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    buildFailureDetailFromError(operation, error) {
        return {
            method: operation.method,
            url: operation.url,
            errorMessage: error?.message || 'Unknown error'
        };
    }

    async buildFailureDetail(operation, response) {
        const bodySnippet = await this.extractResponseSnippet(response);
        return {
            method: operation.method,
            url: operation.url,
            status: response.status,
            statusText: response.statusText,
            bodySnippet
        };
    }

    formatFailureSummary(detail) {
        if (!detail) {
            return '';
        }

        let path = detail.url;
        try {
            const parsed = new URL(detail.url, window.location.origin);
            path = parsed.pathname;
        } catch (error) {
            // Ignore parsing errors and fall back to raw URL
        }

        const statusPart = detail.status ? `${detail.status} ${detail.statusText || ''}`.trim() : detail.errorMessage;
        const snippet = detail.bodySnippet ? ` Details: ${detail.bodySnippet}` : '';
        return ` Last error: ${detail.method} ${path}${statusPart ? ` → ${statusPart}` : ''}.${snippet}`;
    }

    async extractResponseSnippet(response) {
        try {
            const clone = response.clone();
            const contentType = clone.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await clone.json();
                if (typeof data === 'string') {
                    return this.truncateSnippet(data);
                }
                if (data && typeof data === 'object') {
                    if (data.error && typeof data.error === 'string') {
                        return this.truncateSnippet(data.error);
                    }
                    return this.truncateSnippet(JSON.stringify(data));
                }
            }

            const text = await clone.text();
            return this.truncateSnippet(text);
        } catch (error) {
            console.warn('Unable to extract sync error details:', error);
            return '';
        }
    }

    truncateSnippet(value) {
        if (!value) return '';
        const trimmed = value.replace(/\s+/g, ' ').trim();
        return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
    }

    async clearBrowserData() {
        try {
            await offlineStorage.clearAll();
            await offlineStorage.deleteDatabase();
        } catch (error) {
            console.error('Failed to clear offline database:', error);
            throw new Error(`Could not clear offline database: ${error.message}`);
        }

        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (storageError) {
            console.warn('Failed to clear web storage:', storageError);
        }

        let deletedCaches = 0;
        if ('caches' in window) {
            try {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
                deletedCaches = cacheKeys.length;
            } catch (cacheError) {
                console.warn('Failed to clear Cache Storage:', cacheError);
            }
        }

        return {
            cachesCleared: deletedCaches
        };
    }

    async saveOfflineWorkout(workoutData) {
        try {
            const saved = await offlineStorage.saveOfflineWorkout(workoutData);
            console.log('Workout saved offline:', saved);
            return saved;
        } catch (error) {
            console.error('Failed to save offline workout:', error);
            throw error;
        }
    }

    async getOfflineWorkouts() {
        try {
            return await offlineStorage.getOfflineWorkouts();
        } catch (error) {
            console.error('Failed to get offline workouts:', error);
            return [];
        }
    }

    getPendingSyncCount() {
        return offlineStorage.getSyncQueue().then(queue => queue.length);
    }
}

export const offlineManager = new OfflineManager();
