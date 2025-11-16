/**
 * Custom Dropdown Component
 * Creates styled dropdowns with better UX than native select elements
 */
export class CustomDropdown {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            placeholder: options.placeholder || 'Select an option',
            items: options.items || [],
            selectedValue: options.selectedValue || '',
            onChange: options.onChange || (() => {}),
            className: options.className || ''
        };
        this.isOpen = false;
        this.render();
    }

    render() {
        if (!this.container) return;

        const selectedItem = this.options.items.find(item => item.value === this.options.selectedValue);
        const displayText = selectedItem ? selectedItem.label : this.options.placeholder;

        this.container.innerHTML = `
            <div class="custom-dropdown ${this.options.className}">
                <button type="button" class="custom-dropdown-trigger" aria-haspopup="listbox" aria-expanded="false">
                    <span class="custom-dropdown-value">${displayText}</span>
                    <svg class="custom-dropdown-icon" width="12" height="8" viewBox="0 0 12 8" fill="none">
                        <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="custom-dropdown-menu" role="listbox" style="display: none;">
                    ${this.options.items.map(item => `
                        <div class="custom-dropdown-item ${item.value === this.options.selectedValue ? 'selected' : ''}" 
                             data-value="${item.value}" 
                             role="option"
                             aria-selected="${item.value === this.options.selectedValue}">
                            ${item.label}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        const trigger = this.container.querySelector('.custom-dropdown-trigger');
        const menu = this.container.querySelector('.custom-dropdown-menu');
        const items = this.container.querySelectorAll('.custom-dropdown-item');

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Handle item selection
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                this.selectValue(value);
                this.close();
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });

        // Keyboard navigation
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        const menu = this.container.querySelector('.custom-dropdown-menu');
        const trigger = this.container.querySelector('.custom-dropdown-trigger');
        const icon = this.container.querySelector('.custom-dropdown-icon');
        
        menu.style.display = 'block';
        trigger.setAttribute('aria-expanded', 'true');
        icon.style.transform = 'rotate(180deg)';
        this.isOpen = true;
    }

    close() {
        const menu = this.container.querySelector('.custom-dropdown-menu');
        const trigger = this.container.querySelector('.custom-dropdown-trigger');
        const icon = this.container.querySelector('.custom-dropdown-icon');
        
        menu.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        icon.style.transform = 'rotate(0deg)';
        this.isOpen = false;
    }

    selectValue(value) {
        this.options.selectedValue = value;
        const selectedItem = this.options.items.find(item => item.value === value);
        
        // Update display
        const displayText = selectedItem ? selectedItem.label : this.options.placeholder;
        this.container.querySelector('.custom-dropdown-value').textContent = displayText;
        
        // Update selected state
        this.container.querySelectorAll('.custom-dropdown-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.value === value);
            item.setAttribute('aria-selected', item.dataset.value === value);
        });
        
        // Call onChange callback
        this.options.onChange(value);
    }

    getValue() {
        return this.options.selectedValue;
    }

    setValue(value) {
        this.selectValue(value);
    }

    updateItems(items) {
        this.options.items = items;
        this.render();
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
