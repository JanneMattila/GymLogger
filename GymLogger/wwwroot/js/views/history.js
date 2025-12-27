import { api } from '../utils/api-client.js?v=00000000000000';
import { formatDate } from '../utils/date-formatter.js?v=00000000000000';
import { eventBus } from '../utils/event-bus.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';

export class HistoryView {
    constructor() {
        this.container = document.getElementById('main');
        this.sessions = [];
        this.programs = [];
        this.exercises = [];
        this.preferences = null;
        this.currentMonth = new Date();
        this.currentWeek = new Date(); // Track current week for week view
        this.selectedSession = null;
        this.viewMode = 'week'; // 'week', 'month' or 'year'
        this.totalSets = 0; // Track total sets for the current period
    }

    // Get the week number for a given date
    getWeekNumber(date, weekStartDay = 0) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        
        if (weekStartDay === 1) {
            // ISO week numbering (Monday start) - week 1 is the first week with 4+ days in new year
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return { week: weekNo, year: d.getUTCFullYear() };
        } else {
            // US week numbering (Sunday start) - week 1 starts on Jan 1
            const jan1 = new Date(d.getFullYear(), 0, 1);
            const dayOfYear = Math.floor((d - jan1) / 86400000) + 1;
            const jan1Day = jan1.getDay();
            const weekNo = Math.ceil((dayOfYear + jan1Day) / 7);
            return { week: weekNo, year: d.getFullYear() };
        }
    }

    // Get the start date of a week
    getWeekStartDate(date, weekStartDay = 0) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day - weekStartDay + 7) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    // Get the end date of a week
    getWeekEndDate(date, weekStartDay = 0) {
        const start = this.getWeekStartDate(date, weekStartDay);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return end;
    }

    // Format date as YYYY-MM-DD
    formatDateStr(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async render() {
        this.container.innerHTML = '<div class="card"><p>Loading history...</p></div>';

        try {
            // Check if offline
            if (!navigator.onLine) {
                this.container.innerHTML = `
                    <div class="card">
                        <div class="card-header">📅 Workout History</div>
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                            <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                Workout history is not available offline. Please connect to the internet to view your training history.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Load all data
            const [programsResp, exercisesResp, preferencesResp] = await Promise.all([
                api.getPrograms(),
                api.getExercises(),
                api.getPreferences()
            ]);

            // Check if any data failed to load
            if (!programsResp.success || !exercisesResp.success || !preferencesResp.success) {
                console.error('Failed to load data for history');
                this.container.innerHTML = `
                    <div class="card">
                        <div class="card-header">📅 Workout History</div>
                        <div style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                            <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                            <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                Workout history is not available offline. Please connect to the internet to view your training history.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }

            this.programs = programsResp.data;
            this.exercises = exercisesResp.data;
            this.preferences = preferencesResp.data;
            
            if (this.viewMode === 'year') {
                // Load sessions for entire year
                const year = this.currentMonth.getFullYear();
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                
                console.log('Fetching sessions for year:', year);
                const sessionsResp = await api.getSessions(startDate, endDate);
                
                if (!sessionsResp.success) {
                    this.container.innerHTML = `
                        <div class="card">
                            <div class="card-header">📅 Workout History</div>
                            <div style="text-align: center; padding: 60px 20px;">
                                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                                <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                                <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                    Workout history is not available offline. Please connect to the internet to view your training history.
                                </p>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                this.sessions = sessionsResp.data;
                this.renderYearView();
            } else if (this.viewMode === 'week') {
                // Get sessions for current week
                const weekStartDay = this.preferences?.weekStartDay || 0;
                const weekStart = this.getWeekStartDate(this.currentWeek, weekStartDay);
                const weekEnd = this.getWeekEndDate(this.currentWeek, weekStartDay);
                const startDate = this.formatDateStr(weekStart);
                const endDate = this.formatDateStr(weekEnd);
                
                console.log('Fetching sessions for week:', startDate, 'to', endDate);
                const sessionsResp = await api.getSessions(startDate, endDate);
                
                if (!sessionsResp.success) {
                    this.container.innerHTML = `
                        <div class="card">
                            <div class="card-header">📅 Workout History</div>
                            <div style="text-align: center; padding: 60px 20px;">
                                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                                <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                                <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                    Workout history is not available offline. Please connect to the internet to view your training history.
                                </p>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                this.sessions = sessionsResp.data;
                await this.renderWeekView();
            } else {
                // Get sessions for current month
                const year = this.currentMonth.getFullYear();
                const month = this.currentMonth.getMonth();
                // Format dates as YYYY-MM-DD without timezone conversion
                const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month + 1, 0).getDate();
                const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                
                const sessionsResp = await api.getSessions(startDate, endDate);
                
                // Check if sessions failed to load
                if (!sessionsResp.success) {
                    console.warn('Sessions failed to load, showing offline message');
                    this.container.innerHTML = `
                        <div class="card">
                            <div class="card-header">📅 Workout History</div>
                            <div style="text-align: center; padding: 60px 20px;">
                                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📡</div>
                                <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Offline Mode</h3>
                                <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                                    Workout history is not available offline. Please connect to the internet to view your training history.
                                </p>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                this.sessions = sessionsResp.data;
                console.log('History - Sessions loaded:', this.sessions.length, 'sessions');
                console.log('History - Date range:', startDate, 'to', endDate);
                console.log('History - Today:', new Date().toISOString().split('T')[0]);
                
                this.renderCalendar();
            }
        } catch (error) {
            console.error('History - Error:', error);
            this.container.innerHTML = `
                <div class="card">
                    <p style="color: var(--danger-color);">Error loading history: ${error.message}</p>
                </div>
            `;
        }
    }

    renderCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const monthName = this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Get first day of month and number of days
        let firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Adjust first day based on week start preference (default is Sunday = 0)
        const weekStartDay = this.preferences?.weekStartDay || 0;
        firstDay = (firstDay - weekStartDay + 7) % 7;
        
        // Create day names array starting from the configured week start day
        const allDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = [];
        for (let i = 0; i < 7; i++) {
            dayNames.push(allDayNames[(weekStartDay + i) % 7]);
        }
        
        // Group sessions by date
        const sessionsByDate = {};
        this.sessions.forEach(session => {
            const date = session.sessionDate;
            if (!sessionsByDate[date]) {
                sessionsByDate[date] = [];
            }
            sessionsByDate[date].push(session);
        });
        
        // Count workout days
        const workoutDays = Object.keys(sessionsByDate).filter(date => sessionsByDate[date].length > 0).length;
        
        // Count total sets for the month
        this.totalSets = 0;

        let content = `
            <div class="card">
                <div class="card-header">Workout History</div>
                
                <!-- Stats Summary -->
                <div style="display: flex; gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: var(--primary-color);">${workoutDays}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Workout Days</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: var(--success-color);" id="month-total-sets">...</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Sets</div>
                    </div>
                </div>
                
                <!-- Month Navigation -->
                <div class="calendar-nav" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 8px;">
                    <button class="btn btn-secondary calendar-nav-btn" id="prev-month-btn">← Prev</button>
                    <h2 id="month-header" style="margin: 0; font-size: 18px; cursor: pointer; user-select: none; text-align: center; flex: 1;" title="Click to view year">${monthName}</h2>
                    <button class="btn btn-secondary calendar-nav-btn" id="next-month-btn">Next →</button>
                </div>

                <!-- Calendar Grid -->
                <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 24px;">
                    ${dayNames.map(day => 
                        `<div class="calendar-day-header" style="text-align: center; font-weight: 600; padding: 4px 2px; color: var(--text-secondary); font-size: 12px;">${day}</div>`
                    ).join('')}
                    
                    ${Array(firstDay).fill(null).map(() => '<div></div>').join('')}
                    
                    ${Array(daysInMonth).fill(null).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const daySessions = sessionsByDate[dateStr] || [];
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        const hasWorkouts = daySessions.length > 0;
                        
                        return `
                            <div class="calendar-day ${hasWorkouts ? 'has-workouts' : ''}" 
                                 data-date="${dateStr}"
                                 style="
                                     aspect-ratio: 1;
                                     border: 2px solid ${isToday ? 'var(--primary-color)' : hasWorkouts ? 'var(--success-color)' : 'var(--border)'};
                                     border-radius: 6px;
                                     padding: 4px;
                                     cursor: pointer;
                                     background: var(--surface);
                                     position: relative;
                                     transition: all 0.2s;
                                     min-width: 0;
                                 ">
                                <div class="calendar-day-number" style="font-weight: ${hasWorkouts ? '700' : '600'}; font-size: 12px; color: ${hasWorkouts ? 'var(--success-color)' : 'inherit'};">${day}</div>
                                ${hasWorkouts ? `
                                    <div class="calendar-workout-badge" style="position: absolute; bottom: 2px; right: 2px; background: var(--success-color); color: white; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold;">
                                        ${daySessions.length}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Session Details -->
                <div id="session-details"></div>
            </div>
        `;

        this.container.innerHTML = content;
        this.attachCalendarListeners();
        
        // Load total sets asynchronously
        this.loadTotalSetsForPeriod('month');
        
        // Show today's workouts by default if any exist (use setTimeout to ensure DOM is ready)
        setTimeout(async () => {
            const today = new Date().toISOString().split('T')[0];
            const todaySessions = this.sessions.filter(s => s.sessionDate === today);
            if (todaySessions.length > 0) {
                await this.showSessionsForDate(today);
            }
        }, 0);
        
        // Add hover styles
        const style = document.createElement('style');
        style.textContent = `
            .calendar-day:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            /* Mobile responsive styles for calendar */
            @media (max-width: 480px) {
                .calendar-grid {
                    gap: 2px !important;
                }
                .calendar-day {
                    border-radius: 4px !important;
                    padding: 2px !important;
                    border-width: 1px !important;
                }
                .calendar-day-header {
                    font-size: 10px !important;
                    padding: 2px 1px !important;
                }
                .calendar-day-number {
                    font-size: 11px !important;
                }
                .calendar-workout-badge {
                    width: 14px !important;
                    height: 14px !important;
                    font-size: 8px !important;
                    bottom: 1px !important;
                    right: 1px !important;
                }
                .calendar-nav-btn {
                    padding: 6px 10px !important;
                    font-size: 12px !important;
                }
                #month-header {
                    font-size: 16px !important;
                }
            }
            
            @media (max-width: 360px) {
                .calendar-grid {
                    gap: 1px !important;
                }
                .calendar-day-header {
                    font-size: 9px !important;
                }
                .calendar-day-number {
                    font-size: 10px !important;
                }
                .calendar-workout-badge {
                    width: 12px !important;
                    height: 12px !important;
                    font-size: 7px !important;
                }
                .calendar-nav-btn {
                    padding: 4px 8px !important;
                    font-size: 11px !important;
                }
            }
        `;
        if (!document.getElementById('calendar-styles')) {
            style.id = 'calendar-styles';
            document.head.appendChild(style);
        }
    }

    attachCalendarListeners() {
        // Month header click - switch to year view
        document.getElementById('month-header')?.addEventListener('click', () => {
            this.viewMode = 'year';
            this.render();
        });

        // Month navigation
        document.getElementById('prev-month-btn')?.addEventListener('click', () => {
            this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
            this.render();
        });

        document.getElementById('next-month-btn')?.addEventListener('click', () => {
            this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
            this.render();
        });

        // Day clicks
        document.querySelectorAll('.calendar-day').forEach(dayEl => {
            dayEl.addEventListener('click', async () => {
                const date = dayEl.dataset.date;
                const hasWorkouts = dayEl.classList.contains('has-workouts');
                
                if (!hasWorkouts) {
                    // Navigate to week view for empty days
                    this.currentWeek = new Date(date + 'T00:00:00');
                    this.viewMode = 'week';
                    this.render();
                } else {
                    await this.showSessionsForDate(date);
                }
            });
        });
    }

    async loadTotalSetsForPeriod(period) {
        let totalSets = 0;
        for (const session of this.sessions) {
            try {
                const setsResp = await api.getSetsForSession(session.id);
                if (setsResp.success) {
                    totalSets += setsResp.data.length;
                }
            } catch (error) {
                console.error('Error loading sets for session:', session.id, error);
            }
        }
        this.totalSets = totalSets;
        
        // Update the UI
        const setsEl = document.getElementById(`${period}-total-sets`);
        if (setsEl) {
            setsEl.textContent = totalSets;
        }
    }

    async renderWeekView() {
        const weekStartDay = this.preferences?.weekStartDay || 0;
        const weekStart = this.getWeekStartDate(this.currentWeek, weekStartDay);
        const weekEnd = this.getWeekEndDate(this.currentWeek, weekStartDay);
        const weekInfo = this.getWeekNumber(this.currentWeek, weekStartDay);
        
        // Create day names array starting from the configured week start day
        const allDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = [];
        for (let i = 0; i < 7; i++) {
            dayNames.push(allDayNames[(weekStartDay + i) % 7]);
        }
        
        // Group sessions by date
        const sessionsByDate = {};
        this.sessions.forEach(session => {
            const date = session.sessionDate;
            if (!sessionsByDate[date]) {
                sessionsByDate[date] = [];
            }
            sessionsByDate[date].push(session);
        });
        
        // Count workout days
        const workoutDays = Object.keys(sessionsByDate).filter(date => sessionsByDate[date].length > 0).length;

        let content = `
            <div class="card">
                <div class="card-header">Workout History</div>
                
                <!-- Stats Summary -->
                <div style="display: flex; gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: var(--primary-color);">${workoutDays}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Workout Days</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: var(--success-color);" id="week-total-sets">...</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Sets</div>
                    </div>
                </div>
                
                <!-- Week Navigation -->
                <div class="calendar-nav" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 8px;">
                    <button class="btn btn-secondary calendar-nav-btn" id="prev-week-btn">← Prev</button>
                    <h2 id="week-header" style="margin: 0; font-size: 18px; cursor: pointer; user-select: none; text-align: center; flex: 1;" title="Click to view month">Week ${weekInfo.week}</h2>
                    <button class="btn btn-secondary calendar-nav-btn" id="next-week-btn">Next →</button>
                </div>
                
                <!-- Week Date Range -->
                <div style="text-align: center; margin-bottom: 16px; color: var(--text-secondary); font-size: 14px;">
                    ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                <!-- Week Grid -->
                <div class="week-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 24px;">
                    ${dayNames.map((dayName, i) => {
                        const dayDate = new Date(weekStart);
                        dayDate.setDate(weekStart.getDate() + i);
                        const dateStr = this.formatDateStr(dayDate);
                        const daySessions = sessionsByDate[dateStr] || [];
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        const hasWorkouts = daySessions.length > 0;
                        
                        return `
                            <div class="week-day ${hasWorkouts ? 'has-workouts' : ''}" 
                                 data-date="${dateStr}"
                                 style="
                                     border: 2px solid ${isToday ? 'var(--primary-color)' : hasWorkouts ? 'var(--success-color)' : 'var(--border)'};
                                     border-radius: 8px;
                                     padding: 12px 8px;
                                     cursor: pointer;
                                     background: var(--surface);
                                     text-align: center;
                                     transition: all 0.2s;
                                     min-height: 80px;
                                     display: flex;
                                     flex-direction: column;
                                     align-items: center;
                                 ">
                                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 500;">${dayName}</div>
                                <div style="font-weight: ${hasWorkouts ? '700' : '600'}; font-size: 18px; color: ${hasWorkouts ? 'var(--success-color)' : 'inherit'}; margin-bottom: 4px;">${dayDate.getDate()}</div>
                                ${hasWorkouts ? `
                                    <div style="background: var(--success-color); color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; margin-top: auto;">
                                        ${daySessions.length} workout${daySessions.length > 1 ? 's' : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Session Details -->
                <div id="session-details"></div>
            </div>
        `;

        this.container.innerHTML = content;
        this.attachWeekViewListeners();
        
        // Load total sets asynchronously
        this.loadTotalSetsForPeriod('week');
        
        // Show today's workouts by default if any exist (use setTimeout to ensure DOM is ready)
        setTimeout(async () => {
            const today = new Date().toISOString().split('T')[0];
            const todaySessions = this.sessions.filter(s => s.sessionDate === today);
            if (todaySessions.length > 0) {
                await this.showSessionsForDate(today);
            }
        }, 0);
        
        // Add hover styles
        const style = document.createElement('style');
        style.textContent = `
            .week-day:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            /* Mobile responsive styles for week view */
            @media (max-width: 480px) {
                .week-grid {
                    gap: 4px !important;
                }
                .week-day {
                    padding: 8px 4px !important;
                    min-height: 70px !important;
                    border-radius: 6px !important;
                }
                .week-day > div:first-child {
                    font-size: 10px !important;
                }
                .week-day > div:nth-child(2) {
                    font-size: 16px !important;
                }
            }
            
            @media (max-width: 360px) {
                .week-grid {
                    gap: 2px !important;
                }
                .week-day {
                    padding: 6px 2px !important;
                    min-height: 60px !important;
                }
            }
        `;
        if (!document.getElementById('week-view-styles')) {
            style.id = 'week-view-styles';
            document.head.appendChild(style);
        }
    }

    attachWeekViewListeners() {
        // Week header click - switch to month view
        document.getElementById('week-header')?.addEventListener('click', () => {
            // Set currentMonth to the month containing the current week
            this.currentMonth = new Date(this.currentWeek.getFullYear(), this.currentWeek.getMonth(), 1);
            this.viewMode = 'month';
            this.render();
        });

        // Week navigation
        document.getElementById('prev-week-btn')?.addEventListener('click', () => {
            const newDate = new Date(this.currentWeek);
            newDate.setDate(newDate.getDate() - 7);
            this.currentWeek = newDate;
            this.render();
        });

        document.getElementById('next-week-btn')?.addEventListener('click', () => {
            const newDate = new Date(this.currentWeek);
            newDate.setDate(newDate.getDate() + 7);
            this.currentWeek = newDate;
            this.render();
        });

        // Day clicks
        document.querySelectorAll('.week-day').forEach(dayEl => {
            dayEl.addEventListener('click', async () => {
                const date = dayEl.dataset.date;
                await this.showSessionsForDate(date);
            });
        });
    }

    async showSessionsForDate(date) {
        console.log('showSessionsForDate called for:', date);
        const daySessions = this.sessions.filter(s => s.sessionDate === date);
        console.log('Found sessions:', daySessions.length, daySessions);
        
        if (daySessions.length === 0) {
            document.getElementById('session-details').innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    No workouts on ${formatDate(date)}
                </div>
            `;
            return;
        }

        let content = `
            <div style="border-top: 1px solid var(--border); padding-top: 20px; margin-top: 20px;">
                <h3 style="margin-bottom: 16px;">${formatDate(date)}</h3>
                <div style="display: grid; gap: 12px;">
        `;

        for (const session of daySessions) {
            const program = this.programs.find(p => p.id === session.programId);
            // Use current program name if exists, otherwise use stored name from when workout was done
            const programName = program?.name || session.programName || 'Unknown Program';
            const setsResp = await api.getSetsForSession(session.id);
            const sets = setsResp.success ? setsResp.data : [];
            const totalSets = sets.length;
            const totalReps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);

            content += `
                <div class="card session-card" data-session-id="${session.id}" style="margin-bottom: 0; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                        <div style="flex: 1;" class="session-card-content">
                            <h4 style="margin-bottom: 4px;">${programName}</h4>
                            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
                                ${session.status === 'completed' ? '✓ Completed' : 'In Progress'}
                            </p>
                            <div style="display: flex; gap: 16px; font-size: 14px;">
                                <span><strong>${totalSets}</strong> sets</span>
                                <span><strong>${totalReps}</strong> reps</span>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">
                                ${new Date(session.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button class="btn btn-danger btn-sm delete-session-btn" data-session-id="${session.id}" style="padding: 4px 8px; font-size: 12px;" title="Delete workout">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        content += '</div></div>';
        document.getElementById('session-details').innerHTML = content;

        // Add click listeners for session cards (click on content only, not delete button)
        document.querySelectorAll('.session-card-content').forEach(content => {
            content.addEventListener('click', async () => {
                const sessionId = content.closest('.session-card').dataset.sessionId;
                await this.showSessionDetails(sessionId);
            });
        });

        // Add click listeners for delete buttons
        document.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent opening session details
                const sessionId = btn.dataset.sessionId;
                await this.confirmAndDeleteSession(sessionId, date);
            });
        });
    }

    async confirmAndDeleteSession(sessionId, date) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        const program = this.programs.find(p => p.id === session.programId);
        const programName = program?.name || session.programName || 'Unknown Program';

        // Create confirmation dialog
        const confirmed = await this.showConfirmDialog(
            'Delete Workout?',
            `Are you sure you want to delete "${programName}" from ${formatDate(date)}? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            const response = await api.deleteSession(sessionId);
            
            if (response.success) {
                // Remove from local sessions array
                this.sessions = this.sessions.filter(s => s.id !== sessionId);
                
                // Refresh the view
                await this.showSessionsForDate(date);
                
                // If no sessions left for this date, re-render calendar
                const remainingSessions = this.sessions.filter(s => s.sessionDate === date);
                if (remainingSessions.length === 0) {
                    this.render();
                }
                
                eventBus.emit('notification', {
                    message: 'Workout deleted successfully',
                    type: 'success'
                });
            } else {
                throw new Error('Failed to delete workout');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            eventBus.emit('notification', {
                message: 'Failed to delete workout. Please try again.',
                type: 'error'
            });
        }
    }

    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.id = 'confirm-dialog';
            dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px;';
            
            dialog.innerHTML = `
                <div style="background: var(--background); border-radius: 12px; max-width: 400px; width: 100%; padding: 24px; border: 1px solid var(--border);">
                    <h3 style="margin: 0 0 16px 0; color: var(--danger-color);">${title}</h3>
                    <p style="margin: 0 0 24px 0; color: var(--text);">${message}</p>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
                        <button class="btn btn-danger" id="confirm-delete">Delete</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            document.getElementById('confirm-cancel').addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });
            
            document.getElementById('confirm-delete').addEventListener('click', () => {
                dialog.remove();
                resolve(true);
            });
            
            // Close on backdrop click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(false);
                }
            });
        });
    }

    async showSessionDetails(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        const program = this.programs.find(p => p.id === session.programId);
        // Use current program name if exists, otherwise use stored name from when workout was done
        const programName = program?.name || session.programName || 'Unknown Program';
        const setsResp = await api.getSetsForSession(sessionId);
        const sets = setsResp.success ? setsResp.data : [];
        const weightUnit = this.preferences?.defaultWeightUnit || 'KG';
        
        // Check if integration is enabled
        const integrationEnabled = this.preferences?.outboundIntegrationEnabled;
        const integrationUrl = this.preferences?.outboundIntegrationUrl;
        const canSubmitIntegration = integrationEnabled && integrationUrl && session.status === 'completed';

        // Group sets by exercise
        const setsByExercise = {};
        sets.forEach(set => {
            if (!setsByExercise[set.exerciseId]) {
                setsByExercise[set.exerciseId] = [];
            }
            setsByExercise[set.exerciseId].push(set);
        });

        let content = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;" id="session-modal">
                <div style="background: white; border-radius: 12px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">${programName}</h2>
                        <button class="btn btn-secondary" id="close-modal-btn">✕</button>
                    </div>
                    
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        ${formatDate(session.sessionDate)} at ${new Date(session.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>

                    <div style="display: grid; gap: 16px;" id="session-exercises">
        `;

        Object.keys(setsByExercise).forEach(exerciseId => {
            const exercise = this.exercises.find(e => e.id === exerciseId);
            const exerciseSets = setsByExercise[exerciseId];

            content += `
                <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                    <h4 style="margin-bottom: 12px;">${exercise?.name || 'Unknown Exercise'}</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <th style="padding: 8px; text-align: left; font-size: 12px; color: var(--text-secondary);">Set</th>
                                <th style="padding: 8px; text-align: left; font-size: 12px; color: var(--text-secondary);">Weight (${weightUnit})</th>
                                <th style="padding: 8px; text-align: left; font-size: 12px; color: var(--text-secondary);">Reps</th>
                                <th style="padding: 8px; text-align: center; font-size: 12px; color: var(--text-secondary);">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${exerciseSets.map((set, idx) => `
                                <tr data-set-id="${set.id}">
                                    <td style="padding: 8px;">${set.isWarmup ? `<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px;">W</span>` : ''}${idx + 1}</td>
                                    <td style="padding: 8px;">
                                        <input type="number" class="form-input edit-weight" data-set-id="${set.id}" 
                                               value="${set.weight}" min="0.1" step="any" 
                                               style="width: 80px; padding: 4px 8px; font-size: 14px;">
                                    </td>
                                    <td style="padding: 8px;">
                                        <input type="number" class="form-input edit-reps" data-set-id="${set.id}" 
                                               value="${set.reps}" min="1" step="1" 
                                               style="width: 60px; padding: 4px 8px; font-size: 14px;">
                                    </td>
                                    <td style="padding: 8px; text-align: center;">
                                        <button class="btn btn-danger btn-sm delete-set-btn" data-set-id="${set.id}" 
                                                style="padding: 4px 8px; font-size: 11px;" title="Delete set">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        content += `
                    </div>
                    
                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); flex-wrap: wrap;">
                        ${canSubmitIntegration ? `
                            <button class="btn btn-primary" id="submit-integration-btn" style="flex: 1; min-width: 150px;">
                                📤 Submit to Integration
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" id="close-modal-bottom-btn" style="flex: 1; min-width: 100px;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', content);
        
        // Store session ID for use in handlers
        this.currentEditingSessionId = sessionId;

        // Close button handlers
        document.getElementById('close-modal-btn')?.addEventListener('click', () => {
            document.getElementById('session-modal')?.remove();
        });
        
        document.getElementById('close-modal-bottom-btn')?.addEventListener('click', () => {
            document.getElementById('session-modal')?.remove();
        });

        document.getElementById('session-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'session-modal') {
                document.getElementById('session-modal')?.remove();
            }
        });
        
        // Edit weight/reps handlers
        document.querySelectorAll('.edit-weight, .edit-reps').forEach(input => {
            input.addEventListener('blur', async (e) => {
                await this.updateSetFromHistory(e.target.dataset.setId, sessionId);
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });
        
        // Delete set handlers
        document.querySelectorAll('.delete-set-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const setId = btn.dataset.setId;
                if (confirm('Delete this set?')) {
                    await this.deleteSetFromHistory(setId, sessionId);
                }
            });
        });
        
        // Submit to integration handler
        document.getElementById('submit-integration-btn')?.addEventListener('click', async () => {
            await this.submitSessionToIntegration(sessionId);
        });
    }
    
    async updateSetFromHistory(setId, sessionId) {
        const weightInput = document.querySelector(`.edit-weight[data-set-id="${setId}"]`);
        const repsInput = document.querySelector(`.edit-reps[data-set-id="${setId}"]`);
        
        if (!weightInput || !repsInput) return;
        
        const weight = parseFloat(weightInput.value);
        const reps = parseInt(repsInput.value);
        
        // Validate
        if (!weight || weight <= 0) {
            notification.warning('Weight must be greater than 0');
            return;
        }
        
        if (!reps || reps < 1) {
            notification.warning('Reps must be at least 1');
            return;
        }
        
        try {
            const response = await api.updateSet(sessionId, setId, { weight, reps });
            
            if (response.success) {
                notification.success('Set updated');
            } else {
                notification.error('Failed to update set: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating set:', error);
            notification.error('Failed to update set: ' + error.message);
        }
    }
    
    async deleteSetFromHistory(setId, sessionId) {
        try {
            const response = await api.deleteSet(sessionId, setId);
            
            if (response.success) {
                // Remove the row from the table
                const row = document.querySelector(`tr[data-set-id="${setId}"]`);
                row?.remove();
                
                notification.success('Set deleted');
            } else {
                notification.error('Failed to delete set: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting set:', error);
            notification.error('Failed to delete set: ' + error.message);
        }
    }
    
    async submitSessionToIntegration(sessionId) {
        const btn = document.getElementById('submit-integration-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '📤 Submitting...';
        }
        
        try {
            notification.info('Submitting workout data to integration...');
            const response = await api.submitWorkoutIntegration(sessionId);
            
            if (response.success) {
                notification.success('Workout data submitted to integration!');
                
                // Close the modal after successful submission
                setTimeout(() => {
                    document.getElementById('session-modal')?.remove();
                }, 1000);
            } else {
                notification.error('Failed to submit: ' + (response.error || 'Unknown error'));
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = '📤 Submit to Integration';
                }
            }
        } catch (error) {
            console.error('Error submitting to integration:', error);
            notification.error('Failed to submit: ' + error.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = '📤 Submit to Integration';
            }
        }
    }

    renderYearView() {
        const year = this.currentMonth.getFullYear();
        
        // Group sessions by month
        const sessionsByMonth = {};
        for (let m = 0; m < 12; m++) {
            sessionsByMonth[m] = [];
        }
        
        this.sessions.forEach(session => {
            const sessionDate = new Date(session.sessionDate + 'T00:00:00');
            const month = sessionDate.getMonth();
            sessionsByMonth[month].push(session);
        });
        
        // Calculate stats for year
        const totalWorkouts = this.sessions.filter(s => s.status === 'completed').length;
        const workoutDays = new Set(this.sessions.map(s => s.sessionDate)).size;

        let content = `
            <div class="card">
                <div class="card-header">Workout History</div>
                
                <!-- Year Stats Summary -->
                <div style="display: flex; gap: 16px; margin-bottom: 24px; padding: 16px; background: var(--surface); border-radius: 8px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: var(--primary-color);">${workoutDays}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Workout Days</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 24px; font-weight: 600; color: var(--success-color);" id="year-total-sets">...</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Sets</div>
                    </div>
                </div>
                
                <!-- Year Navigation -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <button class="btn btn-secondary" id="prev-year-btn">← Previous Year</button>
                    <h2 id="year-header" style="margin: 0; font-size: 24px; cursor: default;">${year}</h2>
                    <button class="btn btn-secondary" id="next-year-btn">Next Year →</button>
                </div>

                <!-- Month Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
        `;

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        monthNames.forEach((monthName, monthIndex) => {
            const monthSessions = sessionsByMonth[monthIndex] || [];
            const workoutCount = monthSessions.filter(s => s.status === 'completed').length;
            const hasWorkouts = workoutCount > 0;
            const isCurrentMonth = year === new Date().getFullYear() && monthIndex === new Date().getMonth();
            
            content += `
                <div class="month-card" data-month="${monthIndex}"
                     style="
                         border: 2px solid ${isCurrentMonth ? 'var(--primary-color)' : hasWorkouts ? 'var(--success-color)' : 'var(--border)'};
                         border-radius: 12px;
                         padding: 20px;
                         cursor: pointer;
                         background: var(--surface);
                         transition: all 0.2s;
                         position: relative;
                     ">
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; color: ${hasWorkouts ? 'var(--success-color)' : 'inherit'};">${monthName}</h3>
                    <div style="font-size: 32px; font-weight: 700; color: var(--primary-color); margin: 12px 0;">${workoutCount}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">workout${workoutCount !== 1 ? 's' : ''}</div>
                </div>
            `;
        });

        content += `
                </div>
            </div>
        `;

        this.container.innerHTML = content;
        this.attachYearViewListeners();
        
        // Load total sets asynchronously
        this.loadTotalSetsForPeriod('year');
        
        // Add hover styles
        const style = document.createElement('style');
        style.textContent = `
            .month-card:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
        `;
        if (!document.getElementById('year-view-styles')) {
            style.id = 'year-view-styles';
            document.head.appendChild(style);
        }
    }

    attachYearViewListeners() {
        // Year navigation
        document.getElementById('prev-year-btn')?.addEventListener('click', () => {
            this.currentMonth = new Date(this.currentMonth.getFullYear() - 1, this.currentMonth.getMonth(), 1);
            this.render();
        });

        document.getElementById('next-year-btn')?.addEventListener('click', () => {
            this.currentMonth = new Date(this.currentMonth.getFullYear() + 1, this.currentMonth.getMonth(), 1);
            this.render();
        });

        // Month card clicks - switch to month view
        document.querySelectorAll('.month-card').forEach(card => {
            card.addEventListener('click', () => {
                const month = parseInt(card.dataset.month);
                this.currentMonth = new Date(this.currentMonth.getFullYear(), month, 1);
                this.viewMode = 'month';
                this.render();
            });
        });
    }
}
