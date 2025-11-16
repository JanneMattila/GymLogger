export class WelcomeDialog {
    constructor() {
        this.dialogElement = null;
    }

    show() {
        if (this.dialogElement) return; // Already showing

        this.dialogElement = document.createElement('div');
        this.dialogElement.id = 'welcome-dialog';
        this.dialogElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-in;
        `;

        this.dialogElement.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
            <div style="
                background: var(--surface);
                border-radius: 16px;
                padding: 40px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.4s ease-out;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">💪</div>
                <h1 style="margin-bottom: 16px; font-size: 32px;">Welcome to Gym Logger!</h1>
                <p style="color: var(--text-secondary); margin-bottom: 32px; font-size: 16px; line-height: 1.6;">
                    Get the most out of your training by logging in with your Microsoft account. 
                    Your workout data will be saved securely and accessible across all your devices.
                </p>

                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button id="login-microsoft-btn" style="
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        padding: 16px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 12px;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='var(--primary-dark)'" 
                       onmouseout="this.style.background='var(--primary-color)'">
                        <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                            <path d="M11 0H0V11H11V0Z" fill="white"/>
                            <path d="M23 0H12V11H23V0Z" fill="white"/>
                            <path d="M11 12H0V23H11V12Z" fill="white"/>
                            <path d="M23 12H12V23H23V12Z" fill="white"/>
                        </svg>
                        Sign in with Microsoft
                    </button>

                    <button id="continue-guest-btn" style="
                        background: transparent;
                        color: var(--text-primary);
                        border: 2px solid var(--border);
                        padding: 16px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)'" 
                       onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-primary)'">
                        Continue as Guest
                    </button>
                </div>

                <p style="color: var(--text-secondary); margin-top: 24px; font-size: 12px;">
                    Guest mode: Your data will be stored on the server with a temporary guest ID.
                </p>
            </div>
        `;

        document.body.appendChild(this.dialogElement);

        // Attach event listeners
        document.getElementById('login-microsoft-btn')?.addEventListener('click', () => {
            this.handleMicrosoftLogin();
        });

        document.getElementById('continue-guest-btn')?.addEventListener('click', () => {
            this.handleGuestContinue();
        });
    }

    hide() {
        if (this.dialogElement) {
            this.dialogElement.remove();
            this.dialogElement = null;
        }
    }

    async handleMicrosoftLogin() {
        try {
            // Redirect to backend auth endpoint
            window.location.href = '/api/auth/login?returnUrl=' + encodeURIComponent(window.location.pathname + window.location.hash);
        } catch (error) {
            console.error('Login error:', error);
            alert('Failed to initiate login. Please try again.');
        }
    }

    async handleGuestContinue() {
        try {
            // Call backend to create guest session
            const response = await fetch('/api/auth/guest', {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to create guest session');
            }

            const data = await response.json();
            
            // Store userId in localStorage
            localStorage.setItem('gymlogger_userId', data.userId);
            localStorage.setItem('gymlogger_isGuest', 'true');
            localStorage.setItem('gymlogger_authTimestamp', new Date().toISOString());

            this.hide();
            
            // Reload to initialize the app with guest session
            window.location.reload();
        } catch (error) {
            console.error('Guest session error:', error);
            alert('Failed to create guest session. Please try again.');
        }
    }
}
