import { eventBus } from '../utils/event-bus.js?v=00000000000000';

const HIDE_DELAY_MS = 300;

export class LoaderWidget {
    constructor() {
        this.container = document.getElementById('loader');
        this.activeRequests = 0;
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
                this.hide();
            }
        });
    }

    show() {
        this.container.classList.remove('hidden');
    }

    hide() {
        setTimeout(() => {
            if (this.activeRequests === 0) {
                this.container.classList.add('hidden');
            }
        }, HIDE_DELAY_MS);
    }
}
