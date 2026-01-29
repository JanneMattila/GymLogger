import { api } from '../utils/api-client.js?v=00000000000000';
import { formatDate } from '../utils/date-formatter.js?v=00000000000000';

/**
 * Generic exercise history dialog component that shows previous workout results
 * for a specific exercise. This is a read-only view that can be used in both
 * workout and programs views.
 */
export class ExerciseHistoryDialog {
    constructor() {
        this.preferences = null;
    }

    /**
     * Show the exercise history dialog
     * @param {Object} exercise - The exercise object with at least id and name
     * @param {Object} preferences - User preferences including defaultWeightUnit
     */
    async show(exercise, preferences) {
        if (!exercise || !exercise.id) {
            console.error('Invalid exercise passed to ExerciseHistoryDialog');
            return;
        }

        this.preferences = preferences;
        const weightUnit = preferences?.defaultWeightUnit || 'KG';

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'exercise-history-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.2s ease-in-out;
        `;

        // Show loading state
        overlay.innerHTML = `
            <div class="card" style="max-width: 600px; width: 100%; max-height: 85vh; overflow-y: auto; margin: 0; animation: slideUp 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">📊 ${exercise.name} - History</div>
                    <button class="btn btn-secondary" id="close-history-overlay-btn" style="padding: 8px 16px;">✕</button>
                </div>
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 24px; margin-bottom: 12px;">⏳</div>
                    <p style="color: var(--text-secondary);">Loading history...</p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.attachCloseListener(overlay);

        // Fetch history data
        try {
            const historyResp = await api.getExerciseHistory(exercise.id, 5);
            
            if (!historyResp.success) {
                this.showError(overlay, exercise, 'Failed to load exercise history');
                return;
            }

            const history = historyResp.data || [];
            this.renderHistory(overlay, exercise, history, weightUnit);
        } catch (error) {
            console.error('Error loading exercise history:', error);
            this.showError(overlay, exercise, 'Error loading history: ' + error.message);
        }
    }

    renderHistory(overlay, exercise, history, weightUnit) {
        // Sort history by date descending (most recent first)
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

        let content = `
            <div class="card" style="max-width: 600px; width: 100%; max-height: 85vh; overflow-y: auto; margin: 0; animation: slideUp 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">📊 ${exercise.name} - History</div>
                    <button class="btn btn-secondary" id="close-history-overlay-btn" style="padding: 8px 16px;">✕</button>
                </div>
        `;

        if (sortedHistory.length === 0) {
            content += `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📋</div>
                    <h3 style="margin-bottom: 8px; color: var(--text-secondary);">No History Yet</h3>
                    <p style="color: var(--text-secondary);">
                        Complete a workout with this exercise to see your history here.
                    </p>
                </div>
            `;
        } else {
            // Summary stats
            const allSets = sortedHistory.flatMap(h => h.sets);
            const maxWeight = Math.max(...allSets.map(s => s.weight));
            const totalSets = allSets.length;
            const totalWorkouts = sortedHistory.length;

            content += `
                <div style="display: flex; gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--surface); border-radius: 8px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 80px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 600; color: var(--primary-color);">${totalWorkouts}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Workouts</div>
                    </div>
                    <div style="flex: 1; min-width: 80px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 600; color: var(--success-color);">${totalSets}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Total Sets</div>
                    </div>
                    <div style="flex: 1; min-width: 80px; text-align: center;">
                        <div style="font-size: 20px; font-weight: 600; color: var(--warning-color);">${maxWeight}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Max ${weightUnit}</div>
                    </div>
                </div>

                <div style="display: grid; gap: 16px;">
            `;

            // Render each workout session
            sortedHistory.forEach((dataPoint, idx) => {
                const formattedDate = formatDate(dataPoint.date);
                const sessionSets = dataPoint.sets;

                content += `
                    <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; background: var(--surface);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h4 style="margin: 0;">${formattedDate}</h4>
                                ${idx === 0 ? '<span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px;">LATEST</span>' : ''}
                            </div>
                            <span style="font-size: 12px; color: var(--text-secondary);">
                                ${sessionSets.length} sets
                            </span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <th style="padding: 8px; text-align: left; font-size: 12px; color: var(--text-secondary);">Set</th>
                                    <th style="padding: 8px; text-align: left; font-size: 12px; color: var(--text-secondary);">Weight (${weightUnit})</th>
                                    <th style="padding: 8px; text-align: left; font-size: 12px; color: var(--text-secondary);">Reps</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sessionSets.map((set, setIdx) => `
                                    <tr>
                                        <td style="padding: 8px;">${setIdx + 1}</td>
                                        <td style="padding: 8px;">${set.weight}</td>
                                        <td style="padding: 8px;">${set.reps}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            });

            content += '</div>';
        }

        content += `
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <button class="btn btn-secondary" id="close-history-bottom-btn" style="width: 100%;">Close</button>
                </div>
            </div>
        `;

        const cardContainer = overlay.querySelector('.card');
        if (cardContainer) {
            cardContainer.outerHTML = content.trim().split('\n').map(line => line.trim()).join('');
        }

        this.attachCloseListener(overlay);
    }

    showError(overlay, exercise, message) {
        const content = `
            <div class="card" style="max-width: 600px; width: 100%; margin: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">📊 ${exercise.name} - History</div>
                    <button class="btn btn-secondary" id="close-history-overlay-btn" style="padding: 8px 16px;">✕</button>
                </div>
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">⚠️</div>
                    <h3 style="margin-bottom: 8px; color: var(--danger-color);">Error</h3>
                    <p style="color: var(--text-secondary);">${message}</p>
                </div>
                <button class="btn btn-secondary" id="close-history-bottom-btn" style="width: 100%; margin-top: 16px;">Close</button>
            </div>
        `;

        const cardContainer = overlay.querySelector('.card');
        if (cardContainer) {
            cardContainer.outerHTML = content;
        }

        this.attachCloseListener(overlay);
    }

    attachCloseListener(overlay) {
        // Close button at top
        overlay.querySelector('#close-history-overlay-btn')?.addEventListener('click', () => {
            this.close();
        });

        // Close button at bottom
        overlay.querySelector('#close-history-bottom-btn')?.addEventListener('click', () => {
            this.close();
        });

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    close() {
        const overlay = document.getElementById('exercise-history-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// Export singleton instance for easy use
export const exerciseHistoryDialog = new ExerciseHistoryDialog();
