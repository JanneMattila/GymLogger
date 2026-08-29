export class WakeLockManager {
    constructor({
        navigatorRef = globalThis.navigator,
        documentRef = globalThis.document,
        retryDelays = [1000, 3000, 10000, 30000],
        setTimeoutFn = globalThis.setTimeout.bind(globalThis),
        clearTimeoutFn = globalThis.clearTimeout.bind(globalThis)
    } = {}) {
        this.navigator = navigatorRef;
        this.document = documentRef;
        this.retryDelays = retryDelays;
        this.setTimeoutFn = setTimeoutFn;
        this.clearTimeoutFn = clearTimeoutFn;
        this.enabled = false;
        this.wakeLock = null;
        this.requestPromise = null;
        this.retryTimer = null;
        this.retryAttempt = 0;
        this.generation = 0;
        this.visibilityListenerAttached = false;
        this.lastError = null;
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    isSupported() {
        return Boolean(this.navigator && 'wakeLock' in this.navigator);
    }

    isEnabled() {
        return this.enabled;
    }

    isActive() {
        return Boolean(this.wakeLock && !this.wakeLock.released);
    }

    async enable() {
        if (!this.isSupported()) {
            console.warn('Wake Lock API not supported in this browser.');
            return false;
        }

        if (!this.enabled) {
            this.enabled = true;
            this.generation++;
        }

        if (!this.visibilityListenerAttached) {
            this.document?.addEventListener('visibilitychange', this.handleVisibilityChange);
            this.visibilityListenerAttached = true;
        }

        return this.requestWakeLock();
    }

    async disable() {
        this.enabled = false;
        this.generation++;
        this.clearRetry();
        this.retryAttempt = 0;
        this.document?.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.visibilityListenerAttached = false;

        if (this.wakeLock) {
            const wakeLock = this.wakeLock;
            this.wakeLock = null;
            try {
                await wakeLock.release();
            } catch (error) {
                console.warn('Failed to release wake lock:', error);
            }
        }
    }

    async requestWakeLock() {
        if (!this.enabled || !this.isSupported()) {
            return false;
        }

        if (this.document?.visibilityState === 'hidden') {
            return false;
        }

        if (this.isActive()) {
            return true;
        }

        if (this.requestPromise) {
            return this.requestPromise;
        }

        const generation = this.generation;
        const request = this.acquireWakeLock(generation);
        this.requestPromise = request;

        try {
            return await request;
        } finally {
            if (this.requestPromise === request) {
                this.requestPromise = null;
            }
        }
    }

    async acquireWakeLock(generation) {
        try {
            const wakeLock = await this.navigator.wakeLock.request('screen');

            if (!this.enabled || generation !== this.generation || this.document?.visibilityState === 'hidden') {
                await wakeLock.release();
                return false;
            }

            this.wakeLock = wakeLock;
            this.lastError = null;
            this.retryAttempt = 0;
            this.clearRetry();

            wakeLock.addEventListener('release', () => {
                if (this.wakeLock === wakeLock) {
                    this.wakeLock = null;
                }

                if (this.enabled && this.document?.visibilityState !== 'hidden') {
                    this.scheduleRetry();
                }
            }, { once: true });

            return true;
        } catch (error) {
            this.lastError = error;
            console.warn('Failed to acquire wake lock:', error);
            this.scheduleRetry();
            return false;
        }
    }

    scheduleRetry() {
        if (!this.enabled || this.retryTimer || this.document?.visibilityState === 'hidden') {
            return;
        }

        const retryIndex = Math.min(this.retryAttempt, this.retryDelays.length - 1);
        const delay = this.retryDelays[retryIndex];
        this.retryAttempt++;
        const generation = this.generation;

        this.retryTimer = this.setTimeoutFn(() => {
            this.retryTimer = null;
            if (this.enabled && generation === this.generation) {
                this.requestWakeLock();
            }
        }, delay);
    }

    clearRetry() {
        if (this.retryTimer) {
            this.clearTimeoutFn(this.retryTimer);
            this.retryTimer = null;
        }
    }

    async resume() {
        if (!this.enabled || this.document?.visibilityState === 'hidden') {
            return false;
        }

        this.clearRetry();
        return this.requestWakeLock();
    }

    async handleVisibilityChange() {
        if (this.document?.visibilityState === 'visible') {
            await this.resume();
        } else {
            this.clearRetry();
        }
    }
}

export const wakeLockManager = new WakeLockManager();
