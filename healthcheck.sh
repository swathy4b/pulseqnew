#!/bin/bash

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
