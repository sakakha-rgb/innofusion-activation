// MogrtScanner.js - FINAL WORKING VERSION with Node.js fallback
(function() {
    'use strict';
    
    class MogrtScanner {
        constructor() {
            this.extensionRoot = null;
            this.csInterface = null;
            this.manualPath = null;
            this.fs = null;
            this.path = null;
            console.log('[MogrtScanner] Constructor v4.0');
        }

        init() {
            console.log("=== MogrtScanner INIT ===");
            
            // Try to get Node.js fs module FIRST (more reliable)
            this.initNodeModules();
            
            if (typeof CSInterface !== 'undefined') {
                try {
                    this.csInterface = new CSInterface();
                    console.log("✓ CSInterface created");
                } catch (e) {
                    console.error("✗ CSInterface error:", e);
                }
            }
            
            this.extensionRoot = this.getExtensionRoot();
            console.log("Extension Root:", this.extensionRoot);
            
            const libPath = this.getLibraryPath();
            console.log("Library Path:", libPath);
            
            console.log("=== INIT COMPLETE ===");
        }
        
        initNodeModules() {
            try {
                if (typeof require !== 'undefined') {
                    this.fs = require('fs');
                    this.path = require('path');
                    console.log("✓ Node.js modules loaded (fs, path)");
                } else {
                    console.log("ℹ Node.js require not available");
                }
            } catch(e) {
                console.log("ℹ Node.js modules not available:", e.message);
            }
        }

        getExtensionRoot() {
            if (!this.csInterface || typeof SystemPath === 'undefined') {
                return null;
            }
            
            try {
                let path = this.csInterface.getSystemPath(SystemPath.EXTENSION);
                if (!path) return null;
                
                // Decode URI
                try { path = decodeURIComponent(path); } catch(e) {}
                
                // Remove file:///
                if (path.indexOf('file:///') === 0) {
                    path = path.substring(8);
                } else if (path.indexOf('file://') === 0) {
                    path = path.substring(7);
                }
                
                // Convert to Windows path
                path = path.split('/').join('\\');
                
                // Validate
                if (path.indexOf('mock') !== -1 || path === '') {
                    return null;
                }
                
                return path;
            } catch(e) {
                console.error('[getExtensionRoot] Error:', e);
                return null;
            }
        }

        getLibraryPath() {
            if (this.manualPath) return this.manualPath;
            if (this.extensionRoot) return this.extensionRoot + '\\mogrt_library';
            return null;
        }

        detectCategory(name) {
            const n = name.toLowerCase();
            if (n.includes("transition")) return "Transitions";
            if (n.includes("text")) return "Text Effects";
            if (n.includes("title")) return "Titles";
            if (n.includes("lower") || n.includes("aston") || n.includes("nl")) return "Lower Thirds";
            if (n.includes("news") || n.includes("slide")) return "News";
            if (n.includes("box")) return "Text Boxes";
            return "General";
        }


        // MOGRT files are ZIP archives containing a poster.png thumbnail
        // Extract it and return as base64 data URL
        extractThumbnail(mogrtPath) {
            try {
                if (!this.fs) return null;

                const data = this.fs.readFileSync(mogrtPath);

                // ZIP local file header signature: PK\x03\x04
                // Scan through the ZIP to find poster.png
                let offset = 0;
                while (offset < data.length - 30) {
                    // Check for local file header
                    if (data[offset] === 0x50 && data[offset+1] === 0x4B &&
                        data[offset+2] === 0x03 && data[offset+3] === 0x04) {

                        const compression   = data.readUInt16LE(offset + 8);
                        const compSize      = data.readUInt32LE(offset + 18);
                        const uncompSize    = data.readUInt32LE(offset + 22);
                        const nameLen       = data.readUInt16LE(offset + 26);
                        const extraLen      = data.readUInt16LE(offset + 28);
                        const fileName      = data.slice(offset + 30, offset + 30 + nameLen).toString('utf8');

                        const dataStart = offset + 30 + nameLen + extraLen;

                        // Look for poster.png or thumbnail (case-insensitive)
                        if (/poster\.png$/i.test(fileName) || /thumbnail\.png$/i.test(fileName) || /thumb\.png$/i.test(fileName)) {
                            if (compression === 0 && uncompSize > 0) {
                                // Stored (no compression)
                                const imgData = data.slice(dataStart, dataStart + uncompSize);
                                return 'data:image/png;base64,' + imgData.toString('base64');
                            } else if (compression === 8) {
                                // Deflate compressed — use zlib
                                try {
                                    const zlib = require('zlib');
                                    const compressed = data.slice(dataStart, dataStart + compSize);
                                    const decompressed = zlib.inflateRawSync(compressed);
                                    return 'data:image/png;base64,' + decompressed.toString('base64');
                                } catch(e) {
                                    console.warn('[extractThumbnail] zlib error:', e.message);
                                }
                            }
                        }

                        offset = dataStart + compSize;
                    } else {
                        offset++;
                    }
                }
                return null; // no thumbnail found in ZIP
            } catch(e) {
                console.warn('[extractThumbnail] error:', e.message);
                return null;
            }
        }

        async scanDirectory() {
            console.log("\n=== SCAN DIRECTORY ===");
            
            const libPath = this.getLibraryPath();
            console.log("Library:", libPath);
            
            if (!libPath) {
                console.error("No library path");
                return this.getDemos();
            }

            let result = [];
            
            // Try Node.js FIRST (more reliable)
            if (this.fs && this.path) {
                console.log("Trying Node.js scan...");
                result = await this.scanWithNode(libPath);
            }
            
            // Fallback to CEP if Node failed
            if (result.length === 0 && this.csInterface) {
                console.log("Trying CEP scan...");
                result = await this.scanCEP(libPath);
            }
            
            if (result.length > 0 && !result[0].isDemo) {
                console.log(`✓ Found ${result.length} MOGRTs`);
                return result;
            }
            
            console.warn("⚠ Using demos");
            return this.getDemos();
        }
        
        // Load a sidecar preview file sitting next to the .mogrt
        // e.g. "Channel 18 Aston Saka.gif" or "Channel 18 Aston Saka.png"
        loadSidecarPreview(mogrtPath) {
            if (!this.fs || !this.path) return { gif: null, png: null };
            const dir      = this.path.dirname(mogrtPath);
            const baseName = this.path.basename(mogrtPath, '.mogrt');
            let gif = null;
            let png = null;

            for (const ext of ['.gif', '.GIF']) {
                try {
                    const p = this.path.join(dir, baseName + ext);
                    if (this.fs.existsSync(p)) {
                        gif = 'data:image/gif;base64,' + this.fs.readFileSync(p).toString('base64');
                        console.log('[sidecar] GIF found:', p);
                        break;
                    }
                } catch(e) {}
            }
            for (const ext of ['.png', '.PNG']) {
                try {
                    const p = this.path.join(dir, baseName + ext);
                    if (this.fs.existsSync(p)) {
                        png = 'data:image/png;base64,' + this.fs.readFileSync(p).toString('base64');
                        console.log('[sidecar] PNG found:', p);
                        break;
                    }
                } catch(e) {}
            }
            return { gif, png };
        }

async scanWithNode(dirPath) {
    return new Promise((resolve) => {
        try {
            const files = this.fs.readdirSync(dirPath);
            const templates = [];

            for (const file of files) {
                if (file.toLowerCase().endsWith('.mogrt')) {
                    const fullPath = this.path.join(dirPath, file);
                    const stats = this.fs.statSync(fullPath);

                    // 1. Check for sidecar files (same name .gif / .png next to .mogrt)
                    const sidecar   = this.loadSidecarPreview(fullPath);
                    // 2. Fall back to ZIP-embedded preview
                    const gifPreview = sidecar.gif || this.extractGifPreview(fullPath);
                    const pngThumb   = sidecar.png || this.extractThumbnail(fullPath);
                    console.log('[scan] ' + file + ' gif=' + !!gifPreview + ' png=' + !!pngThumb);
                    templates.push({
                        id: 'mogrt-' + Math.random().toString(36).substr(2, 9),
                        name: file.replace(/\.mogrt$/i, ""),
                        category: this.detectCategory(file),
                        thumbnail: pngThumb || this.makePlaceholder(file.replace(/\.mogrt$/i, "")),
                        gifPreview: gifPreview || null,
                        previewType: gifPreview ? 'gif' : (pngThumb ? 'png' : 'placeholder'),
                        duration: "00:00:05:00",
                        width: 1920,
                        height: 1080,
                        fullPath: fullPath,
                        fileSize: Math.round(stats.size / 1024) + " KB",
                        isDemo: false
                    });
                }
            }

            console.log(`[scanWithNode] Found ${templates.length} MOGRTs`);
            resolve(templates.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (e) {
            console.error("[scanWithNode] Error:", e.message);
            resolve([]);
        }
    });
}

        async scanCEP(dirPath) {
            const files = await this.readDirectoryCEP(dirPath);
            const templates = [];
            
            for (let file of files) {
                const name = file.name || '';
                if (name.toLowerCase().endsWith(".mogrt")) {
                    templates.push({
                        id: 'mogrt-' + Math.random().toString(36).substr(2, 9),
                        name: name.replace(/\.mogrt$/i, ""),
                        category: this.detectCategory(name),
                        thumbnail: this.makePlaceholder(name),
                        duration: "00:00:05:00",
                        width: 1920,
                        height: 1080,
                        fullPath: file.path || (dirPath + '\\' + name),
                        fileSize: file.size ? Math.round(file.size / 1024) + " KB" : "N/A",
                        isDemo: false
                    });
                }
            }
            
            return templates.sort((a,b) => a.name.localeCompare(b.name));
        }

        async readDirectoryCEP(dirPath) {
            return new Promise((resolve) => {
                if (!this.csInterface) {
                    resolve([]);
                    return;
                }
                
                // Escape for JSX
                const escapedPath = dirPath.replace(/\\/g, '\\\\');
                
                const jsx = `(function(){try{var f=new Folder("${escapedPath}");if(!f.exists)return JSON.stringify({success:false,error:"not found"});var files=[];var items=f.getFiles();for(var i=0;i<items.length;i++){var item=items[i];if(item instanceof File&&item.name.match(/\\.mogrt$/i)){files.push({name:item.name,path:item.fsName,size:item.length});}}return JSON.stringify({success:true,files:files});}catch(e){return JSON.stringify({success:false,error:e.toString()});}})()`;
                
                this.csInterface.evalScript(jsx, (result) => {
                    try {
                        if (!result || result === 'undefined') {
                            resolve([]);
                            return;
                        }
                        const parsed = JSON.parse(result);
                        if (parsed.success) {
                            resolve(parsed.files);
                        } else {
                            console.error("CEP scan error:", parsed.error);
                            resolve([]);
                        }
                    } catch(e) {
                        resolve([]);
                    }
                });
            });
        }

        makePlaceholder(name) {
            const safe = (name || 'Template').substring(0, 25).replace(/</g, '&lt;');
            return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect fill='%23222' width='200' height='120'/%3E%3Crect fill='%2300d4aa' x='0' y='0' width='4' height='120'/%3E%3Ctext fill='%23fff' x='50%25' y='50%25' text-anchor='middle' font-size='12'%3E" + safe + "%3C/text%3E%3C/svg%3E";
        }

        // Extract animated GIF preview from MOGRT zip (if present)
        // Returns base64 data URL or null
        extractGifPreview(mogrtPath) {
            try {
                if (!this.fs) return null;
                const data = this.fs.readFileSync(mogrtPath);
                let offset = 0;
                while (offset < data.length - 30) {
                    if (data[offset] === 0x50 && data[offset+1] === 0x4B &&
                        data[offset+2] === 0x03 && data[offset+3] === 0x04) {
                        const compression = data.readUInt16LE(offset + 8);
                        const compSize    = data.readUInt32LE(offset + 18);
                        const uncompSize  = data.readUInt32LE(offset + 22);
                        const nameLen     = data.readUInt16LE(offset + 26);
                        const extraLen    = data.readUInt16LE(offset + 28);
                        const fileName    = data.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
                        const dataStart   = offset + 30 + nameLen + extraLen;

                        if (/\.gif$/i.test(fileName)) {
                            if (compression === 0 && uncompSize > 0) {
                                const imgData = data.slice(dataStart, dataStart + uncompSize);
                                return 'data:image/gif;base64,' + imgData.toString('base64');
                            } else if (compression === 8) {
                                try {
                                    const zlib = require('zlib');
                                    const compressed = data.slice(dataStart, dataStart + compSize);
                                    const decompressed = zlib.inflateRawSync(compressed);
                                    return 'data:image/gif;base64,' + decompressed.toString('base64');
                                } catch(e) {
                                    console.warn('[extractGifPreview] zlib error:', e.message);
                                }
                            }
                        }
                        offset = dataStart + compSize;
                    } else {
                        offset++;
                    }
                }
                return null;
            } catch(e) {
                console.warn('[extractGifPreview] error:', e.message);
                return null;
            }
        }

        getDemos() {
            return [
                {id:"d1",name:"Demo Title",category:"Titles",thumbnail:this.makePlaceholder("Demo"),duration:"00:00:05:00",width:1920,height:1080,fullPath:"/demo.mogrt",fileSize:"0 KB",isDemo:true},
                {id:"d2",name:"Demo Lower Third",category:"Lower Thirds",thumbnail:this.makePlaceholder("Demo"),duration:"00:00:05:00",width:1920,height:1080,fullPath:"/demo.mogrt",fileSize:"0 KB",isDemo:true}
            ];
        }

        getDemoTemplates() { return this.getDemos(); }
        setManualPath(path) { this.manualPath = path; }
    }

    window.MogrtScanner = MogrtScanner;
    console.log('✓ MogrtScanner v4.0 loaded');
})();