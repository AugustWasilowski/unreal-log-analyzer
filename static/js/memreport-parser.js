/**
 * MemReport Parser - Pure parsing logic for Unreal Engine .memreport files
 * Handles section detection, table parsing, and key-value extraction
 */
class MemReportParser {
    // Section detection patterns
    static SECTION_PATTERNS = {
        overview: /^=+\s*(Memory Overview|Platform Memory|Memory Summary)\s*=+$/i,
        obj_list: /^=+\s*Obj List.*=+$/i,
        rhi_memory: /^=+\s*(RHI|Rendering).*Memory.*=+$/i,
        streaming_levels: /^=+\s*Streaming Levels.*=+$/i,
        actors: /^=+\s*Actors.*=+$/i,
        textures: /^=+\s*(ListTextures|Texture).*=+$/i,
        static_meshes: /^=+\s*(ListStaticMeshes|Static.*Mesh).*=+$/i,
        audio: /^=+\s*(Audio|Sound).*=+$/i,
        animation: /^=+\s*(Animation|Anim).*=+$/i,
        particles: /^=+\s*(Particle|FX).*=+$/i
    };

    /**
     * Main parsing entry point
     * @param {string} fileContent - Raw memreport file content
     * @param {Object} options - Parsing options
     * @param {Function} progressCallback - Optional progress callback for chunked parsing
     * @returns {Promise<Object>} Parsed memreport data with meta and sections
     */
    static async parse(fileContent, options = {}, progressCallback = null) {
        const fileSize = new Blob([fileContent]).size;
        const shouldUseChunkedParsing = fileSize > (options.chunkThreshold || 1024 * 1024); // 1MB default
        
        if (shouldUseChunkedParsing && progressCallback) {
            return this.parseChunked(fileContent, options, progressCallback);
        } else {
            return this.parseSync(fileContent);
        }
    }

    /**
     * Synchronous parsing for smaller files
     * @param {string} fileContent - Raw memreport file content
     * @returns {Object} Parsed memreport data with meta and sections
     */
    static parseSync(fileContent) {
        try {
            const lines = fileContent.split('\n').map(line => line.trim());
            const sections = [];
            let parseErrors = [];

            // Extract metadata from the beginning of the file
            let meta;
            try {
                meta = this.extractMeta(lines);
            } catch (error) {
                meta = { 
                    generator: 'memreport', 
                    error: `Metadata extraction failed: ${error.message}` 
                };
                parseErrors.push(new Error(`Metadata extraction failed: ${error.message}`));
            }

            // Detect and parse sections with enhanced error handling
            let sectionData = [];
            try {
                sectionData = this.detectSections(lines);
            } catch (error) {
                parseErrors.push(new Error(`Section detection failed: ${error.message}`));
                // Create a single raw section with all content
                sectionData = [{
                    title: 'Raw Content (Section Detection Failed)',
                    lines: lines,
                    startLine: 0
                }];
            }
            
            for (let i = 0; i < sectionData.length; i++) {
                const section = sectionData[i];
                try {
                    const parsed = this.parseSection(section);
                    sections.push(parsed);
                } catch (error) {
                    // Enhanced error context
                    const errorContext = this.createErrorContext(section, error);
                    
                    // Add as raw section with detailed error information
                    sections.push({
                        key: `error_section_${i}`,
                        title: section.title || `Unknown Section ${i + 1}`,
                        type: 'raw',
                        rawLines: section.lines,
                        error: error.message,
                        errorContext: errorContext,
                        fallbackReason: 'Section parsing failed - displaying raw content'
                    });
                    
                    parseErrors.push(new Error(`Section "${section.title || 'Unknown'}" parsing failed: ${error.message}`));
                }
            }

            // If no sections were successfully parsed, ensure we have at least raw content
            if (sections.length === 0) {
                sections.push({
                    key: 'emergency_fallback',
                    title: 'Raw Content (No Sections Parsed)',
                    type: 'raw',
                    rawLines: lines,
                    error: 'No sections could be parsed from this file',
                    fallbackReason: 'Complete parsing failure - displaying entire file as raw content'
                });
                parseErrors.push(new Error('No sections could be successfully parsed'));
            }

            return {
                meta,
                sections,
                parseErrors,
                parsingStats: {
                    totalSections: sectionData.length,
                    successfulSections: sections.filter(s => !s.error).length,
                    failedSections: sections.filter(s => s.error).length,
                    rawFallbacks: sections.filter(s => s.type === 'raw' && s.error).length
                }
            };
        } catch (error) {
            // Complete parsing failure - return comprehensive fallback
            return this.createEmergencyFallback(fileContent, error);
        }
    }

    /**
     * Chunked parsing for large files using requestIdleCallback
     * @param {string} fileContent - Raw memreport file content
     * @param {Object} options - Parsing options
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<Object>} Parsed memreport data with meta and sections
     */
    static async parseChunked(fileContent, options = {}, progressCallback) {
        const chunkSize = options.chunkSize || 1000; // Lines per chunk
        const lines = fileContent.split('\n').map(line => line.trim());
        const totalLines = lines.length;
        
        try {
            // Report initial progress
            progressCallback({ 
                phase: 'initializing', 
                progress: 0, 
                message: 'Preparing to parse large file...' 
            });

            // Extract metadata from the beginning (synchronously for quick feedback)
            const meta = this.extractMeta(lines.slice(0, 100));
            
            progressCallback({ 
                phase: 'metadata', 
                progress: 5, 
                message: 'Extracted file metadata' 
            });

            // Detect sections in chunks
            progressCallback({ 
                phase: 'detecting', 
                progress: 10, 
                message: 'Detecting sections...' 
            });
            
            const sectionData = await this.detectSectionsChunked(lines, chunkSize, (progress) => {
                progressCallback({
                    phase: 'detecting',
                    progress: 10 + (progress * 0.3), // 10-40% for section detection
                    message: `Detecting sections... ${Math.round(progress)}%`
                });
            });

            progressCallback({ 
                phase: 'parsing', 
                progress: 40, 
                message: `Found ${sectionData.length} sections, parsing...` 
            });

            // Parse sections incrementally
            const sections = [];
            let parseErrors = [];
            
            for (let i = 0; i < sectionData.length; i++) {
                const section = sectionData[i];
                const sectionProgress = (i / sectionData.length) * 60; // 40-100% for parsing
                
                progressCallback({
                    phase: 'parsing',
                    progress: 40 + sectionProgress,
                    message: `Parsing section: ${section.title || 'Unknown'}`
                });

                try {
                    // Parse section with idle callback to maintain responsiveness
                    const parsed = await this.parseSectionAsync(section);
                    sections.push(parsed);
                } catch (error) {
                    // Enhanced error context for chunked parsing
                    const errorContext = this.createErrorContext(section, error);
                    
                    // Add as raw section with detailed error information
                    sections.push({
                        key: `error_section_${i}`,
                        title: section.title || `Unknown Section ${i + 1}`,
                        type: 'raw',
                        rawLines: section.lines,
                        error: error.message,
                        errorContext: errorContext,
                        fallbackReason: 'Section parsing failed during chunked processing - displaying raw content'
                    });
                    
                    parseErrors.push(new Error(`Section "${section.title || 'Unknown'}" parsing failed: ${error.message}`));
                }

                // Yield control to browser if needed
                if (i % 5 === 0) { // Every 5 sections
                    await this.yieldToMain();
                }
            }

            progressCallback({ 
                phase: 'complete', 
                progress: 100, 
                message: `Parsing complete! ${sections.length} sections processed` 
            });

            return {
                meta,
                sections,
                parseErrors
            };

        } catch (error) {
            progressCallback({ 
                phase: 'error', 
                progress: 100, 
                message: `Parsing failed: ${error.message}` 
            });

            // Complete parsing failure - return comprehensive fallback
            return this.createEmergencyFallback(fileContent, error);
        }
    }

    /**
     * Detect sections in chunks to maintain UI responsiveness
     * @param {string[]} lines - Array of file lines
     * @param {number} chunkSize - Lines to process per chunk
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Array>} Array of section objects
     */
    static async detectSectionsChunked(lines, chunkSize, progressCallback) {
        const sections = [];
        let currentSection = null;
        let processedLines = 0;
        const totalLines = lines.length;

        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, Math.min(i + chunkSize, lines.length));
            
            // Process chunk
            for (let j = 0; j < chunk.length; j++) {
                const line = chunk[j];
                const globalIndex = i + j;
                
                if (this.isSectionHeader(line)) {
                    // Save previous section if exists
                    if (currentSection && currentSection.lines.length > 0) {
                        sections.push(currentSection);
                    }
                    
                    // Start new section
                    currentSection = {
                        title: this.extractSectionTitle(line),
                        lines: [],
                        startLine: globalIndex
                    };
                } else if (currentSection && line.length > 0) {
                    // Add non-empty lines to current section
                    currentSection.lines.push(line);
                }
            }

            processedLines += chunk.length;
            const progress = (processedLines / totalLines) * 100;
            progressCallback(progress);

            // Yield control to browser
            await this.yieldToMain();
        }

        // Don't forget the last section
        if (currentSection && currentSection.lines.length > 0) {
            sections.push(currentSection);
        }

        return sections;
    }

    /**
     * Parse a section asynchronously to maintain UI responsiveness
     * @param {Object} sectionData - Raw section data
     * @returns {Promise<Object>} Parsed section object
     */
    static async parseSectionAsync(sectionData) {
        // For very large sections, we might want to yield during parsing
        const isLargeSection = sectionData.lines.length > 1000;
        
        if (isLargeSection) {
            // Yield before processing large section
            await this.yieldToMain();
        }

        // Use existing synchronous parsing logic
        return this.parseSection(sectionData);
    }

    /**
     * Yield control to the main thread using requestIdleCallback or setTimeout
     * @returns {Promise<void>}
     */
    static yieldToMain() {
        return new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(resolve, { timeout: 50 });
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(resolve, 0);
            }
        });
    }

    /**
     * Detect section boundaries and extract section data
     * @param {string[]} lines - Array of file lines
     * @returns {Array} Array of section objects with title and lines
     */
    static detectSections(lines) {
        const sections = [];
        let currentSection = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (this.isSectionHeader(line)) {
                // Save previous section if exists
                if (currentSection && currentSection.lines.length > 0) {
                    sections.push(currentSection);
                }
                
                // Start new section
                currentSection = {
                    title: this.extractSectionTitle(line),
                    lines: [],
                    startLine: i
                };
            } else if (currentSection && line.length > 0) {
                // Add non-empty lines to current section
                currentSection.lines.push(line);
            }
        }

        // Don't forget the last section
        if (currentSection && currentSection.lines.length > 0) {
            sections.push(currentSection);
        }

        return sections;
    }

    /**
     * Check if a line is a section header
     * @param {string} line - Line to check
     * @returns {boolean} True if line is a section header
     */
    static isSectionHeader(line) {
        // Look for lines with === patterns
        if (/^=+.*=+$/.test(line)) {
            return true;
        }
        
        // Also check for lines that are all caps and might be headers
        if (line.length > 10 && /^[A-Z\s\-_]+$/.test(line) && !line.includes('=')) {
            return true;
        }
        
        return false;
    }

    /**
     * Extract clean section title from header line
     * @param {string} headerLine - Section header line
     * @returns {string} Clean section title
     */
    static extractSectionTitle(headerLine) {
        // Remove === markers and trim
        return headerLine.replace(/=+/g, '').trim();
    }

    /**
     * Determine section type and parse accordingly
     * @param {Object} sectionData - Raw section data with title and lines
     * @returns {Object} Parsed section object
     */
    static parseSection(sectionData) {
        try {
            const sectionType = this.detectSectionType(sectionData);
            const sectionKey = this.generateSectionKey(sectionData.title);

            const baseSection = {
                key: sectionKey,
                title: sectionData.title,
                type: sectionType,
                rawLines: sectionData.lines
            };

            switch (sectionType) {
                case 'table':
                    try {
                        const tableData = this.parseTableSection(sectionData.lines, sectionData.title);
                        return { ...baseSection, ...tableData };
                    } catch (tableError) {
                        // Table parsing failed, fall back to raw with error info
                        return {
                            ...baseSection,
                            type: 'raw',
                            error: `Table parsing failed: ${tableError.message}`,
                            fallbackReason: 'Table structure could not be parsed - displaying as raw text',
                            originalType: 'table'
                        };
                    }
                case 'kv':
                    try {
                        const kvData = this.parseKeyValueSection(sectionData.lines, sectionData.title);
                        return { ...baseSection, ...kvData };
                    } catch (kvError) {
                        // Key-value parsing failed, fall back to raw with error info
                        return {
                            ...baseSection,
                            type: 'raw',
                            error: `Key-value parsing failed: ${kvError.message}`,
                            fallbackReason: 'Key-value structure could not be parsed - displaying as raw text',
                            originalType: 'kv'
                        };
                    }
                default:
                    return { ...baseSection, type: 'raw' };
            }
        } catch (error) {
            // Complete section parsing failure
            return {
                key: this.generateSectionKey(sectionData.title || 'unknown'),
                title: sectionData.title || 'Unknown Section',
                type: 'raw',
                rawLines: sectionData.lines || [],
                error: `Section parsing failed: ${error.message}`,
                fallbackReason: 'Complete section parsing failure - displaying as raw text'
            };
        }
    }

    /**
     * Detect the type of section based on content patterns
     * @param {Object} sectionData - Section data with title and lines
     * @returns {string} Section type: 'table', 'kv', or 'raw'
     */
    static detectSectionType(sectionData) {
        const lines = sectionData.lines;
        
        if (lines.length === 0) {
            return 'raw';
        }

        // Look for table patterns - multiple columns with consistent spacing
        const potentialHeaderLine = lines.find(line => 
            line.includes('Class') || 
            line.includes('Name') || 
            line.includes('Count') ||
            line.includes('Size') ||
            line.includes('KB') ||
            line.includes('MB')
        );

        if (potentialHeaderLine) {
            // Check if we have data rows that match the header pattern
            const headerColumns = potentialHeaderLine.split(/\s+/).length;
            const dataRows = lines.slice(1).filter(line => 
                line.split(/\s+/).length >= headerColumns - 1 && // Allow some flexibility
                line.split(/\s+/).length <= headerColumns + 2
            );
            
            if (dataRows.length > 0) {
                return 'table';
            }
        }

        // Look for key-value patterns
        const kvLines = lines.filter(line => 
            line.includes(':') || 
            line.includes('=') ||
            /\w+\s+\d+/.test(line) // word followed by number
        );

        if (kvLines.length > lines.length * 0.5) {
            return 'kv';
        }

        return 'raw';
    }

    /**
     * Generate a unique key for the section
     * @param {string} title - Section title
     * @returns {string} Section key
     */
    static generateSectionKey(title) {
        // Check against known patterns first
        for (const [key, pattern] of Object.entries(this.SECTION_PATTERNS)) {
            if (pattern.test(`=== ${title} ===`)) {
                return key;
            }
        }

        // Generate key from title
        return title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 20);
    }

    /**
     * Extract metadata from the beginning of the file
     * @param {string[]} lines - Array of file lines
     * @returns {Object} Metadata object
     */
    static extractMeta(lines) {
        const meta = {
            generator: 'memreport',
            engineVersion: '',
            platform: '',
            timestamp: '',
            totalMemoryMB: null
        };

        // Look for metadata in first 50 lines
        const headerLines = lines.slice(0, 50);
        
        for (const line of headerLines) {
            // Engine version patterns
            if (/engine.*version/i.test(line)) {
                const versionMatch = line.match(/(\d+\.\d+(?:\.\d+)?)/);
                if (versionMatch) {
                    meta.engineVersion = versionMatch[1];
                }
            }
            
            // Platform detection
            if (/platform/i.test(line)) {
                if (/windows/i.test(line)) meta.platform = 'Windows';
                else if (/linux/i.test(line)) meta.platform = 'Linux';
                else if (/mac/i.test(line)) meta.platform = 'Mac';
            }
            
            // Total memory
            const memoryMatch = line.match(/total.*memory.*?(\d+).*?(mb|gb)/i);
            if (memoryMatch) {
                const value = parseInt(memoryMatch[1]);
                meta.totalMemoryMB = memoryMatch[2].toLowerCase() === 'gb' ? value * 1024 : value;
            }
        }

        return meta;
    }

    /**
     * Parse table section with column detection and data extraction
     * @param {string[]} lines - Section lines
     * @param {string} title - Section title (unused but kept for interface consistency)
     * @returns {Object} Parsed table data with columns and rows
     */
    static parseTableSection(lines, title) {
        if (!lines || lines.length === 0) {
            throw new Error('Table section is empty or undefined');
        }

        // Find the header line (usually contains column names)
        let headerLineIndex = -1;
        let headerLine = '';
        
        try {
            // Look for lines with common column indicators
            for (let i = 0; i < Math.min(lines.length, 5); i++) {
                const line = lines[i];
                if (this.isTableHeader(line)) {
                    headerLineIndex = i;
                    headerLine = line;
                    break;
                }
            }

            if (headerLineIndex === -1) {
                // Try alternative header detection
                const potentialHeaders = lines.slice(0, 3).filter(line => 
                    line.split(/\s+/).length >= 3 && 
                    line.split(/\s+/).length <= 15
                );
                
                if (potentialHeaders.length > 0) {
                    headerLineIndex = lines.indexOf(potentialHeaders[0]);
                    headerLine = potentialHeaders[0];
                } else {
                    throw new Error('No table header could be detected in the first 5 lines');
                }
            }

            // Parse columns from header
            let columns;
            try {
                columns = this.parseTableColumns(headerLine);
                if (columns.length === 0) {
                    throw new Error('No valid columns could be parsed from header');
                }
            } catch (columnError) {
                throw new Error(`Column parsing failed: ${columnError.message}`);
            }
            
            // Parse data rows with error tolerance
            const dataLines = lines.slice(headerLineIndex + 1);
            const rows = [];
            const rowErrors = [];
            
            for (let i = 0; i < dataLines.length; i++) {
                const line = dataLines[i];
                if (line.trim().length === 0) continue;
                
                try {
                    const row = this.parseTableRow(line, columns);
                    if (row && row.length > 0) {
                        rows.push(row);
                    }
                } catch (rowError) {
                    rowErrors.push({
                        lineNumber: headerLineIndex + 1 + i,
                        line: line,
                        error: rowError.message
                    });
                    
                    // Continue parsing other rows instead of failing completely
                    continue;
                }
            }

            // Provide detailed parsing results
            const result = {
                columns: columns.map(col => col.name),
                rows,
                notes: `Parsed ${rows.length} rows with ${columns.length} columns`
            };

            // Add row error information if any
            if (rowErrors.length > 0) {
                result.notes += `. ${rowErrors.length} rows had parsing errors and were skipped.`;
                result.rowErrors = rowErrors;
            }

            // Validate that we got some data
            if (rows.length === 0 && dataLines.filter(l => l.trim().length > 0).length > 0) {
                throw new Error('No data rows could be parsed despite having content after header');
            }

            return result;

        } catch (error) {
            // Enhanced error with context
            throw new Error(`Table parsing failed for section "${title}": ${error.message}. Lines available: ${lines.length}, Header found at: ${headerLineIndex}`);
        }
    }

    /**
     * Check if a line looks like a table header
     * @param {string} line - Line to check
     * @returns {boolean} True if line appears to be a table header
     */
    static isTableHeader(line) {
        const headerIndicators = [
            'class', 'name', 'count', 'size', 'kb', 'mb', 'bytes',
            'total', 'num', 'res', 'exclusive', 'object', 'asset',
            'memory', 'usage', 'type'
        ];
        
        const lowerLine = line.toLowerCase();
        const matchCount = headerIndicators.filter(indicator => 
            lowerLine.includes(indicator)
        ).length;
        
        // Must have at least 2 header indicators and reasonable number of columns
        const columnCount = line.split(/\s+/).length;
        return matchCount >= 2 && columnCount >= 3 && columnCount <= 15;
    }

    /**
     * Parse column information from header line
     * @param {string} headerLine - Header line containing column names
     * @returns {Array} Array of column objects with name and type
     */
    static parseTableColumns(headerLine) {
        const columnNames = headerLine.split(/\s+/).filter(name => name.length > 0);
        
        return columnNames.map(name => ({
            name: name,
            type: this.detectColumnType(name),
            sortable: true
        }));
    }

    /**
     * Detect column data type based on column name
     * @param {string} columnName - Name of the column
     * @returns {string} Column type: 'number', 'memory', or 'text'
     */
    static detectColumnType(columnName) {
        const lowerName = columnName.toLowerCase();
        
        // Memory columns
        if (/\b(kb|mb|bytes?|size|memory)\b/i.test(lowerName)) {
            return 'memory';
        }
        
        // Numeric columns
        if (/\b(count|num|total|index|id)\b/i.test(lowerName)) {
            return 'number';
        }
        
        // Default to text
        return 'text';
    }

    /**
     * Parse a single table row
     * @param {string} line - Row line to parse
     * @param {Array} columns - Column definitions
     * @returns {Array} Parsed row data
     */
    static parseTableRow(line, columns) {
        // Split by whitespace but be smart about it
        const parts = line.trim().split(/\s+/);
        
        if (parts.length === 0) return null;
        
        const row = [];
        
        // Handle cases where we have more or fewer parts than columns
        for (let i = 0; i < columns.length; i++) {
            let value = i < parts.length ? parts[i] : '';
            
            // Process value based on column type
            if (columns[i].type === 'memory' || columns[i].type === 'number') {
                value = this.parseNumericValue(value);
            }
            
            row.push(value);
        }
        
        // If we have extra parts, combine them into the last column (usually names with spaces)
        if (parts.length > columns.length && columns.length > 0) {
            const extraParts = parts.slice(columns.length - 1);
            row[columns.length - 1] = extraParts.join(' ');
        }
        
        return row;
    }

    /**
     * Parse and normalize numeric values, especially memory units
     * @param {string} value - Value to parse
     * @returns {number|string} Parsed numeric value or original string
     */
    static parseNumericValue(value) {
        if (!value || typeof value !== 'string') return value;
        
        // Remove commas and other formatting
        const cleanValue = value.replace(/,/g, '');
        
        // Check for memory units
        const memoryMatch = cleanValue.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|bytes?)?$/i);
        if (memoryMatch) {
            const num = parseFloat(memoryMatch[1]);
            const unit = memoryMatch[2] ? memoryMatch[2].toLowerCase() : '';
            
            // Normalize to KB for consistency
            switch (unit) {
                case 'gb':
                    return num * 1024 * 1024;
                case 'mb':
                    return num * 1024;
                case 'bytes':
                case 'byte':
                    return num / 1024;
                case 'kb':
                default:
                    return num;
            }
        }
        
        // Try parsing as regular number
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue)) {
            return numValue;
        }
        
        // Return original value if not numeric
        return value;
    }

    /**
     * Normalize memory values to consistent units
     * @param {number|string} value - Memory value
     * @param {string} unit - Original unit (KB, MB, GB, etc.)
     * @returns {number} Normalized value in KB
     */
    static normalizeMemoryValues(value, unit) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return 0;
        
        switch (unit.toLowerCase()) {
            case 'gb':
                return numValue * 1024 * 1024;
            case 'mb':
                return numValue * 1024;
            case 'bytes':
            case 'byte':
                return numValue / 1024;
            case 'kb':
            default:
                return numValue;
        }
    }

    /**
     * Parse key-value section for overview/summary data
     * @param {string[]} lines - Section lines
     * @param {string} title - Section title (unused but kept for interface consistency)
     * @returns {Object} Parsed key-value data
     */
    static parseKeyValueSection(lines, title) {
        if (!lines || lines.length === 0) {
            throw new Error('Key-value section is empty or undefined');
        }

        const items = [];
        const parseErrors = [];
        
        try {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim().length === 0) continue;
                
                try {
                    const kvPair = this.parseKeyValueLine(line);
                    if (kvPair) {
                        items.push(kvPair);
                    } else {
                        // Line couldn't be parsed as key-value, but that's not necessarily an error
                        parseErrors.push({
                            lineNumber: i + 1,
                            line: line,
                            reason: 'Line does not match any key-value pattern'
                        });
                    }
                } catch (lineError) {
                    parseErrors.push({
                        lineNumber: i + 1,
                        line: line,
                        error: lineError.message
                    });
                }
            }
            
            // Build result with error information
            const result = {
                items,
                notes: `Parsed ${items.length} key-value pairs`
            };

            // Add parsing error information if significant
            if (parseErrors.length > 0) {
                const errorRate = parseErrors.length / lines.filter(l => l.trim().length > 0).length;
                if (errorRate > 0.5) {
                    // High error rate suggests this might not be a key-value section
                    throw new Error(`High parsing error rate (${Math.round(errorRate * 100)}%) suggests this is not a key-value section`);
                } else if (parseErrors.length > 3) {
                    result.notes += `. ${parseErrors.length} lines could not be parsed as key-value pairs.`;
                    result.parseErrors = parseErrors;
                }
            }

            // Validate that we got some meaningful data
            if (items.length === 0) {
                throw new Error('No key-value pairs could be extracted from section content');
            }

            return result;

        } catch (error) {
            throw new Error(`Key-value parsing failed for section "${title}": ${error.message}`);
        }
    }

    /**
     * Parse a single key-value line
     * @param {string} line - Line to parse
     * @returns {Object|null} Parsed key-value pair or null if not parseable
     */
    static parseKeyValueLine(line) {
        // Try different key-value patterns
        
        // Pattern 1: "Key: Value" or "Key : Value"
        let match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
            return this.createKeyValuePair(match[1].trim(), match[2].trim());
        }
        
        // Pattern 2: "Key = Value" or "Key=Value"
        match = line.match(/^([^=]+)=\s*(.+)$/);
        if (match) {
            return this.createKeyValuePair(match[1].trim(), match[2].trim());
        }
        
        // Pattern 3: "Key    Value" (whitespace separated, common in memory reports)
        match = line.match(/^([A-Za-z][A-Za-z\s]+?)\s{2,}(.+)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            
            // Make sure the key looks reasonable (not just numbers)
            if (!/^\d+$/.test(key) && key.length > 2) {
                return this.createKeyValuePair(key, value);
            }
        }
        
        // Pattern 4: Lines that look like "Total Physical Memory 8192 MB"
        match = line.match(/^([A-Za-z][A-Za-z\s]+?)\s+(\d+(?:\.\d+)?)\s*(MB|KB|GB|bytes?)?$/i);
        if (match) {
            const key = match[1].trim();
            const value = match[2];
            const unit = match[3] || '';
            
            return this.createKeyValuePair(key, value, unit);
        }
        
        // Pattern 5: Simple "Key Value" where value is clearly a number or memory value
        match = line.match(/^([A-Za-z][A-Za-z\s]+?)\s+([0-9,]+(?:\.[0-9]+)?(?:\s*[KMGT]?B)?)$/i);
        if (match) {
            return this.createKeyValuePair(match[1].trim(), match[2].trim());
        }
        
        return null;
    }

    /**
     * Create a standardized key-value pair object
     * @param {string} key - The key name
     * @param {string} value - The value
     * @param {string} unit - Optional unit (KB, MB, etc.)
     * @returns {Object} Standardized key-value pair
     */
    static createKeyValuePair(key, value, unit = '') {
        // Clean up the key
        const cleanKey = key.replace(/[^\w\s]/g, '').trim();
        
        // Parse the value
        let parsedValue = value;
        let detectedUnit = unit;
        
        // Extract unit from value if not provided
        if (!unit) {
            const unitMatch = value.match(/^(.+?)\s*(MB|KB|GB|bytes?|%|\w+)$/i);
            if (unitMatch) {
                parsedValue = unitMatch[1].trim();
                detectedUnit = unitMatch[2];
            }
        }
        
        // Try to parse as number
        const numericValue = this.parseNumericValue(parsedValue);
        const isNumeric = typeof numericValue === 'number';
        
        return {
            name: cleanKey,
            value: isNumeric ? numericValue : parsedValue,
            unit: detectedUnit,
            originalValue: value,
            type: isNumeric ? 'numeric' : 'text'
        };
    }

    /**
     * Enhanced metadata extraction with key-value parsing
     * @param {string[]} lines - Array of file lines
     * @returns {Object} Enhanced metadata object
     */
    static extractMeta(lines) {
        const meta = {
            generator: 'memreport',
            engineVersion: '',
            platform: '',
            timestamp: '',
            totalMemoryMB: null,
            map: '',
            buildConfiguration: '',
            additionalInfo: {}
        };

        // Look for metadata in first 100 lines
        const headerLines = lines.slice(0, 100);
        
        for (const line of headerLines) {
            // Engine version patterns
            if (/engine.*version/i.test(line) || /unreal.*engine/i.test(line)) {
                const versionMatch = line.match(/(\d+\.\d+(?:\.\d+)?)/);
                if (versionMatch) {
                    meta.engineVersion = versionMatch[1];
                }
            }
            
            // Platform detection
            if (/platform/i.test(line) || /target.*platform/i.test(line)) {
                if (/windows/i.test(line)) meta.platform = 'Windows';
                else if (/linux/i.test(line)) meta.platform = 'Linux';
                else if (/mac/i.test(line)) meta.platform = 'Mac';
                else if (/android/i.test(line)) meta.platform = 'Android';
                else if (/ios/i.test(line)) meta.platform = 'iOS';
            }
            
            // Map/Level name
            if (/map.*name/i.test(line) || /level.*name/i.test(line) || /world.*name/i.test(line)) {
                const mapMatch = line.match(/(?:map|level|world).*?[:=]\s*([^\s]+)/i);
                if (mapMatch) {
                    meta.map = mapMatch[1];
                }
            }
            
            // Build configuration
            if (/build.*config/i.test(line) || /configuration/i.test(line)) {
                if (/debug/i.test(line)) meta.buildConfiguration = 'Debug';
                else if (/development/i.test(line)) meta.buildConfiguration = 'Development';
                else if (/shipping/i.test(line)) meta.buildConfiguration = 'Shipping';
                else if (/test/i.test(line)) meta.buildConfiguration = 'Test';
            }
            
            // Total memory patterns
            const memoryMatch = line.match(/total.*(?:physical.*)?memory.*?(\d+).*?(mb|gb|kb)/i);
            if (memoryMatch) {
                const value = parseInt(memoryMatch[1]);
                const unit = memoryMatch[2].toLowerCase();
                meta.totalMemoryMB = unit === 'gb' ? value * 1024 : 
                                   unit === 'kb' ? value / 1024 : value;
            }
            
            // Timestamp patterns
            const timeMatch = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
            if (timeMatch) {
                meta.timestamp = timeMatch[1];
            }
            
            // Try to parse as key-value for additional info
            const kvPair = this.parseKeyValueLine(line);
            if (kvPair && !meta.additionalInfo[kvPair.name]) {
                meta.additionalInfo[kvPair.name] = kvPair.value;
            }
        }

        return meta;
    }

    /**
     * Create detailed error context for debugging
     * @param {Object} section - Section data that failed to parse
     * @param {Error} error - The parsing error
     * @returns {Object} Error context information
     */
    static createErrorContext(section, error) {
        return {
            sectionTitle: section.title || 'Unknown',
            lineCount: section.lines ? section.lines.length : 0,
            startLine: section.startLine || 0,
            firstFewLines: section.lines ? section.lines.slice(0, 3) : [],
            errorType: error.name || 'Error',
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
            possibleCauses: this.suggestErrorCauses(section, error)
        };
    }

    /**
     * Suggest possible causes for parsing errors
     * @param {Object} section - Section data that failed
     * @param {Error} error - The parsing error
     * @returns {Array} Array of possible causes and suggestions
     */
    static suggestErrorCauses(section, error) {
        const suggestions = [];
        
        if (!section.lines || section.lines.length === 0) {
            suggestions.push('Section appears to be empty');
        }
        
        if (error.message.includes('column') || error.message.includes('header')) {
            suggestions.push('Table structure may be malformed or use unexpected column layout');
            suggestions.push('Try checking if column headers are properly aligned');
        }
        
        if (error.message.includes('numeric') || error.message.includes('number')) {
            suggestions.push('Numeric values may be in unexpected format');
            suggestions.push('Memory units (KB/MB/GB) might not be recognized');
        }
        
        if (section.title && section.title.includes('Unknown')) {
            suggestions.push('Section header format is not recognized');
            suggestions.push('This might be a new or custom section type');
        }
        
        // Check for common formatting issues
        if (section.lines) {
            const hasVeryLongLines = section.lines.some(line => line.length > 500);
            if (hasVeryLongLines) {
                suggestions.push('Section contains unusually long lines that may cause parsing issues');
            }
            
            const hasSpecialChars = section.lines.some(line => /[^\x00-\x7F]/.test(line));
            if (hasSpecialChars) {
                suggestions.push('Section contains non-ASCII characters that may affect parsing');
            }
        }
        
        if (suggestions.length === 0) {
            suggestions.push('Unknown parsing error - section will be displayed as raw text');
        }
        
        return suggestions;
    }

    /**
     * Create emergency fallback when complete parsing fails
     * @param {string} fileContent - Original file content
     * @param {Error} error - The critical error
     * @returns {Object} Emergency fallback structure
     */
    static createEmergencyFallback(fileContent, error) {
        const lines = fileContent.split('\n');
        
        return {
            meta: { 
                generator: 'memreport', 
                error: `Critical parsing failure: ${error.message}`,
                fallbackMode: true,
                originalFileSize: fileContent.length,
                lineCount: lines.length
            },
            sections: [{
                key: 'critical_error_fallback',
                title: 'Raw File Content (Critical Error)',
                type: 'raw',
                rawLines: lines,
                error: `Critical parsing error: ${error.message}`,
                errorContext: {
                    errorType: error.name || 'CriticalError',
                    errorMessage: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString(),
                    fallbackReason: 'Complete parser failure - displaying entire file as raw text'
                },
                fallbackReason: 'Critical parsing failure - entire file displayed as raw content'
            }],
            parseErrors: [error],
            parsingStats: {
                totalSections: 0,
                successfulSections: 0,
                failedSections: 1,
                rawFallbacks: 1,
                criticalFailure: true
            }
        };
    }

    /**
     * Validate file content before parsing
     * @param {string} fileContent - File content to validate
     * @returns {Object} Validation result with isValid flag and issues array
     */
    static validateFileContent(fileContent) {
        const issues = [];
        let isValid = true;

        // Check if content exists
        if (!fileContent || typeof fileContent !== 'string') {
            issues.push({
                type: 'critical',
                message: 'File content is empty or invalid',
                suggestion: 'Please select a valid .memreport file'
            });
            return { isValid: false, issues };
        }

        // Check file size
        const contentSize = new Blob([fileContent]).size;
        if (contentSize === 0) {
            issues.push({
                type: 'critical',
                message: 'File appears to be empty',
                suggestion: 'Please select a file that contains memory report data'
            });
            isValid = false;
        } else if (contentSize > 50 * 1024 * 1024) { // 50MB
            issues.push({
                type: 'warning',
                message: 'File is very large (>50MB) and may take time to process',
                suggestion: 'Consider using a smaller memory report or be patient during parsing'
            });
        }

        // Check for basic memreport indicators
        const lowerContent = fileContent.toLowerCase();
        const hasMemoryIndicators = [
            'memory', 'memreport', 'obj list', 'texture', 'static mesh', 
            'rhi', 'rendering', 'unreal', 'engine'
        ].some(indicator => lowerContent.includes(indicator));

        if (!hasMemoryIndicators) {
            issues.push({
                type: 'warning',
                message: 'File does not appear to contain typical memory report content',
                suggestion: 'This might not be a valid Unreal Engine memory report file'
            });
        }

        // Check for recognizable section headers
        const lines = fileContent.split('\n');
        const hasSectionHeaders = lines.some(line => 
            /^=+.*=+$/.test(line.trim()) || 
            /^[A-Z\s\-_]{10,}$/.test(line.trim())
        );

        if (!hasSectionHeaders) {
            issues.push({
                type: 'warning',
                message: 'No recognizable section headers found',
                suggestion: 'File will be displayed as raw text. This might be a different format than expected.'
            });
        }

        // Check line count
        if (lines.length < 10) {
            issues.push({
                type: 'warning',
                message: 'File has very few lines and may not contain complete memory report data',
                suggestion: 'Verify this is a complete memory report file'
            });
        }

        // Check for binary content
        const hasBinaryContent = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(fileContent.substring(0, 1000));
        if (hasBinaryContent) {
            issues.push({
                type: 'critical',
                message: 'File appears to contain binary data',
                suggestion: 'Memory reports should be text files. Please select a .txt or .memreport text file.'
            });
            isValid = false;
        }

        return { isValid, issues };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemReportParser;
}