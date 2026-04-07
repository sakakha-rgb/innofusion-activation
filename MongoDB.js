// MongoDB seed - FIXED v1.1.0
// Run this in MongoDB Compass shell or mongosh

// ✅ Keys follow format: INNO-XXXX-XXXX-XXXX (4-char segments, uppercase alphanumeric)
// ✅ Status is 'active' (not yet bound to a device) — activate.js will flip to 'used' on first use

db.licenses.insertMany([
    {
        licenseKey: "INNO-TEST-1234-5678",
        tier: "PRO",
        status: "active",          // 'active' = not yet bound to a device
        hardwareId: null,          // ✅ null until first activation
        activatedAt: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        maxActivations: 1,
        activations: [],
        notes: "Test key for development"
    },
    {
        licenseKey: "INNO-MONT-H202-4DEM",
        tier: "MONTHLY",
        status: "active",
        hardwareId: null,
        activatedAt: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        maxActivations: 2,
        activations: [],
        notes: "Monthly subscription demo"
    },
    {
        licenseKey: "INNO-DEMO-TEST-0000",
        tier: "DEMO",
        status: "active",
        hardwareId: null,
        activatedAt: null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        maxActivations: 999,
        activations: [],
        notes: "Public demo key"
    }
])
