from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/health')
def health_check():
    """Simple health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'pulseq',
        'version': '1.0.0'
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    print(f"Starting app on {host}:{port}")
    app.run(host=host, port=port, debug=False)
