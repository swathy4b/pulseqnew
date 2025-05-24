"""
Simple script to test the health check endpoint.
"""
from flask import Flask, jsonify

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
    app.run(host='0.0.0.0', port=5000, debug=True)
