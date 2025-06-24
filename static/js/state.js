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
            },
            ui: {
                isLoading: false,
                loadingMessage: ''
            }
        };
        this.listeners = [];
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

    updateUI(ui) {
        this.state.ui = { ...this.state.ui, ...ui };
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

    setLoading(isLoading, message = 'Loading...') {
        this.updateUI({ isLoading, loadingMessage: message });
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