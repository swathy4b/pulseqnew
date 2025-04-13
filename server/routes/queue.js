const express = require('express');
const Queue = require('../models/Queue');
const router = express.Router();

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
  const { name, phone, priority, notification } = req.body;
  
  if (!name) return res.status(400).json({ message: 'Name is required' });
  
  try {
    const queueItem = new Queue({
      name,
      phone,
      status: 'waiting',
      priority: priority || 'none',
      notification: notification || false
    });
    
    const savedItem = await queueItem.save();
    console.log('Queue item added:', savedItem);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('queueUpdate', await Queue.find());
    }
    
    res.status(201).json(savedItem);
  } catch (err) {
    console.error('Join queue error:', err);
    res.status(500).json({ message: err.message });
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

// Process next
router.post('/process', async (req, res) => {
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
    
    console.log('Processed next:', item);
    const io = req.app.get('io');
    if (io) {
      io.emit('queueUpdate', await Queue.find());
    }
    
    res.json(item || {});
  } catch (err) {
    console.error('Process next error:', err);
    res.status(500).json({ message: err.message });
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

module.exports = router;