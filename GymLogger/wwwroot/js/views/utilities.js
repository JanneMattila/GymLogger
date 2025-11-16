import { api } from '../utils/api-client.js';

export class UtilitiesView {
    constructor() {
        this.activeTab = 'plate-calculator';
        this.preferences = null;
    }

    async render() {
        const container = document.getElementById('main');
        
        // Load preferences (use defaults if offline)
        if (!this.preferences) {
            const response = await api.getPreferences();
            if (response.success && response.data) {
                this.preferences = response.data;
            } else {
                console.warn('Could not load preferences, using defaults');
                this.preferences = { defaultWeightUnit: 'KG' }; // Default preferences for offline
            }
        }
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">Utilities</div>
                
                <!-- Tabs -->
                <div class="tabs">
                    <button class="tab-btn ${this.activeTab === 'plate-calculator' ? 'active' : ''}" data-tab="plate-calculator">
                        Plate Calculator
                    </button>
                    <button class="tab-btn ${this.activeTab === 'unit-converter' ? 'active' : ''}" data-tab="unit-converter">
                        Unit Converter
                    </button>
                    <button class="tab-btn ${this.activeTab === 'warmup-calculator' ? 'active' : ''}" data-tab="warmup-calculator">
                        Warm-up Calculator
                    </button>
                </div>

                <!-- Tab Content -->
                <div id="utilities-content">
                    ${this.activeTab === 'plate-calculator' ? this.renderPlateCalculator() : 
                      this.activeTab === 'unit-converter' ? this.renderUnitConverter() : 
                      this.renderWarmupCalculator()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderPlateCalculator() {
        const defaultUnit = this.preferences?.defaultWeightUnit || 'KG';
        const barWeight = defaultUnit === 'KG' ? 20 : 45;

        return `
            <div class="utility-section">
                <h3 style="margin-bottom: 16px;">Plate Loading Calculator</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Calculate which plates to load on each side of the barbell to reach your target weight.
                </p>

                <!-- Input Section -->
                <div style="max-width: 500px; margin-bottom: 32px;">
                    <div style="margin-bottom: 16px;">
                        <label class="form-label">Target Weight</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="number" id="target-weight" class="form-input" 
                                   placeholder="Enter target weight" value="100" min="0">
                            <select id="plate-unit" class="form-input" style="width: 100px;">
                                <option value="KG" ${defaultUnit === 'KG' ? 'selected' : ''}>KG</option>
                                <option value="LBS" ${defaultUnit === 'LBS' ? 'selected' : ''}>LBS</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label class="form-label">Bar Weight</label>
                            <input type="number" id="bar-weight" class="form-input" 
                               value="${barWeight}" min="0">
                    </div>

                    <button id="calculate-plates-btn" class="btn btn-primary">Calculate Plates</button>
                </div>

                <!-- Results Section -->
                <div id="plate-results"></div>
            </div>
        `;
    }

    renderUnitConverter() {
        return `
            <div class="utility-section">
                <h3 style="margin-bottom: 16px;">Weight Unit Converter</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Convert between kilograms (KG) and pounds (LBS).
                </p>

                <!-- Converter Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; max-width: 800px;">
                    <!-- KG to LBS -->
                    <div class="converter-card">
                        <h4 style="margin-bottom: 12px;">KG → LBS</h4>
                        <div style="margin-bottom: 12px;">
                            <label class="form-label">Kilograms</label>
                            <input type="number" id="kg-input" class="form-input" 
                                   placeholder="Enter kg" value="100" min="0">
                        </div>
                        <div style="background: var(--surface); padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Result</div>
                            <div id="lbs-result" style="font-size: 32px; font-weight: 700; color: var(--primary-color);">220.46</div>
                            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">LBS</div>
                        </div>
                    </div>

                    <!-- LBS to KG -->
                    <div class="converter-card">
                        <h4 style="margin-bottom: 12px;">LBS → KG</h4>
                        <div style="margin-bottom: 12px;">
                            <label class="form-label">Pounds</label>
                            <input type="number" id="lbs-input" class="form-input" 
                                   placeholder="Enter lbs" value="220" min="0">
                        </div>
                        <div style="background: var(--surface); padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Result</div>
                            <div id="kg-result" style="font-size: 32px; font-weight: 700; color: var(--primary-color);">99.79</div>
                            <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">KG</div>
                        </div>
                    </div>
                </div>

                <!-- Quick Reference -->
                <div style="margin-top: 32px; max-width: 600px;">
                    <h4 style="margin-bottom: 12px;">Quick Reference</h4>
                    <div style="background: var(--surface); padding: 16px; border-radius: 8px;">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 14px;">
                            <div><strong>20 kg</strong> = 44.09 lbs</div>
                            <div><strong>45 lbs</strong> = 20.41 kg</div>
                            <div><strong>25 kg</strong> = 55.12 lbs</div>
                            <div><strong>35 lbs</strong> = 15.88 kg</div>
                            <div><strong>50 kg</strong> = 110.23 lbs</div>
                            <div><strong>100 lbs</strong> = 45.36 kg</div>
                            <div><strong>100 kg</strong> = 220.46 lbs</div>
                            <div><strong>200 lbs</strong> = 90.72 kg</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderWarmupCalculator() {
        const defaultUnit = this.preferences?.defaultWeightUnit || 'KG';

        return `
            <div class="utility-section">
                <h3 style="margin-bottom: 16px;">Warm-up Calculator</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Calculate your warm-up sets leading up to your working weight.
                </p>

                <!-- Input Section -->
                <div style="max-width: 600px; margin-bottom: 32px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                        <div>
                            <label class="form-label">Working Weight</label>
                            <input type="number" id="working-weight" class="form-input" 
                                   placeholder="Enter working weight" value="100" min="0">
                        </div>
                        <div>
                            <label class="form-label">Unit</label>
                            <select id="warmup-unit" class="form-input">
                                <option value="KG" ${defaultUnit === 'KG' ? 'selected' : ''}>KG</option>
                                <option value="LBS" ${defaultUnit === 'LBS' ? 'selected' : ''}>LBS</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label class="form-label">Bar Weight</label>
                            <input type="number" id="warmup-bar-weight" class="form-input" 
                               value="${defaultUnit === 'KG' ? 20 : 45}" min="0">
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label class="form-label">Warm-up Preset</label>
                        <select id="warmup-preset" class="form-input">
                            <option value="standard">Standard (5 sets)</option>
                            <option value="quick">Quick (3 sets)</option>
                            <option value="extended">Extended (7 sets)</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>

                    <div id="warmup-custom-input" style="display: none; margin-bottom: 16px;">
                        <label class="form-label">Number of Warm-up Sets</label>
                        <input type="number" id="custom-warmup-sets" class="form-input" 
                               value="5" min="1" max="10">
                    </div>

                    <button id="calculate-warmup-btn" class="btn btn-primary">Calculate Warm-up</button>
                </div>

                <!-- Results Section -->
                <div id="warmup-results"></div>
            </div>
        `;
    }

    attachEventListeners() {
        // Tab switching
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeTab = e.target.dataset.tab;
                this.render();
            });
        });

        if (this.activeTab === 'plate-calculator') {
            this.attachPlateCalculatorListeners();
        } else if (this.activeTab === 'unit-converter') {
            this.attachConverterListeners();
        } else if (this.activeTab === 'warmup-calculator') {
            this.attachWarmupCalculatorListeners();
        }
    }

    attachPlateCalculatorListeners() {
        const calculateBtn = document.getElementById('calculate-plates-btn');
        const targetWeightInput = document.getElementById('target-weight');
        const unitSelect = document.getElementById('plate-unit');
        const barWeightInput = document.getElementById('bar-weight');

        // Auto-update bar weight when unit changes
        unitSelect?.addEventListener('change', (e) => {
            const newUnit = e.target.value;
            const barWeight = newUnit === 'KG' ? 20 : 45;
            barWeightInput.value = barWeight;
        });

        calculateBtn?.addEventListener('click', () => {
            const targetWeight = parseFloat(targetWeightInput.value) || 0;
            const barWeight = parseFloat(barWeightInput.value) || 0;
            const unit = unitSelect.value;
            
            this.calculatePlates(targetWeight, barWeight, unit);
        });

        // Calculate on Enter key
        targetWeightInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                calculateBtn?.click();
            }
        });

        // Initial calculation
        if (targetWeightInput?.value) {
            this.calculatePlates(
                parseFloat(targetWeightInput.value),
                parseFloat(barWeightInput.value) || 0,
                unitSelect.value
            );
        }
    }

    attachConverterListeners() {
        const kgInput = document.getElementById('kg-input');
        const lbsInput = document.getElementById('lbs-input');
        const lbsResult = document.getElementById('lbs-result');
        const kgResult = document.getElementById('kg-result');

        kgInput?.addEventListener('input', (e) => {
            const kg = parseFloat(e.target.value) || 0;
            const lbs = kg * 2.20462;
            lbsResult.textContent = lbs.toFixed(2);
        });

        lbsInput?.addEventListener('input', (e) => {
            const lbs = parseFloat(e.target.value) || 0;
            const kg = lbs / 2.20462;
            kgResult.textContent = kg.toFixed(2);
        });

        // Initial conversion
        if (kgInput?.value) {
            const kg = parseFloat(kgInput.value);
            lbsResult.textContent = (kg * 2.20462).toFixed(2);
        }
        if (lbsInput?.value) {
            const lbs = parseFloat(lbsInput.value);
            kgResult.textContent = (lbs / 2.20462).toFixed(2);
        }
    }

    attachWarmupCalculatorListeners() {
        const calculateBtn = document.getElementById('calculate-warmup-btn');
        const workingWeightInput = document.getElementById('working-weight');
        const unitSelect = document.getElementById('warmup-unit');
        const barWeightInput = document.getElementById('warmup-bar-weight');
        const presetSelect = document.getElementById('warmup-preset');
        const customInput = document.getElementById('warmup-custom-input');
        const customSetsInput = document.getElementById('custom-warmup-sets');

        // Show/hide custom input
        presetSelect?.addEventListener('change', (e) => {
            if (customInput) {
                customInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
        });

        // Auto-update bar weight when unit changes
        unitSelect?.addEventListener('change', (e) => {
            const newUnit = e.target.value;
            const barWeight = newUnit === 'KG' ? 20 : 45;
            barWeightInput.value = barWeight;
        });

        calculateBtn?.addEventListener('click', () => {
            const workingWeight = parseFloat(workingWeightInput.value) || 0;
            const barWeight = parseFloat(barWeightInput.value) || 0;
            const unit = unitSelect.value;
            const preset = presetSelect.value;
            const customSets = preset === 'custom' ? parseInt(customSetsInput.value) || 5 : 0;
            
            this.calculateWarmup(workingWeight, barWeight, unit, preset, customSets);
        });

        // Calculate on Enter key
        workingWeightInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                calculateBtn?.click();
            }
        });

        // Initial calculation
        if (workingWeightInput?.value) {
            this.calculateWarmup(
                parseFloat(workingWeightInput.value),
                parseFloat(barWeightInput.value) || 0,
                unitSelect.value,
                'standard',
                0
            );
        }
    }

    calculateWarmup(workingWeight, barWeight, unit, preset, customSets) {
        const resultsDiv = document.getElementById('warmup-results');
        
        if (workingWeight <= barWeight) {
            resultsDiv.innerHTML = `
                <div style="background: var(--warning-color); color: white; padding: 16px; border-radius: 8px;">
                    <strong>Note:</strong> Working weight must be greater than bar weight.
                </div>
            `;
            return;
        }

        // Define warm-up percentages based on preset
        let percentages;
        switch (preset) {
            case 'quick':
                percentages = [0.4, 0.6, 0.8];
                break;
            case 'extended':
                percentages = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
                break;
            case 'custom':
                const numSets = customSets;
                percentages = Array.from({ length: numSets }, (_, i) => 
                    (i + 1) / (numSets + 1)
                );
                break;
            case 'standard':
            default:
                percentages = [0.4, 0.5, 0.6, 0.75, 0.85];
                break;
        }

        // Calculate warm-up sets
        const warmupSets = percentages.map((percentage, index) => {
            const weight = workingWeight * percentage;
            const roundedWeight = Math.round(weight * 2) / 2; // Round to nearest 0.5
            
            // Suggested reps (fewer reps as weight increases)
            let reps;
            if (percentage < 0.5) reps = 10;
            else if (percentage < 0.65) reps = 8;
            else if (percentage < 0.8) reps = 5;
            else reps = 3;

            return {
                set: index + 1,
                percentage: Math.round(percentage * 100),
                weight: roundedWeight,
                reps: reps
            };
        });

        resultsDiv.innerHTML = `
            <div style="background: var(--surface); padding: 24px; border-radius: 12px;">
                <h4 style="margin-bottom: 16px;">Warm-up Protocol</h4>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    Working weight: <strong>${workingWeight} ${unit}</strong>
                </p>

                <!-- Warm-up Sets Table -->
                <div style="background: var(--background); border-radius: 8px; overflow: hidden;">
                    <div style="display: grid; grid-template-columns: 80px 100px 120px 100px; gap: 12px; padding: 12px 16px; background: var(--primary-color); color: white; font-weight: 600; font-size: 14px;">
                        <div>Set</div>
                        <div>%</div>
                        <div>Weight</div>
                        <div>Reps</div>
                    </div>
                    ${warmupSets.map((set, index) => `
                        <div style="display: grid; grid-template-columns: 80px 100px 120px 100px; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); ${index % 2 === 0 ? 'background: var(--surface);' : ''}">
                            <div style="font-weight: 600;">Set ${set.set}</div>
                            <div style="color: var(--text-secondary);">${set.percentage}%</div>
                            <div style="font-weight: 600; color: var(--primary-color);">${set.weight} ${unit}</div>
                            <div>${set.reps} reps</div>
                        </div>
                    `).join('')}
                </div>

                <!-- Working Set -->
                <div style="margin-top: 20px; padding: 16px; background: var(--success-color); color: white; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: 80px 100px 120px 100px; gap: 12px; font-weight: 600;">
                        <div>Work Set</div>
                        <div>100%</div>
                        <div>${workingWeight} ${unit}</div>
                        <div>As planned</div>
                    </div>
                </div>

                <!-- Tips -->
                <div style="margin-top: 20px; padding: 16px; background: var(--primary-hover); border-left: 4px solid var(--primary-color); border-radius: 4px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">💡 Warm-up Tips</div>
                    <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px;">
                        <li>Rest 30-60 seconds between warm-up sets</li>
                        <li>Focus on movement quality and form</li>
                        <li>Don't fatigue yourself before working sets</li>
                        <li>Adjust reps based on your experience level</li>
                    </ul>
                </div>
            </div>
        `;
    }

    calculatePlates(targetWeight, barWeight, unit) {
        const resultsDiv = document.getElementById('plate-results');
        
        if (targetWeight <= barWeight) {
            resultsDiv.innerHTML = `
                <div style="background: var(--warning-color); color: white; padding: 16px; border-radius: 8px;">
                    <strong>Note:</strong> Target weight must be greater than bar weight.
                </div>
            `;
            return;
        }

        const weightToLoad = targetWeight - barWeight;
        const perSide = weightToLoad / 2;

        // Standard plate sets (most common in commercial gyms)
        const standardPlates = unit === 'KG' 
            ? [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25]
            : [45, 35, 25, 10, 5, 2.5];

        const platesNeeded = [];
        let remainingWeight = perSide;

        // Greedy algorithm to find plates
        for (const plate of standardPlates) {
            while (remainingWeight >= plate - 0.01) { // Small epsilon for floating point
                platesNeeded.push(plate);
                remainingWeight -= plate;
            }
        }

        const actualWeight = barWeight + (platesNeeded.reduce((sum, p) => sum + p, 0) * 2);
        const difference = Math.abs(targetWeight - actualWeight);

        // Group plates by weight for display
        const plateGroups = {};
        platesNeeded.forEach(plate => {
            plateGroups[plate] = (plateGroups[plate] || 0) + 1;
        });

        resultsDiv.innerHTML = `
            <div style="background: var(--surface); padding: 24px; border-radius: 12px;">
                <h4 style="margin-bottom: 16px;">Load per side:</h4>
                
                <!-- Visual Plate Display -->
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                        ${platesNeeded.map(plate => this.renderPlateVisual(plate, unit)).join('')}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Load these plates on each side of the barbell
                    </div>
                </div>

                <!-- Detailed List -->
                <div style="background: var(--background); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-weight: 600; margin-bottom: 12px; color: var(--text-secondary);">Plates per side:</div>
                    ${Object.entries(plateGroups)
                        .sort(([a], [b]) => parseFloat(b) - parseFloat(a))
                        .map(([weight, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                                <span>${count}× ${weight} ${unit}</span>
                                <span style="color: var(--text-secondary);">${(parseFloat(weight) * count).toFixed(2)} ${unit}</span>
                            </div>
                        `).join('')}
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 700; margin-top: 8px;">
                        <span>Total per side:</span>
                        <span>${perSide.toFixed(2)} ${unit}</span>
                    </div>
                </div>

                <!-- Summary -->
                <div style="background: ${difference < 0.5 ? 'var(--success-color)' : 'var(--warning-color)'}; color: white; padding: 16px; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-size: 14px; opacity: 0.9;">Actual Total Weight</div>
                            <div style="font-size: 24px; font-weight: 700;">${actualWeight.toFixed(2)} ${unit}</div>
                        </div>
                        ${difference > 0.01 ? `
                            <div style="text-align: right;">
                                <div style="font-size: 14px; opacity: 0.9;">Difference</div>
                                <div style="font-size: 18px; font-weight: 600;">${difference.toFixed(2)} ${unit}</div>
                            </div>
                        ` : ''}
                    </div>
                    ${difference > 0.5 ? `
                        <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
                            💡 Tip: Add smaller plates or adjust target weight for exact match
                        </div>
                    ` : ''}
                </div>

                <!-- Bar Visualization -->
                <div style="margin-top: 24px;">
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; text-align: center;">
                        Bar Visualization
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 80px;">
                        <div style="display: flex; gap: 2px; align-items: center; height: 100%;">
                            ${platesNeeded.slice().reverse().map(plate => this.renderMiniPlate(plate)).join('')}
                        </div>
                        <div style="background: #888; height: 20px; width: 200px; border-radius: 2px; position: relative;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; color: white; font-weight: 600;">
                                BAR (${barWeight} ${unit})
                            </div>
                        </div>
                        <div style="display: flex; gap: 2px; align-items: center; height: 100%;">
                            ${platesNeeded.map(plate => this.renderMiniPlate(plate)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPlateVisual(weight, unit) {
        // Color coding based on weight (common gym plate colors)
        let color;
        if (unit === 'KG') {
            if (weight >= 25) color = '#e74c3c'; // Red
            else if (weight >= 20) color = '#3498db'; // Blue
            else if (weight >= 15) color = '#f39c12'; // Yellow
            else if (weight >= 10) color = '#2ecc71'; // Green
            else if (weight >= 5) color = '#95a5a6'; // Gray
            else color = '#7f8c8d'; // Dark gray
        } else {
            if (weight >= 45) color = '#e74c3c'; // Red
            else if (weight >= 35) color = '#f39c12'; // Yellow
            else if (weight >= 25) color = '#2ecc71'; // Green
            else if (weight >= 10) color = '#3498db'; // Blue
            else color = '#95a5a6'; // Gray
        }

        return `
            <div style="
                background: ${color};
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 700;
                font-size: 16px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">${weight}</div>
        `;
    }

    renderMiniPlate(weight) {
        const height = Math.min(Math.max(weight * 2, 30), 60);
        let color;
        
        if (weight >= 20) color = '#e74c3c';
        else if (weight >= 15) color = '#f39c12';
        else if (weight >= 10) color = '#2ecc71';
        else if (weight >= 5) color = '#3498db';
        else color = '#95a5a6';

        return `
            <div style="
                background: ${color};
                width: 8px;
                height: ${height}px;
                border-radius: 2px;
            "></div>
        `;
    }
}
