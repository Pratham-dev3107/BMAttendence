import express from 'express';
import os from 'os';
import { db } from '../db.js';

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.json(db.getSettings());
});

// PUT /api/settings
router.put('/', (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// GET /api/settings/network-ip - Helper for mobile connection
router.get('/network-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (e.g. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  const primaryIp = addresses.length > 0 ? addresses[0] : 'localhost';
  const port = process.env.PORT || 5000;
  res.json({
    ip: primaryIp,
    addresses,
    mobileUrl: `http://${primaryIp}:${port}`
  });
});

export default router;
