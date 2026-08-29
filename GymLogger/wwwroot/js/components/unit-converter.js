const KG_TO_LBS = 2.20462;

export function convertKgToLbs(kg) {
    return kg * KG_TO_LBS;
}

export function convertLbsToKg(lbs) {
    return lbs / KG_TO_LBS;
}

export function renderUnitConverter(options = {}) {
    const includeHeading = options.includeHeading !== false;
    const includeQuickReference = options.includeQuickReference !== false;

    return `
        <div class="utility-section unit-converter">
            ${includeHeading ? `
                <h3 style="margin-bottom: 16px;">Weight Unit Converter</h3>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">
                    Convert between kilograms (KG) and pounds (LBS).
                </p>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 24px; max-width: 800px;">
                <div class="converter-card">
                    <h4 style="margin-bottom: 12px;">KG → LBS</h4>
                    <div style="margin-bottom: 12px;">
                        <label class="form-label" for="kg-input">Kilograms</label>
                        <input type="number" id="kg-input" class="form-input"
                               placeholder="Enter kg" value="100" min="0" step="any">
                    </div>
                    <div style="background: var(--surface); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Result</div>
                        <div id="lbs-result" aria-live="polite" style="font-size: 32px; font-weight: 700; color: var(--primary-color);">220.46</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">LBS</div>
                    </div>
                </div>

                <div class="converter-card">
                    <h4 style="margin-bottom: 12px;">LBS → KG</h4>
                    <div style="margin-bottom: 12px;">
                        <label class="form-label" for="lbs-input">Pounds</label>
                        <input type="number" id="lbs-input" class="form-input"
                               placeholder="Enter lbs" value="220" min="0" step="any">
                    </div>
                    <div style="background: var(--surface); padding: 16px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Result</div>
                        <div id="kg-result" aria-live="polite" style="font-size: 32px; font-weight: 700; color: var(--primary-color);">99.79</div>
                        <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">KG</div>
                    </div>
                </div>
            </div>

            ${includeQuickReference ? `
                <div style="margin-top: 32px; max-width: 600px;">
                    <h4 style="margin-bottom: 12px;">Quick Reference</h4>
                    <div style="background: var(--surface); padding: 16px; border-radius: 8px;">
                        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: 14px;">
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
            ` : ''}
        </div>
    `;
}

export function attachUnitConverterListeners(root = document) {
    const kgInput = root.querySelector('#kg-input');
    const lbsInput = root.querySelector('#lbs-input');
    const lbsResult = root.querySelector('#lbs-result');
    const kgResult = root.querySelector('#kg-result');

    const updateLbs = () => {
        const kg = parseFloat(kgInput?.value) || 0;
        if (lbsResult) {
            lbsResult.textContent = convertKgToLbs(kg).toFixed(2);
        }
    };

    const updateKg = () => {
        const lbs = parseFloat(lbsInput?.value) || 0;
        if (kgResult) {
            kgResult.textContent = convertLbsToKg(lbs).toFixed(2);
        }
    };

    kgInput?.addEventListener('input', updateLbs);
    lbsInput?.addEventListener('input', updateKg);
    updateLbs();
    updateKg();
}

function renderDialogConverter(direction) {
    const isKgToLbs = direction === 'kg-to-lbs';
    const inputId = isKgToLbs ? 'dialog-converter-input-kg' : 'dialog-converter-input-lbs';
    const inputLabel = isKgToLbs ? 'Kilograms' : 'Pounds';
    const inputUnit = isKgToLbs ? 'KG' : 'LBS';
    const resultUnit = isKgToLbs ? 'LBS' : 'KG';
    const defaultValue = isKgToLbs ? 100 : 220;
    const defaultResult = isKgToLbs
        ? convertKgToLbs(defaultValue)
        : convertLbsToKg(defaultValue);

    return `
        <div class="converter-card" style="max-width: 480px; margin: 0 auto;">
            <div style="margin-bottom: 12px;">
                <label class="form-label" for="${inputId}">${inputLabel}</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" id="${inputId}" class="form-input dialog-converter-input"
                           value="${defaultValue}" min="0" step="any" data-direction="${direction}">
                    <strong style="min-width: 36px;">${inputUnit}</strong>
                </div>
            </div>
            <div style="background: var(--surface); padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Result</div>
                <div id="dialog-converter-result" aria-live="polite"
                     style="font-size: 36px; font-weight: 700; color: var(--primary-color);">${defaultResult.toFixed(2)}</div>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${resultUnit}</div>
            </div>
        </div>
    `;
}

class UnitConverterDialog {
    show() {
        document.getElementById('unit-converter-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'unit-converter-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.2s ease-in-out;
        `;
        overlay.innerHTML = `
            <div class="card" role="dialog" aria-modal="true" aria-labelledby="unit-converter-title"
                 style="max-width: 760px; width: 100%; max-height: 90vh; overflow-y: auto; margin: 0; animation: slideUp 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div class="card-header" id="unit-converter-title" style="margin: 0;">Unit Converter</div>
                    <button type="button" class="btn btn-secondary" id="close-unit-converter-btn"
                            aria-label="Close unit converter" style="padding: 8px 16px;">✕</button>
                </div>
                <div role="group" aria-label="Conversion direction"
                     style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-width: 480px; margin: 0 auto 24px; padding: 4px; background: var(--surface); border-radius: 10px;">
                    <button type="button" class="btn btn-primary unit-converter-direction" data-direction="kg-to-lbs"
                            aria-pressed="true">KG → LBS</button>
                    <button type="button" class="btn btn-secondary unit-converter-direction" data-direction="lbs-to-kg"
                            aria-pressed="false">LBS → KG</button>
                </div>
                <div id="dialog-converter-content">
                    ${renderDialogConverter('kg-to-lbs')}
                </div>
            </div>
        `;

        const close = () => {
            document.removeEventListener('keydown', handleEscape);
            overlay.remove();
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                close();
            }
        };

        document.body.appendChild(overlay);

        const attachDialogInputListener = () => {
            const input = overlay.querySelector('.dialog-converter-input');
            const result = overlay.querySelector('#dialog-converter-result');
            input?.addEventListener('input', () => {
                const value = parseFloat(input.value) || 0;
                const convertedValue = input.dataset.direction === 'kg-to-lbs'
                    ? convertKgToLbs(value)
                    : convertLbsToKg(value);
                if (result) {
                    result.textContent = convertedValue.toFixed(2);
                }
            });
        };

        attachDialogInputListener();
        overlay.querySelectorAll('.unit-converter-direction').forEach(button => {
            button.addEventListener('click', () => {
                const direction = button.dataset.direction;
                overlay.querySelectorAll('.unit-converter-direction').forEach(directionButton => {
                    const isActive = directionButton === button;
                    directionButton.classList.toggle('btn-primary', isActive);
                    directionButton.classList.toggle('btn-secondary', !isActive);
                    directionButton.setAttribute('aria-pressed', isActive.toString());
                });
                const content = overlay.querySelector('#dialog-converter-content');
                if (content) {
                    content.innerHTML = renderDialogConverter(direction);
                    attachDialogInputListener();
                    content.querySelector('.dialog-converter-input')?.focus();
                }
            });
        });

        overlay.querySelector('#close-unit-converter-btn')?.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                close();
            }
        });
        document.addEventListener('keydown', handleEscape);
        overlay.querySelector('.dialog-converter-input')?.focus();
    }
}

export const unitConverterDialog = new UnitConverterDialog();