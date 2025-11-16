import { api } from '../utils/api-client.js?v=20251116171145';

export class ExercisesView {
    constructor() {
        this.exercises = [];
        this.filteredExercises = [];
        this.filters = {
            search: '',
            muscleGroup: '',
            equipmentType: ''
        };
    }

    async render(container) {
        // Use passed container or default to main
        const targetContainer = container || document.getElementById('main');
        
        targetContainer.innerHTML = `
            <div class="exercises-view">
                <div class="view-header">
                    <h1>Exercise Library</h1>
                    <p class="subtitle" id="exercise-count">Loading exercises...</p>
                </div>

                <div class="filters-section">
                    <div class="search-box">
                        <input 
                            type="text" 
                            id="exercise-search" 
                            placeholder="Search exercises..."
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
                    </div>
                </div>

                <div id="exercises-grid" class="exercises-grid">
                    <!-- Exercise cards will be rendered here -->
                </div>
            </div>
        `;

        await this.loadExercises();
        this.updateExerciseCount();
        this.populateFilters();
        this.applyFilters();
        this.attachEventListeners();
    }

    async loadExercises() {
        const response = await api.getExercises();
        this.exercises = response.data;
        this.filteredExercises = [...this.exercises];
        
        // Show offline indicator if needed
        if (!response.success || response.source === 'cache') {
            console.warn('Exercises loaded from cache or failed:', response);
        }
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

    populateFilters() {
        // Get unique muscle groups
        const muscleGroups = [...new Set(this.exercises
            .map(e => e.muscleGroup)
            .filter(Boolean)
            .sort())];
        
        const muscleGroupFilter = document.getElementById('muscle-group-filter');
        muscleGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            if (group === this.filters.muscleGroup) option.selected = true;
            muscleGroupFilter.appendChild(option);
        });

        // Get unique equipment types
        const equipmentTypes = [...new Set(this.exercises
            .map(e => e.equipmentType)
            .filter(Boolean)
            .sort())];
        
        const equipmentFilter = document.getElementById('equipment-filter');
        equipmentTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            if (type === this.filters.equipmentType) option.selected = true;
            equipmentFilter.appendChild(option);
        });
    }

    applyFilters() {
        this.filteredExercises = this.exercises.filter(exercise => {
            // Search filter
            if (this.filters.search) {
                const searchLower = this.filters.search.toLowerCase();
                const matchesSearch = 
                    exercise.name.toLowerCase().includes(searchLower) ||
                    (exercise.muscleGroup && exercise.muscleGroup.toLowerCase().includes(searchLower)) ||
                    (exercise.description && exercise.description.toLowerCase().includes(searchLower));
                if (!matchesSearch) return false;
            }

            // Muscle group filter
            if (this.filters.muscleGroup && exercise.muscleGroup !== this.filters.muscleGroup) {
                return false;
            }

            // Equipment filter
            if (this.filters.equipmentType && exercise.equipmentType !== this.filters.equipmentType) {
                return false;
            }

            return true;
        });

        this.updateExerciseCount();
        this.renderExercisesList();
    }

    renderExercisesList() {
        const container = document.getElementById('exercises-grid');
        
        if (this.filteredExercises.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No exercises found matching your criteria.</p>
                    <button class="btn-secondary" id="clear-filters-btn">Clear Filters</button>
                </div>
            `;
            document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
                this.clearFilters();
            });
            return;
        }

        container.innerHTML = this.filteredExercises.map((exercise, index) => `
            <div class="exercise-card">
                <div class="exercise-content">
                        <div class="exercise-card-header">
                            <h3>${exercise.name}</h3>
                            <div class="exercise-badges">
                                ${exercise.muscleGroup ? `<span class="badge badge-muscle">${exercise.muscleGroup}</span>` : ''}
                                ${exercise.equipmentType ? `<span class="badge badge-equipment">${exercise.equipmentType}</span>` : ''}
                                ${exercise.isCustom ? `<span class="badge badge-custom">Custom</span>` : ''}
                            </div>
                        </div>
                        
                        ${exercise.description ? `
                            <div class="exercise-description">
                                ${this.formatDescription(exercise.description)}
                            </div>
                        ` : '<div class="exercise-description"><p class="text-muted">No description available.</p></div>'}
                </div>
            </div>
        `).join('');
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
            this.applyFilters();
        });

        // Equipment filter
        const equipmentFilter = document.getElementById('equipment-filter');
        equipmentFilter?.addEventListener('change', (e) => {
            this.filters.equipmentType = e.target.value;
            this.applyFilters();
        });
    }
}
