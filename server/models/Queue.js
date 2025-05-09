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
  queueNumber: { type: Number, required: true }, // <-- Add this line
  joinTime: { type: Date, default: Date.now }
});

// Auto-generate queue number before saving
queueSchema.pre('save', async function(next) {
  if (!this.queueNumber) {
    try {
      const highestQueue = await this.constructor.findOne({}, { queueNumber: 1 })
        .sort({ queueNumber: -1 })
        .limit(1);
      this.queueNumber = highestQueue && highestQueue.queueNumber ? highestQueue.queueNumber + 1 : 1;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Queue', queueSchema);
