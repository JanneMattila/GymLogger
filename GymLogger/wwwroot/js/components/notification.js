// Notification toast component
export class Notification {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notification-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 400px;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const toastId = `toast-${Date.now()}`;
        toast.id = toastId;
        
        // Color schemes for different types
        const colors = {
            success: { bg: '#4caf50', icon: '✓' },
            error: { bg: '#f44336', icon: '✕' },
            warning: { bg: '#ff9800', icon: '⚠' },
            info: { bg: '#2196f3', icon: 'ℹ' }
        };
        
        const theme = colors[type] || colors.info;
        
        toast.style.cssText = `
            background: ${theme.bg};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            animation: slideIn 0.3s ease-out;
            position: relative;
        `;
        
        toast.innerHTML = `
            <div style="flex-shrink: 0; font-size: 20px; font-weight: bold;">${theme.icon}</div>
            <div style="flex: 1; font-size: 14px; line-height: 1.4;">${message}</div>
            <button class="toast-close" style="
                background: transparent;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.8;
                transition: opacity 0.2s;
            ">×</button>
        `;
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
            .toast-close:hover {
                opacity: 1 !important;
            }
        `;
        if (!document.getElementById('toast-styles')) {
            style.id = 'toast-styles';
            document.head.appendChild(style);
        }
        
        this.container.appendChild(toast);
        
        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.dismiss(toastId);
        });
        
        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toastId);
            }, duration);
        }
        
        return toastId;
    }

    dismiss(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    }

    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 60000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}

// Create singleton instance
export const notification = new Notification();
