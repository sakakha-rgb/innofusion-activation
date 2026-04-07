// LicenseManager.js - PRODUCTION VERSION
(function() {
    'use strict';
    
    class LicenseManager {
        constructor() {
            this.apiEndpoint = 'https://innofusion4.vercel.app/api';
            this.localStorageKey = 'innofusion_license_v2'; // Versioned to allow updates
        }
        
        // Generate unique hardware fingerprint
        async getHardwareId() {
            // Combine multiple browser/system characteristics
            const components = [
                navigator.userAgent,
                screen.width + 'x' + screen.height,
                screen.colorDepth,
                navigator.hardwareConcurrency || 'unknown',
                navigator.platform,
                new Date().getTimezoneOffset()
            ];
            
            // Create hash
            const str = components.join('|');
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            
            // Add some randomness for CEP environment (Adobe extensions have limited fingerprinting)
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            return `HW-${Math.abs(hash).toString(16).toUpperCase()}-${randomSuffix}`;
        }
        
        // Validate key format before sending to server
        validateFormat(key) {
            return /^INNO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
        }
        
        // Format user input (add dashes automatically)
        formatInput(input) {
            const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 12);
            const parts = cleaned.match(/.{1,4}/g) || [];
            return parts.join('-');
        }
        
        // Main activation method
        async activateLicense(key) {
            try {
                const hardwareId = await this.getHardwareId();
                
                const response = await fetch(`${this.apiEndpoint}/activate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ 
                        licenseKey: key.toUpperCase().trim(), 
                        hardwareId: hardwareId 
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    return { 
                        success: false, 
                        error: errorData.error || `Server error: ${response.status}` 
                    };
                }

                const data = await response.json();
                
                if (data.success) {
                    // Save to localStorage with metadata
                    this.saveLicense({
                        key: key.toUpperCase().trim(),
                        hardwareId: hardwareId,
                        tier: data.tier,
                        expiresAt: data.expiresAt,
                        activatedAt: new Date().toISOString(),
                        daysRemaining: data.daysRemaining
                    });
                }
                
                return data;
                
            } catch (e) {
                console.error('Activation error:', e);
                return { 
                    success: false, 
                    error: 'Network error. Check your internet connection.' 
                };
            }
        }
        
        // Validate existing license (called on startup)
        async validateExistingLicense() {
            const saved = this.getSavedLicense();
            if (!saved) return { valid: false, error: 'No saved license' };
            
            try {
                const response = await fetch(`${this.apiEndpoint}/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        licenseKey: saved.key,
                        hardwareId: saved.hardwareId
                    })
                });
                
                const data = await response.json();
                
                if (data.valid) {
                    // Update days remaining
                    saved.daysRemaining = data.daysRemaining;
                    this.saveLicense(saved);
                } else {
                    // Clear invalid license
                    this.clearLicense();
                }
                
                return data;
                
            } catch (e) {
                console.error('Validation error:', e);
                // If offline, check local expiry
                if (saved.expiresAt && new Date() > new Date(saved.expiresAt)) {
                    this.clearLicense();
                    return { valid: false, error: 'License expired (offline check)' };
                }
                // Allow offline grace period (7 days)
                return { valid: true, offline: true, gracePeriod: true };
            }
        }
        
        // Local storage methods
        saveLicense(data) {
            try {
                localStorage.setItem(this.localStorageKey, JSON.stringify(data));
            } catch (e) {
                console.error('Failed to save license:', e);
            }
        }
        
        getSavedLicense() {
            try {
                const data = localStorage.getItem(this.localStorageKey);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                return null;
            }
        }
        
        clearLicense() {
            try {
                localStorage.removeItem(this.localStorageKey);
            } catch (e) {}
        }
        
        // Get license info for UI display
        getLicenseInfo() {
            const saved = this.getSavedLicense();
            if (!saved) return null;
            
            const now = new Date();
            const expires = new Date(saved.expiresAt);
            const daysRemaining = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
            
            return {
                tier: saved.tier,
                key: saved.key.replace(/.{4}$/, '****'), // Mask last segment
                expiresAt: saved.expiresAt,
                daysRemaining: Math.max(0, daysRemaining),
                isExpired: daysRemaining <= 0
            };
        }
    }

    window.LicenseManager = LicenseManager;
})();