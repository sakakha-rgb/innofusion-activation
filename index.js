// iNNO FUSION - Main Entry Point (v1.0.4 - FINAL DEBUG)

(function() {
    'use strict';
    
    console.log('=== iNNO FUSION v1.0.4 ===');
    
    let csInterface = null;
    let licenseManager = null;
    let mogrtScanner = null;
    let premiereBridge = null;
    let templates = [];
    let currentFolder = 'all';
    let currentTemplate = null;

    const DEMO_KEYS = ['INNO-1234-5678-9999', 'INNO-DEMO-KEY1-9999', 'INNO-TEST-2024-9999'];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }

    function startApp() {
        console.log('Starting app...');
        
        try {
            initCSInterface();
            
            licenseManager = new LicenseManager();
            
            mogrtScanner = new MogrtScanner();
            if (mogrtScanner.init) {
                mogrtScanner.init();
            }
            
            premiereBridge = new PremiereBridge();
            
            console.log('✓ All classes initialized');
            setupEventListeners();
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

    function checkExistingLicense() {
        try {
            const savedLicense = localStorage.getItem('innofusion_license');
            if (savedLicense && licenseManager && licenseManager.validateFormat(savedLicense)) {
                showMainScreen();
            } else {
                showLoginScreen();
            }
        } catch (e) {
            showLoginScreen();
        }
    }

    function setupEventListeners() {
        document.getElementById('activateBtn')?.addEventListener('click', handleActivation);

        const licenseInput = document.getElementById('licenseKey');
        if (licenseInput) {
            licenseInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleActivation();
            });

            licenseInput.addEventListener('input', function(e) {
                let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                let formatted = '';

                for (let i = 0; i < value.length && i < 16; i++) {
                    if (i === 4 || i === 8 || i === 12) formatted += '-';
                    formatted += value[i];
                }

                e.target.value = formatted;

                const error = document.getElementById('loginError');
                if (error) error.textContent = '';
            });

            setTimeout(function() {
                licenseInput.focus();
            }, 100);
        }

        document.getElementById('autoFillDemo')?.addEventListener('click', function() {
            const input = document.getElementById('licenseKey');
            if (input) {
                input.value = 'INNO-1234-5678-9999';
                handleActivation();
            }
        });

        document.getElementById('purchaseLink')?.addEventListener('click', function(e) {
            e.preventDefault();
            if (premiereBridge && premiereBridge.openURL) {
                premiereBridge.openURL('https://innonex.co.uk/purchase');
            } else {
                window.open('https://innonex.co.uk/purchase');
            }
        });

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('refreshBtn')?.addEventListener('click', loadTemplates);
        document.getElementById('searchInput')?.addEventListener('input', debounce(handleSearch, 300));
        document.querySelector('.close-btn')?.addEventListener('click', closeModal);
        document.getElementById('importBtn')?.addEventListener('click', importTemplate);

        // JSX debug tests
        document.getElementById('settingsBtn')?.addEventListener('dblclick', function() {
            // DIRECT RAW DIAGNOSTIC - bypasses all wrapper code
            var cs = new CSInterface();
            var output = [];
            output.push('CEP: ' + (typeof window.__adobe_cep__ !== 'undefined' ? 'YES' : 'NO'));
            output.push('CSInterface: ' + (typeof CSInterface !== 'undefined' ? 'YES' : 'NO'));
            
            // Raw evalScript with simplest possible JSX
            try {
                cs.evalScript('1+1', function(r) {
                    output.push('evalScript(1+1) = ' + r);
                    
                    cs.evalScript('typeof Innofusion', function(r2) {
                        output.push('typeof Innofusion = ' + r2);
                        
                        cs.evalScript('typeof app', function(r3) {
                            output.push('typeof app = ' + r3);
                            alert('DIAGNOSTIC:\n' + output.join('\n'));
                        });
                    });
                });
            } catch(e) {
                output.push('EXCEPTION: ' + e.toString());
                alert('DIAGNOSTIC:\n' + output.join('\n'));
            }
        });
        document.getElementById('settingsBtn')?.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            testImportDirect();
        });
    }

    function handleActivation() {
        const keyInput = document.getElementById('licenseKey');
        const btn = document.getElementById('activateBtn');
        const error = document.getElementById('loginError');

        if (!keyInput || !btn) return;

        const rawKey = keyInput.value.trim().toUpperCase();
        console.log('Activating:', rawKey);

        btn.disabled = true;
        btn.textContent = 'Activating...';
        if (error) error.textContent = '';

        if (DEMO_KEYS.indexOf(rawKey) !== -1) {
            console.log('✓ Demo key accepted');
            activateSuccess(rawKey, 'PRO');
            return;
        }

        if (error) {
            error.innerHTML = 'Invalid key. <strong style="color:#00d4aa;cursor:pointer;" onclick="document.getElementById(\'licenseKey\').value=\'INNO-1234-5678-9999\';">Use demo key</strong>';
        }

        btn.disabled = false;
        btn.textContent = 'Activate';
    }

    function activateSuccess(key, tier) {
        try {
            localStorage.setItem('innofusion_license', key);
            localStorage.setItem('innofusion_hardware_id', 'DEMO-' + Math.random().toString(36).substr(2, 9).toUpperCase());
            localStorage.setItem('innofusion_tier', tier);
        } catch (e) {}

        const btn = document.getElementById('activateBtn');
        if (btn) {
            btn.textContent = '✓ Activated!';
            btn.style.background = '#2ed573';
        }

        setTimeout(function() {
            showMainScreen();
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Activate';
                btn.style.background = '';
            }
        }, 600);
    }

    function showLoginScreen() {
        document.getElementById('loginScreen')?.classList.add('active');
        if (document.getElementById('loginScreen')) document.getElementById('loginScreen').style.display = 'flex';

        document.getElementById('mainScreen')?.classList.remove('active');
        if (document.getElementById('mainScreen')) document.getElementById('mainScreen').style.display = 'none';
    }

    function showMainScreen() {
        document.getElementById('loginScreen')?.classList.remove('active');
        if (document.getElementById('loginScreen')) document.getElementById('loginScreen').style.display = 'none';

        document.getElementById('mainScreen')?.classList.add('active');
        if (document.getElementById('mainScreen')) document.getElementById('mainScreen').style.display = 'flex';

        const tierBadge = document.getElementById('tierBadge');
        if (tierBadge) tierBadge.textContent = localStorage.getItem('innofusion_tier') || 'BASIC';

        setTimeout(loadTemplates, 100);
    }

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

    function showEmptyState(message) {
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
            return `
                <div class="template-card" data-id="${escapeHtml(t.id)}">
                    <div class="template-thumbnail">
                        <img src="${escapeHtml(t.thumbnail)}" alt="${escapeHtml(t.name)}" style="width:100%;height:100%;object-fit:cover;">
                        <div class="play-overlay">&#9658;</div>
                        ${t.isDemo ? '<div style="position:absolute;top:5px;right:5px;background:#ffcc00;color:#000;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:bold;">DEMO</div>' : ''}
                    </div>
                    <div class="template-info-card">
                        <div class="template-name">${escapeHtml(t.name)}</div>
                        <div class="template-category">${escapeHtml(t.category)}</div>
                        ${t.fileSize ? `<div style="font-size: 10px; color: #666; margin-top: 4px;">${escapeHtml(t.fileSize)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.template-card').forEach(function(card) {
            card.addEventListener('click', function() {
                openPreview(card.getAttribute('data-id'));
            });
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

        const els = {
            name: document.getElementById('templateName'),
            cat: document.getElementById('templateCategory'),
            dur: document.getElementById('templateDuration'),
            size: document.getElementById('templateSize'),
            img: document.querySelector('#previewPlaceholder img')
        };

        if (els.name) els.name.textContent = currentTemplate.name;
        if (els.cat) els.cat.textContent = currentTemplate.category;
        if (els.dur) els.dur.textContent = currentTemplate.duration;
        if (els.size) els.size.textContent = `${currentTemplate.width}x${currentTemplate.height}`;
        if (els.img) els.img.src = currentTemplate.thumbnail;

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

    function handleLogout() {
        try {
            localStorage.removeItem('innofusion_license');
            localStorage.removeItem('innofusion_hardware_id');
            localStorage.removeItem('innofusion_tier');
        } catch (e) {}

        const keyInput = document.getElementById('licenseKey');
        if (keyInput) keyInput.value = '';

        removeDemoWarning();
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

        const info = {
            'CEP Available': typeof window.__adobe_cep__ !== 'undefined' ? 'YES' : 'NO',
            'cep_node': typeof window.cep_node !== 'undefined' ? 'YES' : 'NO',
            'window.require': typeof window.require !== 'undefined' ? 'YES' : 'NO',
            'CSInterface': typeof CSInterface !== 'undefined' ? 'YES' : 'NO',
            'SystemPath': typeof SystemPath !== 'undefined' ? 'YES' : 'NO',
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
            const color = value === 'YES' || value === 'NULL' ? (value === 'YES' ? '#2ed573' : '#ff4757') : '#fff';
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

    console.log('index.js ready');
})();