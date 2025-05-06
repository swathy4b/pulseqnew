const express = require('express');
const Queue = require('../models/Queue');
const router = express.Router();
const crypto = require('crypto');

// Generate a random secret key
function generateSecretKey() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Get current queue position
async function getNextPosition() {
  const lastItem = await Queue.findOne().sort({ position: -1 });
  return lastItem ? lastItem.position + 1 : 1;
}

// Get current queue
router.get('/', async (req, res) => {
  try {
    const queue = await Queue.find();
    console.log('Fetching queue:', queue);
    res.json(queue);
  } catch (err) {
    console.error('Queue fetch error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Join queue
router.post('/join', async (req, res) => {
  try {
    const { name, phone, priority, notification } = req.body;
    const position = await getNextPosition();
    const secretKey = generateSecretKey();

    const queueItem = new Queue({
      name,
      phone,
      priority: priority || 'none',
      notification: notification !== false,
      secretKey,
      position
    });

    await queueItem.save();

    // Emit notification to all clients
    req.app.get('io').emit('queueUpdate', {
      type: 'join',
      item: queueItem,
      message: `New person joined the queue. Position: ${position}`
    });

    res.json({
      success: true,
      data: {
        position,
        secretKey,
        message: `You have been added to the queue. Your position is ${position} and your secret key is ${secretKey}. Please keep this key safe.`
      }
    });
  } catch (error) {
    console.error('Join queue error:', error);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// Get individual queue status
router.get('/status/:id', async (req, res) => {
  try {
    const queueItem = await Queue.findById(req.params.id);
    
    if (!queueItem) {
      return res.status(404).json({ message: 'Queue item not found' });
    }
    
    let waitingItems;
    if (queueItem.priority !== 'none') {
      waitingItems = await Queue.find({
        status: 'waiting',
        priority: queueItem.priority,
        joinTime: { $lte: queueItem.joinTime }
      }).sort({ joinTime: 1 });
    } else {
      waitingItems = await Queue.find({
        status: 'waiting',
        priority: 'none',
        joinTime: { $lte: queueItem.joinTime }
      }).sort({ joinTime: 1 });
      const priorityCount = await Queue.countDocuments({
        status: 'waiting',
        priority: { $ne: 'none' }
      });
      const regularPosition = waitingItems.findIndex(item => item._id.toString() === queueItem._id.toString()) + 1;
      const position = priorityCount + regularPosition;
      const estimatedWaitMinutes = position * 5;
      return res.json({
        ...queueItem.toObject(),
        position,
        estimatedWaitMinutes
      });
    }
    
    const position = waitingItems.findIndex(item => item._id.toString() === queueItem._id.toString()) + 1;
    const estimatedWaitMinutes = position * 5;
    
    res.json({
      ...queueItem.toObject(),
      position,
      estimatedWaitMinutes
    });
  } catch (err) {
    console.error('Queue status error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Process next in queue
router.post('/process-next', async (req, res) => {
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
      // Emit notification to all clients
      req.app.get('io').emit('queueUpdate', {
        type: 'process',
        item,
        message: `Processing position ${item.position}. Secret key: ${item.secretKey}`
      });

      // Send specific notification to the person being processed
      req.app.get('io').emit('personalNotification', {
        secretKey: item.secretKey,
        message: `It's your turn! Please proceed to the counter.`
      });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Process next error:', error);
    res.status(500).json({ error: 'Failed to process next in queue' });
  }
});

// Mark as completed
router.post('/complete/:id', async (req, res) => {
  try {
    const completedItem = await Queue.findByIdAndUpdate(
      req.params.id,
      { status: 'completed' },
      { new: true }
    );
    
    console.log('Completed:', completedItem);
    const io = req.app.get('io');
    if (io) {
      io.emit('queueUpdate', await Queue.find());
    }
    
    res.json(completedItem || {});
  } catch (err) {
    console.error('Complete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Clear queue
router.delete('/clear', async (req, res) => {
  try {
    await Queue.deleteMany({});
    console.log('Queue cleared');
    const io = req.app.get('io');
    if (io) {
      io.emit('queueUpdate', []);
    }
    
    res.json({ message: 'Queue cleared' });
  } catch (err) {
    console.error('Clear queue error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Evacuate queue
router.post('/evacuate', async (req, res) => {
  try {
    const waitingItems = await Queue.find({ status: 'waiting' });
    
    // Send evacuation notification to all waiting people
    waitingItems.forEach(item => {
      if (item.notification) {
        req.app.get('io').emit('personalNotification', {
          secretKey: item.secretKey,
          message: 'EMERGENCY: Please evacuate the premises immediately!'
        });
      }
    });

    // Clear the queue
    await Queue.deleteMany({});
    
    // Emit notification to all clients
    req.app.get('io').emit('queueUpdate', {
      type: 'evacuate',
      message: 'Queue has been evacuated due to emergency'
    });

    res.json({ success: true, message: 'Queue evacuated successfully' });
  } catch (error) {
    console.error('Evacuate queue error:', error);
    res.status(500).json({ error: 'Failed to evacuate queue' });
  }
});

// Get queue status
router.get('/status', async (req, res) => {
  try {
    const queue = await Queue.find().sort({ position: 1 });
    res.json({ success: true, data: queue });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

module.exports = router;