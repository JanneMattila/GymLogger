import { api } from '../utils/api-client.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';
import { eventBus } from '../utils/event-bus.js?v=00000000000000';

export class StatsView {
    constructor() {
        this.container = document.getElementById('main');
        this.currentTab = 'by-exercise';
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
                            <h2>📊 Statistics & Analysis</h2>
                        </div>
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                            <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                Statistics and analysis data are not available offline. Please connect to the internet to view your stats.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Load all necessary data
            const [exercisesResp, programsResp] = await Promise.all([
                api.getExercises(),
                api.getPrograms()
            ]);

            // Check if any data failed to load
            if (!exercisesResp.success || !programsResp.success) {
                console.error('Failed to load data for stats');
                this.container.innerHTML = `
                    <div class="card">
                        <div class="view-header">
                            <h2>📊 Statistics & Analysis</h2>
                        </div>
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                            <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                Statistics and analysis data are not available offline. Please connect to the internet to view your stats.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }

            this.exercises = exercisesResp.data;
            this.programs = programsResp.data;

            this.container.innerHTML = `
                <div class="view-header">
                    <h2>📊 Statistics & Analysis</h2>
                </div>

                <div class="tabs" style="margin-bottom: 24px;">
                    <button class="tab-btn ${this.currentTab === 'by-exercise' ? 'active' : ''}" data-tab="by-exercise">
                        💪 By Exercise
                    </button>
                    <button class="tab-btn ${this.currentTab === 'by-program' ? 'active' : ''}" data-tab="by-program">
                        📋 By Program
                    </button>
                    <button class="tab-btn ${this.currentTab === 'by-muscle' ? 'active' : ''}" data-tab="by-muscle">
                        🎯 By Muscle Group
                    </button>
                </div>

                <div id="stats-content"></div>
            `;

            this.attachListeners();
            this.renderTab(this.currentTab);

        } catch (error) {
            console.error('Error rendering stats view:', error);
            notification.error('Failed to load statistics data');
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
        const content = document.getElementById('stats-content');
        
        switch (tab) {
            case 'by-exercise':
                this.renderByExercise(content);
                break;
            case 'by-program':
                this.renderByProgram(content);
                break;
            case 'by-muscle':
                this.renderByMuscle(content);
                break;
        }
    }

    async renderByExercise(content) {
        content.innerHTML = '<div style="text-align: center; padding: 40px;">Loading exercise statistics...</div>';

        const statsResp = await api.getStatsByExercise();

        if (!statsResp.success) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                    <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                    <p style="color: var(--text-secondary);">Exercise statistics are not available offline.</p>
                </div>
            `;
            return;
        }

        this.stats = statsResp.data;

        if (this.stats.length === 0) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <p style="font-size: 48px; margin-bottom: 16px;">💪</p>
                        <p style="font-size: 18px; margin-bottom: 8px;">No statistics available yet</p>
                        <p style="font-size: 14px;">Complete some workouts to see your exercise statistics!</p>
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
                <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
                    <input type="text" id="exercise-search" placeholder="Search exercises..." 
                        style="flex: 1; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary);">
                    <select id="sort-select" style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary);">
                        <option value="name">Sort by Name</option>
                        <option value="maxWeight">Sort by Max Weight</option>
                        <option value="1rm">Sort by 1RM</option>
                    </select>
                </div>

                <div id="exercise-stats-list">
                    ${Object.entries(groupedStats).sort().map(([muscleGroup, stats]) => `
                        <div class="muscle-group-section" style="margin-bottom: 32px;">
                            <h3 style="margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border); display: flex; align-items: center; gap: 8px;">
                                <span>${muscleGroup}</span>
                                <span style="font-size: 14px; color: var(--text-secondary); font-weight: normal;">(${stats.length} exercises)</span>
                            </h3>
                            <div style="display: grid; gap: 16px;">
                                ${stats.sort((a, b) => a.name.localeCompare(b.name)).map(stat => this.renderExerciseStatCard(stat)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            this.attachExerciseStatsListeners();
    }

    renderExerciseStatCard(stat) {
        return `
            <div class="exercise-stat-card" data-exercise-name="${stat.name.toLowerCase()}" 
                style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div>
                        <h4 style="margin-bottom: 4px; font-size: 18px;">${stat.name}</h4>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                    ${stat.maxWeight ? `
                        <div class="stat-mini-card" data-sort-value="${stat.maxWeight}">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Max Weight</div>
                            <div style="font-size: 24px; font-weight: 700; color: var(--success-color);">${stat.maxWeight.toFixed(1)} kg</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                                ${new Date(stat.maxWeightDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${stat.epley1RM ? `
                        <div class="stat-mini-card" data-sort-value="${stat.epley1RM}">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Est. 1RM</div>
                            <div style="font-size: 24px; font-weight: 700; color: var(--primary-color);">${stat.epley1RM.toFixed(1)} kg</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Epley</div>
                        </div>
                    ` : ''}
                    
                    ${stat.brzycki1RM ? `
                        <div class="stat-mini-card" data-sort-value="${stat.brzycki1RM}">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Est. 1RM</div>
                            <div style="font-size: 24px; font-weight: 700; color: var(--primary-color);">${stat.brzycki1RM.toFixed(1)} kg</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Brzycki</div>
                        </div>
                    ` : ''}
                    
                </div>
            </div>
        `;
    }

    attachExerciseStatsListeners() {
        const searchInput = document.getElementById('exercise-search');
        const sortSelect = document.getElementById('sort-select');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                document.querySelectorAll('.exercise-stat-card').forEach(card => {
                    const exerciseName = card.dataset.exerciseName;
                    card.style.display = exerciseName.includes(searchTerm) ? 'block' : 'none';
                });

                // Hide empty muscle group sections
                document.querySelectorAll('.muscle-group-section').forEach(section => {
                    const visibleCards = section.querySelectorAll('.exercise-stat-card:not([style*="display: none"])');
                    section.style.display = visibleCards.length > 0 ? 'block' : 'none';
                });
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const sortBy = e.target.value;
                this.sortExerciseStats(sortBy);
            });
        }
    }

    sortExerciseStats(sortBy) {
        const sections = document.querySelectorAll('.muscle-group-section');
        
        sections.forEach(section => {
            const container = section.querySelector('div[style*="display: grid"]');
            const cards = Array.from(container.querySelectorAll('.exercise-stat-card'));
            
            cards.sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return a.dataset.exerciseName.localeCompare(b.dataset.exerciseName);
                    case 'maxWeight':
                    case '1rm':
                        // Get the first stat-mini-card value for sorting
                        const aValue = parseFloat(a.querySelector('.stat-mini-card')?.dataset.sortValue || 0);
                        const bValue = parseFloat(b.querySelector('.stat-mini-card')?.dataset.sortValue || 0);
                        return bValue - aValue; // Descending
                    default:
                        return 0;
                }
            });
            
            cards.forEach(card => container.appendChild(card));
        });
    }

    async renderByProgram(content) {
        if (this.programs.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p style="font-size: 48px; margin-bottom: 16px;">📋</p>
                    <p style="font-size: 18px; margin-bottom: 8px;">No programs found</p>
                    <p style="font-size: 14px;">Create a program to see statistics by program!</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Select Program</label>
                <select id="program-selector" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary);">
                    <option value="">-- Choose a program --</option>
                    ${this.programs.map(program => `
                        <option value="${program.id}">${program.name}</option>
                    `).join('')}
                </select>
            </div>

            <div id="program-stats-container"></div>
        `;

        const selector = document.getElementById('program-selector');
        selector.addEventListener('change', async (e) => {
            const programId = e.target.value;
            if (!programId) {
                document.getElementById('program-stats-container').innerHTML = '';
                return;
            }

            await this.loadProgramStats(programId);
        });
    }

    async loadProgramStats(programId) {
        const container = document.getElementById('program-stats-container');
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Loading program statistics...</div>';

        // Get program stats, sessions, and exercises
        const [statsResp, sessionsResp, exercisesResp] = await Promise.all([
            api.getStatsByProgram(programId),
            api.getSessions(
                new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            ),
            api.getExercises()
        ]);

        // Check if data is valid
        if (!statsResp.success || !sessionsResp.success || !exercisesResp.success) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                    <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                    <p style="color: var(--text-secondary);">Program statistics are not available offline.</p>
                </div>
            `;
            return;
        }

        const stats = statsResp.data;
        const sessions = sessionsResp.data;
        const exercises = exercisesResp.data;
        const program = this.programs.find(p => p.id === programId);
            
            // Filter sessions for this program
            const programSessions = sessions.filter(s => s.programId === programId && s.status === 'completed');
            
            if (programSessions.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <p>No completed workouts for this program yet</p>
                        <p style="font-size: 14px; margin-top: 8px;">Complete workouts using this program to see statistics!</p>
                    </div>
                `;
                return;
            }

            // Calculate program-level statistics
            const totalWorkouts = programSessions.length;

            const totalSets = programSessions.reduce((sum, session) => 
                sum + (session.sets?.filter(s => !s.isWarmup).length || 0), 0);

            const avgDuration = programSessions.reduce((sum, session) => {
                if (session.startTime && session.endTime) {
                    const duration = (new Date(session.endTime) - new Date(session.startTime)) / 1000 / 60;
                    return sum + duration;
                }
                return sum;
            }, 0) / totalWorkouts;

            // Get latest session date
            const latestSession = programSessions.sort((a, b) => 
                new Date(b.sessionDate) - new Date(a.sessionDate))[0];

            // Calculate workout frequency (last 30 days)
            const last30Days = programSessions.filter(s => {
                const sessionDate = new Date(s.sessionDate);
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                return sessionDate >= thirtyDaysAgo;
            }).length;

            container.innerHTML = `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                        📋 ${program.name}
                        <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary);">
                            Program Statistics
                        </span>
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        <div class="stat-card">
                            <div class="stat-value">${totalWorkouts}</div>
                            <div class="stat-label">Total Workouts</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${totalSets}</div>
                            <div class="stat-label">Total Sets</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${avgDuration.toFixed(0)}</div>
                            <div class="stat-label">Avg Duration (min)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${last30Days}</div>
                            <div class="stat-label">Last 30 Days</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${new Date(latestSession.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                            <div class="stat-label">Last Workout</div>
                        </div>
                    </div>

                    ${stats.length > 0 ? `
                        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border);">
                            <h4 style="margin-bottom: 12px; font-size: 16px;">💪 Exercises in Program (${stats.length})</h4>
                            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">
                                Personal records and performance metrics for each exercise
                            </p>
                        </div>
                    ` : ''}
                </div>

                ${stats.length > 0 ? `
                    <div style="display: grid; gap: 16px;">
                        ${stats.map(stat => this.renderExerciseStatCard(stat)).join('')}
                    </div>
                ` : ''}
            `;
    }

    async renderByMuscle(content) {
        const muscleGroups = [...new Set(this.exercises.map(e => e.muscleGroup).filter(Boolean))].sort();

        if (muscleGroups.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p style="font-size: 48px; margin-bottom: 16px;">🎯</p>
                    <p style="font-size: 18px; margin-bottom: 8px;">No muscle groups found</p>
                    <p style="font-size: 14px;">Add exercises with muscle groups to see statistics!</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Select Muscle Group</label>
                <select id="muscle-selector" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary);">
                    <option value="">-- Choose a muscle group --</option>
                    ${muscleGroups.map(muscle => `
                        <option value="${muscle}">${muscle}</option>
                    `).join('')}
                </select>
            </div>

            <div id="muscle-stats-container"></div>
        `;

        const selector = document.getElementById('muscle-selector');
        selector.addEventListener('change', async (e) => {
            const muscleGroup = e.target.value;
            if (!muscleGroup) {
                document.getElementById('muscle-stats-container').innerHTML = '';
                return;
            }

            await this.loadMuscleStats(muscleGroup);
        });
    }

    async loadMuscleStats(muscleGroup) {
        const container = document.getElementById('muscle-stats-container');
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Loading muscle group statistics...</div>';

        // Get stats and sessions for this muscle group
        const [statsResp, sessionsResp] = await Promise.all([
            api.getStatsByMuscle(muscleGroup),
            api.getSessions(
                new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            )
        ]);

        // Check if data is valid
        if (!statsResp.success || !sessionsResp.success) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                    <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                    <p style="color: var(--text-secondary);">Muscle group statistics are not available offline.</p>
                </div>
            `;
            return;
        }

        const stats = statsResp.data;
        const sessions = sessionsResp.data;

        if (stats.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <p>No statistics available for ${muscleGroup} yet</p>
                        <p style="font-size: 14px; margin-top: 8px;">Complete workouts targeting this muscle group to see statistics!</p>
                    </div>
                `;
                return;
            }

            // Get exercise IDs for this muscle group
            const exerciseIds = new Set(stats.map(s => s.exerciseId));

            // Filter sessions that contain exercises from this muscle group
            const muscleGroupSessions = sessions.filter(s => 
                s.status === 'completed' && 
                s.sets?.some(set => exerciseIds.has(set.exerciseId))
            );

            // Calculate muscle group statistics
            const totalSets = muscleGroupSessions.reduce((sum, session) => {
                const muscleSets = session.sets?.filter(set => 
                    !set.isWarmup && exerciseIds.has(set.exerciseId)
                ) || [];
                return sum + muscleSets.length;
            }, 0);

            // Count workouts in last 30 days
            const last30Days = muscleGroupSessions.filter(s => {
                const sessionDate = new Date(s.sessionDate);
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                return sessionDate >= thirtyDaysAgo;
            }).length;

            // Find latest session
            const latestSession = muscleGroupSessions.length > 0 ? 
                muscleGroupSessions.sort((a, b) => 
                    new Date(b.sessionDate) - new Date(a.sessionDate))[0] : null;

            const totalMaxWeight = stats.reduce((sum, s) => sum + (s.maxWeight || 0), 0);
            const avgMaxWeight = totalMaxWeight / stats.filter(s => s.maxWeight).length;

            container.innerHTML = `
                <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                        🎯 ${muscleGroup}
                        <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary);">
                            Muscle Group Statistics
                        </span>
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        <div class="stat-card">
                            <div class="stat-value">${stats.length}</div>
                            <div class="stat-label">Exercises</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${totalSets}</div>
                            <div class="stat-label">Total Sets</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${totalMaxWeight.toFixed(1)}</div>
                            <div class="stat-label">Total Max Weight (kg)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${avgMaxWeight.toFixed(1)}</div>
                            <div class="stat-label">Avg Max Weight (kg)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${last30Days}</div>
                            <div class="stat-label">Workouts (30d)</div>
                        </div>
                        ${latestSession ? `
                            <div class="stat-card">
                                <div class="stat-value">${new Date(latestSession.sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                <div class="stat-label">Last Trained</div>
                            </div>
                        ` : ''}
                    </div>

                    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border);">
                        <h4 style="margin-bottom: 12px; font-size: 16px;">💪 Exercises for ${muscleGroup} (${stats.length})</h4>
                        <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 12px;">
                            Personal records sorted by max weight
                        </p>
                    </div>
                </div>

                <div style="display: grid; gap: 16px;">
                    ${stats.sort((a, b) => (b.maxWeight || 0) - (a.maxWeight || 0)).map(stat => this.renderExerciseStatCard(stat)).join('')}
                </div>
            `;
    }
}
