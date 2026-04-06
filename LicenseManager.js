// LicenseManager.js - FIXED VERSION
(function() {
    'use strict';
    
    class LicenseManager {
        constructor() {
            this.apiEndpoint = 'https://innofusion4.vercel.app/api';
            console.log('LicenseManager initialized');
        }
        
        async getHardwareId() {
            const info = navigator.userAgent + screen.width + screen.height;
            let hash = 0;
            for (let i = 0; i < info.length; i++) {
                const char = info.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
            }
            return 'HW-' + Math.abs(hash).toString(16).toUpperCase();
        }
        
        validateFormat(key) {
            return /^INNO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
        }
        
        async activateLicense(key, hardwareId) {
            try {
                const response = await fetch(this.apiEndpoint + '/activate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ licenseKey: key, hardwareId: hardwareId })
                });
                return await response.json();
            } catch (e) {
                console.error('Activation API error:', e);
                return { success: false, error: 'Network error' };
            }
        }
    }

    // Expose to window
    window.LicenseManager = LicenseManager;
    console.log('LicenseManager class defined and exposed');
    
})();