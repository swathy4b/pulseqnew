#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Set default values
PORT=${PORT:-5000}
HOST=localhost  # Changed from 0.0.0.0 to localhost for container health checks

# Simple health check that just tries to connect to the health endpoint
echo "Performing health check on http://${HOST}:${PORT}/health"

# Try to get health status with 2 second timeout
if curl -sSf --max-time 2 "http://${HOST}:${PORT}/health"; then
    echo "Health check passed"
    exit 0
else
    # If curl fails, show the error
    echo "Health check failed"
    exit 1
fi

# Main execution with retries
RETRY_COUNT=0
while [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; do
    if check_health; then
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Retry ${RETRY_COUNT}/${MAX_RETRIES}..."
    
    if [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; then
        sleep ${RETRY_DELAY}
    fi
done

echo "Health check failed after ${MAX_RETRIES} attempts"
exit 1

# Exit on any error
set -e

# Get the port from environment variable or use default
PORT=${PORT:-5000}
HOST=${HOST:-localhost}

# Maximum number of retries
MAX_RETRIES=30
RETRY_INTERVAL=2

# Function to check if the application is ready
check_health() {
    echo "Checking application health at http://${HOST}:${PORT}/health"
    curl -sSf -m 5 "http://${HOST}:${PORT}/health" > /dev/null
    return $?
}

# Try to connect to the application
for ((i=1; i<=MAX_RETRIES; i++)); do
    if check_health; then
        echo "Application is healthy!"
        exit 0
    fi
    
    echo "Attempt ${i}/${MAX_RETRIES} - Application not ready, retrying in ${RETRY_INTERVAL} seconds..."
    sleep ${RETRY_INTERVAL}
done

echo "Health check failed after ${MAX_RETRIES} attempts"
exit 1
