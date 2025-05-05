#!/bin/bash
# Install Python dependencies at runtime (just in case)
pip install --upgrade pip
pip install wheel
pip install -r requirements.txt

# Ensure Python can find OpenCV
export PYTHONPATH=/usr/lib/python3/dist-packages:$PYTHONPATH

# Start the Python server in the background
python3 server/app.py &
PYTHON_PID=$!

# Wait for Python server to start
sleep 5

# Start the Node.js server (in the foreground)
node server/server.js

# If Node.js server exits, kill Python server
kill $PYTHON_PID 