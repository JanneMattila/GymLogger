import { WelcomeDialog } from '../components/welcome-dialog.js';
import { userContext } from './user-context.js?v=00000000000000';

class AuthManager {
    constructor() {
        this.welcomeDialog = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Check authentication status with backend
        const status = await this.checkAuthStatus();
        
        if (status && status.isAuthenticated) {
            // User is authenticated (via cookie)
            userContext.setAuthenticated(true, status.userName, status.isGuest);
            
            // Store guest status in localStorage for UI purposes only (not for auth)
            localStorage.setItem('gymlogger_isGuest', status.isGuest ? 'true' : 'false');
        } else {
            // Not authenticated, show welcome dialog and wait for authentication
            localStorage.removeItem('gymlogger_isGuest');
            await this.waitForAuthentication();
        }
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                return null;
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to check auth status:', error);
            return null;
        }
    }

    showWelcomeDialog() {
        if (!this.welcomeDialog) {
            this.welcomeDialog = new WelcomeDialog();
        }
        this.welcomeDialog.show();
    }

    async waitForAuthentication() {
        this.showWelcomeDialog();
        
        // Wait for authentication to complete (dialog will reload page when done)
        // This prevents the app from continuing to load while unauthenticated
        return new Promise(() => {
            // This promise never resolves - the page will reload after authentication
        });
    }

    isGuest() {
        return localStorage.getItem('gymlogger_isGuest') === 'true';
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear all browser storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Reload to show welcome dialog
            window.location.href = '/';
        }
    }
}

export const authManager = new AuthManager();
