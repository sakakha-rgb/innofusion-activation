const { connectToDatabase } = require('../lib/db');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // DEBUG: Log what we received
  console.log('Request body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);

  try {
    const { licenseKey, hardwareId } = req.body || {};

    // Validation with detailed error
    if (!licenseKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing licenseKey in request body' 
      });
    }
    
    if (!hardwareId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing hardwareId in request body' 
      });
    }

    // Validate format
    const keyFormat = /^INNO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!keyFormat.test(licenseKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key format. Expected: INNO-XXXX-XXXX-XXXX'
      });
    }

    // Connect to DB
    let db;
    try {
      db = await connectToDatabase();
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed'
      });
    }

    const licenses = db.collection('licenses');
    const license = await licenses.findOne({
      licenseKey: licenseKey.toUpperCase()
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        error: 'License key not found in database'
      });
    }

    const now = new Date();
    
    // Check expiry
    if (now > new Date(license.expiresAt)) {
      return res.status(403).json({
        success: false,
        error: 'License expired'
      });
    }

    // Check if already used on different device
    if (license.status === 'used' && license.hardwareId && license.hardwareId !== hardwareId) {
      return res.status(403).json({
        success: false,
        error: 'License already activated on another device'
      });
    }

    // Activate
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
      tier: license.tier,
      expiresAt: license.expiresAt,
      daysRemaining: daysRemaining
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};