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
                search: ''
            }
        };
        this.listeners = [];
        this.subscriptionsPaused = false;
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
            if (filters.search && !entry.content.toLowerCase().includes(filters.search.toLowerCase())) {
                return false;
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