// PremiereBridge.js
(function() {
    'use strict';

    class PremiereBridge {
        constructor() {
            this.csInterface = null;
            try {
                if (typeof CSInterface !== 'undefined') {
                    this.csInterface = new CSInterface();
                    console.log('PremiereBridge: CSInterface ready');
                } else {
                    console.warn('PremiereBridge: CSInterface missing');
                }
            } catch (e) {
                console.warn('PremiereBridge init failed:', e);
            }
        }

        // Core evalScript — always resolves, never hangs
        evalScript(script) {
            return new Promise((resolve) => {
                // Safety timeout: if CEP never calls back, resolve after 10s
                let settled = false;
                const timer = setTimeout(function() {
                    if (!settled) {
                        settled = true;
                        console.error('evalScript timeout for:', script.substring(0, 80));
                        resolve(JSON.stringify({ success: false, message: 'evalScript timed out after 10s' }));
                    }
                }, 10000);

                if (!this.csInterface) {
                    clearTimeout(timer);
                    settled = true;
                    resolve(JSON.stringify({ success: false, message: 'CSInterface not available' }));
                    return;
                }

                try {
                    this.csInterface.evalScript(script, function(result) {
                        if (!settled) {
                            settled = true;
                            clearTimeout(timer);
                            resolve(result);
                        }
                    });
                } catch (e) {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve(JSON.stringify({ success: false, message: e.toString() }));
                    }
                }
            });
        }

        // Parse a JSON result string safely
        _parse(result) {
            if (!result || result === 'undefined' || result === 'null') {
                return { success: false, message: 'Empty response from JSX' };
            }
            if (typeof result === 'string' && result.indexOf('EvalScript error:') === 0) {
                return { success: false, message: result };
            }
            try {
                return JSON.parse(result);
            } catch (e) {
                return { success: false, message: result };
            }
        }

        async test() {
            const raw = await this.evalScript('Innofusion.test()');
            return this._parse(raw);
        }

        async checkFile(filePath) {
            const escaped = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const raw = await this.evalScript('Innofusion.checkFile("' + escaped + '")');
            return this._parse(raw);
        }

        async getPlayheadTime() {
            const raw = await this.evalScript('Innofusion.getPlayheadTime()');
            return this._parse(raw);
        }

        // importMogrt — clean, no Promise(async) anti-pattern
        async importMogrt(filePath) {
            const escaped = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            // vidTrackOffset=0 (V1), audTrackOffset=0 (A1)
            const script = 'Innofusion.importMogrt("' + escaped + '", 0, 0)';
            console.log('[PremiereBridge] importMogrt script:', script);
            const raw = await this.evalScript(script);
            console.log('[PremiereBridge] importMogrt result:', raw);
            return this._parse(raw);
        }

        openURL(url) {
            try {
                if (this.csInterface && this.csInterface.openURLInDefaultBrowser) {
                    this.csInterface.openURLInDefaultBrowser(url);
                } else {
                    window.open(url);
                }
            } catch (e) {
                window.open(url);
            }
        }
    }

    window.PremiereBridge = PremiereBridge;
    console.log('✓ PremiereBridge loaded');
})();
