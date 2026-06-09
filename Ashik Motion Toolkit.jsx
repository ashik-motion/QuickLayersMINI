/*
    Ashik Motion Toolkit.jsx — v1.3.2
    ============================================================
    Dockable ScriptUI panel for Adobe After Effects (CC 2018+)

    Changelog (newest first):
      v1.3.2 — 2026-06-10
        · Fix: "undefined is not an object" crash at line 333 — onDraw now
               guards against null size/graphics before the panel is laid out.

      v1.3.1 — 2026-06-10
        · Fix: "preview.notify is undefined" crash on launch — panel onDraw
               now uses a safe redrawGraph() fallback for all AE versions.

      v1.3.0 — 2026-06-09
        · Fix: Easing sets speed=0 (standard AE ease; removes cross-property
               unit artifacts). Speed slider removed — influence only.
        · Fix: Preset apply no longer duplicates sub-groups inside effects.
        · Fix: Preset capture now stores keyframe data and expressions.
        · Fix: Clipboard copy uses temp-file pipe on all platforms (handles
               special chars, quotes, and newlines correctly).
        · New: Influence value persists across AE sessions (app.settings).
        · New: Speed graph colors adapt to AE light/dark theme.
        · Refactor: VERSION constant; logic extracted outside buildUI.

      v1.2
        · Added Ease In & Ease In-Out
        · Speed Graph grid + axis ticks + labels
        · Preset Export / Import (JSON)

      v1.0
        · Initial release

    Install:
      1) Copy to:  <AE install>/Scripts/ScriptUI Panels/
      2) Restart AE → Window ▸ Ashik Motion Toolkit
*/

(function AshikMotionToolkit(thisObj) {

    var VERSION     = "1.3.2";
    var SCRIPT_NAME = "Ashik Motion Toolkit";
    var SETTINGS_NS = "AshikMotionToolkit";
    var PRESET_DIR  = Folder.userData.fullName + "/AshikMotion";
    var PRESET_FILE = PRESET_DIR + "/presets.json";

    // =========================================================================
    // SETTINGS PERSISTENCE
    // =========================================================================
    function saveSetting(key, val) {
        try { app.settings.saveSetting(SETTINGS_NS, key, String(val)); } catch(e) {}
    }
    function loadSetting(key, def) {
        try {
            if (app.settings.haveSetting(SETTINGS_NS, key))
                return Number(app.settings.getSetting(SETTINGS_NS, key)) || def;
        } catch(e) {}
        return def;
    }

    // =========================================================================
    // PRESET STORE
    // =========================================================================
    function ensurePresetStore() {
        var dir = new Folder(PRESET_DIR);
        if (!dir.exists) dir.create();
        var f = new File(PRESET_FILE);
        if (!f.exists) { f.open("w"); f.write(JSON.stringify({ presets: [] }, null, 2)); f.close(); }
        return f;
    }
    function readPresets() {
        var f = ensurePresetStore();
        f.open("r"); var txt = f.read(); f.close();
        try { return JSON.parse(txt); } catch(e) { return { presets: [] }; }
    }
    function writePresets(db) {
        var f = ensurePresetStore();
        f.open("w"); f.write(JSON.stringify(db, null, 2)); f.close();
    }

    // =========================================================================
    // AE HELPERS
    // =========================================================================
    function getActiveComp() {
        return (app.project && app.project.activeItem instanceof CompItem)
            ? app.project.activeItem : null;
    }
    function getSelectedLayer() {
        var c = getActiveComp();
        return (c && c.selectedLayers && c.selectedLayers.length > 0) ? c.selectedLayers[0] : null;
    }
    function countKeyframes(layer) {
        var total = 0;
        function walk(group) {
            for (var i = 1; i <= group.numProperties; i++) {
                var p = group.property(i);
                if (p.propertyType === PropertyType.PROPERTY && p.isTimeVarying) total += p.numKeys;
                if (p.propertyType === PropertyType.INDEXED_GROUP ||
                    p.propertyType === PropertyType.NAMED_GROUP) walk(p);
            }
        }
        walk(layer);
        return total;
    }
    function countEffects(layer) {
        var fx = layer.property("ADBE Effect Parade");
        return fx ? fx.numProperties : 0;
    }
    function listEffects(layer) {
        var arr = [], fx = layer.property("ADBE Effect Parade");
        if (!fx) return arr;
        for (var i = 1; i <= fx.numProperties; i++) {
            var e = fx.property(i);
            arr.push(e.matchName + " :: " + e.name);
        }
        return arr;
    }

    // =========================================================================
    // EASING — speed always 0 (standard AE ease; no cross-property unit issues)
    // =========================================================================
    function applyEaseToSelection(mode, influence) {
        var comp = getActiveComp(); if (!comp) return 0;
        var numTweaked = 0;
        app.beginUndoGroup("Ashik Ease " + mode.toUpperCase());
        for (var i = 0; i < comp.selectedProperties.length; i++) {
            var prop = comp.selectedProperties[i];
            if (prop.propertyType !== PropertyType.PROPERTY) continue;
            if (!prop.isTimeVarying) continue;
            var selKeys = prop.selectedKeys;
            if (!selKeys || selKeys.length === 0) continue;
            for (var k = 0; k < selKeys.length; k++) {
                var idx    = selKeys[k];
                var inArr  = prop.keyInTemporalEase(idx);
                var outArr = prop.keyOutTemporalEase(idx);
                if (mode === 'out' || mode === 'inout') {
                    for (var j = 0; j < outArr.length; j++) {
                        outArr[j].influence = influence;
                        outArr[j].speed     = 0;
                    }
                }
                if (mode === 'in' || mode === 'inout') {
                    for (var j2 = 0; j2 < inArr.length; j2++) {
                        inArr[j2].influence = influence;
                        inArr[j2].speed     = 0;
                    }
                }
                prop.setTemporalEaseAtKey(idx, inArr, outArr);
                try {
                    prop.setInterpolationTypeAtKey(
                        idx,
                        KeyframeInterpolationType.BEZIER,
                        KeyframeInterpolationType.BEZIER
                    );
                } catch(e) {}
                numTweaked++;
            }
        }
        app.endUndoGroup();
        return numTweaked;
    }

    // =========================================================================
    // PRESET CAPTURE / APPLY
    // =========================================================================
    function captureEffects(layer) {
        var fx = layer.property("ADBE Effect Parade");
        var preset = { name: layer.name + " – Effects", version: VERSION, effects: [] };
        if (!fx) return preset;

        function dumpProp(p) {
            if (p.propertyType === PropertyType.PROPERTY) {
                var val; try { val = p.value; } catch(e) { val = null; }
                var expr = '';
                try { if (p.expressionEnabled) expr = p.expression; } catch(e) {}
                var keys = [];
                try {
                    for (var k = 1; k <= p.numKeys; k++) {
                        var kInEase  = p.keyInTemporalEase(k);
                        var kOutEase = p.keyOutTemporalEase(k);
                        var kVal; try { kVal = p.keyValue(k); } catch(e) { kVal = null; }
                        keys.push({
                            time:      p.keyTime(k),
                            value:     kVal,
                            inEase:    { speed: kInEase[0].speed,  influence: kInEase[0].influence  },
                            outEase:   { speed: kOutEase[0].speed, influence: kOutEase[0].influence },
                            inInterp:  p.keyInInterpolationType(k),
                            outInterp: p.keyOutInterpolationType(k)
                        });
                    }
                } catch(e) {}
                return {
                    name: p.name, matchName: p.matchName,
                    value: val, expression: expr, keys: keys,
                    dim: (p.value && p.value.length) ? p.value.length : 1
                };
            } else {
                var children = [];
                for (var i = 1; i <= p.numProperties; i++) children.push(dumpProp(p.property(i)));
                return { name: p.name, matchName: p.matchName, children: children };
            }
        }

        for (var i = 1; i <= fx.numProperties; i++) {
            var e = fx.property(i);
            var child = dumpProp(e);
            child.effectName = e.name;
            preset.effects.push(child);
        }
        return preset;
    }

    function applyPresetToLayer(preset, layer) {
        if (!preset || !layer) return;
        app.beginUndoGroup("Apply Ashik Preset");
        var fxParade = layer.property("ADBE Effect Parade");
        if (!fxParade) fxParade = layer.addProperty("ADBE Effect Parade");

        // isTopEffect=true  → always addProperty (each effect is always a fresh add)
        // isTopEffect=false → navigate to existing sub-group, never re-add (prevents duplication)
        function setValues(groupParent, node, isTopEffect) {
            if (node.children && node.children.length) {
                var tgt = null;
                if (isTopEffect) {
                    try { tgt = groupParent.addProperty(node.matchName); } catch(e) {}
                } else {
                    tgt = groupParent.property(node.matchName) || groupParent.property(node.name);
                }
                if (tgt && node.effectName) try { tgt.name = node.effectName; } catch(e) {}
                if (!tgt) return;
                for (var i = 0; i < node.children.length; i++) {
                    setValues(tgt, node.children[i], false);
                }
            } else {
                var tgtProp = groupParent.property(node.matchName) || groupParent.property(node.name);
                if (!tgtProp) return;
                if (node.expression) {
                    try { tgtProp.expressionEnabled = true; tgtProp.expression = node.expression; } catch(e) {}
                } else if (node.keys && node.keys.length > 0) {
                    for (var k = 0; k < node.keys.length; k++) {
                        var kd = node.keys[k];
                        if (kd.value === null || kd.value === undefined) continue;
                        try { tgtProp.setValueAtTime(kd.time, kd.value); } catch(e) {}
                    }
                } else if (node.value !== null && node.value !== undefined) {
                    try { tgtProp.setValue(node.value); } catch(e) {}
                }
            }
        }

        for (var i = 0; i < preset.effects.length; i++) {
            setValues(fxParade, preset.effects[i], true);
        }
        app.endUndoGroup();
    }

    // =========================================================================
    // CLIPBOARD — temp-file pipe; handles special chars on all platforms
    // =========================================================================
    function copyTextToClipboard(text) {
        try {
            var tmp = new File(Folder.temp.fullName + "/amt_clip.txt");
            tmp.open("w"); tmp.write(text); tmp.close();
            if ($.os.indexOf('Windows') >= 0) {
                system.callSystem('cmd /c clip < "' + tmp.fsName + '"');
            } else {
                system.callSystem('cat "' + tmp.fsName + '" | pbcopy');
            }
            tmp.remove();
        } catch(e) {}
    }

    // =========================================================================
    // UI
    // =========================================================================
    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " v" + VERSION, undefined, { resizeable: true });
        if (!pal) return pal;
        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];

        // Detect AE light/dark theme for graph colors
        var gc = {
            bg:    [0.12, 0.12, 0.12],
            grid:  [0.22, 0.22, 0.22],
            axis:  [0.35, 0.35, 0.35],
            label: [0.60, 0.60, 0.60],
            curve: [0.15, 0.45, 0.95]
        };
        try {
            var tc = app.themeColor(0);
            if ((tc[0] + tc[1] + tc[2]) / 3 > 0.5) {
                gc.bg    = [0.85, 0.85, 0.85];
                gc.grid  = [0.72, 0.72, 0.72];
                gc.axis  = [0.50, 0.50, 0.50];
                gc.label = [0.25, 0.25, 0.25];
                gc.curve = [0.10, 0.35, 0.85];
            }
        } catch(e) {}

        // Header
        var hdr = pal.add("group");
        hdr.orientation = "row"; hdr.alignment = ["fill", "top"]; hdr.spacing = 8;
        hdr.add("statictext", undefined, SCRIPT_NAME + " v" + VERSION);
        var btnRefresh = hdr.add("button", undefined, "Refresh");

        var tabs = pal.add("tabbedpanel");
        tabs.alignChildren = ["fill", "fill"];
        tabs.preferredSize = [460, 300];

        // ── Tab 1: Layer Info ────────────────────────────────────────────────
        var tabInfo = tabs.add("tab", undefined, "Layer Info");
        tabInfo.orientation = "column"; tabInfo.alignChildren = ["fill", "top"]; tabInfo.margins = 12;
        var infoTxt = tabInfo.add("edittext", undefined, "Select a layer to see details…",
                                  { multiline: true, readonly: true });
        infoTxt.preferredSize.height = 220;
        var btnCopyInfo = tabInfo.add("button", undefined, "Copy Info");

        // ── Tab 2: Easing ────────────────────────────────────────────────────
        var tabEase = tabs.add("tab", undefined, "Easing");
        tabEase.orientation = "column"; tabEase.alignChildren = ["fill", "top"]; tabEase.margins = 12;

        var easeGrpTop = tabEase.add("group");
        easeGrpTop.orientation = "row"; easeGrpTop.alignChildren = ["left", "center"]; easeGrpTop.spacing = 10;
        easeGrpTop.add("statictext", undefined, "Influence:");
        var initInf    = loadSetting("influence", 66);
        var sInfluence = easeGrpTop.add("slider", undefined, initInf, 0, 100);
        sInfluence.preferredSize.width = 260;
        var stInfluence = easeGrpTop.add("statictext", [0, 0, 36, 20], String(Math.round(initInf)));

        // Value graph — shows ease in-out S-curve driven by influence (speed=0)
        var preview = tabEase.add("panel", undefined, "Value Graph (Ease In-Out)");
        preview.preferredSize.height = 160;
        preview.onDraw = function() {
            var g = this.graphics;
            if (!g || !this.size) return;
            var w = this.size[0], h = this.size[1];
            if (!w || !h) return;
            var pad = 18, x0 = pad, x1 = w - pad, y0 = h - pad, y1 = pad;

            g.brush = g.newBrush(g.BrushType.SOLID_COLOR, gc.bg);
            g.pen   = g.newPen(g.PenType.SOLID_COLOR, gc.bg, 1);
            g.rectPath(0, 0, w, h); g.fillPath(g.brush);

            g.pen = g.newPen(g.PenType.SOLID_COLOR, gc.grid, 1);
            var i;
            for (i = 0; i <= 6; i++) {
                var xx = x0 + (x1-x0)*i/6;
                g.moveTo(xx, y0); g.lineTo(xx, y1); g.strokePath();
            }
            for (i = 0; i <= 4; i++) {
                var yy = y0 - (y0-y1)*i/4;
                g.moveTo(x0, yy); g.lineTo(x1, yy); g.strokePath();
            }

            g.pen = g.newPen(g.PenType.SOLID_COLOR, gc.axis, 1.2);
            g.moveTo(x0, y0); g.lineTo(x1, y0); g.strokePath();
            g.moveTo(x0, y0); g.lineTo(x0, y1); g.strokePath();

            g.font = ScriptUI.newFont("Arial", "REGULAR", 9);
            g.pen  = g.newPen(g.PenType.SOLID_COLOR, gc.label, 1);
            g.drawString("Time",  x1 - 24, y0 + 2);
            g.drawString("Value", x0 + 2,  y1 + 2);

            // Cubic bezier for ease in-out, speed=0 at both ends:
            // P0=(0,0) C1=(inf,0) C2=(1-inf,1) P3=(1,1)
            var inf = sInfluence.value / 100.0;
            var pA = [x0, y0], pD = [x1, y1];
            var c1 = [x0 + (x1-x0)*inf, y0];
            var c2 = [x1 - (x1-x0)*inf, y1];
            var steps = 64, pts = [], t;
            for (t = 0; t <= steps; t++) {
                var u = t/steps, uu = 1-u;
                pts.push([
                    uu*uu*uu*pA[0] + 3*uu*uu*u*c1[0] + 3*uu*u*u*c2[0] + u*u*u*pD[0],
                    uu*uu*uu*pA[1] + 3*uu*uu*u*c1[1] + 3*uu*u*u*c2[1] + u*u*u*pD[1]
                ]);
            }
            g.pen = g.newPen(g.PenType.SOLID_COLOR, gc.curve, 2.5);
            for (var i2 = 1; i2 < pts.length; i2++) {
                g.moveTo(pts[i2-1][0], pts[i2-1][1]);
                g.lineTo(pts[i2][0],   pts[i2][1]);
                g.strokePath();
            }
        };

        var btnRow = tabEase.add("group");
        btnRow.orientation = "row"; btnRow.alignChildren = ["left", "center"]; btnRow.spacing = 8;
        var btnEaseOut = btnRow.add("button", undefined, "Ease Out");
        var btnEaseIn  = btnRow.add("button", undefined, "Ease In");
        var btnEaseIO  = btnRow.add("button", undefined, "Ease In-Out");

        // ── Tab 3: Presets ───────────────────────────────────────────────────
        var tabPreset = tabs.add("tab", undefined, "Presets");
        tabPreset.orientation = "column"; tabPreset.alignChildren = ["fill", "top"]; tabPreset.margins = 12;

        var libGrp = tabPreset.add("group");
        libGrp.orientation = "row"; libGrp.alignChildren = ["fill", "center"]; libGrp.spacing = 6;
        var ddPresets = libGrp.add("dropdownlist", undefined, []);
        ddPresets.preferredSize.width = 280;
        var btnReload = libGrp.add("button", undefined, "↻");
        var btnApply  = libGrp.add("button", undefined, "Apply");

        var crud = tabPreset.add("group");
        crud.orientation = "row"; crud.alignChildren = ["left", "center"]; crud.spacing = 6;
        var btnSave   = crud.add("button", undefined, "Save from Layer");
        var btnRename = crud.add("button", undefined, "Rename");
        var btnDup    = crud.add("button", undefined, "Duplicate");
        var btnDel    = crud.add("button", undefined, "Delete");

        var ioGrp = tabPreset.add("group"); ioGrp.spacing = 6;
        var btnExport = ioGrp.add("button", undefined, "Export JSON…");
        var btnImport = ioGrp.add("button", undefined, "Import JSON…");

        // notify() is absent on panel elements in some AE versions — call onDraw directly as fallback
        function redrawGraph() {
            if (typeof preview.notify === 'function') {
                redrawGraph();
            } else if (typeof preview.onDraw === 'function') {
                preview.onDraw();
            }
        }

        // ── Wiring ───────────────────────────────────────────────────────────
        function refreshInfo() {
            var c = getActiveComp(), l = getSelectedLayer();
            if (!c) { infoTxt.text = "Open a comp and select a layer."; return; }
            if (!l) { infoTxt.text = "Select a layer to view details.";  return; }
            var t = [];
            t.push("Comp: " + c.name);
            t.push("FPS:  " + c.frameRate);
            t.push("Duration: " + c.duration.toFixed(3) + "s");
            t.push("");
            t.push("Layer: " + l.name + " (#" + l.index + ")");
            t.push("In/Out: " + l.inPoint.toFixed(3) + "s / " + l.outPoint.toFixed(3) + "s");
            t.push("Effects: " + countEffects(l));
            var fxList = listEffects(l);
            if (fxList.length) t.push("  - " + fxList.join("\n  - "));
            t.push("Keyframes (total): " + countKeyframes(l));
            infoTxt.text = t.join("\n");
        }

        function reloadDropdown() {
            var db = readPresets(); ddPresets.removeAll();
            for (var i = 0; i < db.presets.length; i++) ddPresets.add("item", db.presets[i].name);
            if (db.presets.length) ddPresets.selection = 0;
        }

        function selectedIdx() { return ddPresets.selection ? ddPresets.selection.index : -1; }

        // Info
        btnRefresh.onClick  = refreshInfo;
        btnCopyInfo.onClick = function() { copyTextToClipboard(infoTxt.text); };

        // Easing
        sInfluence.onChanging = function() {
            var v = Math.round(this.value);
            stInfluence.text = String(v);
            saveSetting("influence", v);
            redrawGraph();
        };
        btnEaseOut.onClick = function() {
            alert(applyEaseToSelection('out',   Math.round(sInfluence.value)) + " key(s) eased OUT.");
        };
        btnEaseIn.onClick  = function() {
            alert(applyEaseToSelection('in',    Math.round(sInfluence.value)) + " key(s) eased IN.");
        };
        btnEaseIO.onClick  = function() {
            alert(applyEaseToSelection('inout', Math.round(sInfluence.value)) + " key(s) eased IN-OUT.");
        };

        // Presets
        btnReload.onClick = reloadDropdown;
        btnApply.onClick  = function() {
            var idx = selectedIdx(); if (idx < 0) { alert("No preset selected."); return; }
            var l = getSelectedLayer(); if (!l) { alert("Select a layer."); return; }
            applyPresetToLayer(readPresets().presets[idx], l);
        };
        btnSave.onClick   = function() {
            var l = getSelectedLayer(); if (!l) { alert("Select a layer."); return; }
            var p = captureEffects(l);
            var newName = prompt("Preset name:", p.name); if (!newName) return;
            p.name = newName;
            var db = readPresets(); db.presets.push(p); writePresets(db); reloadDropdown();
        };
        btnRename.onClick = function() {
            var idx = selectedIdx(); if (idx < 0) { alert("Select a preset."); return; }
            var db = readPresets();
            var nn = prompt("Rename preset:", db.presets[idx].name); if (!nn) return;
            db.presets[idx].name = nn; writePresets(db); reloadDropdown();
        };
        btnDup.onClick    = function() {
            var idx = selectedIdx(); if (idx < 0) { alert("Select a preset."); return; }
            var db = readPresets();
            var cp = JSON.parse(JSON.stringify(db.presets[idx]));
            cp.name += " copy"; db.presets.splice(idx + 1, 0, cp); writePresets(db); reloadDropdown();
        };
        btnDel.onClick    = function() {
            var idx = selectedIdx(); if (idx < 0) { alert("Select a preset."); return; }
            var db = readPresets();
            if (!confirm("Delete preset '" + db.presets[idx].name + "'?")) return;
            db.presets.splice(idx, 1); writePresets(db); reloadDropdown();
        };
        btnExport.onClick = function() {
            var db = readPresets();
            var f = File.saveDialog("Export presets JSON", "JSON:*.json"); if (!f) return;
            f.open("w"); f.write(JSON.stringify(db, null, 2)); f.close();
            alert("Exported to:\n" + f.fsName);
        };
        btnImport.onClick = function() {
            var f = File.openDialog("Import presets JSON", "JSON:*.json"); if (!f) return;
            f.open("r"); var txt = f.read(); f.close();
            var incoming;
            try { incoming = JSON.parse(txt); } catch(e) { alert("Invalid JSON."); return; }
            if (!incoming || !incoming.presets || !incoming.presets.length) {
                alert("No presets found in file."); return;
            }
            var valid = [];
            for (var i = 0; i < incoming.presets.length; i++) {
                var p = incoming.presets[i];
                if (p && p.name && p.effects) valid.push(p);
            }
            if (!valid.length) { alert("No valid presets found in file."); return; }
            var db = readPresets();
            db.presets = db.presets.concat(valid);
            writePresets(db); reloadDropdown();
            alert("Imported " + valid.length + " preset(s).");
        };

        // Init
        reloadDropdown(); refreshInfo(); redrawGraph();
        pal.layout.layout(true);
        pal.onResize = function() { this.layout.resize(); redrawGraph(); };
        return pal;
    }

    // Bootstrap
    var ui = buildUI(thisObj);
    if (ui && ui instanceof Window) { ui.center(); ui.show(); }

})(this);
