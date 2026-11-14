import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET /api/workers - List all workers
router.get('/', async (req, res) => {
  const workers = await db.getWorkers();
  res.json(workers);
});

// POST /api/workers - Add new worker
router.post('/', async (req, res) => {
  try {
    const { name, phone, department, designation, wageType, rate, photo } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Worker name is required' });
    }

    const workers = await db.getWorkers();
    // Auto-generate ID: KRA-101, KRA-102, ...
    let nextNumber = 101;
    const existingNums = workers
      .map(w => {
        const match = (w.id || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));

    if (existingNums.length > 0) {
      nextNumber = Math.max(...existingNums) + 1;
    }
    const id = `KRA-${nextNumber}`;

    const newWorker = {
      id,
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      department: department ? department.trim() : 'General',
      designation: designation ? designation.trim() : 'Worker',
      wageType: wageType || 'daily',
      rate: Number(rate) || 0,
      photo: photo || '',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    await db.addWorker(newWorker);
    res.status(201).json(newWorker);
  } catch (err) {
    console.error('Create worker error:', err);
    res.status(500).json({ error: err.message || 'Failed to create worker' });
  }
});

// PUT /api/workers/:id - Update worker
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = await db.updateWorker(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  res.json(updated);
});

// DELETE /api/workers/:id - Remove or soft-delete worker
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteWorker(id);
    res.json({ message: 'Worker removed permanently from database', worker: deleted });
  } catch (err) {
    console.error('Delete worker error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete worker' });
  }
});

export default router;

