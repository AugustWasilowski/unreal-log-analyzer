// UI management and rendering
class UI {
    constructor() {
        this.elements = {
            uploadForm: document.getElementById('uploadForm'),
            logFile: document.getElementById('logFile'),
            uploadButton: document.getElementById('uploadButton'),
            logContent: document.getElementById('logContent'),
            logSearchInput: document.getElementById('logSearchInput'),
            logTypeFilters: document.getElementById('logTypeFilters'),
            logLevelFilters: document.getElementById('logLevelFilters'),
            copyButton: document.getElementById('copyButton'),
            copyToast: document.getElementById('copyToast')
        };
    }

    // Display log entries with DocumentFragment for performance
    displayLogEntries(entries) {
        // Remove only log entries, preserve the copy button
        const logEntries = this.elements.logContent.querySelectorAll('.log-entry');
        logEntries.forEach(entry => entry.remove());
        
        // Use DocumentFragment for batch DOM updates
        const fragment = document.createDocumentFragment();
        
        entries.forEach(entry => {
            const div = Utils.createElement('div', 'log-entry', { tabindex: '0' });
            const level = window.app.appState.detectLogLevel(entry.content);
            const levelClass = Utils.getLogLevelClass(level);
            
            // Create spans for proper styling without XSS vulnerability
            const typeSpan = Utils.createElement('span', 'log-type');
            typeSpan.textContent = entry.type;
            
            const contentSpan = Utils.createElement('span', levelClass);
            contentSpan.textContent = entry.content;
            
            div.appendChild(typeSpan);
            div.appendChild(Utils.createTextNode(' '));
            div.appendChild(contentSpan);
            fragment.appendChild(div);
        });
        
        this.elements.logContent.appendChild(fragment);
    }

    // Create log type filters
    createLogTypeFilters(logTypes) {
        this.elements.logTypeFilters.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        
        logTypes.forEach(typeObj => {
            const type = typeObj.type;
            const count = typeObj.count;
            const col = Utils.createElement('div', 'col-md-3 mb-2');
            
            const checkbox = Utils.createElement('div', 'form-check');
            checkbox.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${Utils.sanitizeInput(type)}" id="filter_${Utils.sanitizeInput(type)}">
                <label class="form-check-label" for="filter_${Utils.sanitizeInput(type)}">
                    ${Utils.sanitizeInput(type)} <span class="badge bg-secondary" id="badge-type-${Utils.sanitizeInput(type)}">${count}</span>
                </label>
            `;
            
            checkbox.querySelector('input').addEventListener('change', () => {
                this.updateTypeFilters();
            });
            
            col.appendChild(checkbox);
            fragment.appendChild(col);
        });
        
        this.elements.logTypeFilters.appendChild(fragment);
    }

    // Update log level counts
    updateLogLevelCounts(entries) {
        const counts = { Display: 0, Warning: 0, Error: 0 };
        entries.forEach(entry => {
            const level = window.app.appState.detectLogLevel(entry.content);
            if (level && counts.hasOwnProperty(level)) {
                counts[level]++;
            }
        });
        
        document.getElementById('count-Display').textContent = counts.Display;
        document.getElementById('count-Warning').textContent = counts.Warning;
        document.getElementById('count-Error').textContent = counts.Error;
    }

    // Update log type counts
    updateLogTypeCounts(entries, logTypes) {
        const counts = {};
        logTypes.forEach(typeObj => counts[typeObj.type] = 0);
        
        entries.forEach(entry => {
            const level = window.app.appState.detectLogLevel(entry.content);
            const state = window.app.appState.getState();
            
            if (state.filters.levels.length && !state.filters.levels.includes(level)) return;
            if (state.filters.search && !entry.content.toLowerCase().includes(state.filters.search.toLowerCase())) return;
            if (counts.hasOwnProperty(entry.type)) counts[entry.type]++;
        });
        
        logTypes.forEach(typeObj => {
            const badge = document.getElementById(`badge-type-${typeObj.type}`);
            if (badge) badge.textContent = counts[typeObj.type];
        });
    }

    // Update type filters from UI
    updateTypeFilters() {
        const selectedTypes = Array.from(document.querySelectorAll('#logTypeFilters input:checked'))
            .map(checkbox => checkbox.value);
        window.app.appState.updateFilters({ types: selectedTypes });
    }

    // Get selected log levels from UI
    getSelectedLogLevels() {
        return Array.from(document.querySelectorAll('.log-level-filter:checked'))
            .map(cb => cb.value);
    }

    // Get search term from UI
    getSearchTerm() {
        return this.elements.logSearchInput.value.trim();
    }

    // Update button text
    updateButtonText(text) {
        this.elements.uploadButton.textContent = text;
    }

    // Set button disabled state
    setButtonDisabled(disabled) {
        this.elements.uploadButton.disabled = disabled;
    }

    // Focus management for accessibility
    focusSearchInput() {
        this.elements.logSearchInput.focus();
    }

    focusCopyButton() {
        this.elements.copyButton.focus();
    }

    // Keyboard navigation support
    setupKeyboardNavigation() {
        // Focus trap for modal-like behavior
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any open dropdowns or modals
                const openDropdowns = document.querySelectorAll('.collapse.show');
                openDropdowns.forEach(dropdown => {
                    const bsCollapse = bootstrap.Collapse.getInstance(dropdown);
                    if (bsCollapse) bsCollapse.hide();
                });
            }
            
            // Global keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'f':
                        e.preventDefault();
                        this.focusSearchInput();
                        break;
                    case 'c':
                        e.preventDefault();
                        this.copyFilteredResults();
                        break;
                    case 'o':
                        e.preventDefault();
                        this.elements.logFile.click();
                        break;
                }
            }
        });

        // Search input keyboard shortcuts
        this.elements.logSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Trigger search or focus next element
                this.elements.copyButton.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.elements.logSearchInput.value = '';
                this.elements.logSearchInput.dispatchEvent(new Event('input'));
            }
        });

        // Copy button keyboard shortcuts
        this.elements.copyButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.copyFilteredResults();
            }
        });

        // File input keyboard shortcuts
        this.elements.logFile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.elements.logFile.click();
            }
        });

        // Upload button keyboard shortcuts
        this.elements.uploadButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.elements.uploadForm.requestSubmit();
            }
        });

        // Log container keyboard navigation
        this.elements.logContent.addEventListener('keydown', (e) => {
            const logEntries = this.elements.logContent.querySelectorAll('.log-entry');
            const currentIndex = Array.from(logEntries).findIndex(entry => 
                entry === document.activeElement || entry.contains(document.activeElement)
            );

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < logEntries.length - 1) {
                        logEntries[currentIndex + 1].focus();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        logEntries[currentIndex - 1].focus();
                    } else {
                        this.elements.copyButton.focus();
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    if (logEntries.length > 0) {
                        logEntries[0].focus();
                    }
                    break;
                case 'End':
                    e.preventDefault();
                    if (logEntries.length > 0) {
                        logEntries[logEntries.length - 1].focus();
                    }
                    break;
            }
        });

        // Make log entries focusable
        this.elements.logContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('log-entry')) {
                e.target.focus();
            }
        });
    }

    // Copy filtered results
    async copyFilteredResults() {
        const logEntries = this.elements.logContent.querySelectorAll('.log-entry');
        
        if (logEntries.length === 0) {
            Utils.showErrorToast('No filtered results to copy');
            return;
        }
        
        let textToCopy = '';
        logEntries.forEach(entry => {
            textToCopy += entry.textContent + '\n';
        });
        
        const success = await Utils.copyToClipboard(textToCopy);
        if (success) {
            Utils.showSuccessToast('Copied filtered results to clipboard!');
        } else {
            Utils.showErrorToast('Failed to copy to clipboard. Please try again.');
        }
    }
}

// Export for use in other modules
window.UI = UI; 