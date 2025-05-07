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
  fallthrough: true, // Continue to next middleware if file not found
  setHeaders: (res, path) => {
    // Set cache headers for static files
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// API Routes
app.use('/api/queue', queueRouter);

// QR Code route
app.get('/api/queue/qr', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://i-smartqueue.onrender.com';
    const qrCodeUrl = await QRCode.toDataURL(`${baseUrl}/qr`);
    console.log('Serving QR Code URL:', qrCodeUrl);
    res.json({ qrCode: qrCodeUrl });
  } catch (err) {
    console.error('QR Code generation error:', err);
    // On error, return a default QR code
    res.json({ qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' });
  }
});

// Routes for HTML pages
app.get('/register', (req, res) => {
  try {
    const filePath = path.join(clientDir, 'register.html');
    console.log('Serving register.html from:', filePath);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error serving register.html:', err);
        res.redirect('/');
      }
    });
  } catch (err) {
    console.error('Error in /register route:', err);
    res.redirect('/');
  }
});

app.get('/confirmation', (req, res) => {
  try {
    const filePath = path.join(clientDir, 'confirmation.html');
    console.log('Serving confirmation.html from:', filePath);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error serving confirmation.html:', err);
        res.redirect('/');
      }
    });
  } catch (err) {
    console.error('Error in /confirmation route:', err);
    res.redirect('/');
  }
});

// Root route - serve index.html
app.get('/', (req, res) => {
  try {
    const filePath = path.join(clientDir, 'index.html');
    console.log('Serving index.html from:', filePath);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(200).send(''); // Send empty response if all else fails
      }
    });
  } catch (err) {
    console.error('Error in root route:', err);
    res.status(200).send(''); // Send empty response if all else fails
  }
});

// Serve the main QR code page
app.get('/qr', (req, res) => {
  try {
    const filePath = path.join(clientDir, 'index.html');
    console.log('Serving QR code page from:', filePath);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error serving QR code page:', err);
        res.redirect('/');
      }
    });
  } catch (err) {
    console.error('Error in /qr route:', err);
    res.redirect('/');
  }
});

// Set your Python Render service URL here
const pythonServiceUrl = 'https://peopledetection-sk8w.onrender.com';

// Proxy /detection/feed as a raw stream (for the live video feed)
app.get('/detection/feed', (req, res) => {
  console.log(`Proxying to Python Render service at ${pythonServiceUrl}/feed`);
  proxy.web(req, res, {
    target: `${pythonServiceUrl}/feed`,
    ws: true
  }, (err) => {
    console.error('Proxy error:', err);
    const indexPath = path.join(clientDir, 'index.html');
    res.sendFile(indexPath);
  });
});

// Proxy all other /detection/* requests to Python Render service
console.log(`Setting up proxy to Python Render service at ${pythonServiceUrl}`);
app.use('/detection', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  pathRewrite: { '^/detection': '' },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    const indexPath = path.join(clientDir, 'index.html');
    res.sendFile(indexPath);
  }
}));

// All routes should serve index.html for SPA
app.get('*', (req, res) => {
  // Don't handle /detection routes
  if (req.path.startsWith('/detection')) {
    return next();
  }
  
  // Always serve index.html
  const indexPath = path.join(clientDir, 'index.html');
  console.log(`Serving index.html for path: ${req.path} from ${req.ip}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`Error serving index.html for ${req.path}:`, err);
      // Send empty response if all else fails
      res.status(200).send('');
    }
  });
});

// Start Node.js server after Python server is ready
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