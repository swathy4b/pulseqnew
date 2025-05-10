#!/bin/bash

# Install Python dependencies
pip install --upgrade pip
pip install wheel
pip install -r requirements.txt

# Ensure Python can find OpenCV
export PYTHONPATH=/usr/lib/python3/dist-packages:$PYTHONPATH

# Set default port for Python server
export PORT=5000

# Start the Python server in the background
cd server
python3 app.py > ../python_server.log 2>&1 &
PYTHON_PID=$!

# Wait for Python server to start
sleep 5

# Start the Node.js server in the background
cd ../client
npm start > ../node_server.log 2>&1 &
NODE_PID=$!

echo "Both servers are running!"
echo "Python server PID: $PYTHON_PID"
echo "Node.js server PID: $NODE_PID"
echo "Check python_server.log and node_server.log for output"
echo "To stop the servers, run: kill $PYTHON_PID $NODE_PID"

# Keep the script running
wait
