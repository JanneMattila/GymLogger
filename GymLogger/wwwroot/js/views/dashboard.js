import { api } from '../utils/api-client.js?v=20251116171145';
import { formatDate, getDayName } from '../utils/date-formatter.js?v=20251116171145';
import { eventBus } from '../utils/event-bus.js?v=20251116171145';

export class DashboardView {
    constructor() {
        this.container = document.getElementById('main');
    }

    async render() {
        this.container.innerHTML = '<div class="card"><p>Loading dashboard...</p></div>';

        try {
            console.log(`[Dashboard] Fetching active session...`);
            // Get active session (cache is updated when workout is completed/canceled)
            const activeSessionRes = await api.getActiveSession();
            let activeSession = activeSessionRes.data;
            console.log(`[Dashboard] Active session result:`, {
                source: activeSessionRes.source,
                hasData: !!activeSession,
                status: activeSession?.status,
                id: activeSession?.id
            });
            
            const programsRes = await api.getPrograms();
            const programs = programsRes.data;
            
            const today = new Date().getDay();
            const todayDate = new Date().toISOString().split('T')[0];
            
            // Fetch today's completed sessions
            const todaySessionsRes = await api.getSessions(todayDate, todayDate);
            const todaySessions = todaySessionsRes.data;
            const completedProgramIds = todaySessions
                .filter(s => s.status === 'completed')
                .map(s => s.programId);
            
            // Calculate this week's workout count
            let thisWeekCount = 0;
            const prefsRes = await api.getPreferences();
            if (prefsRes.success && prefsRes.data) {
                const weekStartDay = prefsRes.data.weekStartDay || 0; // 0 = Sunday
                const now = new Date();
                const currentDay = now.getDay();
                
                // Calculate days since week start
                let daysSinceWeekStart = currentDay - weekStartDay;
                if (daysSinceWeekStart < 0) daysSinceWeekStart += 7;
                
                // Get start of week date
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - daysSinceWeekStart);
                const weekStartDate = weekStart.toISOString().split('T')[0];
                
                const weekSessionsRes = await api.getSessions(weekStartDate, todayDate);
                thisWeekCount = weekSessionsRes.data.filter(s => s.status === 'completed').length;
            }
            
            // Get all today's programs
            const allTodayPrograms = programs.filter(p => p.dayOfWeek === today);
            
            // Filter programs: today's programs that haven't been completed today
            const todayPrograms = allTodayPrograms.filter(p => !completedProgramIds.includes(p.id));
            
            // Get completed today's programs
            const completedTodayPrograms = allTodayPrograms.filter(p => completedProgramIds.includes(p.id));

            let content = '<div class="card">';
            content += '<div class="card-header">Welcome to Gym Logger</div>';

            // Active session notice
            if (activeSession) {
                // Don't show completed sessions as "active"
                if (activeSession.status === 'completed') {
                    console.log(`[Dashboard] Filtering out completed session: ${activeSession.id}`);
                    activeSession = null;
                }
            }
            
            console.log(`[Dashboard] Final activeSession:`, activeSession ? `ID: ${activeSession.id}, Status: ${activeSession.status}` : 'null');
            
            if (activeSession) {
                const sessionDate = formatDate(activeSession.sessionDate);
                content += `
                    <div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 8px; color: #2e7d32;">Active Workout</h3>
                        <p style="margin-bottom: 12px;">You have an active workout from ${sessionDate}</p>
                        <button class="btn btn-success" id="resume-workout-btn">Resume Workout</button>
                        ${activeSession.sessionDate !== new Date().toISOString().split('T')[0] ? `
                            <button class="btn btn-secondary" id="start-new-workout-btn" style="margin-left: 8px;">Start New Workout</button>
                        ` : ''}
                    </div>
                `;
            }

            // Today's programs
            if (todayPrograms.length > 0) {
                content += '<h3 style="margin: 20px 0 12px;">Today\'s Programs (' + getDayName(today) + ')</h3>';
                content += '<div style="display: grid; gap: 12px;">';
                todayPrograms.forEach(program => {
                    content += `
                        <div style="border: 1px solid var(--border); padding: 16px; border-radius: 8px; cursor: pointer;" class="program-card" data-program-id="${program.id}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="margin-bottom: 4px;">${program.name}</h4>
                                    <p style="font-size: 14px; color: var(--text-secondary);">${program.exercises.length} exercises</p>
                                </div>
                                ${program.isDefault ? '<span style="background: var(--primary-color); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Default</span>' : ''}
                            </div>
                        </div>
                    `;
                });
                content += '</div>';
            } else if (allTodayPrograms.length > 0) {
                // Programs exist for today but all are completed
                content += `
                    <div style="text-align: center; padding: 40px 20px; background: #e8f5e9; border-radius: 8px; margin-bottom: 20px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
                        <h3 style="color: #2e7d32; margin-bottom: 8px;">Well done!</h3>
                        <p style="color: var(--text-secondary);">You've completed all programs scheduled for today</p>
                    </div>
                `;
            } else {
                content += `
                    <div style="text-align: center; padding: 40px 20px;">
                        <p style="color: var(--text-secondary); margin-bottom: 16px;">No programs scheduled for today</p>
                        <button class="btn btn-primary" id="create-program-btn">Create a Program</button>
                    </div>
                `;
            }
            
            // Show completed programs for today if any
            if (completedTodayPrograms.length > 0) {
                content += '<h3 style="margin: 20px 0 12px; color: var(--text-secondary);">Completed Today</h3>';
                content += '<div style="display: grid; gap: 12px;">';
                completedTodayPrograms.forEach(program => {
                    content += `
                        <div style="border: 1px solid var(--success-color); background: rgba(76, 175, 80, 0.05); padding: 16px; border-radius: 8px; opacity: 0.7;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                                        <span>✓</span>
                                        <span>${program.name}</span>
                                    </h4>
                                    <p style="font-size: 14px; color: var(--text-secondary);">${program.exercises.length} exercises completed</p>
                                </div>
                            </div>
                        </div>
                    `;
                });
                content += '</div>';
            }

            // Quick stats
            content += `
                <div style="margin-top: 30px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                    <div id="programs-stat-box" style="background: var(--surface); padding: 16px; border-radius: 8px; text-align: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--primary-hover)'" onmouseout="this.style.background='var(--surface)'">
                        <div style="font-size: 24px; font-weight: 600; color: var(--primary-color);">${programs.length}</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Programs</div>
                    </div>
                    <div id="this-week-stat-box" style="background: var(--surface); padding: 16px; border-radius: 8px; text-align: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--primary-hover)'" onmouseout="this.style.background='var(--surface)'">
                        <div style="font-size: 24px; font-weight: 600; color: var(--success-color);">${thisWeekCount}</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">This Week</div>
                    </div>
                </div>
            `;

            content += '</div>';
            this.container.innerHTML = content;

            this.attachListeners(activeSession);
        } catch (error) {
            this.container.innerHTML = `
                <div class="card">
                    <p style="color: var(--danger-color);">Error loading dashboard: ${error.message}</p>
                </div>
            `;
        }
    }

    attachListeners(activeSession) {
        document.getElementById('resume-workout-btn')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'workout-logger');
        });

        document.getElementById('start-new-workout-btn')?.addEventListener('click', async () => {
            if (activeSession && confirm('This will close your previous workout. Continue?')) {
                await api.cleanupSession(activeSession.id);
                eventBus.emit('navigate', 'workout-logger');
            }
        });

        document.getElementById('create-program-btn')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'programs');
        });

        document.querySelectorAll('.program-card').forEach(card => {
            card.addEventListener('click', () => {
                const programId = card.dataset.programId;
                eventBus.emit('start-workout-with-program', programId);
            });
        });

        document.getElementById('programs-stat-box')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'programs');
        });

        document.getElementById('this-week-stat-box')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'history');
        });
    }
}
