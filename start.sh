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
    curl -sSf "http://localhost:${PORT}/health" > /dev/null 2>&1
    return $?
}

# Start the application in the background
echo "Starting Gunicorn with Socket.IO..."

gunicorn \
    --worker-class eventlet \
    -w 1 \
    --bind ${HOST}:${PORT} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --capture-output \
    --enable-stdio-inheritance \
    --preload \
    --worker-connections 1000 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --max-requests 1000 \
    --access-logformat '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s' \
    wsgi:application &

# Store the PID
GUNICORN_PID=$!
echo "Gunicorn started with PID: ${GUNICORN_PID}"

# Wait for the application to start
MAX_RETRIES=10
RETRY_INTERVAL=3
RETRY_COUNT=0

while [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; do
    echo "Checking if application is ready (Attempt $((RETRY_COUNT + 1))/${MAX_RETRIES})..."
    
    if check_health; then
        echo "✅ Application is healthy and responding to requests!"
        break
    fi
    
    echo "Waiting for application to start... (${RETRY_INTERVAL}s until next retry)"
    sleep ${RETRY_INTERVAL}
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

# Check if we exceeded max retries
if [ ${RETRY_COUNT} -eq ${MAX_RETRIES} ]; then
    echo "❌ ERROR: Application failed to start within the expected time"
    echo "Troubleshooting steps:"
    echo "1. Check application logs for errors"
    echo "2. Verify the application is binding to the correct host and port"
    
    # Try to get more detailed error information
    echo -e "\n=== Last Health Check Output ==="
    curl -v "http://localhost:${PORT}/health" || echo "Health check failed"
    
    # Clean up
    kill ${GUNICORN_PID} 2>/dev/null || true
    exit 1
fi

# Set up signal handlers
cleanup() {
    echo "Shutting down gracefully..."
    kill -s TERM "${GUNICORN_PID}" 2>/dev/null || true
    wait "${GUNICORN_PID}" 2>/dev/null || true
    echo "Shutdown complete."
    exit 0
}

# Trap signals for graceful shutdown
trap cleanup TERM INT

# Keep the script running and wait for the application to exit
wait ${GUNICORN_PID} || true
