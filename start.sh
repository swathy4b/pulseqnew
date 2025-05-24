#!/bin/bash

# Exit on error
set -e

# Enable debugging
set -x

# Set default values
export PORT=${PORT:-3000}
export BACKEND_PORT=5000
export HOST=0.0.0.0

# Print environment for debugging
echo "=== Environment Variables ==="
printenv | sort
echo "==========================="

# Install Python dependencies if needed
echo "=== Setting up Python Backend ==="
cd server
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

# Start Python backend in background
echo "Starting Python backend on port ${BACKEND_PORT}..."
python app.py --port=${BACKEND_PORT} &
PYTHON_PID=$!
echo "Python backend started with PID: ${PYTHON_PID}"

# Go back to project root
cd ..

# Install Node.js dependencies
echo "=== Setting up Node.js Frontend ==="
if [ -f "package.json" ]; then
    npm install
fi

# Start Node.js server
echo "Starting Node.js server on port ${PORT}..."
node server.js

# Clean up Python process when Node.js exits
echo "Shutting down Python backend..."
kill $PYTHON_PID 2>/dev/null || true

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
