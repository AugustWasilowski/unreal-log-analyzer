// Utility functions and performance optimizations
class Utils {
    // Debounce function for search input
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function for performance
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Get log level class for styling
    static getLogLevelClass(level) {
        switch (level) {
            case 'Warning': return 'log-level-warning';
            case 'Error': return 'log-level-error';
            case 'Display': return 'log-level-display';
            default: return '';
        }
    }

    // Sanitize user input to prevent XSS
    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.replace(/[<>]/g, '');
    }

    // Create DOM element with attributes
    static createElement(tag, className, attributes = {}) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    }

    // Create text node safely
    static createTextNode(text) {
        return document.createTextNode(this.sanitizeInput(text));
    }

    // Show error toast
    static showErrorToast(message) {
        const errorToast = document.createElement('div');
        errorToast.className = 'toast';
        errorToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto text-danger">Error</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${this.sanitizeInput(message)}
            </div>
        `;
        
        const toastContainer = document.querySelector('.toast-container');
        toastContainer.appendChild(errorToast);
        
        const toast = new bootstrap.Toast(errorToast);
        toast.show();
        
        // Remove toast element after it's hidden
        errorToast.addEventListener('hidden.bs.toast', () => {
            toastContainer.removeChild(errorToast);
        });
    }

    // Show success toast
    static showSuccessToast(message) {
        const successToast = document.getElementById('copyToast');
        if (successToast) {
            const toast = new bootstrap.Toast(successToast);
            toast.show();
        }
    }

    // API call wrapper with error handling
    static async handleApiCall(apiFunction, errorMessage) {
        try {
            return await apiFunction();
        } catch (error) {
            console.error('API Error:', error);
            this.showErrorToast(errorMessage);
            throw error;
        }
    }

    // Copy text to clipboard with fallback
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (fallbackErr) {
                console.error('Clipboard copy failed:', fallbackErr);
                return false;
            }
        }
    }

    // Announce changes to screen readers
    static announceToScreenReader(message) {
        const liveRegion = document.getElementById('liveRegion');
        if (liveRegion) {
            liveRegion.textContent = message;
            // Clear after a short delay to allow for multiple announcements
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    // Format number with commas
    static formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Validate regex pattern
    static isValidRegex(pattern) {
        try {
            new RegExp(pattern);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Format memory values with appropriate units
    static formatMemoryValue(value, unit = 'KB') {
        if (typeof value !== 'number') return value;
        
        if (unit === 'KB' && value >= 1024) {
            return `${(value / 1024).toFixed(1)} MB`;
        } else if (unit === 'MB' && value >= 1024) {
            return `${(value / 1024).toFixed(1)} GB`;
        }
        
        return `${this.formatNumber(value)} ${unit}`;
    }

    // Download data as file
    static downloadAsFile(data, filename, mimeType = 'text/plain') {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    // Convert array of objects to CSV
    static arrayToCSV(data, headers = null) {
        if (!data || data.length === 0) return '';
        
        // Use provided headers or extract from first row
        const csvHeaders = headers || Object.keys(data[0]);
        
        // Create CSV content
        const csvContent = [
            csvHeaders.join(','),
            ...data.map(row => 
                csvHeaders.map(header => {
                    const value = row[header] || '';
                    // Escape commas and quotes
                    return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');
        
        return csvContent;
    }

    // Convert table data to CSV format
    static tableToCSV(columns, rows) {
        if (!columns || !rows || rows.length === 0) return '';
        
        const csvContent = [
            columns.join(','),
            ...rows.map(row => 
                row.map(cell => {
                    const value = String(cell || '');
                    // Escape commas and quotes
                    return value.includes(',') || value.includes('"') 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');
        
        return csvContent;
    }

    // Show info toast
    static showInfoToast(message, title = 'Info') {
        const infoToast = document.createElement('div');
        infoToast.className = 'toast';
        infoToast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto text-info">${this.sanitizeInput(title)}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${this.sanitizeInput(message)}
            </div>
        `;
        
        const toastContainer = document.querySelector('.toast-container');
        if (toastContainer) {
            toastContainer.appendChild(infoToast);
            
            const toast = new bootstrap.Toast(infoToast);
            toast.show();
            
            // Remove toast element after it's hidden
            infoToast.addEventListener('hidden.bs.toast', () => {
                if (toastContainer.contains(infoToast)) {
                    toastContainer.removeChild(infoToast);
                }
            });
        }
    }
}

// Export for use in other modules
window.Utils = Utils; 