from flask import Flask, render_template, jsonify

app = Flask(__name__)

# This server's only job is to serve static assets and render index.html.
# All log parsing happens client-side in the browser — log data never leaves
# the user's machine. Do not add backend endpoints that receive log content.

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'message': 'Unreal Engine Log Analyzer is running'}), 200

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
