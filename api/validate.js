// api/validate.js - Check if license is still valid (called on plugin startup)
const { connectToDatabase } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

    // Check all conditions
    const now = new Date();
    const isValid = license && 
                    license.status === 'used' &&
                    license.hardwareId === hardwareId &&
                    now < new Date(license.expiresAt);

    if (!isValid && license && now > new Date(license.expiresAt)) {
      // Auto-update status to expired
      await db.collection('licenses').updateOne(
        { _id: license._id },
        { $set: { status: 'expired' } }
      );
    }

    res.json({
      valid: isValid,
      tier: isValid ? license.tier : null,
      expiresAt: isValid ? license.expiresAt : null,
      daysRemaining: isValid 
        ? Math.ceil((new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24))
        : 0
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
};