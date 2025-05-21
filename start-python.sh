#!/bin/bash

# Change to the server directory
cd /app/server

# Install any additional dependencies
pip install -r /app/requirements.txt

# Start the Flask application
exec python app.py
