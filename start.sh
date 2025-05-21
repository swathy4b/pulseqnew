#!/bin/bash

# Start Flask server in background
python server/server.py &

# Start nginx
nginx -g 'daemon off;'
