class WakeLockManager {
    constructor() {
        this.enabled = false;
        this.wakeLock = null;
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    isSupported() {
        return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    }

    async enable() {
        if (!this.isSupported()) {
            console.warn('Wake Lock API not supported in this browser.');
            return false;
        }

        this.enabled = true;
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        return this.requestWakeLock();
    }

    async disable() {
        this.enabled = false;
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
            } catch (error) {
                console.warn('Failed to release wake lock:', error);
            }
            this.wakeLock = null;
        }
    }

    async requestWakeLock() {
        if (!this.enabled || !this.isSupported()) {
            return false;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => {
                if (this.enabled) {
                    this.requestWakeLock();
                }
            });
            return true;
        } catch (error) {
            console.warn('Failed to acquire wake lock:', error);
            return false;
        }
    }

    async handleVisibilityChange() {
        if (document.visibilityState === 'visible' && this.enabled) {
            await this.requestWakeLock();
        }
    }
}

export const wakeLockManager = new WakeLockManager();
