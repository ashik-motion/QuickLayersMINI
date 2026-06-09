// QuickLayers MINI
// Version: 1.2.0
// Layer creators + FX tools + Utilities + Project tools + Animation tools
// Author: Ashik
//
// Changelog:
// v1.2.0 - Added Label Color, Time Remap, Trim to Work Area (Layer section)
//        - Added Gaussian Blur (FX section)
//        - Added Animation section: Wiggle, Loop, Bounce expressions + Hold Keyframes
//        - Added Import Footage, New Comp from Selection, Clean Project (Project section)
// v1.1.0 - Fixed Un-precompose function (now uses Copy/Paste approach)
// v1.0.9 - Removed complex scrollbar (wasn't working), simplified UI structure
// v1.0.8 - Fixed Pre-compose button (separated into Pre-compose and Un-precompose buttons)
// v1.0.7 - Merged Layer and Utilities sections into one
// v1.0.6 - Added scrollbar for when sections overflow panel height
// v1.0.5 - Added Export H.264, Export Alpha (PNG with transparency), Audio Panel button
// v1.0.4 - Entire section header area is now clickable (not just text)
// v1.0.3 - All buttons now show full names instead of abbreviations/icons
// v1.0.2 - Fixed section headers left-alignment (using statictext instead of button)
// v1.0.1 - Section headers left-aligned (didn't work)
// v1.0.0 - Initial release with accordion UI

(function QL_Mini_Slim_All(thisObj){

// ---------- Helpers ----------
function getActiveComp(){
    var c = app.project && app.project.activeItem;
    if(!(c && c instanceof CompItem)){ alert("No active composition selected."); return null; }
    return c;
}
function getSelection(){
    var c = getActiveComp(); if(!c) return null;
    var sel = c.selectedLayers;
    if(!sel || sel.length===0){ alert("Select at least one layer."); return null; }
    return sel;
}
function addOrGetEffect(layer, matchNames){
    var fxParade = layer.property("ADBE Effect Parade");
    if(!fxParade) return null;
    for(var i=1;i<=fxParade.numProperties;i++){
        var p = fxParade.property(i);
        try{
            for(var k=0;k<matchNames.length;k++){
                if(p.matchName === matchNames[k]) return p;
            }
        }catch(e){}
    }
    for(var j=0;j<matchNames.length;j++){
        try{
            var added = fxParade.addProperty(matchNames[j]);
            if(added) return added;
        }catch(e){}
    }
    return null;
}
function applyEffectToSelection(matchNames, label){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: "+label);
    for(var i=0;i<sel.length;i++){ try{ addOrGetEffect(sel[i], matchNames); }catch(e){} }
    app.endUndoGroup();
}

// ---------- Utilities ----------

function centerAnchorSelected(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Center Anchor");
    for (var i=0;i<sel.length;i++){
        var L = sel[i];
        var oldAP = L.property("Anchor Point") ? L.property("Anchor Point").value : [0,0,0];
        var oldPos = L.property("Position") ? L.property("Position").value : [0,0,0];
        var scale = L.property("Scale") ? L.property("Scale").value : [100,100,100];
        var newAP;
        try{
            if (L.sourceRectAtTime){
                var t = L.containingComp ? L.containingComp.time : 0;
                var r = L.sourceRectAtTime(t, false);
                newAP = [r.left + r.width/2, r.top + r.height/2];
            } else if (L.source){
                newAP = [L.source.width/2, L.source.height/2];
            } else { newAP = [0,0]; }
        }catch(e){ newAP = [0,0]; }
        try{ L.property("Anchor Point").setValue([newAP[0], newAP[1]]); }catch(e){}
        try{
            var dx = (newAP[0] - oldAP[0]) * (scale[0]/100.0);
            var dy = (newAP[1] - oldAP[1]) * (scale[1]/100.0);
            if (oldPos.length === 2)
                L.property("Position").setValue([oldPos[0] + dx, oldPos[1] + dy]);
            else
                L.property("Position").setValue([oldPos[0] + dx, oldPos[1] + dy, oldPos[2]]);
        }catch(e){}
    }
    app.endUndoGroup();
}

function getNextPrecompName() {
    var prefix = "Pre-compose ";
    var used = {};
    try {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name.indexOf(prefix) === 0) {
                var tail = it.name.substr(prefix.length).trim();
                var num = parseInt(tail, 10);
                if (!isNaN(num)) used[num] = true;
            }
        }
    } catch (e) {}
    var n = 1;
    while (used[n]) n++;
    return prefix + (n < 100 ? ("0" + n).slice(-2) : String(n));
}

function precomposeSelected(){
    var c = getActiveComp(); if(!c) return;
    if(!c.selectedLayers || c.selectedLayers.length===0){ alert("Select at least one layer to pre-compose."); return; }
    var idx = [];
    for (var i=0;i<c.selectedLayers.length;i++) idx.push(c.selectedLayers[i].index);
    idx.sort(function(a,b){ return a - b; });
    var defaultName = getNextPrecompName();
    var dlg = new Window('dialog', 'Pre-compose Name');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.spacing = 10;
    dlg.margins = 16;
    dlg.add('group').add('statictext', undefined, 'Enter pre-compose name:');
    var inputGrp = dlg.add('group');
    inputGrp.alignChildren = ['fill', 'center'];
    var nameInput = inputGrp.add('edittext', undefined, defaultName);
    nameInput.characters = 25;
    nameInput.active = true;
    var btnGrp = dlg.add('group');
    btnGrp.alignment = ['center', 'top'];
    var okBtn = btnGrp.add('button', undefined, 'OK', {name: 'ok'});
    var cancelBtn = btnGrp.add('button', undefined, 'Cancel', {name: 'cancel'});
    nameInput.addEventListener('focus', function(){ this.selection = [0, this.text.length]; });
    okBtn.onClick = function(){ dlg.close(1); };
    cancelBtn.onClick = function(){ dlg.close(0); };
    nameInput.onEnterKey = function(){ dlg.close(1); };
    if(dlg.show() !== 1) return;
    var name = nameInput.text.replace(/^\s+|\s+$/g, '');
    if(name === ''){ alert("Name cannot be empty."); return; }
    app.beginUndoGroup("QL: Pre-compose");
    try{ c.layers.precompose(idx, name, true); }catch(e){ alert("Pre-compose failed: "+e.toString()); }
    app.endUndoGroup();
}

function unPrecomposeSelected(){
    var c = getActiveComp(); if(!c) return;
    if(!c.selectedLayers || c.selectedLayers.length===0){ alert("Select a pre-comp layer to un-precompose."); return; }
    var layer = c.selectedLayers[0];
    if(!layer.source || !(layer.source instanceof CompItem)){ alert("Selected layer is not a pre-comp."); return; }
    var preComp = layer.source;
    var preCompLayer = layer;
    var insertIndex = preCompLayer.index;
    var preCompStart = preCompLayer.startTime;
    app.beginUndoGroup("QL: Un-precompose");
    try{
        for(var i = 1; i <= preComp.numLayers; i++){ preComp.layer(i).selected = true; }
        app.executeCommand(app.findMenuCommandId("Copy"));
        for(var j = 1; j <= c.numLayers; j++){ c.layer(j).selected = false; }
        app.project.activeItem = c;
        app.executeCommand(app.findMenuCommandId("Paste"));
        var pastedLayers = c.selectedLayers;
        for(var k = 0; k < pastedLayers.length; k++){
            pastedLayers[k].startTime = pastedLayers[k].startTime + preCompStart;
        }
        for(var m = 0; m < pastedLayers.length; m++){
            pastedLayers[m].moveAfter(c.layer(insertIndex));
        }
        preCompLayer.remove();
        alert("Un-precompose complete!\n" + pastedLayers.length + " layer(s) extracted.");
    }catch(e){ alert("Un-precompose failed: "+e.toString()); }
    app.endUndoGroup();
}

// ---------- Layer Tools ----------

function duplicateAndRename(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Duplicate + Rename");
    for(var i = 0; i < sel.length; i++){
        var layer = sel[i];
        var baseName = layer.name;
        var nameMatch = baseName.match(/^(.+?)(\s*\d+)?$/);
        var cleanName = nameMatch ? nameMatch[1].replace(/\s+$/, '') : baseName;
        var comp = layer.containingComp;
        var num = 2;
        var newName;
        var exists = true;
        while(exists){
            newName = cleanName + " " + num;
            exists = false;
            for(var j = 1; j <= comp.numLayers; j++){
                if(comp.layer(j).name === newName){ exists = true; num++; break; }
            }
        }
        layer.duplicate().name = newName;
    }
    app.endUndoGroup();
}

function reverseLayerOrder(){
    var c = getActiveComp(); if(!c) return;
    var sel = c.selectedLayers;
    if(!sel || sel.length < 2){ alert("Select at least 2 layers to reverse order."); return; }
    app.beginUndoGroup("QL: Reverse Layer Order");
    var indices = [];
    for(var i = 0; i < sel.length; i++) indices.push(sel[i].index);
    indices.sort(function(a, b){ return a - b; });
    var layers = [];
    for(var j = 0; j < indices.length; j++) layers.push(c.layer(indices[j]));
    for(var k = 0; k < layers.length; k++) layers[k].moveTo(indices[indices.length - 1 - k]);
    app.endUndoGroup();
}

function easyEaseAll(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Easy Ease All");
    for(var i = 0; i < sel.length; i++) applyEasyEaseToProps(sel[i]);
    app.endUndoGroup();
}

function applyEasyEaseToProps(layer){
    function processPropertyGroup(propGroup){
        if(!propGroup) return;
        for(var i = 1; i <= propGroup.numProperties; i++){
            var prop = propGroup.property(i);
            try{
                if(prop.propertyType === PropertyType.PROPERTY){
                    if(prop.numKeys > 0 && prop.canVaryOverTime){
                        for(var k = 1; k <= prop.numKeys; k++){
                            try{ prop.setTemporalEaseAtKey(k, [new KeyframeEase(0, 33)], [new KeyframeEase(0, 33)]); }catch(e){}
                        }
                    }
                } else if(prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP){
                    processPropertyGroup(prop);
                }
            }catch(e){}
        }
    }
    processPropertyGroup(layer);
}

function fitToComp(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Fit to Comp");
    for(var i = 0; i < sel.length; i++){
        var layer = sel[i];
        var comp = layer.containingComp;
        try{
            var sourceWidth, sourceHeight;
            if(layer.sourceRectAtTime){
                var rect = layer.sourceRectAtTime(comp.time, false);
                sourceWidth = rect.width; sourceHeight = rect.height;
            } else if(layer.source){
                sourceWidth = layer.source.width; sourceHeight = layer.source.height;
            } else { continue; }
            if(sourceWidth <= 0 || sourceHeight <= 0) continue;
            var scaleX = (comp.width / sourceWidth) * 100;
            var scaleY = (comp.height / sourceHeight) * 100;
            var scale = Math.max(scaleX, scaleY);
            layer.property("Scale").setValue([scale, scale]);
            layer.property("Position").setValue([comp.width/2, comp.height/2]);
        }catch(e){}
    }
    app.endUndoGroup();
}

function flipHorizontal(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Flip Horizontal");
    for(var i = 0; i < sel.length; i++){
        try{ var s = sel[i].property("Scale").value; sel[i].property("Scale").setValue([s[0]*-1, s[1]]); }catch(e){}
    }
    app.endUndoGroup();
}

function flipVertical(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Flip Vertical");
    for(var i = 0; i < sel.length; i++){
        try{ var s = sel[i].property("Scale").value; sel[i].property("Scale").setValue([s[0], s[1]*-1]); }catch(e){}
    }
    app.endUndoGroup();
}

// Label Color picker
function setLabelColor(){
    var sel = getSelection(); if(!sel) return;
    var labelNames = [
        "None","Red","Yellow","Aqua","Pink",
        "Lavender","Peach","Sea Foam","Blue","Green",
        "Purple","Orange","Brown","Fuchsia","Cyan",
        "Sandstone","Dark Green"
    ];
    var dlg = new Window('dialog', 'Label Color');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.spacing = 10;
    dlg.margins = 16;
    dlg.add('statictext', undefined, 'Select label color:');
    var dd = dlg.add('dropdownlist', undefined, labelNames);
    dd.selection = 0;
    var btnGrp = dlg.add('group');
    btnGrp.alignment = ['center', 'top'];
    var okBtn = btnGrp.add('button', undefined, 'OK', {name: 'ok'});
    var cancelBtn = btnGrp.add('button', undefined, 'Cancel', {name: 'cancel'});
    okBtn.onClick = function(){ dlg.close(1); };
    cancelBtn.onClick = function(){ dlg.close(0); };
    if(dlg.show() !== 1) return;
    var colorIndex = dd.selection.index;
    app.beginUndoGroup("QL: Label Color");
    for(var i = 0; i < sel.length; i++){ try{ sel[i].label = colorIndex; }catch(e){} }
    app.endUndoGroup();
}

// Time Remap
function enableTimeRemap(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Time Remap");
    for(var i = 0; i < sel.length; i++){ try{ sel[i].timeRemapEnabled = true; }catch(e){} }
    app.endUndoGroup();
}

// Trim to Work Area
function trimToWorkArea(){
    var c = getActiveComp(); if(!c) return;
    var sel = c.selectedLayers;
    if(!sel || sel.length === 0){ alert("Select at least one layer."); return; }
    app.beginUndoGroup("QL: Trim to Work Area");
    var wa_start = c.workAreaStart;
    var wa_end = c.workAreaStart + c.workAreaDuration;
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].inPoint = wa_start; sel[i].outPoint = wa_end; }catch(e){}
    }
    app.endUndoGroup();
}

// ---------- Animation ----------

// Wiggle expression on Position
function applyWiggleExpression(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Wiggle Expression");
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].property("Position").expression = "wiggle(2, 20)"; }catch(e){}
    }
    app.endUndoGroup();
}

// Loop expression on all animated properties (needs >= 2 keyframes)
function applyLoopExpression(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Loop Expression");
    for(var i = 0; i < sel.length; i++) applyLoopToProps(sel[i]);
    app.endUndoGroup();
}

function applyLoopToProps(layer){
    function processGroup(propGroup){
        if(!propGroup) return;
        for(var i = 1; i <= propGroup.numProperties; i++){
            var prop = propGroup.property(i);
            try{
                if(prop.propertyType === PropertyType.PROPERTY){
                    if(prop.numKeys >= 2 && prop.canVaryOverTime){
                        prop.expression = 'loopOut("cycle")';
                    }
                } else if(prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP){
                    processGroup(prop);
                }
            }catch(e){}
        }
    }
    processGroup(layer);
}


// Time expression: continuous auto-spin on Rotation (time * 90 = 90 degrees per second)
function applyTimeExpression(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Time Expression");
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].property("Rotation").expression = "time * 90"; }catch(e){}
    }
    app.endUndoGroup();
}

// Random expression: random opacity flicker between 50–100
function applyRandomExpression(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Random Expression");
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].property("Opacity").expression = "random(50, 100)"; }catch(e){}
    }
    app.endUndoGroup();
}

// Automatic Fade: fade in at layer start, fade out at layer end (15 frames)
function applyAutoFade(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Auto Fade");
    var expr = [
        'fadeFrames = 15;',
        'fadeIn  = thisComp.frameDuration * fadeFrames;',
        'fadeOut = thisComp.frameDuration * fadeFrames;',
        'if (time < inPoint + fadeIn)',
        '    linear(time, inPoint, inPoint + fadeIn, 0, 100);',
        'else if (time > outPoint - fadeOut)',
        '    linear(time, outPoint - fadeOut, outPoint, 100, 0);',
        'else',
        '    100;'
    ].join('\n');
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].property("Opacity").expression = expr; }catch(e){}
    }
    app.endUndoGroup();
}

// Motion Trail: position delay + opacity falloff based on layer index
function applyMotionTrail(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Motion Trail");
    var posExpr = [
        'delay = 5;',
        'd = delay * thisComp.frameDuration * (index - 1);',
        'thisComp.layer(1).position.valueAtTime(time - d);'
    ].join('\n');
    var opExpr = [
        'opacityFactor = .75;',
        'Math.pow(opacityFactor, index - 1) * 100;'
    ].join('\n');
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].property("Position").expression = posExpr; }catch(e){}
        try{ sel[i].property("Opacity").expression = opExpr; }catch(e){}
    }
    app.endUndoGroup();
}

// Blink: toggles opacity on/off every 0.5 seconds
function applyBlinkExpression(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Blink Expression");
    var expr = 'Math.floor(time * 2) % 2 === 0 ? 100 : 0;';
    for(var i = 0; i < sel.length; i++){
        try{ sel[i].property("Opacity").expression = expr; }catch(e){}
    }
    app.endUndoGroup();
}

// ---------- FX ----------
function addDropShadow(){ applyEffectToSelection(["ADBE Drop Shadow"], "Drop Shadow"); }
function addGlow(){ applyEffectToSelection(["ADBE Glo2", "ADBE Glow"], "Glow"); }
function fx_fill(){ applyEffectToSelection(["ADBE Fill"], "Fill"); }
function fx_tint(){ applyEffectToSelection(["ADBE Tint"], "Tint"); }
function fx_ramp(){ applyEffectToSelection(["ADBE Ramp"], "Gradient Ramp"); }
function fx_noise(){ applyEffectToSelection(["ADBE Noise"], "Noise"); }
function fx_lumetri(){ applyEffectToSelection(["ADBE Lumetri","ADBE Lumetri Color"], "Lumetri Color"); }
function fx_gaussianBlur(){ applyEffectToSelection(["ADBE Gaussian Blur 2","ADBE Gaussian Blur"], "Gaussian Blur"); }

// ---------- Project ----------

function saveSnapshot(){
    var c = getActiveComp(); if(!c) return;
    var file = File.saveDialog("Save Snapshot as PNG", "PNG:*.png");
    if(!file) return;
    var filePath = file.fsName;
    if(!/\.png$/i.test(filePath)) filePath += ".png";
    app.beginUndoGroup("QL: Snapshot");
    try{
        var rqi = app.project.renderQueue.items.add(c);
        var om = rqi.outputModule(1);
        try{ om.applyTemplate("PNG Sequence"); }catch(e){ try{ om.applyTemplate("Photoshop"); }catch(e2){} }
        om.file = new File(filePath);
        rqi.timeSpanStart = c.time;
        rqi.timeSpanDuration = c.frameDuration;
        alert("Snapshot added to Render Queue.\nFile: " + filePath + "\n\nRender the queue to save the image.");
    }catch(e){ alert("Snapshot failed: " + e.toString()); }
    app.endUndoGroup();
}

function addToRenderQueue(){
    var c = getActiveComp(); if(!c) return;
    app.beginUndoGroup("QL: Add to Render Queue");
    try{ app.project.renderQueue.items.add(c); app.executeCommand(2162); }catch(e){ alert("Failed to add to render queue: " + e.toString()); }
    app.endUndoGroup();
}

function collectFiles(){
    try{ app.executeCommand(2482); }catch(e){
        try{
            var id = app.findMenuCommandId("Collect Files...");
            if(!id) id = app.findMenuCommandId("Collect Files…");
            if(id) app.executeCommand(id);
            else alert("Could not find Collect Files command.");
        }catch(e2){ alert("Collect Files failed: " + e2.toString()); }
    }
}

function findMissingFootage(){
    var missing = [];
    for(var i = 1; i <= app.project.numItems; i++){
        var item = app.project.item(i);
        if(item instanceof FootageItem && item.footageMissing) missing.push(item.name);
    }
    if(missing.length === 0) alert("No missing footage found!");
    else alert("Missing Footage (" + missing.length + "):\n\n" + missing.join("\n"));
}

function exportH264(){
    var c = getActiveComp(); if(!c) return;
    app.beginUndoGroup("QL: Export H.264");
    try{
        var rqi = app.project.renderQueue.items.add(c);
        var om = rqi.outputModule(1);
        try{ om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); }catch(e){
            try{ om.applyTemplate("H.264"); }catch(e2){ try{ om.applyTemplate("Lossless"); }catch(e3){} }
        }
        app.executeCommand(2162);
        alert("Comp added to Render Queue.\n\nTip: For H.264, use 'File > Export > Add to Media Encoder Queue' for best results.");
    }catch(e){ alert("Export H.264 failed: " + e.toString()); }
    app.endUndoGroup();
}

function exportAlpha(){
    var c = getActiveComp(); if(!c) return;
    app.beginUndoGroup("QL: Export Alpha");
    try{
        var rqi = app.project.renderQueue.items.add(c);
        var om = rqi.outputModule(1);
        try{ om.applyTemplate("PNG Sequence with Alpha"); }catch(e){
            try{ om.applyTemplate("PNG Sequence"); }catch(e2){ try{ om.applyTemplate("Lossless with Alpha"); }catch(e3){} }
        }
        app.executeCommand(2162);
        alert("Comp added to Render Queue with Alpha.\n\nMake sure:\n• Channels: RGB + Alpha\n• Format: PNG Sequence or ProRes 4444");
    }catch(e){ alert("Export Alpha failed: " + e.toString()); }
    app.endUndoGroup();
}

// Import Footage via file dialog
function importFootage(){
    try{
        var files = File.openDialog("Import Footage", undefined, true);
        if(!files) return;
        app.beginUndoGroup("QL: Import Footage");
        if(files instanceof Array){
            for(var i = 0; i < files.length; i++){
                try{ app.project.importFile(new ImportOptions(files[i])); }catch(e){}
            }
        } else {
            app.project.importFile(new ImportOptions(files));
        }
        app.endUndoGroup();
    }catch(e){ alert("Import failed: " + e.toString()); }
}

// New Comp from selected footage item in Project panel
function newCompFromSelection(){
    var item = app.project.activeItem;
    if(!item || !(item instanceof FootageItem)){
        alert("Select a footage item in the Project panel first.");
        return;
    }
    app.beginUndoGroup("QL: New Comp from Selection");
    try{
        var w = (item.width > 0) ? item.width : 1920;
        var h = (item.height > 0) ? item.height : 1080;
        var pa = item.pixelAspect || 1;
        var dur = (item.duration > 0) ? item.duration : 10;
        var fr = 30;
        try{ if(item.frameRate > 0) fr = item.frameRate; }catch(e){}
        var comp = app.project.items.addComp(item.name, w, h, pa, dur, fr);
        comp.layers.add(item);
    }catch(e){ alert("New Comp from Selection failed: " + e.toString()); }
    app.endUndoGroup();
}

// Clean Project: remove unused footage
function cleanProject(){
    try{
        var id = app.findMenuCommandId("Remove Unused Footage");
        if(!id) id = app.findMenuCommandId("Remove Unused Footage...");
        if(!id) id = app.findMenuCommandId("Remove Unused Footage…");
        if(id){ app.executeCommand(id); return; }
        // Fallback: manual removal
        var removed = 0;
        for(var i = app.project.numItems; i >= 1; i--){
            var item = app.project.item(i);
            if(!(item instanceof FolderItem) && item.useCount === 0){
                try{ item.remove(); removed++; }catch(e){}
            }
        }
        alert("Clean Project complete.\n" + removed + " unused item(s) removed.");
    }catch(e){ alert("Clean Project failed: " + e.toString()); }
}

// Robust Purge opener
function openPurge(){
    var candidates = [
        "Purge Memory & Disk Cache…","Purge Memory & Disk Cache...",
        "Purge > All Memory & Disk Cache…","Purge > All Memory & Disk Cache...",
        "All Memory & Disk Cache…","All Memory & Disk Cache...",
        "Purge All Memory & Disk Cache…","Purge All Memory & Disk Cache...",
        "Edit > Purge > All Memory & Disk Cache",
        "Purge > All Memory","Purge All Memory","All Memory",
        "Purge > Image Cache Memory","Image Cache Memory",
        "Purge > Undo","Undo (Purge)"
    ];
    for (var i=0; i<candidates.length; i++){
        try{ var id = app.findMenuCommandId(candidates[i]); if(id){ app.executeCommand(id); return; } }catch(e){}
    }
    var prefCandidates = [
        "Open Preferences: Media & Disk Cache",
        "Preferences > Media & Disk Cache…","Preferences > Media & Disk Cache...",
        "Media & Disk Cache…","Media & Disk Cache..."
    ];
    for (var j=0; j<prefCandidates.length; j++){
        try{ var pid = app.findMenuCommandId(prefCandidates[j]); if(pid){ app.executeCommand(pid); return; } }catch(e){}
    }
    try{
        var anyPref = app.findMenuCommandId("Preferences...");
        if(!anyPref) anyPref = app.findMenuCommandId("Preferences…");
        if(anyPref){ app.executeCommand(anyPref); alert("Purge command not found.\nGo to Media & Disk Cache and click Empty Disk Cache."); return; }
    }catch(e){}
    alert("Could not open Purge dialog.");
}

// ---------- UI ----------
function buildUI(thisObj){
    var win=(thisObj instanceof Panel)?thisObj:new Window('palette','QuickLayersMINI-v1.2.0',undefined,{resizeable:true});

    var root = win.add('group');
    root.orientation='column';
    root.alignment=['fill','top'];
    root.alignChildren=['fill','top'];
    root.spacing=1;
    root.margins=4;

    var sections = [];

    function createSection(title, buildContent){
        var section = {};
        var wrapper = root.add('group');
        wrapper.orientation = 'column';
        wrapper.alignment = ['fill', 'top'];
        wrapper.alignChildren = ['fill', 'top'];
        wrapper.spacing = 1;
        wrapper.margins = 0;

        var headerPanel = wrapper.add('panel', undefined, undefined, {borderStyle: 'none'});
        headerPanel.alignment = ['fill', 'top'];
        headerPanel.alignChildren = ['left', 'center'];
        headerPanel.margins = [6, 4, 6, 4];
        headerPanel.minimumSize = [0, 26];
        headerPanel.preferredSize = [0, 26];

        var header = headerPanel.add('statictext', undefined, '▶ ' + title);
        header.alignment = ['left', 'center'];

        headerPanel.addEventListener('mousedown', function(){ toggleSection(section); });
        header.addEventListener('mousedown', function(){ toggleSection(section); });

        var content = wrapper.add('group');
        content.orientation = 'column';
        content.alignment = ['fill', 'top'];
        content.alignChildren = ['fill', 'fill'];
        content.spacing = 2;
        content.margins = [2, 2, 2, 2];
        content.visible = false;
        content.maximumSize = [9999, 0];

        buildContent(content);

        section.header = header;
        section.headerPanel = headerPanel;
        section.content = content;
        section.wrapper = wrapper;
        section.title = title;
        section.isOpen = false;

        sections.push(section);
        return section;
    }

    function toggleSection(section){
        for(var i = 0; i < sections.length; i++){
            if(sections[i] !== section && sections[i].isOpen){
                sections[i].isOpen = false;
                sections[i].content.visible = false;
                sections[i].content.maximumSize = [9999, 0];
                sections[i].header.text = '▶ ' + sections[i].title;
            }
        }
        if(section.isOpen){
            section.isOpen = false;
            section.content.visible = false;
            section.content.maximumSize = [9999, 0];
            section.header.text = '▶ ' + section.title;
        } else {
            section.isOpen = true;
            section.content.visible = true;
            section.content.maximumSize = [9999, 9999];
            section.header.text = '▼ ' + section.title;
        }
        win.layout.layout(true);
    }

    function makeBtn(parent, txt, tip, fn){
        var b = parent.add('button', undefined, txt);
        b.helpTip = tip;
        b.alignment = ['fill', 'top'];
        b.onClick = fn;
        return b;
    }

    // ========== SECTION: QL Mini ==========
    createSection('QL Mini', function(content){
        makeBtn(content, 'Solid', 'Create Solid + Fill (white)', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Solid + Fill");
            var s=c.layers.addSolid([1,1,1],"Solid",c.width,c.height,c.pixelAspect,c.duration);
            try{var fx=s.property("ADBE Effect Parade").addProperty("ADBE Fill");fx.property("ADBE Fill-0002").setValue([1,1,1]);}catch(e){}
            app.endUndoGroup();
        });
        makeBtn(content, 'Text', 'Create Text layer', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Text");
            var t=c.layers.addText("New Text");
            t.property("Position").setValue([c.width/2,c.height/2]);
            app.endUndoGroup();
        });
        makeBtn(content, 'Adjustment', 'Create Adjustment layer', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Adjustment");
            var a=c.layers.addSolid([1,1,1],"Adjustment",c.width,c.height,c.pixelAspect,c.duration);
            a.adjustmentLayer=true;
            app.endUndoGroup();
        });
        makeBtn(content, 'Null', 'Create Null object', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Null");
            c.layers.addNull();
            app.endUndoGroup();
        });
        makeBtn(content, 'Shape', 'Create Shape layer', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Shape");
            c.layers.addShape();
            app.endUndoGroup();
        });
        makeBtn(content, 'Camera', 'Create Camera', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Camera");
            c.layers.addCamera("Camera 1",[c.width/2,c.height/2]);
            app.endUndoGroup();
        });
        makeBtn(content, 'Light', 'Create Light', function(){
            var c=getActiveComp();if(!c)return;
            app.beginUndoGroup("QL: Light");
            c.layers.addLight("Light 1",[c.width/2,c.height/2]);
            app.endUndoGroup();
        });
    });

    // ========== SECTION: FX ==========
    createSection('FX', function(content){
        makeBtn(content, "Fill", "Apply Fill effect", fx_fill);
        makeBtn(content, "Tint", "Apply Tint effect", fx_tint);
        makeBtn(content, "Gradient Ramp", "Apply Gradient Ramp effect", fx_ramp);
        makeBtn(content, "Gaussian Blur", "Apply Gaussian Blur effect", fx_gaussianBlur);
        makeBtn(content, "Noise", "Apply Noise effect", fx_noise);
        makeBtn(content, "Lumetri Color", "Apply Lumetri Color effect", fx_lumetri);
        makeBtn(content, "Drop Shadow", "Add Drop Shadow effect", addDropShadow);
        makeBtn(content, "Glow", "Add Glow effect", addGlow);
    });

    // ========== SECTION: Layer ==========
    createSection('Layer', function(content){
        makeBtn(content, "Duplicate", "Duplicate + Rename (auto-increment)", duplicateAndRename);
        makeBtn(content, "Reverse Order", "Reverse Layer Order", reverseLayerOrder);
        makeBtn(content, "Easy Ease All", "Easy Ease All Keyframes", easyEaseAll);
        makeBtn(content, "Fit to Comp", "Fit layer to Comp size", fitToComp);

        var flipRow = content.add('group');
        flipRow.orientation = 'row';
        flipRow.alignment = ['fill', 'top'];
        flipRow.alignChildren = ['fill', 'fill'];
        flipRow.spacing = 2;
        var btnFlipH = flipRow.add('button', undefined, 'Flip H');
        btnFlipH.helpTip = "Flip Horizontal";
        btnFlipH.onClick = flipHorizontal;
        var btnFlipV = flipRow.add('button', undefined, 'Flip V');
        btnFlipV.helpTip = "Flip Vertical";
        btnFlipV.onClick = flipVertical;

        makeBtn(content, 'Center Anchor', "Center Anchor Point", centerAnchorSelected);
        makeBtn(content, 'Label Color', "Set label color on selected layers", setLabelColor);
        makeBtn(content, 'Time Remap', "Enable Time Remapping on selected layers", enableTimeRemap);
        makeBtn(content, 'Trim to Work Area', "Trim selected layers to Work Area", trimToWorkArea);
        makeBtn(content, 'Pre-compose', "Pre-compose selected layers (custom name dialog)", precomposeSelected);
        makeBtn(content, 'Un-precompose', "Extract layers from pre-comp back to main comp", unPrecomposeSelected);
    });

    // ========== SECTION: Expression ==========
    createSection('Expression', function(content){
        makeBtn(content, "Wiggle", "Apply wiggle(2,20) expression to Position", applyWiggleExpression);
        makeBtn(content, "Loop", "Apply loopOut(cycle) to all animated properties", applyLoopExpression);
        makeBtn(content, "Time", "Apply time*90 to Rotation (auto-spin 90deg/sec)", applyTimeExpression);
        makeBtn(content, "Random", "Apply random(50,100) to Opacity (flicker)", applyRandomExpression);
        makeBtn(content, "Auto Fade", "Fade in/out over 15 frames at layer in/out points", applyAutoFade);
        makeBtn(content, "Motion Trail", "Position delay + opacity falloff based on layer index", applyMotionTrail);
        makeBtn(content, "Blink", "Toggle Opacity on/off every 0.5 seconds", applyBlinkExpression);
    });

    // ========== SECTION: Project ==========
    createSection('Project', function(content){
        makeBtn(content, "Import Footage", "Import footage files into project", importFootage);
        makeBtn(content, "New Comp from Selection", "Create comp from selected footage in Project panel", newCompFromSelection);
        makeBtn(content, "Snapshot", "Save current frame as PNG", saveSnapshot);
        makeBtn(content, "Render Queue", "Add Comp to Render Queue", addToRenderQueue);
        makeBtn(content, "Export H.264", "Export as H.264 (MP4)", exportH264);
        makeBtn(content, "Export Alpha", "Export PNG Sequence with Alpha (no background)", exportAlpha);
        makeBtn(content, "Collect Files", "Collect Files", collectFiles);
        makeBtn(content, "Find Missing", "Find Missing Footage", findMissingFootage);
        makeBtn(content, "Clean Project", "Remove unused footage from project", cleanProject);
    });

    // ========== SECTION: Purge ==========
    createSection('Purge', function(content){
        makeBtn(content, 'Purge Cache', "Open Purge / Media & Disk Cache", openPurge);
    });

    if(sections.length > 0) toggleSection(sections[0]);

    win.onResizing = win.onResize = function(){ win.layout.layout(true); };

    if(win instanceof Window){ win.center(); win.show(); }

    return win;
}

buildUI(thisObj);

})(this);
