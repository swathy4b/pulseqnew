#!/bin/bash

# Print current directory and contents for debugging
echo "Current directory:"
pwd
echo "\nContents of /app:"
ls -la /app
echo "\nContents of /app/server:"
ls -la /app/server

# Change to the app directory
cd /app || { echo "Failed to change to /app directory"; exit 1; }

# Install any additional dependencies
pip install -r requirements.txt

# Start the Flask application
echo "Starting Python server..."
exec python server/app.py
