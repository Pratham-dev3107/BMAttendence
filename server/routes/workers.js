import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// GET /api/workers - List all workers
router.get('/', (req, res) => {
  const workers = db.getWorkers();
  res.json(workers);
});

// POST /api/workers - Add new worker
router.post('/', (req, res) => {
  const { name, phone, department, designation, wageType, rate, photo } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Worker name is required' });
  }

  const workers = db.getWorkers();
  // Auto-generate ID: KRA-101, KRA-102, ...
  let nextNumber = 101;
  const existingNums = workers
    .map(w => {
      const match = w.id.match(/\d+/);
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

  db.addWorker(newWorker);
  res.status(201).json(newWorker);
});

// PUT /api/workers/:id - Update worker
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = db.updateWorker(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  res.json(updated);
});

// DELETE /api/workers/:id - Remove or soft-delete worker
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteWorker(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  res.json({ message: 'Worker removed successfully', worker: deleted });
});

export default router;

