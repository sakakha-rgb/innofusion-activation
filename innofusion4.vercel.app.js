// /api/activate.js
export default async function handler(req, res) {
  const { licenseKey, hardwareId } = req.body;
  
  // Validate against database
  const license = await db.findLicense(licenseKey);
  
  if (!license || license.used) {
    return res.json({ success: false, error: 'Invalid or used license' });
  }
  
  // Activate
  await db.activateLicense(licenseKey, hardwareId);
  
  res.json({ 
    success: true, 
    tier: license.tier,
    expiresAt: license.expiresAt 
  });
}

// /api/validate.js
export default async function handler(req, res) {
  const { licenseKey, hardwareId } = req.body;
  const license = await db.findLicense(licenseKey);
  
  const valid = license && 
                license.hardwareId === hardwareId && 
                new Date() < new Date(license.expiresAt);
                
  res.json({ valid });
}