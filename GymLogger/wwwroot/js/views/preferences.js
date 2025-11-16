import { api } from '../utils/api-client.js?v=00000000000000';
import { notification } from '../components/notification.js?v=00000000000000';
import { CustomDropdown } from '../components/custom-dropdown.js?v=00000000000000';
import { themeManager } from '../utils/theme-manager.js?v=00000000000000';
import { authManager } from '../utils/auth-manager.js?v=00000000000000';

export class PreferencesView {
    constructor() {
        this.container = document.getElementById('main');
        this.preferences = null;
        this.dropdowns = {
            warmupBehavior: null,
            warmupPreset: null,
            weekStartDay: null,
            restTimerDuration: null
        };
    }

    async render() {
        this.container.innerHTML = '<div class="card"><p>Loading preferences...</p></div>';

        const response = await api.getPreferences();
        
        if (!response.success) {
            notification.error('Error loading preferences: ' + (response.error || 'Unknown error'));
            this.container.innerHTML = `
                <div class="card">
                    <p style="color: var(--danger-color);">Error loading preferences: ${response.error || 'Unknown error'}</p>
                </div>
            `;
            return;
        }
        
        this.preferences = response.data;
        
        // Sync theme with local storage if different
        if (this.preferences) {
            const savedTheme = themeManager.getSavedTheme();
            if (!savedTheme || savedTheme !== this.preferences.theme) {
                themeManager.setTheme(this.preferences.theme);
            }
        }
        
        this.renderPreferences();
    }

    renderPreferences() {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        let content = `
            <div class="card">
                <div class="card-header">User Preferences</div>
                
                <form id="preferences-form">
                    <!-- Warmup Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Warmup Settings</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Warmup Behavior</label>
                            <div id="warmup-behavior-dropdown"></div>
                            <small style="color: var(--text-secondary);">Control when warmup sets are included in your workouts</small>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Warmup Preset</label>
                            <div id="warmup-preset-dropdown"></div>
                        </div>

                        <div id="warmup-custom-config" style="display: ${this.preferences.warmupPreset === 'custom' ? 'block' : 'none'}; background: var(--surface); padding: 16px; border-radius: 8px;">
                            <h4 style="margin-bottom: 12px;">Custom Warmup Configuration</h4>
                            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 16px;">
                                Configure your warmup sets. Each set is defined by percentage of working weight, number of reps, and number of sets.
                            </p>
                            
                            <div id="warmup-sets-container">
                                ${this.renderWarmupSets()}
                            </div>
                            
                            <button type="button" class="btn btn-secondary" id="add-warmup-set-btn" style="margin-top: 12px;">+ Add Warmup Set</button>
                        </div>
                    </div>

                    <!-- Weight Unit Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Weight Unit</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Default Weight Unit</label>
                            <div style="display: flex; gap: 16px;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="weight-unit" value="KG" ${this.preferences.defaultWeightUnit === 'KG' ? 'checked' : ''} style="margin-right: 8px;">
                                    <span>Kilograms (KG)</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="weight-unit" value="LBS" ${this.preferences.defaultWeightUnit === 'LBS' ? 'checked' : ''} style="margin-right: 8px;">
                                    <span>Pounds (LBS)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Calendar Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Calendar Settings</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Week Starts On</label>
                            <div id="week-start-day-dropdown"></div>
                        </div>
                    </div>

                    <!-- Appearance Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Appearance</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Theme</label>
                            <div style="display: flex; gap: 16px;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="theme" value="light" ${this.preferences.theme === 'light' ? 'checked' : ''} style="margin-right: 8px;">
                                    <span>☀️ Light</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="theme" value="dark" ${this.preferences.theme === 'dark' ? 'checked' : ''} style="margin-right: 8px;">
                                    <span>🌙 Dark</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="theme" value="auto" ${this.preferences.theme === 'auto' ? 'checked' : ''} style="margin-right: 8px;">
                                    <span>🔄 Auto</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Sound Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Sound & Timer</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" id="sound-enabled" ${this.preferences.soundEnabled ? 'checked' : ''} style="margin-right: 8px;">
                                <span style="font-weight: 600;">Enable Sound Effects</span>
                            </label>
                            <small style="color: var(--text-secondary); display: block; margin-top: 8px;">
                                Play sounds for rest timer completion and other notifications
                            </small>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Default Rest Timer Duration</label>
                            <div id="rest-timer-duration-dropdown"></div>
                            <small style="color: var(--text-secondary); display: block; margin-top: 8px;">
                                Default rest time between sets
                            </small>
                        </div>
                    </div>

                    <!-- Outbound Integration Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Outbound Integration</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 12px;">
                                <input type="checkbox" id="outbound-integration-enabled" ${this.preferences.outboundIntegrationEnabled ? 'checked' : ''} style="margin-right: 8px;">
                                <span style="font-weight: 600;">Enable Outbound Integration</span>
                            </label>
                            
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Integration Endpoint URL</label>
                            <input 
                                type="url" 
                                id="outbound-integration-url" 
                                class="input" 
                                value="${this.preferences.outboundIntegrationUrl || ''}" 
                                placeholder="https://example.com/api/workouts"
                                style="width: 100%;"
                                ${!this.preferences.outboundIntegrationEnabled ? 'disabled' : ''}>
                            <small style="color: var(--text-secondary); display: block; margin-top: 8px;">
                                When enabled, workout data will be sent to this endpoint upon completion.
                            </small>
                        </div>
                    </div>

                    <!-- Inbound Integration Settings -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="margin-bottom: 16px; font-size: 18px; border-bottom: 2px solid var(--border); padding-bottom: 8px;">Inbound Integration</h3>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 12px;">
                                <input type="checkbox" id="inbound-integration-enabled" ${this.preferences.inboundIntegrationEnabled ? 'checked' : ''} style="margin-right: 8px;">
                                <span style="font-weight: 600;">Enable Inbound Integration</span>
                            </label>
                            
                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Your Import API Endpoint</label>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input 
                                    type="text" 
                                    id="inbound-integration-url" 
                                    class="input" 
                                    value="${window.location.origin}/api/import?key=${this.preferences.inboundIntegrationKey || ''}" 
                                    readonly
                                    style="flex: 1;"
                                    ${!this.preferences.inboundIntegrationEnabled ? 'disabled' : ''}>
                                <button type="button" class="btn btn-secondary" id="copy-inbound-url-btn" style="padding: 8px 16px;" ${!this.preferences.inboundIntegrationEnabled ? 'disabled' : ''}>
                                    📋 Copy
                                </button>
                            </div>
                            <small style="color: var(--text-secondary); display: block; margin-top: 8px;">
                                Use this URL to import workout data from external sources. The key is unique to your account.
                            </small>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="submit" class="btn btn-primary">Save Preferences</button>
                        <button type="button" class="btn btn-secondary" id="reset-defaults-btn">Reset to Defaults</button>
                    </div>
                </form>

                <!-- Account Section -->
                <div style="margin-top: 32px; padding-top: 32px; border-top: 2px solid var(--border);">
                    <h3 style="margin-bottom: 16px; font-size: 18px;">Account</h3>
                    <div style="display: flex; gap: 12px;">
                        <button type="button" class="btn btn-secondary" id="logout-btn">
                            ${localStorage.getItem('gymlogger_isGuest') === 'true' ? 'Clear Guest Session' : 'Sign Out'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = content;
        this.initializeDropdowns();
        this.attachListeners();
        
        // Apply current theme
        this.applyTheme(this.preferences.theme);
    }

    initializeDropdowns() {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Warmup Behavior dropdown
        this.dropdowns.warmupBehavior = new CustomDropdown('warmup-behavior-dropdown', {
            items: [
                { value: 'always', label: 'Always show warmup' },
                { value: 'ask', label: 'Ask before each workout' },
                { value: 'never', label: 'Never show warmup' }
            ],
            selectedValue: this.preferences.warmupBehavior
        });

        // Warmup Preset dropdown
        this.dropdowns.warmupPreset = new CustomDropdown('warmup-preset-dropdown', {
            items: [
                { value: 'standard', label: 'Standard (5 sets)' },
                { value: 'quick', label: 'Quick (3 sets)' },
                { value: 'custom', label: 'Custom' }
            ],
            selectedValue: this.preferences.warmupPreset,
            onChange: (value) => {
                const customConfig = document.getElementById('warmup-custom-config');
                if (value === 'custom') {
                    customConfig.style.display = 'block';
                } else {
                    customConfig.style.display = 'none';
                    // Load preset values
                    this.loadPresetWarmup(value);
                }
            }
        });

        // Week Start Day dropdown
        this.dropdowns.weekStartDay = new CustomDropdown('week-start-day-dropdown', {
            items: dayNames.map((day, index) => ({ value: index.toString(), label: day })),
            selectedValue: this.preferences.weekStartDay.toString()
        });

        // Rest Timer Duration dropdown
        this.dropdowns.restTimerDuration = new CustomDropdown('rest-timer-duration-dropdown', {
            items: [
                { value: '30', label: '30 seconds' },
                { value: '45', label: '45 seconds' },
                { value: '60', label: '1 minute' },
                { value: '90', label: '1.5 minutes' },
                { value: '120', label: '2 minutes' },
                { value: '180', label: '3 minutes' },
                { value: '300', label: '5 minutes' }
            ],
            selectedValue: this.preferences.restTimerDuration.toString()
        });
    }

    renderWarmupSets() {
        let html = '';
        const count = this.preferences.warmupPercentages.length;
        
        for (let i = 0; i < count; i++) {
            html += `
                <div class="warmup-set-row" data-index="${i}" style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; margin-bottom: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600;">Percentage</label>
                        <input type="number" class="input warmup-percentage" value="${this.preferences.warmupPercentages[i]}" min="1" max="100" style="width: 100%;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600;">Reps</label>
                        <input type="number" class="input warmup-reps" value="${this.preferences.warmupReps[i]}" min="1" max="20" style="width: 100%;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600;">Sets</label>
                        <input type="number" class="input warmup-sets" value="${this.preferences.warmupSets[i]}" min="1" max="5" style="width: 100%;">
                    </div>
                    <button type="button" class="btn btn-secondary remove-warmup-set-btn" style="padding: 8px 12px;">✕</button>
                </div>
            `;
        }
        
        return html;
    }

    attachListeners() {
        // Add warmup set
        document.getElementById('add-warmup-set-btn')?.addEventListener('click', () => {
            this.preferences.warmupPercentages.push(95);
            this.preferences.warmupReps.push(1);
            this.preferences.warmupSets.push(1);
            document.getElementById('warmup-sets-container').innerHTML = this.renderWarmupSets();
            this.attachWarmupSetListeners();
        });

        this.attachWarmupSetListeners();

        // Outbound integration enabled toggle
        document.getElementById('outbound-integration-enabled')?.addEventListener('change', (e) => {
            const urlInput = document.getElementById('outbound-integration-url');
            if (urlInput) {
                urlInput.disabled = !e.target.checked;
            }
        });

        // Inbound integration enabled toggle
        document.getElementById('inbound-integration-enabled')?.addEventListener('change', (e) => {
            const urlInput = document.getElementById('inbound-integration-url');
            const copyBtn = document.getElementById('copy-inbound-url-btn');
            if (urlInput) urlInput.disabled = !e.target.checked;
            if (copyBtn) copyBtn.disabled = !e.target.checked;
        });

        // Copy inbound URL button
        document.getElementById('copy-inbound-url-btn')?.addEventListener('click', async () => {
            const urlInput = document.getElementById('inbound-integration-url');
            if (urlInput) {
                try {
                    await navigator.clipboard.writeText(urlInput.value);
                    notification.success('API URL copied to clipboard!');
                } catch (error) {
                    // Fallback for older browsers
                    urlInput.select();
                    document.execCommand('copy');
                    notification.success('API URL copied to clipboard!');
                }
            }
        });

        // Form submission
        document.getElementById('preferences-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.savePreferences();
        });

        // Reset to defaults
        document.getElementById('reset-defaults-btn')?.addEventListener('click', async () => {
            if (confirm('Reset all preferences to default values?')) {
                await this.resetToDefaults();
            }
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', async () => {
            const isGuest = localStorage.getItem('gymlogger_isGuest') === 'true';
            const message = isGuest 
                ? 'Clear your guest session and all local data?' 
                : 'Sign out of your account?';
            
            if (confirm(message)) {
                await authManager.logout();
            }
        });
    }

    attachWarmupSetListeners() {
        document.querySelectorAll('.remove-warmup-set-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const row = e.target.closest('.warmup-set-row');
                const index = parseInt(row.dataset.index);
                
                if (this.preferences.warmupPercentages.length <= 1) {
                    notification.warning('You must have at least one warmup set');
                    return;
                }
                
                this.preferences.warmupPercentages.splice(index, 1);
                this.preferences.warmupReps.splice(index, 1);
                this.preferences.warmupSets.splice(index, 1);
                
                document.getElementById('warmup-sets-container').innerHTML = this.renderWarmupSets();
                this.attachWarmupSetListeners();
            });
        });
    }

    loadPresetWarmup(preset) {
        if (preset === 'standard') {
            this.preferences.warmupPercentages = [50, 60, 70, 80, 90];
            this.preferences.warmupReps = [5, 5, 3, 2, 1];
            this.preferences.warmupSets = [2, 1, 1, 1, 1];
        } else if (preset === 'quick') {
            this.preferences.warmupPercentages = [60, 75, 90];
            this.preferences.warmupReps = [5, 3, 1];
            this.preferences.warmupSets = [1, 1, 1];
        }
        
        document.getElementById('warmup-sets-container').innerHTML = this.renderWarmupSets();
        this.attachWarmupSetListeners();
    }

    async savePreferences() {
        try {
            // Collect warmup data from custom config if visible
            if (document.getElementById('warmup-custom-config').style.display !== 'none') {
                this.preferences.warmupPercentages = [];
                this.preferences.warmupReps = [];
                this.preferences.warmupSets = [];
                
                document.querySelectorAll('.warmup-set-row').forEach(row => {
                    const percentage = parseInt(row.querySelector('.warmup-percentage').value);
                    const reps = parseInt(row.querySelector('.warmup-reps').value);
                    const sets = parseInt(row.querySelector('.warmup-sets').value);
                    
                    this.preferences.warmupPercentages.push(percentage);
                    this.preferences.warmupReps.push(reps);
                    this.preferences.warmupSets.push(sets);
                });
            }

            // Collect all form data
            const formData = {
                warmupBehavior: this.dropdowns.warmupBehavior.getValue(),
                warmupPreset: this.dropdowns.warmupPreset.getValue(),
                warmupPercentages: this.preferences.warmupPercentages,
                warmupReps: this.preferences.warmupReps,
                warmupSets: this.preferences.warmupSets,
                defaultWeightUnit: document.querySelector('input[name="weight-unit"]:checked').value,
                weekStartDay: parseInt(this.dropdowns.weekStartDay.getValue()),
                theme: document.querySelector('input[name="theme"]:checked').value,
                soundEnabled: document.getElementById('sound-enabled').checked,
                restTimerDuration: parseInt(this.dropdowns.restTimerDuration.getValue()),
                outboundIntegrationEnabled: document.getElementById('outbound-integration-enabled').checked,
                outboundIntegrationUrl: document.getElementById('outbound-integration-url').value.trim() || null,
                inboundIntegrationEnabled: document.getElementById('inbound-integration-enabled').checked
            };

            await api.updatePreferences(formData);
            notification.success('Preferences saved successfully');
            
            // Apply and persist theme immediately
            themeManager.setTheme(formData.theme);
        } catch (error) {
            console.error('Error saving preferences:', error);
            notification.error('Error saving preferences: ' + error.message);
        }
    }

    async resetToDefaults() {
        try {
            const defaults = {
                warmupBehavior: 'ask',
                warmupPreset: 'standard',
                warmupPercentages: [50, 60, 70, 80, 90],
                warmupReps: [5, 5, 3, 2, 1],
                warmupSets: [2, 1, 1, 1, 1],
                defaultWeightUnit: 'KG',
                weekStartDay: 0,
                theme: 'light',
                soundEnabled: true,
                restTimerDuration: 90,
                outboundIntegrationEnabled: false,
                outboundIntegrationUrl: null,
                inboundIntegrationEnabled: false
            };

            await api.updatePreferences(defaults);
            this.preferences = defaults;
            notification.success('Preferences reset to defaults');
            
            // Apply and persist theme
            themeManager.setTheme(defaults.theme);
            
            // Destroy old dropdowns
            Object.values(this.dropdowns).forEach(dropdown => {
                if (dropdown) dropdown.destroy();
            });
            
            this.renderPreferences();
        } catch (error) {
            notification.error('Error resetting preferences: ' + error.message);
        }
    }

    applyTheme(theme) {
        // Use theme manager for consistency
        themeManager.setTheme(theme);
    }
}
