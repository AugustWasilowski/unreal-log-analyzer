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
}

// Export for use in other modules
window.Utils = Utils; 