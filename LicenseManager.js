(function() {
    'use strict';

    class LicenseManager {
        constructor() {
            this.apiEndpoint = 'https://innofusion-activation.vercel.app/api';
            this.localStorageKey = 'innofusion_license_v2';
            console.log('[LicenseManager] Initialized');
            console.log('[LicenseManager] Endpoint:', this.apiEndpoint);
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

        // Test if API is reachable
        async testConnection() {
            try {
                const response = await fetch(this.apiEndpoint + '/activate', {
                    method: 'GET',
                    mode: 'cors'
                });
                console.log('[LicenseManager] Connection test:', response.status);
                return true;
            } catch (e) {
                console.error('[LicenseManager] Connection test failed:', e.message);
                return false;
            }
        }

        async activateLicense(key) {
            try {
                const hardwareId = await this.getHardwareId();
                console.log('[LicenseManager] Activating:', key);
                console.log('[LicenseManager] Hardware ID:', hardwareId);

                const url = this.apiEndpoint + '/activate';
                const payload = { licenseKey: key, hardwareId: hardwareId };
                
                console.log('[LicenseManager] POST to:', url);
                console.log('[LicenseManager] Payload:', JSON.stringify(payload));

                // Try fetch with explicit CORS mode
                let response;
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        mode: 'cors',  // Explicit CORS mode
                        cache: 'no-cache',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(payload)
                    });
                    console.log('[LicenseManager] Fetch response status:', response.status);
                } catch (fetchError) {
                    console.warn('[LicenseManager] Fetch failed:', fetchError.message);
                    console.log('[LicenseManager] Trying XHR fallback...');
                    
                    // XHR Fallback
                    response = await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', url, true);
                        xhr.setRequestHeader('Content-Type', 'application/json');
                        xhr.timeout = 10000;
                        
                        xhr.onload = function() {
                            console.log('[LicenseManager] XHR status:', xhr.status);
                            resolve({
                                status: xhr.status,
                                json: () => Promise.resolve(JSON.parse(xhr.responseText))
                            });
                        };
                        
                        xhr.onerror = function(e) {
                            console.error('[LicenseManager] XHR error:', e);
                            reject(new Error('Cannot connect to server. Check if URL is correct and server is running.'));
                        };
                        
                        xhr.ontimeout = function() {
                            reject(new Error('Request timeout'));
                        };
                        
                        xhr.send(JSON.stringify(payload));
                    });
                }

                if (!response) {
                    throw new Error('No response from server');
                }

                const data = await response.json();
                console.log('[LicenseManager] Response:', data);

                if (data.success) {
                    this.saveLicense({
                        key: key,
                        hardwareId: hardwareId,
                        tier: data.tier,
                        expiresAt: data.expiresAt,
                        activatedAt: new Date().toISOString(),
                        daysRemaining: data.daysRemaining
                    });
                }

                return data;

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
                console.log('[LicenseManager] License saved');
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