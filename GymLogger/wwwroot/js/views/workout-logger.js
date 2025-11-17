import { api } from '../utils/api-client.js?v=00000000000000';
import { eventBus } from '../utils/event-bus.js?v=00000000000000';
import { formatDate } from '../utils/date-formatter.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';
import { offlineManager } from '../utils/offline-manager.js?v=00000000000000';
import { offlineStorage } from '../utils/offline-storage.js?v=00000000000000';

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
    }

    async render(programId = null) {
        this.programId = programId;
        this.container.innerHTML = '<div class="card"><p>Loading workout...</p></div>';

        // Load user preferences
        const prefsRes = await api.getPreferences({ showLoader: false });
        this.preferences = prefsRes.data;
        const weightUnit = this.preferences?.defaultWeightUnit || 'KG';
        
        // If a specific program is requested, clean up any active session first
        if (programId) {
            const activeSessionRes = await api.getActiveSession({ showLoader: false });
            if (activeSessionRes.success && activeSessionRes.data) {
                await api.cleanupSession(activeSessionRes.data.id);
            }
            // Start new session with specific program
            await this.startNewSession(programId);
        } else {
            // Check for active session
            const activeSessionRes = await api.getActiveSession({ showLoader: false });
            
            if (activeSessionRes.success && activeSessionRes.data) {
                // Try to resume existing session
                const loadSuccess = await this.loadSession(activeSessionRes.data);
                if (!loadSuccess) {
                    // Session program is missing, clean up and show selector
                    if (confirm('Your previous workout program is no longer available. Start a new workout?')) {
                        await api.cleanupSession(activeSessionRes.data.id);
                        await this.showProgramSelector();
                        return;
                    } else {
                        eventBus.emit('navigate', 'dashboard');
                        return;
                    }
                }
            } else {
                // No active session and no program specified - show program selector
                await this.showProgramSelector();
                return;
            }
        }

        this.renderWorkout();
    }

    async showProgramSelector() {
        const programsRes = await api.getPrograms(null, { showLoader: false });
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

    async loadSession(session) {
        this.session = session;
        
        if (!session.programId) {
            console.error('Session missing programId:', session);
            return false; // Signal failure to caller
        }
        
        const programRes = await api.getProgram(session.programId, { showLoader: false });
        if (!programRes.success || !programRes.data) {
            console.error('Failed to load program:', programRes.error);
            return false; // Signal failure to caller
        }
        this.program = programRes.data;
        
        // Check for draft workout data first
        const draftWorkout = await offlineStorage.getDraftWorkout(session.id);
        if (draftWorkout && draftWorkout.sets) {
            this.sets = draftWorkout.sets;
            notification.info('Restored unsaved workout data');
        } else {
            const setsRes = await api.getSetsForSession(session.id, { showLoader: false });
            this.sets = setsRes.data;
        }
        
        // Always recalculate current exercise based on completed sets
        // Use saved index from draft if it exists and seems reasonable, otherwise auto-determine
        const savedIndex = draftWorkout?.currentExerciseIndex;
        if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < this.program.exercises.length) {
            this.currentExerciseIndex = savedIndex;
        } else {
            this.currentExerciseIndex = this.determineCurrentExercise();
        }
        
        const exercisesRes = await api.getExercises({ showLoader: false });
        this.exercises = exercisesRes.data;
        
        return true; // Successfully loaded
    }

    async startNewSession(programId) {
        const programRes = await api.getProgram(programId, { showLoader: false });
        this.program = programRes.data;
        
        const exercisesRes = await api.getExercises({ showLoader: false });
        this.exercises = exercisesRes.data;
        
        // Create new session matching backend WorkoutSession model
        const newSession = {
            programId: programId,
            programName: this.program.name,
            sessionDate: new Date().toISOString().split('T')[0],
            status: 'in-progress'
        };

        const sessionRes = await api.createSession(newSession);
        this.session = sessionRes.data;
        this.sets = [];
        this.currentExerciseIndex = 0;
        
        // Save initial draft workout so it persists if browser refreshes
        await this.saveDraftWorkout();
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
            this.container.innerHTML = '<div class="card"><p>No exercises in this program</p></div>';
            return;
        }
        
        // Ensure index is within valid range
        this.currentExerciseIndex = Math.max(0, Math.min(this.currentExerciseIndex, this.program.exercises.length - 1));
        
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

        // Complete workout button
        document.getElementById('complete-workout-btn')?.addEventListener('click', async () => {
            await this.completeWorkout();
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
        
        const newSet = {
            exerciseId: currentProgramExercise.exerciseId,
            setNumber: this.sets.filter(s => s.exerciseId === currentProgramExercise.exerciseId).length + 1,
            weight: weight,
            reps: reps,
            isWarmup: isWarmup,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await api.addSet(this.session.id, newSet);
            if (response.success) {
                this.sets.push(response.data);
            }
            
            // Auto-save draft workout
            await this.saveDraftWorkout();
            
            // Notify user if set was queued offline
            if (response.source === 'queued') {
                notification.info('Set saved offline. Will sync when connection is restored.');
            }
            
            // Save the weight for next set
            const previousWeight = weight;
            
            // Clear reps input
            repsInput.value = '';
            
            // Re-render to show the new set
            this.renderWorkout();
            
            // Start rest timer after adding a set
            this.startRestTimer();
            
            // After render, set the weight and focus reps
            setTimeout(() => {
                const newWeightInput = document.querySelector('.new-set-weight');
                const newRepsInput = document.querySelector('.new-set-reps');
                
                if (newWeightInput && newRepsInput) {
                    newWeightInput.value = previousWeight;
                    newRepsInput.focus();
                }
            }, 50);
        } catch (error) {
            console.error('Error adding set:', error);
            notification.error('Failed to add set: ' + error.message);
        }
    }

    async updateSetValue(setId) {
        const weightInput = document.querySelector(`.set-weight[data-set-id="${setId}"]`);
        const repsInput = document.querySelector(`.set-reps[data-set-id="${setId}"]`);

        const set = this.sets.find(s => s.id === setId);
        if (!set) return;

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
            // First, check if integration is configured and enabled
            const integrationEnabled = this.preferences?.outboundIntegrationEnabled;
            const integrationUrl = this.preferences?.outboundIntegrationUrl;
            
            if (integrationEnabled && integrationUrl) {
                // Submit to integration endpoint first
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
            
            // Stop rest timer
            this.stopRestTimer();
            
            const response = await api.updateSession(this.session.id, this.session);
            
            if (response.success) {
                // Clear draft workout since we're completing
                await offlineStorage.deleteDraftWorkout(this.session.id);
                
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

    async cancelWorkout() {
        // Check if online first - canceling workout requires internet connection
        if (!navigator.onLine) {
            notification.warning('Cannot cancel workout while offline. Your workout data is saved locally. Please connect to the internet to cancel.');
            return;
        }
        
        try {
            // Delete the session (removes the workout completely)
            await api.deleteSession(this.session.id);
            
            // Clear draft workout after successful deletion
            await offlineStorage.deleteDraftWorkout(this.session.id);
            
            this.stopRestTimer();
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
        this.restTimerStartTime = Date.now();
        const endTime = this.restTimerStartTime + (restDuration * 1000);
        
        // Create or update timer display
        this.showRestTimer(restDuration);
        
        // Update timer every second
        this.restTimerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            
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

    showRestTimer(duration) {
        // Check if timer already exists
        let timerEl = document.getElementById('rest-timer');
        
        if (!timerEl) {
            timerEl = document.createElement('div');
            timerEl.id = 'rest-timer';
            
            // Position at top-center initially
            const centerX = (window.innerWidth - 200) / 2;
            const topY = 80; // Below header
            
            timerEl.style.cssText = `
                position: fixed;
                left: ${centerX}px;
                top: ${topY}px;
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
        }
        
        timerEl.innerHTML = `
            <div style="font-size: 14px; font-weight: 500; opacity: 0.9;">Rest Timer</div>
            <div id="rest-timer-display" style="font-size: 48px; font-weight: 700; line-height: 1;">${this.formatTime(duration)}</div>
            <button id="skip-rest-btn" style="
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                margin-top: 4px;
                transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">Skip</button>
        `;
        
        // Attach skip button listener
        document.getElementById('skip-rest-btn')?.addEventListener('click', () => {
            this.stopRestTimer();
        });
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
            // Don't drag when clicking the skip button
            if (e.target.id === 'skip-rest-btn') return;
            
            // Get current position from the element
            const rect = element.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
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
            if (e.target.id === 'skip-rest-btn') return;
            
            // Get current position from the element
            const rect = element.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
            
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
            if (seconds <= 10 && timerEl) {
                timerEl.style.background = '#ff9800'; // Warning color
            }
            if (seconds === 0 && timerEl) {
                timerEl.style.background = '#4caf50'; // Success color
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
        
        // Determine default weight: last working set, program target, or last session
        if (workingSets.length > 0) {
            // Use the last working set's weight from current session
            this.defaultWeightForNewSet = workingSets[workingSets.length - 1].weight;
        } else if (currentProgramExercise.targetWeight) {
            // Use program's target weight
            this.defaultWeightForNewSet = currentProgramExercise.targetWeight;
        } else {
            // If no program weight, try to get from last session
            this.defaultWeightForNewSet = await this.getLastSessionWeight(currentProgramExercise.exerciseId);
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
