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
        this.currentWeekStart = this.getStartOfWeek(new Date());
        this.weekCache = new Map();
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
            this.weekCache.clear();

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
                    <button class="tab-btn ${this.currentTab === 'by-week' ? 'active' : ''}" data-tab="by-week">
                        📆 By Week
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
            case 'by-week':
                this.renderByWeek(content);
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

    renderByWeek(content) {
        const weekStart = new Date(this.currentWeekStart);
        const currentWeekStart = this.getStartOfWeek(new Date());
        const disableNext = weekStart.getTime() >= currentWeekStart.getTime();
        const weekLabel = this.formatWeekRange(weekStart);

        content.innerHTML = `
            <div class="week-view" style="display: flex; flex-direction: column; gap: 24px;">
                <div class="week-navigation" style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                    <button type="button" id="week-prev" class="week-nav-btn" aria-label="Previous week"
                        style="padding: 10px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary); border-radius: 8px; cursor: pointer;">
                        &#8592;
                    </button>
                    <div id="week-label" style="flex: 1; text-align: center; font-size: 18px; font-weight: 600;">
                        ${weekLabel}
                    </div>
                    <button type="button" id="week-next" class="week-nav-btn" aria-label="Next week"
                        ${disableNext ? 'disabled' : ''}
                        style="padding: 10px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text-primary); border-radius: 8px; cursor: ${disableNext ? 'not-allowed' : 'pointer'}; opacity: ${disableNext ? '0.4' : '1'};">
                        &#8594;
                    </button>
                </div>

                <div id="week-summary-content" style="display: flex; flex-direction: column; gap: 24px;">
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        Loading weekly statistics...
                    </div>
                </div>
            </div>
        `;

        this.attachWeekNavigationListeners();
        this.populateWeekContent(weekStart);
    }

    attachWeekNavigationListeners() {
        const prevButton = document.getElementById('week-prev');
        const nextButton = document.getElementById('week-next');

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                this.changeWeek(-1);
            });
        }

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                this.changeWeek(1);
            });
        }
    }

    changeWeek(offset) {
        if (!Number.isInteger(offset) || offset === 0) {
            return;
        }

        const newStart = new Date(this.currentWeekStart);
        newStart.setDate(newStart.getDate() + offset * 7);

        const currentWeekStart = this.getStartOfWeek(new Date());
        if (newStart.getTime() > currentWeekStart.getTime()) {
            return;
        }

        this.currentWeekStart = this.getStartOfWeek(newStart);
        this.renderTab('by-week');
    }

    async populateWeekContent(weekStart) {
        const container = document.getElementById('week-summary-content');
        const expectedKey = this.getWeekKey(weekStart);

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                Loading weekly statistics...
            </div>
        `;

        const weekStats = await this.getWeekStats(weekStart);

        if (expectedKey !== this.getWeekKey(this.currentWeekStart)) {
            return;
        }

        if (!weekStats.success) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                    <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                    <p style="color: var(--text-secondary);">Weekly statistics are not available offline.</p>
                </div>
            `;
            return;
        }

        if (weekStats.sessions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p style="font-size: 48px; margin-bottom: 16px;">📆</p>
                    <p style="font-size: 18px; margin-bottom: 8px;">No completed workouts this week yet</p>
                    <p style="font-size: 14px;">Log your training sessions to build your weekly insights.</p>
                </div>
            `;
            return;
        }

        const { summary, muscleBreakdown, highlights, topExercises } = weekStats;

        const summaryCards = [
            {
                label: 'Workouts',
                value: summary.totalWorkouts,
                subValue: `${summary.trainingDays} training ${summary.trainingDays === 1 ? 'day' : 'days'}`
            },
            {
                label: 'Sets',
                value: summary.totalSets,
                subValue: `${this.formatNumber(summary.avgSetsPerWorkout, 1)} per workout`
            },
            {
                label: 'Reps',
                value: summary.totalReps,
                subValue: `${this.formatNumber(summary.avgRepsPerWorkout, 0)} per workout`
            },
            {
                label: 'Volume',
                value: `${this.formatWeight(summary.totalVolume)} kg`,
                subValue: `${this.formatWeight(summary.avgVolumePerWorkout)} kg / session`
            },
            {
                label: 'Intensity',
                value: `${this.formatWeight(summary.avgIntensity)} kg`,
                subValue: 'Average load per rep'
            },
            {
                label: 'Duration',
                value: this.formatMinutes(summary.avgDuration),
                subValue: summary.totalDuration > 0 ? `${this.formatMinutes(summary.totalDuration)} total` : 'No tracked duration'
            }
        ];

        const highlightItems = [];

        if (highlights.topMuscleByVolume && (highlights.topMuscleByVolume.volume > 0 || highlights.topMuscleByVolume.sets > 0)) {
            highlightItems.push(`Primary focus: <strong>${highlights.topMuscleByVolume.muscleGroup}</strong> with ${this.formatWeight(highlights.topMuscleByVolume.volume)} kg across ${highlights.topMuscleByVolume.sets} sets.`);
        }

        if (highlights.heaviestSet && highlights.heaviestSet.weight > 0) {
            highlightItems.push(`Heaviest set: <strong>${this.formatWeight(highlights.heaviestSet.weight)} kg × ${highlights.heaviestSet.reps}</strong> on ${this.formatShortDate(highlights.heaviestSet.date)} (${highlights.heaviestSet.exerciseName}).`);
        }

        if (highlights.mostTrainedDay) {
            highlightItems.push(`Most consistent day: <strong>${highlights.mostTrainedDay.day}</strong> (${highlights.mostTrainedDay.count} session${highlights.mostTrainedDay.count === 1 ? '' : 's'}).`);
        }

        if (highlights.topVolumeSession && highlights.topVolumeSession.volume > 0) {
            highlightItems.push(`Biggest session: <strong>${this.formatWeight(highlights.topVolumeSession.volume)} kg</strong> on ${this.formatShortDate(highlights.topVolumeSession.date)}.`);
        }

        const highlightSection = highlightItems.length ? `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                <h4 style="margin-bottom: 12px; font-size: 16px;">Weekly Highlights</h4>
                <ul style="list-style: disc; padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
                    ${highlightItems.map(item => `<li style="color: var(--text-secondary);">${item}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        const topExercisesSection = topExercises.length ? `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                <h4 style="margin-bottom: 12px; font-size: 16px;">Top Exercises This Week</h4>
                <ol style="padding-left: 20px; display: flex; flex-direction: column; gap: 8px;">
                    ${topExercises.map(exercise => `
                        <li style="color: var(--text-secondary);">
                            <strong>${exercise.name}</strong> — ${this.formatWeight(exercise.volume)} kg, ${exercise.sets} sets, ${exercise.reps} reps (${exercise.muscleGroup})
                        </li>
                    `).join('')}
                </ol>
            </div>
        ` : '';

        const insightsSections = [highlightSection, topExercisesSection].filter(Boolean);
        const insightsGrid = insightsSections.length ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
                ${insightsSections.join('')}
            </div>
        ` : '';

        const muscleSections = muscleBreakdown.map(muscle => `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h4 style="margin-bottom: 4px;">${muscle.muscleGroup}</h4>
                        <div style="font-size: 12px; color: var(--text-secondary);">Active on ${muscle.daysTrained} day${muscle.daysTrained === 1 ? '' : 's'}</div>
                    </div>
                    <div style="text-align: right; font-size: 12px; color: var(--text-secondary);">
                        ${muscle.sets} sets
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">Reps</div>
                        <div style="font-size: 20px; font-weight: 600;">${muscle.reps}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${this.formatNumber(muscle.averageRepsPerSet, 1)} per set</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">Volume</div>
                        <div style="font-size: 20px; font-weight: 600;">${this.formatWeight(muscle.volume)} kg</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${this.formatWeight(muscle.averageLoadPerRep)} kg / rep</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px;">Max Load</div>
                        <div style="font-size: 20px; font-weight: 600;">${this.formatWeight(muscle.maxWeight)} kg</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Heaviest working set</div>
                    </div>
                </div>
                ${muscle.exercises.length ? `
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px;">Key Exercises</div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${muscle.exercises.slice(0, 3).map(exercise => `
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 600;">${exercise.name}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">${exercise.sets} sets • ${exercise.reps} reps</div>
                                    </div>
                                    <div style="text-align: right; font-size: 12px; color: var(--text-secondary);">
                                        ${this.formatWeight(exercise.volume)} kg
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
                ${summaryCards.map(card => `
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 6px;">
                        <div style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">${card.label}</div>
                        <div style="font-size: 24px; font-weight: 700;">${card.value}</div>
                        ${card.subValue ? `<div style="font-size: 12px; color: var(--text-secondary);">${card.subValue}</div>` : ''}
                    </div>
                `).join('')}
            </div>

            ${insightsGrid}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                ${muscleSections}
            </div>
        `;
    }

    async getWeekStats(weekStart) {
        const weekKey = this.getWeekKey(weekStart);

        if (this.weekCache.has(weekKey)) {
            return this.weekCache.get(weekKey);
        }

        const startDate = this.formatISODate(weekStart);
        const endDate = this.formatISODate(this.getEndOfWeek(weekStart));

        const sessionsResp = await api.getSessions(startDate, endDate, { showLoader: false });

        if (!sessionsResp.success) {
            return { success: false, sessions: [] };
        }

        const sessions = (sessionsResp.data || []).filter(session => session.status === 'completed');
        const stats = this.computeWeeklyStats(sessions, weekStart);

        const result = {
            success: true,
            sessions,
            ...stats
        };

        this.weekCache.set(weekKey, result);
        return result;
    }

    computeWeeklyStats(sessions, weekStart) {
        const exerciseMap = new Map(this.exercises.map(exercise => [exercise.id, exercise]));

        let totalSets = 0;
        let totalReps = 0;
        let totalVolume = 0;
        let totalDuration = 0;
        const trainingDays = new Set();
        const dayCounts = {};
        const muscleMap = new Map();
        const exerciseTotals = new Map();
        const sessionStats = [];
        let heaviestSet = null;

        sessions.forEach(session => {
            const sessionDateValue = session.sessionDate || session.startTime;
            if (sessionDateValue) {
                const sessionDate = this.parseISODate(sessionDateValue);
                if (sessionDate) {
                    trainingDays.add(this.formatISODate(sessionDate));
                } else {
                    trainingDays.add(sessionDateValue);
                }

                const dayName = this.formatWeekday(sessionDateValue);
                if (dayName !== 'Unknown') {
                    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
                }
            }

            if (session.startTime && session.endTime) {
                const start = new Date(session.startTime);
                const end = new Date(session.endTime);
                if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
                    totalDuration += (end - start) / 60000;
                }
            }

            const workingSets = (session.sets || []).filter(set => !set.isWarmup);
            const sessionSetCount = workingSets.length;
            const sessionReps = workingSets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
            const sessionVolume = workingSets.reduce((sum, set) => {
                const weight = Number(set.weight) || 0;
                const reps = Number(set.reps) || 0;
                return sum + weight * reps;
            }, 0);

            totalSets += sessionSetCount;
            totalReps += sessionReps;
            totalVolume += sessionVolume;

            sessionStats.push({
                id: session.id,
                date: session.sessionDate || session.startTime,
                volume: sessionVolume,
                sets: sessionSetCount,
                reps: sessionReps
            });

            const musclesHit = new Set();

            workingSets.forEach(set => {
                const exercise = exerciseMap.get(set.exerciseId);
                const muscleGroup = exercise?.muscleGroup || 'Other';
                const exerciseName = exercise?.name || 'Unknown exercise';
                const weight = Number(set.weight) || 0;
                const reps = Number(set.reps) || 0;
                const volume = weight * reps;

                if (!heaviestSet || weight > heaviestSet.weight) {
                    heaviestSet = {
                        weight,
                        reps,
                        exerciseName,
                        muscleGroup,
                        date: session.sessionDate || session.startTime
                    };
                }

                let muscleData = muscleMap.get(muscleGroup);
                if (!muscleData) {
                    muscleData = {
                        sets: 0,
                        reps: 0,
                        volume: 0,
                        maxWeight: 0,
                        days: new Set(),
                        exercises: new Map()
                    };
                    muscleMap.set(muscleGroup, muscleData);
                }

                muscleData.sets += 1;
                muscleData.reps += reps;
                muscleData.volume += volume;
                muscleData.maxWeight = Math.max(muscleData.maxWeight, weight);

                let exerciseData = muscleData.exercises.get(exerciseName);
                if (!exerciseData) {
                    exerciseData = {
                        sets: 0,
                        reps: 0,
                        volume: 0,
                        maxWeight: 0
                    };
                    muscleData.exercises.set(exerciseName, exerciseData);
                }

                exerciseData.sets += 1;
                exerciseData.reps += reps;
                exerciseData.volume += volume;
                exerciseData.maxWeight = Math.max(exerciseData.maxWeight, weight);

                const aggregateExercise = exerciseTotals.get(exerciseName) || {
                    sets: 0,
                    reps: 0,
                    volume: 0,
                    muscleGroup
                };
                aggregateExercise.sets += 1;
                aggregateExercise.reps += reps;
                aggregateExercise.volume += volume;
                exerciseTotals.set(exerciseName, aggregateExercise);

                musclesHit.add(muscleGroup);
            });

            musclesHit.forEach(muscle => {
                const muscleData = muscleMap.get(muscle);
                if (muscleData && session.sessionDate) {
                    muscleData.days.add(session.sessionDate);
                }
            });
        });

        const muscleBreakdown = Array.from(muscleMap.entries()).map(([muscleGroup, data]) => {
            const exercises = Array.from(data.exercises.entries()).map(([name, stats]) => ({
                name,
                sets: stats.sets,
                reps: stats.reps,
                volume: stats.volume,
                maxWeight: stats.maxWeight,
                averageLoadPerRep: stats.reps ? stats.volume / stats.reps : 0
            })).sort((a, b) => b.volume - a.volume);

            return {
                muscleGroup,
                sets: data.sets,
                reps: data.reps,
                volume: data.volume,
                maxWeight: data.maxWeight,
                averageRepsPerSet: data.sets ? data.reps / data.sets : 0,
                averageLoadPerRep: data.reps ? data.volume / data.reps : 0,
                daysTrained: data.days.size,
                exercises
            };
        }).sort((a, b) => b.volume - a.volume);

        const topMuscleByVolume = muscleBreakdown[0] || null;
        const topMuscleBySets = [...muscleBreakdown].sort((a, b) => b.sets - a.sets)[0] || null;

        const topVolumeSession = sessionStats.sort((a, b) => b.volume - a.volume)[0] || null;

        const mostTrainedDay = Object.entries(dayCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([day, count]) => ({ day, count }))[0] || null;

        const topExercises = Array.from(exerciseTotals.entries())
            .map(([name, stats]) => ({
                name,
                sets: stats.sets,
                reps: stats.reps,
                volume: stats.volume,
                muscleGroup: stats.muscleGroup,
                averageLoadPerRep: stats.reps ? stats.volume / stats.reps : 0
            }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 3);

        const totalWorkouts = sessions.length;

        return {
            summary: {
                totalWorkouts,
                trainingDays: trainingDays.size,
                totalSets,
                totalReps,
                totalVolume,
                totalDuration,
                avgSetsPerWorkout: totalWorkouts ? totalSets / totalWorkouts : 0,
                avgRepsPerWorkout: totalWorkouts ? totalReps / totalWorkouts : 0,
                avgVolumePerWorkout: totalWorkouts ? totalVolume / totalWorkouts : 0,
                avgIntensity: totalReps ? totalVolume / totalReps : 0,
                avgDuration: totalWorkouts ? totalDuration / totalWorkouts : 0,
                muscleGroupsHit: muscleBreakdown.length
            },
            muscleBreakdown,
            highlights: {
                topMuscleByVolume,
                topMuscleBySets,
                mostTrainedDay,
                heaviestSet,
                topVolumeSession
            },
            topExercises
        };
    }

    getStartOfWeek(date) {
        const reference = new Date(date);
        reference.setHours(0, 0, 0, 0);
        const day = reference.getDay();
        const diff = (day === 0 ? -6 : 1 - day);
        reference.setDate(reference.getDate() + diff);
        return reference;
    }

    getEndOfWeek(startOfWeek) {
        const end = new Date(startOfWeek);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    }

    getWeekKey(date) {
        return this.formatISODate(this.getStartOfWeek(date));
    }

    formatISODate(date) {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        const offset = normalized.getTimezoneOffset();
        const utc = new Date(normalized.getTime() - offset * 60000);
        return utc.toISOString().split('T')[0];
    }

    formatWeekRange(startOfWeek) {
        const start = new Date(startOfWeek);
        const end = this.getEndOfWeek(startOfWeek);
        const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const sameYear = start.getFullYear() === end.getFullYear();
        const yearLabel = sameYear ? start.getFullYear() : `${start.getFullYear()} / ${end.getFullYear()}`;
        return `${startLabel} – ${endLabel} ${yearLabel}`;
    }

    formatNumber(value, decimals = 0) {
        const num = Number(value) || 0;
        return num.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    formatWeight(value) {
        const num = Number(value) || 0;
        if (num === 0) {
            return '0';
        }
        const decimals = num >= 100 ? 0 : 1;
        return num.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    formatMinutes(value) {
        const minutes = Math.round(Number(value) || 0);
        if (minutes <= 0) {
            return '—';
        }
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remaining = minutes % 60;
        if (remaining === 0) {
            return `${hours} h`;
        }
        return `${hours} h ${remaining} min`;
    }

    formatShortDate(value) {
        if (!value) {
            return '';
        }
        const date = this.parseISODate(value);
        if (!date) {
            return value;
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    formatWeekday(value) {
        if (!value) {
            return 'Unknown';
        }
        const date = this.parseISODate(value);
        if (!date) {
            return 'Unknown';
        }
        return date.toLocaleDateString(undefined, { weekday: 'long' });
    }

    parseISODate(value) {
        if (!value) {
            return null;
        }
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date;
    }
}
