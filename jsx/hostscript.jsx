// hostscript.jsx - iNNO FUSION
// ExtendScript (ES3 compatible) - NO modern JS syntax

var Innofusion = Innofusion || {};

// Safe JSON stringify for ExtendScript
Innofusion._json = function(obj) {
    var t = typeof obj;
    if (obj === null) return 'null';
    if (t === 'boolean') return obj ? 'true' : 'false';
    if (t === 'number') return isFinite(obj) ? String(obj) : 'null';
    if (t === 'string') {
        return '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    }
    if (t === 'object') {
        var parts = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                parts.push('"' + k + '":' + Innofusion._json(obj[k]));
            }
        }
        return '{' + parts.join(',') + '}';
    }
    return 'null';
};

// Simple test - no JSON.stringify, no app access
Innofusion.test = function() {
    var hasApp = (typeof app !== 'undefined') ? 'YES' : 'NO';
    var hasSeq = 'NO';
    var seqName = 'none';
    try {
        if (typeof app !== 'undefined' && app.project && app.project.activeSequence) {
            hasSeq = 'YES';
            seqName = app.project.activeSequence.name;
        }
    } catch(e) {}
    return Innofusion._json({
        success: true,
        message: 'JSX OK',
        hasApp: hasApp,
        hasSequence: hasSeq,
        sequenceName: seqName
    });
};

Innofusion.checkFile = function(filePath) {
    try {
        var f = new File(filePath);
        return Innofusion._json({
            success: true,
            exists: f.exists,
            fsName: f.fsName
        });
    } catch(e) {
        return Innofusion._json({ success: false, message: e.toString() });
    }
};

Innofusion.getPlayheadTime = function() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return Innofusion._json({ success: false, message: 'No active sequence' });
        var pos = seq.getPlayerPosition();
        return Innofusion._json({ success: true, ticks: pos.ticks, seconds: pos.seconds });
    } catch(e) {
        return Innofusion._json({ success: false, message: e.toString() });
    }
};

Innofusion.importMogrt = function(filePath, vidTrack, audTrack) {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return Innofusion._json({ success: false, message: 'No active sequence. Open a sequence first.' });

        var f = new File(filePath);
        if (!f.exists) return Innofusion._json({ success: false, message: 'File not found: ' + filePath });

        var pos = seq.getPlayerPosition();
        var vt = (typeof vidTrack === 'number') ? vidTrack : 0;
        var at = (typeof audTrack === 'number') ? audTrack : 0;

        var item = seq.importMGT(f.fsName, pos.ticks, vt, at);

        if (item) {
            return Innofusion._json({ success: true, message: 'Imported OK' });
        } else {
            return Innofusion._json({ success: false, message: 'importMGT returned null. Your .mogrt must be created in After Effects, not Premiere Pro.' });
        }
    } catch(e) {
        return Innofusion._json({ success: false, message: e.toString() });
    }
};
