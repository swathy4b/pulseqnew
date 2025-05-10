@echo off
echo Starting Python and Node.js servers...

:: Start Python server in a new window
start cmd /k "cd server && python app.py"

:: Wait for Python server to start
timeout /t 5

:: Start Node.js server in a new window
start cmd /k "cd client && npm start"

echo Both servers are running!
echo Press Ctrl+C in each window to stop the servers. 