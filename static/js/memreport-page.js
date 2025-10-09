// MemReport page UI module - handles rendering and interactions for memory report analysis
class MemReportPage {
    constructor(appState, ui, utils) {
        this.appState = appState;
        this.ui = ui;
        this.utils = utils;
        this.tables = new Map(); // Store table instances by section key
        this.initialized = false;
    }

    // Initialize the MemReport page
    initialize() {
        if (this.initialized) return;
        
        // Subscribe to state changes
        this.appState.subscribe((state) => {
            if (state.currentRoute === 'memreport') {
                this.handleStateChange(state);
            }
        });
        
        this.initialized = true;
    }

    // Handle state changes
    handleStateChange(state) {
        // Re-render sections if filters or sorts changed
        const memreportState = state.memreport;
        if (memreportState.sections.length > 0) {
            this.updateSectionCounts();
        }
    }

    // Parse and render MemReport file with progress indication
    async parseAndRender(file) {
        const container = document.getElementById('memreportContent');
        if (!container) {
            console.error('MemReport container not found');
            return;
        }

        try {
            // Show initial progress
            this.showProgressIndicator(container);
            
            // Read file content
            let fileContent;
            try {
                fileContent = await this.readFileContent(file);
            } catch (readError) {
                this.showFileError(container, 'File Reading Error', 
                    `Could not read the selected file: ${readError.message}`, 
                    ['Ensure the file is not corrupted', 'Try selecting the file again', 'Check file permissions']);
                return;
            }

            // Validate file content before parsing
            this.updateProgressIndicator({ 
                phase: 'validating', 
                progress: 10, 
                message: 'Validating file content...' 
            });

            const validation = MemReportParser.validateFileContent(fileContent);
            
            // Handle validation results
            if (!validation.isValid) {
                const criticalIssues = validation.issues.filter(issue => issue.type === 'critical');
                this.showValidationError(container, criticalIssues);
                return;
            }

            // Show validation warnings if any
            const warnings = validation.issues.filter(issue => issue.type === 'warning');
            if (warnings.length > 0) {
                this.showValidationWarnings(container, warnings, () => {
                    // Continue with parsing after user acknowledges warnings
                    this.continueWithParsing(file, fileContent, container);
                });
                return;
            }

            // Continue with parsing if validation passed
            await this.continueWithParsing(file, fileContent, container);
            
        } catch (error) {
            console.error('Error in parseAndRender:', error);
            this.showFileError(container, 'Unexpected Error', 
                `An unexpected error occurred: ${error.message}`,
                ['Try refreshing the page', 'Try with a different file', 'Check browser console for details']);
        }
    }

    // Continue with parsing after validation
    async continueWithParsing(file, fileContent, container) {
        try {
            const fileSize = file.size;
            
            // Determine if we need chunked parsing
            const shouldUseChunkedParsing = fileSize > (1024 * 1024); // 1MB threshold
            
            let memreportData;
            if (shouldUseChunkedParsing) {
                // Use chunked parsing with progress updates
                memreportData = await MemReportParser.parse(fileContent, {
                    chunkThreshold: 1024 * 1024, // 1MB
                    chunkSize: 1000 // lines per chunk
                }, (progress) => {
                    this.updateProgressIndicator(progress);
                });
            } else {
                // Use synchronous parsing for smaller files
                this.updateProgressIndicator({ 
                    phase: 'parsing', 
                    progress: 50, 
                    message: 'Parsing file...' 
                });
                
                memreportData = await MemReportParser.parse(fileContent);
                
                this.updateProgressIndicator({ 
                    phase: 'complete', 
                    progress: 100, 
                    message: 'Parsing complete!' 
                });
            }

            // Check if parsing resulted in meaningful data
            if (this.isEmptyOrInvalidResult(memreportData)) {
                this.showParsingResult(container, memreportData);
                return;
            }

            // Store in app state
            this.appState.setMemReportData(memreportData);
            
            // Render the parsed data
            this.render(memreportData);
            
        } catch (error) {
            console.error('Error during parsing:', error);
            this.showParsingError(container, error.message);
        }
    }

    // Read file content as text
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Show non-blocking progress indicator
    showProgressIndicator(container) {
        container.innerHTML = '';
        
        const progressContainer = Utils.createElement('div', 'memreport-progress-container d-flex flex-column align-items-center justify-content-center', {
            style: 'min-height: 300px;'
        });
        
        // Progress card
        const progressCard = Utils.createElement('div', 'card', {
            style: 'max-width: 500px; width: 100%; background-color: #23272b; border: 1px solid #333; color: #e0e0e0;'
        });
        
        const cardHeader = Utils.createElement('div', 'card-header', {
            style: 'background-color: #007bff; color: white; border-bottom: 1px solid #333;'
        });
        const headerTitle = Utils.createElement('h5', 'mb-0');
        headerTitle.textContent = 'Processing MemReport File';
        cardHeader.appendChild(headerTitle);
        
        const cardBody = Utils.createElement('div', 'card-body', {
            style: 'background-color: #23272b; color: #e0e0e0;'
        });
        
        // Progress bar
        const progressWrapper = Utils.createElement('div', 'progress mb-3', {
            style: 'height: 20px;'
        });
        
        const progressBar = Utils.createElement('div', 'progress-bar progress-bar-striped progress-bar-animated', {
            id: 'memreport-progress-bar',
            role: 'progressbar',
            'aria-valuenow': '0',
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            style: 'width: 0%;'
        });
        
        progressWrapper.appendChild(progressBar);
        
        // Status message
        const statusMessage = Utils.createElement('div', 'text-center text-muted', {
            id: 'memreport-progress-message'
        });
        statusMessage.textContent = 'Initializing...';
        
        // Phase indicator
        const phaseIndicator = Utils.createElement('div', 'text-center mt-2', {
            id: 'memreport-progress-phase'
        });
        
        cardBody.appendChild(progressWrapper);
        cardBody.appendChild(statusMessage);
        cardBody.appendChild(phaseIndicator);
        
        progressCard.appendChild(cardHeader);
        progressCard.appendChild(cardBody);
        progressContainer.appendChild(progressCard);
        
        container.appendChild(progressContainer);
    }

    // Update progress indicator
    updateProgressIndicator(progress) {
        const progressBar = document.getElementById('memreport-progress-bar');
        const statusMessage = document.getElementById('memreport-progress-message');
        const phaseIndicator = document.getElementById('memreport-progress-phase');
        
        if (progressBar && statusMessage && phaseIndicator) {
            // Update progress bar
            const percentage = Math.round(progress.progress);
            progressBar.style.width = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage.toString());
            progressBar.textContent = `${percentage}%`;
            
            // Update status message
            statusMessage.textContent = progress.message || 'Processing...';
            
            // Update phase indicator
            const phaseLabels = {
                'initializing': '🔄 Initializing',
                'validating': '🔍 Validating File',
                'metadata': '📋 Reading Metadata',
                'detecting': '🔍 Detecting Sections',
                'parsing': '⚙️ Parsing Data',
                'complete': '✅ Complete',
                'error': '❌ Error'
            };
            
            phaseIndicator.textContent = phaseLabels[progress.phase] || '⚙️ Processing';
            
            // Add completion styling
            if (progress.phase === 'complete') {
                progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
                progressBar.classList.add('bg-success');
                
                // Auto-hide after a short delay
                setTimeout(() => {
                    const progressContainer = document.querySelector('.memreport-progress-container');
                    if (progressContainer) {
                        progressContainer.style.opacity = '0';
                        progressContainer.style.transition = 'opacity 0.5s ease-out';
                        setTimeout(() => {
                            if (progressContainer.parentNode) {
                                progressContainer.parentNode.removeChild(progressContainer);
                            }
                        }, 500);
                    }
                }, 1000);
            }
            
            // Error styling
            if (progress.phase === 'error') {
                progressBar.classList.remove('progress-bar-striped', 'progress-bar-animated');
                progressBar.classList.add('bg-danger');
            }
        }
    }

    // Show parsing error
    showParsingError(container, errorMessage) {
        this.showFileError(container, 'Parsing Error', errorMessage, [
            'Try with a different memory report file',
            'Check if the file is a valid Unreal Engine memory report',
            'The file may be corrupted or in an unsupported format'
        ]);
    }

    // Show generic file error with suggestions
    showFileError(container, title, message, suggestions = []) {
        container.innerHTML = '';
        
        const errorContainer = Utils.createElement('div', 'd-flex flex-column align-items-center justify-content-center', {
            style: 'min-height: 300px;'
        });
        
        const errorCard = Utils.createElement('div', 'card', {
            style: 'max-width: 600px; width: 100%; background-color: #23272b; border: 1px solid #dc3545; color: #e0e0e0;'
        });
        
        const cardHeader = Utils.createElement('div', 'card-header', {
            style: 'background-color: #dc3545; color: white; border-bottom: 1px solid #333;'
        });
        const headerTitle = Utils.createElement('h5', 'mb-0');
        headerTitle.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>${Utils.sanitizeInput(title)}`;
        cardHeader.appendChild(headerTitle);
        
        const cardBody = Utils.createElement('div', 'card-body', {
            style: 'background-color: #23272b; color: #e0e0e0;'
        });
        
        // Error message
        const errorText = Utils.createElement('p', 'text-danger mb-3');
        errorText.textContent = message;
        cardBody.appendChild(errorText);
        
        // Suggestions if provided
        if (suggestions.length > 0) {
            const suggestionsTitle = Utils.createElement('h6', 'text-muted');
            suggestionsTitle.textContent = 'Suggestions:';
            cardBody.appendChild(suggestionsTitle);
            
            const suggestionsList = Utils.createElement('ul', 'text-muted mb-3');
            suggestions.forEach(suggestion => {
                const listItem = Utils.createElement('li');
                listItem.textContent = suggestion;
                suggestionsList.appendChild(listItem);
            });
            cardBody.appendChild(suggestionsList);
        }
        
        // Action buttons
        const buttonContainer = Utils.createElement('div', 'd-flex gap-2');
        
        const retryButton = Utils.createElement('button', 'btn btn-primary');
        retryButton.innerHTML = '<i class="fas fa-file-upload me-2"></i>Try Another File';
        retryButton.addEventListener('click', () => {
            const fileInput = document.getElementById('logFile');
            if (fileInput) {
                fileInput.click();
            }
        });
        
        const helpButton = Utils.createElement('button', 'btn btn-outline-secondary');
        helpButton.innerHTML = '<i class="fas fa-question-circle me-2"></i>Help';
        helpButton.addEventListener('click', () => {
            this.showFileFormatHelp();
        });
        
        buttonContainer.appendChild(retryButton);
        buttonContainer.appendChild(helpButton);
        cardBody.appendChild(buttonContainer);
        
        errorCard.appendChild(cardHeader);
        errorCard.appendChild(cardBody);
        errorContainer.appendChild(errorCard);
        
        container.appendChild(errorContainer);
    }

    // Show validation error for critical issues
    showValidationError(container, criticalIssues) {
        const message = criticalIssues.map(issue => issue.message).join('. ');
        const suggestions = criticalIssues.flatMap(issue => issue.suggestion ? [issue.suggestion] : []);
        
        this.showFileError(container, 'File Validation Failed', message, suggestions);
    }

    // Show validation warnings with option to continue
    showValidationWarnings(container, warnings, continueCallback) {
        container.innerHTML = '';
        
        const warningContainer = Utils.createElement('div', 'd-flex flex-column align-items-center justify-content-center', {
            style: 'min-height: 300px;'
        });
        
        const warningCard = Utils.createElement('div', 'card', {
            style: 'max-width: 600px; width: 100%; background-color: #23272b; border: 1px solid #ffc107; color: #e0e0e0;'
        });
        
        const cardHeader = Utils.createElement('div', 'card-header', {
            style: 'background-color: #ffc107; color: #000; border-bottom: 1px solid #333;'
        });
        const headerTitle = Utils.createElement('h5', 'mb-0');
        headerTitle.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>File Validation Warnings';
        cardHeader.appendChild(headerTitle);
        
        const cardBody = Utils.createElement('div', 'card-body', {
            style: 'background-color: #23272b; color: #e0e0e0;'
        });
        
        const introText = Utils.createElement('p', 'mb-3');
        introText.textContent = 'The selected file has some potential issues but can still be processed:';
        cardBody.appendChild(introText);
        
        // Warning list
        const warningsList = Utils.createElement('ul', 'text-warning mb-3');
        warnings.forEach(warning => {
            const listItem = Utils.createElement('li', 'mb-2');
            listItem.innerHTML = `<strong>${Utils.sanitizeInput(warning.message)}</strong><br><small class="text-muted">${Utils.sanitizeInput(warning.suggestion)}</small>`;
            warningsList.appendChild(listItem);
        });
        cardBody.appendChild(warningsList);
        
        // Action buttons
        const buttonContainer = Utils.createElement('div', 'd-flex gap-2 justify-content-end');
        
        const cancelButton = Utils.createElement('button', 'btn btn-secondary');
        cancelButton.innerHTML = '<i class="fas fa-times me-2"></i>Choose Different File';
        cancelButton.addEventListener('click', () => {
            const fileInput = document.getElementById('logFile');
            if (fileInput) {
                fileInput.click();
            }
        });
        
        const continueButton = Utils.createElement('button', 'btn btn-warning');
        continueButton.innerHTML = '<i class="fas fa-arrow-right me-2"></i>Continue Anyway';
        continueButton.addEventListener('click', continueCallback);
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(continueButton);
        cardBody.appendChild(buttonContainer);
        
        warningCard.appendChild(cardHeader);
        warningCard.appendChild(cardBody);
        warningContainer.appendChild(warningCard);
        
        container.appendChild(warningContainer);
    }

    // Check if parsing result is empty or invalid
    isEmptyOrInvalidResult(memreportData) {
        if (!memreportData) return true;
        if (!memreportData.sections || memreportData.sections.length === 0) return true;
        
        // Check if all sections are raw fallbacks due to errors
        const allSectionsAreErrors = memreportData.sections.every(section => 
            section.type === 'raw' && section.error
        );
        
        return allSectionsAreErrors;
    }

    // Show parsing result with appropriate messaging
    showParsingResult(container, memreportData) {
        if (!memreportData || !memreportData.sections || memreportData.sections.length === 0) {
            this.showFileError(container, 'No Data Found', 
                'The file was processed but no recognizable memory report data was found.',
                [
                    'Verify this is a valid Unreal Engine memory report file',
                    'Check if the file contains the expected section headers',
                    'Try with a different memory report file'
                ]);
            return;
        }

        // Check if we have critical parsing failure
        if (memreportData.parsingStats && memreportData.parsingStats.criticalFailure) {
            this.showFileError(container, 'Critical Parsing Failure', 
                'The file could not be parsed due to critical errors. It will be displayed as raw text.',
                [
                    'The file format may not be supported',
                    'The file may be corrupted',
                    'Try with a different memory report file'
                ]);
        }

        // If we have some data but with many errors, show with warnings
        const errorSections = memreportData.sections.filter(s => s.error).length;
        const totalSections = memreportData.sections.length;
        
        if (errorSections > 0 && errorSections < totalSections) {
            // Mixed results - some sections parsed, some failed
            this.render(memreportData);
            
            // Show additional warning about parsing issues
            Utils.announceToScreenReader(
                `Memory report loaded with ${totalSections - errorSections} successful sections and ${errorSections} sections with parsing errors`
            );
        } else {
            // All sections failed - show as raw content
            this.render(memreportData);
        }
    }

    // Show file format help dialog
    showFileFormatHelp() {
        const modal = Utils.createElement('div', 'modal fade', {
            'id': 'fileFormatHelpModal',
            'tabindex': '-1',
            'aria-labelledby': 'fileFormatHelpModalLabel',
            'aria-hidden': 'true'
        });

        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="fileFormatHelpModalLabel">
                            <i class="fas fa-info-circle me-2"></i>Supported File Formats
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <h6>Supported File Types:</h6>
                        <ul>
                            <li><strong>.memreport</strong> - Unreal Engine memory report files</li>
                            <li><strong>.txt</strong> - Text files containing memory report data</li>
                        </ul>
                        
                        <h6 class="mt-3">How to Generate Memory Reports in Unreal Engine:</h6>
                        <ol>
                            <li>In the Unreal Editor, open the console (~ key)</li>
                            <li>Type: <code>memreport -full</code></li>
                            <li>The report will be saved to your project's <code>Saved/Profiling/MemReports/</code> directory</li>
                        </ol>
                        
                        <h6 class="mt-3">Expected File Content:</h6>
                        <ul>
                            <li>Section headers marked with <code>===</code></li>
                            <li>Memory usage data in tabular format</li>
                            <li>Common sections: Obj List, RHI Memory, Textures, Static Meshes, etc.</li>
                        </ul>
                        
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-lightbulb me-2"></i>
                            <strong>Tip:</strong> If your file doesn't match these patterns, it will be displayed as raw text for manual review.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Show modal using Bootstrap
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // Main render method - renders the entire MemReport page
    render(memreportData) {
        const container = document.getElementById('memreportContent');
        if (!container) {
            console.error('MemReport container not found');
            return;
        }

        // Cleanup any existing charts before clearing content
        this.cleanupCharts(container);
        
        // Clear existing content
        container.innerHTML = '';

        // Create main container with proper ARIA structure
        const memreportContainer = Utils.createElement('div', 'memreport-container', {
            'role': 'main',
            'aria-label': 'Memory Report Analysis'
        });
        
        // Add ARIA live region for dynamic updates
        const liveRegion = Utils.createElement('div', 'visually-hidden', {
            'id': 'memreport-live-region',
            'aria-live': 'polite',
            'aria-atomic': 'false'
        });
        memreportContainer.appendChild(liveRegion);
        
        // Render metadata overview if available
        if (memreportData.meta) {
            const metaSection = this.renderMetadata(memreportData.meta);
            memreportContainer.appendChild(metaSection);
        }

        // Get ordered sections (pinned first)
        const orderedSections = this.appState.getOrderedMemReportSections();
        
        // Render each section
        orderedSections.forEach(section => {
            const sectionElement = this.renderSection(section);
            memreportContainer.appendChild(sectionElement);
        });

        // Show parse errors if any
        if (memreportData.parseErrors && memreportData.parseErrors.length > 0) {
            const errorsSection = this.renderParseErrors(memreportData.parseErrors);
            memreportContainer.appendChild(errorsSection);
        }

        container.appendChild(memreportContainer);
        
        // Setup global keyboard navigation
        this.setupGlobalKeyboardNavigation(memreportContainer);
        
        // Announce to screen readers
        Utils.announceToScreenReader(`MemReport loaded with ${orderedSections.length} sections`);
    }

    // Render metadata overview section
    renderMetadata(meta) {
        const metaCard = Utils.createElement('div', 'card mb-3 memreport-meta', {
            'role': 'region',
            'aria-labelledby': 'meta-header',
            'style': 'background-color: #23272b; border: 1px solid #333; color: #e0e0e0;'
        });
        
        const cardHeader = Utils.createElement('div', 'card-header', {
            'style': 'background-color: #2d3136; border-bottom: 1px solid #333; color: #e0e0e0;'
        });
        const headerTitle = Utils.createElement('h5', 'mb-0', {
            id: 'meta-header'
        });
        headerTitle.textContent = 'Memory Report Overview';
        cardHeader.appendChild(headerTitle);
        
        const cardBody = Utils.createElement('div', 'card-body', {
            'style': 'background-color: #23272b; color: #e0e0e0;'
        });
        
        // Create metadata table with proper ARIA support
        const metaTable = Utils.createElement('table', 'table table-sm', {
            'role': 'table',
            'aria-label': 'Memory report metadata',
            'aria-describedby': 'meta-description',
            'style': 'color: #e0e0e0;'
        });
        
        // Add description for screen readers
        const metaDescription = Utils.createElement('div', 'visually-hidden', {
            id: 'meta-description'
        });
        metaDescription.textContent = 'Table containing metadata information about the memory report';
        cardBody.appendChild(metaDescription);
        
        // Add table headers for screen readers
        const thead = Utils.createElement('thead', 'visually-hidden');
        const headerRow = Utils.createElement('tr');
        
        const propertyHeader = Utils.createElement('th', '', {
            'scope': 'col',
            'id': 'meta-property-header'
        });
        propertyHeader.textContent = 'Property';
        
        const valueHeader = Utils.createElement('th', '', {
            'scope': 'col',
            'id': 'meta-value-header'
        });
        valueHeader.textContent = 'Value';
        
        headerRow.appendChild(propertyHeader);
        headerRow.appendChild(valueHeader);
        thead.appendChild(headerRow);
        metaTable.appendChild(thead);
        
        const tbody = Utils.createElement('tbody');
        
        const metaFields = [
            { key: 'engineVersion', label: 'Engine Version' },
            { key: 'platform', label: 'Platform' },
            { key: 'map', label: 'Map' },
            { key: 'timestamp', label: 'Timestamp' },
            { key: 'totalMemoryMB', label: 'Total Memory (MB)' }
        ];
        
        metaFields.forEach(field => {
            if (meta[field.key]) {
                const row = Utils.createElement('tr', '', {
                    'role': 'row'
                });
                
                const labelCell = Utils.createElement('td', 'fw-bold', {
                    'role': 'cell',
                    'headers': 'meta-property-header'
                });
                labelCell.textContent = field.label;
                
                const valueCell = Utils.createElement('td', '', {
                    'role': 'cell',
                    'headers': 'meta-value-header'
                });
                valueCell.textContent = meta[field.key];
                
                row.appendChild(labelCell);
                row.appendChild(valueCell);
                tbody.appendChild(row);
            }
        });
        
        metaTable.appendChild(tbody);
        cardBody.appendChild(metaTable);
        metaCard.appendChild(cardHeader);
        metaCard.appendChild(cardBody);
        
        return metaCard;
    }

    // Render individual section
    renderSection(section) {
        const sectionCard = Utils.createElement('div', 'card mb-3 memreport-section', {
            'role': 'region',
            'aria-labelledby': `section-${section.key}`,
            'data-section-key': section.key,
            'style': 'background-color: #23272b; border: 1px solid #333; color: #e0e0e0;'
        });
        
        // Create section header
        const sectionHeader = this.createSectionHeader(section);
        sectionCard.appendChild(sectionHeader);
        
        // Create collapsible content
        const collapseId = `collapse-${section.key}`;
        const isCollapsed = this.appState.isSectionCollapsed(section.key);
        
        const collapseDiv = Utils.createElement('div', `collapse ${isCollapsed ? '' : 'show'}`, {
            id: collapseId,
            'role': 'region',
            'aria-labelledby': `section-${section.key}`
        });
        
        const cardBody = Utils.createElement('div', 'card-body', {
            'style': 'background-color: #23272b; color: #e0e0e0;'
        });
        
        // Render section content based on type
        const sectionContent = this.renderSectionContent(section);
        cardBody.appendChild(sectionContent);
        
        collapseDiv.appendChild(cardBody);
        sectionCard.appendChild(collapseDiv);
        
        return sectionCard;
    }

    // Create sticky section header with actions
    createSectionHeader(section) {
        const isPinned = this.appState.isSectionPinned(section.key);
        const isCollapsed = this.appState.isSectionCollapsed(section.key);
        
        const cardHeader = Utils.createElement('div', 'card-header sticky-card-header', {
            'style': 'background-color: #2d3136; border-bottom: 1px solid #333; color: #e0e0e0;'
        });
        cardHeader.setAttribute('id', `section-${section.key}`);
        
        const headerRow = Utils.createElement('div', 'd-flex justify-content-between align-items-center');
        
        // Left side - title and collapse button
        const leftSide = Utils.createElement('div', 'd-flex align-items-center');
        
        const collapseButton = Utils.createElement('button', 'btn btn-link text-decoration-none p-0', {
            'data-bs-toggle': 'collapse',
            'data-bs-target': `#collapse-${section.key}`,
            'aria-expanded': isCollapsed ? 'false' : 'true',
            'aria-controls': `collapse-${section.key}`,
            'aria-describedby': `count-${section.key}`,
            'tabindex': '0'
        });
        
        // Add keyboard navigation for collapse button
        collapseButton.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                collapseButton.click();
            }
        });
        
        const titleText = Utils.createElement('h5', 'mb-0 me-2');
        titleText.textContent = section.title;
        
        // Row count badge with proper ARIA labeling
        const rowCount = this.getSectionRowCount(section);
        const countBadge = Utils.createElement('span', 'badge me-2', {
            id: `count-${section.key}`,
            'aria-label': `${rowCount} ${section.type === 'table' ? 'rows' : 'items'} in ${section.title}`,
            'role': 'status',
            'style': 'background-color: #444; color: #e0e0e0;'
        });
        countBadge.textContent = `${rowCount} ${section.type === 'table' ? 'rows' : 'items'}`;
        
        // Pin indicator with proper ARIA labeling
        if (isPinned) {
            const pinIndicator = Utils.createElement('span', 'badge me-2', {
                'aria-label': `${section.title} is pinned to top`,
                'role': 'status',
                'style': 'background-color: #007bff; color: white;'
            });
            pinIndicator.textContent = '📌 Pinned';
            leftSide.appendChild(pinIndicator);
        }
        
        collapseButton.appendChild(titleText);
        leftSide.appendChild(collapseButton);
        leftSide.appendChild(countBadge);
        
        // Right side - action buttons
        const actionButtons = this.createSectionActionButtons(section);
        
        headerRow.appendChild(leftSide);
        headerRow.appendChild(actionButtons);
        cardHeader.appendChild(headerRow);
        
        // Add collapse event listeners with ARIA updates
        const collapseElement = document.querySelector(`#collapse-${section.key}`);
        if (collapseElement) {
            collapseElement.addEventListener('shown.bs.collapse', () => {
                this.appState.toggleSectionCollapsed(section.key);
                collapseButton.setAttribute('aria-expanded', 'true');
                Utils.announceToScreenReader(`${section.title} section expanded`);
            });
            collapseElement.addEventListener('hidden.bs.collapse', () => {
                this.appState.toggleSectionCollapsed(section.key);
                collapseButton.setAttribute('aria-expanded', 'false');
                Utils.announceToScreenReader(`${section.title} section collapsed`);
            });
        }
        
        return cardHeader;
    }

    // Create action buttons for section header
    createSectionActionButtons(section) {
        const buttonGroup = Utils.createElement('div', 'btn-group btn-group-sm section-actions', {
            role: 'group',
            'aria-label': `Actions for ${section.title}`
        });
        
        // Search button (for table sections)
        if (section.type === 'table') {
            const searchBtn = Utils.createElement('button', 'btn', {
                type: 'button',
                title: 'Search this section',
                'aria-label': `Search ${section.title}`,
                'style': 'background-color: #444; border: 1px solid #666; color: #e0e0e0;'
            });
            searchBtn.innerHTML = '🔍';
            searchBtn.addEventListener('click', () => this.toggleSectionSearch(section.key));
            buttonGroup.appendChild(searchBtn);
        }
        
        // Chart button (for table sections with numeric data)
        if (section.type === 'table' && MemReportCharts && MemReportCharts.supportsCharts(section)) {
            const chartBtn = Utils.createElement('button', 'btn', {
                type: 'button',
                title: 'Show chart visualization',
                'aria-label': `Show chart for ${section.title}`,
                'data-section-key': section.key,
                'style': 'background-color: #444; border: 1px solid #666; color: #e0e0e0;'
            });
            chartBtn.innerHTML = '📈';
            chartBtn.addEventListener('click', () => this.toggleSectionChart(section.key));
            buttonGroup.appendChild(chartBtn);
        }
        
        // Export button
        const exportBtn = Utils.createElement('button', 'btn', {
            type: 'button',
            title: 'Export section data',
            'aria-label': `Export ${section.title}`,
            'style': 'background-color: #444; border: 1px solid #666; color: #e0e0e0;'
        });
        exportBtn.innerHTML = '📊';
        exportBtn.addEventListener('click', () => this.showExportOptions(section.key));
        buttonGroup.appendChild(exportBtn);
        
        // Pin/Unpin button
        const isPinned = this.appState.isSectionPinned(section.key);
        const pinBtn = Utils.createElement('button', 'btn', {
            type: 'button',
            title: isPinned ? 'Unpin section' : 'Pin section to top',
            'aria-label': `${isPinned ? 'Unpin' : 'Pin'} ${section.title}`,
            'style': 'background-color: #444; border: 1px solid #666; color: #e0e0e0;'
        });
        pinBtn.innerHTML = isPinned ? '📌' : '📍';
        pinBtn.addEventListener('click', () => {
            this.appState.toggleSectionPinned(section.key);
            this.render(this.appState.getState().memreport); // Re-render to update order
        });
        buttonGroup.appendChild(pinBtn);
        
        return buttonGroup;
    }

    // Render section content based on type
    renderSectionContent(section) {
        const contentContainer = Utils.createElement('div', 'section-content');
        
        switch (section.type) {
            case 'table':
                return this.renderTableSection(section);
            case 'kv':
                return this.renderKeyValueSection(section);
            case 'raw':
            default:
                return this.renderRawSection(section);
        }
    }

    // Render table section with MemReportTable
    renderTableSection(section) {
        const tableContainer = Utils.createElement('div', 'table-section');
        
        // Add large table indicator if needed
        if (section.rows && section.rows.length > 500) {
            const indicator = this.createLargeTableIndicator(section.rows.length);
            tableContainer.appendChild(indicator);
        }
        
        // Add search input if section has search enabled
        const filters = this.appState.getState().memreport.ui.sectionFilters[section.key];
        if (filters && filters.searchVisible) {
            const searchContainer = this.createSearchInput(section.key);
            tableContainer.appendChild(searchContainer);
        }
        
        // Create table wrapper
        const tableWrapper = Utils.createElement('div', 'table-responsive', {
            'style': 'background-color: #23272b; border: 1px solid #333; border-radius: 0.375rem;'
        });
        const tableElement = Utils.createElement('div', 'memreport-table', {
            id: `table-${section.key}`,
            'style': 'color: #e0e0e0;'
        });
        
        tableWrapper.appendChild(tableElement);
        tableContainer.appendChild(tableWrapper);
        
        // Create and store table instance
        const table = new MemReportTable(section, tableElement, this.appState);
        this.tables.set(section.key, table);
        table.render();
        
        return tableContainer;
    }

    // Create large table indicator
    createLargeTableIndicator(rowCount) {
        const indicator = Utils.createElement('div', 'large-table-indicator d-flex justify-content-between align-items-center');
        
        const message = Utils.createElement('span');
        message.innerHTML = `
            <strong>Large Table:</strong> This section contains ${Utils.formatNumber(rowCount)} rows. 
            Virtual scrolling is enabled for optimal performance.
        `;
        
        const badge = Utils.createElement('span', 'badge bg-info');
        badge.textContent = 'Virtual Scrolling';
        
        indicator.appendChild(message);
        indicator.appendChild(badge);
        
        return indicator;
    }

    // Render key-value section
    renderKeyValueSection(section) {
        const kvContainer = Utils.createElement('div', 'kv-section');
        
        if (!section.items || section.items.length === 0) {
            const emptyMessage = Utils.createElement('p', 'text-muted');
            emptyMessage.textContent = 'No data available';
            kvContainer.appendChild(emptyMessage);
            return kvContainer;
        }
        
        const kvTable = Utils.createElement('table', 'table table-sm', {
            'role': 'table',
            'aria-label': `${section.title} key-value data`,
            'aria-describedby': `kv-summary-${section.key}`,
            'style': 'color: #e0e0e0; --bs-table-striped-bg: #2d3136;'
        });
        
        // Add table summary for screen readers
        const tableSummary = Utils.createElement('div', 'visually-hidden', {
            id: `kv-summary-${section.key}`
        });
        tableSummary.textContent = `Table containing ${section.items.length} key-value pairs for ${section.title}`;
        kvContainer.appendChild(tableSummary);
        
        // Add table header for better screen reader support
        const thead = Utils.createElement('thead', 'visually-hidden');
        const headerRow = Utils.createElement('tr');
        
        const nameHeader = Utils.createElement('th', '', {
            'scope': 'col',
            'id': `kv-name-header-${section.key}`
        });
        nameHeader.textContent = 'Property';
        
        const valueHeader = Utils.createElement('th', '', {
            'scope': 'col',
            'id': `kv-value-header-${section.key}`
        });
        valueHeader.textContent = 'Value';
        
        headerRow.appendChild(nameHeader);
        headerRow.appendChild(valueHeader);
        thead.appendChild(headerRow);
        kvTable.appendChild(thead);
        
        const tbody = Utils.createElement('tbody');
        
        section.items.forEach((item, index) => {
            const row = Utils.createElement('tr', '', {
                'role': 'row'
            });
            
            const nameCell = Utils.createElement('td', 'fw-bold', {
                'role': 'cell',
                'headers': `kv-name-header-${section.key}`
            });
            nameCell.textContent = item.name;
            
            const valueCell = Utils.createElement('td', '', {
                'role': 'cell',
                'headers': `kv-value-header-${section.key}`
            });
            const valueText = item.unit ? `${item.value} ${item.unit}` : item.value;
            valueCell.textContent = valueText;
            
            row.appendChild(nameCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });
        
        kvTable.appendChild(tbody);
        kvContainer.appendChild(kvTable);
        
        return kvContainer;
    }

    // Render raw section (fallback)
    renderRawSection(section) {
        const rawContainer = Utils.createElement('div', 'raw-section');
        
        // Show enhanced error information if present
        if (section.error) {
            const errorAlert = Utils.createElement('div', 'alert', {
                'style': 'background-color: #856404; border: 1px solid #ffc107; color: #fff3cd; border-radius: 0.375rem; padding: 0.75rem;'
            });
            
            const errorHeader = Utils.createElement('div', 'd-flex align-items-start');
            const errorIcon = Utils.createElement('i', 'fas fa-exclamation-triangle me-2 mt-1');
            const errorContent = Utils.createElement('div', 'flex-grow-1');
            
            const errorTitle = Utils.createElement('strong');
            errorTitle.textContent = 'Parsing Error: ';
            
            const errorMessage = Utils.createElement('span');
            errorMessage.textContent = section.error;
            
            errorContent.appendChild(errorTitle);
            errorContent.appendChild(errorMessage);
            
            // Add fallback reason if available
            if (section.fallbackReason) {
                const reasonText = Utils.createElement('div', 'mt-2 small');
                reasonText.innerHTML = `<strong>Reason:</strong> ${Utils.sanitizeInput(section.fallbackReason)}`;
                errorContent.appendChild(reasonText);
            }
            
            // Add error context if available (from enhanced parser)
            if (section.errorContext) {
                const contextToggle = Utils.createElement('button', 'btn btn-sm mt-2', {
                    'type': 'button',
                    'data-bs-toggle': 'collapse',
                    'data-bs-target': `#error-context-${section.key}`,
                    'aria-expanded': 'false',
                    'style': 'background-color: #ffc107; border: 1px solid #ffc107; color: #000;'
                });
                contextToggle.innerHTML = '<i class="fas fa-info-circle me-1"></i>Show Details';
                
                const contextCollapse = Utils.createElement('div', 'collapse mt-2', {
                    'id': `error-context-${section.key}`
                });
                
                const contextContent = Utils.createElement('div', 'small p-2 rounded', {
                    'style': 'background-color: #2d3136; color: #e0e0e0; border: 1px solid #444;'
                });
                
                if (section.errorContext.possibleCauses) {
                    const causesTitle = Utils.createElement('div', 'fw-bold mb-1');
                    causesTitle.textContent = 'Possible causes:';
                    contextContent.appendChild(causesTitle);
                    
                    const causesList = Utils.createElement('ul', 'mb-2');
                    section.errorContext.possibleCauses.forEach(cause => {
                        const causeItem = Utils.createElement('li');
                        causeItem.textContent = cause;
                        causesList.appendChild(causeItem);
                    });
                    contextContent.appendChild(causesList);
                }
                
                if (section.errorContext.lineCount !== undefined) {
                    const statsText = Utils.createElement('div', 'text-muted');
                    statsText.textContent = `Section had ${section.errorContext.lineCount} lines starting at line ${section.errorContext.startLine || 'unknown'}`;
                    contextContent.appendChild(statsText);
                }
                
                contextCollapse.appendChild(contextContent);
                errorContent.appendChild(contextToggle);
                errorContent.appendChild(contextCollapse);
            }
            
            // Show original section type if it was attempted
            if (section.originalType) {
                const typeInfo = Utils.createElement('div', 'mt-2 small text-muted');
                typeInfo.innerHTML = `<i class="fas fa-info-circle me-1"></i>Originally detected as: <code>${section.originalType}</code> section`;
                errorContent.appendChild(typeInfo);
            }
            
            errorHeader.appendChild(errorIcon);
            errorHeader.appendChild(errorContent);
            errorAlert.appendChild(errorHeader);
            rawContainer.appendChild(errorAlert);
        }
        
        // Add raw content display
        const contentHeader = Utils.createElement('div', 'd-flex justify-content-between align-items-center mb-2');
        const contentTitle = Utils.createElement('h6', 'mb-0 text-muted');
        contentTitle.innerHTML = '<i class="fas fa-file-alt me-2"></i>Raw Content';
        
        // Add copy button for raw content
        const copyButton = Utils.createElement('button', 'btn btn-sm btn-outline-secondary', {
            'title': 'Copy raw content to clipboard',
            'aria-label': 'Copy raw content to clipboard'
        });
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.addEventListener('click', () => {
            const content = section.rawLines ? section.rawLines.join('\n') : 'No content';
            navigator.clipboard.writeText(content).then(() => {
                // Show temporary success feedback
                const originalHTML = copyButton.innerHTML;
                copyButton.innerHTML = '<i class="fas fa-check text-success"></i>';
                setTimeout(() => {
                    copyButton.innerHTML = originalHTML;
                }, 1000);
            }).catch(() => {
                // Fallback for browsers without clipboard API
                console.warn('Could not copy to clipboard');
            });
        });
        
        contentHeader.appendChild(contentTitle);
        contentHeader.appendChild(copyButton);
        rawContainer.appendChild(contentHeader);
        
        const preElement = Utils.createElement('pre', 'p-3 border rounded', {
            style: 'max-height: 400px; overflow-y: auto; background-color: #2d3136; border-color: #444; color: #e0e0e0;'
        });
        const codeElement = Utils.createElement('code', '', {
            'style': 'color: #e0e0e0;'
        });
        
        if (section.rawLines && section.rawLines.length > 0) {
            codeElement.textContent = section.rawLines.join('\n');
        } else {
            codeElement.textContent = 'No raw data available';
            codeElement.className = 'text-muted';
        }
        
        preElement.appendChild(codeElement);
        rawContainer.appendChild(preElement);
        
        return rawContainer;
    }

    // Create search input for table sections
    createSearchInput(sectionKey) {
        const section = this.appState.getState().memreport.sections.find(s => s.key === sectionKey);
        const sectionTitle = section ? section.title : 'section';
        
        const searchContainer = Utils.createElement('div', 'mb-3 section-search');
        
        // Add search help text
        const helpText = Utils.createElement('div', 'form-text mb-2', {
            id: `search-help-${sectionKey}`
        });
        helpText.textContent = `Filter ${sectionTitle} by typing keywords. Use Escape to clear.`;
        
        const inputGroup = Utils.createElement('div', 'input-group');
        
        const searchInput = Utils.createElement('input', 'form-control', {
            type: 'text',
            placeholder: `Search ${sectionTitle}...`,
            'aria-label': `Search ${sectionTitle}`,
            'aria-describedby': `search-help-${sectionKey} search-status-${sectionKey}`,
            id: `search-${sectionKey}`,
            'style': 'background-color: #23272b; color: #e0e0e0; border: 1px solid #444;'
        });
        
        const clearButton = Utils.createElement('button', 'btn', {
            type: 'button',
            title: 'Clear search',
            'aria-label': `Clear search for ${sectionTitle}`,
            'style': 'background-color: #444; border: 1px solid #666; color: #e0e0e0;'
        });
        clearButton.innerHTML = '✕';
        
        // Add search status region for screen readers
        const statusRegion = Utils.createElement('div', 'visually-hidden', {
            id: `search-status-${sectionKey}`,
            'aria-live': 'polite',
            'aria-atomic': 'true'
        });
        
        // Get current search term
        const filters = this.appState.getState().memreport.ui.sectionFilters[sectionKey];
        if (filters && filters.search) {
            searchInput.value = filters.search;
        }
        
        // Debounced search handler with status updates
        const debouncedSearch = Utils.debounce((term) => {
            this.appState.updateMemReportFilters(sectionKey, { search: term });
            this.updateSectionTable(sectionKey);
            
            // Update status for screen readers
            const filteredSection = this.appState.getFilteredSectionData(sectionKey);
            const resultCount = filteredSection.rows ? filteredSection.rows.length : 0;
            const totalCount = section.rows ? section.rows.length : 0;
            
            if (term.trim()) {
                statusRegion.textContent = `${resultCount} of ${totalCount} rows match "${term}"`;
            } else {
                statusRegion.textContent = `Showing all ${totalCount} rows`;
            }
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
        
        // Enhanced keyboard support
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                searchInput.value = '';
                this.appState.updateMemReportFilters(sectionKey, { search: '' });
                this.updateSectionTable(sectionKey);
                statusRegion.textContent = `Search cleared. Showing all rows.`;
            }
        });
        
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            this.appState.updateMemReportFilters(sectionKey, { search: '' });
            this.updateSectionTable(sectionKey);
            searchInput.focus();
            statusRegion.textContent = `Search cleared. Showing all rows.`;
        });
        
        searchContainer.appendChild(helpText);
        inputGroup.appendChild(searchInput);
        inputGroup.appendChild(clearButton);
        searchContainer.appendChild(inputGroup);
        searchContainer.appendChild(statusRegion);
        
        return searchContainer;
    }

    // Toggle search visibility for a section
    toggleSectionSearch(sectionKey) {
        const currentFilters = this.appState.getState().memreport.ui.sectionFilters[sectionKey] || {};
        const searchVisible = !currentFilters.searchVisible;
        
        this.appState.updateMemReportFilters(sectionKey, { searchVisible });
        
        // Re-render the section to show/hide search
        const sectionElement = document.querySelector(`[data-section-key="${sectionKey}"]`);
        if (sectionElement) {
            const section = this.appState.getState().memreport.sections.find(s => s.key === sectionKey);
            if (section) {
                const newSectionElement = this.renderSection(section);
                sectionElement.parentNode.replaceChild(newSectionElement, sectionElement);
            }
        }
    }

    // Show export options for a section
    showExportOptions(sectionKey) {
        // Simple implementation - could be enhanced with a modal
        const section = this.appState.getFilteredSectionData(sectionKey);
        
        // Create temporary menu
        const menu = Utils.createElement('div', 'dropdown-menu show position-absolute', {
            'style': 'z-index: 1050; background-color: #23272b; border: 1px solid #333; color: #e0e0e0;'
        });
        
        const csvOption = Utils.createElement('button', 'dropdown-item', {
            'style': 'background-color: #23272b; color: #e0e0e0; border: none;'
        });
        csvOption.textContent = 'Export as CSV';
        csvOption.addEventListener('click', () => {
            this.exportSectionAsCSV(section);
            document.body.removeChild(menu);
        });
        
        const jsonOption = Utils.createElement('button', 'dropdown-item', {
            'style': 'background-color: #23272b; color: #e0e0e0; border: none;'
        });
        jsonOption.textContent = 'Export as JSON';
        jsonOption.addEventListener('click', () => {
            this.exportSectionAsJSON(section);
            document.body.removeChild(menu);
        });
        
        menu.appendChild(csvOption);
        menu.appendChild(jsonOption);
        
        // Position menu near the export button
        const exportBtn = document.querySelector(`[data-section-key="${sectionKey}"] .section-actions button[title="Export section data"]`);
        if (exportBtn) {
            const rect = exportBtn.getBoundingClientRect();
            menu.style.left = `${rect.left}px`;
            menu.style.top = `${rect.bottom + 5}px`;
        }
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
    }

    // Export section as CSV
    exportSectionAsCSV(section) {
        let csvContent = '';
        
        if (section.type === 'table') {
            // Add headers with proper escaping
            csvContent += section.columns.map(col => this.escapeCsvField(col)).join(',') + '\n';
            
            // Add rows with proper escaping for memory values and asset names
            section.rows.forEach(row => {
                csvContent += row.map(cell => this.escapeCsvField(cell)).join(',') + '\n';
            });
        } else if (section.type === 'kv') {
            // Add headers for key-value data
            csvContent += '"Name","Value"\n';
            section.items.forEach(item => {
                const value = item.unit ? `${item.value} ${item.unit}` : item.value;
                csvContent += `${this.escapeCsvField(item.name)},${this.escapeCsvField(value)}\n`;
            });
        } else if (section.type === 'raw') {
            // For raw sections, export as single column
            csvContent += '"Content"\n';
            if (section.rawLines) {
                section.rawLines.forEach(line => {
                    csvContent += `${this.escapeCsvField(line)}\n`;
                });
            }
        }
        
        // Create filename with timestamp for uniqueness
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${section.key}_${timestamp}.csv`;
        
        this.downloadFile(csvContent, filename, 'text/csv');
        Utils.showSuccessToast('Section exported as CSV');
    }

    // Export section as JSON
    exportSectionAsJSON(section) {
        // Get current memreport metadata
        const memreportState = this.appState.getState().memreport;
        const currentFilters = memreportState.ui.sectionFilters[section.key] || {};
        const currentSort = memreportState.ui.sectionSorts[section.key] || {};
        
        // Build comprehensive JSON structure
        const jsonData = {
            metadata: {
                exportTimestamp: new Date().toISOString(),
                sectionKey: section.key,
                sectionTitle: section.title,
                sectionType: section.type,
                memreportMeta: memreportState.meta,
                appliedFilters: currentFilters,
                appliedSort: currentSort,
                totalRows: section.type === 'table' ? section.rows.length : 
                          section.type === 'kv' ? section.items?.length || 0 : 
                          section.rawLines?.length || 0
            },
            section: {
                key: section.key,
                title: section.title,
                type: section.type,
                data: this.getStructuredSectionData(section),
                notes: section.notes || null,
                error: section.error || null
            }
        };
        
        const jsonContent = JSON.stringify(jsonData, null, 2);
        
        // Create filename with timestamp for uniqueness
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${section.key}_${timestamp}.json`;
        
        this.downloadFile(jsonContent, filename, 'application/json');
        Utils.showSuccessToast('Section exported as JSON');
    }

    // Helper method to escape CSV fields properly
    escapeCsvField(value) {
        if (value === null || value === undefined) {
            return '""';
        }
        
        const stringValue = String(value);
        
        // Check if field contains special characters that require quoting
        const needsQuoting = /[",\r\n]/.test(stringValue);
        
        if (needsQuoting) {
            // Escape existing quotes by doubling them and wrap in quotes
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        // For memory values and asset names, always quote to preserve formatting
        if (this.isMemoryValue(stringValue) || this.isAssetName(stringValue)) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
    }
    
    // Check if value appears to be a memory value
    isMemoryValue(value) {
        return /^\d+(\.\d+)?\s*(KB|MB|GB|Bytes?)$/i.test(value) || 
               /^\d+$/.test(value); // Pure numbers might be memory values
    }
    
    // Check if value appears to be an asset name (contains paths or special chars)
    isAssetName(value) {
        return /[\/\\.]/.test(value) || // Contains path separators or dots
               /^[A-Z][a-zA-Z0-9_]*$/.test(value); // Looks like a class/asset name
    }
    
    // Get structured data for JSON export based on section type
    getStructuredSectionData(section) {
        switch (section.type) {
            case 'table':
                return {
                    columns: section.columns || [],
                    rows: section.rows || [],
                    rowCount: section.rows ? section.rows.length : 0
                };
            case 'kv':
                return {
                    items: section.items || [],
                    itemCount: section.items ? section.items.length : 0
                };
            case 'raw':
            default:
                return {
                    rawLines: section.rawLines || [],
                    lineCount: section.rawLines ? section.rawLines.length : 0
                };
        }
    }
    
    // Generic file download helper
    downloadFile(content, filename, mimeType) {
        // Use the centralized utility function to avoid duplication
        Utils.downloadAsFile(content, filename, mimeType);
    }

    // Toggle chart visibility for a section
    toggleSectionChart(sectionKey) {
        const sectionElement = document.querySelector(`[data-section-key="${sectionKey}"]`);
        if (!sectionElement) return;
        
        const chartContainer = sectionElement.querySelector('.chart-container');
        const chartBtn = sectionElement.querySelector(`button[data-section-key="${sectionKey}"][title="Show chart visualization"]`);
        
        if (chartContainer) {
            // Chart exists, toggle visibility
            const isVisible = chartContainer.style.display !== 'none';
            chartContainer.style.display = isVisible ? 'none' : 'block';
            
            // Cleanup chart interactions when hiding
            if (isVisible) {
                const canvas = chartContainer.querySelector('canvas');
                if (canvas && canvas.id) {
                    // Don't fully cleanup, just hide - interactions remain for when shown again
                    const tooltip = document.querySelector('.chart-tooltip');
                    if (tooltip) {
                        tooltip.style.display = 'none';
                    }
                }
            }
            
            // Update button state
            if (chartBtn) {
                chartBtn.innerHTML = isVisible ? '📈' : '📉';
                chartBtn.title = isVisible ? 'Show chart visualization' : 'Hide chart visualization';
                chartBtn.setAttribute('aria-label', `${isVisible ? 'Show' : 'Hide'} chart for section`);
            }
            
            // Announce to screen readers
            Utils.announceToScreenReader(`Chart ${isVisible ? 'hidden' : 'shown'}`);
        } else {
            // Chart doesn't exist, create it
            this.createSectionChart(sectionKey);
        }
    }

    // Create and render chart for a section
    createSectionChart(sectionKey) {
        const section = this.appState.getFilteredSectionData(sectionKey);
        if (!section || !MemReportCharts.supportsCharts(section)) {
            console.warn('Section does not support charts:', sectionKey);
            return;
        }
        
        const sectionElement = document.querySelector(`[data-section-key="${sectionKey}"]`);
        if (!sectionElement) return;
        
        const cardBody = sectionElement.querySelector('.card-body');
        if (!cardBody) return;
        
        // Get chart data
        const chartData = MemReportCharts.getChartData(section);
        if (!chartData) {
            console.warn('No chart data available for section:', sectionKey);
            return;
        }
        
        // Create chart container
        const chartContainer = MemReportCharts.createChartContainer(section, (visible) => {
            const chartBtn = sectionElement.querySelector(`button[data-section-key="${sectionKey}"][title*="chart"]`);
            if (chartBtn) {
                chartBtn.innerHTML = visible ? '📉' : '📈';
                chartBtn.title = visible ? 'Hide chart visualization' : 'Show chart visualization';
            }
        });
        
        // Create canvas with unique ID
        const chartId = `chart_${sectionKey}_${Date.now()}`;
        const canvas = MemReportCharts.createChartCanvas(600, 300, chartData.title);
        canvas.id = chartId;
        chartContainer.appendChild(canvas);
        
        // Create configuration panel (initially hidden)
        const configPanel = MemReportCharts.createConfigPanel(chartId, (config) => {
            // Configuration change callback
            console.log('Chart configuration changed:', config);
        });
        configPanel.id = `chart-config-${chartId}`;
        configPanel.style.display = 'none';
        chartContainer.appendChild(configPanel);
        
        // Setup export event handlers
        const exportPngBtn = chartContainer.querySelector('.export-png');
        const exportSvgBtn = chartContainer.querySelector('.export-svg');
        
        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const filename = `${section.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.png`;
                MemReportCharts.exportChartAsPNG(chartId, filename);
            });
        }
        
        if (exportSvgBtn) {
            exportSvgBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const filename = `${section.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.svg`;
                MemReportCharts.exportChartAsSVG(chartId, filename);
            });
        }
        
        // Setup configuration button
        const configBtn = chartContainer.querySelector('button[title="Chart configuration"]');
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                MemReportCharts.toggleConfigPanel(chartId);
            });
        }
        
        // Insert chart container after table (or at end of card body)
        const tableSection = cardBody.querySelector('.table-section');
        if (tableSection) {
            tableSection.appendChild(chartContainer);
        } else {
            cardBody.appendChild(chartContainer);
        }
        
        // Show chart container
        chartContainer.style.display = 'block';
        
        // Render chart with slight delay to ensure canvas is in DOM
        requestAnimationFrame(() => {
            try {
                MemReportCharts.renderBarChart(canvas, chartData, {
                    backgroundColor: '#f8f9fa',
                    colors: this.getChartColors(chartData.values.length),
                    showTooltips: true,
                    showValues: true
                });
                
                // Setup custom event listener for bar clicks
                canvas.addEventListener('chartBarClick', (event) => {
                    const { bar, chartData } = event.detail;
                    console.log(`Bar clicked: ${bar.label} (${bar.value})`);
                    
                    // Could implement additional actions here, like:
                    // - Show detailed information modal
                    // - Filter table to show only this item
                    // - Navigate to related section
                    Utils.announceToScreenReader(`Selected ${bar.label} with value ${MemReportCharts.formatChartValue(bar.value)}`);
                });
                
                // Update button state
                const chartBtn = sectionElement.querySelector(`button[data-section-key="${sectionKey}"][title*="chart"]`);
                if (chartBtn) {
                    chartBtn.innerHTML = '📉';
                    chartBtn.title = 'Hide chart visualization';
                    chartBtn.setAttribute('aria-label', `Hide chart for ${section.title}`);
                }
                
                // Announce to screen readers
                Utils.announceToScreenReader(`Interactive chart created for ${section.title} showing ${chartData.values.length} items. Use mouse to hover for details or click bars for more information.`);
                
            } catch (error) {
                console.error('Error rendering chart:', error);
                chartContainer.innerHTML = '<div class="alert alert-warning">Error rendering chart</div>';
            }
        });
    }

    // Cleanup all chart instances in a container
    cleanupCharts(container) {
        if (!container || !MemReportCharts) return;
        
        // Find all chart canvases and cleanup their instances
        const canvases = container.querySelectorAll('canvas[id^="chart_"]');
        canvases.forEach(canvas => {
            if (canvas.id) {
                MemReportCharts.cleanupChart(canvas.id);
            }
        });
        
        // Remove any lingering tooltips
        const tooltips = document.querySelectorAll('.chart-tooltip');
        tooltips.forEach(tooltip => tooltip.remove());
    }

    // Get chart colors for consistent theming
    getChartColors(count) {
        const colors = [
            '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1',
            '#fd7e14', '#20c997', '#e83e8c', '#6c757d', '#17a2b8'
        ];
        return colors.slice(0, count);
    }

    // Update section table after filter/sort changes
    updateSectionTable(sectionKey) {
        const table = this.tables.get(sectionKey);
        if (table) {
            const updatedSection = this.appState.getFilteredSectionData(sectionKey);
            table.updateData(updatedSection);
        }
        this.updateSectionCounts();
    }

    // Update section row counts in headers
    updateSectionCounts() {
        const sections = this.appState.getState().memreport.sections;
        sections.forEach(section => {
            const countBadge = document.getElementById(`count-${section.key}`);
            if (countBadge) {
                const filteredSection = this.appState.getFilteredSectionData(section.key);
                const count = this.getSectionRowCount(filteredSection);
                const totalCount = this.getSectionRowCount(section);
                
                // Update badge text
                countBadge.textContent = `${count} ${section.type === 'table' ? 'rows' : 'items'}`;
                
                // Update ARIA label with filtering information
                if (count !== totalCount) {
                    countBadge.setAttribute('aria-label', 
                        `${count} of ${totalCount} ${section.type === 'table' ? 'rows' : 'items'} shown after filtering in ${section.title}`);
                } else {
                    countBadge.setAttribute('aria-label', 
                        `${count} ${section.type === 'table' ? 'rows' : 'items'} in ${section.title}`);
                }
            }
        });
    }

    // Get row count for a section
    getSectionRowCount(section) {
        if (section.type === 'table') {
            return section.rows ? section.rows.length : 0;
        } else if (section.type === 'kv') {
            return section.items ? section.items.length : 0;
        } else {
            return section.rawLines ? section.rawLines.length : 0;
        }
    }

    // Render parse errors section
    renderParseErrors(parseErrors) {
        const errorsCard = Utils.createElement('div', 'card mb-3', {
            'style': 'background-color: #23272b; border: 1px solid #ffc107; color: #e0e0e0;'
        });
        
        const cardHeader = Utils.createElement('div', 'card-header d-flex justify-content-between align-items-center', {
            'style': 'background-color: #ffc107; color: #000; border-bottom: 1px solid #333;'
        });
        const headerTitle = Utils.createElement('h5', 'mb-0');
        headerTitle.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i>Parsing Issues (${parseErrors.length})`;
        
        // Collapsible toggle button
        const toggleButton = Utils.createElement('button', 'btn btn-sm', {
            'type': 'button',
            'data-bs-toggle': 'collapse',
            'data-bs-target': '#parseErrorsCollapse',
            'aria-expanded': 'false',
            'aria-controls': 'parseErrorsCollapse',
            'style': 'background-color: #000; border: 1px solid #333; color: #ffc107;'
        });
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
        
        cardHeader.appendChild(headerTitle);
        cardHeader.appendChild(toggleButton);
        
        const collapseContainer = Utils.createElement('div', 'collapse', {
            'id': 'parseErrorsCollapse'
        });
        
        const cardBody = Utils.createElement('div', 'card-body', {
            'style': 'background-color: #23272b; color: #e0e0e0;'
        });
        
        // Summary message
        const summaryText = Utils.createElement('p', 'text-muted mb-3');
        summaryText.textContent = 'Some sections encountered parsing issues but were displayed as raw content. Details:';
        cardBody.appendChild(summaryText);
        
        const errorsList = Utils.createElement('div', 'mb-0');
        parseErrors.forEach((error, index) => {
            const errorItem = Utils.createElement('div', 'alert mb-2', {
                'style': 'background-color: #856404; border: 1px solid #ffc107; color: #fff3cd; border-radius: 0.375rem; padding: 0.75rem;'
            });
            
            const errorHeader = Utils.createElement('div', 'd-flex justify-content-between align-items-start');
            const errorTitle = Utils.createElement('strong');
            errorTitle.textContent = `Issue ${index + 1}`;
            
            const errorMessage = Utils.createElement('div', 'mt-1');
            errorMessage.innerHTML = `<code class="text-danger">${Utils.sanitizeInput(error.message)}</code>`;
            
            errorHeader.appendChild(errorTitle);
            errorItem.appendChild(errorHeader);
            errorItem.appendChild(errorMessage);
            
            // Add additional context if available (from enhanced error handling)
            if (error.context) {
                const contextDetails = Utils.createElement('div', 'mt-2 small text-muted');
                contextDetails.innerHTML = `<strong>Context:</strong> ${Utils.sanitizeInput(error.context)}`;
                errorItem.appendChild(contextDetails);
            }
            
            errorsList.appendChild(errorItem);
        });
        
        cardBody.appendChild(errorsList);
        
        // Help text
        const helpText = Utils.createElement('div', 'alert mt-3', {
            'style': 'background-color: #0c5460; border: 1px solid #17a2b8; color: #d1ecf1; border-radius: 0.375rem; padding: 0.75rem;'
        });
        helpText.innerHTML = `
            <i class="fas fa-info-circle me-2"></i>
            <strong>Note:</strong> Sections with parsing issues are displayed as raw text content. 
            This allows you to manually review the data even when automatic parsing fails.
        `;
        cardBody.appendChild(helpText);
        
        collapseContainer.appendChild(cardBody);
        errorsCard.appendChild(cardHeader);
        errorsCard.appendChild(collapseContainer);
        
        return errorsCard;
    }

    // Setup global keyboard navigation for the MemReport page
    setupGlobalKeyboardNavigation(container) {
        // Add keyboard event listener to container
        container.addEventListener('keydown', (e) => {
            // Handle global keyboard shortcuts
            switch (e.key) {
                case '/':
                    // Focus first visible search input (like GitHub)
                    e.preventDefault();
                    this.focusFirstSearchInput();
                    break;
                case 'Escape':
                    // Clear all search inputs and close any open menus
                    e.preventDefault();
                    this.clearAllSearchInputs();
                    this.closeAllMenus();
                    break;
                case 'j':
                case 'ArrowDown':
                    // Navigate to next section (when not in input)
                    if (!this.isInInputElement(e.target)) {
                        e.preventDefault();
                        this.navigateToNextSection();
                    }
                    break;
                case 'k':
                case 'ArrowUp':
                    // Navigate to previous section (when not in input)
                    if (!this.isInInputElement(e.target)) {
                        e.preventDefault();
                        this.navigateToPreviousSection();
                    }
                    break;
                case 'Enter':
                case ' ':
                    // Toggle section if focused on section header
                    if (e.target.closest('.card-header')) {
                        const sectionKey = e.target.closest('.memreport-section')?.getAttribute('data-section-key');
                        if (sectionKey) {
                            e.preventDefault();
                            this.toggleSection(sectionKey);
                        }
                    }
                    break;
            }
        });
        
        // Set initial focus to first section
        this.setInitialFocus(container);
    }

    // Focus the first visible search input
    focusFirstSearchInput() {
        const firstSearchInput = document.querySelector('.memreport-container input[type="text"]:not([disabled])');
        if (firstSearchInput) {
            firstSearchInput.focus();
            Utils.announceToScreenReader('Search input focused');
        }
    }

    // Clear all search inputs
    clearAllSearchInputs() {
        const searchInputs = document.querySelectorAll('.memreport-container input[type="text"]');
        searchInputs.forEach(input => {
            if (input.value) {
                input.value = '';
                // Trigger input event to update filters
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        if (searchInputs.length > 0) {
            Utils.announceToScreenReader('All search filters cleared');
        }
    }

    // Close all open menus
    closeAllMenus() {
        const openMenus = document.querySelectorAll('.dropdown-menu.show');
        openMenus.forEach(menu => {
            menu.classList.remove('show');
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        });
    }

    // Check if element is an input element
    isInInputElement(element) {
        return element.tagName === 'INPUT' || 
               element.tagName === 'TEXTAREA' || 
               element.contentEditable === 'true';
    }

    // Navigate to next section
    navigateToNextSection() {
        const sections = Array.from(document.querySelectorAll('.memreport-section'));
        const currentFocused = document.activeElement.closest('.memreport-section');
        
        if (!currentFocused) {
            // Focus first section
            if (sections.length > 0) {
                this.focusSection(sections[0]);
            }
            return;
        }
        
        const currentIndex = sections.indexOf(currentFocused);
        const nextIndex = (currentIndex + 1) % sections.length;
        this.focusSection(sections[nextIndex]);
    }

    // Navigate to previous section
    navigateToPreviousSection() {
        const sections = Array.from(document.querySelectorAll('.memreport-section'));
        const currentFocused = document.activeElement.closest('.memreport-section');
        
        if (!currentFocused) {
            // Focus last section
            if (sections.length > 0) {
                this.focusSection(sections[sections.length - 1]);
            }
            return;
        }
        
        const currentIndex = sections.indexOf(currentFocused);
        const prevIndex = currentIndex === 0 ? sections.length - 1 : currentIndex - 1;
        this.focusSection(sections[prevIndex]);
    }

    // Focus a section
    focusSection(sectionElement) {
        const collapseButton = sectionElement.querySelector('button[data-bs-toggle="collapse"]');
        if (collapseButton) {
            collapseButton.focus();
            const sectionTitle = collapseButton.querySelector('h5')?.textContent || 'section';
            Utils.announceToScreenReader(`Focused on ${sectionTitle}`);
        }
    }

    // Toggle section collapse state
    toggleSection(sectionKey) {
        const collapseButton = document.querySelector(`button[data-bs-target="#collapse-${sectionKey}"]`);
        if (collapseButton) {
            collapseButton.click();
        }
    }

    // Set initial focus when page loads
    setInitialFocus(container) {
        // Focus first section after a short delay to allow rendering to complete
        setTimeout(() => {
            const firstSection = container.querySelector('.memreport-section');
            if (firstSection) {
                this.focusSection(firstSection);
            }
        }, 100);
    }

    // Announce updates to the MemReport live region
    announceToMemReportLiveRegion(message) {
        const liveRegion = document.getElementById('memreport-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        } else {
            // Fallback to global live region
            Utils.announceToScreenReader(message);
        }
    }

    // Cleanup method
    cleanup() {
        // Clean up virtual scrolling event listeners
        this.tables.forEach(table => {
            if (table.virtualScrollElements && table.virtualScrollElements.container) {
                // Remove scroll event listeners
                const container = table.virtualScrollElements.container;
                container.removeEventListener('scroll', table.handleVirtualScroll);
            }
        });
        
        this.tables.clear();
    }
}

// Export for use in other modules
window.MemReportPage = MemReportPage;

// Reusable table component for MemReport sections
class MemReportTable {
    constructor(sectionData, container, appState) {
        this.originalData = sectionData;
        this.container = container;
        this.appState = appState;
        this.sectionKey = sectionData.key;
        this.currentData = null;
        this.tableElement = null;
        this.headerElements = [];
    }

    // Render the table
    render() {
        // Get current filtered/sorted data
        this.currentData = this.appState.getFilteredSectionData(this.sectionKey);
        
        // Clear container
        this.container.innerHTML = '';
        
        if (!this.currentData.columns || !this.currentData.rows) {
            this.renderEmptyState();
            return;
        }
        
        // Create table structure
        this.tableElement = Utils.createElement('table', 'table table-striped table-hover memreport-data-table', {
            role: 'table',
            'aria-label': `${this.currentData.title} data table`
        });
        
        // Create and append header
        const thead = this.createTableHeader();
        this.tableElement.appendChild(thead);
        
        // Create and append body
        const tbody = this.createTableBody();
        this.tableElement.appendChild(tbody);
        
        this.container.appendChild(this.tableElement);
        
        // Add keyboard navigation
        this.setupKeyboardNavigation();
    }

    // Create table header with sortable columns
    createTableHeader() {
        const thead = Utils.createElement('thead', 'table-dark');
        const headerRow = Utils.createElement('tr', '', { role: 'row' });
        
        this.headerElements = [];
        const sortState = this.appState.getState().memreport.ui.sectionSorts[this.sectionKey] || {};
        
        this.currentData.columns.forEach((column, index) => {
            const headerId = `header-${this.sectionKey}-${index}`;
            const th = Utils.createElement('th', 'sortable-header', {
                role: 'columnheader',
                tabindex: '0',
                'aria-sort': this.getAriaSortValue(index, sortState),
                'data-column-index': index.toString(),
                'id': headerId,
                'scope': 'col'
            });
            
            // Create header content container
            const headerContent = Utils.createElement('div', 'd-flex justify-content-between align-items-center');
            
            // Column title
            const titleSpan = Utils.createElement('span');
            titleSpan.textContent = column;
            headerContent.appendChild(titleSpan);
            
            // Sort indicator with better accessibility
            const sortIndicator = Utils.createElement('span', 'sort-indicator ms-2', {
                'aria-hidden': 'true',
                'title': this.getSortIndicatorTitle(index, sortState)
            });
            sortIndicator.innerHTML = this.getSortIndicator(index, sortState);
            headerContent.appendChild(sortIndicator);
            
            th.appendChild(headerContent);
            
            // Enhanced keyboard and click handlers
            const handleSort = () => {
                this.handleSort(index);
                // Update sort indicator title after sort
                setTimeout(() => {
                    const newSortState = this.appState.getState().memreport.ui.sectionSorts[this.sectionKey] || {};
                    sortIndicator.setAttribute('title', this.getSortIndicatorTitle(index, newSortState));
                }, 100);
            };
            
            th.addEventListener('click', handleSort);
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort();
                }
            });
            
            this.headerElements.push(th);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        return thead;
    }

    // Create table body with data rows (with virtual scrolling for large tables)
    createTableBody() {
        const tbody = Utils.createElement('tbody');
        
        if (this.currentData.rows.length === 0) {
            const emptyRow = Utils.createElement('tr');
            const emptyCell = Utils.createElement('td', 'text-muted text-center', {
                colspan: this.currentData.columns.length.toString()
            });
            emptyCell.textContent = 'No data matches current filters';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
            return tbody;
        }
        
        // Check if we need virtual scrolling (>500 rows)
        const shouldUseVirtualScrolling = this.currentData.rows.length > 500;
        
        if (shouldUseVirtualScrolling) {
            return this.createVirtualScrollTableBody();
        } else {
            return this.createStandardTableBody();
        }
    }

    // Create standard table body for smaller tables
    createStandardTableBody() {
        const tbody = Utils.createElement('tbody');
        
        // Use DocumentFragment for batched DOM updates
        const fragment = document.createDocumentFragment();
        
        this.currentData.rows.forEach((row, rowIndex) => {
            const tr = this.createTableRow(row, rowIndex);
            fragment.appendChild(tr);
        });
        
        tbody.appendChild(fragment);
        return tbody;
    }

    // Create virtual scrolling table body for large tables
    createVirtualScrollTableBody() {
        const tbody = Utils.createElement('tbody', 'virtual-scroll-tbody');
        
        // Initialize virtual scrolling
        this.initializeVirtualScrolling(tbody);
        
        return tbody;
    }

    // Initialize virtual scrolling system
    initializeVirtualScrolling(tbody) {
        const rowHeight = 35; // Estimated row height in pixels
        const containerHeight = 400; // Max visible height
        const visibleRows = Math.ceil(containerHeight / rowHeight);
        const bufferRows = Math.ceil(visibleRows * 0.5); // 50% buffer
        
        this.virtualScrollConfig = {
            rowHeight,
            containerHeight,
            visibleRows,
            bufferRows,
            totalRows: this.currentData.rows.length,
            startIndex: 0,
            endIndex: Math.min(visibleRows + bufferRows, this.currentData.rows.length)
        };
        
        // Create virtual scroll container
        const scrollContainer = Utils.createElement('div', 'virtual-scroll-container', {
            style: `height: ${containerHeight}px; overflow-y: auto; position: relative;`
        });
        
        // Create spacer elements for virtual scrolling
        const topSpacer = Utils.createElement('div', 'virtual-scroll-spacer-top', {
            style: 'height: 0px;'
        });
        
        const bottomSpacer = Utils.createElement('div', 'virtual-scroll-spacer-bottom', {
            style: `height: ${(this.virtualScrollConfig.totalRows - this.virtualScrollConfig.endIndex) * rowHeight}px;`
        });
        
        // Create visible rows container
        const visibleRowsContainer = Utils.createElement('div', 'virtual-scroll-visible-rows');
        
        // Store references
        this.virtualScrollElements = {
            container: scrollContainer,
            topSpacer,
            bottomSpacer,
            visibleRowsContainer,
            tbody
        };
        
        // Render initial visible rows
        this.renderVirtualScrollRows();
        
        // Setup scroll event listener with throttling
        let scrollTimeout;
        scrollContainer.addEventListener('scroll', () => {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            scrollTimeout = setTimeout(() => {
                this.handleVirtualScroll();
            }, 16); // ~60fps
        });
        
        // Assemble virtual scroll structure
        visibleRowsContainer.appendChild(topSpacer);
        
        // Create table structure within visible container
        const virtualTable = Utils.createElement('table', 'table table-striped table-hover memreport-data-table virtual-scroll-table');
        const virtualTbody = Utils.createElement('tbody');
        
        virtualTable.appendChild(virtualTbody);
        visibleRowsContainer.appendChild(virtualTable);
        visibleRowsContainer.appendChild(bottomSpacer);
        
        scrollContainer.appendChild(visibleRowsContainer);
        
        // Replace the original tbody with our virtual scroll container
        tbody.appendChild(scrollContainer);
        
        // Store reference to virtual tbody for updates
        this.virtualTbody = virtualTbody;
        
        return tbody;
    }

    // Render visible rows for virtual scrolling
    renderVirtualScrollRows() {
        if (!this.virtualTbody || !this.virtualScrollConfig) return;
        
        const { startIndex, endIndex } = this.virtualScrollConfig;
        const fragment = document.createDocumentFragment();
        
        // Clear existing rows
        this.virtualTbody.innerHTML = '';
        
        // Render visible rows using idle callbacks for better performance
        this.renderRowsProgressively(startIndex, endIndex, fragment, () => {
            this.virtualTbody.appendChild(fragment);
        });
    }

    // Render rows progressively using requestIdleCallback
    renderRowsProgressively(startIndex, endIndex, fragment, callback) {
        const batchSize = 50; // Rows to render per batch
        let currentIndex = startIndex;
        
        const renderBatch = () => {
            const batchEnd = Math.min(currentIndex + batchSize, endIndex);
            
            // Render batch of rows
            for (let i = currentIndex; i < batchEnd; i++) {
                if (i < this.currentData.rows.length) {
                    const tr = this.createTableRow(this.currentData.rows[i], i);
                    fragment.appendChild(tr);
                }
            }
            
            currentIndex = batchEnd;
            
            // Continue with next batch or finish
            if (currentIndex < endIndex) {
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(renderBatch, { timeout: 50 });
                } else {
                    setTimeout(renderBatch, 0);
                }
            } else {
                callback();
            }
        };
        
        renderBatch();
    }

    // Handle virtual scroll events
    handleVirtualScroll() {
        if (!this.virtualScrollElements || !this.virtualScrollConfig) return;
        
        const { container } = this.virtualScrollElements;
        const { rowHeight, visibleRows, bufferRows, totalRows } = this.virtualScrollConfig;
        
        const scrollTop = container.scrollTop;
        const newStartIndex = Math.floor(scrollTop / rowHeight);
        const newEndIndex = Math.min(newStartIndex + visibleRows + (bufferRows * 2), totalRows);
        
        // Only update if the visible range has changed significantly
        const threshold = Math.floor(bufferRows / 2);
        if (Math.abs(newStartIndex - this.virtualScrollConfig.startIndex) > threshold) {
            this.virtualScrollConfig.startIndex = Math.max(0, newStartIndex - bufferRows);
            this.virtualScrollConfig.endIndex = newEndIndex;
            
            // Update spacers
            this.updateVirtualScrollSpacers();
            
            // Re-render visible rows
            this.renderVirtualScrollRows();
        }
    }

    // Update virtual scroll spacers
    updateVirtualScrollSpacers() {
        if (!this.virtualScrollElements || !this.virtualScrollConfig) return;
        
        const { topSpacer, bottomSpacer } = this.virtualScrollElements;
        const { startIndex, endIndex, totalRows, rowHeight } = this.virtualScrollConfig;
        
        // Update top spacer height
        topSpacer.style.height = `${startIndex * rowHeight}px`;
        
        // Update bottom spacer height
        bottomSpacer.style.height = `${(totalRows - endIndex) * rowHeight}px`;
    }

    // Create a single table row
    createTableRow(row, rowIndex) {
        const tr = Utils.createElement('tr', '', {
            role: 'row',
            tabindex: '0',
            'data-row-index': rowIndex.toString(),
            'aria-rowindex': (rowIndex + 2).toString() // +2 because header is row 1
        });
        
        row.forEach((cell, cellIndex) => {
            const headerId = `header-${this.sectionKey}-${cellIndex}`;
            const td = Utils.createElement('td', '', { 
                role: 'cell',
                'headers': headerId,
                'aria-describedby': headerId
            });
            
            // Format cell content based on column type
            const formattedContent = this.formatCellContent(cell, this.currentData.columns[cellIndex]);
            
            if (typeof formattedContent === 'string') {
                td.textContent = formattedContent;
            } else {
                td.appendChild(formattedContent);
            }
            
            tr.appendChild(td);
        });
        
        return tr;
    }

    // Format cell content based on column type
    formatCellContent(cell, columnName) {
        // Handle null/undefined values
        if (cell === null || cell === undefined) {
            return '-';
        }
        
        const cellStr = String(cell);
        
        // Format memory values
        if (this.isMemoryColumn(columnName)) {
            return this.formatMemoryValue(cellStr);
        }
        
        // Format numeric values
        if (this.isNumericColumn(columnName) && !isNaN(parseFloat(cellStr))) {
            return Utils.formatNumber(parseFloat(cellStr));
        }
        
        // Default string formatting
        return cellStr;
    }

    // Check if column contains memory values
    isMemoryColumn(columnName) {
        return /\b(KB|MB|Bytes?|Size|Memory)\b/i.test(columnName);
    }

    // Check if column is numeric
    isNumericColumn(columnName) {
        return this.appState.isNumericColumn(columnName);
    }

    // Format memory values with appropriate units
    formatMemoryValue(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return value;
        
        // Convert to appropriate units
        if (numValue >= 1024 * 1024) {
            return `${(numValue / (1024 * 1024)).toFixed(2)} GB`;
        } else if (numValue >= 1024) {
            return `${(numValue / 1024).toFixed(2)} MB`;
        } else {
            return `${numValue.toFixed(0)} KB`;
        }
    }

    // Handle column sorting
    handleSort(columnIndex) {
        const currentSort = this.appState.getState().memreport.ui.sectionSorts[this.sectionKey] || {};
        
        let newDirection = 'asc';
        if (currentSort.column === columnIndex) {
            // Toggle direction if same column
            newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
        }
        
        // Update sort state
        this.appState.updateMemReportSort(this.sectionKey, {
            column: columnIndex,
            direction: newDirection
        });
        
        // Re-render table with new sort
        this.render();
        
        // Announce sort change to screen readers
        const columnName = this.currentData.columns[columnIndex];
        Utils.announceToScreenReader(`Table sorted by ${columnName} in ${newDirection}ending order`);
    }

    // Get ARIA sort value for accessibility
    getAriaSortValue(columnIndex, sortState) {
        if (sortState.column !== columnIndex) {
            return 'none';
        }
        return sortState.direction === 'asc' ? 'ascending' : 'descending';
    }

    // Get sort indicator HTML
    getSortIndicator(columnIndex, sortState) {
        if (sortState.column !== columnIndex) {
            return '↕️'; // Unsorted
        }
        return sortState.direction === 'asc' ? '↑' : '↓';
    }

    // Get sort indicator title for accessibility
    getSortIndicatorTitle(columnIndex, sortState) {
        const columnName = this.currentData.columns[columnIndex];
        if (sortState.column !== columnIndex) {
            return `Click to sort by ${columnName}`;
        }
        const currentDirection = sortState.direction === 'asc' ? 'ascending' : 'descending';
        const nextDirection = sortState.direction === 'asc' ? 'descending' : 'ascending';
        return `Currently sorted by ${columnName} in ${currentDirection} order. Click to sort in ${nextDirection} order.`;
    }

    // Update table data (called when filters change)
    updateData(newSectionData) {
        const previousRowCount = this.currentData ? this.currentData.rows.length : 0;
        this.currentData = newSectionData;
        const newRowCount = this.currentData.rows.length;
        
        // Check if we need to switch between virtual and standard scrolling
        const wasVirtual = this.virtualScrollConfig !== undefined;
        const shouldBeVirtual = this.currentData.rows.length > 500;
        
        if (wasVirtual !== shouldBeVirtual) {
            // Need to completely re-render the table
            this.render();
            return;
        }
        
        if (shouldBeVirtual && this.virtualScrollConfig) {
            // Update virtual scrolling configuration
            this.virtualScrollConfig.totalRows = this.currentData.rows.length;
            this.virtualScrollConfig.endIndex = Math.min(
                this.virtualScrollConfig.startIndex + this.virtualScrollConfig.visibleRows + this.virtualScrollConfig.bufferRows,
                this.virtualScrollConfig.totalRows
            );
            
            // Update spacers and re-render visible rows
            this.updateVirtualScrollSpacers();
            this.renderVirtualScrollRows();
        } else {
            // Standard table update
            const tbody = this.tableElement.querySelector('tbody');
            if (tbody) {
                const newTbody = this.createTableBody();
                this.tableElement.replaceChild(newTbody, tbody);
            }
        }
        
        // Update header sort indicators
        this.updateHeaderSortIndicators();
        
        // Announce changes to screen readers if row count changed
        if (newRowCount !== previousRowCount) {
            const sectionTitle = this.currentData.title || 'table';
            Utils.announceToScreenReader(`${sectionTitle} updated. Now showing ${newRowCount} rows.`);
        }
    }

    // Update header sort indicators
    updateHeaderSortIndicators() {
        const sortState = this.appState.getState().memreport.ui.sectionSorts[this.sectionKey] || {};
        
        this.headerElements.forEach((th, index) => {
            const sortIndicator = th.querySelector('.sort-indicator');
            if (sortIndicator) {
                sortIndicator.innerHTML = this.getSortIndicator(index, sortState);
            }
            th.setAttribute('aria-sort', this.getAriaSortValue(index, sortState));
        });
    }

    // Render empty state
    renderEmptyState() {
        const emptyDiv = Utils.createElement('div', 'text-center text-muted p-4');
        emptyDiv.innerHTML = `
            <p class="mb-0">No tabular data available for this section</p>
            <small>This section may contain raw text or key-value data</small>
        `;
        this.container.appendChild(emptyDiv);
    }

    // Setup keyboard navigation for table
    setupKeyboardNavigation() {
        if (!this.tableElement) return;
        
        // Handle keyboard navigation within table
        this.tableElement.addEventListener('keydown', (e) => {
            const focusedElement = document.activeElement;
            
            // Navigation within header
            if (focusedElement.tagName === 'TH') {
                this.handleHeaderNavigation(e, focusedElement);
            }
            // Navigation within body
            else if (focusedElement.tagName === 'TR') {
                this.handleRowNavigation(e, focusedElement);
            }
        });
    }

    // Handle keyboard navigation in table header
    handleHeaderNavigation(e, currentHeader) {
        const headers = Array.from(this.tableElement.querySelectorAll('th'));
        const currentIndex = headers.indexOf(currentHeader);
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (currentIndex > 0) {
                    headers[currentIndex - 1].focus();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentIndex < headers.length - 1) {
                    headers[currentIndex + 1].focus();
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                // Move to first data row
                const firstRow = this.tableElement.querySelector('tbody tr');
                if (firstRow) {
                    firstRow.focus();
                }
                break;
        }
    }

    // Handle keyboard navigation in table rows
    handleRowNavigation(e, currentRow) {
        const rows = Array.from(this.tableElement.querySelectorAll('tbody tr'));
        const currentIndex = rows.indexOf(currentRow);
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    rows[currentIndex - 1].focus();
                } else {
                    // Move to header
                    const firstHeader = this.tableElement.querySelector('th');
                    if (firstHeader) {
                        firstHeader.focus();
                    }
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < rows.length - 1) {
                    rows[currentIndex + 1].focus();
                }
                break;
            case 'Home':
                e.preventDefault();
                if (rows.length > 0) {
                    rows[0].focus();
                }
                break;
            case 'End':
                e.preventDefault();
                if (rows.length > 0) {
                    rows[rows.length - 1].focus();
                }
                break;
        }
    }

    // Get current sort state for external access
    getCurrentSort() {
        return this.appState.getState().memreport.ui.sectionSorts[this.sectionKey] || {};
    }

    // Clear sort
    clearSort() {
        this.appState.updateMemReportSort(this.sectionKey, null);
        this.render();
    }

    // Get filtered row count
    getFilteredRowCount() {
        return this.currentData ? this.currentData.rows.length : 0;
    }

    // Get total row count (unfiltered)
    getTotalRowCount() {
        return this.originalData.rows ? this.originalData.rows.length : 0;
    }

    // Cleanup virtual scrolling resources
    cleanup() {
        if (this.virtualScrollElements && this.virtualScrollElements.container) {
            // Remove scroll event listeners
            const container = this.virtualScrollElements.container;
            const scrollHandler = this.handleVirtualScroll.bind(this);
            container.removeEventListener('scroll', scrollHandler);
        }
        
        // Clear virtual scroll references
        this.virtualScrollConfig = null;
        this.virtualScrollElements = null;
        this.virtualTbody = null;
    }

    // Check if table is using virtual scrolling
    isVirtualScrolling() {
        return this.virtualScrollConfig !== undefined;
    }

    // Get virtual scroll statistics
    getVirtualScrollStats() {
        if (!this.virtualScrollConfig) {
            return null;
        }
        
        return {
            totalRows: this.virtualScrollConfig.totalRows,
            visibleRows: this.virtualScrollConfig.visibleRows,
            startIndex: this.virtualScrollConfig.startIndex,
            endIndex: this.virtualScrollConfig.endIndex,
            renderedRows: this.virtualScrollConfig.endIndex - this.virtualScrollConfig.startIndex
        };
    }
}

// Export MemReportTable for use in other modules
window.MemReportTable = MemReportTable;

// Enhanced search and filtering functionality for MemReport sections
class MemReportSearchFilter {
    constructor(sectionKey, appState) {
        this.sectionKey = sectionKey;
        this.appState = appState;
        this.searchInput = null;
        this.clearButton = null;
        this.filterContainer = null;
        this.debounceTimeout = null;
    }

    // Create enhanced search input with additional filter options
    createSearchContainer() {
        this.filterContainer = Utils.createElement('div', 'mb-3 section-search-filters');
        
        // Main search input group
        const searchGroup = this.createMainSearchInput();
        this.filterContainer.appendChild(searchGroup);
        
        // Filter status and controls
        const filterStatus = this.createFilterStatus();
        this.filterContainer.appendChild(filterStatus);
        
        return this.filterContainer;
    }

    // Create main search input
    createMainSearchInput() {
        const inputGroup = Utils.createElement('div', 'input-group');
        
        // Search input
        this.searchInput = Utils.createElement('input', 'form-control', {
            type: 'text',
            placeholder: 'Search this section...',
            'aria-label': 'Search section',
            id: `search-${this.sectionKey}`,
            'aria-describedby': `search-help-${this.sectionKey}`
        });
        
        // Clear button
        this.clearButton = Utils.createElement('button', 'btn btn-outline-secondary', {
            type: 'button',
            title: 'Clear search',
            'aria-label': 'Clear search'
        });
        this.clearButton.innerHTML = '✕';
        
        // Search button (for explicit search trigger)
        const searchButton = Utils.createElement('button', 'btn btn-outline-primary', {
            type: 'button',
            title: 'Search',
            'aria-label': 'Perform search'
        });
        searchButton.innerHTML = '🔍';
        
        // Get current search term
        const filters = this.appState.getState().memreport.ui.sectionFilters[this.sectionKey];
        if (filters && filters.search) {
            this.searchInput.value = filters.search;
        }
        
        // Event handlers
        this.setupSearchEventHandlers();
        
        inputGroup.appendChild(this.searchInput);
        inputGroup.appendChild(this.clearButton);
        inputGroup.appendChild(searchButton);
        
        // Help text
        const helpText = Utils.createElement('div', 'form-text', {
            id: `search-help-${this.sectionKey}`
        });
        helpText.textContent = 'Search across all columns. Use quotes for exact phrases.';
        
        const searchContainer = Utils.createElement('div');
        searchContainer.appendChild(inputGroup);
        searchContainer.appendChild(helpText);
        
        return searchContainer;
    }

    // Create filter status display
    createFilterStatus() {
        const statusContainer = Utils.createElement('div', 'filter-status d-flex justify-content-between align-items-center');
        
        // Results count
        const resultsCount = Utils.createElement('small', 'text-muted', {
            id: `results-count-${this.sectionKey}`
        });
        this.updateResultsCount(resultsCount);
        
        // Filter controls
        const filterControls = Utils.createElement('div', 'filter-controls');
        
        // Clear all filters button
        const clearAllButton = Utils.createElement('button', 'btn btn-sm btn-outline-secondary', {
            type: 'button',
            title: 'Clear all filters',
            'aria-label': 'Clear all filters for this section'
        });
        clearAllButton.innerHTML = '🗑️ Clear Filters';
        clearAllButton.addEventListener('click', () => this.clearAllFilters());
        
        filterControls.appendChild(clearAllButton);
        
        statusContainer.appendChild(resultsCount);
        statusContainer.appendChild(filterControls);
        
        return statusContainer;
    }

    // Setup search event handlers with debouncing
    setupSearchEventHandlers() {
        // Debounced search handler (300ms delay)
        const debouncedSearch = (term) => {
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            
            this.debounceTimeout = setTimeout(() => {
                this.performSearch(term);
            }, 300);
        };
        
        // Input event for real-time search
        this.searchInput.addEventListener('input', (e) => {
            const term = e.target.value.trim();
            debouncedSearch(term);
        });
        
        // Clear button
        this.clearButton.addEventListener('click', () => {
            this.clearSearch();
        });
        
        // Keyboard shortcuts
        this.searchInput.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    // Immediate search on Enter
                    if (this.debounceTimeout) {
                        clearTimeout(this.debounceTimeout);
                    }
                    this.performSearch(this.searchInput.value.trim());
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.clearSearch();
                    break;
            }
        });
        
        // Focus management
        this.searchInput.addEventListener('focus', () => {
            this.searchInput.select(); // Select all text on focus
        });
    }

    // Perform search with the given term
    performSearch(searchTerm) {
        // Update state with new search term
        this.appState.updateMemReportFilters(this.sectionKey, { search: searchTerm });
        
        // Update UI
        this.updateFilterDisplay();
        
        // Announce to screen readers
        if (searchTerm) {
            const section = this.appState.getFilteredSectionData(this.sectionKey);
            const resultCount = section.rows ? section.rows.length : 0;
            Utils.announceToScreenReader(`Search completed. ${resultCount} results found for "${searchTerm}"`);
        }
    }

    // Clear search
    clearSearch() {
        this.searchInput.value = '';
        this.performSearch('');
        this.searchInput.focus();
    }

    // Clear all filters for this section
    clearAllFilters() {
        // Clear search
        this.searchInput.value = '';
        
        // Clear all filters in state
        this.appState.updateMemReportFilters(this.sectionKey, { search: '' });
        this.appState.updateMemReportSort(this.sectionKey, null);
        
        // Update UI
        this.updateFilterDisplay();
        
        // Focus search input
        this.searchInput.focus();
        
        Utils.announceToScreenReader('All filters cleared for this section');
    }

    // Update filter display (results count, etc.)
    updateFilterDisplay() {
        const resultsCountElement = document.getElementById(`results-count-${this.sectionKey}`);
        if (resultsCountElement) {
            this.updateResultsCount(resultsCountElement);
        }
        
        // Trigger table update if it exists
        const event = new CustomEvent('filterUpdate', {
            detail: { sectionKey: this.sectionKey }
        });
        document.dispatchEvent(event);
    }

    // Update results count display
    updateResultsCount(element) {
        const section = this.appState.getFilteredSectionData(this.sectionKey);
        const originalSection = this.appState.getState().memreport.sections.find(s => s.key === this.sectionKey);
        
        if (section && originalSection) {
            const filteredCount = section.rows ? section.rows.length : 0;
            const totalCount = originalSection.rows ? originalSection.rows.length : 0;
            
            if (filteredCount === totalCount) {
                element.textContent = `Showing all ${totalCount} rows`;
            } else {
                element.textContent = `Showing ${filteredCount} of ${totalCount} rows`;
            }
        }
    }

    // Get current search term
    getCurrentSearchTerm() {
        return this.searchInput ? this.searchInput.value.trim() : '';
    }

    // Set search term programmatically
    setSearchTerm(term) {
        if (this.searchInput) {
            this.searchInput.value = term;
            this.performSearch(term);
        }
    }

    // Check if section has active filters
    hasActiveFilters() {
        const filters = this.appState.getState().memreport.ui.sectionFilters[this.sectionKey];
        const sort = this.appState.getState().memreport.ui.sectionSorts[this.sectionKey];
        
        return (filters && filters.search) || (sort && sort.column !== undefined);
    }

    // Destroy the search filter instance
    destroy() {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        
        // Remove event listeners
        if (this.searchInput) {
            this.searchInput.removeEventListener('input', this.handleInput);
            this.searchInput.removeEventListener('keydown', this.handleKeydown);
        }
        
        if (this.clearButton) {
            this.clearButton.removeEventListener('click', this.clearSearch);
        }
    }
}

// Enhanced MemReportPage methods for search integration
MemReportPage.prototype.createEnhancedSearchInput = function(sectionKey) {
    const searchFilter = new MemReportSearchFilter(sectionKey, this.appState);
    return searchFilter.createSearchContainer();
};

// Update the renderTableSection method to use enhanced search
MemReportPage.prototype.renderTableSectionWithEnhancedSearch = function(section) {
    const tableContainer = Utils.createElement('div', 'table-section');
    
    // Add enhanced search input if section has search enabled
    const filters = this.appState.getState().memreport.ui.sectionFilters[section.key];
    if (filters && filters.searchVisible) {
        const searchContainer = this.createEnhancedSearchInput(section.key);
        tableContainer.appendChild(searchContainer);
    }
    
    // Create table wrapper
    const tableWrapper = Utils.createElement('div', 'table-responsive');
    const tableElement = Utils.createElement('div', 'memreport-table', {
        id: `table-${section.key}`
    });
    
    tableWrapper.appendChild(tableElement);
    tableContainer.appendChild(tableWrapper);
    
    // Create and store table instance
    const table = new MemReportTable(section, tableElement, this.appState);
    this.tables.set(section.key, table);
    table.render();
    
    // Listen for filter updates
    document.addEventListener('filterUpdate', (e) => {
        if (e.detail.sectionKey === section.key) {
            table.updateData(this.appState.getFilteredSectionData(section.key));
        }
    });
    
    return tableContainer;
};

// Export MemReportSearchFilter for use in other modules
window.MemReportSearchFilter = MemReportSearchFilter;