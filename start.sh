#!/bin/bash

# Exit on error
set -e

# Enable debugging
set -x

# Set default values
export PORT=${PORT:-5000}
export HOST=${HOST:-0.0.0.0}

# Print environment for debugging
echo "=== Environment Variables ==="
printenv | sort
echo "==========================="

# Change to the server directory
cd /app/server

echo "=== Starting Server ==="
echo "Working directory: $(pwd)"
echo "Environment variables:"
printenv | sort
echo -e "\nDirectory contents:"
ls -la

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Function to check if the app is ready
check_health() {
    echo "Checking application health at http://localhost:${PORT}/health"
    if curl -sSf --max-time 2 "http://localhost:${PORT}/health" > /dev/null 2>&1; then
        echo "✅ Health check passed!"
        return 0
    else
        echo "❌ Health check failed"
        return 1
    fi
}

# Start the Flask app in the background
echo "Starting Flask application on ${HOST}:${PORT}..."
python app.py &

# Store the PID
FLASK_PID=$!
echo "Flask app started with PID: ${FLASK_PID}"

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
    kill ${FLASK_PID} 2>/dev/null || true
    exit 1
fi

# Set up signal handlers
cleanup() {
    echo "Shutting down gracefully..."
    kill -s TERM "${FLASK_PID}" 2>/dev/null || true
    wait "${FLASK_PID}" 2>/dev/null || true
    echo "Shutdown complete."
    exit 0
}

# Trap signals for graceful shutdown
trap cleanup TERM INT

# Keep the script running and wait for the application to exit
wait ${FLASK_PID} || true
