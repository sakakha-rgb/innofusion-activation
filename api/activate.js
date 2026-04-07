const { connectToDatabase } = require('../lib/db');

// CORS headers helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  // Set CORS headers for ALL requests
  setCorsHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { licenseKey, hardwareId } = req.body;

    // Validation
    if (!licenseKey || !hardwareId) {
      return res.status(400).json({
        success: false,
        error: 'Missing licenseKey or hardwareId'
      });
    }

    // Validate format: INNO-XXXX-XXXX-XXXX
    const keyFormat = /^INNO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyFormat.test(licenseKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key format. Expected: INNO-XXXX-XXXX-XXXX'
      });
    }

    const db = await connectToDatabase();
    const licenses = db.collection('licenses');

    // Find license (case-insensitive)
    const license = await licenses.findOne({
      licenseKey: licenseKey.toUpperCase()
    });

    // CASE 1: Not found
    if (!license) {
      return res.status(404).json({
        success: false,
        error: 'License key not found'
      });
    }

    // CASE 2: Expired
    const now = new Date();
    if (now > new Date(license.expiresAt)) {
      await licenses.updateOne(
        { _id: license._id },
        { $set: { status: 'expired' } }
      );
      return res.status(403).json({
        success: false,
        error: 'License expired'
      });
    }

    // CASE 3: Revoked
    if (license.status === 'revoked') {
      return res.status(403).json({
        success: false,
        error: 'License revoked'
      });
    }

    // CASE 4: Already activated on THIS computer (re-validation)
    if (license.hardwareId === hardwareId) {
      const daysRemaining = Math.ceil(
        (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
      );
      return res.json({
        success: true,
        message: 'License validated',
        tier: license.tier,
        expiresAt: license.expiresAt,
        daysRemaining: daysRemaining,
        isReactivation: true
      });
    }

    // CASE 5: Already used on DIFFERENT computer
    if (license.status === 'used' && license.hardwareId !== hardwareId) {
      return res.status(403).json({
        success: false,
        error: 'License already activated on another device'
      });
    }

    // CASE 6: Fresh activation
    await licenses.updateOne(
      { _id: license._id },
      {
        $set: {
          status: 'used',
          hardwareId: hardwareId,
          activatedAt: new Date()
        }
      }
    );

    const daysRemaining = Math.ceil(
      (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
    );

    return res.json({
      success: true,
      message: 'License activated successfully',
      tier: license.tier,
      expiresAt: license.expiresAt,
      daysRemaining: daysRemaining
    });

  } catch (error) {
    console.error('Activation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};