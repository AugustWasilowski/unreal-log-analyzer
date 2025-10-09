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
     * @returns {Object} Parsed memreport data with meta and sections
     */
    static parse(fileContent) {
        try {
            const lines = fileContent.split('\n').map(line => line.trim());
            const sections = [];
            let parseErrors = [];

            // Extract metadata from the beginning of the file
            const meta = this.extractMeta(lines);

            // Detect and parse sections
            const sectionData = this.detectSections(lines);
            
            for (const section of sectionData) {
                try {
                    const parsed = this.parseSection(section);
                    sections.push(parsed);
                } catch (error) {
                    // Add as raw section with error note
                    sections.push({
                        key: `unknown_${sections.length}`,
                        title: section.title || 'Unknown Section',
                        type: 'raw',
                        rawLines: section.lines,
                        error: error.message
                    });
                    parseErrors.push(error);
                }
            }

            return {
                meta,
                sections,
                parseErrors
            };
        } catch (error) {
            // Complete parsing failure - return raw fallback
            return {
                meta: { generator: 'memreport', error: error.message },
                sections: [{
                    key: 'raw_fallback',
                    title: 'Raw Content',
                    type: 'raw',
                    rawLines: fileContent.split('\n')
                }],
                parseErrors: [error]
            };
        }
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
                return { ...baseSection, ...this.parseTableSection(sectionData.lines, sectionData.title) };
            case 'kv':
                return { ...baseSection, ...this.parseKeyValueSection(sectionData.lines, sectionData.title) };
            default:
                return { ...baseSection, type: 'raw' };
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
        if (lines.length === 0) {
            return { columns: [], rows: [], notes: 'Empty section' };
        }

        // Find the header line (usually contains column names)
        let headerLineIndex = -1;
        let headerLine = '';
        
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
            // No clear header found, treat as raw
            return { columns: [], rows: [], notes: 'No table header detected' };
        }

        // Parse columns from header
        const columns = this.parseTableColumns(headerLine);
        
        // Parse data rows
        const dataLines = lines.slice(headerLineIndex + 1);
        const rows = [];
        
        for (const line of dataLines) {
            if (line.trim().length === 0) continue;
            
            const row = this.parseTableRow(line, columns);
            if (row && row.length > 0) {
                rows.push(row);
            }
        }

        return {
            columns: columns.map(col => col.name),
            rows,
            notes: `Parsed ${rows.length} rows with ${columns.length} columns`
        };
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
        const items = [];
        
        for (const line of lines) {
            if (line.trim().length === 0) continue;
            
            const kvPair = this.parseKeyValueLine(line);
            if (kvPair) {
                items.push(kvPair);
            }
        }
        
        return {
            items,
            notes: `Parsed ${items.length} key-value pairs`
        };
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemReportParser;
}