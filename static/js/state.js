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
                useRegex: false
            },
            searchHistory: [],
            ui: {
                dragOver: false,
                searchDropdownOpen: false
            }
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
        } catch (error) {
            console.warn('Failed to load search history:', error);
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
        return allEntries.filter(entry => {
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
    }

    detectLogLevel(content) {
        if (/\bWarning\b/i.test(content)) return 'Warning';
        if (/\bError\b/i.test(content)) return 'Error';
        if (/\bDisplay\b/i.test(content)) return 'Display';
        return '';
    }
}

// Export for use in other modules
window.AppState = AppState; 