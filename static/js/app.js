// Main application module
class LogAnalyzerApp {
    constructor() {
        this.appState = new AppState();
        this.ui = new UI();
        this.setupEventListeners();
        this.setupStateSubscriptions();
        this.ui.setupKeyboardNavigation();
    }

    // Setup event listeners
    setupEventListeners() {
        // File upload
        this.ui.elements.uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFileUpload();
        });

        this.ui.elements.logFile.addEventListener('change', () => {
            if (this.ui.elements.logFile.files.length > 0) {
                this.ui.elements.uploadForm.requestSubmit();
            }
        });

        // Search input with debouncing
        const debouncedSearch = Utils.debounce(() => {
            this.handleSearchChange();
        }, 300);

        this.ui.elements.logSearchInput.addEventListener('input', debouncedSearch);

        // Log level filters
        document.querySelectorAll('.log-level-filter').forEach(cb => {
            cb.addEventListener('change', () => {
                this.handleLevelFilterChange();
            });
        });

        // Copy button
        this.ui.elements.copyButton.addEventListener('click', () => {
            this.ui.copyFilteredResults();
        });
    }

    // Setup state subscriptions
    setupStateSubscriptions() {
        this.appState.subscribe((state) => {
            this.handleStateChange(state);
        });
    }

    // Handle state change
    handleStateChange(state) {
        // Update display when state changes (but no loading state management)
        if (state.allEntries.length > 0) {
            this.updateDisplay();
        }
    }

    // Handle file upload
    async handleFileUpload() {
        const file = this.ui.elements.logFile.files[0];
        
        if (!file) {
            Utils.showErrorToast('Please select a file');
            return;
        }

        // Show loading state
        this.ui.updateButtonText('Loading...');
        this.ui.setButtonDisabled(true);
        
        // Temporarily disable state subscriptions to prevent interference
        this.appState.pauseSubscriptions();

        try {
            const data = await API.uploadFile(file);
            
            // First, update the data state
            this.appState.update({
                currentFile: file.name,
                allEntries: data.entries,
                logTypes: data.log_types
            });
            
            // Update UI
            this.ui.createLogTypeFilters(data.log_types);
            
            // Update display directly
            this.updateDisplay();
            
        } catch (error) {
            // Error already handled by API module
        } finally {
            // Reset UI state
            this.ui.updateButtonText('Refresh');
            this.ui.setButtonDisabled(false);
            
            // Re-enable state subscriptions
            this.appState.resumeSubscriptions();
        }
    }

    // Handle search change
    handleSearchChange() {
        const searchTerm = this.ui.getSearchTerm();
        this.appState.updateFilters({ search: searchTerm });
        this.updateDisplay();
    }

    // Handle level filter change
    handleLevelFilterChange() {
        const selectedLevels = this.ui.getSelectedLogLevels();
        this.appState.updateFilters({ levels: selectedLevels });
        this.updateDisplay();
    }

    // Update display based on current state
    updateDisplay() {
        const state = this.appState.getState();
        const filteredEntries = this.appState.getFilteredEntries();
        
        // Update UI
        this.ui.displayLogEntries(filteredEntries);
        this.ui.updateLogLevelCounts(filteredEntries);
        this.ui.updateLogTypeCounts(filteredEntries, state.logTypes);
    }

    // Initialize the application
    static init() {
        return new LogAnalyzerApp();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = LogAnalyzerApp.init();
}); 