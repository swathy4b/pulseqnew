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

// Use different ports for Node.js and Python servers
const port = process.env.PORT || 10000;  // Node.js server port
const pythonPort = 5000;  // Python server port

// Create proxy server
const proxy = httpProxy.createProxyServer({});

// Get absolute paths
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');

console.log('Root directory:', rootDir);
console.log('Client directory:', clientDir);
console.log('Node.js server port:', port);
console.log('Python server port:', pythonPort);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files first
app.use(express.static(clientDir));

// Root route - serve index.html
app.get('/', (req, res) => {
  const filePath = path.join(clientDir, 'index.html');
  console.log('Serving index.html from:', filePath);
  res.sendFile(filePath);
});

// Routes for HTML pages
app.get('/register', (req, res) => {
  const filePath = path.join(clientDir, 'register.html');
  console.log('Serving register.html from:', filePath);
  res.sendFile(filePath);
});

app.get('/confirmation', (req, res) => {
  const filePath = path.join(clientDir, 'confirmation.html');
  console.log('Serving confirmation.html from:', filePath);
  res.sendFile(filePath);
});

// Serve the main QR code page
app.get('/qr', (req, res) => {
  const filePath = path.join(clientDir, 'index.html');
  console.log('Serving QR code page from:', filePath);
  res.sendFile(filePath);
});

// Proxy /detection/feed as a raw stream (for the live video feed)
app.get('/detection/feed', (req, res) => {
  console.log(`Proxying to Python server on port ${pythonPort}`);
  
  proxy.web(req, res, {
    target: `http://localhost:${pythonPort}/feed`,
    ws: true
  }, (err) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  });
});

// Proxy all other /detection/* requests to Flask
console.log(`Setting up proxy to Python server on port ${pythonPort}`);
app.use('/detection', createProxyMiddleware({
  target: `http://localhost:${pythonPort}`,
  changeOrigin: true,
  pathRewrite: { '^/detection': '' }
}));

// Catch-all for undefined routes - serve index.html for SPA
app.get('*', (req, res) => {
  // Don't proxy /detection routes
  if (req.path.startsWith('/detection')) {
    return next();
  }
  
  console.log(`Serving index.html for path: ${req.path} from ${req.ip}`);
  const filePath = path.join(clientDir, 'index.html');
  res.sendFile(filePath);
});

// Start Python server with explicit port
const pythonProcess = spawn('python', ['server/app.py'], {
  env: { ...process.env, PORT: pythonPort },
  stdio: 'pipe'  // Capture stdout and stderr
});

// Handle Python server output
pythonProcess.stdout.on('data', (data) => {
  console.log(`Python output: ${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`Python error: ${data}`);
});

pythonProcess.on('error', (err) => {
  console.error('Failed to start Python server:', err);
});

pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
  if (code !== 0) {
    console.error('Python server failed to start properly');
  }
});

// Wait for Python server to start
const waitForPythonServer = () => {
  return new Promise((resolve, reject) => {
    const maxAttempts = 30;  // Increased attempts
    let attempts = 0;
    
    const checkServer = () => {
      const http = require('http');
      const req = http.get(`http://localhost:${pythonPort}/status`, (res) => {
        if (res.statusCode === 200) {
          console.log('Python server is ready');
          resolve();
        } else {
          reject(new Error(`Python server returned status code ${res.statusCode}`));
        }
      });
      
      req.on('error', (err) => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Failed to connect to Python server after multiple attempts'));
        } else {
          console.log(`Waiting for Python server... Attempt ${attempts}/${maxAttempts}`);
          setTimeout(checkServer, 2000);  // Increased delay
        }
      });
    };
    
    checkServer();
  });
};

// Start Node.js server after Python server is ready
waitForPythonServer()
  .then(() => {
    // MongoDB Connection
    return mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ismartqueue');
  })
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start Node.js server
    http.listen(port, '0.0.0.0', () => {
      console.log(`Node.js server running on port ${port}`);
      console.log('Available routes:');
      console.log('- /');
      console.log('- /register');
      console.log('- /confirmation');
      console.log('- /api/queue');
      console.log('- /api/queue/qr');
      console.log('- /detection/*');
    });
  })
  .catch((err) => {
    console.error('Failed to start servers:', err);
    process.exit(1);
  });

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('joinQueue', async (data) => {
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
      
      if (item) io.emit('queueUpdate', await Queue.find());
    } catch (error) {
      console.error('Process next error:', error);
      socket.emit('error', { message: 'Failed to process next in queue. Please try again.' });
    }
  });
  
  socket.on('clearQueue', async () => {
    try {
      await Queue.deleteMany({});
      io.emit('queueUpdate', []);
    } catch (error) {
      console.error('Clear queue error:', error);
      socket.emit('error', { message: 'Failed to clear queue. Please try again.' });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
  });
});