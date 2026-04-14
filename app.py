from flask import Flask, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
import re

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Regex pattern to extract log category from Unreal Engine log lines.
# Skips optional timestamp/frame blocks like [2024.01.15-10.30.45:123][  0]
# then captures the category name (PascalCase identifier) before the first colon.
LOG_CATEGORY_PATTERN = re.compile(r'(?:\[.*?\]\s*)*([A-Za-z][A-Za-z0-9_]*)\s*:')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'message': 'Unreal Engine Log Analyzer is running'}), 200

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Read and process the log file
        log_entries = []
        log_type_counts = {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip() and ':' in line:
                    match = LOG_CATEGORY_PATTERN.match(line)
                    if match:
                        log_category = match.group(1)
                        content_start = match.end()
                        log_type_counts[log_category] = log_type_counts.get(log_category, 0) + 1
                        log_entries.append({
                            'type': log_category,
                            'content': line[content_start:].strip()
                        })
        log_types = [ {'type': t, 'count': log_type_counts[t]} for t in sorted(log_type_counts.keys()) ]
        return jsonify({
            'entries': log_entries,
            'log_types': log_types
        })

@app.route('/filter', methods=['POST'])
def filter_logs():
    data = request.get_json()
    selected_types = data.get('types', [])
    
    # Read the log file again
    filename = data.get('filename')
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    filtered_entries = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip() and ':' in line:
                match = LOG_CATEGORY_PATTERN.match(line)
                if match:
                    log_category = match.group(1)
                    content_start = match.end()
                    if not selected_types or log_category in selected_types:
                        filtered_entries.append({
                            'type': log_category,
                            'content': line[content_start:].strip()
                        })
    
    return jsonify({'entries': filtered_entries})

if __name__ == '__main__':
    # Get port from Railway environment variable
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 