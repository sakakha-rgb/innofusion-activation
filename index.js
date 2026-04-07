// iNNO FUSION - Main Entry Point (v2.0.0 - PRODUCTION)

(function() {
    'use strict';
    
    console.log('=== iNNO FUSION v2.0.0 ===');
    
    let csInterface = null;
    let licenseManager = null;
    let mogrtScanner = null;
    let premiereBridge = null;
    let templates = [];
    let currentFolder = 'all';
    let currentTemplate = null;

    // Demo keys ONLY for testing - remove in production build
    const DEMO_KEYS = ['INNO-DEMO-TEST-0000'];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

    function startApp() {
        console.log('Starting app...');
        
        try {
            initCSInterface();
            
            // Initialize new LicenseManager with API support
            licenseManager = new LicenseManager();
            
            mogrtScanner = new MogrtScanner();
            if (mogrtScanner.init) {
                mogrtScanner.init();
            }
            
            premiereBridge = new PremiereBridge();
            
            console.log('✓ All classes initialized');
            setupEventListeners();
            
            // Check license on startup (async)
            checkExistingLicense();
            
        } catch (e) {
            console.error('Startup error:', e);
            showFatalError(e.message || e.toString());
        }
    }

    function initCSInterface() {
        try {
            csInterface = new CSInterface();
            console.log('✓ CSInterface ready');
        } catch (e) {
            console.error('CSInterface failed:', e);
            // Mock for browser testing
            csInterface = {
                hostEnvironment: { appName: 'PREMIERE_PRO', appVersion: '2024' },
                evalScript: function(s, cb) { if (cb) cb('{"success":true}'); },
                getSystemPath: function(t) { return '/mock/' + t; },
                openURLInDefaultBrowser: function(u) { window.open(u); }
            };
        }
    }

    function showFatalError(msg) {
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.innerHTML =
                '<div style="padding:40px;color:#ff4757;text-align:center;">' +
                '<h3>Error</h3><p>' + escapeHtml(String(msg || 'Unknown error')) + '</p>' +
                '<button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;">Reload</button>' +
                '</div>';
        }
    }

    // ============================================
    // LICENSE CHECK (Updated for API validation)
    // ============================================
    async function checkExistingLicense() {
        try {
            // Check if we have a saved license
            const saved = licenseManager.getSavedLicense();
            
            if (!saved) {
                console.log('No saved license found');
                showLoginScreen();
                return;
            }

            console.log('Found saved license, validating with server...');
            
            // Validate with server (checks expiry, hardware ID, etc.)
            const validation = await licenseManager.validateExistingLicense();
            
            if (validation.valid) {
                console.log('✓ License valid:', validation.tier);
                showMainScreen();
                updateTierBadge(validation.tier || saved.tier);
                
                // Show offline warning if applicable
                if (validation.offline) {
                    showOfflineWarning(validation.daysRemaining);
                }
            } else {
                console.warn('✗ License invalid:', validation.error);
                licenseManager.clearLicense();
                showLoginScreen();
                
                // Show error message on login screen
                const error = document.getElementById('loginError');
                if (error) {
                    error.textContent = validation.error || 'License expired or invalid';
                    error.style.color = '#ff4757';
                }
            }
        } catch (e) {
            console.error('License check error:', e);
            // If check fails, allow local fallback for 7 days
            const saved = licenseManager.getSavedLicense();
            if (saved && saved.expiresAt) {
                const daysLeft = Math.ceil((new Date(saved.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft > 0) {
                    console.log('Server check failed, using local validation:', daysLeft, 'days left');
                    showMainScreen();
                    updateTierBadge(saved.tier);
                    showOfflineWarning(daysLeft);
                    return;
                }
            }
            showLoginScreen();
        }
    }

    function showOfflineWarning(days) {
        // Create subtle warning banner
        const warning = document.createElement('div');
        warning.id = 'offlineWarning';
        warning.style.cssText = 'position:fixed; top:0; left:0; right:0; background:#332d00; color:#ffcc00; padding:6px 12px; font-size:11px; text-align:center; z-index:9999;';
        warning.innerHTML = `⚠ Offline mode • ${days} days remaining • Connect to internet to verify`;
        
        // Remove existing
        const existing = document.getElementById('offlineWarning');
        if (existing) existing.remove();
        
        document.body.appendChild(warning);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            warning.style.opacity = '0';
            warning.style.transition = 'opacity 0.5s';
            setTimeout(() => warning.remove(), 500);
        }, 5000);
    }

    // ============================================
    // EVENT LISTENERS (Mostly unchanged)
    // ============================================
    function setupEventListeners() {
        document.getElementById('activateBtn')?.addEventListener('click', handleActivation);

        const licenseInput = document.getElementById('licenseKey');
        if (licenseInput) {
            licenseInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleActivation();
            });

            // Auto-format input (XXX-XXXX-XXXX-XXXX)
            licenseInput.addEventListener('input', function(e) {
                let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                let formatted = '';

                for (let i = 0; i < value.length && i < 16; i++) {
                    if (i === 4 || i === 8 || i === 12) formatted += '-';
                    formatted += value[i];
                }

                e.target.value = formatted;

                const error = document.getElementById('loginError');
                if (error) {
                    error.textContent = '';
                    error.style.color = '#ff4757';
                }
            });

            setTimeout(function() {
                licenseInput.focus();
            }, 100);
        }

        document.getElementById('autoFillDemo')?.addEventListener('click', function() {
            const input = document.getElementById('licenseKey');
            if (input) {
                input.value = DEMO_KEYS[0];
                handleActivation();
            }
        });

        document.getElementById('purchaseLink')?.addEventListener('click', function(e) {
            e.preventDefault();
            const url = 'https://innonex.co.uk/purchase';
            if (premiereBridge && premiereBridge.openURL) {
                premiereBridge.openURL(url);
            } else {
                window.open(url);
            }
        });

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('refreshBtn')?.addEventListener('click', loadTemplates);
        document.getElementById('searchInput')?.addEventListener('input', debounce(handleSearch, 300));
        document.querySelector('.close-btn')?.addEventListener('click', closeModal);
        document.getElementById('importBtn')?.addEventListener('click', importTemplate);

        // Debug shortcuts
        document.getElementById('settingsBtn')?.addEventListener('dblclick', testJSXDirect);
        document.getElementById('settingsBtn')?.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            testImportDirect();
        });
    }

    // ============================================
    // ACTIVATION (Updated for API)
    // ============================================
   async function handleActivation() {
    const keyInput = document.getElementById('licenseKey');
    const btn = document.getElementById('activateBtn');
    const error = document.getElementById('loginError');

    if (!keyInput || !btn) return;

    const rawKey = keyInput.value.trim().toUpperCase();
    console.log('Activating:', rawKey);

    btn.disabled = true;
    btn.textContent = 'Activating...';
    if (error) error.textContent = '';

    if (!licenseManager.validateFormat(rawKey)) {
        btn.disabled = false;
        btn.textContent = 'Activate';
        if (error) error.textContent = 'Invalid format. Use: INNO-XXXX-XXXX-XXXX';
        return;
    }

    try {
        const result = await licenseManager.activateLicense(rawKey);
        
        // CRITICAL FIX: Check if result exists before accessing properties
        if (!result) {
            throw new Error('No response from server');
        }
        
        console.log('Activation result:', result);

        if (result.success) {
            btn.textContent = '✓ Activated!';
            btn.style.background = '#2ed573';
            
            if (error) {
                error.style.color = '#2ed573';
                error.textContent = `${result.tier || 'PRO'} License • Expires in ${result.daysRemaining || '?'} days`;
            }
            
            setTimeout(() => {
                showMainScreen();
                updateTierBadge(result.tier);
                btn.disabled = false;
                btn.textContent = 'Activate';
                btn.style.background = '';
            }, 1500);
        } else {
            btn.disabled = false;
            btn.textContent = 'Activate';
            
            if (error) {
                error.style.color = '#ff4757';
                error.textContent = result.error || 'Activation failed';
            }
        }
    } catch (e) {
        console.error('Activation error:', e);
        btn.disabled = false;
        btn.textContent = 'Activate';
        if (error) {
            error.style.color = '#ff4757';
            error.textContent = 'Error: ' + e.message;
        }
    }
        }

        try {
            let result;

            // Check if it's a demo key (local only)
            if (DEMO_KEYS.includes(rawKey)) {
                console.log('Demo key detected');
                result = { 
                    success: true, 
                    tier: 'DEMO', 
                    daysRemaining: 7,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                };
                
                // Save demo license locally
                licenseManager.saveLicense({
                    key: rawKey,
                    hardwareId: await licenseManager.getHardwareId(),
                    tier: 'DEMO',
                    expiresAt: result.expiresAt,
                    activatedAt: new Date().toISOString(),
                    daysRemaining: 7
                });
            } else {
                // Real activation via API
                console.log('Calling activation API...');
                result = await licenseManager.activateLicense(rawKey);
            }

            if (result.success) {
                // Success!
                btn.textContent = '✓ Activated!';
                btn.style.background = '#2ed573';
                
                if (error) {
                    error.style.color = '#2ed573';
                    error.innerHTML = `${result.tier} License • Expires in ${result.daysRemaining} days`;
                }
                
                setTimeout(() => {
                    showMainScreen();
                    updateTierBadge(result.tier);
                    
                    // Reset button
                    btn.disabled = false;
                    btn.textContent = 'Activate';
                    btn.style.background = '';
                }, 1500);
            } else {
                // Failed
                btn.disabled = false;
                btn.textContent = 'Activate';
                
                if (error) {
                    error.style.color = '#ff4757';
                    error.textContent = result.error || 'Activation failed';
                }
            }
        } catch (e) {
            console.error('Activation error:', e);
            btn.disabled = false;
            btn.textContent = 'Activate';
            if (error) error.textContent = 'Network error. Check connection.';
        }
    }

    function updateTierBadge(tier) {
        const badge = document.getElementById('tierBadge');
        if (!badge) return;

        badge.textContent = tier || 'BASIC';
        
        // Color coding
        const colors = {
            'PRO': '#00d4aa',
            'YEARLY': '#9b59b6',
            'MONTHLY': '#3498db',
            'DEMO': '#f39c12',
            'BASIC': '#95a5a6',
            'TEAM': '#e74c3c'
        };
        
        badge.style.background = colors[tier] || colors['BASIC'];
    }

    // ============================================
    // SCREEN MANAGEMENT (Unchanged)
    // ============================================
    function showLoginScreen() {
        const login = document.getElementById('loginScreen');
        const main = document.getElementById('mainScreen');
        
        login?.classList.add('active');
        if (login) login.style.display = 'flex';
        
        main?.classList.remove('active');
        if (main) main.style.display = 'none';
    }

    function showMainScreen() {
        const login = document.getElementById('loginScreen');
        const main = document.getElementById('mainScreen');
        
        login?.classList.remove('active');
        if (login) login.style.display = 'none';
        
        main?.classList.add('active');
        if (main) main.style.display = 'flex';
        
        setTimeout(loadTemplates, 100);
    }

    // ============================================
    // TEMPLATE LOADING (Unchanged from your version)
    // ============================================
    function loadTemplates() {
        console.log('Loading templates...');
        const grid = document.getElementById('templateGrid');
        const empty = document.getElementById('emptyState');

        if (grid) {
            grid.innerHTML = '<div class="loading-state" style="grid-column: 1 / -1;"><div class="spinner"></div><p>Scanning MOGRT library...</p></div>';
        }

        if (empty) {
            empty.classList.add('hidden');
            empty.style.display = 'none';
        }

        if (!mogrtScanner) {
            console.error('MogrtScanner not ready');
            showEmptyState('Scanner not initialized');
            return;
        }

        mogrtScanner.scanDirectory().then(function(items) {
            templates = items || [];
            console.log('Templates loaded:', templates.length);

            const hasRealTemplates = templates.length > 0 && !templates[0].isDemo;

            if (templates.length === 0) {
                showEmptyState('No MOGRT files found');
            } else {
                renderTemplates();
                updateFolderList();

                if (!hasRealTemplates) {
                    showDemoWarning(mogrtScanner.getDebugInfo ? mogrtScanner.getDebugInfo() : '');
                } else {
                    removeDemoWarning();
                }
            }
        }).catch(function(err) {
            console.error('Scan error:', err);
            templates = [];
            showEmptyState('Error scanning: ' + (err.message || err.toString()));
        });
    }

    // ============================================
    // ALL YOUR EXISTING FUNCTIONS (Unchanged)
    // ============================================
    function showEmptyState(message) {
        // ... keep your existing showEmptyState code exactly as is ...
        const grid = document.getElementById('templateGrid');
        const empty = document.getElementById('emptyState');

        if (grid) grid.innerHTML = '';

        if (empty) {
            empty.classList.remove('hidden');
            empty.style.display = 'block';
            empty.innerHTML = `
                <p style="font-size: 16px; margin-bottom: 10px; color: #ffcc00;">⚠ ${escapeHtml(message)}</p>
                <p style="font-size: 12px; color: #888; margin-bottom: 20px; max-width: 400px; line-height: 1.5;">
                    CEP mode not detected or the plugin cannot access your files automatically.<br><br>
                    <strong>Solution:</strong> Try reloading the panel, rescanning, or use the manual path workaround below.
                </p>
                <div style="margin-bottom: 15px;">
                    <button id="scanAgainBtn" class="btn-secondary" style="margin-right: 8px;">🔄 Retry</button>
                    <button id="useDemoBtn" class="btn-secondary" style="margin-right: 8px;">📋 Use Demo</button>
                    <button id="workaroundBtn" class="btn-secondary" style="background: #00d4aa; color: #000; font-weight: bold;">⚡ WORKAROUND</button>
                </div>
                <div id="workaroundArea" style="display: none; margin-top: 15px; padding: 15px; background: #1b1b1c; border-radius: 8px; text-align: left;">
                    <p style="font-size: 11px; color: #aaa; margin-bottom: 10px;">
                        <strong>Manual Workaround:</strong><br>
                        Since CEP file access is blocked, enter your extension path manually:
                    </p>
                    <input type="text" id="manualPathInput" placeholder="Paste full path to extension folder..."
                        style="width: 100%; padding: 8px; margin-bottom: 8px; background: #333; border: 1px solid #555; color: #fff; font-size: 12px; border-radius: 4px;">
                    <div style="font-size: 10px; color: #666; margin-bottom: 8px;">
                        Example: C:\\Users\\You\\AppData\\Roaming\\Adobe\\CEP\\extensions\\com.innonex.innofusion
                    </div>
                    <button id="setPathBtn" class="btn-primary" style="width: 100%; padding: 8px; font-size: 12px;">Set Path & Scan</button>
                </div>
            `;

            document.getElementById('scanAgainBtn')?.addEventListener('click', loadTemplates);
            document.getElementById('useDemoBtn')?.addEventListener('click', function() {
                templates = mogrtScanner.getDemoTemplates();
                renderTemplates();
                updateFolderList();
            });

            document.getElementById('workaroundBtn')?.addEventListener('click', function() {
                const area = document.getElementById('workaroundArea');
                area.style.display = area.style.display === 'none' ? 'block' : 'none';
            });

            document.getElementById('setPathBtn')?.addEventListener('click', function() {
                const input = document.getElementById('manualPathInput');
                const path = input?.value.trim();

                if (path && mogrtScanner) {
                    mogrtScanner.manualPath = path + (path.includes('\\') ? '\\' : '/') + 'mogrt_library';
                    console.log('Manual path set:', mogrtScanner.manualPath);

                    const emptyArea = document.getElementById('emptyState');
                    if (emptyArea) {
                        emptyArea.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Trying manual path...</p></div>';
                    }

                    setTimeout(function() {
                        loadTemplates();
                    }, 500);
                }
            });
        }
    }

    function testJSXDirect() {
        try {
            const cs = new CSInterface();
            cs.evalScript('typeof Innofusion', function(result1) {
                alert('typeof Innofusion = ' + result1);
                setTimeout(function() {
                    cs.evalScript('Innofusion.test()', function(result2) {
                        alert('Innofusion.test() = ' + result2);
                    });
                }, 200);
            });
        } catch (e) {
            alert('JS test failed: ' + e.toString());
        }
    }

    function testImportDirect() {
        try {
            const cs = new CSInterface();
            cs.evalScript('Innofusion.test()', function(result) {
                alert('Direct test result = ' + result);
            });
        } catch (e) {
            alert('Direct test failed: ' + e.toString());
        }
    }

    function showDemoWarning(debugInfo) {
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) return;

        removeDemoWarning();

        const warning = document.createElement('div');
        warning.id = 'demoWarning';
        warning.style.cssText =
            'background: #332d00; border: 1px solid #665500; color: #ffcc00; padding: 10px 15px; margin: 0 20px 20px 20px; border-radius: 6px; font-size: 12px;';

        warning.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <span>⚠ Showing demo templates. Place your .mogrt files in the <strong>mogrt_library</strong> folder and click Refresh.</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#ffcc00;cursor:pointer;font-size:16px;">&times;</button>
            </div>
            <p style="font-size: 11px; color: #c7b97a; margin-top: 8px; white-space: pre-wrap;">
                ${escapeHtml(debugInfo || '')}
            </p>
        `;

        contentArea.insertBefore(warning, contentArea.firstChild);
    }

    function removeDemoWarning() {
        const existing = document.getElementById('demoWarning');
        if (existing) existing.remove();
    }

    function renderTemplates(filtered) {
        if (!filtered) filtered = templates;
        const grid = document.getElementById('templateGrid');

        if (!grid) return;

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No templates</div>';
            return;
        }

        if (filtered.length > 0 && !filtered[0].isDemo) {
            removeDemoWarning();
        }

        grid.innerHTML = filtered.map(function(t) {
            const isGif  = t.previewType === 'gif';
            const hasGif = !!t.gifPreview;

            const gifBadge = isGif
                ? '<div style="position:absolute;top:5px;left:5px;background:#00d4aa;color:#000;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:bold;letter-spacing:0.5px;">▶ LIVE</div>'
                : '';
            const demoBadge = t.isDemo
                ? '<div style="position:absolute;top:5px;right:5px;background:#ffcc00;color:#000;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:bold;">DEMO</div>'
                : '';

            const staticImg = `<img
                class="card-static-thumb"
                src="${escapeHtml(t.thumbnail)}"
                alt="${escapeHtml(t.name)}"
                style="width:100%;height:100%;object-fit:cover;display:block;position:absolute;top:0;left:0;">`;

            const gifOverlay = hasGif
                ? `<img
                    class="card-gif-preview"
                    data-src="${escapeHtml(t.gifPreview)}"
                    alt=""
                    style="width:100%;height:100%;object-fit:cover;display:block;position:absolute;top:0;left:0;opacity:0;transition:opacity 0.25s;">`
                : '';

            return `
                <div class="template-card${hasGif ? ' has-gif' : ''}" data-id="${escapeHtml(t.id)}">
                    <div class="template-thumbnail" style="position:relative;">
                        ${staticImg}
                        ${gifOverlay}
                        ${isGif ? '' : '<div class="play-overlay">&#9658;</div>'}
                        ${gifBadge}
                        ${demoBadge}
                    </div>
                    <div class="template-info-card">
                        <div class="template-name">${escapeHtml(t.name)}</div>
                        <div class="template-category">${escapeHtml(t.category)}</div>
                        ${t.fileSize ? `<div style="font-size:10px;color:#666;margin-top:4px;">${escapeHtml(t.fileSize)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.template-card').forEach(function(card) {
            card.addEventListener('click', function() {
                openPreview(card.getAttribute('data-id'));
            });

            const gifEl = card.querySelector('.card-gif-preview');
            if (gifEl) {
                card.addEventListener('mouseenter', function() {
                    if (!gifEl.src || gifEl.src === window.location.href) {
                        gifEl.src = gifEl.getAttribute('data-src');
                    }
                    gifEl.style.opacity = '1';
                });
                card.addEventListener('mouseleave', function() {
                    gifEl.style.opacity = '0';
                });
            }
        });
    }

    function updateFolderList() {
        const list = document.getElementById('folderList');
        if (!list) return;

        const categories = [...new Set(templates.map(function(t) { return t.category; }))];

        let html = `
            <li class="folder-item ${currentFolder === 'all' ? 'active' : ''}" data-folder="all">
                <span class="folder-icon">&#128193;</span>
                <span>All Templates (${templates.length})</span>
            </li>
        `;

        categories.forEach(function(cat) {
            const count = templates.filter(function(t) { return t.category === cat; }).length;
            html += `
                <li class="folder-item ${currentFolder === cat ? 'active' : ''}" data-folder="${escapeHtml(cat)}">
                    <span class="folder-icon">&#128194;</span>
                    <span>${escapeHtml(cat)} (${count})</span>
                </li>
            `;
        });

        list.innerHTML = html;

        document.querySelectorAll('.folder-item').forEach(function(item) {
            item.addEventListener('click', function() {
                selectFolder(item.getAttribute('data-folder'));
            });
        });
    }

    function selectFolder(folder) {
        currentFolder = folder;

        document.querySelectorAll('.folder-item').forEach(function(item) {
            item.classList.toggle('active', item.getAttribute('data-folder') === folder);
        });

        const filtered = folder === 'all' ? templates : templates.filter(function(t) {
            return t.category === folder;
        });

        renderTemplates(filtered);
    }

    function handleSearch(e) {
        const query = String(e.target.value || '').toLowerCase();

        const filtered = templates.filter(function(t) {
            return (
                String(t.name || '').toLowerCase().includes(query) ||
                String(t.category || '').toLowerCase().includes(query)
            );
        });

        renderTemplates(filtered);
    }

    function openPreview(id) {
        currentTemplate = templates.find(function(t) { return t.id === id; });
        if (!currentTemplate) return;

        const nameEl = document.getElementById('templateName');
        const catEl  = document.getElementById('templateCategory');
        const durEl  = document.getElementById('templateDuration');
        const sizeEl = document.getElementById('templateSize');

        if (nameEl) nameEl.textContent = currentTemplate.name;
        if (catEl)  catEl.textContent  = currentTemplate.category;
        if (durEl)  durEl.textContent  = currentTemplate.duration;
        if (sizeEl) sizeEl.textContent = `${currentTemplate.width}x${currentTemplate.height}`;

        const previewContainer = document.querySelector('.preview-container');
        if (previewContainer) {
            const old = previewContainer.querySelector('.live-preview-media');
            if (old) old.remove();

            const hasGif = currentTemplate.gifPreview;
            const src    = hasGif ? currentTemplate.gifPreview : currentTemplate.thumbnail;
            const isGif  = hasGif;

            const img = document.createElement('img');
            img.className = 'live-preview-media';
            img.src = src;
            img.alt = currentTemplate.name;
            img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;opacity:0;transition:opacity 0.3s;';
            img.onload = function() { img.style.opacity = '1'; };

            const badge = document.createElement('div');
            badge.className = 'live-preview-badge';
            badge.style.cssText = 'position:absolute;top:12px;left:12px;background:' +
                (isGif ? '#00d4aa' : '#444') +
                ';color:' + (isGif ? '#000' : '#ccc') +
                ';font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.5px;';
            badge.textContent = isGif ? '▶ LIVE PREVIEW' : '🖼 STATIC PREVIEW';

            const placeholder = document.getElementById('previewPlaceholder');
            if (placeholder) {
                placeholder.innerHTML = '';
                placeholder.appendChild(img);
            }

            const oldBadge = previewContainer.querySelector('.live-preview-badge');
            if (oldBadge) oldBadge.remove();
            previewContainer.appendChild(badge);

            const video = document.getElementById('previewVideo');
            if (video) { video.src = ''; video.style.display = 'none'; }
        }

        const modal = document.getElementById('previewModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    }

    function closeModal() {
        const modal = document.getElementById('previewModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    async function importTemplate() {
        if (!currentTemplate) return;

        if (currentTemplate.isDemo) {
            alert('This is a demo template. Add real MOGRT files to import.');
            return;
        }

        try {
            const result = await premiereBridge.importMogrt(currentTemplate.fullPath, 0, 0);
            if (result.success) {
                closeModal();
            } else {
                alert('Import failed: ' + (result.message || 'Unknown error'));
            }
        } catch (e) {
            alert('Import error: ' + e.message);
        }
    }

    // ============================================
    // LOGOUT (Updated to use LicenseManager)
    // ============================================
    function handleLogout() {
        licenseManager.clearLicense();
        
        const keyInput = document.getElementById('licenseKey');
        if (keyInput) keyInput.value = '';

        removeDemoWarning();
        
        // Remove offline warning if present
        const offlineWarn = document.getElementById('offlineWarning');
        if (offlineWarn) offlineWarn.remove();
        
        showLoginScreen();
    }

    function debounce(func, wait) {
        let timeout;
        return function() {
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(null, args);
            }, wait);
        };
    }

    function showDebugPanel() {
        const existing = document.getElementById('debugPanel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'debugPanel';
        panel.style.cssText = 'position:fixed; bottom:10px; right:10px; width:400px; max-height:300px; overflow:auto; background:rgba(0,0,0,0.9); border:1px solid #00d4aa; color:#00d4aa; padding:10px; font-family:monospace; font-size:11px; z-index:9999; border-radius:4px;';

        const licenseInfo = licenseManager.getLicenseInfo();
        
        const info = {
            'Version': '2.0.0',
            'CEP Available': typeof window.__adobe_cep__ !== 'undefined' ? 'YES' : 'NO',
            'License Tier': licenseInfo?.tier || 'None',
            'Days Remaining': licenseInfo?.daysRemaining || 'N/A',
            'License Key': licenseInfo?.key || 'None',
            'Extension Root': 'Checking...',
            'Library Path': 'Checking...',
            'File System': mogrtScanner && mogrtScanner.fs ? 'YES' : 'NO',
            'Path Module': mogrtScanner && mogrtScanner.path ? 'YES' : 'NO'
        };

        if (mogrtScanner) {
            try {
                const root = mogrtScanner.getExtensionRoot();
                info['Extension Root'] = root || 'NULL';
                const lib = mogrtScanner.getLibraryPath();
                info['Library Path'] = lib || 'NULL';
            } catch (e) {
                info['Error'] = e.message;
            }
        }

        let html =
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">' +
            '<strong>DEBUG INFO</strong>' +
            '<button onclick="document.getElementById(\'debugPanel\').remove()" style="background:#333; border:none; color:#fff; cursor:pointer; padding:2px 8px; border-radius:3px;">&times;</button>' +
            '</div>';

        for (const [key, value] of Object.entries(info)) {
            const color = value === 'YES' ? '#2ed573' : (value === 'NULL' || value === 'None' ? '#ff4757' : '#fff');
            html += `<div style="margin:3px 0;"><span style="color:#666;">${escapeHtml(key)}:</span> <span style="color:${color};">${escapeHtml(value)}</span></div>`;
        }

        html +=
            '<div style="margin-top:10px; padding-top:10px; border-top:1px solid #333;">' +
            '<button onclick="window.location.reload()" style="background:#00d4aa; color:#000; border:none; padding:5px 10px; cursor:pointer; margin-right:5px; border-radius:3px;">Reload</button>' +
            '<button onclick="loadTemplates()" style="background:#333; color:#fff; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">Rescan</button>' +
            '</div>';

        panel.innerHTML = html;
        document.body.appendChild(panel);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || (e.ctrlKey && e.key === 'd')) {
            e.preventDefault();
            showDebugPanel();
        }
    });

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    console.log('index.js v2.0.0 ready');
})();