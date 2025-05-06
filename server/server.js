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

const port = process.env.PORT || 10000;  // Node.js server port
const pythonPort = 5000;  // Python server port

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

// Serve static files from client directory
app.use(express.static(clientDir));

// API Routes
app.use('/api/queue', queueRouter);

// QR Code route
app.get('/api/queue/qr', async (req, res) => {
  try {
    const qrCodeUrl = await QRCode.toDataURL(`https://i-smartqueue.onrender.com/register`);
    console.log('Serving QR Code URL:', qrCodeUrl);
    res.json({ qrCode: qrCodeUrl });
  } catch (err) {
    console.error('QR Code generation error:', err);
    res.status(500).send('Error generating QR code');
  }
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

// Root route - serve index.html
app.get('/', (req, res) => {
  const filePath = path.join(clientDir, 'index.html');
  console.log('Serving index.html from:', filePath);
  res.sendFile(filePath);
});

// Proxy /detection/feed as a raw stream (for the live video feed)
app.get('/detection/feed', (req, res) => {
  console.log(`Proxying to Python server on port ${pythonPort}`);
  
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: pythonPort,
      path: '/feed',
      method: 'GET',
      headers: req.headers,
    },
    proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', err => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  });
  proxyReq.end();
});

// Proxy all other /detection/* requests to Flask
console.log(`Setting up proxy to Python server on port ${pythonPort}`);
app.use('/detection', createProxyMiddleware({
  target: `http://localhost:${pythonPort}`,
  changeOrigin: true,
  pathRewrite: { '^/detection': '' }
}));

// Catch-all for undefined routes
app.get('*', (req, res) => {
  console.log(`404 Error for path: ${req.path} from ${req.ip}`);
  res.status(404).send('Page not found. Please use the root URL.');
});

// Start Python server with explicit port
const pythonProcess = spawn('python', ['server/app.py'], {
  env: { ...process.env, PORT: pythonPort }
});

pythonProcess.stdout.on('data', (data) => {
  console.log(`Python output: ${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`Python error: ${data}`);
});

pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ismartqueue')
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error details:', err);
  console.log('MongoDB URI (partial for security):', 
    process.env.MONGODB_URI ? 
    process.env.MONGODB_URI.substring(0, 20) + '...' : 
    'Not set - using local fallback');
});

// Socket.IO
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