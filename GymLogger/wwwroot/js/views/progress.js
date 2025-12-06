import { api } from '../utils/api-client.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';
import { eventBus } from '../utils/event-bus.js?v=00000000000000';

export class ProgressView {
    constructor() {
        this.container = document.getElementById('main');
        this.currentTab = 'overview';
        this.stats = [];
        this.exercises = [];
        this.programs = [];
        this.workoutCount = 0;
        this.bodyMapData = null;
        this.strengthStandards = null;
        this.selectedGender = null;
        this.selectedAgeGroup = null;
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
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 1);
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            const [statsResp, exercisesResp, programsResp, sessionsResp] = await Promise.all([
                api.getStatsByExercise(),
                api.getExercises(),
                api.getPrograms(),
                api.getSessions(startDateStr, endDateStr)
            ]);

            // Check if any data failed to load
            if (!statsResp.success || !exercisesResp.success || !programsResp.success || !sessionsResp.success) {
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
            this.workoutCount = sessionsResp.data.filter(session => session.status === 'completed').length;

            this.container.innerHTML = `
                <div class="view-header">
                    <h2>Progress & Records</h2>
                </div>

                <div class="tabs" style="margin-bottom: 24px;">
                    <button class="tab-btn ${this.currentTab === 'overview' ? 'active' : ''}" data-tab="overview">
                        📊 Overview
                    </button>
                    <button class="tab-btn ${this.currentTab === 'body-map' ? 'active' : ''}" data-tab="body-map">
                        🏋️ Body Map
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
            case 'body-map':
                this.renderBodyMap(content);
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
                    <div class="stat-value">${this.workoutCount}</div>
                    <div class="stat-label">Workouts Logged</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalExercises}</div>
                    <div class="stat-label">Exercises Tracked</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${exercisesWithPRs}</div>
                    <div class="stat-label">Personal Records</div>
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

    async renderBodyMap(content) {
        content.innerHTML = '<div style="text-align: center; padding: 40px;">Loading body map data...</div>';
        
        try {
            const [bodyMapResponse, standardsResponse] = await Promise.all([
                api.getBodyMap(),
                api.getStrengthStandards()
            ]);
            
            if (!bodyMapResponse.success) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <p>Unable to load body map data</p>
                        <p style="font-size: 14px; margin-top: 8px;">Please try again later.</p>
                    </div>
                `;
                return;
            }
            
            this.bodyMapData = bodyMapResponse.data;
            this.strengthStandards = standardsResponse.success ? standardsResponse.data : null;
            
            // Auto-select gender and age group based on user's settings
            if (this.bodyMapData.gender) {
                this.selectedGender = this.bodyMapData.gender;
            } else {
                this.selectedGender = this.strengthStandards?.defaultGender || 'Male';
            }
            
            if (this.bodyMapData.age && this.strengthStandards) {
                this.selectedAgeGroup = this.getAgeGroupId(this.bodyMapData.age);
            } else {
                this.selectedAgeGroup = this.strengthStandards?.defaultAgeGroup || '20-30';
            }
            
            this.renderBodyMapContent(content);
        } catch (error) {
            console.error('Error loading body map:', error);
            content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <p>Error loading body map data</p>
                </div>
            `;
        }
    }

    getAgeGroupId(age) {
        if (!this.strengthStandards?.ageGroups) return '20-30';
        
        for (const ageGroup of this.strengthStandards.ageGroups) {
            const minMatches = !ageGroup.minAge || age >= ageGroup.minAge;
            const maxMatches = !ageGroup.maxAge || age <= ageGroup.maxAge;
            
            if (minMatches && maxMatches) {
                return ageGroup.id;
            }
        }
        
        return this.strengthStandards.defaultAgeGroup || '20-30';
    }

    renderBodyMapContent(content) {
        const data = this.bodyMapData;
        
        // Define level colors
        const levelColors = {
            0: { bg: '#6b7280', name: 'No Data', color: '#9ca3af' },      // Gray
            1: { bg: '#ef4444', name: 'Beginner', color: '#fecaca' },     // Red
            2: { bg: '#f97316', name: 'Novice', color: '#fed7aa' },       // Orange
            3: { bg: '#eab308', name: 'Intermediate', color: '#fef08a' }, // Yellow
            4: { bg: '#22c55e', name: 'Advanced', color: '#bbf7d0' },     // Green
            5: { bg: '#8b5cf6', name: 'Elite', color: '#ddd6fe' }         // Purple
        };
        
        // Create muscle group to level mapping
        const muscleMap = {};
        data.muscleAdvancements.forEach(m => {
            muscleMap[m.muscleGroup] = m;
        });
        
        const getColor = (muscleGroup) => {
            const advancement = muscleMap[muscleGroup];
            return levelColors[advancement?.level ?? 0].bg;
        };
        
        const getLevelInfo = (muscleGroup) => {
            const advancement = muscleMap[muscleGroup];
            if (!advancement || advancement.level === 0) {
                return { level: 0, name: 'No Data', best1RM: null, ratio: null };
            }
            return {
                level: advancement.level,
                name: advancement.levelName,
                best1RM: advancement.best1RM,
                ratio: advancement.strengthRatio,
                exerciseName: advancement.bestExerciseName
            };
        };

        content.innerHTML = `
            <div style="margin-bottom: 24px;">
                ${!data.hasBodyMetrics ? `
                    <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid #eab308; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <div style="display: flex; align-items: start; gap: 12px;">
                            <span style="font-size: 24px;">💡</span>
                            <div>
                                <div style="font-weight: 600; margin-bottom: 4px;">Improve Accuracy</div>
                                <p style="font-size: 14px; color: var(--text-secondary); margin: 0;">
                                    Add your body weight, gender, and age in <a href="#" onclick="window.location.hash='preferences'; return false;" style="color: var(--primary-color);">Settings</a> 
                                    for more accurate advancement calculations. This information is only used to analyze your progress.
                                </p>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px;">
                            <span><strong>Body Weight:</strong> ${data.bodyWeight?.toFixed(1) || '-'} kg</span>
                            <span><strong>Gender:</strong> ${data.gender || '-'}</span>
                            <span><strong>Age:</strong> ${data.age || '-'}</span>
                        </div>
                    </div>
                `}
                
                <!-- Body Diagram -->
                <div style="display: flex; flex-wrap: wrap; gap: 32px; justify-content: center; align-items: start;">
                    <!-- Human Body SVG -->
                    <div style="flex: 0 0 auto; background: var(--surface); border-radius: 16px; padding: 24px; border: 1px solid var(--border);">
                        <svg viewBox="0 0 180 380" style="width: 180px; height: 380px;">
                            <defs>
                                <!-- Gradients for depth -->
                                <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#e8d5c4"/>
                                    <stop offset="100%" style="stop-color:#d4c4b0"/>
                                </linearGradient>
                                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.15"/>
                                </filter>
                            </defs>
                            
                            <!-- Head -->
                            <ellipse cx="90" cy="28" rx="22" ry="25" fill="url(#skinGradient)" filter="url(#shadow)"/>
                            
                            <!-- Neck -->
                            <path d="M 80 50 L 80 65 Q 90 70 100 65 L 100 50" fill="url(#skinGradient)"/>
                            
                            <!-- Trapezius/Upper Back - behind shoulders -->
                            <path d="M 55 65 Q 90 55 125 65 L 125 85 Q 90 78 55 85 Z" 
                                  fill="${getColor('Back')}" class="muscle-region" data-muscle="Back" filter="url(#shadow)"/>
                            
                            <!-- Shoulders (Deltoids) -->
                            <ellipse cx="45" cy="82" rx="18" ry="14" fill="${getColor('Shoulders')}" 
                                     class="muscle-region" data-muscle="Shoulders" filter="url(#shadow)"/>
                            <ellipse cx="135" cy="82" rx="18" ry="14" fill="${getColor('Shoulders')}" 
                                     class="muscle-region" data-muscle="Shoulders" filter="url(#shadow)"/>
                            
                            <!-- Chest (Pectorals) -->
                            <path d="M 55 78 
                                     Q 72 82 90 80 Q 108 82 125 78
                                     L 125 108 
                                     Q 108 118 90 120 Q 72 118 55 108 Z" 
                                  fill="${getColor('Chest')}" class="muscle-region" data-muscle="Chest" filter="url(#shadow)"/>
                            
                            <!-- Lats (side of back) -->
                            <path d="M 35 95 Q 30 115 35 135 L 55 130 L 55 95 Z" 
                                  fill="${getColor('Back')}" class="muscle-region" data-muscle="Back"/>
                            <path d="M 145 95 Q 150 115 145 135 L 125 130 L 125 95 Z" 
                                  fill="${getColor('Back')}" class="muscle-region" data-muscle="Back"/>
                            
                            <!-- Upper Arms (Biceps/Triceps) -->
                            <path d="M 28 85 Q 18 100 18 120 Q 18 145 28 160 Q 38 145 38 120 Q 38 100 28 85 Z" 
                                  fill="${getColor('Arms')}" class="muscle-region" data-muscle="Arms" filter="url(#shadow)"/>
                            <path d="M 152 85 Q 162 100 162 120 Q 162 145 152 160 Q 142 145 142 120 Q 142 100 152 85 Z" 
                                  fill="${getColor('Arms')}" class="muscle-region" data-muscle="Arms" filter="url(#shadow)"/>
                            
                            <!-- Forearms -->
                            <path d="M 22 162 Q 14 180 16 205 Q 20 210 26 205 Q 32 180 28 162 Z" 
                                  fill="${getColor('Arms')}" class="muscle-region" data-muscle="Arms" filter="url(#shadow)"/>
                            <path d="M 158 162 Q 166 180 164 205 Q 160 210 154 205 Q 148 180 152 162 Z" 
                                  fill="${getColor('Arms')}" class="muscle-region" data-muscle="Arms" filter="url(#shadow)"/>
                            
                            <!-- Hands -->
                            <ellipse cx="21" cy="218" rx="7" ry="10" fill="url(#skinGradient)"/>
                            <ellipse cx="159" cy="218" rx="7" ry="10" fill="url(#skinGradient)"/>
                            
                            <!-- Core (Abs + Obliques) -->
                            <path d="M 58 122 
                                     L 58 185 
                                     Q 58 195 68 195 
                                     L 112 195 
                                     Q 122 195 122 185 
                                     L 122 122 
                                     Q 90 130 58 122 Z" 
                                  fill="${getColor('Core')}" class="muscle-region" data-muscle="Core" filter="url(#shadow)"/>
                            <!-- Ab lines -->
                            <line x1="90" y1="130" x2="90" y2="190" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
                            <line x1="62" y1="145" x2="118" y2="145" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
                            <line x1="62" y1="165" x2="118" y2="165" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
                            
                            <!-- Hip area (neutral) -->
                            <path d="M 55 193 Q 90 200 125 193 L 125 210 Q 90 215 55 210 Z" fill="url(#skinGradient)"/>
                            
                            <!-- Upper Legs (Quads/Hamstrings) -->
                            <path d="M 55 208 
                                     Q 50 240 52 280 
                                     Q 55 290 65 290
                                     L 82 290
                                     Q 88 290 88 280
                                     Q 88 240 85 208 Z" 
                                  fill="${getColor('Legs')}" class="muscle-region" data-muscle="Legs" filter="url(#shadow)"/>
                            <path d="M 125 208 
                                     Q 130 240 128 280 
                                     Q 125 290 115 290
                                     L 98 290
                                     Q 92 290 92 280
                                     Q 92 240 95 208 Z" 
                                  fill="${getColor('Legs')}" class="muscle-region" data-muscle="Legs" filter="url(#shadow)"/>
                            
                            <!-- Knees (neutral) -->
                            <ellipse cx="70" cy="295" rx="12" ry="8" fill="url(#skinGradient)"/>
                            <ellipse cx="110" cy="295" rx="12" ry="8" fill="url(#skinGradient)"/>
                            
                            <!-- Lower Legs (Calves) -->
                            <path d="M 58 300 
                                     Q 52 325 55 355 
                                     Q 58 365 68 365
                                     L 75 365
                                     Q 82 365 82 355
                                     Q 85 325 80 300 Z" 
                                  fill="${getColor('Legs')}" class="muscle-region" data-muscle="Legs" filter="url(#shadow)"/>
                            <path d="M 122 300 
                                     Q 128 325 125 355 
                                     Q 122 365 112 365
                                     L 105 365
                                     Q 98 365 98 355
                                     Q 95 325 100 300 Z" 
                                  fill="${getColor('Legs')}" class="muscle-region" data-muscle="Legs" filter="url(#shadow)"/>
                            
                            <!-- Feet -->
                            <ellipse cx="68" cy="372" rx="12" ry="5" fill="url(#skinGradient)"/>
                            <ellipse cx="112" cy="372" rx="12" ry="5" fill="url(#skinGradient)"/>
                        </svg>
                    </div>
                    
                    <!-- Muscle Group Details -->
                    <div style="flex: 1; min-width: 280px; max-width: 400px;">
                        <h3 style="margin-bottom: 16px;">Muscle Group Advancement</h3>
                        <div style="display: grid; gap: 12px;">
                            ${data.muscleAdvancements.map(m => {
                                const colors = levelColors[m.level] || levelColors[0];
                                return `
                                    <div class="muscle-detail-card" data-muscle="${m.muscleGroup}" 
                                         style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; 
                                                border-left: 4px solid ${colors.bg}; background: var(--surface);
                                                cursor: pointer; transition: transform 0.1s, box-shadow 0.1s;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <div style="font-weight: 600; margin-bottom: 4px;">${m.muscleGroup}</div>
                                                <div style="font-size: 12px; color: var(--text-secondary);">
                                                    ${m.level > 0 ? `
                                                        Best: ${m.best1RM?.toFixed(1) || '-'} kg (${m.bestExerciseName || '-'})
                                                        ${m.strengthRatio ? `• ${m.strengthRatio.toFixed(2)}x BW` : ''}
                                                    ` : 'No exercises tracked yet'}
                                                </div>
                                            </div>
                                            <div style="text-align: right;">
                                                <div style="padding: 4px 12px; background: ${colors.bg}; color: white; 
                                                            border-radius: 12px; font-size: 12px; font-weight: 600;">
                                                    ${colors.name}
                                                </div>
                                                ${m.level > 0 ? `
                                                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                                                        ${m.exerciseCount} exercise${m.exerciseCount !== 1 ? 's' : ''}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Level Legend -->
                <div style="margin-top: 32px; padding: 20px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border);">
                    <h4 style="margin-bottom: 16px; text-align: center;">Advancement Levels</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                        ${Object.entries(levelColors).filter(([level]) => level !== '0').map(([level, info]) => `
                            <div style="display: flex; align-items: center; gap: 10px; padding: 10px; 
                                        background: var(--background); border-radius: 8px;">
                                <div style="width: 20px; height: 20px; border-radius: 50%; background: ${info.bg};"></div>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px;">${info.name}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">
                                        ${this.getLevelDescription(parseInt(level))}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; 
                                    background: var(--background); border-radius: 8px;">
                            <div style="width: 20px; height: 20px; border-radius: 50%; background: ${levelColors[0].bg};"></div>
                            <div>
                                <div style="font-weight: 600; font-size: 14px;">No Data</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">
                                    No exercises tracked
                                </div>
                            </div>
                        </div>
                    </div>
                    <p style="text-align: center; font-size: 12px; color: var(--text-secondary); margin-top: 16px;">
                        Levels are calculated based on your estimated 1RM relative to body weight${data.hasBodyMetrics ? '' : ' (estimated)'}.
                    </p>
                </div>
                
                <!-- Strength Standards Table -->
                ${this.strengthStandards ? this.renderStrengthStandardsTable(levelColors) : ''}
            </div>
        `;
        
        // Add hover effects for muscle regions
        this.attachBodyMapListeners();
        
        // Attach filter listeners
        this.attachStrengthStandardsFilterListeners();
    }

    renderStrengthStandardsTable(levelColors) {
        const standards = this.strengthStandards;
        if (!standards) return '';
        
        const muscleGroups = Object.keys(standards.muscleGroups);
        
        return `
            <div style="margin-top: 32px; padding: 20px; background: var(--surface); border-radius: 12px; border: 1px solid var(--border);">
                <h4 style="margin-bottom: 16px; text-align: center;">Strength Standards (1RM / Body Weight Ratios)</h4>
                
                <!-- Filters -->
                <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; justify-content: center;">
                    <div>
                        <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Gender</label>
                        <select id="standards-gender-filter" 
                                style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; 
                                       background: var(--background); color: var(--text-primary); min-width: 120px;">
                            ${standards.genders.map(g => `
                                <option value="${g}" ${g === this.selectedGender ? 'selected' : ''}>${g}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Age Group</label>
                        <select id="standards-age-filter" 
                                style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; 
                                       background: var(--background); color: var(--text-primary); min-width: 120px;">
                            ${standards.ageGroups.map(ag => `
                                <option value="${ag.id}" ${ag.id === this.selectedAgeGroup ? 'selected' : ''}>${ag.label}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                
                ${this.bodyMapData?.hasBodyMetrics ? `
                    <div style="text-align: center; font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                        <em>Filters are pre-set based on your profile settings (${this.bodyMapData.gender || 'Not set'}, ${this.bodyMapData.age ? this.bodyMapData.age + ' years' : 'Age not set'})</em>
                    </div>
                ` : ''}
                
                <!-- Standards Table -->
                <div id="standards-table-container" style="overflow-x: auto;">
                    ${this.renderStandardsTableContent(muscleGroups, levelColors)}
                </div>
                
                <p style="text-align: center; font-size: 12px; color: var(--text-secondary); margin-top: 16px;">
                    ${standards.notes?.ratioExplanation || 'Ratios are calculated as 1RM / Body Weight.'}
                </p>
            </div>
        `;
    }

    renderStandardsTableContent(muscleGroups, levelColors) {
        const standards = this.strengthStandards;
        const gender = this.selectedGender;
        const ageGroup = this.selectedAgeGroup;
        
        return `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: var(--background);">
                        <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid var(--border);">Muscle Group</th>
                        <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid var(--border); font-size: 12px;">Primary Exercise</th>
                        <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid var(--border);">
                            <span style="display: inline-block; padding: 2px 8px; background: ${levelColors[1].bg}; color: white; border-radius: 4px; font-size: 11px;">Beginner</span>
                        </th>
                        <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid var(--border);">
                            <span style="display: inline-block; padding: 2px 8px; background: ${levelColors[2].bg}; color: white; border-radius: 4px; font-size: 11px;">Novice</span>
                        </th>
                        <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid var(--border);">
                            <span style="display: inline-block; padding: 2px 8px; background: ${levelColors[3].bg}; color: white; border-radius: 4px; font-size: 11px;">Intermediate</span>
                        </th>
                        <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid var(--border);">
                            <span style="display: inline-block; padding: 2px 8px; background: ${levelColors[4].bg}; color: white; border-radius: 4px; font-size: 11px;">Advanced</span>
                        </th>
                        <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid var(--border);">
                            <span style="display: inline-block; padding: 2px 8px; background: ${levelColors[5].bg}; color: white; border-radius: 4px; font-size: 11px;">Elite</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${muscleGroups.map(mg => {
                        const muscleData = standards.muscleGroups[mg];
                        const thresholds = muscleData?.standards?.[gender]?.[ageGroup];
                        
                        if (!thresholds) return '';
                        
                        return `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 10px 8px; font-weight: 600;">${mg}</td>
                                <td style="padding: 10px 8px; color: var(--text-secondary); font-size: 12px;">${muscleData.primaryExercise}</td>
                                <td style="padding: 10px 8px; text-align: center;">&lt; ${thresholds.novice.toFixed(2)}x</td>
                                <td style="padding: 10px 8px; text-align: center;">${thresholds.novice.toFixed(2)}x</td>
                                <td style="padding: 10px 8px; text-align: center;">${thresholds.intermediate.toFixed(2)}x</td>
                                <td style="padding: 10px 8px; text-align: center;">${thresholds.advanced.toFixed(2)}x</td>
                                <td style="padding: 10px 8px; text-align: center;">${thresholds.elite.toFixed(2)}x</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    attachStrengthStandardsFilterListeners() {
        const genderFilter = document.getElementById('standards-gender-filter');
        const ageFilter = document.getElementById('standards-age-filter');
        
        if (genderFilter) {
            genderFilter.addEventListener('change', (e) => {
                this.selectedGender = e.target.value;
                this.updateStandardsTable();
            });
        }
        
        if (ageFilter) {
            ageFilter.addEventListener('change', (e) => {
                this.selectedAgeGroup = e.target.value;
                this.updateStandardsTable();
            });
        }
    }

    updateStandardsTable() {
        const container = document.getElementById('standards-table-container');
        if (!container || !this.strengthStandards) return;
        
        const levelColors = {
            0: { bg: '#6b7280', name: 'No Data', color: '#9ca3af' },
            1: { bg: '#ef4444', name: 'Beginner', color: '#fecaca' },
            2: { bg: '#f97316', name: 'Novice', color: '#fed7aa' },
            3: { bg: '#eab308', name: 'Intermediate', color: '#fef08a' },
            4: { bg: '#22c55e', name: 'Advanced', color: '#bbf7d0' },
            5: { bg: '#8b5cf6', name: 'Elite', color: '#ddd6fe' }
        };
        
        const muscleGroups = Object.keys(this.strengthStandards.muscleGroups);
        container.innerHTML = this.renderStandardsTableContent(muscleGroups, levelColors);
    }

    getLevelDescription(level) {
        switch (level) {
            case 1: return 'Just getting started';
            case 2: return 'Building foundation';
            case 3: return 'Consistent progress';
            case 4: return 'Significant gains';
            case 5: return 'Top percentile';
            default: return '';
        }
    }

    attachBodyMapListeners() {
        // Highlight corresponding muscle on SVG when hovering detail card
        document.querySelectorAll('.muscle-detail-card').forEach(card => {
            card.addEventListener('mouseenter', (e) => {
                const muscle = card.dataset.muscle;
                card.style.transform = 'translateX(4px)';
                card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                document.querySelectorAll(`.muscle-region[data-muscle="${muscle}"]`).forEach(region => {
                    region.style.filter = 'brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.5))';
                    region.style.transition = 'filter 0.15s ease';
                });
            });
            card.addEventListener('mouseleave', (e) => {
                const muscle = card.dataset.muscle;
                card.style.transform = '';
                card.style.boxShadow = '';
                document.querySelectorAll(`.muscle-region[data-muscle="${muscle}"]`).forEach(region => {
                    region.style.filter = '';
                });
            });
        });
        
        // Highlight corresponding card when hovering SVG region
        document.querySelectorAll('.muscle-region').forEach(region => {
            region.style.cursor = 'pointer';
            region.style.transition = 'filter 0.15s ease';
            region.addEventListener('mouseenter', (e) => {
                const muscle = region.dataset.muscle;
                // Highlight all regions of same muscle group
                document.querySelectorAll(`.muscle-region[data-muscle="${muscle}"]`).forEach(r => {
                    r.style.filter = 'brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.5))';
                });
                const card = document.querySelector(`.muscle-detail-card[data-muscle="${muscle}"]`);
                if (card) {
                    card.style.transform = 'translateX(4px)';
                    card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                }
            });
            region.addEventListener('mouseleave', (e) => {
                const muscle = region.dataset.muscle;
                document.querySelectorAll(`.muscle-region[data-muscle="${muscle}"]`).forEach(r => {
                    r.style.filter = '';
                });
                const card = document.querySelector(`.muscle-detail-card[data-muscle="${muscle}"]`);
                if (card) {
                    card.style.transform = '';
                    card.style.boxShadow = '';
                }
            });
        });
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
