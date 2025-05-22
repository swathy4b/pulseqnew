#!/bin/bash

# Print current directory and contents for debugging
echo "=== Current directory ==="
pwd

# Show directory structure
echo -e "\n=== Directory structure ==="
find /app -type d | sort

echo -e "\n=== Contents of /app/server ==="
ls -la /app/server

# Change to the server directory
cd /app/server || { echo "Failed to change to /app/server directory"; exit 1; }

# Install any additional dependencies
pip install -r /app/requirements.txt

# Start the Flask application
echo -e "\n=== Starting Python server ==="
echo "Running: python app.py"
exec python app.py
