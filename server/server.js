const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const Queue = require('./models/Queue');
const queueRouter = require('./routes/queue');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const httpProxy = require('http-proxy');
const fs = require('fs');
const os = require('os');

// Use different ports for Node.js and Python servers
const port = process.env.PORT || 10000;  // Node.js server port
const pythonPort = 5000;  // Python server port

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartqueue';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    });
});

// Python process management
let pythonProcess = null;

function startPythonServer() {
    if (pythonProcess) {
        console.log('Python server is already running');
        return Promise.resolve();
    }

    console.log('Starting Python server...');
    return new Promise((resolve, reject) => {
        pythonProcess = spawn('python', ['server/app.py'], {
            stdio: 'pipe',
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PORT: pythonPort  // Set Python server port
            }
        });

        let isReady = false;

        pythonProcess.stdout.on('data', (data) => {
            console.log(`Python server output: ${data}`);
            if (data.toString().includes(`Starting Python server on port ${pythonPort}`)) {
                isReady = true;
                resolve();
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python server error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python server process exited with code ${code}`);
            pythonProcess = null;
            if (!isReady) {
                reject(new Error('Python server failed to start'));
            }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!isReady) {
                reject(new Error('Python server startup timed out'));
            }
        }, 10000);
    });
}

function stopPythonServer() {
    if (pythonProcess) {
        console.log('Stopping Python server...');
        pythonProcess.kill();
        pythonProcess = null;
    }
}

// Create proxy server
const proxy = httpProxy.createProxyServer({});

// Get absolute paths
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');

console.log('Root directory:', rootDir);
console.log('Client directory:', clientDir);
console.log('Server port:', port);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Make io instance available to routes
app.set('io', io);

// Proxy for MJPEG stream (must be before any static/catch-all routes)
app.use('/detection/feed', createProxyMiddleware({
    target: `http://localhost:${pythonPort}`,
    changeOrigin: true,
    ws: true,
    logLevel: 'debug'
}));

// Proxy for all other detection routes
app.use('/detection', createProxyMiddleware({
    target: `http://localhost:${pythonPort}`,
    changeOrigin: true,
    pathRewrite: { '^/detection': '' },
    onError: (err, req, res) => {
        res.status(500).send('Proxy error');
    }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // Always serve index.html on any error
  const indexPath = path.join(clientDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(200).send(''); // Send empty response if all else fails
    }
  });
});

// Serve static files first
app.use(express.static(clientDir, {
  fallthrough: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// API Routes
app.use('/api/queue', queueRouter);

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const IP = getLocalIP();

// QR Code route
app.get('/api/queue/qr', async (req, res) => {
    try {
        // Get the base URL from environment or request
        let baseUrl;
        if (process.env.RENDER_EXTERNAL_URL) {
            baseUrl = process.env.RENDER_EXTERNAL_URL;
        } else if (req.get('origin')) {
            baseUrl = req.get('origin');
        } else {
            baseUrl = `http://localhost:${port}`;
        }
        
        // Remove trailing slash if present
        baseUrl = baseUrl.replace(/\/$/, '');
        
        const registerUrl = `${baseUrl}/register`;
        console.log('Generating QR code for URL:', registerUrl);
        
        const qrCode = await QRCode.toDataURL(registerUrl);
        res.json({ qrCode });
    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Routes for HTML pages
app.get('/register', (req, res) => {
    try {
        const filePath = path.join(clientDir, 'register.html');
        console.log('Serving register.html from:', filePath);
        res.sendFile(filePath);
    } catch (err) {
        console.error('Error serving register.html:', err);
        res.redirect('/');
    }
});

app.get('/confirmation', (req, res) => {
    try {
        const filePath = path.join(clientDir, 'confirmation.html');
        console.log('Serving confirmation.html from:', filePath);
        res.sendFile(filePath);
    } catch (err) {
        console.error('Error serving confirmation.html:', err);
        res.redirect('/');
    }
});

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle test connection
    socket.on('test_connection', (data) => {
        console.log('Test connection received from client:', data);
        socket.emit('test_response', { 
            status: 'success',
            message: 'Server received your test message',
            clientId: socket.id
        });
    });

    socket.on('joinQueue', async (data) => {
        console.log('Join queue request:', data);
        try {
            const { name, phone, priority, notification } = data;
            const queueItem = new Queue({
                name,
                phone,
                status: 'waiting',
                priority: priority || 'none',
                notification: notification || false
            });
            await queueItem.save();
            io.emit('queueUpdate', await Queue.find());
        } catch (error) {
            console.error('Join queue error:', error);
            socket.emit('error', { message: 'Failed to join queue. Please try again.' });
        }
    });
    
    socket.on('processNext', async () => {
        console.log('Process next request received');
        try {
            let item = await Queue.findOneAndUpdate(
                { status: 'waiting', priority: { $ne: 'none' } },
                { status: 'processing' },
                { new: true, sort: { joinTime: 1 } }
            );
            
            if (!item) {
                item = await Queue.findOneAndUpdate(
                    { status: 'waiting' },
                    { status: 'processing' },
                    { new: true, sort: { joinTime: 1 } }
                );
            }
            
            if (item) {
                console.log('Processing next item:', item);
                io.emit('queueUpdate', await Queue.find());
            }
        } catch (error) {
            console.error('Process next error:', error);
            socket.emit('error', { message: 'Failed to process next in queue. Please try again.' });
        }
    });
    
    socket.on('clearQueue', async () => {
        console.log('Clear queue request received');
        try {
            await Queue.deleteMany({});
            io.emit('queueUpdate', []);
        } catch (error) {
            console.error('Clear queue error:', error);
            socket.emit('error', { message: 'Failed to clear queue. Please try again.' });
        }
    });

    socket.on('evacuate_now', () => {
        console.log('Evacuate now request received from client:', socket.id);
        // Broadcast evacuation alert to all connected clients
        io.emit('evacuationAlert', {
            message: '🚨 EMERGENCY EVACUATION! Please leave the area immediately!',
            voiceMessage: 'Emergency evacuation! Please exit the building immediately. Follow the emergency exits. This is not a drill.',
            timestamp: new Date().toISOString()
        });
        console.log('Emitted evacuationAlert event to all clients');
        
        Queue.deleteMany({})
            .then(() => {
                console.log('Queue cleared successfully');
                io.emit('queueUpdate', []);
            })
            .catch(error => {
                console.error('Error clearing queue during evacuation:', error);
            });
    });

    socket.on('triggerEvacuation', () => {
        console.log('Trigger evacuation request received from client:', socket.id);
        // Broadcast evacuation alert to all connected clients
        io.emit('evacuationAlert', {
            message: '🚨 EMERGENCY EVACUATION! Please leave the area immediately!',
            voiceMessage: 'Emergency evacuation! Please exit the building immediately. Follow the emergency exits. This is not a drill.',
            timestamp: new Date().toISOString()
        });
        console.log('Emitted evacuationAlert event to all clients');

        // Clear the queue
        Queue.deleteMany({})
            .then(() => {
                console.log('Queue cleared successfully');
                io.emit('queueUpdate', []);
            })
            .catch(error => {
                console.error('Error clearing queue during evacuation:', error);
            });

        // Log evacuation event
        console.log('Emergency evacuation triggered');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start Node.js server
http.listen(port, '0.0.0.0', () => {
    console.log(`Node.js server running on port ${port}`);
    console.log('Available routes:');
    console.log('- /');
    console.log('- /register');
    console.log('- /confirmation');
    console.log('- /api/queue');
    console.log('- /api/queue/qr');
    console.log('- /detection/* (Python server routes)');
    
    // Log the URL that will be used for QR codes
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    console.log(`QR Code will point to: ${baseUrl}/register`);
});
