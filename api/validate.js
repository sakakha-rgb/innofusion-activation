const { connectToDatabase } = require('../lib/db');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { licenseKey, hardwareId } = req.body;
    
    if (!licenseKey || !hardwareId) {
      return res.status(400).json({ valid: false, error: 'Missing parameters' });
    }

    const db = await connectToDatabase();
    const license = await db.collection('licenses').findOne({
      licenseKey: licenseKey.toUpperCase()
    });

    const now = new Date();

    if (!license) {
      return res.json({ valid: false, error: 'License not found' });
    }

    if (now > new Date(license.expiresAt)) {
      return res.json({ valid: false, error: 'License expired' });
    }

    if (license.status === 'revoked') {
      return res.json({ valid: false, error: 'License revoked' });
    }

    if (license.hardwareId !== hardwareId) {
      return res.json({ valid: false, error: 'Wrong device' });
    }

    const daysRemaining = Math.ceil(
      (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
    );

    return res.json({
      valid: true,
      tier: license.tier,
      expiresAt: license.expiresAt,
      daysRemaining: daysRemaining
    });

  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
};