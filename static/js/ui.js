// UI management and rendering - VERSION 1.6

class UI {
    constructor() {
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
            clearHistory: document.getElementById('clearHistory'),
            collapseDuplicates: document.getElementById('collapseDuplicates'),
            multiSelect: document.getElementById('multiSelect')
        };
    }

    initialize() {
        if (this.initialized) return;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
            return;
        }
        console.log('Checking dependencies...');
        console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
        console.log('jQuery available:', typeof $ !== 'undefined');
        this.initializeElements();
        console.log('Setting up search history...');
        this.setupSearchHistory();
        console.log('Setting up keyboard navigation...');
        this.setupKeyboardNavigation();
        if (this.elements.multiSelect) {
            this.elements.multiSelect.addEventListener('change', () => window.app.updateDisplay());
        }
        this.initialized = true;
    }

    setupDragAndDrop() { return; }

    setupSearchHistory() {
        const historyContainer = this.elements.searchHistory;
        const clearHistoryBtn = this.elements.clearHistory;
        if (!historyContainer || !clearHistoryBtn) return;
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
            historyContainer.querySelectorAll('.search-history-item').forEach(button => {
                button.addEventListener('click', () => {
                    this.elements.logSearchInput.value = button.dataset.term;
                    this.elements.logSearchInput.dispatchEvent(new Event('input'));
                });
            });
        };
        clearHistoryBtn.addEventListener('click', () => {
            if (window.app && window.app.appState) {
                window.app.appState.clearSearchHistory();
                updateHistoryDisplay();
            }
        });
        if (window.app && window.app.appState) {
            window.app.appState.subscribe(() => updateHistoryDisplay());
        }
    }

    displayLogEntries(entries) {
        const logEntries = this.elements.logContent.querySelectorAll('.log-entry');
        logEntries.forEach(entry => entry.remove());
        const fragment = document.createDocumentFragment();
        entries.forEach(entry => {
            const div = Utils.createElement('div', 'log-entry', { tabindex: '0' });
            // Store crash-key so crash panel click-to-scroll can find this element.
            div.dataset.crashKey = entry.type + ':' + entry.content.slice(0, 200);

            const level = window.app.appState.detectLogLevel(entry.content);
            const levelClass = Utils.getLogLevelClass(level);
            const displayTimestamp = (entry.duplicateCount > 1 && entry.lastTimestamp)
                ? entry.lastTimestamp : entry.timestamp;
            if (displayTimestamp) {
                const timestampSpan = Utils.createElement('span', 'log-timestamp');
                timestampSpan.textContent = `[${displayTimestamp}]`;
                div.appendChild(timestampSpan);
                div.appendChild(Utils.createTextNode(' '));
            }
            const typeSpan = Utils.createElement('span', 'log-type');
            typeSpan.textContent = entry.type;
            const contentSpan = Utils.createElement('span', levelClass);
            contentSpan.textContent = entry.content;
            contentSpan.style.whiteSpace = 'pre-wrap';
            div.appendChild(typeSpan);
            div.appendChild(Utils.createTextNode(' '));
            div.appendChild(contentSpan);
            if (entry.duplicateCount > 1) {
                div.appendChild(Utils.createTextNode(' '));
                const badge = Utils.createElement('span', 'badge log-duplicate-badge');
                badge.title = `${entry.duplicateCount} occurrences`;
                badge.textContent = `\u00d7${entry.duplicateCount}`;
                div.appendChild(badge);
            }
            fragment.appendChild(div);
        });
        this.elements.logContent.appendChild(fragment);
        Utils.announceToScreenReader(`Displaying ${Utils.formatNumber(entries.length)} log entries`);
    }

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
            checkbox.querySelector('input').addEventListener('change', () => this.updateTypeFilters());
            col.appendChild(checkbox);
            fragment.appendChild(col);
        });
        this.elements.logTypeFilters.appendChild(fragment);
    }

    updateLogLevelCounts(entries) {
        const counts = { Display: 0, Warning: 0, Error: 0 };
        entries.forEach(entry => {
            const level = window.app.appState.detectLogLevel(entry.content);
            if (level && counts.hasOwnProperty(level)) counts[level]++;
        });
        document.getElementById('count-Display').textContent = counts.Display;
        document.getElementById('count-Warning').textContent = counts.Warning;
        document.getElementById('count-Error').textContent = counts.Error;
    }

    updateLogTypeCounts(entries, logTypes) {
        const multiSelect = this.elements.multiSelect && this.elements.multiSelect.checked;
        const state = window.app.appState.getState();
        const counts = {};
        logTypes.forEach(typeObj => counts[typeObj.type] = 0);
        if (multiSelect) {
            state.allEntries.forEach(entry => {
                if (!counts.hasOwnProperty(entry.type)) return;
                const level = window.app.appState.detectLogLevel(entry.content);
                if (state.filters.levels.length && !state.filters.levels.includes(level)) return;
                if (state.filters.search) {
                    const searchContent = state.filters.caseSensitive ? entry.content : entry.content.toLowerCase();
                    const searchTerm = state.filters.caseSensitive ? state.filters.search : state.filters.search.toLowerCase();
                    if (state.filters.useRegex) {
                        try {
                            if (!new RegExp(searchTerm, state.filters.caseSensitive ? '' : 'i').test(entry.content)) return;
                        } catch (e) {
                            if (!searchContent.includes(searchTerm)) return;
                        }
                    } else {
                        if (!searchContent.includes(searchTerm)) return;
                    }
                }
                counts[entry.type]++;
            });
        } else {
            entries.forEach(entry => {
                if (counts.hasOwnProperty(entry.type)) counts[entry.type]++;
            });
        }
        let levelCounts = null;
        if (multiSelect) {
            levelCounts = {};
            logTypes.forEach(typeObj => levelCounts[typeObj.type] = 0);
            state.allEntries.forEach(entry => {
                const level = window.app.appState.detectLogLevel(entry.content);
                if (state.filters.levels.length && !state.filters.levels.includes(level)) return;
                if (levelCounts.hasOwnProperty(entry.type)) levelCounts[entry.type]++;
            });
        }
        logTypes.forEach(typeObj => {
            const badge = document.getElementById(`badge-type-${typeObj.type}`);
            if (badge) {
                const count = counts[typeObj.type];
                badge.textContent = count;
                const col = badge.closest('.col-md-3');
                if (col) {
                    const hasLevelMatches = multiSelect && levelCounts[typeObj.type] > 0;
                    col.style.display = (count > 0 || hasLevelMatches) ? '' : 'none';
                }
            }
        });
    }

    updateTypeFilters() {
        const selectedTypes = Array.from(document.querySelectorAll('#logTypeFilters input:checked'))
            .map(checkbox => checkbox.value);
        window.app.appState.updateFilters({ types: selectedTypes });
        window.app.updateDisplay();
    }

    getSelectedLogLevels() {
        return Array.from(document.querySelectorAll('.log-level-filter:checked')).map(cb => cb.value);
    }

    getSearchTerm() { return this.elements.logSearchInput.value.trim(); }

    getCollapseDuplicates() {
        return this.elements.collapseDuplicates ? this.elements.collapseDuplicates.checked : false;
    }

    getSearchOptions() {
        const options = {
            caseSensitive: this.elements.caseSensitive.checked,
            useRegex: this.elements.useRegex.checked
        };
        if (options.useRegex && this.elements.logSearchInput.value) {
            if (!Utils.isValidRegex(this.elements.logSearchInput.value)) {
                Utils.showErrorToast('Invalid regular expression pattern');
                return { caseSensitive: options.caseSensitive, useRegex: false };
            }
        }
        return options;
    }

    updateButtonText(text) { this.elements.uploadButton.textContent = text; }
    setButtonDisabled(disabled) { this.elements.uploadButton.disabled = disabled; }
    focusSearchInput() { this.elements.logSearchInput.focus(); }
    focusCopyButton() { this.elements.copyButton.focus(); }

    exportToCsv() {
        const entries = window.app.appState.getFilteredEntries();
        const headers = ['Type', 'Level', 'Content'];
        const rows = entries.map(entry => [
            entry.type,
            window.app.appState.detectLogLevel(entry.content),
            entry.content
        ]);
        this.downloadFile(Utils.tableToCSV(headers, rows), 'log_entries.csv', 'text/csv');
    }

    exportToJson() {
        const entries = window.app.appState.getFilteredEntries();
        this.downloadFile(JSON.stringify(entries, null, 2), 'log_entries.json', 'application/json');
    }

    downloadFile(content, filename, mimeType) { Utils.downloadAsFile(content, filename, mimeType); }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.collapse.show').forEach(dropdown => {
                    const bsCollapse = bootstrap.Collapse.getInstance(dropdown);
                    if (bsCollapse) bsCollapse.hide();
                });
            }
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'f': e.preventDefault(); this.focusSearchInput(); break;
                    case 'c': e.preventDefault(); this.copyFilteredResults(); break;
                    case 'o': e.preventDefault(); this.elements.logFile.click(); break;
                    case 's': e.preventDefault(); this.exportToCsv(); break;
                    case 'j': e.preventDefault(); this.exportToJson(); break;
                }
            }
        });
        this.elements.logSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const term = this.getSearchTerm();
                if (term) window.app.appState.addToSearchHistory(term);
                this.elements.copyButton.focus();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.elements.logSearchInput.value = '';
                this.elements.logSearchInput.dispatchEvent(new Event('input'));
            }
        });
        this.elements.copyButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.copyFilteredResults(); }
        });
        this.elements.exportCsv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.exportToCsv(); }
        });
        this.elements.exportJson.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.exportToJson(); }
        });
        this.elements.logContent.addEventListener('keydown', (e) => {
            const logEntries = this.elements.logContent.querySelectorAll('.log-entry');
            const currentIndex = Array.from(logEntries).findIndex(entry =>
                entry === document.activeElement || entry.contains(document.activeElement)
            );
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < logEntries.length - 1) logEntries[currentIndex + 1].focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) logEntries[currentIndex - 1].focus();
                    else this.elements.copyButton.focus();
                    break;
                case 'Home':
                    e.preventDefault();
                    if (logEntries.length > 0) logEntries[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    if (logEntries.length > 0) logEntries[logEntries.length - 1].focus();
                    break;
            }
        });
        this.elements.logContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('log-entry')) e.target.focus();
        });
    }

    async copyFilteredResults() {
        const entries = window.app.appState.getFilteredEntries();
        if (entries.length === 0) { Utils.showErrorToast('No entries to copy'); return; }
        const text = entries.map(entry => `${entry.type}: ${entry.content}`).join('\n');
        const success = await Utils.copyToClipboard(text);
        if (success) Utils.showSuccessToast('Copied to clipboard!');
        else Utils.showErrorToast('Failed to copy to clipboard');
    }
}

window.UI = UI;
