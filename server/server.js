const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const Queue = require('./models/Queue');
const queueRouter = require('./routes/queue');

const app = express();
const port = 3000;

// Middleware
app.use(cors({
  origin: `http://${require('ip').address()}:${port}`, // Dynamic CORS origin
  methods: ['GET', 'POST', 'DELETE']
}));
app.use(express.json());

// Serve static files from the client folder
app.use(express.static('D:/i-smartqueue/client'));

// API Routes - MUST be defined BEFORE the catch-all route
app.use('/api/queue', queueRouter);

// QR Code route - MUST be defined BEFORE the catch-all route
// This route isn't in queueRouter, so we need to define it separately
app.get('/api/queue/qr', async (req, res) => {
  try {
    const ip = require('ip');
    const address = ip.address() + ':' + port;
    // Changed this to point to the registration page
    const qrCodeUrl = await QRCode.toDataURL(`http://${address}/register`);
    console.log('Serving QR Code URL:', qrCodeUrl);
    res.json({ qrCode: qrCodeUrl });
  } catch (err) {
    console.error('QR Code generation error:', err);
    res.status(500).send('Error generating QR code');
  }
});

// New route for registration page
app.get('/register', (req, res) => {
  console.log('Serving register.html from:', 'D:/i-smartqueue/client/register.html');
  res.sendFile('D:/i-smartqueue/client/register.html');
});

// New route for confirmation page
app.get('/confirmation', (req, res) => {
  console.log('Serving confirmation.html from:', 'D:/i-smartqueue/client/confirmation.html');
  res.sendFile('D:/i-smartqueue/client/confirmation.html');
});

// Serve index.html as the default route
app.get('/', (req, res) => {
  console.log('Serving index.html from:', 'D:/i-smartqueue/client/index.html');
  res.sendFile('D:/i-smartqueue/client/index.html');
});

// Catch-all for undefined routes - MUST be the LAST route defined
app.get('*', (req, res) => {
  console.log(`404 Error for path: ${req.path} from ${req.ip}`);
  res.status(404).send('Page not found. Please use the root URL.');
});

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/ismartqueue')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.IO
const server = app.listen(port, () => {
  const ip = require('ip');
  const address = ip.address() + ':' + port;
  console.log(`Server running on port ${port} at http://${address}`);
});

const io = new Server(server, {
  cors: {
    origin: `http://${require('ip').address()}:${port}`, // Allow CORS from the dynamic IP
    methods: ['GET', 'POST']
  }
});

// Make io available to the routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinQueue', async (data) => {
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
  });

  socket.on('processNext', async () => {
    // First check for priority customers
    let item = await Queue.findOneAndUpdate(
      { status: 'waiting', priority: { $ne: 'none' } },
      { status: 'processing' },
      { new: true, sort: { joinTime: 1 } }
    );
    
    // If no priority customers, get the next person by join time
    if (!item) {
      item = await Queue.findOneAndUpdate(
        { status: 'waiting' },
        { status: 'processing' },
        { new: true, sort: { joinTime: 1 } }
      );
    }
    
    if (item) io.emit('queueUpdate', await Queue.find());
  });

  socket.on('clearQueue', async () => {
    await Queue.deleteMany({});
    io.emit('queueUpdate', []);
  });

  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
  });
});