import { api } from '../utils/api-client.js?v=20251116171145';
import { notification } from '../components/notification.js?v=20251116171145';
import { eventBus } from '../utils/event-bus.js?v=20251116171145';

export class ProgressView {
    constructor() {
        this.container = document.getElementById('main');
        this.currentTab = 'overview';
        this.stats = [];
        this.exercises = [];
        this.programs = [];
    }

    async render() {
        try {
            // Check if offline
            if (!navigator.onLine) {
                this.container.innerHTML = `
                    <div class="card">
                        <div class="view-header">
                            <h2>Progress & Records</h2>
                        </div>
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                            <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                Progress tracking and personal records are not available offline. Please connect to the internet to view your progress data.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Load all necessary data
            const [statsResp, exercisesResp, programsResp] = await Promise.all([
                api.getStatsByExercise(),
                api.getExercises(),
                api.getPrograms()
            ]);

            // Check if any data failed to load
            if (!statsResp.success || !exercisesResp.success || !programsResp.success) {
                console.error('Failed to load data for progress');
                this.container.innerHTML = `
                    <div class="card">
                        <div class="view-header">
                            <h2>Progress & Records</h2>
                        </div>
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                            <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                Progress tracking and personal records are not available offline. Please connect to the internet to view your progress data.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }

            this.stats = statsResp.data;
            this.exercises = exercisesResp.data;
            this.programs = programsResp.data;

            this.container.innerHTML = `
                <div class="view-header">
                    <h2>Progress & Records</h2>
                </div>

                <div class="tabs" style="margin-bottom: 24px;">
                    <button class="tab-btn ${this.currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
                        📊 Overview
                    </button>
                    <button class="tab-btn ${this.currentTab === 'personal-records' ? 'active' : ''}" data-tab="personal-records">
                        🏆 Personal Records
                    </button>
                    <button class="tab-btn ${this.currentTab === 'exercise-history' ? 'active' : ''}" data-tab="exercise-history">
                        📈 Exercise History
                    </button>
                </div>

                <div id="progress-content"></div>
            `;

            this.attachListeners();
            this.renderTab(this.currentTab);

        } catch (error) {
            console.error('Error rendering progress view:', error);
            notification.error('Failed to load progress data');
        }
    }

    attachListeners() {
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.renderTab(tab);
    }

    renderTab(tab) {
        const content = document.getElementById('progress-content');
        
        switch (tab) {
            case 'overview':
                this.renderOverview(content);
                break;
            case 'personal-records':
                this.renderPersonalRecords(content);
                break;
            case 'exercise-history':
                this.renderExerciseHistory(content);
                break;
        }
    }

    renderOverview(content) {
        const totalExercises = this.stats.length;
        const exercisesWithPRs = this.stats.filter(s => s.maxWeight).length;
        const totalMaxWeight = this.stats.reduce((sum, s) => sum + (s.maxWeight || 0), 0);
        const totalVolume = this.stats.reduce((sum, s) => sum + (s.maxVolume || 0), 0);

        // Get recent PRs (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentPRs = this.stats.filter(s => {
            if (!s.maxWeightDate) return false;
            const prDate = new Date(s.maxWeightDate);
            return prDate >= thirtyDaysAgo;
        }).sort((a, b) => new Date(b.maxWeightDate) - new Date(a.maxWeightDate)).slice(0, 5);

        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-value">${totalExercises}</div>
                    <div class="stat-label">Exercises Tracked</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${exercisesWithPRs}</div>
                    <div class="stat-label">Personal Records</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalMaxWeight.toFixed(1)} kg</div>
                    <div class="stat-label">Total Max Weight</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalVolume.toFixed(0)} kg</div>
                    <div class="stat-label">Max Session Volume</div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="margin-bottom: 12px;">Recent Personal Records (Last 30 Days)</h3>
                ${recentPRs.length > 0 ? `
                    <div style="display: grid; gap: 12px;">
                        ${recentPRs.map(stat => `
                            <div class="pr-card">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600; margin-bottom: 4px;">${stat.name}</div>
                                        <div style="font-size: 14px; color: var(--text-secondary);">
                                            ${new Date(stat.maxWeightDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 24px; font-weight: 700; color: var(--primary-color);">
                                            ${stat.maxWeight.toFixed(1)} kg
                                        </div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                            Max Weight
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <p>No recent personal records</p>
                        <p style="font-size: 14px; margin-top: 8px;">Keep pushing to set new PRs!</p>
                    </div>
                `}
            </div>

            <div>
                <h3 style="margin-bottom: 12px;">Top 5 Strongest Lifts (1RM Estimates)</h3>
                ${this.stats.filter(s => s.epley1RM).length > 0 ? `
                    <div style="display: grid; gap: 12px;">
                        ${this.stats
                            .filter(s => s.epley1RM)
                            .sort((a, b) => b.epley1RM - a.epley1RM)
                            .slice(0, 5)
                            .map((stat, index) => `
                                <div class="pr-card">
                                    <div style="display: flex; align-items: center; gap: 16px;">
                                        <div style="font-size: 24px; font-weight: 700; color: var(--text-secondary); min-width: 30px;">
                                            #${index + 1}
                                        </div>
                                        <div style="flex: 1;">
                                            <div style="font-weight: 600; margin-bottom: 4px;">${stat.name}</div>
                                            <div style="font-size: 14px; color: var(--text-secondary);">
                                                Estimated 1RM (Epley Formula)
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 24px; font-weight: 700; color: var(--primary-color);">
                                                ${stat.epley1RM.toFixed(1)} kg
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                    </div>
                ` : `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <p>No 1RM estimates available yet</p>
                        <p style="font-size: 14px; margin-top: 8px;">Complete some workouts to see your strength estimates!</p>
                    </div>
                `}
            </div>
        `;
    }

    renderPersonalRecords(content) {
        if (this.stats.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p>No personal records yet</p>
                    <p style="font-size: 14px; margin-top: 8px;">Complete workouts to start tracking your progress!</p>
                </div>
            `;
            return;
        }

        // Group by muscle group
        const exerciseMap = new Map(this.exercises.map(e => [e.id, e]));
        const groupedStats = {};
        
        this.stats.forEach(stat => {
            const exercise = exerciseMap.get(stat.exerciseId);
            const muscleGroup = exercise?.muscleGroup || 'Other';
            if (!groupedStats[muscleGroup]) {
                groupedStats[muscleGroup] = [];
            }
            groupedStats[muscleGroup].push(stat);
        });

        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <input type="text" id="pr-search" placeholder="Search exercises..." 
                    style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary);">
            </div>

            <div id="pr-list">
                ${Object.entries(groupedStats).sort().map(([muscleGroup, stats]) => `
                    <div class="muscle-group-section" style="margin-bottom: 24px;">
                        <h3 style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border);">
                            ${muscleGroup}
                        </h3>
                        <div style="display: grid; gap: 12px;">
                            ${stats.sort((a, b) => a.name.localeCompare(b.name)).map(stat => `
                                <div class="pr-item" data-exercise-name="${stat.name.toLowerCase()}">
                                    <div style="font-weight: 600; margin-bottom: 8px;">${stat.name}</div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                        ${stat.maxWeight ? `
                                            <div style="padding: 12px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 3px solid var(--success-color);">
                                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Max Weight</div>
                                                <div style="font-size: 20px; font-weight: 700; color: var(--success-color);">${stat.maxWeight.toFixed(1)} kg</div>
                                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                                    ${new Date(stat.maxWeightDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>
                                        ` : ''}
                                        ${stat.epley1RM ? `
                                            <div style="padding: 12px; background: rgba(33, 150, 243, 0.1); border-radius: 8px; border-left: 3px solid var(--primary-color);">
                                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Est. 1RM (Epley)</div>
                                                <div style="font-size: 20px; font-weight: 700; color: var(--primary-color);">${stat.epley1RM.toFixed(1)} kg</div>
                                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                                    ${new Date(stat.epley1RMDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>
                                        ` : ''}
                                        ${stat.maxVolume ? `
                                            <div style="padding: 12px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border-left: 3px solid #ff9800;">
                                                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Max Volume</div>
                                                <div style="font-size: 20px; font-weight: 700; color: #ff9800;">${stat.maxVolume.toFixed(0)} kg</div>
                                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                                    ${new Date(stat.maxVolumeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Add search functionality
        const searchInput = document.getElementById('pr-search');
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('.pr-item').forEach(item => {
                const exerciseName = item.dataset.exerciseName;
                item.style.display = exerciseName.includes(searchTerm) ? 'block' : 'none';
            });

            // Hide empty muscle group sections
            document.querySelectorAll('.muscle-group-section').forEach(section => {
                const visibleItems = section.querySelectorAll('.pr-item[style="display: block;"], .pr-item:not([style*="display: none"])');
                section.style.display = visibleItems.length > 0 ? 'block' : 'none';
            });
        });
    }

    async renderExerciseHistory(content) {
        const exercisesWithStats = this.stats.filter(s => s.maxWeight);

        if (exercisesWithStats.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p>No exercise history available yet</p>
                    <p style="font-size: 14px; margin-top: 8px;">Complete some workouts to see your progress over time!</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Select Exercise</label>
                <select id="exercise-selector" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary);">
                    <option value="">-- Choose an exercise --</option>
                    ${exercisesWithStats.sort((a, b) => a.name.localeCompare(b.name)).map(stat => `
                        <option value="${stat.exerciseId}">${stat.name}</option>
                    `).join('')}
                </select>
            </div>

            <div id="history-chart-container"></div>
        `;

        const selector = document.getElementById('exercise-selector');
        selector.addEventListener('change', async (e) => {
            const exerciseId = e.target.value;
            if (!exerciseId) {
                document.getElementById('history-chart-container').innerHTML = '';
                return;
            }

            await this.loadExerciseHistory(exerciseId);
        });
    }

    async loadExerciseHistory(exerciseId) {
        const container = document.getElementById('history-chart-container');
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Loading history...</div>';

        const historyResp = await api.getExerciseHistory(exerciseId);
        
        if (!historyResp.success) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--error-color);">
                    <p>Failed to load exercise history</p>
                </div>
            `;
            return;
        }

        const history = historyResp.data;
        
        if (history.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <p>No history data available for this exercise</p>
                </div>
            `;
            return;
        }

        const exerciseName = this.stats.find(s => s.exerciseId === exerciseId)?.name || 'Exercise';

            // Simple text-based history display
            container.innerHTML = `
                <div>
                    <h3 style="margin-bottom: 16px;">${exerciseName} - Progress History</h3>
                    <div style="display: grid; gap: 12px;">
                        ${history.map(point => {
                            const maxWeight = Math.max(...point.sets.map(s => s.weight));
                            const totalVolume = point.sets.reduce((sum, s) => sum + s.volume, 0);
                            const avgReps = Math.round(point.sets.reduce((sum, s) => sum + s.reps, 0) / point.sets.length);

                            return `
                                <div class="history-item" style="border: 1px solid var(--border); padding: 16px; border-radius: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                        <div>
                                            <div style="font-weight: 600;">
                                                ${new Date(point.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">
                                                ${point.sets.length} sets
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-size: 18px; font-weight: 700; color: var(--primary-color);">
                                                ${maxWeight.toFixed(1)} kg
                                            </div>
                                            <div style="font-size: 12px; color: var(--text-secondary);">
                                                max weight
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; font-size: 14px;">
                                        <div>
                                            <span style="color: var(--text-secondary);">Avg Reps:</span>
                                            <span style="font-weight: 600; margin-left: 4px;">${avgReps}</span>
                                        </div>
                                        <div>
                                            <span style="color: var(--text-secondary);">Volume:</span>
                                            <span style="font-weight: 600; margin-left: 4px;">${totalVolume.toFixed(0)} kg</span>
                                        </div>
                                    </div>
                                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px;">Sets:</div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                            ${point.sets.map(set => `
                                                <span style="background: var(--surface); padding: 6px 12px; border-radius: 6px; font-size: 13px; border: 1px solid var(--border);">
                                                    ${set.weight.toFixed(1)}kg × ${set.reps}
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).reverse().join('')}
                    </div>
                </div>
            `;
    }
}
