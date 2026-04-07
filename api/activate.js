// api/activate.js - Activate a license key
const { connectToDatabase } = require('../lib/db');

module.exports = async (req, res) => {
  // CORS preflight
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

    // Find license
    const license = await licenses.findOne({ 
      licenseKey: licenseKey.toUpperCase() 
    });

    // CASE 1: License not found
    if (!license) {
      return res.status(404).json({ 
        success: false, 
        error: 'License key not found' 
      });
    }

    // CASE 2: Check expiry
    const now = new Date();
    if (now > new Date(license.expiresAt)) {
      await licenses.updateOne(
        { _id: license._id },
        { $set: { status: 'expired' } }
      );
      return res.status(403).json({ 
        success: false, 
        error: 'License expired',
        expiredAt: license.expiresAt
      });
    }

    // CASE 3: License revoked
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
      const activationCount = license.activations?.length || 0;
      
      if (activationCount >= (license.maxActivations || 1)) {
        return res.status(403).json({ 
          success: false, 
          error: 'License already activated on maximum devices',
          maxActivations: license.maxActivations || 1,
          currentActivations: activationCount
        });
      }

      // Allow additional activation
      await licenses.updateOne(
        { _id: license._id },
        { 
          $push: { 
            activations: {
              hardwareId,
              activatedAt: new Date(),
              ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
            }
          }
        }
      );

      const daysRemaining = Math.ceil(
        (new Date(license.expiresAt) - now) / (1000 * 60 * 60 * 24)
      );

      return res.json({
        success: true,
        message: 'Additional device activated',
        tier: license.tier,
        expiresAt: license.expiresAt,
        daysRemaining: daysRemaining,
        activationNumber: activationCount + 1,
        maxActivations: license.maxActivations
      });
    }

    // CASE 6: Fresh activation (first time)
    await licenses.updateOne(
      { _id: license._id },
      { 
        $set: { 
          status: 'used',
          hardwareId: hardwareId,
          activatedAt: new Date(),
          firstActivationIp: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
        },
        $push: {
          activations: {
            hardwareId,
            activatedAt: new Date(),
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
          }
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
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};