const express = require('express');
const Queue = require('../models/Queue');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');

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

    // Get the next queue number
    const highestQueue = await Queue.findOne().sort({ queueNumber: -1 });
    const nextQueueNumber = highestQueue ? highestQueue.queueNumber + 1 : 1;

    const queueItem = new Queue({
      name,
      phone,
      priority: priority || 'none',
      notification: notification !== false,
      secretKey,
      position,
      queueNumber: nextQueueNumber
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
        id: queueItem._id,
        position,
        secretKey,
        queueNumber: nextQueueNumber,
        message: `You have been added to the queue. Your position is ${position}, your queue number is ${nextQueueNumber}, and your secret key is ${secretKey}. Please keep this key safe.`
      }
    });
  } catch (error) {
    console.error('Join queue error:', error);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// Get individual queue status
router.get('/status/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid queue ID' });
  }
  try {
    const queueItem = await Queue.findById(req.params.id);
    if (!queueItem) {
      return res.status(404).json({ 
        message: 'Queue item not found',
        queueNumber: '--',
        position: '--',
        name: '--',
        phone: '--',
        joinTime: new Date(),
        estimatedWaitMinutes: '--',
        totalInQueue: 0
      });
    }

    // Calculate position based on priority
    let position;
    let totalInQueue = await Queue.countDocuments({ status: 'waiting' });

    if (queueItem.priority !== 'none') {
      // For priority customers
      const priorityQueue = await Queue.find({
        status: 'waiting',
        priority: queueItem.priority,
        joinTime: { $lte: queueItem.joinTime }
      }).sort({ joinTime: 1 });

      position = priorityQueue.findIndex(item => item._id.toString() === queueItem._id.toString()) + 1;
    } else {
      // For regular customers
      const regularQueue = await Queue.find({
        status: 'waiting',
        priority: 'none',
        joinTime: { $lte: queueItem.joinTime }
      }).sort({ joinTime: 1 });

      const priorityCount = await Queue.countDocuments({
        status: 'waiting',
        priority: { $ne: 'none' }
      });

      position = priorityCount + regularQueue.findIndex(item => item._id.toString() === queueItem._id.toString()) + 1;
    }

    // Calculate estimated wait time (5 minutes per person)
    const estimatedWaitMinutes = position * 5;

    const response = {
      ...queueItem.toObject(),
      position: position || '--',
      estimatedWaitMinutes: estimatedWaitMinutes || '--',
      totalInQueue,
      queueNumber: queueItem.queueNumber || '--',
      name: queueItem.name || '--',
      phone: queueItem.phone || '--',
      joinTime: queueItem.joinTime || new Date(),
      status: queueItem.status || 'waiting'
    };

    res.json(response);
  } catch (err) {
    console.error('Queue status error:', err);
    res.status(500).json({ 
      message: err.message,
      queueNumber: '--',
      position: '--',
      name: '--',
      phone: '--',
      joinTime: new Date(),
      estimatedWaitMinutes: '--',
      totalInQueue: 0
    });
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
      req.app.get('io').emit('queueUpdate', {
        type: 'process',
        item,
        message: `Processing queue number ${item.queueNumber}. Secret key: ${item.secretKey}`
      });
      req.app.get('io').emit('personalNotification', {
        secretKey: item.secretKey,
        message: `It's your turn! Please proceed to the counter.`
      });
      return res.json({ success: true, data: item });
    } else {
      // No one to process
      return res.status(400).json({ success: false, error: 'No one is waiting in the queue to process.' });
    }
  } catch (error) {
    console.error('Process next error:', error);
    res.status(500).json({ success: false, error: 'Failed to process next in queue. Please try again or check the server logs.' });
  }
});

// Mark as completed
router.post('/complete/:id', async (req, res) => {
  try {
    const completedItem = await Queue.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'completed',
        completedNotified: true
      },
      { new: true }
    );

    if (completedItem) {
      req.app.get('io').emit('queueUpdate', {
        type: 'complete',
        item: completedItem,
        message: `Queue number ${completedItem.queueNumber} has been served.`
      });

      req.app.get('io').emit('personalNotification', {
        secretKey: completedItem.secretKey,
        message: `✅ Service completed! Thank you for using PulseQ.`
      });
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

    waitingItems.forEach(item => {
      if (item.notification) {
        req.app.get('io').emit('personalNotification', {
          secretKey: item.secretKey,
          message: 'EMERGENCY: Please evacuate the premises immediately!'
        });
      }
    });

    await Queue.deleteMany({});

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
