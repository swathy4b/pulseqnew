#!/bin/bash
set -ex

# Set default values
export PORT=${PORT:-5000}
export HOST=${HOST:-0.0.0.0}

# Print environment for debugging
echo "=== Environment Variables ==="
printenv | sort
echo "==========================="

# Change to the app directory
cd /app

# Install Python dependencies
echo "Installing dependencies..."
pip install --no-cache-dir -r requirements.txt flask gunicorn

# Verify network interfaces
echo "=== Network Interfaces ==="
cat /etc/hosts
echo "========================="

# Start the Flask app directly with Python
echo "Starting Flask app on ${HOST}:${PORT}..."

# Run the app with explicit binding to 0.0.0.0
# and enable debug output
exec python -u -m flask run --host=0.0.0.0 --port=${PORT} --debug
