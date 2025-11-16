/**
 * Theme Manager
 * Handles theme persistence and application
 */
class ThemeManager {
    constructor() {
        this.STORAGE_KEY = 'gym-logger-theme';
        this.currentTheme = null;
    }

    /**
     * Initialize theme from local storage and apply immediately
     */
    init() {
        const savedTheme = this.getSavedTheme();
        if (savedTheme) {
            this.applyTheme(savedTheme);
        }
    }

    /**
     * Get saved theme from local storage
     * @returns {string|null} Saved theme or null
     */
    getSavedTheme() {
        try {
            return localStorage.getItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error reading theme from localStorage:', error);
            return null;
        }
    }

    /**
     * Save theme to local storage
     * @param {string} theme - Theme to save ('light', 'dark', or 'auto')
     */
    saveTheme(theme) {
        try {
            localStorage.setItem(this.STORAGE_KEY, theme);
            this.currentTheme = theme;
        } catch (error) {
            console.error('Error saving theme to localStorage:', error);
        }
    }

    /**
     * Apply theme to the document
     * @param {string} theme - Theme to apply ('light', 'dark', or 'auto')
     */
    applyTheme(theme) {
        let actualTheme = theme;
        
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            actualTheme = prefersDark ? 'dark' : 'light';
        }
        
        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark');
        
        // Add new theme class
        document.body.classList.add(`theme-${actualTheme}`);
        
        this.currentTheme = theme;
    }

    /**
     * Set and persist theme
     * @param {string} theme - Theme to set ('light', 'dark', or 'auto')
     */
    setTheme(theme) {
        this.saveTheme(theme);
        this.applyTheme(theme);
    }

    /**
     * Get current theme
     * @returns {string} Current theme
     */
    getCurrentTheme() {
        return this.currentTheme || this.getSavedTheme() || 'light';
    }
}

// Export singleton instance
export const themeManager = new ThemeManager();
