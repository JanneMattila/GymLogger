import { eventBus } from '../utils/event-bus.js?v=00000000000000';
import { offlineManager } from '../utils/offline-manager.js?v=00000000000000';

export class HeaderWidget {
    constructor() {
        this.container = document.getElementById('header');
    }

    render() {
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <button class="nav-toggle" id="nav-toggle">☰</button>
                <h1 style="cursor: pointer;" id="app-title">💪 Gym Logger</h1>
            </div>
            <div class="header-actions" style="display: flex; align-items: center; gap: 12px;">
                <span id="offline-indicator" class="hidden" style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--warning-color); color: white; border-radius: 16px; font-size: 12px; font-weight: 600;">
                    📡 Offline
                </span>
                <span id="sync-indicator" class="hidden" style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--info-color); color: white; border-radius: 16px; font-size: 12px; font-weight: 600;">
                    🔄 <span id="sync-count">0</span> pending
                </span>
                <span id="timer-indicator" class="hidden" style="width: 8px; height: 8px; background: #fbbc04; border-radius: 50%; animation: pulse 1s infinite;"></span>
                <button class="btn btn-primary hidden" id="start-workout-btn">Start Workout</button>
            </div>
        `;

        this.attachListeners();
        this.updateOnlineStatus();
    }

    attachListeners() {
        document.getElementById('nav-toggle')?.addEventListener('click', () => {
            eventBus.emit('nav:toggle');
        });

        document.getElementById('app-title')?.addEventListener('click', () => {
            window.location.hash = 'dashboard';
        });

        document.getElementById('start-workout-btn')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'workout-logger');
        });

        eventBus.on('timer:active', (active) => {
            const indicator = document.getElementById('timer-indicator');
            if (indicator) {
                indicator.classList.toggle('hidden', !active);
            }
        });

        eventBus.on('session:active', (active) => {
            const btn = document.getElementById('start-workout-btn');
            if (btn) {
                btn.textContent = active ? 'Resume Workout' : 'Start Workout';
            }
        });

        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        
        // Update sync indicator when items are queued
        eventBus.on('api:queued', () => this.updateSyncIndicator());
        
        // Update sync indicator when sync completes
        eventBus.on('sync:completed', () => this.updateSyncIndicator());
    }

    updateOnlineStatus() {
        const offlineIndicator = document.getElementById('offline-indicator');
        if (offlineIndicator) {
            offlineIndicator.classList.toggle('hidden', navigator.onLine);
        }
        // Always update sync indicator when online status changes
        this.updateSyncIndicator();
    }

    async updateSyncIndicator() {
        const syncIndicator = document.getElementById('sync-indicator');
        const syncCount = document.getElementById('sync-count');
        
        if (syncIndicator && syncCount) {
            const count = await offlineManager.getPendingSyncCount();
            syncCount.textContent = count;
            syncIndicator.classList.toggle('hidden', count === 0);
        }
    }
}
