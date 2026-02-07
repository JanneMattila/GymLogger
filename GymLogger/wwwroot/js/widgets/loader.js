import { eventBus } from '../utils/event-bus.js?v=00000000000000';

const HIDE_DELAY_MS = 300;

export class LoaderWidget {
    constructor() {
        this.container = document.getElementById('loader');
        this.cancelBtn = document.getElementById('loader-cancel');
        this.activeRequests = 0;
        this.cancelCallbacks = new Set();
    }

    init() {
        eventBus.on('api:start', () => {
            this.activeRequests++;
            this.show();
        });

        eventBus.on('api:end', () => {
            this.activeRequests--;
            if (this.activeRequests <= 0) {
                this.activeRequests = 0;
                this.hideWithDelay();
            }
        });

        // Cancel button click handler
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => {
                this.cancel();
            });
        }
    }

    show() {
        this.container.classList.remove('hidden');
    }

    hide() {
        this.container.classList.add('hidden');
        this.cancelCallbacks.clear();
    }

    hideWithDelay() {
        setTimeout(() => {
            if (this.activeRequests === 0) {
                this.container.classList.add('hidden');
                this.cancelCallbacks.clear();
            }
        }, HIDE_DELAY_MS);
    }

    cancel() {
        // Execute all registered cancel callbacks
        this.cancelCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.warn('Error executing cancel callback:', error);
            }
        });
        
        // Emit cancel event for any other listeners
        eventBus.emit('loader:cancel');
        
        // Reset state and hide loader
        this.activeRequests = 0;
        this.hide();
    }

    addCancelCallback(callback) {
        this.cancelCallbacks.add(callback);
    }

    removeCancelCallback(callback) {
        this.cancelCallbacks.delete(callback);
    }
}
