(function() {
    'use strict';

    class LicenseManager {
        constructor() {
            this.apiEndpoint = 'https://innofusion-activation.vercel.app/api';
            this.localStorageKey = 'innofusion_license_v2';
            console.log('[LicenseManager] Initialized');
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

        _post(url, payload) {
            return new Promise((resolve, reject) => {
                console.log('[LicenseManager] POST to:', url);
                
                // Try fetch first
                if (typeof fetch !== 'undefined') {
                    fetch(url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                    .then(async res => {
                        console.log('[LicenseManager] Response status:', res.status);
                        const text = await res.text();
                        console.log('[LicenseManager] Raw response:', text);
                        
                        try {
                            const data = JSON.parse(text);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Invalid JSON response: ' + text));
                        }
                    })
                    .catch(err => {
                        console.warn('[LicenseManager] Fetch failed, trying XHR:', err);
                        
                        // XHR Fallback
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', url, true);
                        xhr.setRequestHeader('Content-Type', 'application/json');
                        xhr.setRequestHeader('Accept', 'application/json');
                        xhr.timeout = 10000;
                        
                        xhr.onload = () => {
                            console.log('[LicenseManager] XHR response:', xhr.responseText);
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch(e) {
                                reject(new Error('Invalid JSON: ' + xhr.responseText));
                            }
                        };
                        
                        xhr.onerror = () => reject(new Error('Network request failed'));
                        xhr.ontimeout = () => reject(new Error('Request timeout'));
                        xhr.send(JSON.stringify(payload));
                    });
                } else {
                    reject(new Error('No HTTP client available'));
                }
            });
        }

        async activateLicense(key) {
            try {
                const hardwareId = await this.getHardwareId();
                console.log('[LicenseManager] Activating:', key, 'HW:', hardwareId);

                const data = await this._post(
                    this.apiEndpoint + '/activate',
                    { 
                        licenseKey: key, 
                        hardwareId: hardwareId 
                    }
                );

                console.log('[LicenseManager] Parsed response:', data);

                // CRITICAL FIX: Always return an object with success property
                if (!data || typeof data !== 'object') {
                    console.error('[LicenseManager] Invalid response:', data);
                    return { 
                        success: false, 
                        error: 'Invalid response from server' 
                    };
                }

                if (data.success) {
                    this.saveLicense({
                        key: key,
                        hardwareId: hardwareId,
                        tier: data.tier || 'BASIC',
                        expiresAt: data.expiresAt,
                        activatedAt: new Date().toISOString(),
                        daysRemaining: data.daysRemaining || 0
                    });
                }

                return {
                    success: !!data.success,
                    error: data.error || null,
                    tier: data.tier,
                    expiresAt: data.expiresAt,
                    daysRemaining: data.daysRemaining
                };

            } catch (e) {
                console.error('[LicenseManager] Activation error:', e);
                return { 
                    success: false, 
                    error: 'Network error: ' + e.message 
                };
            }
        }

        saveLicense(data) {
            try {
                localStorage.setItem(this.localStorageKey, JSON.stringify(data));
            } catch (e) {
                console.warn('[LicenseManager] Cannot save:', e);
            }
        }

        getSavedLicense() {
            try {
                const raw = localStorage.getItem(this.localStorageKey);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        }

        clearLicense() {
            localStorage.removeItem(this.localStorageKey);
        }
    }

    window.LicenseManager = LicenseManager;
    console.log('✓ LicenseManager loaded');
})();