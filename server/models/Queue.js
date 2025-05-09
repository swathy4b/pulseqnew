const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  status: {
    type: String,
    enum: ['waiting', 'processing', 'completed'],
    default: 'waiting'
  },
  priority: {
    type: String,
    enum: ['none', 'elderly', 'pregnant', 'disabled'],
    default: 'none'
  },
  notification: { type: Boolean, default: true },
  secretKey: { type: String, required: true },
  position: { type: Number, required: true },
  queueNumber: { type: Number, required: true },
  joinTime: { type: Date, default: Date.now },
  notified: {
    type: Boolean,
    default: false
  },
  completedNotified: {
    type: Boolean,
    default: false
  }
});

// Auto-generate queue number before saving
queueSchema.pre('save', async function(next) {
  try {
    if (!this.queueNumber) {
      const highestQueue = await this.constructor.findOne({}, { queueNumber: 1 })
        .sort({ queueNumber: -1 })
        .limit(1);
      this.queueNumber = highestQueue ? highestQueue.queueNumber + 1 : 1;
    }
    if (!this.position) {
      const highestPosition = await this.constructor.findOne({}, { position: 1 })
        .sort({ position: -1 })
        .limit(1);
      this.position = highestPosition ? highestPosition.position + 1 : 1;
    }
    next();
  } catch (error) {
    console.error('Error in queue pre-save:', error);
    next(error);
  }
});

module.exports = mongoose.model('Queue', queueSchema);
