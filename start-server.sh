#!/bin/bash
set -e

# Set default values
export PORT=${PORT:-5000}
export HOST=${HOST:-0.0.0.0}

# Change to the server directory
cd "$(dirname "$0")/server"

# Install Python dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip install --no-cache-dir -r requirements.txt
fi

# Start the Python server
echo "Starting Python server on ${HOST}:${PORT}..."
exec python app.py
