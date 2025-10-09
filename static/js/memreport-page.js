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

    // Main render method - renders the entire MemReport page
    render(memreportData) {
        const container = document.getElementById('logContent');
        if (!container) {
            console.error('MemReport container not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        // Create main container
        const memreportContainer = Utils.createElement('div', 'memreport-container');
        
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
        
        // Announce to screen readers
        Utils.announceToScreenReader(`MemReport loaded with ${orderedSections.length} sections`);
    }

    // Render metadata overview section
    renderMetadata(meta) {
        const metaCard = Utils.createElement('div', 'card mb-3 memreport-meta');
        
        const cardHeader = Utils.createElement('div', 'card-header');
        const headerTitle = Utils.createElement('h5', 'mb-0');
        headerTitle.textContent = 'Memory Report Overview';
        cardHeader.appendChild(headerTitle);
        
        const cardBody = Utils.createElement('div', 'card-body');
        
        // Create metadata table
        const metaTable = Utils.createElement('table', 'table table-sm');
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
                const row = Utils.createElement('tr');
                const labelCell = Utils.createElement('td');
                labelCell.textContent = field.label;
                const valueCell = Utils.createElement('td');
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
        const sectionCard = Utils.createElement('div', 'card mb-3 memreport-section');
        sectionCard.setAttribute('data-section-key', section.key);
        
        // Create section header
        const sectionHeader = this.createSectionHeader(section);
        sectionCard.appendChild(sectionHeader);
        
        // Create collapsible content
        const collapseId = `collapse-${section.key}`;
        const isCollapsed = this.appState.isSectionCollapsed(section.key);
        
        const collapseDiv = Utils.createElement('div', `collapse ${isCollapsed ? '' : 'show'}`, {
            id: collapseId
        });
        
        const cardBody = Utils.createElement('div', 'card-body');
        
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
        
        const cardHeader = Utils.createElement('div', 'card-header sticky-card-header');
        cardHeader.setAttribute('id', `section-${section.key}`);
        
        const headerRow = Utils.createElement('div', 'd-flex justify-content-between align-items-center');
        
        // Left side - title and collapse button
        const leftSide = Utils.createElement('div', 'd-flex align-items-center');
        
        const collapseButton = Utils.createElement('button', 'btn btn-link text-decoration-none p-0', {
            'data-bs-toggle': 'collapse',
            'data-bs-target': `#collapse-${section.key}`,
            'aria-expanded': isCollapsed ? 'false' : 'true',
            'aria-controls': `collapse-${section.key}`
        });
        
        const titleText = Utils.createElement('h5', 'mb-0 me-2');
        titleText.textContent = section.title;
        
        // Row count badge
        const rowCount = this.getSectionRowCount(section);
        const countBadge = Utils.createElement('span', 'badge bg-secondary me-2', {
            id: `count-${section.key}`
        });
        countBadge.textContent = `${rowCount} ${section.type === 'table' ? 'rows' : 'items'}`;
        
        // Pin indicator
        if (isPinned) {
            const pinIndicator = Utils.createElement('span', 'badge bg-primary me-2');
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
        
        // Add collapse event listeners
        const collapseElement = document.querySelector(`#collapse-${section.key}`);
        if (collapseElement) {
            collapseElement.addEventListener('shown.bs.collapse', () => {
                this.appState.toggleSectionCollapsed(section.key);
            });
            collapseElement.addEventListener('hidden.bs.collapse', () => {
                this.appState.toggleSectionCollapsed(section.key);
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
            const searchBtn = Utils.createElement('button', 'btn btn-outline-secondary', {
                type: 'button',
                title: 'Search this section',
                'aria-label': `Search ${section.title}`
            });
            searchBtn.innerHTML = '🔍';
            searchBtn.addEventListener('click', () => this.toggleSectionSearch(section.key));
            buttonGroup.appendChild(searchBtn);
        }
        
        // Export button
        const exportBtn = Utils.createElement('button', 'btn btn-outline-secondary', {
            type: 'button',
            title: 'Export section data',
            'aria-label': `Export ${section.title}`
        });
        exportBtn.innerHTML = '📊';
        exportBtn.addEventListener('click', () => this.showExportOptions(section.key));
        buttonGroup.appendChild(exportBtn);
        
        // Pin/Unpin button
        const isPinned = this.appState.isSectionPinned(section.key);
        const pinBtn = Utils.createElement('button', 'btn btn-outline-secondary', {
            type: 'button',
            title: isPinned ? 'Unpin section' : 'Pin section to top',
            'aria-label': `${isPinned ? 'Unpin' : 'Pin'} ${section.title}`
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
        
        // Add search input if section has search enabled
        const filters = this.appState.getState().memreport.ui.sectionFilters[section.key];
        if (filters && filters.searchVisible) {
            const searchContainer = this.createSearchInput(section.key);
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
        
        return tableContainer;
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
        
        const kvTable = Utils.createElement('table', 'table table-sm table-striped');
        const tbody = Utils.createElement('tbody');
        
        section.items.forEach(item => {
            const row = Utils.createElement('tr');
            
            const nameCell = Utils.createElement('td', 'fw-bold');
            nameCell.textContent = item.name;
            
            const valueCell = Utils.createElement('td');
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
        
        // Show error message if present
        if (section.error) {
            const errorAlert = Utils.createElement('div', 'alert alert-warning');
            errorAlert.innerHTML = `<strong>Parsing Error:</strong> ${Utils.sanitizeInput(section.error)}`;
            rawContainer.appendChild(errorAlert);
        }
        
        const preElement = Utils.createElement('pre', 'bg-light p-3 border rounded');
        const codeElement = Utils.createElement('code');
        
        if (section.rawLines && section.rawLines.length > 0) {
            codeElement.textContent = section.rawLines.join('\n');
        } else {
            codeElement.textContent = 'No raw data available';
        }
        
        preElement.appendChild(codeElement);
        rawContainer.appendChild(preElement);
        
        return rawContainer;
    }

    // Create search input for table sections
    createSearchInput(sectionKey) {
        const searchContainer = Utils.createElement('div', 'mb-3 section-search');
        
        const inputGroup = Utils.createElement('div', 'input-group');
        
        const searchInput = Utils.createElement('input', 'form-control', {
            type: 'text',
            placeholder: 'Search this section...',
            'aria-label': 'Search section',
            id: `search-${sectionKey}`
        });
        
        const clearButton = Utils.createElement('button', 'btn btn-outline-secondary', {
            type: 'button',
            title: 'Clear search',
            'aria-label': 'Clear search'
        });
        clearButton.innerHTML = '✕';
        
        // Get current search term
        const filters = this.appState.getState().memreport.ui.sectionFilters[sectionKey];
        if (filters && filters.search) {
            searchInput.value = filters.search;
        }
        
        // Debounced search handler
        const debouncedSearch = Utils.debounce((term) => {
            this.appState.updateMemReportFilters(sectionKey, { search: term });
            this.updateSectionTable(sectionKey);
        }, 300);
        
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
        
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            this.appState.updateMemReportFilters(sectionKey, { search: '' });
            this.updateSectionTable(sectionKey);
            searchInput.focus();
        });
        
        inputGroup.appendChild(searchInput);
        inputGroup.appendChild(clearButton);
        searchContainer.appendChild(inputGroup);
        
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
        const menu = Utils.createElement('div', 'dropdown-menu show position-absolute');
        menu.style.zIndex = '1050';
        
        const csvOption = Utils.createElement('button', 'dropdown-item');
        csvOption.textContent = 'Export as CSV';
        csvOption.addEventListener('click', () => {
            this.exportSectionAsCSV(section);
            document.body.removeChild(menu);
        });
        
        const jsonOption = Utils.createElement('button', 'dropdown-item');
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
            // Add headers
            csvContent += section.columns.map(col => `"${col}"`).join(',') + '\n';
            
            // Add rows
            section.rows.forEach(row => {
                csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
            });
        } else if (section.type === 'kv') {
            csvContent += '"Name","Value"\n';
            section.items.forEach(item => {
                const value = item.unit ? `${item.value} ${item.unit}` : item.value;
                csvContent += `"${item.name}","${value}"\n`;
            });
        }
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = Utils.createElement('a');
        a.href = url;
        a.download = `${section.key}_data.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Utils.showSuccessToast('Section exported as CSV');
    }

    // Export section as JSON
    exportSectionAsJSON(section) {
        const jsonData = {
            title: section.title,
            type: section.type,
            data: section.type === 'table' ? {
                columns: section.columns,
                rows: section.rows
            } : section.items || section.rawLines
        };
        
        const jsonContent = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = Utils.createElement('a');
        a.href = url;
        a.download = `${section.key}_data.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Utils.showSuccessToast('Section exported as JSON');
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
                countBadge.textContent = `${count} ${section.type === 'table' ? 'rows' : 'items'}`;
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
        const errorsCard = Utils.createElement('div', 'card mb-3 border-warning');
        
        const cardHeader = Utils.createElement('div', 'card-header bg-warning text-dark');
        const headerTitle = Utils.createElement('h5', 'mb-0');
        headerTitle.textContent = `Parse Warnings (${parseErrors.length})`;
        cardHeader.appendChild(headerTitle);
        
        const cardBody = Utils.createElement('div', 'card-body');
        
        const errorsList = Utils.createElement('ul', 'list-unstyled mb-0');
        parseErrors.forEach(error => {
            const errorItem = Utils.createElement('li', 'mb-2');
            errorItem.innerHTML = `<code>${Utils.sanitizeInput(error.message)}</code>`;
            errorsList.appendChild(errorItem);
        });
        
        cardBody.appendChild(errorsList);
        errorsCard.appendChild(cardHeader);
        errorsCard.appendChild(cardBody);
        
        return errorsCard;
    }

    // Cleanup method
    cleanup() {
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
            const th = Utils.createElement('th', 'sortable-header', {
                role: 'columnheader',
                tabindex: '0',
                'aria-sort': this.getAriaSortValue(index, sortState),
                'data-column-index': index.toString()
            });
            
            // Create header content container
            const headerContent = Utils.createElement('div', 'd-flex justify-content-between align-items-center');
            
            // Column title
            const titleSpan = Utils.createElement('span');
            titleSpan.textContent = column;
            headerContent.appendChild(titleSpan);
            
            // Sort indicator
            const sortIndicator = Utils.createElement('span', 'sort-indicator ms-2', {
                'aria-hidden': 'true'
            });
            sortIndicator.innerHTML = this.getSortIndicator(index, sortState);
            headerContent.appendChild(sortIndicator);
            
            th.appendChild(headerContent);
            
            // Add click handler for sorting
            th.addEventListener('click', () => this.handleSort(index));
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleSort(index);
                }
            });
            
            this.headerElements.push(th);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        return thead;
    }

    // Create table body with data rows
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
        
        // Use DocumentFragment for performance
        const fragment = document.createDocumentFragment();
        
        this.currentData.rows.forEach((row, rowIndex) => {
            const tr = Utils.createElement('tr', '', {
                role: 'row',
                tabindex: '0'
            });
            
            row.forEach((cell, cellIndex) => {
                const td = Utils.createElement('td', '', { role: 'cell' });
                
                // Format cell content based on column type
                const formattedContent = this.formatCellContent(cell, this.currentData.columns[cellIndex]);
                
                if (typeof formattedContent === 'string') {
                    td.textContent = formattedContent;
                } else {
                    td.appendChild(formattedContent);
                }
                
                tr.appendChild(td);
            });
            
            fragment.appendChild(tr);
        });
        
        tbody.appendChild(fragment);
        return tbody;
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

    // Update table data (called when filters change)
    updateData(newSectionData) {
        this.currentData = newSectionData;
        
        // Re-render only the body for performance
        const tbody = this.tableElement.querySelector('tbody');
        if (tbody) {
            const newTbody = this.createTableBody();
            this.tableElement.replaceChild(newTbody, tbody);
        }
        
        // Update header sort indicators
        this.updateHeaderSortIndicators();
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