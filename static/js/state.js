// Centralized state management
class AppState {
    constructor() {
        this.state = {
            currentFile: null,
            allEntries: [],
            logTypes: [],
            filters: {
                levels: ['Display', 'Warning', 'Error'],
                types: [],
                search: '',
                caseSensitive: false,
                useRegex: false,
                collapseDuplicates: false
            },
            searchHistory: [],
            ui: {
                dragOver: false,
                searchDropdownOpen: false
            },
            // MemReport state
            memreport: {
                meta: { 
                    engineVersion: "", 
                    map: "", 
                    timestamp: "", 
                    generator: "memreport",
                    platform: "",
                    totalMemoryMB: 0
                },
                sections: [],
                parseErrors: [],
                ui: {
                    pinnedSections: [],
                    collapsedSections: [],
                    sectionFilters: {}, // per-section search terms: { sectionKey: { search: "term" } }
                    sectionSorts: {} // per-section sort state: { sectionKey: { column: index, direction: "asc"|"desc" } }
                }
            },
            // Current route: 'log' or 'memreport'
            currentRoute: 'log'
        };
        this.listeners = [];
        this.subscriptionsPaused = false;
        this.loadFromLocalStorage();
    }

    // Load state from localStorage
    loadFromLocalStorage() {
        try {
            const savedHistory = localStorage.getItem('logAnalyzer_searchHistory');
            if (savedHistory) {
                this.state.searchHistory = JSON.parse(savedHistory);
            }

            // Load MemReport UI preferences
            const savedMemReportUI = localStorage.getItem('logAnalyzer_memreportUI');
            if (savedMemReportUI) {
                const memreportUI = JSON.parse(savedMemReportUI);
                this.state.memreport.ui = {
                    ...this.state.memreport.ui,
                    ...memreportUI
                };
            }
        } catch (error) {
            console.warn('Failed to load saved state:', error);
        }
    }

    // Save state to localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem('logAnalyzer_searchHistory', JSON.stringify(this.state.searchHistory));
        } catch (error) {
            console.warn('Failed to save search history:', error);
        }
    }

    // Save MemReport UI preferences to localStorage
    saveMemReportUIToLocalStorage() {
        try {
            localStorage.setItem('logAnalyzer_memreportUI', JSON.stringify(this.state.memreport.ui));
        } catch (error) {
            console.warn('Failed to save MemReport UI preferences:', error);
        }
    }

    // Get current state
    getState() {
        return { ...this.state };
    }

    // Update state
    update(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyListeners();
    }

    // Update specific part of state
    updateFilters(filters) {
        this.state.filters = { ...this.state.filters, ...filters };
        this.notifyListeners();
    }

    // Add search term to history
    addToSearchHistory(term) {
        if (!term || term.trim() === '') return;
        
        const trimmedTerm = term.trim();
        // Remove if already exists
        this.state.searchHistory = this.state.searchHistory.filter(item => item !== trimmedTerm);
        // Add to beginning
        this.state.searchHistory.unshift(trimmedTerm);
        // Keep only last 10 searches
        this.state.searchHistory = this.state.searchHistory.slice(0, 10);
        
        this.saveToLocalStorage();
        this.notifyListeners();
    }

    // Clear search history
    clearSearchHistory() {
        this.state.searchHistory = [];
        this.saveToLocalStorage();
        this.notifyListeners();
    }

    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Notify all listeners
    notifyListeners() {
        if (this.subscriptionsPaused) {
            return;
        }
        this.listeners.forEach(listener => listener(this.state));
    }

    // Pause state subscriptions
    pauseSubscriptions() {
        this.subscriptionsPaused = true;
    }

    // Resume state subscriptions
    resumeSubscriptions() {
        this.subscriptionsPaused = false;
        // Notify listeners with current state
        this.listeners.forEach(listener => listener(this.state));
    }

    // Utility methods
    setCurrentFile(filename) {
        this.update({ currentFile: filename });
    }

    setAllEntries(entries) {
        this.update({ allEntries: entries });
    }

    setLogTypes(logTypes) {
        this.update({ logTypes });
    }

    getFilteredEntries() {
        const { allEntries, filters } = this.state;
        const filtered = allEntries.filter(entry => {
            // Filter by log type
            if (filters.types.length && !filters.types.includes(entry.type)) {
                return false;
            }

            // Filter by log level
            const level = this.detectLogLevel(entry.content);
            if (filters.levels.length && !filters.levels.includes(level)) {
                return false;
            }

            // Filter by search term
            if (filters.search) {
                const searchTerm = filters.search;
                const content = entry.content;

                if (filters.useRegex) {
                    try {
                        const flags = filters.caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(searchTerm, flags);
                        if (!regex.test(content)) {
                            return false;
                        }
                    } catch (error) {
                        // Invalid regex, fall back to simple search
                        const searchContent = filters.caseSensitive ? content : content.toLowerCase();
                        const searchLower = filters.caseSensitive ? searchTerm : searchTerm.toLowerCase();
                        if (!searchContent.includes(searchLower)) {
                            return false;
                        }
                    }
                } else {
                    const searchContent = filters.caseSensitive ? content : content.toLowerCase();
                    const searchLower = filters.caseSensitive ? searchTerm : searchTerm.toLowerCase();
                    if (!searchContent.includes(searchLower)) {
                        return false;
                    }
                }
            }

            return true;
        });

        // Collapse duplicate entries when the option is enabled
        if (filters.collapseDuplicates) {
            const seen = new Map(); // key -> index in collapsed array
            const collapsed = [];
            for (const entry of filtered) {
                const level = this.detectLogLevel(entry.content);
                const key = entry.type + '\x00' + level + '\x00' + entry.content;
                if (seen.has(key)) {
                    const existing = collapsed[seen.get(key)];
                    existing.duplicateCount++;
                    if (entry.timestamp) {
                        existing.lastTimestamp = entry.timestamp;
                    }
                } else {
                    seen.set(key, collapsed.length);
                    collapsed.push({ ...entry, duplicateCount: 1, lastTimestamp: entry.timestamp || null });
                }
            }
            return collapsed;
        }

        return filtered;
    }

    detectLogLevel(content) {
        if (/\bWarning\b/i.test(content)) return 'Warning';
        if (/\bError\b/i.test(content)) return 'Error';
        if (/\bDisplay\b/i.test(content)) return 'Display';
        return '';
    }

    // MemReport-specific methods
    setCurrentRoute(route) {
        this.update({ currentRoute: route });
    }

    getCurrentRoute() {
        return this.state.currentRoute;
    }

    setMemReportData(memreportData) {
        this.update({ memreport: { ...this.state.memreport, ...memreportData } });
    }

    updateMemReportFilters(sectionKey, filters) {
        const newSectionFilters = { ...this.state.memreport.ui.sectionFilters };
        
        if (filters === null || filters === undefined) {
            // Clear filters for this section
            delete newSectionFilters[sectionKey];
        } else {
            // Update filters for this section
            newSectionFilters[sectionKey] = { 
                ...newSectionFilters[sectionKey], 
                ...filters 
            };
        }
        
        this.update({
            memreport: {
                ...this.state.memreport,
                ui: {
                    ...this.state.memreport.ui,
                    sectionFilters: newSectionFilters
                }
            }
        });
        
        // Persist UI state
        this.saveMemReportUIToLocalStorage();
    }

    updateMemReportSort(sectionKey, sortState) {
        const newSectionSorts = { ...this.state.memreport.ui.sectionSorts };
        
        if (sortState === null || sortState === undefined) {
            // Clear sort for this section
            delete newSectionSorts[sectionKey];
        } else {
            // Update sort for this section
            newSectionSorts[sectionKey] = sortState;
        }
        
        this.update({
            memreport: {
                ...this.state.memreport,
                ui: {
                    ...this.state.memreport.ui,
                    sectionSorts: newSectionSorts
                }
            }
        });
        
        // Persist UI state
        this.saveMemReportUIToLocalStorage();
    }

    getFilteredSectionData(sectionKey) {
        const section = this.state.memreport.sections.find(s => s.key === sectionKey);
        if (!section || section.type !== 'table') {
            return section;
        }

        const filters = this.state.memreport.ui.sectionFilters[sectionKey] || {};
        const sortState = this.state.memreport.ui.sectionSorts[sectionKey] || {};

        let filteredRows = [...section.rows];

        // Apply search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredRows = filteredRows.filter(row =>
                row.some(cell => String(cell).toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        if (sortState.column !== undefined && sortState.column !== null) {
            const columnIndex = sortState.column;
            const isNumeric = this.isNumericColumn(section.columns[columnIndex]);
            
            filteredRows.sort((a, b) => {
                let aVal = a[columnIndex];
                let bVal = b[columnIndex];
                
                if (isNumeric) {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                } else {
                    aVal = String(aVal).toLowerCase();
                    bVal = String(bVal).toLowerCase();
                }
                
                if (sortState.direction === 'desc') {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                } else {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                }
            });
        }

        return {
            ...section,
            rows: filteredRows
        };
    }

    isNumericColumn(columnName) {
        const numericPatterns = /\b(KB|MB|Bytes?|Size|Memory|Count|Num|Total)\b/i;
        return numericPatterns.test(columnName);
    }

    // Section state management methods
    toggleSectionCollapsed(sectionKey) {
        const collapsedSections = [...this.state.memreport.ui.collapsedSections];
        const index = collapsedSections.indexOf(sectionKey);
        
        if (index > -1) {
            collapsedSections.splice(index, 1);
        } else {
            collapsedSections.push(sectionKey);
        }
        
        this.update({
            memreport: {
                ...this.state.memreport,
                ui: {
                    ...this.state.memreport.ui,
                    collapsedSections
                }
            }
        });
        
        // Persist UI state
        this.saveMemReportUIToLocalStorage();
    }

    isSectionCollapsed(sectionKey) {
        return this.state.memreport.ui.collapsedSections.includes(sectionKey);
    }

    toggleSectionPinned(sectionKey) {
        const pinnedSections = [...this.state.memreport.ui.pinnedSections];
        const index = pinnedSections.indexOf(sectionKey);
        
        if (index > -1) {
            pinnedSections.splice(index, 1);
        } else {
            pinnedSections.push(sectionKey);
        }
        
        this.update({
            memreport: {
                ...this.state.memreport,
                ui: {
                    ...this.state.memreport.ui,
                    pinnedSections
                }
            }
        });
        
        // Persist UI state
        this.saveMemReportUIToLocalStorage();
    }

    isSectionPinned(sectionKey) {
        return this.state.memreport.ui.pinnedSections.includes(sectionKey);
    }

    // Clear all MemReport filters for a section
    clearMemReportSectionFilters(sectionKey) {
        this.updateMemReportFilters(sectionKey, null);
    }

    // Clear all MemReport sort for a section
    clearMemReportSectionSort(sectionKey) {
        this.updateMemReportSort(sectionKey, null);
    }

    // Get all sections with pinned sections first
    getOrderedMemReportSections() {
        const { sections } = this.state.memreport;
        const { pinnedSections } = this.state.memreport.ui;
        
        const pinned = sections.filter(section => pinnedSections.includes(section.key));
        const unpinned = sections.filter(section => !pinnedSections.includes(section.key));
        
        return [...pinned, ...unpinned];
    }

    // Reset all MemReport UI state
    resetMemReportUIState() {
        this.update({
            memreport: {
                ...this.state.memreport,
                ui: {
                    pinnedSections: [],
                    collapsedSections: [],
                    sectionFilters: {},
                    sectionSorts: {}
                }
            }
        });
        
        // Clear persisted state
        try {
            localStorage.removeItem('logAnalyzer_memreportUI');
        } catch (error) {
            console.warn('Failed to clear MemReport UI state:', error);
        }
    }
}

// Export for use in other modules
window.AppState = AppState; 