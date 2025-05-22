#!/bin/bash

# Set the port from the environment variable or use default 5000
export PORT=${PORT:-5000}

# Change to the server directory
cd /app/server

# Install any additional dependencies
pip install -r /app/requirements.txt

# Print environment for debugging
echo "Starting server with the following configuration:"
echo "PORT: $PORT"
echo "FLASK_APP: $FLASK_APP"
echo "FLASK_ENV: $FLASK_ENV"

# Start the Flask application with the correct port
exec gunicorn -w 4 -b 0.0.0.0:$PORT app:app
