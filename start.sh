#!/bin/bash

# Exit on error
set -e

# Enable debugging
set -x

# Set default values
export PORT=${PORT:-5000}
export HOST=${HOST:-0.0.0.0}
export FLASK_APP=${FLASK_APP:-wsgi:application}
export FLASK_ENV=${FLASK_ENV:-production}

# Print environment for debugging
echo "=== Environment Variables ==="
printenv | sort
echo "==========================="

# Change to the app directory
cd /app

# Print environment for debugging
echo "=== Starting Server ==="
echo "Working directory: $(pwd)"
echo "Environment variables:"
printenv | sort
echo -e "\nDirectory contents:"
ls -la

# Install any additional dependencies
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies..."
    pip install --no-cache-dir -r requirements.txt
fi

# Ensure the server directory exists
mkdir -p server/static

# Function to check if the app is ready
check_health() {
    echo "Checking application health..."
    curl -sSf http://localhost:${PORT}/health > /dev/null
    return $?
}

# Start the application in the background
echo "Starting Gunicorn with Socket.IO..."
# Use exec to replace the current process with gunicorn
exec gunicorn --worker-class eventlet \
    -w 1 \
    --bind ${HOST}:${PORT} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --preload \
    --worker-connections 1000 \
    --log-level debug \
    --capture-output \
    --enable-stdio-inheritance \
    wsgi:application

# Store the PID
GUNICORN_PID=$!

# Wait for the application to start
MAX_RETRIES=30
RETRY_COUNT=0
while [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; do
    if check_health; then
        echo "Application is healthy!"
        break
    fi
    echo "Waiting for application to start... (Attempt $((RETRY_COUNT + 1))/${MAX_RETRIES})"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ ${RETRY_COUNT} -eq ${MAX_RETRIES} ]; then
    echo "ERROR: Application failed to start within the expected time"
    kill ${GUNICORN_PID} 2>/dev/null
    exit 1
fi

# Forward signals to gunicorn
trap 'kill -TERM ${GUNICORN_PID}' TERM
trap 'kill -TERM ${GUNICORN_PID}; exit 143' INT

# Wait for gunicorn to exit
wait ${GUNICORN_PID}
