import { eventBus } from '../utils/event-bus.js?v=20251116171145';
import { userContext } from '../utils/user-context.js?v=20251116171145';

export class LeftNavWidget {
    constructor() {
        this.container = document.getElementById('left-nav');
        this.collapsed = window.innerWidth < 768;
    }

    render() {
        this.container.classList.toggle('collapsed', this.collapsed);

        const menuItems = [
            { id: 'dashboard', label: '🏠 Dashboard', view: 'dashboard' },
            { id: 'workout-logger', label: '🏋️ Workout', view: 'workout-logger' },
            { id: 'programs', label: '📋 Programs', view: 'programs' },
            { id: 'exercises', label: '💪 Exercises', view: 'exercises' },
            { id: 'history', label: '📅 History', view: 'history' },
            { id: 'progress', label: '📊 Progress', view: 'progress' },
            { id: 'stats', label: '📈 Stats', view: 'stats' },
            { id: 'utilities', label: '🔧 Utilities', view: 'utilities' },
            { id: 'preferences', label: '⚙️ Preferences', view: 'preferences' }
        ];

        // Admin panel removed - admin functionality to be implemented later

        this.container.innerHTML = `
            <ul class="nav-menu">
                ${menuItems.map(item => `
                    <li class="nav-item" data-view="${item.view}" id="nav-${item.id}">
                        ${item.label}
                    </li>
                `).join('')}
            </ul>
        `;

        this.attachListeners();
    }

    attachListeners() {
        this.container.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                eventBus.emit('navigate', view);
                if (window.innerWidth < 768) {
                    this.toggle();
                }
            });
        });

        eventBus.on('nav:toggle', () => {
            this.toggle();
        });

        eventBus.on('navigate', (view) => {
            this.setActive(view);
        });

        eventBus.on('session:started', () => {
            if (window.innerWidth < 768) {
                this.collapse();
            }
        });
    }

    toggle() {
        this.collapsed = !this.collapsed;
        this.container.classList.toggle('collapsed', this.collapsed);
    }

    collapse() {
        this.collapsed = true;
        this.container.classList.add('collapsed');
    }

    setActive(view) {
        this.container.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });
    }
}
