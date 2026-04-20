// Main application module - VERSION 1.7

class LogAnalyzerApp {
    constructor() {
        this.appState = new AppState();
        this.ui = new UI();
        this.routes = { 'log': 'log-panel', 'memreport': 'memreport-panel' };
        this.currentRoute = 'log';
        this.memreportPage = null;
        this.initializeApp();
    }

    initializeApp() {
        this.ui.initialize();
        this.setupEventListeners();
        this.setupStateSubscriptions();
    }

    setupEventListeners() {
        const logTab = document.getElementById('log-tab');
        const memreportTab = document.getElementById('memreport-tab');
        if (logTab) logTab.addEventListener('click', () => this.switchRoute('log'));
        if (memreportTab) memreportTab.addEventListener('click', () => this.switchRoute('memreport'));

        if (this.ui.elements.uploadForm) {
            this.ui.elements.uploadForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleFileUpload(); });
        }
        const pasteForm = document.getElementById('pasteForm');
        if (pasteForm) pasteForm.addEventListener('submit', (e) => { e.preventDefault(); this.handlePasteAnalyze(); });

        const pasteClearButton = document.getElementById('pasteClearButton');
        if (pasteClearButton) pasteClearButton.addEventListener('click', () => {
            const textarea = document.getElementById('pasteLogText');
            if (textarea) textarea.value = '';
        });

        if (this.ui.elements.logFile) {
            this.ui.elements.logFile.addEventListener('change', async () => {
                if (this.ui.elements.logFile.files.length > 0)
                    await this.handleFileSelection(this.ui.elements.logFile.files[0]);
            });
        }

        const memreportUploadForm = document.getElementById('memreportUploadForm');
        const memreportFile = document.getElementById('memreportFile');
        if (memreportUploadForm) {
            memreportUploadForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleMemReportFileUpload(); });
        }
        if (memreportFile) {
            memreportFile.addEventListener('change', async () => {
                if (memreportFile.files.length > 0)
                    await this.handleFileSelection(memreportFile.files[0]);
            });
        }

        this.setupDragAndDrop();

        if (this.ui.elements.logSearchInput) {
            const debouncedSearch = Utils.debounce(() => this.handleSearchChange(), 300);
            this.ui.elements.logSearchInput.addEventListener('input', debouncedSearch);
        }
        if (this.ui.elements.caseSensitive)
            this.ui.elements.caseSensitive.addEventListener('change', () => this.handleSearchOptionsChange());
        if (this.ui.elements.useRegex)
            this.ui.elements.useRegex.addEventListener('change', () => this.handleSearchOptionsChange());
        if (this.ui.elements.collapseDuplicates) {
            this.ui.elements.collapseDuplicates.addEventListener('change', () => {
                this.appState.updateFilters({ collapseDuplicates: this.ui.getCollapseDuplicates() });
                this.updateDisplay();
            });
        }

        document.querySelectorAll('.log-level-filter').forEach(cb => {
            cb.addEventListener('change', () => this.handleLevelFilterChange());
        });

        if (this.ui.elements.copyButton)
            this.ui.elements.copyButton.addEventListener('click', () => this.ui.copyFilteredResults());
        if (this.ui.elements.exportCsv)
            this.ui.elements.exportCsv.addEventListener('click', () => this.ui.exportToCsv());
        if (this.ui.elements.exportJson)
            this.ui.elements.exportJson.addEventListener('click', () => this.ui.exportToJson());
    }

    setupDragAndDrop() {
        const dropZones = [
            { element: document.getElementById('dropZone'), input: document.getElementById('logFile') },
            { element: document.getElementById('memreportDropZone'), input: document.getElementById('memreportFile') }
        ];
        dropZones.forEach(({ element, input }) => {
            if (!element || !input) return;
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
                element.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); })
            );
            ['dragenter', 'dragover'].forEach(ev => element.addEventListener(ev, () => element.classList.add('drag-over')));
            ['dragleave', 'drop'].forEach(ev => element.addEventListener(ev, () => element.classList.remove('drag-over')));
            element.addEventListener('drop', async (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const dt = new DataTransfer(); dt.items.add(files[0]); input.files = dt.files;
                    await this.handleFileSelection(files[0]);
                }
            });
            element.addEventListener('click', () => input.click());
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
            });
        });
    }

    setupStateSubscriptions() {
        this.appState.subscribe((state) => this.handleStateChange(state));
    }

    handleStateChange(state) {
        if (state.allEntries.length > 0) this.updateDisplay();
    }

    switchRoute(route) {
        if (this.routes[route] && this.currentRoute !== route) {
            const previousRoute = this.currentRoute;
            this.currentRoute = route;
            this.appState.setCurrentRoute(route);
            this.performRouteCleanup(previousRoute);
            const tabTrigger = document.querySelector(`#${route}-tab`);
            if (tabTrigger) new bootstrap.Tab(tabTrigger).show();
            this.initializeRouteComponents(route);
        }
    }

    performRouteCleanup(route) {
        if (route === 'memreport' && this.memreportPage) {
            const mc = document.getElementById('memreportContent');
            if (mc) { this.memreportPage.cleanupCharts(mc); mc.innerHTML = ''; }
        } else if (route === 'log') {
            const lc = document.getElementById('logContent');
            if (lc && lc.querySelectorAll('.log-entry').length > 1000) lc.innerHTML = '';
        }
    }

    initializeRouteComponents(route) {
        if (route === 'memreport' && !this.memreportPage) {
            this.memreportPage = new MemReportPage(this.appState, this.ui, Utils);
            this.memreportPage.initialize();
        }
    }

    async handleFileSelection(file) {
        if (!file) { Utils.showErrorToast('Please select a file'); return; }
        try {
            const fileType = await this.detectFileTypeWithContent(file);
            if (fileType === 'memreport') {
                this.switchRoute('memreport');
                const mf = document.getElementById('memreportFile');
                if (mf) { const dt = new DataTransfer(); dt.items.add(file); mf.files = dt.files; await this.handleMemReportFileUpload(); }
            } else {
                this.switchRoute('log');
                const lf = document.getElementById('logFile');
                if (lf) { const dt = new DataTransfer(); dt.items.add(file); lf.files = dt.files; }
                await this.handleLogFileUpload();
            }
        } catch (error) {
            console.error('Error in file selection:', error);
            Utils.showErrorToast('Failed to process file: ' + error.message);
        }
    }

    async detectFileTypeWithContent(file) {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.memreport')) return 'memreport';
        if (fileName.endsWith('.txt')) {
            try {
                const firstChunk = await this.readFileChunk(file, 0, 2048);
                if (this.isMemReportContent(firstChunk)) return 'memreport';
            } catch (e) { console.warn('Could not read file chunk for type detection:', e); }
        }
        return 'log';
    }

    readFileChunk(file, start, length) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file chunk'));
            reader.readAsText(file.slice(start, start + length));
        });
    }

    isMemReportContent(content) {
        return [
            /^=+\s*(Memory Overview|Platform Memory|Memory Summary)\s*=+$/im,
            /^=+\s*Obj List.*=+$/im,
            /^=+\s*(RHI|Rendering).*Memory.*=+$/im,
            /^=+\s*Streaming Levels.*=+$/im,
            /^=+\s*Actors.*=+$/im,
            /^=+\s*(ListTextures|Texture).*=+$/im,
            /^=+\s*(ListStaticMeshes|Static.*Mesh).*=+$/im
        ].some(p => p.test(content));
    }

    // ── Crash-first panel ────────────────────────────────────────────────────
    // Categories whose Error-level entries are always surfaced in the crash panel.
    static get CRASH_CATEGORIES() {
        return new Set(['LogOutputDevice', 'LogWindows', 'LogCore', 'LogInit']);
    }

    isCrashEntry(entry) {
        const c = entry.content;
        if (/^Fatal\b|Fatal error:/i.test(c))     return true;
        if (c.includes('Ensure condition failed')) return true;
        if (c.includes('Assertion failed'))        return true;
        if (LogAnalyzerApp.CRASH_CATEGORIES.has(entry.type) && /\bError\b/.test(c)) return true;
        return false;
    }

    renderCrashPanel(allEntries) {
        const panel = document.getElementById('crashPanel');
        const badge = document.getElementById('crashPanelBadge');
        const list  = document.getElementById('crashPanelList');
        if (!panel || !badge || !list) return;

        const crashes = allEntries.filter(e => this.isCrashEntry(e));

        if (crashes.length === 0) { panel.style.display = 'none'; return; }

        panel.style.display = '';
        badge.textContent = crashes.length;

        list.innerHTML = '';
        const fragment = document.createDocumentFragment();

        crashes.forEach(entry => {
            const lines     = entry.content.split('\n');
            const firstLine = lines[0] || '';
            const callstack = lines.slice(1, 51).join('\n');

            let label = 'Error', labelClass = 'crash-label-error';
            if (/^Fatal\b|Fatal error:/i.test(entry.content))    { label = 'Fatal';  labelClass = 'crash-label-fatal'; }
            else if (entry.content.includes('Ensure condition failed')) { label = 'Ensure'; labelClass = 'crash-label-ensure'; }
            else if (entry.content.includes('Assertion failed'))        { label = 'Assert'; labelClass = 'crash-label-ensure'; }

            const item = document.createElement('div');
            item.className = 'crash-entry';
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.setAttribute('aria-label', `${label}: ${firstLine.slice(0, 100)}`);
            item.title = 'Click to scroll to this entry in the main log';

            const header = document.createElement('div');
            header.className = 'crash-entry-header';

            const labelSpan = document.createElement('span');
            labelSpan.className = `crash-label ${labelClass}`;
            labelSpan.textContent = label;

            const typeSpan = document.createElement('span');
            typeSpan.className = 'crash-type';
            typeSpan.textContent = entry.type;

            const preview = document.createElement('span');
            preview.className = 'crash-content-preview';
            preview.textContent = firstLine;
            preview.title = firstLine;

            header.appendChild(labelSpan);
            header.appendChild(typeSpan);
            header.appendChild(preview);
            item.appendChild(header);

            if (callstack) {
                const pre = document.createElement('pre');
                pre.className = 'crash-callstack';
                pre.textContent = callstack;
                item.appendChild(pre);
            }

            const scrollTo = () => this.scrollToCrashEntry(entry);
            item.addEventListener('click', scrollTo);
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollTo(); }
            });

            fragment.appendChild(item);
        });

        list.appendChild(fragment);
    }

    // Scroll to and briefly highlight a crash entry in the main log view.
    scrollToCrashEntry(entry) {
        const logContent = document.getElementById('logContent');
        if (!logContent) return;

        const key = entry.type + ':' + entry.content.slice(0, 200);

        const findEl = () => {
            for (const el of logContent.querySelectorAll('.log-entry')) {
                if (el.dataset.crashKey === key) return el;
            }
            return null;
        };

        let target = findEl();
        if (!target) {
            // Entry is filtered out — clear type + search filters and re-render.
            this.appState.updateFilters({ types: [], search: '', useRegex: false });
            this.updateDisplay();
            target = findEl();
        }

        if (target) {
            // Switch to the log tab if we're on another tab.
            if (this.currentRoute !== 'log') this.switchRoute('log');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('crash-highlight');
            target.focus();
            setTimeout(() => target.classList.remove('crash-highlight'), 2500);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    async handleLogFileUpload() {
        const file = this.ui.elements.logFile.files[0];
        if (!file) { Utils.showErrorToast('Please select a file'); return; }

        const MAX_LOG_SIZE = 100 * 1024 * 1024;
        if (file.size > MAX_LOG_SIZE) { Utils.showErrorToast('File too large \u2014 maximum is 100\u202fMB.'); return; }

        this.ui.updateButtonText('Loading...');
        this.ui.setButtonDisabled(true);
        this.appState.pauseSubscriptions();

        try {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.onabort = () => reject(new Error('File reading was aborted'));
                reader.readAsText(file);
            });

            if (text.trim().length === 0) throw new Error('File is empty.');

            const sampleSize = Math.min(text.length, 4096);
            let nonPrintable = 0;
            for (let i = 0; i < sampleSize; i++) {
                const code = text.charCodeAt(i);
                if (code === 0 || code < 9 || (code > 13 && code < 32)) nonPrintable++;
            }
            if (nonPrintable / sampleSize > 0.1)
                throw new Error('File does not appear to be a text log file (binary content detected).');

            const data = LogParser.parseLogLines(text);
            this.appState.update({ currentFile: file.name, allEntries: data.entries, logTypes: data.logTypes });
            this.ui.createLogTypeFilters(data.logTypes);
            this.updateDisplay();
        } catch (error) {
            Utils.showErrorToast('Failed to read file: ' + error.message);
            console.error('File read error:', error);
        } finally {
            this.ui.updateButtonText('Refresh');
            this.ui.setButtonDisabled(false);
            this.appState.resumeSubscriptions();
        }
    }

    async handleMemReportFileUpload() {
        const memreportFile = document.getElementById('memreportFile');
        const file = memreportFile?.files[0];
        if (!file) { Utils.showErrorToast('Please select a memreport file'); return; }
        const uploadButton = document.getElementById('memreportUploadButton');
        if (uploadButton) { uploadButton.textContent = 'Parsing...'; uploadButton.disabled = true; }
        try {
            if (!this.memreportPage) {
                this.memreportPage = new MemReportPage(this.appState, this.ui, Utils);
                this.memreportPage.initialize();
            }
            await this.memreportPage.parseAndRender(file);
            this.appState.update({ currentFile: file.name });
        } catch (error) {
            Utils.showErrorToast('Failed to process memreport file: ' + error.message);
            console.error('MemReport processing error:', error);
            const mc = document.getElementById('memreportContent');
            if (mc) mc.innerHTML = `<div class="alert alert-danger"><h4>Processing Failed</h4><p>${Utils.sanitizeInput(error.message)}</p></div>`;
        } finally {
            if (uploadButton) { uploadButton.textContent = 'Analyze MemReport'; uploadButton.disabled = false; }
        }
    }

    async handleFileUpload() { return this.handleLogFileUpload(); }

    async handlePasteAnalyze() {
        const textarea = document.getElementById('pasteLogText');
        const text = textarea ? textarea.value : '';
        if (!text.trim()) { Utils.showErrorToast('Please paste some log content first'); return; }
        const analyzeButton = document.getElementById('pasteAnalyzeButton');
        if (analyzeButton) { analyzeButton.textContent = 'Analyzing...'; analyzeButton.disabled = true; }
        this.appState.pauseSubscriptions();
        try {
            const data = LogParser.parseLogLines(text);
            this.appState.update({ currentFile: 'pasted-log', allEntries: data.entries, logTypes: data.logTypes });
            this.ui.createLogTypeFilters(data.logTypes);
            this.updateDisplay();
        } catch (error) {
            Utils.showErrorToast('Failed to parse log: ' + error.message);
            console.error('Parse error:', error);
        } finally {
            if (analyzeButton) { analyzeButton.textContent = 'Analyze'; analyzeButton.disabled = false; }
            this.appState.resumeSubscriptions();
        }
    }

    handleSearchChange() {
        const searchTerm = this.ui.getSearchTerm();
        const searchOptions = this.ui.getSearchOptions();
        if (searchOptions.useRegex && searchTerm.length > 200) {
            Utils.showErrorToast('Regex pattern too long \u2014 maximum is 200 characters.');
            return;
        }
        this.appState.updateFilters({ search: searchTerm, caseSensitive: searchOptions.caseSensitive, useRegex: searchOptions.useRegex });
        this.updateDisplay();
    }

    handleLevelFilterChange() {
        this.appState.updateFilters({ levels: this.ui.getSelectedLogLevels() });
        this.updateDisplay();
    }

    handleSearchOptionsChange() {
        const searchOptions = this.ui.getSearchOptions();
        this.appState.updateFilters({ caseSensitive: searchOptions.caseSensitive, useRegex: searchOptions.useRegex });
        this.updateDisplay();
    }

    updateDisplay() {
        const state = this.appState.getState();

        // Crash panel — derives from allEntries, not filtered view.
        this.renderCrashPanel(state.allEntries);

        // Time regex searches and warn if slow (>300 ms).
        let filteredEntries;
        if (state.filters.useRegex && state.filters.search) {
            const t0 = performance.now();
            filteredEntries = this.appState.getFilteredEntries();
            const elapsed = performance.now() - t0;
            if (elapsed > 300)
                Utils.showInfoToast(`Regex search took ${Math.round(elapsed)}\u202fms \u2014 try a more specific pattern.`, 'Slow search');
        } else {
            filteredEntries = this.appState.getFilteredEntries();
        }

        this.ui.displayLogEntries(filteredEntries);
        this.ui.updateLogLevelCounts(filteredEntries);
        this.ui.updateLogTypeCounts(filteredEntries, state.logTypes);
    }

    static init() { return new LogAnalyzerApp(); }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.app = LogAnalyzerApp.init(); });
} else {
    setTimeout(() => { window.app = LogAnalyzerApp.init(); }, 100);
}
