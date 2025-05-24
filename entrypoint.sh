#!/bin/bash
set -e

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

# Start the Flask app directly with Python (no Gunicorn for now)
echo "Starting Flask app on ${HOST}:${PORT}..."
exec python -u -m flask run --host=${HOST} --port=${PORT}
