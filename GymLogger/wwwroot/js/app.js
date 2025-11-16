import { eventBus } from './utils/event-bus.js?v=20251116171145';
import { themeManager } from './utils/theme-manager.js?v=20251116171145';
import { authManager } from './utils/auth-manager.js?v=20251116171145';
import { offlineManager } from './utils/offline-manager.js?v=20251116171145';
import { HeaderWidget } from './widgets/header.js?v=20251116171145';
import { LeftNavWidget } from './widgets/left-nav.js?v=20251116171145';
import { FooterWidget } from './widgets/footer.js?v=20251116171145';
import { LoaderWidget } from './widgets/loader.js?v=20251116171145';
import { DashboardView } from './views/dashboard.js?v=20251116171145';
import { ProgramsView } from './views/programs.js?v=20251116171145';
import { ExercisesView } from './views/exercises.js?v=20251116171145';
import { WorkoutLoggerView } from './views/workout-logger.js?v=20251116171145';
import { HistoryView } from './views/history.js?v=20251116171145';
import { PreferencesView } from './views/preferences.js?v=20251116171145';
import { ProgressView } from './views/progress.js?v=20251116171145';
import { StatsView } from './views/stats.js?v=20251116171145';
import { UtilitiesView } from './views/utilities.js?v=20251116171145';

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

        eventBus.on('start-workout-with-program', (programId) => {
            this.startWorkoutWithProgram(programId);
        });

        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const viewName = window.location.hash.slice(1) || 'dashboard';
            this.navigate(viewName);
        });

        // Navigate to initial view from hash or default to dashboard
        const initialView = window.location.hash.slice(1) || 'dashboard';
        this.navigate(initialView);
    }

    async navigate(viewName) {
        const ViewClass = this.views[viewName];
        if (!ViewClass) {
            console.error('View not found:', viewName);
            return;
        }

        // Update hash if not already set
        if (window.location.hash.slice(1) !== viewName) {
            window.location.hash = viewName;
            return; // hashchange event will trigger navigate again
        }

        try {
            if (ViewClass.prototype && ViewClass.prototype.render) {
                // It's a class with a render method
                this.currentView = new ViewClass();
                await this.currentView.render();
            } else if (ViewClass.render) {
                // It's an object with a render method
                await ViewClass.render();
            }
        } catch (error) {
            console.error('Error rendering view:', error);
            this.renderError(error);
        }
    }

    async startWorkoutWithProgram(programId) {
        window.location.hash = 'workout-logger';
        // Wait for hash change to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        if (this.currentView && this.currentView.render) {
            await this.currentView.render(programId);
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
