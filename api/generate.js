// api/generate.js - Generate new license keys (protected)
const { connectToDatabase } = require('../lib/db');

// Generate random key: INNO-XXXX-XXXX-XXXX
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, I, 1
  let result = 'INNO-';
  
  for (let segment = 0; segment < 3; segment++) {
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (segment < 2) result += '-';
  }
  
  return result;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth - check admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers.authorization?.replace('Bearer ', '');
  
  if (!adminSecret || providedSecret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      count = 1,
      tier = 'PRO',
      months = 12,
      maxActivations = 1,
      notes = ''
    } = req.body;

    const db = await connectToDatabase();
    const licenses = db.collection('licenses');

    const generated = [];
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + parseInt(months));

    for (let i = 0; i < count; i++) {
      let key;
      let exists = true;
      
      // Ensure unique
      while (exists) {
        key = generateKey();
        exists = await licenses.findOne({ licenseKey: key });
      }

      const doc = {
        licenseKey: key,
        tier,
        status: 'active',
        createdAt: now,
        expiresAt,
        maxActivations: parseInt(maxActivations),
        activations: [],
        hardwareId: null,
        activatedAt: null,
        notes,
        metadata: {
          generatedBy: 'admin',
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
        }
      };

      await licenses.insertOne(doc);
      generated.push({
        key,
        tier,
        expiresAt: expiresAt.toISOString().split('T')[0],
        maxActivations: parseInt(maxActivations)
      });
    }

    res.json({
      success: true,
      generated: generated.length,
      keys: generated
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};