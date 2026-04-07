// admin-generate.js - Run this with Node.js to generate keys
const fetch = require('node-fetch');

const VERCEL_URL = 'https://innofusion4.vercel.app';
const ADMIN_SECRET = 'your-admin-secret-here'; // Set this in Vercel env vars

async function generateLicenses(count = 10, tier = 'PRO', months = 12) {
    const response = await fetch(`${VERCEL_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ADMIN_SECRET}`
        },
        body: JSON.stringify({
            count,
            tier,
            durationMonths: months,
            maxActivations: 1,
            notes: 'Generated via admin script'
        })
    });
    
    const data = await response.json();
    
    if (data.success) {
        console.log(`\n✅ Generated ${data.generated} ${tier} licenses (${months} months):\n`);
        data.keys.forEach((k, i) => {
            console.log(`${i + 1}. ${k.key} (expires: ${new Date(k.expiresAt).toLocaleDateString()})`);
        });
        
        // Save to file
        const fs = require('fs');
        const filename = `licenses-${tier}-${Date.now()}.txt`;
        const content = data.keys.map(k => k.key).join('\n');
        fs.writeFileSync(filename, content);
        console.log(`\n💾 Saved to ${filename}`);
    } else {
        console.error('Error:', data.error);
    }
}

// Generate 5 PRO yearly licenses
generateLicenses(5, 'PRO', 12);

// Generate 10 MONTHLY licenses
// generateLicenses(10, 'MONTHLY', 1);