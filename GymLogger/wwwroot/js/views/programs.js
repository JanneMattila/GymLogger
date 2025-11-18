import { api } from '../utils/api-client.js?v=00000000000000';
import { eventBus } from '../utils/event-bus.js?v=00000000000000';
import { getDayName } from '../utils/date-formatter.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';

const DROPDOWN_MENU_STYLE = 'position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 25px var(--shadow); min-width: 180px; z-index: 20; padding: 4px 0; display: none;';
const DROPDOWN_ITEM_STYLE = 'display: block; width: 100%; text-align: left; background: transparent; border: none; padding: 10px 16px; font-size: 14px; cursor: pointer; color: var(--text-primary); transition: background 0.2s ease, color 0.2s ease;';
const DROPDOWN_ITEM_DANGER_STYLE = `${DROPDOWN_ITEM_STYLE} color: var(--danger-color);`;

export class ProgramsView {
    constructor() {
        this.container = document.getElementById('main');
        this.programs = [];
        this.templates = [];
        this.exercises = [];
        this.preferences = null;
        this.editingProgramId = null;
        this.boundDropdownCloseHandler = (event) => {
            if (!event.target.closest('.simple-dropdown')) {
                this.closeAllDropdowns();
            }
        };
    }

    async render() {
        this.container.innerHTML = '<div class="card"><p>Loading programs...</p></div>';

        const [programsRes, templatesRes, exercisesRes, prefsRes] = await Promise.all([
            api.getPrograms(),
            api.getTemplates(),
            api.getExercises(),
            api.getPreferences()
        ]);

        this.programs = programsRes.data;
        this.templates = templatesRes.data;
        this.exercises = exercisesRes.data;
        this.preferences = prefsRes.data;

        // Check if any critical data failed to load
        if (!programsRes.success || !exercisesRes.success) {
            this.container.innerHTML = `
                <div class="card">
                    <p style="color: var(--danger-color);">Error loading programs: ${programsRes.error || exercisesRes.error || 'Unknown error'}</p>
                </div>
            `;
            return;
        }

        this.renderProgramsList();
    }

    renderProgramsList() {
        const programsByDay = {};
        this.programs.forEach(program => {
            const day = program.dayOfWeek !== null ? program.dayOfWeek : 'unscheduled';
            if (!programsByDay[day]) programsByDay[day] = [];
            programsByDay[day].push(program);
        });

        const isOffline = !navigator.onLine;

        let content = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">My Programs</div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <div class="simple-dropdown" style="position: relative;">
                            <button type="button" class="btn btn-secondary" id="programs-actions-btn" data-dropdown-toggle="programs-actions-menu" aria-label="Program actions" style="padding: 8px 12px; min-height: 36px;">...</button>
                            <div class="simple-dropdown-menu" id="programs-actions-menu" data-open="false" style="${DROPDOWN_MENU_STYLE}">
                                <button type="button" class="simple-dropdown-item" id="import-programs-btn" ${isOffline ? 'disabled' : ''} style="${DROPDOWN_ITEM_STYLE}">📥 Import</button>
                                <button type="button" class="simple-dropdown-item" id="export-programs-btn" ${isOffline || this.programs.length === 0 ? 'disabled' : ''} style="${DROPDOWN_ITEM_STYLE}">📤 Export</button>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="create-program-btn" ${isOffline ? 'disabled' : ''}>+ Create Program</button>
                    </div>
                </div>
                ${isOffline ? `
                    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 8px; margin-bottom: 16px; color: #856404;">
                        ⚠️ You are offline. Creating, editing, and deleting programs requires an online connection.
                    </div>
                ` : ''}
        `;

        if (this.programs.length === 0) {
            content += `
                <div style="text-align: center; padding: 40px 20px;">
                    <p style="font-size: 48px; margin-bottom: 16px;">📋</p>
                    <h3 style="margin-bottom: 8px;">No Programs Yet</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Create your first workout program to get started
                    </p>
                    <button class="btn btn-primary" id="create-program-btn-center" ${isOffline ? 'disabled' : ''}>Create Your First Program</button>
                </div>
            `;
        } else {
            // Show programs grouped by day, starting from user's preferred week start day
            const weekStartDay = this.preferences?.weekStartDay || 0;
            const visibleDays = this.preferences?.visibleDays || [0, 1, 2, 3, 4, 5, 6];
            
            // Display days in order based on user's week start preference
            for (let i = 0; i < 7; i++) {
                const day = (weekStartDay + i) % 7;
                
                // Skip days that are not visible in user preferences
                if (!visibleDays.includes(day)) {
                    continue;
                }
                
                const dayPrograms = programsByDay[day] || [];
                
                // Always show the day header even if no programs, but only for visible days
                content += `
                    <div style="margin-bottom: 24px;">
                        <h3 style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px; text-transform: uppercase;">
                            ${getDayName(day)}
                        </h3>
                `;
                
                if (dayPrograms.length > 0) {
                    content += dayPrograms.map(program => this.renderProgramCard(program)).join('');
                } else {
                    content += `
                        <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">
                            No programs scheduled
                        </div>
                    `;
                }
                
                content += `</div>`;
            }

            // Unscheduled programs always at the end
            const unscheduled = programsByDay['unscheduled'] || [];
            if (unscheduled.length > 0) {
                content += `
                    <div style="margin-bottom: 24px;">
                        <h3 style="margin-bottom: 12px; color: var(--text-secondary); font-size: 14px; text-transform: uppercase;">
                            Unscheduled
                        </h3>
                        ${unscheduled.map(program => this.renderProgramCard(program)).join('')}
                    </div>
                `;
            }
        }

        content += '</div>';
        this.container.innerHTML = content;
        this.attachListeners();
    }

    renderProgramCard(program) {
        const isOffline = !navigator.onLine;
        const createdAt = program.createdAt ? new Date(program.createdAt) : null;
        const lastUsedDate = program.lastUsedDate ? new Date(program.lastUsedDate) : null;
        const hasUsageHistory = lastUsedDate && (!createdAt || lastUsedDate.getTime() !== createdAt.getTime());
        const lastUsedText = hasUsageHistory ? lastUsedDate.toLocaleDateString() : 'never';
        const programActionsMenuId = `program-actions-${program.id}`;

        return `
            <div class="card" style="margin-bottom: 12px; cursor: pointer;" data-program-id="${program.id}" data-action="edit-card">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <h3 style="margin: 0;">${program.name}</h3>
                            ${program.isDefault ? '<span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">DEFAULT</span>' : ''}
                        </div>
                        <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">
                            ${program.exercises.length} exercise${program.exercises.length !== 1 ? 's' : ''}
                        </p>
                        <p style="color: var(--text-secondary); font-size: 12px;">
                            Last used: ${lastUsedText}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <button class="btn btn-secondary" data-action="edit" data-program-id="${program.id}" style="padding: 8px 12px; min-height: 36px;" ${isOffline ? 'disabled' : ''}>
                            ✏️ Edit
                        </button>
                        <div class="simple-dropdown" style="position: relative;">
                            <button type="button" class="btn btn-secondary" data-dropdown-toggle="${programActionsMenuId}" aria-label="Program options" style="padding: 8px 12px; min-height: 36px;" ${isOffline ? 'disabled' : ''}>...</button>
                            <div class="simple-dropdown-menu" id="${programActionsMenuId}" data-open="false" style="${DROPDOWN_MENU_STYLE}">
                                <button type="button" class="simple-dropdown-item" data-action="export-single" data-program-id="${program.id}" ${isOffline ? 'disabled' : ''} style="${DROPDOWN_ITEM_STYLE}">📤 Export</button>
                                <button type="button" class="simple-dropdown-item" data-action="delete" data-program-id="${program.id}" ${isOffline ? 'disabled' : ''} style="${DROPDOWN_ITEM_DANGER_STYLE}">🗑️ Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachListeners() {
        this.closeAllDropdowns();
        document.getElementById('create-program-btn')?.addEventListener('click', () => {
            if (!navigator.onLine) {
                notification.warning('You are offline. Creating programs requires an online connection.');
                return;
            }
            this.showProgramEditor();
        });

        document.getElementById('create-program-btn-center')?.addEventListener('click', () => {
            if (!navigator.onLine) {
                notification.warning('You are offline. Creating programs requires an online connection.');
                return;
            }
            this.showProgramEditor();
        });

        document.getElementById('export-programs-btn')?.addEventListener('click', async () => {
            this.closeAllDropdowns();
            await this.exportAllPrograms();
        });

        document.getElementById('import-programs-btn')?.addEventListener('click', () => {
            this.closeAllDropdowns();
            this.showImportDialog();
        });

        // Export single program buttons
        document.querySelectorAll('[data-action="export-single"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.closeAllDropdowns();
                const programId = btn.dataset.programId;
                await this.exportSingleProgram(programId);
            });
        });

        // Click on entire program card to edit
        document.querySelectorAll('[data-action="edit-card"]').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on a button
                if (e.target.closest('button')) return;
                if (!navigator.onLine) {
                    notification.warning('You are offline. Editing programs requires an online connection.');
                    return;
                }
                const programId = card.dataset.programId;
                this.closeAllDropdowns();
                this.showProgramEditor(programId);
            });
        });

        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeAllDropdowns();
                if (!navigator.onLine) {
                    notification.warning('You are offline. Editing programs requires an online connection.');
                    return;
                }
                const programId = btn.dataset.programId;
                this.showProgramEditor(programId);
            });
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.closeAllDropdowns();
                if (!navigator.onLine) {
                    notification.warning('You are offline. Deleting programs requires an online connection.');
                    return;
                }
                const programId = btn.dataset.programId;
                const program = this.programs.find(p => p.id === programId);
                if (confirm(`Delete program "${program?.name}"?`)) {
                    await this.deleteProgram(programId);
                }
            });
        });

        this.initializeDropdowns();
    }

    initializeDropdowns() {
        const dropdownButtons = document.querySelectorAll('[data-dropdown-toggle]');
        dropdownButtons.forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (btn.disabled) return;
                this.toggleDropdown(btn.dataset.dropdownToggle);
            });
        });

        if (this.boundDropdownCloseHandler) {
            document.removeEventListener('click', this.boundDropdownCloseHandler);
            document.addEventListener('click', this.boundDropdownCloseHandler);
        }
    }

    toggleDropdown(menuId) {
        if (!menuId) return;
        const menu = document.getElementById(menuId);
        if (!menu) return;
        const isOpen = menu.getAttribute('data-open') === 'true';
        this.closeAllDropdowns();
        if (!isOpen) {
            menu.style.display = 'block';
            menu.setAttribute('data-open', 'true');
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.simple-dropdown-menu').forEach(menu => {
            if (menu.getAttribute('data-open') === 'true') {
                menu.style.display = 'none';
                menu.setAttribute('data-open', 'false');
            }
        });
    }

    showProgramEditor(programId = null) {
        this.closeAllDropdowns();
        const program = programId ? this.programs.find(p => p.id === programId) : null;
        const isEdit = !!program;

        let content = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">${isEdit ? 'Edit' : 'Create'} Program</div>
                    <div style="display: flex; gap: 8px;">
                        ${isEdit ? `<button type="button" class="btn btn-secondary" id="export-this-program-btn" ${!navigator.onLine ? 'disabled' : ''}>📤 Export</button>` : ''}
                        <button class="btn btn-secondary" id="back-to-programs-btn">← Back</button>
                    </div>
                </div>

                <form id="program-form">
                    <div class="form-group">
                        <label class="form-label">Program Name *</label>
                        <input type="text" class="form-input" id="program-name" 
                               value="${program?.name || ''}" placeholder="e.g., Monday - Chest & Triceps" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Day of Week</label>
                        <select class="form-input" id="program-day">
                            <option value="">Unscheduled</option>
                            ${[0,1,2,3,4,5,6].map(day => `
                                <option value="${day}" ${program?.dayOfWeek === day ? 'selected' : ''}>
                                    ${getDayName(day)}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="program-default" ${program?.isDefault ? 'checked' : ''}>
                            <span>Set as default for this day</span>
                        </label>
                    </div>

                    ${!isEdit ? `
                        <div class="form-group">
                            <label class="form-label">Start from Template (Optional)</label>
                            <select class="form-input" id="program-template">
                                <option value="">-- Blank Program --</option>
                                ${this.templates.map(template => `
                                    <option value="${template.name}">${template.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <div style="border-top: 1px solid var(--border); margin: 24px 0; padding-top: 24px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="margin: 0;">Exercises</h3>
                            <button type="button" class="btn btn-primary" id="add-exercise-btn">+ Add Exercise</button>
                        </div>

                        <div id="exercises-list">
                            ${isEdit && program.exercises.length > 0 ? 
                                program.exercises.map((ex, idx) => this.renderExerciseRow(ex, idx)).join('') :
                                '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No exercises added yet</p>'
                            }
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="cancel-program-btn">Cancel</button>
                        <button type="submit" class="btn btn-success">💾 Save Program</button>
                    </div>
                </form>
            </div>
        `;

        this.container.innerHTML = content;
        this.attachEditorListeners(programId);
    }

    renderExerciseRow(exercise, index) {
        const exerciseData = this.exercises.find(e => e.id === exercise.exerciseId);
        const selectedExerciseName = exerciseData ? exerciseData.name : '';
        
        return `
            <div class="card" style="margin-bottom: 12px;" data-exercise-index="${index}">
                <div style="display: flex; gap: 12px; align-items: start;">
                    <div draggable="true" class="drag-handle" style="cursor: grab; padding: 8px; color: var(--text-secondary); user-select: none;">
                        ⋮⋮
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; position: relative;">
                                <label style="font-size: 12px; color: var(--text-secondary);">Exercise</label>
                                <div class="exercise-dropdown-wrapper" style="position: relative;">
                                    <input 
                                        type="text" 
                                        class="form-input exercise-search" 
                                        data-index="${index}" 
                                        value="${selectedExerciseName}"
                                        placeholder="Type to search exercises..."
                                        style="margin-top: 4px;"
                                        data-exercise-id="${exercise.exerciseId}"
                                        autocomplete="off">
                                    <div class="exercise-dropdown" data-index="${index}" style="display: none;">
                                        ${this.exercises
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map(ex => `
                                            <div class="exercise-option" data-exercise-name="${ex.name}" data-exercise-id="${ex.id}">
                                                ${ex.name}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            <div style="width: 80px;">
                                <label style="font-size: 12px; color: var(--text-secondary);">Sets</label>
                                <input type="number" class="form-input exercise-sets" data-index="${index}" 
                                       value="${exercise.sets || 3}" min="1" max="10" style="margin-top: 4px;">
                            </div>
                            <div style="width: 100px;">
                                <label style="font-size: 12px; color: var(--text-secondary);">Reps</label>
                                <input type="text" class="form-input exercise-reps" data-index="${index}" 
                                       value="${exercise.repsMin && exercise.repsMax ? (exercise.repsMin === exercise.repsMax ? exercise.repsMin : exercise.repsMin + '-' + exercise.repsMax) : '8-12'}" placeholder="8-12" style="margin-top: 4px;">
                            </div>
                            <div style="width: 100px;">
                                <label style="font-size: 12px; color: var(--text-secondary);">Weight (kg)</label>
                                <input type="number" class="form-input exercise-weight" data-index="${index}" 
                                       value="${exercise.targetWeight || exercise.weight || ''}" min="0" step="any" placeholder="Optional" style="margin-top: 4px;">
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-danger" data-action="remove-exercise" data-index="${index}" 
                            style="padding: 8px 12px; min-height: 36px; align-self: flex-end; margin-bottom: 8px;">🗑️</button>
                </div>
            </div>
        `;
    }

    attachEditorListeners(programId) {
        document.getElementById('back-to-programs-btn')?.addEventListener('click', () => {
            this.render();
        });

        document.getElementById('cancel-program-btn')?.addEventListener('click', () => {
            this.render();
        });

        document.getElementById('export-this-program-btn')?.addEventListener('click', async () => {
            if (programId) {
                await this.exportSingleProgram(programId);
            }
        });

        document.getElementById('add-exercise-btn')?.addEventListener('click', () => {
            this.addExerciseRow();
        });

        document.querySelectorAll('[data-action="remove-exercise"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.removeExerciseRow(index);
            });
        });

        // Attach drag-and-drop listeners
        this.attachExerciseDragListeners();

        const form = document.getElementById('program-form');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProgram(programId);
        });

        // Custom dropdown functionality
        document.querySelectorAll('.exercise-search').forEach(input => {
            const index = input.dataset.index;
            const dropdown = document.querySelector(`.exercise-dropdown[data-index="${index}"]`);
            
            if (!dropdown) return;

            // Show dropdown on focus
            input.addEventListener('focus', () => {
                dropdown.style.display = 'block';
                this.filterExerciseDropdown(input, dropdown);
            });

            // Filter on input
            input.addEventListener('input', () => {
                dropdown.style.display = 'block';
                this.filterExerciseDropdown(input, dropdown);
            });

            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });

            // Select exercise on click
            dropdown.querySelectorAll('.exercise-option').forEach(option => {
                option.addEventListener('click', () => {
                    input.value = option.dataset.exerciseName;
                    input.dataset.exerciseId = option.dataset.exerciseId;
                    dropdown.style.display = 'none';
                });
            });
        });

        // Template selection
        const templateSelect = document.getElementById('program-template');
        templateSelect?.addEventListener('change', (e) => {
            const templateName = e.target.value;
            if (templateName) {
                this.loadTemplate(templateName);
            }
        });
    }

    filterExerciseDropdown(input, dropdown) {
        const searchTerm = input.value.toLowerCase();
        const options = dropdown.querySelectorAll('.exercise-option');
        
        options.forEach(option => {
            const exerciseName = option.dataset.exerciseName.toLowerCase();
            if (exerciseName.includes(searchTerm)) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    }

    addExerciseRow() {
        const exercisesList = document.getElementById('exercises-list');
        const currentExercises = exercisesList.querySelectorAll('.card');
        const index = currentExercises.length;

        if (currentExercises.length === 1 && currentExercises[0].querySelector('p')) {
            exercisesList.innerHTML = '';
        }

        const newExercise = {
            exerciseId: '',
            order: index,
            sets: 3,
            repsMin: 8,
            repsMax: 12
        };

        exercisesList.insertAdjacentHTML('beforeend', this.renderExerciseRow(newExercise, index));

        // Reattach remove listeners and dropdown listeners
        const newRow = exercisesList.lastElementChild;
        const removeBtn = newRow.querySelector('[data-action="remove-exercise"]');
        removeBtn?.addEventListener('click', () => {
            this.removeExerciseRow(index);
        });

        // Attach dropdown listeners for the new row
        const input = newRow.querySelector('.exercise-search');
        const dropdown = newRow.querySelector('.exercise-dropdown');
        
        if (input && dropdown) {
            input.addEventListener('focus', () => {
                dropdown.style.display = 'block';
                this.filterExerciseDropdown(input, dropdown);
            });

            input.addEventListener('input', () => {
                dropdown.style.display = 'block';
                this.filterExerciseDropdown(input, dropdown);
            });

            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });

            dropdown.querySelectorAll('.exercise-option').forEach(option => {
                option.addEventListener('click', () => {
                    input.value = option.dataset.exerciseName;
                    input.dataset.exerciseId = option.dataset.exerciseId;
                    dropdown.style.display = 'none';
                });
            });
        }

        // Reattach drag listeners
        this.attachExerciseDragListeners();
    }

    removeExerciseRow(index) {
        const exercisesList = document.getElementById('exercises-list');
        const row = exercisesList.querySelector(`[data-exercise-index="${index}"]`);
        row?.remove();

        // If no exercises left, show placeholder
        if (exercisesList.children.length === 0) {
            exercisesList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No exercises added yet</p>';
        }
    }

    loadTemplate(templateName) {
        const template = this.templates.find(t => t.name === templateName);
        if (!template) return;

        const exercisesList = document.getElementById('exercises-list');
        exercisesList.innerHTML = '';

        template.exercises.forEach((templateEx, index) => {
            // Find matching exercise in our library
            const exercise = this.exercises.find(e => 
                e.name.toLowerCase() === templateEx.name.toLowerCase()
            );

            if (exercise) {
                // Parse targetReps from template (e.g., "8-12" or "10")
                let repsMin, repsMax;
                const repsValue = templateEx.targetReps || '8-12';
                if (repsValue.includes('-')) {
                    const parts = repsValue.split('-').map(s => parseInt(s.trim()));
                    repsMin = parts[0];
                    repsMax = parts[1] || parts[0];
                } else if (repsValue === 'max') {
                    repsMin = repsMax = 20; // Use 20 as default for "max"
                } else {
                    repsMin = repsMax = parseInt(repsValue);
                }

                const programExercise = {
                    exerciseId: exercise.id,
                    exerciseName: exercise.name,
                    order: index,
                    sets: templateEx.targetSets,
                    repsMin: repsMin,
                    repsMax: repsMax,
                    restSeconds: templateEx.restSeconds
                };

                exercisesList.insertAdjacentHTML('beforeend', this.renderExerciseRow(programExercise, index));
            }
        });

        // Reattach remove listeners
        document.querySelectorAll('[data-action="remove-exercise"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.removeExerciseRow(index);
            });
        });

        // Set program name from template if empty
        const nameInput = document.getElementById('program-name');
        if (nameInput && !nameInput.value) {
            nameInput.value = template.name;
        }

        // Reattach drag listeners after loading template
        this.attachExerciseDragListeners();
    }

    attachExerciseDragListeners() {
        const exercisesList = document.getElementById('exercises-list');
        if (!exercisesList) return;

        let draggedCard = null;
        const cards = exercisesList.querySelectorAll('[data-exercise-index]');

        cards.forEach(card => {
            const dragHandle = card.querySelector('.drag-handle');
            if (!dragHandle) return;

            // Prevent text selection on drag handle
            dragHandle.addEventListener('mousedown', (e) => {
                dragHandle.style.cursor = 'grabbing';
            });

            dragHandle.addEventListener('mouseup', () => {
                dragHandle.style.cursor = 'grab';
            });

            dragHandle.addEventListener('dragstart', (e) => {
                draggedCard = card;
                card.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.exerciseIndex);
            });

            dragHandle.addEventListener('dragend', () => {
                card.style.opacity = '1';
                dragHandle.style.cursor = 'grab';
                draggedCard = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedCard && draggedCard !== card) {
                    const allCards = Array.from(exercisesList.querySelectorAll('[data-exercise-index]'));
                    const draggedIndex = allCards.indexOf(draggedCard);
                    const targetIndex = allCards.indexOf(card);

                    if (draggedIndex < targetIndex) {
                        card.parentNode.insertBefore(draggedCard, card.nextSibling);
                    } else {
                        card.parentNode.insertBefore(draggedCard, card);
                    }
                }
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                // Update data-exercise-index attributes to reflect new order
                const allCards = Array.from(exercisesList.querySelectorAll('[data-exercise-index]'));
                allCards.forEach((c, idx) => {
                    c.dataset.exerciseIndex = idx;
                    // Update all input data-index attributes within the card
                    c.querySelectorAll('[data-index]').forEach(input => {
                        input.dataset.index = idx;
                    });
                });
            });
        });
    }

    async saveProgram(programId) {
        const name = document.getElementById('program-name').value.trim();
        const dayValue = document.getElementById('program-day').value;
        const isDefault = document.getElementById('program-default').checked;

        if (!name) {
            notification.warning('Please enter a program name');
            return;
        }

        // Collect exercises
        const exercises = [];
        const exerciseRows = document.querySelectorAll('[data-exercise-index]');
        
        exerciseRows.forEach((row, index) => {
            const searchInput = row.querySelector('.exercise-search');
            const exerciseName = searchInput.value.trim();
            
            if (!exerciseName) return;
            
            // Find exercise by name
            const exercise = this.exercises.find(ex => ex.name === exerciseName);
            
            if (!exercise) {
                notification.warning(`Exercise not found: ${exerciseName}. Please select from the dropdown.`);
                throw new Error(`Exercise not found: ${exerciseName}`);
            }
            
            const sets = parseInt(row.querySelector('.exercise-sets').value);
            const repsValue = row.querySelector('.exercise-reps').value.trim();
            const weightInput = row.querySelector('.exercise-weight');
            const targetWeight = weightInput && weightInput.value ? parseFloat(weightInput.value) : null;
            const restSeconds = row.querySelector('.exercise-rest')?.value ? parseInt(row.querySelector('.exercise-rest').value) : null;
            const notes = row.querySelector('.exercise-notes')?.value?.trim() || null;

            // Parse reps - support both "8-12" format and single number "10"
            let repsMin, repsMax;
            if (repsValue.includes('-')) {
                const parts = repsValue.split('-').map(s => parseInt(s.trim()));
                repsMin = parts[0];
                repsMax = parts[1] || parts[0];
            } else {
                repsMin = repsMax = parseInt(repsValue);
            }

            exercises.push({
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                order: index,
                sets,
                repsMin,
                repsMax,
                targetWeight,
                restSeconds,
                notes
            });
        });

        const programData = {
            name,
            dayOfWeek: dayValue ? parseInt(dayValue) : null,
            isDefault,
            exercises
        };

        let response;
        if (programId) {
            response = await api.updateProgram(programId, programData);
        } else {
            response = await api.createProgram(programData);
        }

        if (!response.success) {
            notification.error('Error saving program: ' + (response.error || 'Unknown error'));
            return;
        }

        // If marked as default, update it
        if (isDefault && programId) {
            const defaultRes = await api.setDefaultProgram(programId);
            if (!defaultRes.success) {
                notification.error('Error setting default program: ' + (defaultRes.error || 'Unknown error'));
            }
        }

        this.render();
    }

    async deleteProgram(programId) {
        const response = await api.deleteProgram(programId);
        
        if (!response.success) {
            notification.error('Error deleting program: ' + (response.error || 'Unknown error'));
            return;
        }
        
        this.programs = this.programs.filter(p => p.id !== programId);
        this.renderProgramsList();
    }

    async exportAllPrograms() {
        const response = await api.exportAllPrograms();
        
        if (!response.success) {
            notification.error('Error exporting programs: ' + (response.error || 'Unknown error'));
            return;
        }

        this.downloadJSON(response.data, 'gym-logger-programs.json');
        notification.success(`Exported ${response.data.length} program${response.data.length !== 1 ? 's' : ''}`);
    }

    async exportSingleProgram(programId) {
        const response = await api.exportProgram(programId);
        
        if (!response.success) {
            notification.error('Error exporting program: ' + (response.error || 'Unknown error'));
            return;
        }

        const program = this.programs.find(p => p.id === programId);
        const filename = `gym-logger-${program?.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        this.downloadJSON(response.data, filename);
        notification.success('Program exported successfully');
    }

    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    showImportDialog() {
        this.closeAllDropdowns();
        const content = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="card-header" style="margin: 0;">Import Programs</div>
                    <button class="btn btn-secondary" id="back-to-programs-import-btn">← Back</button>
                </div>

                <div style="background: #e3f2fd; border: 1px solid #2196f3; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 8px 0; color: #1976d2;">ℹ️ Import Instructions</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #1565c0;">
                        <li>Select a JSON file containing program data</li>
                        <li>Programs with matching names will be <strong>overridden</strong></li>
                        <li>Programs with new names will be <strong>created</strong></li>
                        <li>The file must contain a JSON array of programs</li>
                    </ul>
                </div>

                <div style="border: 2px dashed var(--border); border-radius: 8px; padding: 40px; text-align: center; background: var(--background-secondary);">
                    <input type="file" id="import-file-input" accept=".json" style="display: none;">
                    <button class="btn btn-primary" id="select-file-btn" style="font-size: 16px; padding: 12px 24px;">
                        📁 Select JSON File
                    </button>
                    <p style="margin-top: 12px; color: var(--text-secondary); font-size: 14px;">
                        or drag and drop a file here
                    </p>
                </div>

                <div id="import-preview" style="margin-top: 20px; display: none;">
                    <h4 style="margin-bottom: 12px;">Preview:</h4>
                    <div id="import-preview-content" style="background: var(--background-secondary); padding: 16px; border-radius: 8px; max-height: 300px; overflow-y: auto;">
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px;">
                        <button class="btn btn-secondary" id="cancel-import-btn">Cancel</button>
                        <button class="btn btn-success" id="confirm-import-btn">✓ Import Programs</button>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = content;

        let fileData = null;

        document.getElementById('back-to-programs-import-btn')?.addEventListener('click', () => {
            this.render();
        });

        document.getElementById('select-file-btn')?.addEventListener('click', () => {
            document.getElementById('import-file-input')?.click();
        });

        document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.previewImport(file);
            }
        });

        document.getElementById('cancel-import-btn')?.addEventListener('click', () => {
            document.getElementById('import-preview').style.display = 'none';
            document.getElementById('import-file-input').value = '';
            fileData = null;
        });

        document.getElementById('confirm-import-btn')?.addEventListener('click', async () => {
            const fileInput = document.getElementById('import-file-input');
            const file = fileInput.files[0];
            if (file) {
                await this.importPrograms(file);
            }
        });

        // Drag and drop
        const dropZone = this.container.querySelector('.card > div:nth-child(3)');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--primary-color)';
                dropZone.style.background = 'var(--primary-light)';
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.style.borderColor = '';
                dropZone.style.background = '';
            });

            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.style.borderColor = '';
                dropZone.style.background = '';
                
                const file = e.dataTransfer.files[0];
                if (file && file.type === 'application/json') {
                    await this.previewImport(file);
                } else {
                    notification.warning('Please drop a valid JSON file');
                }
            });
        }
    }

    async previewImport(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate it's an array
            if (!Array.isArray(data)) {
                notification.error('Invalid file format: Expected a JSON array');
                return;
            }

            // Validate programs structure
            const validPrograms = data.filter(p => p.name && p.exercises);
            if (validPrograms.length === 0) {
                notification.error('No valid programs found in file');
                return;
            }

            // Show preview
            const preview = document.getElementById('import-preview');
            const previewContent = document.getElementById('import-preview-content');
            
            let html = '<ul style="margin: 0; padding-left: 20px;">';
            validPrograms.forEach(program => {
                const existing = this.programs.find(p => p.name.toLowerCase() === program.name.toLowerCase());
                const action = existing ? '🔄 Override' : '➕ Create new';
                html += `<li><strong>${program.name}</strong> (${program.exercises.length} exercises) - ${action}</li>`;
            });
            html += '</ul>';

            previewContent.innerHTML = html;
            preview.style.display = 'block';

        } catch (error) {
            notification.error('Error reading file: ' + error.message);
        }
    }

    async importPrograms(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data)) {
                notification.error('Invalid file format: Expected a JSON array');
                return;
            }

            const response = await api.importPrograms(data);

            if (!response.success) {
                notification.error('Error importing programs: ' + (response.error || 'Unknown error'));
                return;
            }

            const result = response.data;
            notification.success(`Successfully imported ${result.imported} program${result.imported !== 1 ? 's' : ''}`);
            
            // Refresh the view
            await this.render();

        } catch (error) {
            notification.error('Error importing programs: ' + error.message);
        }
    }
}
