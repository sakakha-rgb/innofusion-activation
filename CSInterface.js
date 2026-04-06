/**
 * CSInterface - Adobe CEP Communication Layer
 * Version 11.0 (for Premiere Pro 2021+)
 * FIXED VERSION with null checks
 */

(function() {
    'use strict';
    
    // Wait for CEP to be ready
    function CSInterface() {
        // Check if CEP is available
        if (typeof window.__adobe_cep__ === 'undefined' || !window.__adobe_cep__) {
            console.warn('CSInterface: __adobe_cep__ not available');
            this.hostEnvironment = {
                appName: 'PREMIERE_PRO',
                appVersion: '2024',
                appLocale: 'en_US',
                appUILocale: 'en_US',
                appId: 'PPRO',
                isAppOnline: true,
                appSkinInfo: {
                    baseFontFamily: 'Arial',
                    baseFontSize: 12,
                    appBarBackgroundColor: {antialiasLevel: 0, color: {alpha: 255, blue: 45, green: 45, red: 45, type: 1}},
                    panelBackgroundColor: {antialiasLevel: 0, color: {alpha: 255, blue: 30, green: 30, red: 30, type: 1}}
                }
            };
            return;
        }
        
        // Safely get host environment
        try {
            var hostEnv = window.__adobe_cep__.getHostEnvironment();
            if (hostEnv) {
                this.hostEnvironment = JSON.parse(hostEnv);
            } else {
                throw new Error('getHostEnvironment returned null');
            }
        } catch (e) {
            console.warn('CSInterface: Failed to get host environment:', e);
            // Provide default mock environment
            this.hostEnvironment = {
                appName: 'PREMIERE_PRO',
                appVersion: '2024',
                appLocale: 'en_US',
                appUILocale: 'en_US',
                appId: 'PPRO',
                isAppOnline: true,
                appSkinInfo: {
                    baseFontFamily: 'Arial',
                    baseFontSize: 12,
                    appBarBackgroundColor: {antialiasLevel: 0, color: {alpha: 255, blue: 45, green: 45, red: 45, type: 1}},
                    panelBackgroundColor: {antialiasLevel: 0, color: {alpha: 255, blue: 30, green: 30, red: 30, type: 1}}
                }
            };
        }
    }

    CSInterface.prototype.evalScript = function(script, callback) {
        if (typeof window.__adobe_cep__ === 'undefined' || !window.__adobe_cep__) {
            console.warn('CSInterface.evalScript: CEP not available');
            if (callback) callback('{"success": false, "error": "CEP not available"}');
            return;
        }
        
        if (callback === null || callback === undefined) {
            callback = function(result) {};
        }
        // Guard: script must be a string — passing an object causes a silent CEP error
        if (typeof script !== 'string') {
            console.error('CSInterface.evalScript: script must be a string, got', typeof script);
            if (callback) callback('{"success": false, "error": "script must be a string"}');
            return;
        }
        try {
            window.__adobe_cep__.evalScript(script, callback);
        } catch (e) {
            console.error('CSInterface.evalScript error:', e);
            if (callback) callback('{"success": false, "error": "' + e.message + '"}');
        }
    };

    CSInterface.prototype.getSystemPath = function(pathType) {
        if (typeof window.__adobe_cep__ === 'undefined' || !window.__adobe_cep__) {
            console.warn('CSInterface.getSystemPath: CEP not available, returning mock path');
            return '/mock/' + pathType;
        }
        
        try {
            var path = window.__adobe_cep__.getSystemPath(pathType);
            if (path) {
                return decodeURI(path);
            } else {
                return '/mock/' + pathType;
            }
        } catch (e) {
            console.error('CSInterface.getSystemPath error:', e);
            return '/mock/' + pathType;
        }
    };

    CSInterface.prototype.openURLInDefaultBrowser = function(url) {
        if (typeof window.__adobe_cep__ !== 'undefined' && window.__adobe_cep__) {
            try {
                window.__adobe_cep__.openURLInDefaultBrowser(url);
                return;
            } catch (e) {
                console.warn('CSInterface.openURLInDefaultBrowser error:', e);
            }
        }
        // Fallback
        window.open(url);
    };

    CSInterface.prototype.getHostEnvironment = function() {
        return this.hostEnvironment || {
            appName: 'PREMIERE_PRO',
            appVersion: '2024'
        };
    };

    // System Path Types
    var SystemPath = {
        USER_DATA: "userData",
        COMMON_FILES: "commonFiles",
        MY_DOCUMENTS: "myDocuments",
        APPLICATION: "application",
        EXTENSION: "extension",
        HOST_APPLICATION: "hostApplication"
    };

    // Event types
    var CSEvent = function(type, scope, appId, extensionId, data) {
        this.type = type;
        this.scope = scope;
        this.appId = appId;
        this.extensionId = extensionId;
        this.data = data;
    };

    CSInterface.prototype.dispatchEvent = function(event) {
        if (typeof window.__adobe_cep__ !== 'undefined' && window.__adobe_cep__) {
            try {
                window.__adobe_cep__.dispatchEvent(event);
            } catch (e) {
                console.error('dispatchEvent error:', e);
            }
        }
    };

    CSInterface.prototype.addEventListener = function(type, listener, obj) {
        if (typeof window.__adobe_cep__ !== 'undefined' && window.__adobe_cep__) {
            try {
                window.__adobe_cep__.addEventListener(type, listener, obj);
            } catch (e) {
                console.error('addEventListener error:', e);
            }
        }
    };

    CSInterface.prototype.removeEventListener = function(type, listener, obj) {
        if (typeof window.__adobe_cep__ !== 'undefined' && window.__adobe_cep__) {
            try {
                window.__adobe_cep__.removeEventListener(type, listener, obj);
            } catch (e) {
                console.error('removeEventListener error:', e);
            }
        }
    };

    // Make it global
    window.CSInterface = CSInterface;
    window.SystemPath = SystemPath;
    window.CSEvent = CSEvent;
    
    console.log('CSInterface loaded successfully');
    
})();