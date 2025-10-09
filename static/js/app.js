// Main application module - VERSION 1.3

class LogAnalyzerApp {
    constructor() {
        this.appState = new AppState();
        this.ui = new UI();
        
        // Route management
        this.routes = {
            'log': 'log-panel',
            'memreport': 'memreport-panel'
        };
        this.currentRoute = 'log';
        
        // Initialize UI first, then setup event listeners
        this.initializeApp();
    }

    // Initialize the application
    initializeApp() {
        // Try to initialize UI
        this.ui.initialize();
        
        // Setup event listeners and state subscriptions
        this.setupEventListeners();
        this.setupStateSubscriptions();
    }

    // Setup event listeners
    setupEventListeners() {
        // Tab navigation
        const logTab = document.getElementById('log-tab');
        const memreportTab = document.getElementById('memreport-tab');
        
        if (logTab) {
            logTab.addEventListener('click', () => {
                this.switchRoute('log');
            });
        }
        
        if (memreportTab) {
            memreportTab.addEventListener('click', () => {
                this.switchRoute('memreport');
            });
        }

        // File upload for log analyzer
        if (this.ui.elements.uploadForm) {
            this.ui.elements.uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFileUpload();
            });
        }

        if (this.ui.elements.logFile) {
            this.ui.elements.logFile.addEventListener('change', () => {
                if (this.ui.elements.logFile.files.length > 0) {
                    this.handleFileSelection(this.ui.elements.logFile.files[0]);
                }
            });
        }

        // File upload for memreport analyzer
        const memreportUploadForm = document.getElementById('memreportUploadForm');
        const memreportFile = document.getElementById('memreportFile');
        
        if (memreportUploadForm) {
            memreportUploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleMemReportFileUpload();
            });
        }

        if (memreportFile) {
            memreportFile.addEventListener('change', () => {
                if (memreportFile.files.length > 0) {
                    this.handleFileSelection(memreportFile.files[0]);
                }
            });
        }

        // Setup drag and drop for both zones
        this.setupDragAndDrop();

        // Search input with debouncing
        if (this.ui.elements.logSearchInput) {
            const debouncedSearch = Utils.debounce(() => {
                this.handleSearchChange();
            }, 300);

            this.ui.elements.logSearchInput.addEventListener('input', debouncedSearch);
        }

        // Advanced search options
        if (this.ui.elements.caseSensitive) {
            this.ui.elements.caseSensitive.addEventListener('change', () => {
                this.handleSearchOptionsChange();
            });
        }

        if (this.ui.elements.useRegex) {
            this.ui.elements.useRegex.addEventListener('change', () => {
                this.handleSearchOptionsChange();
            });
        }

        // Log level filters
        const levelFilters = document.querySelectorAll('.log-level-filter');
        if (levelFilters.length > 0) {
            levelFilters.forEach(cb => {
                cb.addEventListener('change', () => {
                    this.handleLevelFilterChange();
                });
            });
        }

        // Copy button
        if (this.ui.elements.copyButton) {
            this.ui.elements.copyButton.addEventListener('click', () => {
                this.ui.copyFilteredResults();
            });
        }

        // Export buttons
        if (this.ui.elements.exportCsv) {
            this.ui.elements.exportCsv.addEventListener('click', () => {
                this.ui.exportToCsv();
            });
        }

        if (this.ui.elements.exportJson) {
            this.ui.elements.exportJson.addEventListener('click', () => {
                this.ui.exportToJson();
            });
        }
    }

    // Setup drag and drop for both file input zones
    setupDragAndDrop() {
        const dropZones = [
            { element: document.getElementById('dropZone'), input: document.getElementById('logFile') },
            { element: document.getElementById('memreportDropZone'), input: document.getElementById('memreportFile') }
        ];

        dropZones.forEach(({ element, input }) => {
            if (!element || !input) return;

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                element.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                element.addEventListener(eventName, () => {
                    element.classList.add('drag-over');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                element.addEventListener(eventName, () => {
                    element.classList.remove('drag-over');
                });
            });

            // Handle dropped files
            element.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const dt = new DataTransfer();
                    dt.items.add(files[0]);
                    input.files = dt.files;
                    this.handleFileSelection(files[0]);
                }
            });

            // Handle click to browse
            element.addEventListener('click', () => {
                input.click();
            });

            // Handle keyboard navigation
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    input.click();
                }
            });
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

    // Switch between routes
    switchRoute(route) {
        if (this.routes[route] && this.currentRoute !== route) {
            this.currentRoute = route;
            this.appState.setCurrentRoute(route);
            
            // Update tab visibility using Bootstrap
            const tabTrigger = document.querySelector(`#${route}-tab`);
            if (tabTrigger) {
                const tab = new bootstrap.Tab(tabTrigger);
                tab.show();
            }
        }
    }

    // Handle file selection and route to appropriate analyzer
    handleFileSelection(file) {
        if (!file) {
            Utils.showErrorToast('Please select a file');
            return;
        }

        const fileType = this.detectFileType(file);
        
        if (fileType === 'memreport') {
            this.switchRoute('memreport');
            // Set the file in the memreport input and trigger upload
            const memreportFile = document.getElementById('memreportFile');
            if (memreportFile) {
                // Create a new FileList-like object
                const dt = new DataTransfer();
                dt.items.add(file);
                memreportFile.files = dt.files;
                this.handleMemReportFileUpload();
            }
        } else {
            this.switchRoute('log');
            this.handleLogFileUpload();
        }
    }

    // Detect file type based on extension and content
    detectFileType(file) {
        const fileName = file.name.toLowerCase();
        
        // Check file extension first
        if (fileName.endsWith('.memreport')) {
            return 'memreport';
        }
        
        // For .txt files, we might need to check content in the future
        // For now, assume .txt files are logs unless they have memreport indicators
        if (fileName.endsWith('.txt')) {
            // TODO: In future, could read first few lines to detect memreport format
            // For now, default to log
            return 'log';
        }
        
        // Default to log for .log files and others
        return 'log';
    }

    // Handle log file upload
    async handleLogFileUpload() {
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

    // Handle memreport file upload
    async handleMemReportFileUpload() {
        const memreportFile = document.getElementById('memreportFile');
        const file = memreportFile?.files[0];
        
        if (!file) {
            Utils.showErrorToast('Please select a memreport file');
            return;
        }

        // Show loading state
        const uploadButton = document.getElementById('memreportUploadButton');
        if (uploadButton) {
            uploadButton.textContent = 'Parsing...';
            uploadButton.disabled = true;
        }

        try {
            // For now, just show a placeholder message
            // This will be implemented in later tasks
            const memreportContent = document.getElementById('memreportContent');
            if (memreportContent) {
                memreportContent.innerHTML = `
                    <div class="alert alert-info" role="alert">
                        <h4 class="alert-heading">MemReport Parser Coming Soon!</h4>
                        <p>File "${file.name}" has been selected for analysis.</p>
                        <p class="mb-0">The MemReport parser will be implemented in the next tasks.</p>
                    </div>
                `;
            }
            
            // Update state
            this.appState.update({
                currentFile: file.name
            });
            
        } catch (error) {
            Utils.showErrorToast('Failed to process memreport file');
            console.error('MemReport processing error:', error);
        } finally {
            // Reset UI state
            if (uploadButton) {
                uploadButton.textContent = 'Analyze MemReport';
                uploadButton.disabled = false;
            }
        }
    }

    // Handle file upload (legacy method for backward compatibility)
    async handleFileUpload() {
        return this.handleLogFileUpload();
    }

    // Handle search change
    handleSearchChange() {
        const searchTerm = this.ui.getSearchTerm();
        const searchOptions = this.ui.getSearchOptions();
        this.appState.updateFilters({ 
            search: searchTerm,
            caseSensitive: searchOptions.caseSensitive,
            useRegex: searchOptions.useRegex
        });
        this.updateDisplay();
    }

    // Handle level filter change
    handleLevelFilterChange() {
        const selectedLevels = this.ui.getSelectedLogLevels();
        this.appState.updateFilters({ levels: selectedLevels });
        this.updateDisplay();
    }

    // Handle search options change
    handleSearchOptionsChange() {
        const searchOptions = this.ui.getSearchOptions();
        this.appState.updateFilters({ 
            caseSensitive: searchOptions.caseSensitive,
            useRegex: searchOptions.useRegex
        });
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = LogAnalyzerApp.init();
    });
} else {
    setTimeout(() => {
        window.app = LogAnalyzerApp.init();
    }, 100);
} 