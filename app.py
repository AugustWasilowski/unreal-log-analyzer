from flask import Flask, render_template, request, jsonify
import os
from werkzeug.utils import secure_filename
import re

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

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
                    log_type = line.split(':', 1)[0].strip()
                    log_category = re.search("(Log.*)", log_type)   
                    if log_category:
                        log_category_str = log_category.group()
                        log_type_counts[log_category_str] = log_type_counts.get(log_category_str, 0) + 1
                        log_entries.append({
                            'type': log_category_str,
                            'content': line[len(log_category_str)+1:].strip()
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
                log_type = line.split(':', 1)[0].strip()
                if log_type in UE_LOG_CATEGORIES:
                    if not selected_types or log_type in selected_types:
                        filtered_entries.append({
                            'type': log_type,
                            'content': line[len(log_type)+1:].strip()
                        })
    
    return jsonify({'entries': filtered_entries})

if __name__ == '__main__':
    # Get port from Railway environment variable
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 