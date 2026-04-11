const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  vehicleName: {
    type: String,
    required: true,
    trim: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    trim: true
  },
  telephoneNumber: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        return /^\+233\d{9}$/.test(v);
      },
      message: 'Telephone number must be a valid Ghanaian number (+233XXXXXXXXX)'
    }
  },
  chassisNumber: {
    type: String,
    required: true,
    trim: true
  },
  pc: {
    type: String,
    required: true,
    trim: true
  },
  expiryDate: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cleared', 'deleted'],
    default: 'active'
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

recordSchema.index({ vehicleNumber: 1 });
recordSchema.index({ status: 1 });
recordSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Record', recordSchema);
