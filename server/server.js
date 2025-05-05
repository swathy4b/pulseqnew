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
const http = require('http').createServer(express());
const io = require('socket.io')(http);
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 10000;

// Add MongoDB reconnection logics
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected - attempting to reconnect');
  setTimeout(() => {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ismartqueue', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });
  }, 5000);
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('client'));

// API Routes - MUST be defined BEFORE the catch-all route
app.use('/api/queue', queueRouter);

// QR Code route - MUST be defined BEFORE the catch-all route
app.get('/api/queue/qr', async (req, res) => {
  try {
    const qrCodeUrl = await QRCode.toDataURL(`https://i-smartqueue.onrender.com/register`); // Update with your Render URL
    console.log('Serving QR Code URL:', qrCodeUrl);
    res.json({ qrCode: qrCodeUrl });
  } catch (err) {
    console.error('QR Code generation error:', err);
    res.status(500).send('Error generating QR code');
  }
});

// New route for registration page
app.get('/register', (req, res) => {
  console.log('Serving register.html');
  res.sendFile(path.join(__dirname, '../client/register.html'));
});

// New route for confirmation page
app.get('/confirmation', (req, res) => {
  console.log('Serving confirmation.html');
  res.sendFile(path.join(__dirname, '../client/confirmation.html'));
});

// Serve index.html as the default route
app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Proxy /detection/feed as a raw stream (for the live video feed)
app.get('/detection/feed', (req, res) => {
  const proxyReq = http.request(
    {
      hostname: 'localhost',
      port: process.env.PYTHON_PORT || 5000,
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
    res.status(500).send('Proxy error');
  });
  proxyReq.end();
});

// Proxy all other /detection/* requests to Flask
app.use('/detection', createProxyMiddleware({
  target: `http://localhost:${process.env.PYTHON_PORT || 5000}`,
  changeOrigin: true,
  pathRewrite: { '^/detection': '' }
}));

// Catch-all for undefined routes - MUST be the LAST route defined
app.get('*', (req, res) => {
  console.log(`404 Error for path: ${req.path} from ${req.ip}`);
  res.status(404).send('Page not found. Please use the root URL.');
});

// Start Python server
const pythonProcess = spawn('python', ['server/app.py']);

pythonProcess.stdout.on('data', (data) => {
  console.log(`Python output: ${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`Python error: ${data}`);
});

pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
});

// MongoDB Connection - UPDATED VERSION
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