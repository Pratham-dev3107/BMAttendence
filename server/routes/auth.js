import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.findUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Return clean user object (omit password)
  const { password: _, ...cleanUser } = user;
  res.json({
    success: true,
    user: cleanUser
  });
});

export default router;

