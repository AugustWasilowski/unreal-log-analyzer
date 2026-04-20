// Main application module - VERSION 1.5

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
        
        // MemReport page instance (initialized lazily)
        this.memreportPage = null;
        
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

        // Paste log form
        const pasteForm = document.getElementById('pasteForm');
        if (pasteForm) {
            pasteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePasteAnalyze();
            });
        }

        const pasteClearButton = document.getElementById('pasteClearButton');
        if (pasteClearButton) {
            pasteClearButton.addEventListener('click', () => {
                const textarea = document.getElementById('pasteLogText');
                if (textarea) textarea.value = '';
            });
        }

        if (this.ui.elements.logFile) {
            this.ui.elements.logFile.addEventListener('change', async () => {
                if (this.ui.elements.logFile.files.length > 0) {
                    await this.handleFileSelection(this.ui.elements.logFile.files[0]);
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
            memreportFile.addEventListener('change', async () => {
                if (memreportFile.files.length > 0) {
                    await this.handleFileSelection(memreportFile.files[0]);
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

        if (this.ui.elements.collapseDuplicates) {
            this.ui.elements.collapseDuplicates.addEventListener('change', () => {
                this.appState.updateFilters({ collapseDuplicates: this.ui.getCollapseDuplicates() });
                this.updateDisplay();
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
            element.addEventListener('drop', async (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const dt = new DataTransfer();
                    dt.items.add(files[0]);
                    input.files = dt.files;
                    await this.handleFileSelection(files[0]);
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
            const previousRoute = this.currentRoute;
            this.currentRoute = route;
            this.appState.setCurrentRoute(route);
            
            // Perform cleanup when switching away from routes
            this.performRouteCleanup(previousRoute);
            
            // Update tab visibility using Bootstrap
            const tabTrigger = document.querySelector(`#${route}-tab`);
            if (tabTrigger) {
                const tab = new bootstrap.Tab(tabTrigger);
                tab.show();
            }
            
            // Initialize route-specific components if needed
            this.initializeRouteComponents(route);
        }
    }

    // Perform cleanup when switching away from a route
    performRouteCleanup(route) {
        switch (route) {
            case 'memreport':
                // Clear any active charts or heavy DOM elements
                if (this.memreportPage) {
                    const memreportContent = document.getElementById('memreportContent');
                    if (memreportContent) {
                        // Clean up any charts or heavy elements
                        this.memreportPage.cleanupCharts(memreportContent);
                        
                        // Clear content to free memory
                        memreportContent.innerHTML = '';
                    }
                }
                break;
            case 'log':
                // Clear log-specific state if needed
                const logContent = document.getElementById('logContent');
                if (logContent) {
                    // Clear any heavy log content when switching away
                    const entries = logContent.querySelectorAll('.log-entry');
                    if (entries.length > 1000) {
                        // Only clear if there are many entries to free memory
                        logContent.innerHTML = '';
                    }
                }
                break;
        }
    }

    // Initialize route-specific components
    initializeRouteComponents(route) {
        switch (route) {
            case 'memreport':
                // Initialize MemReport page if not already done
                if (!this.memreportPage) {
                    this.memreportPage = new MemReportPage(this.appState, this.ui, Utils);
                    this.memreportPage.initialize();
                }
                break;
            case 'log':
                // Log analyzer is always initialized
                break;
        }
    }

    // Handle file selection and route to appropriate analyzer
    async handleFileSelection(file) {
        if (!file) {
            Utils.showErrorToast('Please select a file');
            return;
        }

        try {
            // Use enhanced file type detection with content analysis
            const fileType = await this.detectFileTypeWithContent(file);
            
            if (fileType === 'memreport') {
                this.switchRoute('memreport');
                // Set the file in the memreport input and trigger upload
                const memreportFile = document.getElementById('memreportFile');
                if (memreportFile) {
                    // Create a new FileList-like object
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    memreportFile.files = dt.files;
                    await this.handleMemReportFileUpload();
                }
            } else {
                this.switchRoute('log');
                // Set the file in the log input
                const logFile = document.getElementById('logFile');
                if (logFile) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    logFile.files = dt.files;
                }
                await this.handleLogFileUpload();
            }
        } catch (error) {
            console.error('Error in file selection:', error);
            Utils.showErrorToast('Failed to process file: ' + error.message);
        }
    }

    // Detect file type based on extension and content
    detectFileType(file) {
        const fileName = file.name.toLowerCase();
        
        // Check file extension first
        if (fileName.endsWith('.memreport')) {
            return 'memreport';
        }
        
        // For .txt files, we need to check content to determine if it's a memreport
        if (fileName.endsWith('.txt')) {
            // For now, we'll assume .txt files are logs and let the user switch manually
            // In the future, we could read the first few lines to detect memreport format
            return 'log';
        }
        
        // Default to log for .log files and others
        return 'log';
    }

    // Enhanced file type detection with content analysis
    async detectFileTypeWithContent(file) {
        const fileName = file.name.toLowerCase();
        
        // Check file extension first
        if (fileName.endsWith('.memreport')) {
            return 'memreport';
        }
        
        // For .txt files, read first few lines to detect memreport format
        if (fileName.endsWith('.txt')) {
            try {
                const firstChunk = await this.readFileChunk(file, 0, 2048); // Read first 2KB
                if (this.isMemReportContent(firstChunk)) {
                    return 'memreport';
                }
            } catch (error) {
                console.warn('Could not read file content for type detection:', error);
            }
        }
        
        // Default to log for .log files and others
        return 'log';
    }

    // Read a chunk of file content
    readFileChunk(file, start, length) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file chunk'));
            
            const blob = file.slice(start, start + length);
            reader.readAsText(blob);
        });
    }

    // Check if content looks like a memreport file
    isMemReportContent(content) {
        const memreportIndicators = [
            /^=+\s*(Memory Overview|Platform Memory|Memory Summary)\s*=+$/im,
            /^=+\s*Obj List.*=+$/im,
            /^=+\s*(RHI|Rendering).*Memory.*=+$/im,
            /^=+\s*Streaming Levels.*=+$/im,
            /^=+\s*Actors.*=+$/im,
            /^=+\s*(ListTextures|Texture).*=+$/im,
            /^=+\s*(ListStaticMeshes|Static.*Mesh).*=+$/im
        ];
        
        // Check if content contains memreport section headers
        return memreportIndicators.some(pattern => pattern.test(content));
    }

    // Handle log file upload — reads file in the browser, no server upload.
    async handleLogFileUpload() {
        const file = this.ui.elements.logFile.files[0];
        
        if (!file) {
            Utils.showErrorToast('Please select a file');
            return;
        }

        // Client-side size guard — reject files over 100 MB before reading.
        const MAX_LOG_SIZE = 100 * 1024 * 1024;
        if (file.size > MAX_LOG_SIZE) {
            Utils.showErrorToast('File too large — maximum is 100 MB.');
            return;
        }

        // Show loading state
        this.ui.updateButtonText('Loading...');
        this.ui.setButtonDisabled(true);
        
        // Temporarily disable state subscriptions to prevent interference
        this.appState.pauseSubscriptions();

        try {
            // Read the file entirely in the browser — no upload to server.
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.onabort = () => reject(new Error('File reading was aborted'));
                reader.readAsText(file);
            });

            const data = LogParser.parseLogLines(text);

            // First, update the data state
            this.appState.update({
                currentFile: file.name,
                allEntries: data.entries,
                logTypes: data.logTypes
            });
            
            // Update UI
            this.ui.createLogTypeFilters(data.logTypes);
            
            // Update display directly
            this.updateDisplay();
            
        } catch (error) {
            Utils.showErrorToast('Failed to read file: ' + error.message);
            console.error('File read error:', error);
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
            // Initialize MemReport page if not already done
            if (!this.memreportPage) {
                this.memreportPage = new MemReportPage(this.appState, this.ui, Utils);
                this.memreportPage.initialize();
            }

            // Use the MemReport page to parse and render the file
            await this.memreportPage.parseAndRender(file);
            
            // Update state with current file
            this.appState.update({
                currentFile: file.name
            });
            
        } catch (error) {
            Utils.showErrorToast('Failed to process memreport file: ' + error.message);
            console.error('MemReport processing error:', error);
            
            // Show error in the content area as well
            const memreportContent = document.getElementById('memreportContent');
            if (memreportContent) {
                memreportContent.innerHTML = `
                    <div class="alert alert-danger" role="alert">
                        <h4 class="alert-heading">Processing Failed</h4>
                        <p>Failed to process the memreport file: ${Utils.sanitizeInput(error.message)}</p>
                        <hr>
                        <p class="mb-0">Please try with a different file or check the browser console for more details.</p>
                    </div>
                `;
            }
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

    // Handle paste log analysis — parses in the browser, no server round-trip.
    async handlePasteAnalyze() {
        const textarea = document.getElementById('pasteLogText');
        const text = textarea ? textarea.value : '';

        if (!text.trim()) {
            Utils.showErrorToast('Please paste some log content first');
            return;
        }

        const analyzeButton = document.getElementById('pasteAnalyzeButton');
        if (analyzeButton) {
            analyzeButton.textContent = 'Analyzing...';
            analyzeButton.disabled = true;
        }

        this.appState.pauseSubscriptions();

        try {
            // Parse entirely in the browser — no server round-trip.
            const data = LogParser.parseLogLines(text);

            this.appState.update({
                currentFile: 'pasted-log',
                allEntries: data.entries,
                logTypes: data.logTypes
            });

            this.ui.createLogTypeFilters(data.logTypes);
            this.updateDisplay();
        } catch (error) {
            Utils.showErrorToast('Failed to parse log: ' + error.message);
            console.error('Parse error:', error);
        } finally {
            if (analyzeButton) {
                analyzeButton.textContent = 'Analyze';
                analyzeButton.disabled = false;
            }
            this.appState.resumeSubscriptions();
        }
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
