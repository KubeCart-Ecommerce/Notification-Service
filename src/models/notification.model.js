const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    type: {
      type: String,
      enum: ['order_confirmation', 'order_shipped', 'order_delivered', 'order_cancelled', 'welcome', 'password_reset', 'generic'],
      required: true,
    },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, default: '' },
    retries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

notificationLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
