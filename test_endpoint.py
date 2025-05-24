"""
Test endpoint to verify the Flask application is running.
"""
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/test')
def test_endpoint():
    """Simple test endpoint to verify the application is running."""
    return jsonify({
        'status': 'success',
        'message': 'Test endpoint is working!',
        'service': 'pulseq',
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
