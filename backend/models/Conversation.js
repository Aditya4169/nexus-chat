const mongoose = require('mongoose');

const unreadCountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    count: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    groupName: { type: String, trim: true },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    unreadCounts: [unreadCountSchema]
  },
  { timestamps: true }
);

conversationSchema.pre('validate', function validateGroupFields(next) {
  if (this.type === 'group' && (!this.groupName || !this.groupAdmin)) {
    return next(new Error('Group conversations require groupName and groupAdmin.'));
  }
  if (this.type === 'direct' && (this.groupName || this.groupAdmin)) {
    return next(new Error('Direct conversations cannot have group fields.'));
  }
  return next();
});

module.exports = mongoose.model('Conversation', conversationSchema);
