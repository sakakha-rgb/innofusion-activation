// api/generate.js - Protected endpoint to create new licenses
const { connectToDatabase } = require('../lib/db');
const crypto = require('crypto');

// Simple admin auth (use proper auth in production!)
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,I,1)
  const segments = [];
  
  for (let i = 0; i < 3; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return `INNO-${segments.join('-')}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      count = 1,           // How many keys to generate
      tier = 'PRO',        // PRO, BASIC, MONTHLY, YEARLY
      durationMonths = 12, // How long until expiry
      maxActivations = 1,  // How many computers can use this key
      notes = ''           // Optional notes (customer email, order ID, etc.)
    } = req.body;

    const db = await connectToDatabase();
    const licenses = db.collection('licenses');

    const generatedKeys = [];
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + parseInt(durationMonths));

    for (let i = 0; i < count; i++) {
      let key;
      let exists = true;
      
      // Ensure unique key
      while (exists) {
        key = generateLicenseKey();
        exists = await licenses.findOne({ licenseKey: key });
      }

      const licenseDoc = {
        licenseKey: key,
        tier,
        status: 'active', // Not used yet
        createdAt: now,
        expiresAt,
        maxActivations: parseInt(maxActivations),
        activations: [],
        hardwareId: null,
        activatedAt: null,
        notes,
        metadata: {
          generatedBy: 'admin',
          generationIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        }
      };

      await licenses.insertOne(licenseDoc);
      generatedKeys.push({
        key,
        tier,
        expiresAt,
        maxActivations
      });
    }

    res.json({
      success: true,
      generated: generatedKeys.length,
      keys: generatedKeys
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};