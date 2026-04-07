// Use MongoDB Compass or shell to insert test licenses
db.licenses.insertMany([
    {
        licenseKey: "INNO-TEST-1234-5678",
        tier: "PRO",
        status: "active",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        maxActivations: 1,
        activations: [],
        notes: "Test key for development"
    },
    {
        licenseKey: "INNO-MONTH-2024-DEMO",
        tier: "MONTHLY",
        status: "active",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        maxActivations: 2,
        activations: [],
        notes: "Monthly subscription demo"
    }
])