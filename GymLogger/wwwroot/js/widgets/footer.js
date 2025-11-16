import { eventBus } from '../utils/event-bus.js?v=00000000000000';

export class FooterWidget {
    constructor() {
        this.container = document.getElementById('footer');
        this.isOnline = navigator.onLine;
        this.isSyncing = false;
    }

    render() {
        this.container.innerHTML = `
            <div>
                <span>© 2025 Janne Mattila</span>
                <span id="last-saved" style="margin-left: 16px; color: var(--text-secondary);"></span>
            </div>
            <div class="network-status">
                <span id="network-status-text">${this.isOnline ? 'Online' : 'Offline'}</span>
                <div class="status-dot ${this.getStatusClass()}" id="status-dot"></div>
            </div>
        `;

        this.attachListeners();
    }

    attachListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateStatus();
            eventBus.emit('network:online');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateStatus();
            eventBus.emit('network:offline');
        });

        eventBus.on('sync:start', () => {
            this.isSyncing = true;
            this.updateStatus();
        });

        eventBus.on('sync:end', () => {
            this.isSyncing = false;
            this.updateStatus();
        });

        eventBus.on('data:saved', (timestamp) => {
            this.updateLastSaved(timestamp);
        });
    }

    updateStatus() {
        const statusText = document.getElementById('network-status-text');
        const statusDot = document.getElementById('status-dot');
        
        if (statusText) {
            if (this.isSyncing) {
                statusText.textContent = 'Syncing...';
            } else {
                statusText.textContent = this.isOnline ? 'Online' : 'Offline';
            }
        }

        if (statusDot) {
            statusDot.className = `status-dot ${this.getStatusClass()}`;
        }
    }

    getStatusClass() {
        if (this.isSyncing) return 'syncing';
        if (!this.isOnline) return 'offline';
        return '';
    }

    updateLastSaved(timestamp) {
        const lastSaved = document.getElementById('last-saved');
        if (lastSaved) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) {
                lastSaved.textContent = 'Saved just now';
            } else if (diffMins < 60) {
                lastSaved.textContent = `Saved ${diffMins}m ago`;
            } else {
                lastSaved.textContent = `Saved at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }
    }
}
