#!/bin/bash

# Set the port from the environment variable or use default 5000
export PORT=${PORT:-5000}

# Change to the app directory
cd /app

# Install any additional dependencies
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi

# Print environment for debugging
echo "=== Starting Server ==="
echo "Working directory: $(pwd)"
echo "Directory contents:"
ls -la
echo "PORT: $PORT"
echo "FLASK_APP: $FLASK_APP"
echo "FLASK_ENV: $FLASK_ENV"

# Ensure the server directory exists
mkdir -p server/static

# Start the Flask application with the correct port
echo "Starting Gunicorn with Socket.IO..."
exec gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:$PORT --timeout 120 --access-logfile - --error-logfile - wsgi:application
