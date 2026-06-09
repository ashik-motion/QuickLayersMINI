// QuickLayers MINI
// Version: 1.1.0
// Layer creators + FX tools + Utilities + Project tools
// Author: Ashik
// 
// Changelog:
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
//        - Layer creation: Solid, Text, Adjustment, Null, Shape, Camera, Light
//        - FX: Fill, Tint, Gradient Ramp, Noise, Lumetri, Drop Shadow, Glow
//        - Layer tools: Duplicate+Rename, Reverse Order, Easy Ease, Fit to Comp, Flip H/V
//        - Utilities: Center Anchor, Pre-compose (with custom name dialog), Un-precompose (Cmd/Ctrl+click)
//        - Project: Snapshot, Render Queue, Collect Files, Find Missing
//        - Purge: Memory & Disk Cache
//        - Accordion-style collapsible sections (one open at a time)

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
    // already has?
    for(var i=1;i<=fxParade.numProperties;i++){
        var p = fxParade.property(i);
        try{
            for(var k=0;k<matchNames.length;k++){
                if(p.matchName === matchNames[k]) return p;
            }
        }catch(e){}
    }
    // add new
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

// Center anchor for selected layers while keeping visual position
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

// Find next available Pre-compose name: Pre-compose 01, 02, 03...
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
    var label = prefix + (n < 100 ? ("0" + n).slice(-2) : String(n));
    return label;
}

// Precompose selected layers with custom name dialog
function precomposeSelected(){
    var c = getActiveComp(); if(!c) return;
    if(!c.selectedLayers || c.selectedLayers.length===0){ alert("Select at least one layer to pre-compose."); return; }

    var idx = [];
    for (var i=0;i<c.selectedLayers.length;i++) idx.push(c.selectedLayers[i].index);
    idx.sort(function(a,b){ return a - b; });

    // Get default auto-numbered name
    var defaultName = getNextPrecompName();
    
    // Create dialog for custom name input
    var dlg = new Window('dialog', 'Pre-compose Name');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.spacing = 10;
    dlg.margins = 16;
    
    var labelGrp = dlg.add('group');
    labelGrp.add('statictext', undefined, 'Enter pre-compose name:');
    
    var inputGrp = dlg.add('group');
    inputGrp.alignChildren = ['fill', 'center'];
    var nameInput = inputGrp.add('edittext', undefined, defaultName);
    nameInput.characters = 25;
    nameInput.active = true;
    
    var btnGrp = dlg.add('group');
    btnGrp.alignment = ['center', 'top'];
    var okBtn = btnGrp.add('button', undefined, 'OK', {name: 'ok'});
    var cancelBtn = btnGrp.add('button', undefined, 'Cancel', {name: 'cancel'});
    
    // Select all text in input field for easy replacement
    nameInput.addEventListener('focus', function(){ 
        this.selection = [0, this.text.length]; 
    });
    
    okBtn.onClick = function(){ dlg.close(1); };
    cancelBtn.onClick = function(){ dlg.close(0); };
    
    // Enter key to confirm
    nameInput.onEnterKey = function(){ dlg.close(1); };
    
    var result = dlg.show();
    
    if(result !== 1) return; // User cancelled
    
    var name = nameInput.text.replace(/^\s+|\s+$/g, ''); // Trim whitespace
    if(name === ''){ 
        alert("Name cannot be empty."); 
        return; 
    }

    app.beginUndoGroup("QL: Pre-compose");
    try{
        c.layers.precompose(idx, name, true);
    }catch(e){ alert("Pre-compose failed: "+e.toString()); }
    app.endUndoGroup();
}

// Un-precompose: extract layers from precomp back to main comp
function unPrecomposeSelected(){
    var c = getActiveComp(); if(!c) return;
    if(!c.selectedLayers || c.selectedLayers.length===0){ alert("Select a pre-comp layer to un-precompose."); return; }
    
    var layer = c.selectedLayers[0];
    
    // Check if it's a precomp
    if(!layer.source || !(layer.source instanceof CompItem)){
        alert("Selected layer is not a pre-comp.");
        return;
    }
    
    var preComp = layer.source;
    var preCompLayer = layer;
    var insertIndex = preCompLayer.index;
    var preCompStart = preCompLayer.startTime;
    var preCompIn = preCompLayer.inPoint;
    
    app.beginUndoGroup("QL: Un-precompose");
    try{
        // Store precomp transform values
        var prePos = preCompLayer.property("Position").value;
        var preScale = preCompLayer.property("Scale").value;
        var preRot = preCompLayer.property("Rotation").value;
        var preOpacity = preCompLayer.property("Opacity").value;
        
        // Select all layers in precomp
        for(var i = 1; i <= preComp.numLayers; i++){
            preComp.layer(i).selected = true;
        }
        
        // Copy layers from precomp
        app.executeCommand(app.findMenuCommandId("Copy"));
        
        // Deselect all in main comp
        for(var j = 1; j <= c.numLayers; j++){
            c.layer(j).selected = false;
        }
        
        // Make main comp active and paste
        app.project.activeItem = c;
        app.executeCommand(app.findMenuCommandId("Paste"));
        
        // Adjust pasted layers
        var pastedLayers = c.selectedLayers;
        for(var k = 0; k < pastedLayers.length; k++){
            var pLayer = pastedLayers[k];
            // Adjust timing
            pLayer.startTime = pLayer.startTime + preCompStart;
        }
        
        // Move pasted layers to correct position
        for(var m = 0; m < pastedLayers.length; m++){
            pastedLayers[m].moveAfter(c.layer(insertIndex));
        }
        
        // Delete the original precomp layer
        preCompLayer.remove();
        
        alert("Un-precompose complete!\n" + pastedLayers.length + " layer(s) extracted.");
        
    }catch(e){ alert("Un-precompose failed: "+e.toString()); }
    app.endUndoGroup();
}

// ---------- NEW FEATURES ----------

// 📋 Duplicate + Rename: Duplicate layer with auto-increment name
function duplicateAndRename(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Duplicate + Rename");
    for(var i = 0; i < sel.length; i++){
        var layer = sel[i];
        var baseName = layer.name;
        
        // Remove existing number suffix if present
        var nameMatch = baseName.match(/^(.+?)(\s*\d+)?$/);
        var cleanName = nameMatch ? nameMatch[1].replace(/\s+$/, '') : baseName;
        
        // Find next available number
        var comp = layer.containingComp;
        var num = 2;
        var newName;
        var exists = true;
        
        while(exists){
            newName = cleanName + " " + num;
            exists = false;
            for(var j = 1; j <= comp.numLayers; j++){
                if(comp.layer(j).name === newName){
                    exists = true;
                    num++;
                    break;
                }
            }
        }
        
        layer.duplicate().name = newName;
    }
    app.endUndoGroup();
}

// 🔄 Reverse Layer Order: Flip selected layers order
function reverseLayerOrder(){
    var c = getActiveComp(); if(!c) return;
    var sel = c.selectedLayers;
    if(!sel || sel.length < 2){ alert("Select at least 2 layers to reverse order."); return; }
    
    app.beginUndoGroup("QL: Reverse Layer Order");
    
    // Get indices sorted
    var indices = [];
    for(var i = 0; i < sel.length; i++){
        indices.push(sel[i].index);
    }
    indices.sort(function(a, b){ return a - b; });
    
    // Store layers by their original indices
    var layers = [];
    for(var j = 0; j < indices.length; j++){
        layers.push(c.layer(indices[j]));
    }
    
    // Move layers to reverse positions
    for(var k = 0; k < layers.length; k++){
        layers[k].moveTo(indices[indices.length - 1 - k]);
    }
    
    app.endUndoGroup();
}

// 💎 Easy Ease All: Apply easy ease to all keyframes on selected layers
function easyEaseAll(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Easy Ease All");
    
    for(var i = 0; i < sel.length; i++){
        applyEasyEaseToProps(sel[i]);
    }
    
    app.endUndoGroup();
}

function applyEasyEaseToProps(layer){
    // Recursively find all properties with keyframes
    function processPropertyGroup(propGroup){
        if(!propGroup) return;
        for(var i = 1; i <= propGroup.numProperties; i++){
            var prop = propGroup.property(i);
            try{
                if(prop.propertyType === PropertyType.PROPERTY){
                    if(prop.numKeys > 0 && prop.canVaryOverTime){
                        for(var k = 1; k <= prop.numKeys; k++){
                            try{
                                prop.setTemporalEaseAtKey(k, 
                                    [new KeyframeEase(0, 33)], 
                                    [new KeyframeEase(0, 33)]);
                            }catch(e){}
                        }
                    }
                } else if(prop.propertyType === PropertyType.INDEXED_GROUP || 
                          prop.propertyType === PropertyType.NAMED_GROUP){
                    processPropertyGroup(prop);
                }
            }catch(e){}
        }
    }
    processPropertyGroup(layer);
}

// 🔲 Fit to Comp: Scale layer to fit composition
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
                sourceWidth = rect.width;
                sourceHeight = rect.height;
            } else if(layer.source){
                sourceWidth = layer.source.width;
                sourceHeight = layer.source.height;
            } else {
                continue;
            }
            
            if(sourceWidth <= 0 || sourceHeight <= 0) continue;
            
            var scaleX = (comp.width / sourceWidth) * 100;
            var scaleY = (comp.height / sourceHeight) * 100;
            var scale = Math.max(scaleX, scaleY); // Cover entire comp
            
            layer.property("Scale").setValue([scale, scale]);
            layer.property("Position").setValue([comp.width/2, comp.height/2]);
            
        }catch(e){}
    }
    app.endUndoGroup();
}

// 🪞 Flip Horizontal
function flipHorizontal(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Flip Horizontal");
    
    for(var i = 0; i < sel.length; i++){
        try{
            var scale = sel[i].property("Scale").value;
            sel[i].property("Scale").setValue([scale[0] * -1, scale[1]]);
        }catch(e){}
    }
    app.endUndoGroup();
}

// 🪞 Flip Vertical
function flipVertical(){
    var sel = getSelection(); if(!sel) return;
    app.beginUndoGroup("QL: Flip Vertical");
    
    for(var i = 0; i < sel.length; i++){
        try{
            var scale = sel[i].property("Scale").value;
            sel[i].property("Scale").setValue([scale[0], scale[1] * -1]);
        }catch(e){}
    }
    app.endUndoGroup();
}

// 🔳 Drop Shadow: Add drop shadow effect
function addDropShadow(){
    applyEffectToSelection(["ADBE Drop Shadow"], "Drop Shadow");
}

// ✨ Glow: Add glow effect
function addGlow(){
    applyEffectToSelection(["ADBE Glo2", "ADBE Glow"], "Glow");
}

// 📸 Snapshot: Save current frame as PNG
function saveSnapshot(){
    var c = getActiveComp(); if(!c) return;
    
    // Ask for save location
    var file = File.saveDialog("Save Snapshot as PNG", "PNG:*.png");
    if(!file) return;
    
    // Ensure .png extension
    var filePath = file.fsName;
    if(!/\.png$/i.test(filePath)) filePath += ".png";
    
    app.beginUndoGroup("QL: Snapshot");
    try{
        // Add to render queue with PNG settings
        var rqi = app.project.renderQueue.items.add(c);
        var om = rqi.outputModule(1);
        
        // Set output format to PNG
        try{
            om.applyTemplate("PNG Sequence");
        }catch(e){
            try{
                om.applyTemplate("Photoshop");
            }catch(e2){}
        }
        
        om.file = new File(filePath);
        
        // Set time span to current frame only
        rqi.timeSpanStart = c.time;
        rqi.timeSpanDuration = c.frameDuration;
        
        alert("Snapshot added to Render Queue.\nFile: " + filePath + "\n\nRender the queue to save the image.");
        
    }catch(e){ alert("Snapshot failed: " + e.toString()); }
    app.endUndoGroup();
}

// 🎞️ Add to Render Queue
function addToRenderQueue(){
    var c = getActiveComp(); if(!c) return;
    
    app.beginUndoGroup("QL: Add to Render Queue");
    try{
        app.project.renderQueue.items.add(c);
        // Open render queue panel
        app.executeCommand(2162); // Render Queue panel command ID
    }catch(e){ alert("Failed to add to render queue: " + e.toString()); }
    app.endUndoGroup();
}

// 📂 Collect Files
function collectFiles(){
    try{
        app.executeCommand(2482); // File > Dependencies > Collect Files
    }catch(e){
        try{
            var id = app.findMenuCommandId("Collect Files...");
            if(!id) id = app.findMenuCommandId("Collect Files…");
            if(id) app.executeCommand(id);
            else alert("Could not find Collect Files command.");
        }catch(e2){ alert("Collect Files failed: " + e2.toString()); }
    }
}

// 🔍 Find Missing Footage
function findMissingFootage(){
    var missing = [];
    
    for(var i = 1; i <= app.project.numItems; i++){
        var item = app.project.item(i);
        if(item instanceof FootageItem && item.footageMissing){
            missing.push(item.name);
        }
    }
    
    if(missing.length === 0){
        alert("✅ No missing footage found!");
    } else {
        alert("⚠️ Missing Footage (" + missing.length + "):\n\n" + missing.join("\n"));
    }
}

// 🎬 Export H.264 via Media Encoder
function exportH264(){
    var c = getActiveComp(); if(!c) return;
    
    app.beginUndoGroup("QL: Export H.264");
    try{
        // Add to Adobe Media Encoder queue
        var rqi = app.project.renderQueue.items.add(c);
        var om = rqi.outputModule(1);
        
        // Try to set H.264 format
        try{
            om.applyTemplate("H.264 - Match Render Settings - 15 Mbps");
        }catch(e){
            try{
                om.applyTemplate("H.264");
            }catch(e2){
                try{
                    om.applyTemplate("Lossless");
                }catch(e3){}
            }
        }
        
        // Open render queue
        app.executeCommand(2162);
        alert("Comp added to Render Queue.\n\nTip: For H.264, use 'File > Export > Add to Media Encoder Queue' for best results.");
        
    }catch(e){ alert("Export H.264 failed: " + e.toString()); }
    app.endUndoGroup();
}

// 🎬 Export Alpha (PNG Sequence with transparency)
function exportAlpha(){
    var c = getActiveComp(); if(!c) return;
    
    app.beginUndoGroup("QL: Export Alpha");
    try{
        var rqi = app.project.renderQueue.items.add(c);
        var om = rqi.outputModule(1);
        
        // Try PNG with Alpha
        try{
            om.applyTemplate("PNG Sequence with Alpha");
        }catch(e){
            try{
                om.applyTemplate("PNG Sequence");
            }catch(e2){
                // Manual format setting fallback
                try{
                    om.applyTemplate("Lossless with Alpha");
                }catch(e3){}
            }
        }
        
        // Open render queue
        app.executeCommand(2162);
        alert("Comp added to Render Queue with Alpha.\n\nMake sure:\n• Channels: RGB + Alpha\n• Format: PNG Sequence or ProRes 4444");
        
    }catch(e){ alert("Export Alpha failed: " + e.toString()); }
    app.endUndoGroup();
}

// 🔊 Open Audio Waveform Panel
function openAudioPanel(){
    try{
        // Try to open Audio panel
        app.executeCommand(2156); // Audio panel command
    }catch(e){
        try{
            var id = app.findMenuCommandId("Audio");
            if(id) app.executeCommand(id);
            else {
                // Try Preview panel which has audio waveform
                app.executeCommand(2031); // Preview panel
                alert("Audio panel opened.\n\nTo see waveforms:\n• Expand audio layer (L key twice)\n• Or use Preview panel");
            }
        }catch(e2){ 
            alert("Could not open Audio panel.\n\nManually: Window > Audio"); 
        }
    }
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
        try{
            var id = app.findMenuCommandId(candidates[i]);
            if (id){ app.executeCommand(id); return; }
        }catch(e){}
    }

    var prefCandidates = [
        "Open Preferences: Media & Disk Cache",
        "Preferences > Media & Disk Cache…",
        "Preferences > Media & Disk Cache...",
        "Media & Disk Cache…",
        "Media & Disk Cache..."
    ];
    for (var j=0; j<prefCandidates.length; j++){
        try{
            var pid = app.findMenuCommandId(prefCandidates[j]);
            if (pid){ app.executeCommand(pid); return; }
        }catch(e){}
    }

    try{
        var anyPref = app.findMenuCommandId("Preferences...");
        if (!anyPref) anyPref = app.findMenuCommandId("Preferences…");
        if (anyPref){
            app.executeCommand(anyPref);
            alert("Purge command not found automatically.\nPreferences opened — go to 'Media & Disk Cache' and click 'Empty Disk Cache'."); 
            return;
        }
    }catch(e){}
    alert("Could not open Purge dialog. Menu command not found.");
}

// ---------- FX ----------
function fx_fill(){ applyEffectToSelection(["ADBE Fill"], "Fill"); }
function fx_tint(){ applyEffectToSelection(["ADBE Tint"], "Tint"); }
function fx_ramp(){ applyEffectToSelection(["ADBE Ramp"], "Gradient Ramp"); }
function fx_noise(){ applyEffectToSelection(["ADBE Noise"], "Noise"); }
function fx_lumetri(){ applyEffectToSelection(["ADBE Lumetri","ADBE Lumetri Color"], "Lumetri Color"); }

// ---------- UI ----------
function buildUI(thisObj){
    var win=(thisObj instanceof Panel)?thisObj:new Window('palette','QuickLayersMINI-v1.1.0',undefined,{resizeable:true});
    
    var root = win.add('group');
    root.orientation='column'; 
    root.alignment=['fill','top']; 
    root.alignChildren=['fill','top'];
    root.spacing=1; 
    root.margins=4;
    
    // Store all sections for accordion behavior
    var sections = [];
    
    // Create collapsible section
    function createSection(title, buildContent){
        var section = {};
        
        // Section wrapper
        var wrapper = root.add('group');
        wrapper.orientation = 'column';
        wrapper.alignment = ['fill', 'top'];
        wrapper.alignChildren = ['fill', 'top'];
        wrapper.spacing = 1;
        wrapper.margins = 0;
        
        // Header panel (entire area clickable)
        var headerPanel = wrapper.add('panel', undefined, undefined, {borderStyle: 'none'});
        headerPanel.alignment = ['fill', 'top'];
        headerPanel.alignChildren = ['left', 'center'];
        headerPanel.margins = [6, 4, 6, 4];
        headerPanel.minimumSize = [0, 26];
        headerPanel.preferredSize = [0, 26];
        
        var header = headerPanel.add('statictext', undefined, '▶ ' + title);
        header.alignment = ['left', 'center'];
        
        // Make entire panel clickable (both panel and text)
        headerPanel.addEventListener('mousedown', function(){
            toggleSection(section);
        });
        header.addEventListener('mousedown', function(){
            toggleSection(section);
        });
        
        // Content panel (collapsible)
        var content = wrapper.add('group');
        content.orientation = 'column';
        content.alignment = ['fill', 'top'];
        content.alignChildren = ['fill', 'fill'];
        content.spacing = 2;
        content.margins = [2, 2, 2, 2];
        content.visible = false;
        content.maximumSize = [9999, 0]; // Start with 0 height
        
        // Build content inside
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
    
    // Toggle section (accordion behavior - only one open at a time)
    function toggleSection(section){
        // Close all sections first
        for(var i = 0; i < sections.length; i++){
            if(sections[i] !== section && sections[i].isOpen){
                sections[i].isOpen = false;
                sections[i].content.visible = false;
                sections[i].content.maximumSize = [9999, 0];
                sections[i].header.text = '▶ ' + sections[i].title;
            }
        }
        
        if(section.isOpen){
            // Close this section
            section.isOpen = false;
            section.content.visible = false;
            section.content.maximumSize = [9999, 0];
            section.header.text = '▶ ' + section.title;
        } else {
            // Open this section
            section.isOpen = true;
            section.content.visible = true;
            section.content.maximumSize = [9999, 9999];
            section.header.text = '▼ ' + section.title;
        }
        win.layout.layout(true);
    }
    
    // Helper to create buttons
    function makeBtn(parent, txt, tip, fn){
        var b = parent.add('button', undefined, txt);
        b.helpTip = tip;
        b.alignment = ['fill', 'top'];
        b.onClick = fn;
        return b;
    }
    
    // ========== SECTION: QL Mini (Layer Creation) ==========
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
        
        // Flip buttons in a row
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
        
        // Utilities merged here
        makeBtn(content, 'Center Anchor', "Center Anchor Point", centerAnchorSelected);
        
        // Pre-compose button - normal click
        makeBtn(content, 'Pre-compose', "Pre-compose selected layers (custom name dialog)", precomposeSelected);
        
        // Un-precompose button - separate button
        makeBtn(content, 'Un-precompose', "Extract layers from pre-comp back to main comp", unPrecomposeSelected);
    });
    
    // ========== SECTION: Project ==========
    createSection('Project', function(content){
        makeBtn(content, "Snapshot", "Save current frame as PNG", saveSnapshot);
        makeBtn(content, "Render Queue", "Add Comp to Render Queue", addToRenderQueue);
        makeBtn(content, "Export H.264", "Export as H.264 (MP4)", exportH264);
        makeBtn(content, "Export Alpha", "Export PNG Sequence with Alpha (no background)", exportAlpha);
        makeBtn(content, "Collect Files", "Collect Files", collectFiles);
        makeBtn(content, "Find Missing", "Find Missing Footage", findMissingFootage);
    });
    
    // ========== SECTION: Purge ==========
    createSection('Purge', function(content){
        makeBtn(content, 'Purge Cache', "Open Purge / Media & Disk Cache", openPurge);
    });
    
    // Open first section by default
    if(sections.length > 0){
        toggleSection(sections[0]);
    }

    win.onResizing = win.onResize = function(){
        win.layout.layout(true);
    };
    
    if(win instanceof Window){
        win.center();
        win.show();
    }
    
    return win;
}

buildUI(thisObj);

})(this);
