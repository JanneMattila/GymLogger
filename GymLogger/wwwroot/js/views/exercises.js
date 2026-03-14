import { api } from '../utils/api-client.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export class ExercisesView {
    constructor() {
        this.exercises = [];
        this.filteredExercises = [];
        this.programs = [];
        this.filters = {
            search: '',
            muscleGroup: '',
            equipmentType: ''
        };
        this.expandedCards = new Set();
    }

    async render(container) {
        const targetContainer = container || document.getElementById('main');
        
        targetContainer.innerHTML = `
            <div class="exercises-view">
                <div class="view-header">
                    <h1>Exercise Library</h1>
                    <p class="subtitle" id="exercise-count">Loading exercises...</p>
                </div>

                <div id="muscle-group-pills" class="muscle-group-pills">
                    <!-- Muscle group pills rendered dynamically -->
                </div>

                <div class="filters-section">
                    <div class="search-box">
                        <input 
                            type="text" 
                            id="exercise-search" 
                            placeholder="Search exercises by name, muscle group, or description..."
                            value="${this.filters.search}"
                        >
                    </div>
                    <div class="filter-dropdowns">
                        <select id="muscle-group-filter">
                            <option value="">All Muscle Groups</option>
                        </select>
                        <select id="equipment-filter">
                            <option value="">All Equipment</option>
                        </select>
                        <button class="btn-clear-filters" id="clear-filters-btn" style="display: none;">✕ Clear Filters</button>
                    </div>
                </div>

                <div id="exercises-grid" class="exercises-grid">
                    <!-- Exercise cards will be rendered here -->
                </div>
            </div>
        `;

        await Promise.all([
            this.loadExercises(),
            this.loadPrograms()
        ]);
        this.updateExerciseCount();
        this.populateFilters();
        this.renderMuscleGroupPills();
        this.applyFilters();
        this.attachEventListeners();
    }

    async loadExercises() {
        const options = { preferCache: true };
        const response = await api.getExercises(options);
        this.exercises = response.data;
        this.filteredExercises = [...this.exercises];
        
        if (!response.success || response.source === 'cache') {
            console.warn('Exercises loaded from cache or failed:', response);
        }
    }

    async loadPrograms() {
        try {
            const response = await api.getPrograms(null, { preferCache: true });
            this.programs = response.data || [];
        } catch (e) {
            console.warn('Failed to load programs:', e);
            this.programs = [];
        }
    }

    getMuscleGroupCounts() {
        const counts = {};
        this.exercises.forEach(e => {
            const group = e.muscleGroup || 'Other';
            counts[group] = (counts[group] || 0) + 1;
        });
        return counts;
    }

    getEquipmentCounts() {
        const counts = {};
        this.exercises.forEach(e => {
            const type = e.equipmentType || 'Other';
            counts[type] = (counts[type] || 0) + 1;
        });
        return counts;
    }

    renderMuscleGroupPills() {
        const container = document.getElementById('muscle-group-pills');
        const counts = this.getMuscleGroupCounts();
        const groups = Object.keys(counts).sort();

        const icons = {
            'Chest': '🫁', 'Back': '🔙', 'Legs': '🦵',
            'Shoulders': '💪', 'Arms': '💪', 'Core': '🎯'
        };

        container.innerHTML = `
            <button class="pill ${!this.filters.muscleGroup ? 'pill-active' : ''}" data-group="">
                All (${this.exercises.length})
            </button>
            ${groups.map(group => `
                <button class="pill ${this.filters.muscleGroup === group ? 'pill-active' : ''}" data-group="${group}">
                    ${icons[group] || '🏋️'} ${group} (${counts[group]})
                </button>
            `).join('')}
        `;

        container.querySelectorAll('.pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this.filters.muscleGroup = pill.dataset.group;
                document.getElementById('muscle-group-filter').value = this.filters.muscleGroup;
                this.renderMuscleGroupPills();
                this.applyFilters();
            });
        });
    }

    updateExerciseCount() {
        const countElement = document.getElementById('exercise-count');
        if (countElement) {
            const totalCount = this.exercises.length;
            const filteredCount = this.filteredExercises.length;
            
            if (filteredCount === totalCount) {
                countElement.textContent = `${totalCount} exercises available`;
            } else {
                countElement.textContent = `${filteredCount} of ${totalCount} exercises`;
            }
        }
    }

    updateClearFiltersVisibility() {
        const btn = document.getElementById('clear-filters-btn');
        if (btn) {
            const hasActiveFilter = this.filters.search || this.filters.muscleGroup || this.filters.equipmentType;
            btn.style.display = hasActiveFilter ? 'inline-flex' : 'none';
        }
    }

    populateFilters() {
        const muscleGroupCounts = this.getMuscleGroupCounts();
        const muscleGroups = Object.keys(muscleGroupCounts).sort();
        
        const muscleGroupFilter = document.getElementById('muscle-group-filter');
        muscleGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = `${group} (${muscleGroupCounts[group]})`;
            if (group === this.filters.muscleGroup) option.selected = true;
            muscleGroupFilter.appendChild(option);
        });

        const equipmentCounts = this.getEquipmentCounts();
        const equipmentTypes = Object.keys(equipmentCounts).sort();
        
        const equipmentFilter = document.getElementById('equipment-filter');
        equipmentTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = `${type} (${equipmentCounts[type]})`;
            if (type === this.filters.equipmentType) option.selected = true;
            equipmentFilter.appendChild(option);
        });
    }

    applyFilters() {
        this.filteredExercises = this.exercises.filter(exercise => {
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                const matchesSearch = 
                    exercise.name.toLowerCase().includes(searchLower) ||
                    (exercise.muscleGroup && exercise.muscleGroup.toLowerCase().includes(searchLower)) ||
                    (exercise.equipmentType && exercise.equipmentType.toLowerCase().includes(searchLower)) ||
                    (exercise.description && exercise.description.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }

            if (this.filters.muscleGroup && exercise.muscleGroup !== this.filters.muscleGroup) {
                return false;
            }

            if (this.filters.equipmentType && exercise.equipmentType !== this.filters.equipmentType) {
                return false;
            }

            return true;
        });

        // Sort alphabetically by name
        this.filteredExercises.sort((a, b) => a.name.localeCompare(b.name));

        this.updateExerciseCount();
        this.updateClearFiltersVisibility();
        this.renderExercisesList();
    }

    renderExercisesList() {
        const container = document.getElementById('exercises-grid');
        
        if (this.filteredExercises.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No exercises found matching your criteria.</p>
                    <button class="btn-secondary" id="no-results-clear-btn">Clear Filters</button>
                </div>
            `;
            document.getElementById('no-results-clear-btn')?.addEventListener('click', () => {
                this.clearFilters();
            });
            return;
        }

        container.innerHTML = this.filteredExercises.map((exercise) => {
            const isExpanded = this.expandedCards.has(exercise.id);
            const safeName = escapeHtml(exercise.name);
            const safeGroup = exercise.muscleGroup ? escapeHtml(exercise.muscleGroup) : '';
            const safeEquip = exercise.equipmentType ? escapeHtml(exercise.equipmentType) : '';
            return `
            <div class="exercise-card ${isExpanded ? 'exercise-card-expanded' : ''}" data-exercise-id="${escapeHtml(exercise.id)}">
                <div class="exercise-content">
                    <div class="exercise-card-header" data-toggle-id="${escapeHtml(exercise.id)}">
                        <div class="exercise-card-title-row">
                            <h3>${safeName}</h3>
                            <span class="expand-icon">${isExpanded ? '▲' : '▼'}</span>
                        </div>
                        <div class="exercise-badges">
                            ${safeGroup ? `<span class="badge badge-muscle">${safeGroup}</span>` : ''}
                            ${safeEquip ? `<span class="badge badge-equipment">${safeEquip}</span>` : ''}
                            ${exercise.isCustom ? `<span class="badge badge-custom">Custom</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="exercise-description ${isExpanded ? '' : 'exercise-description-collapsed'}">
                        ${exercise.description ? this.formatDescription(exercise.description) : '<p class="text-muted">No description available.</p>'}

                        <div class="exercise-card-actions">
                            <button class="btn-add-to-program" data-exercise-id="${escapeHtml(exercise.id)}" data-exercise-name="${safeName}" title="Add to program">
                                ➕ Add to Program
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');

        this.attachCardEventListeners();
    }

    attachCardEventListeners() {
        // Toggle card expand/collapse
        document.querySelectorAll('[data-toggle-id]').forEach(header => {
            header.addEventListener('click', () => {
                const exerciseId = header.dataset.toggleId;
                if (this.expandedCards.has(exerciseId)) {
                    this.expandedCards.delete(exerciseId);
                } else {
                    this.expandedCards.add(exerciseId);
                }
                const card = header.closest('.exercise-card');
                const desc = card.querySelector('.exercise-description');
                const icon = card.querySelector('.expand-icon');
                
                if (this.expandedCards.has(exerciseId)) {
                    card.classList.add('exercise-card-expanded');
                    desc.classList.remove('exercise-description-collapsed');
                    icon.textContent = '▲';
                } else {
                    card.classList.remove('exercise-card-expanded');
                    desc.classList.add('exercise-description-collapsed');
                    icon.textContent = '▼';
                }
            });
        });

        // Add to program buttons
        document.querySelectorAll('.btn-add-to-program').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const exerciseId = btn.dataset.exerciseId;
                const exerciseName = btn.dataset.exerciseName;
                this.showAddToProgramDialog(exerciseId, exerciseName);
            });
        });
    }

    async showAddToProgramDialog(exerciseId, exerciseName) {
        // Refresh programs list
        await this.loadPrograms();

        if (this.programs.length === 0) {
            notification.warning('No programs found. Create a program first in the Programs view.');
            return;
        }

        // Remove existing dialog if present
        document.getElementById('add-to-program-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'add-to-program-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6); z-index: 2000;
            display: flex; align-items: center; justify-content: center;
            padding: 20px; animation: fadeIn 0.2s ease-in-out;
        `;

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const safeExerciseName = escapeHtml(exerciseName);

        overlay.innerHTML = `
            <div class="card" style="max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; margin: 0; animation: slideUp 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div class="card-header" style="margin: 0;">➕ Add to Program</div>
                    <button class="btn btn-secondary" id="close-add-program-btn" style="padding: 8px 16px;">✕</button>
                </div>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    Select a program to add <strong>${safeExerciseName}</strong> to:
                </p>
                <div class="add-to-program-list">
                    ${this.programs.map(program => {
                        const safeProgramName = escapeHtml(program.name);
                        const dayLabel = program.dayOfWeek !== null && program.dayOfWeek !== undefined && program.dayOfWeek >= 0 && program.dayOfWeek <= 6 ? ` · ${days[program.dayOfWeek]}` : '';
                        return `
                        <div class="add-to-program-item" data-program-id="${escapeHtml(program.id)}">
                            <div class="add-to-program-item-info">
                                <strong>${safeProgramName}</strong>
                                <span style="color: var(--text-secondary); font-size: 13px;">
                                    ${program.exercises ? program.exercises.length : 0} exercises${dayLabel}
                                </span>
                            </div>
                            <button class="btn-primary btn-sm add-to-program-select" data-program-id="${escapeHtml(program.id)}" data-program-name="${safeProgramName}">
                                Add
                            </button>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const removeOverlay = () => {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        };

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) removeOverlay();
        });

        // Close button
        document.getElementById('close-add-program-btn')?.addEventListener('click', () => {
            removeOverlay();
        });

        // Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') removeOverlay();
        };
        document.addEventListener('keydown', escHandler);

        // Add buttons
        overlay.querySelectorAll('.add-to-program-select').forEach(btn => {
            btn.addEventListener('click', async () => {
                const programId = btn.dataset.programId;
                const programName = btn.dataset.programName;
                removeOverlay();
                await this.addExerciseToProgram(exerciseId, exerciseName, programId, programName);
            });
        });
    }

    async addExerciseToProgram(exerciseId, exerciseName, programId, programName) {
        try {
            // Fetch full program details
            const programResponse = await api.getProgram(programId);
            if (!programResponse.success || !programResponse.data) {
                notification.error('Failed to load program details.');
                return;
            }

            const program = programResponse.data;

            // Check if exercise already exists in program
            if (program.exercises && program.exercises.some(e => e.exerciseId === exerciseId)) {
                notification.warning(`${exerciseName} is already in "${programName}".`);
                return;
            }

            // Add exercise with default values
            const newExercise = {
                exerciseId: exerciseId,
                exerciseName: exerciseName,
                order: program.exercises ? program.exercises.length : 0,
                sets: 3,
                repsMin: 8,
                repsMax: 12,
                targetWeight: null,
                restSeconds: null,
                notes: ''
            };

            const updatedProgram = {
                name: program.name,
                dayOfWeek: program.dayOfWeek,
                isDefault: program.isDefault,
                exercises: [...(program.exercises || []), newExercise]
            };

            const updateResponse = await api.updateProgram(programId, updatedProgram);
            if (updateResponse.success) {
                notification.success(`Added "${exerciseName}" to "${programName}" ✓`);
            } else {
                notification.error(`Failed to add exercise: ${updateResponse.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error('Error adding exercise to program:', e);
            notification.error('An error occurred while adding the exercise.');
        }
    }

    formatDescription(description) {
        if (!description) return '';

        const sections = {
            'Setup:': 'setup',
            'Technique:': 'technique',
            'Hints:': 'hints',
            'Warnings:': 'warnings'
        };

        // Escape HTML first, then add formatting
        let formatted = escapeHtml(description);
        Object.keys(sections).forEach(keyword => {
            const className = sections[keyword];
            formatted = formatted.replace(
                new RegExp(`(${keyword})`, 'g'),
                `<strong class="desc-${className}">$1</strong>`
            );
        });

        return `<p>${formatted}</p>`;
    }

    clearFilters() {
        this.filters = {
            search: '',
            muscleGroup: '',
            equipmentType: ''
        };

        document.getElementById('exercise-search').value = '';
        document.getElementById('muscle-group-filter').value = '';
        document.getElementById('equipment-filter').value = '';

        this.renderMuscleGroupPills();
        this.applyFilters();
    }

    attachEventListeners() {
        // Search input
        const searchInput = document.getElementById('exercise-search');
        searchInput?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Muscle group filter
        const muscleGroupFilter = document.getElementById('muscle-group-filter');
        muscleGroupFilter?.addEventListener('change', (e) => {
            this.filters.muscleGroup = e.target.value;
            this.renderMuscleGroupPills();
            this.applyFilters();
        });

        // Equipment filter
        const equipmentFilter = document.getElementById('equipment-filter');
        equipmentFilter?.addEventListener('change', (e) => {
            this.filters.equipmentType = e.target.value;
            this.applyFilters();
        });

        // Clear filters button
        document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
            this.clearFilters();
        });
    }
}
