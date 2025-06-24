// UI management and rendering - VERSION 1.3

class UI {
    constructor() {
        // Don't initialize elements immediately - wait for app to call initialize()
        this.elements = {};
        this.initialized = false;
    }

    initializeElements() {
        this.elements = {
            uploadForm: document.getElementById('uploadForm'),
            logFile: document.getElementById('logFile'),
            uploadButton: document.getElementById('uploadButton'),
            logContent: document.getElementById('logContent'),
            logSearchInput: document.getElementById('logSearchInput'),
            logTypeFilters: document.getElementById('logTypeFilters'),
            logLevelFilters: document.getElementById('logLevelFilters'),
            copyButton: document.getElementById('copyButton'),
            copyToast: document.getElementById('copyToast'),
            dropZone: document.getElementById('dropZone'),
            exportCsv: document.getElementById('exportCsv'),
            exportJson: document.getElementById('exportJson'),
            caseSensitive: document.getElementById('caseSensitive'),
            useRegex: document.getElementById('useRegex'),
            searchHistory: document.getElementById('searchHistory'),
            clearHistory: document.getElementById('clearHistory')
        };
    }

    // Initialize UI after app is ready
    initialize() {
        if (this.initialized) {
            return;
        }
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initialize();
            });
            return;
        }
        
        // Check for dependencies
        console.log('Checking dependencies...');
        console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
        console.log('jQuery available:', typeof $ !== 'undefined');
        
        // Initialize elements first
        this.initializeElements();
        
        console.log('Setting up drag and drop...');
        this.setupDragAndDrop();
        console.log('Setting up search history...');
        this.setupSearchHistory();
        console.log('Setting up keyboard navigation...');
        this.setupKeyboardNavigation();
        this.initialized = true;
    }

    // Setup drag and drop functionality
    setupDragAndDrop() {
        const dropZone = this.elements.dropZone;
        
        // Check if dropZone exists
        if (!dropZone) {
            return;
        }
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
                if (window.app && window.app.appState) {
                    window.app.appState.update({ ui: { dragOver: true } });
                }
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
                if (window.app && window.app.appState) {
                    window.app.appState.update({ ui: { dragOver: false } });
                }
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type === 'text/plain' || file.name.endsWith('.log') || file.name.endsWith('.txt')) {
                    this.elements.logFile.files = e.dataTransfer.files;
                    this.elements.uploadForm.requestSubmit();
                } else {
                    Utils.showErrorToast('Please select a valid log file (.log or .txt)');
                }
            }
        });

        // Click to browse
        dropZone.addEventListener('click', () => {
            this.elements.logFile.click();
        });

        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.elements.logFile.click();
            }
        });
    }

    // Setup search history functionality
    setupSearchHistory() {
        const historyContainer = this.elements.searchHistory;
        const clearHistoryBtn = this.elements.clearHistory;
        
        // Check if elements exist
        if (!historyContainer || !clearHistoryBtn) {
            return;
        }
        
        // Update search history display
        const updateHistoryDisplay = () => {
            if (!window.app || !window.app.appState) return;
            
            const history = window.app.appState.getState().searchHistory;
            
            if (history.length === 0) {
                historyContainer.innerHTML = '<em class="text-muted">No recent searches</em>';
                return;
            }
            
            historyContainer.innerHTML = history.map(term => 
                `<button class="dropdown-item search-history-item" data-term="${Utils.sanitizeInput(term)}">${Utils.sanitizeInput(term)}</button>`
            ).join('');
            
            // Add click handlers to history items
            historyContainer.querySelectorAll('.search-history-item').forEach(button => {
                button.addEventListener('click', () => {
                    const term = button.dataset.term;
                    this.elements.logSearchInput.value = term;
                    this.elements.logSearchInput.dispatchEvent(new Event('input'));
                });
            });
        };

        // Clear history button
        clearHistoryBtn.addEventListener('click', () => {
            if (window.app && window.app.appState) {
                window.app.appState.clearSearchHistory();
                updateHistoryDisplay();
            }
        });

        // Subscribe to state changes for history updates
        if (window.app && window.app.appState) {
            window.app.appState.subscribe(() => {
                updateHistoryDisplay();
            });
        }
    }

    // Display log entries with DocumentFragment for performance
    displayLogEntries(entries) {
        // Remove only log entries, preserve the copy button and export buttons
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
        
        // Announce to screen readers
        Utils.announceToScreenReader(`Displaying ${Utils.formatNumber(entries.length)} log entries`);
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
        window.app.updateDisplay();
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

    // Get search options from UI
    getSearchOptions() {
        const options = {
            caseSensitive: this.elements.caseSensitive.checked,
            useRegex: this.elements.useRegex.checked
        };
        
        // Validate regex if enabled
        if (options.useRegex && this.elements.logSearchInput.value) {
            if (!Utils.isValidRegex(this.elements.logSearchInput.value)) {
                Utils.showErrorToast('Invalid regular expression pattern');
                return {
                    caseSensitive: options.caseSensitive,
                    useRegex: false // Disable regex on invalid pattern
                };
            }
        }
        
        return options;
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

    // Export functionality
    exportToCsv() {
        const entries = window.app.appState.getFilteredEntries();
        const csvContent = this.generateCsvContent(entries);
        this.downloadFile(csvContent, 'log_entries.csv', 'text/csv');
    }

    exportToJson() {
        const entries = window.app.appState.getFilteredEntries();
        const jsonContent = JSON.stringify(entries, null, 2);
        this.downloadFile(jsonContent, 'log_entries.json', 'application/json');
    }

    generateCsvContent(entries) {
        const headers = ['Type', 'Level', 'Content'];
        const rows = entries.map(entry => [
            entry.type,
            window.app.appState.detectLogLevel(entry.content),
            entry.content.replace(/"/g, '""') // Escape quotes for CSV
        ]);
        
        const csvRows = [headers, ...rows];
        return csvRows.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                    case 's':
                        e.preventDefault();
                        this.exportToCsv();
                        break;
                    case 'j':
                        e.preventDefault();
                        this.exportToJson();
                        break;
                }
            }
        });

        // Search input keyboard shortcuts
        this.elements.logSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Add to search history and trigger search
                const term = this.getSearchTerm();
                if (term) {
                    window.app.appState.addToSearchHistory(term);
                }
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

        // Export buttons keyboard shortcuts
        this.elements.exportCsv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.exportToCsv();
            }
        });

        this.elements.exportJson.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.exportToJson();
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

    // Copy filtered results to clipboard
    async copyFilteredResults() {
        const entries = window.app.appState.getFilteredEntries();
        if (entries.length === 0) {
            Utils.showErrorToast('No entries to copy');
            return;
        }

        const text = entries.map(entry => `${entry.type}: ${entry.content}`).join('\n');
        const success = await Utils.copyToClipboard(text);
        
        if (success) {
            Utils.showSuccessToast('Copied to clipboard!');
        } else {
            Utils.showErrorToast('Failed to copy to clipboard');
        }
    }
}

// Export for use in other modules
window.UI = UI; 