#!/bin/bash

# Print current directory and contents for debugging
pwd
ls -la

# Change to the server directory
cd /app/server || { echo "Failed to change to /app/server"; exit 1; }

# Print server directory contents
pwd
ls -la

# Install any additional dependencies
pip install -r /app/requirements.txt

# Start the Flask application
echo "Starting Python server..."
exec python /app/server/app.py
