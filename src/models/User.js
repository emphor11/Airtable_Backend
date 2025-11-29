const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  airtableUserId: String,
  profile: Object,
  accessToken: String,
  refreshToken: String,
  lastLoginAt: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
