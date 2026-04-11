const express = require('express');
const Record = require('../models/Record');
const auth = require('../middleware/auth');
const router = express.Router();

// Auto-clear old active records (records from previous days become "cleared")
async function autoClearRecords() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await Record.updateMany(
    { status: 'active', createdAt: { $lt: today } },
    { $set: { status: 'cleared' } }
  );
}

// Get all records with filters
router.get('/', auth, async (req, res) => {
  try {
    await autoClearRecords();

    const { status, search, month } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (search) {
      filter.vehicleNumber = { $regex: search, $options: 'i' };
    }
    if (month && month !== 'all') {
      // MongoDB aggregation for month filtering on string date
      // Since expiryDate is stored as string YYYY-MM-DD
      const monthNum = parseInt(month);
      if (monthNum >= 1 && monthNum <= 12) {
        const monthStr = monthNum.toString().padStart(2, '0');
        filter.expiryDate = { $regex: `-${monthStr}-` };
      }
    }

    const records = await Record.find(filter).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error('Get records error:', err);
    res.status(500).json({ message: 'Server error fetching records.' });
  }
});

// Add a new record
router.post('/', auth, async (req, res) => {
  try {
    const { customerName, vehicleName, vehicleNumber, telephoneNumber, chassisNumber, pc, expiryDate } = req.body;

    if (!customerName || !vehicleName || !vehicleNumber || !telephoneNumber || !chassisNumber || !pc || !expiryDate) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (!/^\+233\d{9}$/.test(telephoneNumber)) {
      return res.status(400).json({ message: 'Invalid Ghanaian telephone number.' });
    }

    const record = new Record({
      customerName: customerName.trim(),
      vehicleName: vehicleName.trim(),
      vehicleNumber: vehicleNumber.trim(),
      telephoneNumber: telephoneNumber.trim(),
      chassisNumber: chassisNumber.trim(),
      pc: pc.trim(),
      expiryDate,
      status: 'active',
      createdBy: req.user.username
    });

    await record.save();
    res.status(201).json(record);
  } catch (err) {
    console.error('Add record error:', err);
    res.status(500).json({ message: 'Server error adding record.' });
  }
});

// Update a record
router.put('/:id', auth, async (req, res) => {
  try {
    const { customerName, vehicleName, vehicleNumber, telephoneNumber, chassisNumber, pc, expiryDate } = req.body;

    if (telephoneNumber && !/^\+233\d{9}$/.test(telephoneNumber)) {
      return res.status(400).json({ message: 'Invalid Ghanaian telephone number.' });
    }

    const record = await Record.findByIdAndUpdate(
      req.params.id,
      {
        customerName: customerName?.trim(),
        vehicleName: vehicleName?.trim(),
        vehicleNumber: vehicleNumber?.trim(),
        telephoneNumber: telephoneNumber?.trim(),
        chassisNumber: chassisNumber?.trim(),
        pc: pc?.trim(),
        expiryDate
      },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ message: 'Record not found.' });
    }
    res.json(record);
  } catch (err) {
    console.error('Update record error:', err);
    res.status(500).json({ message: 'Server error updating record.' });
  }
});

// Delete (soft) a record
router.delete('/:id', auth, async (req, res) => {
  try {
    const record = await Record.findByIdAndUpdate(
      req.params.id,
      { status: 'deleted' },
      { new: true }
    );
    if (!record) {
      return res.status(404).json({ message: 'Record not found.' });
    }
    res.json({ message: 'Record deleted.', record });
  } catch (err) {
    console.error('Delete record error:', err);
    res.status(500).json({ message: 'Server error deleting record.' });
  }
});

// Bulk status update (clear/retrieve)
router.patch('/bulk-status', auth, async (req, res) => {
  try {
    const { fromStatus, toStatus } = req.body;

    if (!['active', 'cleared', 'deleted'].includes(fromStatus) ||
        !['active', 'cleared', 'deleted'].includes(toStatus)) {
      return res.status(400).json({ message: 'Invalid status values.' });
    }

    const result = await Record.updateMany(
      { status: fromStatus },
      { $set: { status: toStatus } }
    );
    res.json({ message: `${result.modifiedCount} records updated.`, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Bulk status error:', err);
    res.status(500).json({ message: 'Server error updating records.' });
  }
});

// Get expiry reminders (within next 7 days)
router.get('/reminders', auth, async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const threshold = new Date(today);
    threshold.setDate(today.getDate() + 7);
    const thresholdStr = threshold.toISOString().slice(0, 10);

    const records = await Record.find({
      status: 'active',
      expiryDate: { $gte: todayStr, $lte: thresholdStr }
    });
    res.json(records);
  } catch (err) {
    console.error('Reminders error:', err);
    res.status(500).json({ message: 'Server error fetching reminders.' });
  }
});

// Get unique vehicle names for autocomplete
router.get('/vehicle-names', auth, async (req, res) => {
  try {
    const names = await Record.distinct('vehicleName');
    const defaultNames = [
      "Toyota Corolla", "Toyota Camry", "Toyota Hilux", "Toyota Land Cruiser",
      "Honda Civic", "Honda Accord", "Honda CR-V",
      "Hyundai Tucson", "Hyundai Elantra", "Hyundai Sonata",
      "Kia Sportage", "Kia Rio", "Kia Sorento",
      "Nissan Altima", "Nissan Patrol", "Nissan Navara",
      "Ford Ranger", "Ford Explorer", "Ford Fiesta",
      "Volkswagen Golf", "Volkswagen Passat",
      "Mercedes-Benz C-Class", "Mercedes-Benz E-Class",
      "BMW 3 Series", "BMW X5"
    ];
    const allNames = [...new Set([...defaultNames, ...names])].sort();
    res.json(allNames);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
