const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const Queue = require('./models/Queue');
const queueRouter = require('./routes/queue');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'] })); // Allow all origins for now; update with Render URL later
app.use(express.json());

// Serve static files from the client folder using a relative path
app.use(express.static(path.join(__dirname, '../client')));

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

// Catch-all for undefined routes - MUST be the LAST route defined
app.get('*', (req, res) => {
  console.log(`404 Error for path: ${req.path} from ${req.ip}`);
  res.status(404).send('Page not found. Please use the root URL.');
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ismartqueue', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.IO
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for now; update with Render URL later
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
  });

  socket.on('clearQueue', async () => {
    await Queue.deleteMany({});
    io.emit('queueUpdate', []);
  });

  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
  });
});