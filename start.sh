#!/bin/bash
# Install Python dependencies at runtime (just in case)
pip install --upgrade pip
pip install wheel
pip install -r requirements.txt

# Start the Python server in the background
python server/app.py &

# Start the Node.js server (in the foreground)
node server/server.js 