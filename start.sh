#!/bin/bash
# Install Python dependencies at runtime (just in case)
pip install --upgrade pip
pip install wheel
pip install -r requirements.txt

# Ensure Python can find OpenCV
export PYTHONPATH=/usr/lib/python3/dist-packages:$PYTHONPATH

# Start the Python server in the background
python3 server/app.py > python_server.log 2>&1 &
PYTHON_PID=$!

# Wait for Python server to start and find its port
sleep 5
PYTHON_PORT=$(grep "Attempting to start server on port" python_server.log | tail -n 1 | grep -o '[0-9]\+')

# Export the Python port for Node.js to use
export PYTHON_PORT

# Start the Node.js server (in the foreground)
node server/server.js

# If Node.js server exits, kill Python server
kill $PYTHON_PID 