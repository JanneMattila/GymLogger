/**
 * User Context Manager
 * Centralized management of current user information
 * User identity is managed entirely by backend via authentication cookies
 */
class UserContext {
    constructor() {
        this._authenticated = false;
        this._userName = null;
        this._isGuest = false;
    }

    /**
     * User ID is no longer exposed - managed by backend via cookie
     * This method is deprecated and will throw an error if called
     */
    getCurrentUserId() {
        throw new Error('getCurrentUserId() is deprecated. User ID is managed by backend via authentication cookies. Use /api/users/me endpoints instead.');
    }

    /**
     * Set authentication status
     * @param {boolean} isAuthenticated - Whether user is authenticated
     * @param {string} userName - User's display name
     * @param {boolean} isGuest - Whether this is a guest session
     */
    setAuthenticated(isAuthenticated, userName = null, isGuest = false) {
        this._authenticated = isAuthenticated;
        this._userName = userName;
        this._isGuest = isGuest;
    }

    /**
     * Get the current user's display name
     * @returns {string|null} User display name
     */
    getUserName() {
        return this._userName;
    }

    /**
     * Check if current session is a guest session
     * @returns {boolean} True if guest
     */
    isGuest() {
        return this._isGuest;
    }

    /**
     * Clear current user (logout)
     */
    clearUser() {
        this._authenticated = false;
        this._userName = null;
        this._isGuest = false;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean} True if user is authenticated
     */
    isAuthenticated() {
        return this._authenticated;
    }
}

// Export singleton instance
export const userContext = new UserContext();
