import { api } from '../utils/api-client.js?v=00000000000000';
import { eventBus } from '../utils/event-bus.js?v=00000000000000';
import { formatDate } from '../utils/date-formatter.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';
import { offlineManager } from '../utils/offline-manager.js?v=00000000000000';
import { offlineStorage } from '../utils/offline-storage.js?v=00000000000000';
import { wakeLockManager } from '../utils/wake-lock-manager.js?v=00000000000000';
import { exerciseHistoryDialog } from '../components/exercise-history-dialog.js?v=00000000000000';

// Fixed key for the active local workout session
const LOCAL_SESSION_ID = 'active_local_workout';

window.addEventListener('pagehide', () => wakeLockManager.disable());
window.addEventListener('beforeunload', () => wakeLockManager.disable());

export class WorkoutLoggerView {
    constructor() {
        this.container = document.getElementById('main');
        this.session = null;
        this.program = null;
        this.sets = [];
        this.exercises = [];
        this.preferences = null;
        this.currentExerciseIndex = 0;
        this.programId = null;
        this.restTimer = null;
        this.restTimerInterval = null;
        this.restTimerStartTime = null;
        this.defaultWeightForNewSet = '';
        this.screenAwakeEnabled = false;
        this.wakeLockWarningShown = false;
        this.cachedLastWeights = {}; // Cache of last workout weights per exercise
    }

    async render(programId = null) {
        this.programId = programId;
        this.container.innerHTML = '<div class="card"><p>Loading workout...</p></div>';
        
        const options = { showLoader: false, preferCache: true };

        // Load user preferences
        const prefsRes = await api.getPreferences(options);
        this.preferences = prefsRes.data;
        
        // Check for existing local workout first (fixed key - instant lookup)
        const existingWorkout = await offlineStorage.getDraftWorkout(LOCAL_SESSION_ID);
        
        if (programId) {
            // User wants to start a specific program
            if (existingWorkout) {
                // There's already an active workout
                if (existingWorkout.session?.programId === programId) {
                    // Same program - resume it
                    const loadSuccess = await this.loadLocalSession(existingWorkout);
                    if (loadSuccess) {
                        this.renderWorkout();
                        return;
                    }
                } else {
                    // Different program - block with error
                    notification.error('You have an active workout in progress. Please complete or cancel it before starting a new one.');
                    eventBus.emit('navigate', 'dashboard');
                    return;
                }
            }
            // No existing workout - start new session
            await this.startNewSession(programId);
        } else {
            // No program specified - check for existing workout to resume
            if (existingWorkout) {
                const loadSuccess = await this.loadLocalSession(existingWorkout);
                if (!loadSuccess) {
                    // Session program is missing, clean up and show selector
                    if (confirm('Your previous workout program is no longer available. Start a new workout?')) {
                        await offlineStorage.deleteDraftWorkout(LOCAL_SESSION_ID);
                        await this.showProgramSelector();
                        return;
                    } else {
                        eventBus.emit('navigate', 'dashboard');
                        return;
                    }
                }
            } else {
                // No active session - show program selector
                await this.showProgramSelector();
                return;
            }
        }

        this.renderWorkout();
    }

    async showProgramSelector() {
        await this.updateScreenAwakeState(false);

        const options = { showLoader: false, preferCache: true };
        const programsRes = await api.getPrograms(null, options);
        const programs = programsRes.data;
        
        // Sort programs by day according to user preferences
        const weekStartDay = this.preferences?.weekStartDay || 0;
        const sortedPrograms = [...programs].sort((a, b) => {
            // Handle null dayOfWeek (unscheduled programs go to end)
            if (a.dayOfWeek === null && b.dayOfWeek === null) return 0;
            if (a.dayOfWeek === null) return 1;
            if (b.dayOfWeek === null) return -1;
            
            // Calculate day position relative to week start
            const aDayPos = (a.dayOfWeek - weekStartDay + 7) % 7;
            const bDayPos = (b.dayOfWeek - weekStartDay + 7) % 7;
            
            return aDayPos - bDayPos;
        });
        
        let content = `
            <div class="card">
                <div class="card-header">Select a Program</div>
                <p style="margin-bottom: 20px; color: var(--text-secondary);">Choose a program to start your workout</p>
        `;

        if (programs.length === 0) {
            content += `
                <div style="text-align: center; padding: 40px 20px;">
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">No programs available</p>
                    <button class="btn btn-primary" id="create-program-btn">Create a Program</button>
                </div>
            `;
        } else {
            content += '<div style="display: grid; gap: 12px;">';
            sortedPrograms.forEach(program => {
                content += `
                    <div class="card program-select-card" data-program-id="${program.id}" style="cursor: pointer; margin-bottom: 0;">
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
        }

        content += `
                <div style="margin-top: 20px;">
                    <button class="btn btn-secondary" id="cancel-workout">Cancel</button>
                </div>
            </div>
        `;

        this.container.innerHTML = content;

        document.querySelectorAll('.program-select-card').forEach(card => {
            card.addEventListener('click', async () => {
                const programId = card.dataset.programId;
                await this.render(programId);
            });
        });

        document.getElementById('create-program-btn')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'programs');
        });

        document.getElementById('cancel-workout')?.addEventListener('click', () => {
            eventBus.emit('navigate', 'dashboard');
        });
    }

    /**
     * Load a local workout session from stored draft data.
     */
    async loadLocalSession(draftWorkout) {
        if (!draftWorkout?.session?.programId) {
            console.error('Draft workout missing session or programId:', draftWorkout);
            return false;
        }
        
        this.session = draftWorkout.session;
        
        const options = { showLoader: false, preferCache: true };
        
        // Load exercises and cached weights (program comes from draft snapshot)
        const [exercisesRes, lastWeights] = await Promise.all([
            api.getExercises(options),
            offlineStorage.getLastWorkoutWeights(this.session.programId)
        ]);
        
        // Use stored program snapshot to preserve workout state even if program was edited
        // Fall back to fetching from API only if draft doesn't have program snapshot
        if (draftWorkout.program && draftWorkout.program.exercises) {
            this.program = draftWorkout.program;
            console.log(`[WorkoutLogger] Using stored program snapshot for workout`);
        } else {
            // Fallback: fetch from API (for older drafts without program snapshot)
            const programRes = await api.getProgram(this.session.programId, options);
            if (!programRes.success || !programRes.data) {
                console.error('Failed to load program:', programRes.error);
                return false;
            }
            this.program = programRes.data;
            console.log(`[WorkoutLogger] Fetched program from API (no snapshot in draft)`);
        }
        
        this.exercises = exercisesRes.data;
        this.cachedLastWeights = lastWeights || {};
        this.sets = draftWorkout.sets || [];
        
        // Use saved index if valid, otherwise auto-determine
        const savedIndex = draftWorkout.currentExerciseIndex;
        if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < this.program.exercises.length) {
            this.currentExerciseIndex = savedIndex;
        } else {
            this.currentExerciseIndex = this.determineCurrentExercise();
        }
        
        console.log(`[WorkoutLogger] Resumed local session for program ${this.session.programId} with ${this.sets.length} sets`);
        return true;
    }

    async startNewSession(programId) {
        const options = { showLoader: false, preferCache: true };
        
        // Load program and exercises from cache (instant)
        const [programRes, exercisesRes, lastWeights] = await Promise.all([
            api.getProgram(programId, options),
            api.getExercises(options),
            offlineStorage.getLastWorkoutWeights(programId)
        ]);
        
        this.program = programRes.data;
        this.exercises = exercisesRes.data;
        
        // Store cached weights for quick access during workout
        this.cachedLastWeights = lastWeights || {};
        
        // Create session locally with fixed ID (instant, no server call)
        this.session = {
            id: LOCAL_SESSION_ID,
            programId: programId,
            programName: this.program.name,
            sessionDate: new Date().toISOString().split('T')[0],
            startedAt: new Date().toISOString(),
            status: 'in-progress'
        };
        
        this.sets = [];
        this.currentExerciseIndex = 0;
        
        // Save as draft workout so it persists if browser refreshes
        await this.saveDraftWorkout();
        
        console.log(`[WorkoutLogger] Created local session for program ${programId}`);
    }

    determineCurrentExercise() {
        if (this.sets.length === 0) return 0;

        // Find the last exercise that has completed sets
        for (let i = this.program.exercises.length - 1; i >= 0; i--) {
            const programExercise = this.program.exercises[i];
            const exerciseSets = this.sets.filter(s => s.exerciseId === programExercise.exerciseId && !s.isWarmup);
            
            if (exerciseSets.length > 0) {
                // If all sets are completed, move to next exercise
                if (exerciseSets.length >= (programExercise.sets || 0)) {
                    return Math.min(i + 1, this.program.exercises.length - 1);
                }
                return i;
            }
        }

        return 0;
    }

    async renderWorkout() {
        // Validate currentExerciseIndex is within bounds
        if (!this.program.exercises || this.program.exercises.length === 0) {
            await this.updateScreenAwakeState(false);
            this.container.innerHTML = '<div class="card"><p>No exercises in this program</p></div>';
            return;
        }
        
        // Ensure index is within valid range
        this.currentExerciseIndex = Math.max(0, Math.min(this.currentExerciseIndex, this.program.exercises.length - 1));

        await this.updateScreenAwakeState(true);
        
        const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
        const exerciseData = this.exercises.find(e => e.id === currentProgramExercise.exerciseId);
        const exerciseSets = this.sets.filter(s => s.exerciseId === currentProgramExercise.exerciseId);
        const completedExercises = this.countCompletedExercises();

        // Pre-fetch default weight for new set
        await this.fetchDefaultWeightForNewSet(currentProgramExercise, exerciseSets);

        let content = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">${this.program.name}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" id="cancel-workout-btn">Cancel</button>
                        <button class="btn btn-danger" id="finish-workout-btn">Finish Workout</button>
                    </div>
                </div>

                <!-- Progress -->
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 14px; color: var(--text-secondary);">
                            Exercise ${this.currentExerciseIndex + 1} of ${this.program.exercises.length}
                        </span>
                        <span style="font-size: 14px; font-weight: 600;">
                            ${completedExercises}/${this.program.exercises.length} completed
                        </span>
                    </div>
                    <div style="height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; background: var(--success-color); width: ${(completedExercises / this.program.exercises.length) * 100}%; transition: width 0.3s;"></div>
                    </div>
                </div>

                <!-- Current Exercise -->
                <div style="background: var(--surface); padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <h2 style="margin: 0; flex: 1;">${exerciseData?.name || 'Unknown Exercise'}</h2>
                        <button class="btn btn-secondary" id="view-exercise-history-btn" style="padding: 8px 12px; font-size: 20px;" title="View previous weights">
                            📊
                        </button>
                        <button class="btn btn-secondary" id="view-exercise-details-btn" style="padding: 8px 12px; font-size: 20px;" title="View exercise details">
                            ℹ️
                        </button>
                    </div>
                    <div style="display: flex; gap: 16px; margin-bottom: 12px;">
                        <span style="background: var(--primary-color); color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px;">
                            ${exerciseData?.muscleGroup || 'N/A'}
                        </span>
                        <span style="background: var(--badge-secondary); color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px;">
                            ${currentProgramExercise.sets || 3} × ${currentProgramExercise.repsMin && currentProgramExercise.repsMax ? (currentProgramExercise.repsMin === currentProgramExercise.repsMax ? currentProgramExercise.repsMin : currentProgramExercise.repsMin + '-' + currentProgramExercise.repsMax) : '8-12'}
                        </span>
                    </div>
                    ${currentProgramExercise.targetWeight ? `
                        <p style="font-size: 14px; color: var(--text-secondary);">Target: ${currentProgramExercise.targetWeight} ${this.preferences?.defaultWeightUnit || 'KG'}</p>
                    ` : ''}
                    ${this.shouldShowWarmupButton(exerciseSets, currentProgramExercise) ? `
                        <button class="btn btn-secondary" id="add-warmup-btn" style="margin-top: 12px;">
                            🔥 Add Warmup Sets
                        </button>
                    ` : ''}
                </div>

                <!-- Sets -->
                <div style="margin-bottom: 20px;">
                    <h3 style="margin-bottom: 12px;">Sets</h3>
                    <!-- Column Headers -->
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px; padding: 0 12px;">
                        <div style="width: 40px;"></div>
                        <div style="flex: 1; font-size: 12px; font-weight: 600; color: var(--text-secondary);">
                            Weight (${this.preferences?.defaultWeightUnit || 'KG'})
                        </div>
                        <div style="flex: 1; font-size: 12px; font-weight: 600; color: var(--text-secondary);">
                            Reps
                        </div>
                        <div style="width: 80px;"></div>
                    </div>
                    <div id="sets-list" style="display: flex; flex-direction: column; gap: 8px;">
                        ${exerciseSets.map((set, index) => this.renderSetRow(set, index, false)).join('')}
                        ${this.renderSetRow(null, exerciseSets.length, true)}
                    </div>
                </div>

                ${exerciseSets.filter(s => !s.isWarmup).length >= (currentProgramExercise.sets || 0) ? `
                    <div style="display: flex; gap: 12px;">
                        ${this.currentExerciseIndex < this.program.exercises.length - 1 ? `
                            <button class="btn btn-primary" id="next-exercise-btn" style="flex: 1;">
                                Next Exercise →
                            </button>
                        ` : `
                            <button class="btn btn-success" id="complete-workout-btn" style="flex: 1;">
                                Complete Workout ✓
                            </button>
                        `}
                    </div>
                ` : ''}

                <!-- Exercise Navigation -->
                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border);">
                    <h4 style="margin-bottom: 12px; font-size: 14px; color: var(--text-secondary);">All Exercises</h4>
                    <div style="display: grid; gap: 8px;">
                        ${this.program.exercises.map((ex, idx) => this.renderExerciseNavItem(ex, idx)).join('')}
                    </div>
                    
                    <!-- Add New Exercise Section -->
                    <div id="add-exercise-section" style="margin-top: 16px;">
                        <div id="add-exercise-form" style="display: none;">
                            <div class="card" style="margin-bottom: 0; padding: 16px; background: var(--surface);">
                                <div style="display: flex; gap: 12px; align-items: start; flex-wrap: wrap;">
                                    <div style="flex: 2; min-width: 200px; position: relative;">
                                        <label style="font-size: 12px; color: var(--text-secondary);">Exercise</label>
                                        <div class="exercise-dropdown-wrapper" style="position: relative;">
                                            <input 
                                                type="text" 
                                                class="form-input" 
                                                id="new-exercise-search"
                                                placeholder="Type to search exercises..."
                                                style="margin-top: 4px;"
                                                data-exercise-id=""
                                                autocomplete="off">
                                            <div id="new-exercise-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px var(--shadow); z-index: 100;">
                                                ${this.exercises
                                                    .slice()
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(ex => `
                                                    <div class="new-exercise-option" data-exercise-name="${ex.name}" data-exercise-id="${ex.id}" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border);">
                                                        <div style="font-weight: 500;">${ex.name}</div>
                                                        <div style="font-size: 12px; color: var(--text-secondary);">${ex.muscleGroup || ''}</div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="width: 70px;">
                                        <label style="font-size: 12px; color: var(--text-secondary);">Sets</label>
                                        <input type="number" class="form-input" id="new-exercise-sets" 
                                               value="3" min="1" max="10" style="margin-top: 4px;">
                                    </div>
                                    <div style="width: 80px;">
                                        <label style="font-size: 12px; color: var(--text-secondary);">Reps</label>
                                        <input type="text" class="form-input" id="new-exercise-reps" 
                                               value="8-12" placeholder="8-12" style="margin-top: 4px;">
                                    </div>
                                    <div style="width: 90px;">
                                        <label style="font-size: 12px; color: var(--text-secondary);">Weight</label>
                                        <input type="number" class="form-input" id="new-exercise-weight" 
                                               min="0" step="any" placeholder="Optional" style="margin-top: 4px;">
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end;">
                                    <button type="button" class="btn btn-secondary" id="cancel-add-exercise-btn">Cancel</button>
                                    <button type="button" class="btn btn-success" id="confirm-add-exercise-btn">✓ Add</button>
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="show-add-exercise-btn" style="width: 100%; margin-top: 8px;">
                            + Add Exercise
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = content;
        this.attachWorkoutListeners();
    }

    renderSetRow(set, index, isNewSet) {
        const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
        const exerciseSets = this.sets.filter(s => s.exerciseId === currentProgramExercise.exerciseId);
        
        if (isNewSet) {
            // Use the pre-fetched default weight
            const defaultWeight = this.defaultWeightForNewSet;
            
            return `
                <div class="card" style="margin-bottom: 0; padding: 12px;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="width: 40px; text-align: center; font-weight: 600;">
                            ${index + 1}
                        </div>
                        <div style="flex: 1;">
                            <input type="number" class="form-input new-set-weight" placeholder="Weight" 
                                   value="${defaultWeight}" min="0.1" step="any">
                        </div>
                        <div style="flex: 1;">
                            <input type="number" class="form-input new-set-reps" placeholder="Reps" 
                                   min="1" step="1">
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; width: 80px; justify-content: flex-end;">
                            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer;" title="Mark as warmup set">
                                <input type="checkbox" class="new-set-warmup" style="cursor: pointer;">
                                <span>W</span>
                            </label>
                            <button class="btn btn-success" id="add-set-btn" style="padding: 8px 12px;">
                                + Add
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="card set-row" style="margin-bottom: 0; padding: 12px; background: ${set.isWarmup ? '#fff3e0' : 'white'};">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="width: 40px; text-align: center; font-weight: 600;">
                        ${index + 1}
                    </div>
                    <div style="flex: 1;">
                        <input type="number" class="form-input set-weight" data-set-id="${set.id}" 
                               value="${set.weight}" min="0.1">
                    </div>
                    <div style="flex: 1;">
                        <input type="number" class="form-input set-reps" data-set-id="${set.id}" 
                               value="${set.reps}" min="1" step="1">
                    </div>
                    <div style="display: flex; gap: 4px; align-items: center; width: 80px; justify-content: flex-end;">
                        ${set.isWarmup ? '<span style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">W</span>' : ''}
                        <button class="btn btn-danger btn-delete-set" data-set-id="${set.id}" style="padding: 8px 12px;">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderExerciseNavItem(programExercise, index) {
        const exerciseData = this.exercises.find(e => e.id === programExercise.exerciseId);
        const exerciseSets = this.sets.filter(s => s.exerciseId === programExercise.exerciseId);
        const workingSets = exerciseSets.filter(s => !s.isWarmup);
        const targetSets = programExercise.sets || 0;
        const isCompleted = workingSets.length >= targetSets;
        const isCurrent = index === this.currentExerciseIndex;

        return `
            <div class="card exercise-nav-item" data-exercise-index="${index}" 
                 style="margin-bottom: 0; padding: 12px; cursor: pointer; border: 2px solid ${isCurrent ? 'var(--primary-color)' : 'transparent'}; background: ${isCompleted ? '#e8f5e9' : 'white'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; margin-bottom: 4px;">${exerciseData?.name || 'Unknown'}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            ${workingSets.length}/${targetSets} sets
                        </div>
                    </div>
                    ${isCompleted ? '<span style="font-size: 20px;">✓</span>' : ''}
                </div>
            </div>
        `;
    }

    countCompletedExercises() {
        return this.program.exercises.filter((ex, idx) => {
            const exerciseSets = this.sets.filter(s => s.exerciseId === ex.exerciseId && !s.isWarmup);
            return exerciseSets.length >= (ex.sets || 0);
        }).length;
    }

    attachWorkoutListeners() {
        // View exercise history button
        document.getElementById('view-exercise-history-btn')?.addEventListener('click', () => {
            const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
            const exerciseData = this.exercises.find(e => e.id === currentProgramExercise.exerciseId);
            if (exerciseData) {
                exerciseHistoryDialog.show(exerciseData, this.preferences);
            }
        });

        // View exercise details button
        document.getElementById('view-exercise-details-btn')?.addEventListener('click', () => {
            const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
            const exerciseData = this.exercises.find(e => e.id === currentProgramExercise.exerciseId);
            if (exerciseData) {
                this.showExerciseDetailsOverlay(exerciseData);
            }
        });
        
        // Add warmup sets button
        document.getElementById('add-warmup-btn')?.addEventListener('click', async () => {
            await this.addWarmupSets();
        });
        
        // Add set button
        document.getElementById('add-set-btn')?.addEventListener('click', async () => {
            await this.addNewSet();
        });

        // Enter key on new set inputs
        const newWeightInput = document.querySelector('.new-set-weight');
        const newRepsInput = document.querySelector('.new-set-reps');
        
        [newWeightInput, newRepsInput].forEach(input => {
            input?.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    await this.addNewSet();
                    return false;
                }
            });
        });

        // Update set on blur
        document.querySelectorAll('.set-weight, .set-reps').forEach(input => {
            input.addEventListener('blur', async (e) => {
                const setId = e.target.dataset.setId;
                await this.updateSetValue(setId);
            });
            
            // Handle Enter key to move to next field/set
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    
                    const isWeightField = input.classList.contains('set-weight');
                    const setId = input.dataset.setId;
                    
                    if (isWeightField) {
                        // Move to reps field in same row
                        const repsInput = document.querySelector(`.set-reps[data-set-id="${setId}"]`);
                        if (repsInput) {
                            repsInput.focus();
                            repsInput.select();
                        }
                    } else {
                        // We're in reps field - move to next set's weight field or new set
                        const allSetRows = document.querySelectorAll('.set-row');
                        const currentRow = input.closest('.set-row');
                        const rowsArray = Array.from(allSetRows);
                        const currentIndex = rowsArray.indexOf(currentRow);
                        
                        if (currentIndex < rowsArray.length - 1) {
                            // Move to next set's weight field
                            const nextRow = rowsArray[currentIndex + 1];
                            const nextWeightInput = nextRow.querySelector('.set-weight');
                            if (nextWeightInput) {
                                nextWeightInput.focus();
                                nextWeightInput.select();
                            }
                        } else {
                            // We're at the last set - focus on new set weight input
                            const newWeightInput = document.querySelector('.new-set-weight');
                            if (newWeightInput) {
                                newWeightInput.focus();
                                newWeightInput.select();
                            }
                        }
                    }
                }
            });
        });

        // Delete set buttons
        document.querySelectorAll('.btn-delete-set').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const setId = btn.dataset.setId;
                if (confirm('Delete this set?')) {
                    await this.deleteSetById(setId);
                }
            });
        });

        // Next exercise button
        document.getElementById('next-exercise-btn')?.addEventListener('click', () => {
            this.currentExerciseIndex++;
            this.renderWorkout();
        });

        // Complete workout button (in body area when last exercise is done)
        document.getElementById('complete-workout-btn')?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to finish this workout?')) {
                await this.completeWorkout();
            }
        });

        // Finish workout button
        document.getElementById('finish-workout-btn')?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to finish this workout?')) {
                await this.completeWorkout();
            }
        });

        // Cancel workout button
        document.getElementById('cancel-workout-btn')?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to cancel this workout? All progress will be lost.')) {
                await this.cancelWorkout();
            }
        });

        // Exercise navigation
        document.querySelectorAll('.exercise-nav-item').forEach(item => {
            item.addEventListener('click', async () => {
                const index = parseInt(item.dataset.exerciseIndex);
                this.currentExerciseIndex = index;
                
                // Auto-save when changing exercises
                await this.saveDraftWorkout();
                
                await this.renderWorkout();
            });
        });

        // Add exercise functionality
        this.attachAddExerciseListeners();
    }

    attachAddExerciseListeners() {
        const showAddExerciseBtn = document.getElementById('show-add-exercise-btn');
        const addExerciseForm = document.getElementById('add-exercise-form');
        const cancelAddExerciseBtn = document.getElementById('cancel-add-exercise-btn');
        const confirmAddExerciseBtn = document.getElementById('confirm-add-exercise-btn');
        const newExerciseSearch = document.getElementById('new-exercise-search');
        const newExerciseDropdown = document.getElementById('new-exercise-dropdown');

        // Show add exercise form
        showAddExerciseBtn?.addEventListener('click', () => {
            addExerciseForm.style.display = 'block';
            showAddExerciseBtn.style.display = 'none';
            newExerciseSearch?.focus();
        });

        // Cancel adding exercise
        cancelAddExerciseBtn?.addEventListener('click', () => {
            addExerciseForm.style.display = 'none';
            showAddExerciseBtn.style.display = 'block';
            this.resetAddExerciseForm();
        });

        // Confirm adding exercise
        confirmAddExerciseBtn?.addEventListener('click', async () => {
            await this.addNewExerciseToWorkout();
        });

        // Exercise search dropdown functionality
        if (newExerciseSearch && newExerciseDropdown) {
            // Show dropdown on focus
            newExerciseSearch.addEventListener('focus', () => {
                newExerciseDropdown.style.display = 'block';
                this.filterNewExerciseDropdown();
            });

            // Filter on input
            newExerciseSearch.addEventListener('input', () => {
                newExerciseDropdown.style.display = 'block';
                this.filterNewExerciseDropdown();
            });

            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!newExerciseSearch.contains(e.target) && !newExerciseDropdown.contains(e.target)) {
                    newExerciseDropdown.style.display = 'none';
                }
            });

            // Select exercise on click
            newExerciseDropdown.querySelectorAll('.new-exercise-option').forEach(option => {
                option.addEventListener('click', () => {
                    newExerciseSearch.value = option.dataset.exerciseName;
                    newExerciseSearch.dataset.exerciseId = option.dataset.exerciseId;
                    newExerciseDropdown.style.display = 'none';
                });

                // Hover effect
                option.addEventListener('mouseenter', () => {
                    option.style.background = 'var(--primary-hover)';
                });
                option.addEventListener('mouseleave', () => {
                    option.style.background = 'transparent';
                });
            });
        }
    }

    filterNewExerciseDropdown() {
        const searchInput = document.getElementById('new-exercise-search');
        const dropdown = document.getElementById('new-exercise-dropdown');
        
        if (!searchInput || !dropdown) return;
        
        const searchTerm = searchInput.value.toLowerCase();
        const options = dropdown.querySelectorAll('.new-exercise-option');
        
        options.forEach(option => {
            const exerciseName = option.dataset.exerciseName.toLowerCase();
            if (exerciseName.includes(searchTerm)) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    }

    resetAddExerciseForm() {
        const newExerciseSearch = document.getElementById('new-exercise-search');
        const newExerciseSets = document.getElementById('new-exercise-sets');
        const newExerciseReps = document.getElementById('new-exercise-reps');
        const newExerciseWeight = document.getElementById('new-exercise-weight');
        
        if (newExerciseSearch) {
            newExerciseSearch.value = '';
            newExerciseSearch.dataset.exerciseId = '';
        }
        if (newExerciseSets) newExerciseSets.value = '3';
        if (newExerciseReps) newExerciseReps.value = '8-12';
        if (newExerciseWeight) newExerciseWeight.value = '';
    }

    async addNewExerciseToWorkout() {
        const newExerciseSearch = document.getElementById('new-exercise-search');
        const newExerciseSets = document.getElementById('new-exercise-sets');
        const newExerciseReps = document.getElementById('new-exercise-reps');
        const newExerciseWeight = document.getElementById('new-exercise-weight');
        
        const exerciseId = newExerciseSearch?.dataset.exerciseId;
        const sets = parseInt(newExerciseSets?.value) || 3;
        const repsValue = newExerciseReps?.value || '8-12';
        const targetWeight = parseFloat(newExerciseWeight?.value) || null;
        
        // Validate exercise selection
        if (!exerciseId) {
            notification.warning('Please select an exercise from the list');
            newExerciseSearch?.focus();
            return;
        }
        
        // Check if exercise already exists in program
        const existingExercise = this.program.exercises.find(ex => ex.exerciseId === exerciseId);
        if (existingExercise) {
            notification.warning('This exercise is already in your workout. Navigate to it using the exercise list above.');
            return;
        }
        
        // Parse reps range
        let repsMin, repsMax;
        if (repsValue.includes('-')) {
            const parts = repsValue.split('-');
            repsMin = parseInt(parts[0]) || 8;
            repsMax = parseInt(parts[1]) || 12;
        } else {
            repsMin = repsMax = parseInt(repsValue) || 10;
        }
        
        // Create new program exercise
        const newProgramExercise = {
            exerciseId: exerciseId,
            order: this.program.exercises.length,
            sets: sets,
            repsMin: repsMin,
            repsMax: repsMax,
            targetWeight: targetWeight
        };
        
        // Add to program exercises locally
        this.program.exercises.push(newProgramExercise);
        
        // Save draft workout
        await this.saveDraftWorkout();
        
        // Navigate to the new exercise
        this.currentExerciseIndex = this.program.exercises.length - 1;
        
        // Reset form and re-render
        this.resetAddExerciseForm();
        notification.success('Exercise added to workout!');
        
        await this.renderWorkout();
    }

    shouldShowWarmupButton(exerciseSets, currentProgramExercise) {
        // Don't show if no target weight set
        if (!currentProgramExercise.targetWeight) return false;
        
        // Don't show if warmup behavior is disabled
        if (this.preferences?.warmupBehavior === 'never') return false;
        
        // Don't show if there are already warmup sets
        const hasWarmupSets = exerciseSets.some(set => set.isWarmup);
        if (hasWarmupSets) return false;
        
        // Don't show if there are already working sets
        const hasWorkingSets = exerciseSets.some(set => !set.isWarmup);
        if (hasWorkingSets) return false;
        
        return true;
    }

    async addWarmupSets() {
        const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
        const targetWeight = currentProgramExercise.targetWeight;
        
        if (!targetWeight) {
            notification.warning('No target weight set for this exercise');
            return;
        }
        
        // Get warmup configuration from preferences
        const warmupPercentages = this.preferences?.warmupPercentages || [50, 60, 70, 80, 90];
        const warmupReps = this.preferences?.warmupReps || [5, 5, 3, 2, 1];
        
        try {
            let setNumber = 1;
            
            // Generate warmup sets based on percentages
            for (let i = 0; i < warmupPercentages.length; i++) {
                const percentage = warmupPercentages[i];
                const reps = warmupReps[i] || 5;
                const weight = Math.round((targetWeight * percentage / 100) * 2) / 2; // Round to nearest 0.5
                
                const warmupSet = {
                    exerciseId: currentProgramExercise.exerciseId,
                    setNumber: setNumber++,
                    weight: weight,
                    reps: reps,
                    isWarmup: true,
                    timestamp: new Date().toISOString()
                };
                
                const response = await api.addSet(this.session.id, warmupSet);
                if (response.success) {
                    this.sets.push(response.data);
                }
                
                // Small delay between sets
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // Auto-save draft workout
            await this.saveDraftWorkout();
            
            notification.success('Warmup sets added!');
            this.renderWorkout();
        } catch (error) {
            console.error('Error adding warmup sets:', error);
            notification.error('Failed to add warmup sets: ' + error.message);
        }
    }

    async addNewSet() {
        const weightInput = document.querySelector('.new-set-weight');
        const repsInput = document.querySelector('.new-set-reps');
        const warmupCheckbox = document.querySelector('.new-set-warmup');

        const weight = parseFloat(weightInput.value);
        const reps = parseInt(repsInput.value);
        const isWarmup = warmupCheckbox?.checked || false;

        // Validate both weight and reps are provided
        if (!weight || weight <= 0) {
            notification.warning('Please enter a valid weight (must be greater than 0)');
            weightInput?.focus();
            return;
        }

        if (!reps || reps < 1) {
            notification.warning('Please enter the number of reps (must be at least 1)');
            repsInput?.focus();
            return;
        }

        const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
        
        const previousWeight = weight;
        const tempId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const setNumber = this.sets.filter(s => s.exerciseId === currentProgramExercise.exerciseId).length + 1;

        const localSet = {
            id: tempId,
            sessionId: this.session.id,
            exerciseId: currentProgramExercise.exerciseId,
            setNumber,
            weight,
            reps,
            isWarmup,
            weightUnit: this.preferences?.defaultWeightUnit || 'KG',
            loggedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            source: 'local'
        };

        // Optimistically update UI
        this.sets.push(localSet);

        // Clear reps input
        repsInput.value = '';

        // Re-render immediately for snappy UX
        this.renderWorkout();

        // Start rest timer after adding a set
        this.startRestTimer();

        // After render, set the weight and focus reps (double RAF for reliability)
        const focusNextInputs = (weightVal) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const newWeightInput = document.querySelector('.new-set-weight');
                    const newRepsInput = document.querySelector('.new-set-reps');
                    if (newWeightInput) newWeightInput.value = weightVal;
                    if (newRepsInput) {
                        newRepsInput.focus();
                        newRepsInput.select();
                    }
                });
            });
        };
        focusNextInputs(previousWeight);

        // Persist draft locally (fire-and-forget)
        this.saveDraftWorkout().catch(err => console.warn('Save draft failed', err));

        // For local sessions (fixed ID), don't sync to server - will batch sync on complete
        if (this.session.id === LOCAL_SESSION_ID) {
            console.log('[WorkoutLogger] Local session - set saved locally, will sync on complete');
            return;
        }

        // Sync in background for server-created sessions
        const payload = {
            exerciseId: localSet.exerciseId,
            setNumber: localSet.setNumber,
            weight: localSet.weight,
            reps: localSet.reps,
            isWarmup: localSet.isWarmup,
            timestamp: localSet.loggedAt
        };

        try {
            const response = await api.addSet(this.session.id, payload);
            if (response.success && response.data) {
                // Replace temp set with server set (no re-render to preserve focus)
                const idx = this.sets.findIndex(s => s.id === tempId);
                if (idx !== -1) {
                    this.sets[idx] = response.data;
                    this.saveDraftWorkout().catch(() => {});

                    const rowEl = document.querySelector(`.set-weight[data-set-id="${tempId}"]`)?.closest('.set-row');
                    if (rowEl) {
                        rowEl.querySelectorAll('[data-set-id]').forEach(el => {
                            el.dataset.setId = response.data.id;
                        });
                    }
                }
            } else if (response.source === 'queued') {
                notification.info('Set saved offline. Will sync when connection is restored.');
            } else {
                throw new Error(response.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error syncing set:', error);
            // Mark temp set as failed to sync (no re-render)
            const idx = this.sets.findIndex(s => s.id === tempId);
            if (idx !== -1) {
                this.sets[idx].syncError = true;
                this.saveDraftWorkout().catch(() => {});
                const badgeHost = document.querySelector(`.set-weight[data-set-id="${tempId}"]`)?.closest('.set-row');
                if (badgeHost && !badgeHost.querySelector('.sync-error-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'sync-error-badge';
                    badge.textContent = '⚠️';
                    badge.title = 'Sync failed. Will retry later.';
                    badge.style.marginLeft = '4px';
                    const actions = badgeHost.querySelector('div[style*="justify-content: flex-end"]');
                    actions?.prepend(badge);
                }
            }
            notification.error('Failed to sync set: ' + error.message);
        }
    }

    async updateSetValue(setId) {
        const weightInput = document.querySelector(`.set-weight[data-set-id="${setId}"]`);
        const repsInput = document.querySelector(`.set-reps[data-set-id="${setId}"]`);

        const set = this.sets.find(s => s.id === setId);
        if (!set) return;

        // Don't attempt to sync local-only sets or sets in local sessions
        const isLocal = setId.startsWith('local-') || this.session.id === LOCAL_SESSION_ID;

        const weight = parseFloat(weightInput.value);
        const reps = parseInt(repsInput.value);

        // Validate weight and reps
        if (!weight || weight <= 0) {
            notification.warning('Weight must be greater than 0');
            weightInput.focus();
            // Restore previous value
            weightInput.value = set.weight;
            return;
        }

        if (!reps || reps < 1) {
            notification.warning('Reps must be at least 1');
            repsInput.focus();
            // Restore previous value
            repsInput.value = set.reps;
            return;
        }

        set.weight = weight;
        set.reps = reps;

        if (isLocal) {
            await this.saveDraftWorkout();
            return;
        }

        try {
            const response = await api.updateSet(this.session.id, setId, set);
            
            // Auto-save draft workout
            await this.saveDraftWorkout();
            
            if (response.source === 'queued') {
                notification.info('Set updated offline. Will sync when connection is restored.');
            }
        } catch (error) {
            console.error('Error updating set:', error);
            notification.error('Failed to update set: ' + error.message);
        }
    }

    async deleteSetById(setId) {
        const isLocal = setId.startsWith('local-') || this.session.id === LOCAL_SESSION_ID;
        if (isLocal) {
            this.sets = this.sets.filter(s => s.id !== setId);
            await this.saveDraftWorkout();
            this.renderWorkout();
            return;
        }

        try {
            const response = await api.deleteSet(this.session.id, setId);
            this.sets = this.sets.filter(s => s.id !== setId);
            
            // Auto-save draft workout
            await this.saveDraftWorkout();
            
            this.renderWorkout();
            
            if (response.source === 'queued') {
                notification.info('Set deleted offline. Will sync when connection is restored.');
            }
        } catch (error) {
            console.error('Error deleting set:', error);
            notification.error('Failed to delete set: ' + error.message);
        }
    }

    async updateScreenAwakeState(isWorkoutActive) {
        const shouldEnable = Boolean(this.preferences?.keepScreenAwake && isWorkoutActive);

        if (shouldEnable) {
            if (this.screenAwakeEnabled) {
                return;
            }

            const success = await wakeLockManager.enable();
            this.screenAwakeEnabled = success;

            if (!success && !this.wakeLockWarningShown) {
                notification.info('Keeping the screen awake is not supported on this device.');
                this.wakeLockWarningShown = true;
            }
        } else {
            if (this.screenAwakeEnabled) {
                await wakeLockManager.disable();
            }
            this.screenAwakeEnabled = false;
        }
    }

    async saveDraftWorkout() {
        if (!this.session || !this.session.id) return;
        
        try {
            await offlineStorage.saveDraftWorkout(this.session.id, {
                session: this.session,
                sets: this.sets,
                program: this.program,
                currentExerciseIndex: this.currentExerciseIndex,
                exercises: this.exercises
            });
            console.log('Draft workout saved');
        } catch (error) {
            console.warn('Failed to save draft workout:', error);
        }
    }

    async completeWorkout() {
        // Check if online first - completing workout requires internet connection
        if (!navigator.onLine) {
            notification.warning('Cannot complete workout while offline. Your workout data is saved locally. Please connect to the internet and try again.');
            return;
        }
        
        try {
            this.stopRestTimer();
            
            // If this is a local session, sync it to the server first
            if (this.session.id === LOCAL_SESSION_ID) {
                notification.info('Syncing workout to server...');
                
                const syncResult = await api.syncLocalSession(this.session, this.sets);
                
                if (!syncResult.success) {
                    notification.error('Failed to sync workout: ' + (syncResult.error || 'Unknown error'));
                    return;
                }
                
                // Update session with server-assigned ID
                const oldLocalId = this.session.id;
                this.session = syncResult.data.session;
                this.sets = syncResult.data.sets;
                
                // Delete the old local draft and save with new server ID
                await offlineStorage.deleteDraftWorkout(oldLocalId);
                
                console.log(`[WorkoutLogger] Synced local session ${oldLocalId} to server session ${this.session.id}`);
            }
            
            // Check if integration is configured and enabled
            const integrationEnabled = this.preferences?.outboundIntegrationEnabled;
            const integrationUrl = this.preferences?.outboundIntegrationUrl;
            
            if (integrationEnabled && integrationUrl) {
                // Submit to integration endpoint
                notification.info('Submitting workout data to integration...');
                const integrationResponse = await api.submitWorkoutIntegration(this.session.id);
                
                if (!integrationResponse.success) {
                    // Integration failed - don't complete workout
                    notification.error('Failed to submit workout data: ' + (integrationResponse.error || 'Unknown error'));
                    return;
                }
                
                notification.success('Workout data submitted to integration!');
            }
            
            // Update session to mark as complete
            this.session.status = 'completed';
            this.session.completedAt = new Date().toISOString();
            
            const response = await api.updateSession(this.session.id, this.session);
            
            if (response.success) {
                // Save last workout weights for this program (for future sessions)
                await this.saveLastWorkoutWeights();
                
                // Clear draft workout since we're completing
                await offlineStorage.deleteDraftWorkout(this.session.id);
                await this.updateScreenAwakeState(false);
                
                notification.success('Workout completed! Great job! 💪');
                
                // Wait a tick to ensure cache operations complete
                await new Promise(resolve => setTimeout(resolve, 100));
                eventBus.emit('navigate', 'dashboard');
            } else {
                // Restore session status if failed
                this.session.status = 'in-progress';
                delete this.session.completedAt;
                notification.error('Failed to complete workout. ' + (response.error || 'Please try again.'));
            }
        } catch (error) {
            // Restore session status if failed
            this.session.status = 'in-progress';
            delete this.session.completedAt;
            console.error('Error completing workout:', error);
            notification.error('Failed to complete workout. Please check your connection and try again.');
        }
    }
    
    /**
     * Save the weights used in this workout for quick pre-fill in future sessions.
     */
    async saveLastWorkoutWeights() {
        if (!this.program || !this.sets) return;
        
        try {
            const weightsMap = {};
            
            // For each exercise in the program, find the 1st working set weight
            for (const programExercise of this.program.exercises) {
                const exerciseSets = this.sets
                    .filter(s => s.exerciseId === programExercise.exerciseId && !s.isWarmup)
                    .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
                
                if (exerciseSets.length > 0) {
                    const firstSet = exerciseSets[0];
                    weightsMap[programExercise.exerciseId] = {
                        weight: firstSet.weight,
                        reps: firstSet.reps,
                        timestamp: Date.now()
                    };
                }
            }
            
            if (Object.keys(weightsMap).length > 0) {
                await offlineStorage.saveLastWorkoutWeights(this.program.id, weightsMap);
                console.log(`[WorkoutLogger] Saved last workout weights for ${Object.keys(weightsMap).length} exercises`);
            }
        } catch (error) {
            console.warn('Failed to save last workout weights:', error);
        }
    }

    async cancelWorkout() {
        try {
            this.stopRestTimer();

            // If this is a local session, we can cancel it without server connection
            if (this.session.id === LOCAL_SESSION_ID) {
                // Just delete the local draft
                await offlineStorage.deleteDraftWorkout(LOCAL_SESSION_ID);
                await this.updateScreenAwakeState(false);
                
                notification.info('Workout cancelled');
                eventBus.emit('navigate', 'dashboard');
                return;
            }
            
            // For server sessions, check if online first
            if (!navigator.onLine) {
                notification.warning('Cannot cancel workout while offline. Your workout data is saved locally. Please connect to the internet to cancel.');
                return;
            }

            // Delete the session from server (removes the workout completely)
            await api.deleteSession(this.session.id);
            
            // Clear draft workout after successful deletion
            await offlineStorage.deleteDraftWorkout(this.session.id);
            await this.updateScreenAwakeState(false);
            
            notification.info('Workout cancelled and deleted');
            eventBus.emit('navigate', 'dashboard');
        } catch (error) {
            console.error('Error canceling workout:', error);
            notification.error(error.message || 'Failed to cancel workout. Please try again.');
        }
    }

    startRestTimer() {
        // Don't show rest timer if this is the last exercise in the program
        if (this.currentExerciseIndex === this.program.exercises.length - 1) {
            const currentProgramExercise = this.program.exercises[this.currentExerciseIndex];
            const exerciseSets = this.sets.filter(s => s.exerciseId === currentProgramExercise.exerciseId && !s.isWarmup);
            
            // If we've completed all sets for the last exercise, don't show timer
            if (exerciseSets.length >= (currentProgramExercise.sets || 0)) {
                return;
            }
        }
        
        // Stop any existing timer
        this.stopRestTimer();
        
        const restDuration = this.preferences?.restTimerDuration || 90; // seconds
        this.restTimer = restDuration; // Store the rest duration for adjustments
        this.restTimerStartTime = Date.now();
        
        // Create or update timer display
        this.showRestTimer(restDuration);
        
        // Update timer every second
        this.restTimerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = Math.floor((now - this.restTimerStartTime) / 1000);
            const remaining = Math.max(0, this.restTimer - elapsed);
            
            this.updateRestTimerDisplay(remaining);
            
            if (remaining === 0) {
                this.stopRestTimer();
                // Play notification sound if enabled
                if (this.preferences?.soundEnabled) {
                    this.playRestCompleteSound();
                }
                notification.success('Rest time complete!');
            }
        }, 1000);
    }

    stopRestTimer() {
        if (this.restTimerInterval) {
            clearInterval(this.restTimerInterval);
            this.restTimerInterval = null;
        }
        this.hideRestTimer();
    }

    adjustRestTimer(seconds) {
        if (!this.restTimerStartTime || !this.restTimer) return;
        
        // Adjust the total rest timer duration
        // Adding seconds increases total time, subtracting decreases it
        this.restTimer += seconds;
        
        // Calculate remaining time
        const elapsed = Math.floor((Date.now() - this.restTimerStartTime) / 1000);
        const remaining = Math.max(0, this.restTimer - elapsed);
        
        // Update the display
        this.updateRestTimerDisplay(remaining);
        
        // If timer would go negative, stop it
        if (remaining <= 0) {
            this.stopRestTimer();
            this.playRestCompleteSound();
        }
    }

    showRestTimer(duration) {
        // Check if timer already exists
        let timerEl = document.getElementById('rest-timer');
        
        if (!timerEl) {
            timerEl = document.createElement('div');
            timerEl.id = 'rest-timer';
            
            // Position at center of visible screen area
            timerEl.style.cssText = `
                position: fixed;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                background: var(--primary-color);
                color: white;
                padding: 24px 32px;
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                min-width: 200px;
                cursor: move;
                user-select: none;
            `;
            document.body.appendChild(timerEl);
            
            // Make timer draggable
            this.makeDraggable(timerEl);
            
            // Always start in expanded (large) state
            timerEl.dataset.minimized = 'false';
        }
        
        const isMinimized = timerEl.dataset.minimized === 'true';
        
        timerEl.innerHTML = `
            <div style="position: relative; width: 100%;">
                <button id="rest-timer-toggle-btn" style="
                    position: absolute;
                    top: ${isMinimized ? '-8px' : '-12px'};
                    right: ${isMinimized ? '-16px' : '-20px'};
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: ${isMinimized ? '24px' : '28px'};
                    height: ${isMinimized ? '24px' : '28px'};
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: ${isMinimized ? '12px' : '14px'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'"
                title="${isMinimized ? 'Maximize' : 'Minimize'}">${isMinimized ? '⬜' : '➖'}</button>
            </div>
            <div style="font-size: ${isMinimized ? '10px' : '14px'}; font-weight: 500; opacity: 0.9;">Rest Timer</div>
            <div id="rest-timer-display" style="font-size: ${isMinimized ? '24px' : '48px'}; font-weight: 700; line-height: 1;">${this.formatTime(duration)}</div>
            ${!isMinimized ? `
            <div id="rest-timer-buttons" style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                <button id="rest-timer-minus-btn" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">-1</button>
                <button id="skip-rest-btn" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">Skip</button>
                <button id="rest-timer-plus-btn" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">+1</button>
            </div>
            ` : ''}
        `;
        
        // Update timer padding based on minimized state
        timerEl.style.padding = isMinimized ? '12px 20px' : '24px 32px';
        timerEl.style.minWidth = isMinimized ? '100px' : '200px';
        
        // Attach minimize/maximize toggle button listener
        const toggleBtn = document.getElementById('rest-timer-toggle-btn');
        toggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRestTimerSize();
        });
        toggleBtn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleRestTimerSize();
        });
        
        // Attach skip button listener (only when not minimized)
        const skipBtn = document.getElementById('skip-rest-btn');
        skipBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopRestTimer();
        });
        skipBtn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.stopRestTimer();
        });
        
        // Attach minus button listener (-1 minute, only when not minimized)
        const minusBtn = document.getElementById('rest-timer-minus-btn');
        minusBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.adjustRestTimer(-60);
        });
        minusBtn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustRestTimer(-60);
        });
        
        // Attach plus button listener (+1 minute, only when not minimized)
        const plusBtn = document.getElementById('rest-timer-plus-btn');
        plusBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.adjustRestTimer(60);
        });
        plusBtn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustRestTimer(60);
        });
    }

    toggleRestTimerSize() {
        const timerEl = document.getElementById('rest-timer');
        if (!timerEl) return;
        
        const isCurrentlyMinimized = timerEl.dataset.minimized === 'true';
        timerEl.dataset.minimized = isCurrentlyMinimized ? 'false' : 'true';
        
        // Re-render with current remaining time
        const displayEl = document.getElementById('rest-timer-display');
        const currentTimeText = displayEl?.textContent || '0:00';
        const parts = currentTimeText.split(':');
        const currentSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        
        this.showRestTimer(currentSeconds);
    }

    makeDraggable(element) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        
        // Initialize offsets from element's current position
        const rect = element.getBoundingClientRect();
        let xOffset = rect.left;
        let yOffset = rect.top;

        const onMouseDown = (e) => {
            // Don't drag when clicking any button
            if (e.target.closest('button')) return;
            
            // Get current position from the element BEFORE clearing transform
            const rect = element.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
            // Clear transform centering and set explicit pixel position
            element.style.transform = 'none';
            element.style.left = xOffset + 'px';
            element.style.top = yOffset + 'px';
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            e.preventDefault(); // Prevent text selection and default drag behavior
        };

        const onMouseMove = (e) => {
            if (isDragging) {
                e.preventDefault(); // Prevent default behavior that drags the page
                e.stopPropagation(); // Stop event from bubbling
                
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                // Keep within viewport bounds
                const rect = element.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                element.style.left = currentX + 'px';
                element.style.top = currentY + 'px';
                
                xOffset = currentX;
                yOffset = currentY;
            }
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        element.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Touch support for mobile
        const onTouchStart = (e) => {
            // Don't drag when touching any button
            if (e.target.closest('button')) return;
            
            // Get current position from the element BEFORE clearing transform
            const rect = element.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
            // Clear transform centering and set explicit pixel position
            element.style.transform = 'none';
            element.style.left = xOffset + 'px';
            element.style.top = yOffset + 'px';
            
            const touch = e.touches[0];
            initialX = touch.clientX - xOffset;
            initialY = touch.clientY - yOffset;
            isDragging = true;
            e.preventDefault();
        };

        const onTouchMove = (e) => {
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
                
                const touch = e.touches[0];
                currentX = touch.clientX - initialX;
                currentY = touch.clientY - initialY;

                const rect = element.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                element.style.left = currentX + 'px';
                element.style.top = currentY + 'px';
                
                xOffset = currentX;
                yOffset = currentY;
            }
        };

        const onTouchEnd = () => {
            isDragging = false;
        };

        element.addEventListener('touchstart', onTouchStart, { passive: false });
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    updateRestTimerDisplay(seconds) {
        const display = document.getElementById('rest-timer-display');
        if (display) {
            display.textContent = this.formatTime(seconds);
            
            // Change color when time is running out
            const timerEl = document.getElementById('rest-timer');
            if (timerEl) {
                if (seconds === 0) {
                    timerEl.style.background = '#4caf50'; // Success color
                } else if (seconds <= 10) {
                    timerEl.style.background = '#ff9800'; // Warning color
                } else {
                    timerEl.style.background = 'var(--primary-color)'; // Normal color
                }
            }
        }
    }

    hideRestTimer() {
        const timerEl = document.getElementById('rest-timer');
        if (timerEl) {
            timerEl.remove();
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    playRestCompleteSound() {
        // Create a simple beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Could not play sound:', error);
        }
    }

    async getLastSessionWeight(exerciseId) {
        try {
            // Get sessions from the last 90 days
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const sessionsResponse = await api.getSessions(startDate, endDate, { showLoader: false });
            
            // Check if we got data successfully
            if (!sessionsResponse.success || !sessionsResponse.data) {
                return '';
            }
            
            // Filter sessions for the same program (excluding current session)
            const previousSessions = sessionsResponse.data
                .filter(s => s.programId === this.program.id && s.id !== this.session.id)
                .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            
            // Look through previous sessions to find the exercise
            for (const session of previousSessions) {
                const sets = session.sets?.filter(s => s.exerciseId === exerciseId);
                if (sets && sets.length > 0) {
                    // Return the weight from the last set of that exercise
                    return sets[sets.length - 1].weight;
                }
            }
            
            return '';
        } catch (error) {
            console.warn('Could not fetch last session weight:', error);
            return '';
        }
    }

    async fetchDefaultWeightForNewSet(currentProgramExercise, exerciseSets) {
        // Filter out warmup sets for determining default weight
        const workingSets = exerciseSets.filter(s => !s.isWarmup);
        
        // Determine default weight priority:
        // 1. Last working set's weight from current session (during workout)
        // 2. Program's target weight (from program defaults only)
        // 3. Empty (user must enter)
        if (workingSets.length > 0) {
            // Use the last working set's weight from current session
            this.defaultWeightForNewSet = workingSets[workingSets.length - 1].weight;
        } else if (currentProgramExercise.targetWeight) {
            // Use program's target weight as fallback
            this.defaultWeightForNewSet = currentProgramExercise.targetWeight;
        } else {
            // No default - user must enter weight
            this.defaultWeightForNewSet = '';
        }
    }

    formatDescription(description) {
        if (!description) return '';

        // Split description into sections (Setup, Technique, Hints, Warnings)
        const sections = {
            'Setup:': 'setup',
            'Technique:': 'technique',
            'Hints:': 'hints',
            'Warnings:': 'warnings'
        };

        let formatted = description;
        Object.keys(sections).forEach(keyword => {
            const className = sections[keyword];
            formatted = formatted.replace(
                new RegExp(`(${keyword})`, 'g'),
                `<strong style="color: ${this.getDescriptionColor(className)};">$1</strong>`
            );
        });

        return formatted;
    }

    getDescriptionColor(className) {
        const colors = {
            'setup': '#1976d2',
            'technique': '#388e3c',
            'hints': '#f57c00',
            'warnings': '#d32f2f'
        };
        return colors[className] || 'inherit';
    }

    showExerciseDetailsOverlay(exercise) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'exercise-details-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.2s ease-in-out;
        `;

        const content = `
            <div class="card" style="max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; margin: 0; animation: slideUp 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">Exercise Details</div>
                    <button class="btn btn-secondary" id="close-overlay-btn" style="padding: 8px 16px;">✕</button>
                </div>

                <div style="margin-bottom: 24px;">
                    <h2 style="margin-bottom: 12px;">${exercise.name}</h2>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
                        ${exercise.muscleGroup ? `
                            <span style="background: #e3f2fd; color: #1976d2; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                                ${exercise.muscleGroup}
                            </span>
                        ` : ''}
                        ${exercise.equipmentType ? `
                            <span style="background: #f3e5f5; color: #7b1fa2; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                                ${exercise.equipmentType}
                            </span>
                        ` : ''}
                        ${exercise.category ? `
                            <span style="background: #fff3e0; color: #f57c00; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                                ${exercise.category}
                            </span>
                        ` : ''}
                    </div>
                </div>

                ${exercise.description ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 8px; color: var(--text-secondary);">Description</h4>
                        <div style="line-height: 1.6; white-space: pre-wrap;">${this.formatDescription(exercise.description)}</div>
                    </div>
                ` : ''}

                ${exercise.instructions ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 8px; color: var(--text-secondary);">Instructions</h4>
                        <div style="line-height: 1.8; white-space: pre-wrap;">${this.formatDescription(exercise.instructions)}</div>
                    </div>
                ` : ''}

                ${exercise.targetMuscles && exercise.targetMuscles.length > 0 ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 8px; color: var(--text-secondary);">Target Muscles</h4>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${exercise.targetMuscles.map(muscle => `
                                <span style="background: var(--surface); padding: 4px 12px; border-radius: 4px; font-size: 13px;">
                                    ${muscle}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${exercise.videoUrl ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 8px; color: var(--text-secondary);">Video Tutorial</h4>
                        <a href="${exercise.videoUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
                            📹 Watch Video
                        </a>
                    </div>
                ` : ''}

                ${exercise.tips ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin-bottom: 8px; color: var(--text-secondary);">Tips</h4>
                        <div style="background: var(--primary-hover); border-left: 4px solid var(--primary-color); padding: 12px; border-radius: 4px;">
                            <div style="line-height: 1.6; white-space: pre-wrap;">${exercise.tips}</div>
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 24px;">
                    <button class="btn btn-primary" id="close-overlay-bottom-btn" style="width: 100%;">Close</button>
                </div>
            </div>
        `;

        overlay.innerHTML = content;
        document.body.appendChild(overlay);

        // Add fade in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Close handlers
        const closeOverlay = () => {
            overlay.style.animation = 'fadeOut 0.2s ease-in-out';
            setTimeout(() => {
                overlay.remove();
                style.remove();
            }, 200);
        };

        document.getElementById('close-overlay-btn')?.addEventListener('click', closeOverlay);
        document.getElementById('close-overlay-bottom-btn')?.addEventListener('click', closeOverlay);
        
        // Close on background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeOverlay();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeOverlay();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Add fadeOut animation
        style.textContent += `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
    }
}
