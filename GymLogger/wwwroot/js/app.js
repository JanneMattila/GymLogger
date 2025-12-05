import { eventBus } from './utils/event-bus.js?v=00000000000000';
import { themeManager } from './utils/theme-manager.js?v=00000000000000';
import { authManager } from './utils/auth-manager.js?v=00000000000000';
import { offlineManager } from './utils/offline-manager.js?v=00000000000000';
import { HeaderWidget } from './widgets/header.js?v=00000000000000';
import { LeftNavWidget } from './widgets/left-nav.js?v=00000000000000';
import { FooterWidget } from './widgets/footer.js?v=00000000000000';
import { LoaderWidget } from './widgets/loader.js?v=00000000000000';
import { DashboardView } from './views/dashboard.js?v=00000000000000';
import { ProgramsView } from './views/programs.js?v=00000000000000';
import { ExercisesView } from './views/exercises.js?v=00000000000000';
import { WorkoutLoggerView } from './views/workout-logger.js?v=00000000000000';
import { HistoryView } from './views/history.js?v=00000000000000';
import { PreferencesView } from './views/preferences.js?v=00000000000000';
import { ProgressView } from './views/progress.js?v=00000000000000';
import { StatsView } from './views/stats.js?v=00000000000000';
import { UtilitiesView } from './views/utilities.js?v=00000000000000';

class App {
    constructor() {
        this.currentView = null;
        this.views = {};
        this.init();
    }

    async init() {
        // Initialize theme FIRST before anything renders
        themeManager.init();
        
        // Initialize offline support
        await offlineManager.init();
        
        // Initialize authentication
        await authManager.initialize();
        
        // Initialize widgets
        const header = new HeaderWidget();
        header.render();

        const leftNav = new LeftNavWidget();
        leftNav.render();

        const footer = new FooterWidget();
        footer.render();

        const loader = new LoaderWidget();
        loader.init();
        
        // App is now ready - remove loading state and show content
        const appElement = document.getElementById('app');
        appElement.classList.remove('app-loading');
        loader.hide();
        
        // Register views
        this.views = {
            'dashboard': DashboardView,
            'workout-logger': WorkoutLoggerView,
            'programs': ProgramsView,
            'exercises': ExercisesView,
            'history': HistoryView,
            'preferences': PreferencesView,
            'progress': ProgressView,
            'stats': StatsView,
            'utilities': UtilitiesView,
            'admin': { render: () => this.renderPlaceholder('Admin Panel') }
        };

        // Set up navigation
        eventBus.on('navigate', (view) => {
            window.location.hash = view || 'dashboard';
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });

        // Navigate to initial view from hash or default to dashboard
        this.handleHashChange();
    }

    /**
     * Parse hash and query params from URL.
     * Supports formats: #workout-logger?programId=123 or #workout-logger?123
     */
    parseHash() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const [viewName, queryString] = hash.split('?');
        
        const params = {};
        if (queryString) {
            // Check if it's just a value (e.g., ?123) or key=value pairs
            if (queryString.includes('=')) {
                const searchParams = new URLSearchParams(queryString);
                for (const [key, value] of searchParams) {
                    params[key] = value;
                }
            } else {
                // Treat as programId for workout-logger
                params.programId = queryString;
            }
        }
        
        return { viewName, params };
    }

    handleHashChange() {
        const { viewName, params } = this.parseHash();
        this.navigate(viewName, params);
    }

    async navigate(viewName, params = {}) {
        const ViewClass = this.views[viewName];
        if (!ViewClass) {
            console.error('View not found:', viewName);
            return;
        }

        try {
            if (ViewClass.prototype && ViewClass.prototype.render) {
                // It's a class with a render method
                this.currentView = new ViewClass();
                
                // Pass programId to workout-logger if present in params
                if (viewName === 'workout-logger' && params.programId) {
                    await this.currentView.render(params.programId);
                } else {
                    await this.currentView.render();
                }
            } else if (ViewClass.render) {
                // It's an object with a render method
                await ViewClass.render();
            }
        } catch (error) {
            console.error('Error rendering view:', error);
            this.renderError(error);
        }
    }

    renderPlaceholder(title) {
        const container = document.getElementById('main');
        container.innerHTML = `
            <div class="card">
                <div class="card-header">${title}</div>
                <p>This view is coming soon...</p>
                <p style="color: var(--text-secondary); margin-top: 12px;">
                    The ${title} feature will be implemented in the next iteration.
                </p>
            </div>
        `;
    }

    renderError(error) {
        const container = document.getElementById('main');
        container.innerHTML = `
            <div class="card">
                <div class="card-header" style="color: var(--danger-color);">Error</div>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
