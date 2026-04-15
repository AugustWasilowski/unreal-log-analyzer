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
# Handles both timestamped and plain formats:
#   [2024.01.15-10.30.45:123][  0]LogCore: Display: message  (with timestamp)
#   LogCore: Display: message                                  (without timestamp)
#
# Group 1: timestamp string from the first bracket (e.g. "2024.01.15-10.30.45:123"), or None
# Group 2: log category name (e.g. "LogCore")
#
# Uses [^\]]* (any char except ']') instead of .*? for reliable bracket matching.
LOG_LINE_PATTERN = re.compile(
    r'(?:\[([^\]]*)\]\s*)?'        # Optional first bracket — captures timestamp (group 1)
    r'(?:\[[^\]]*\]\s*)*'          # Zero or more additional brackets (frame number, etc.)
    r'([A-Za-z][A-Za-z0-9_]*)'    # Log category name (group 2)
    r'\s*:'                        # Colon separator
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'message': 'Unreal Engine Log Analyzer is running'}), 200

def _parse_log_lines(lines):
    """Parse an iterable of log lines and return (entries, log_types)."""
    log_entries = []
    log_type_counts = {}

    for line in lines:
        if not line.strip() or ':' not in line:
            continue
        match = LOG_LINE_PATTERN.match(line)
        if match:
            timestamp = match.group(1)    # e.g. "2024.01.15-10.30.45:123", or None
            log_category = match.group(2)
            content_start = match.end()
            log_type_counts[log_category] = log_type_counts.get(log_category, 0) + 1
            entry = {
                'type': log_category,
                'content': line[content_start:].strip()
            }
            if timestamp:
                entry['timestamp'] = timestamp
            log_entries.append(entry)

    log_types = [{'type': t, 'count': log_type_counts[t]} for t in sorted(log_type_counts.keys())]
    return log_entries, log_types


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
        
        with open(filepath, 'r', encoding='utf-8') as f:
            log_entries, log_types = _parse_log_lines(f)

        return jsonify({
            'entries': log_entries,
            'log_types': log_types
        })


@app.route('/paste', methods=['POST'])
def paste_log():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No log text provided'}), 400

    text = data['text']
    if not text.strip():
        return jsonify({'error': 'Log text is empty'}), 400

    lines = text.splitlines()
    log_entries, log_types = _parse_log_lines(lines)

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
            if not line.strip() or ':' not in line:
                continue
            match = LOG_LINE_PATTERN.match(line)
            if match:
                timestamp = match.group(1)
                log_category = match.group(2)
                content_start = match.end()
                if not selected_types or log_category in selected_types:
                    entry = {
                        'type': log_category,
                        'content': line[content_start:].strip()
                    }
                    if timestamp:
                        entry['timestamp'] = timestamp
                    filtered_entries.append(entry)
    
    return jsonify({'entries': filtered_entries})

if __name__ == '__main__':
    # Get port from Railway environment variable
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) 