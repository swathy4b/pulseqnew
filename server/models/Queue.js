const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  status: { type: String, enum: ['waiting', 'processing', 'completed'], default: 'waiting' },
  joinTime: { type: Date, default: Date.now },
  queueNumber: { type: Number }, 
  priority: { 
    type: String, 
    enum: ['none', 'elderly', 'disability', 'pregnant', 'children'], 
    default: 'none' 
  },
  notification: { type: Boolean, default: false }
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