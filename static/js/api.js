// API communication module
class API {
    // Upload log file
    static async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await Utils.handleApiCall(
            () => fetch('/upload', { method: 'POST', body: formData }),
            'Failed to upload file. Please try again.'
        );
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error uploading file');
        }
        
        return await response.json();
    }

    // Filter logs by type
    static async filterLogs(filename, types) {
        const response = await Utils.handleApiCall(
            () => fetch('/filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, types })
            }),
            'Failed to filter logs. Please try again.'
        );
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error filtering logs');
        }
        
        return await response.json();
    }
}

// Export for use in other modules
window.API = API; 