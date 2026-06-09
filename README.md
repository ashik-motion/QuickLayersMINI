# Ashik Motion Toolkit

A dockable ScriptUI panel for **Adobe After Effects (CC 2018+)** with layer info, easing controls, and a preset library.

---

## Features

### Layer Info
- Shows comp name, FPS, and duration
- Shows selected layer name, index, in/out points
- Lists all applied effects with match names
- Shows total keyframe count across all properties
- **Copy Info** button — copies everything to clipboard

### Easing
- **Influence slider** — controls the ease curve shape (0–100, default 66)
- **Live Value Graph** — shows the ease in-out S-curve preview as you drag the slider
- Three apply buttons:
  - **Ease Out** — slow start, accelerates out of the keyframe
  - **Ease In** — decelerates into the keyframe, arrives at rest
  - **Ease In-Out** — smooth S-curve, rest at both ends
- Works on all selected keyframes across all selected properties
- Speed is always set to `0` (standard AE ease — no cross-property artifacts)
- Last used influence value **persists** across AE sessions

### Preset Library
- **Save from Layer** — captures all effects (values, keyframes, expressions) from the selected layer
- **Apply** — applies a saved preset to the selected layer
- **Rename / Duplicate / Delete** presets
- **Export JSON** — save your entire preset library to a `.json` file
- **Import JSON** — merge presets from a `.json` file into your library
- Presets stored at: `<user>/AshikMotion/presets.json`

---

## Install

1. Download `Ashik Motion Toolkit.jsx`
2. Copy it to your After Effects ScriptUI Panels folder:

   | Platform | Path |
   |----------|------|
   | **macOS** | `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/` |
   | **Windows** | `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\` |

3. Restart After Effects
4. Go to **Window** menu → click **Ashik Motion Toolkit**

The panel will open as a floating palette. You can dock it anywhere in your AE workspace by dragging the panel header.

---

## How to Use

### Layer Info tab
1. Open a composition and select a layer
2. Click **Refresh** (or switch to this tab)
3. Layer details appear in the text box
4. Click **Copy Info** to copy the details to your clipboard

### Easing tab
1. Select one or more keyframes in the timeline (expand the property and click the keyframe diamonds)
2. Adjust the **Influence** slider — watch the graph update live
3. Click **Ease Out**, **Ease In**, or **Ease In-Out**
4. An alert confirms how many keyframes were updated

> **Tip:** Select keyframes on multiple properties at once — the ease applies to all of them in one click.

### Presets tab
**To save a preset:**
1. Select a layer that has effects applied
2. Click **Save from Layer**
3. Enter a name → click OK

**To apply a preset:**
1. Select a layer in your comp
2. Choose a preset from the dropdown
3. Click **Apply**

**To export/import:**
- **Export JSON** — saves your full preset library to a file (great for backups or sharing)
- **Import JSON** — merges presets from a file into your current library

---

## Version History

| Version | Changes |
|---------|---------|
| **v1.3.0** | Fix: easing speed=0 (standard AE ease). Fix: preset apply no longer duplicates sub-groups. Fix: preset capture now saves keyframes and expressions. Fix: clipboard handles special characters. New: influence persists across sessions. New: graph adapts to AE light/dark theme. |
| v1.2 | Added Ease In & Ease In-Out. Speed graph with grid, ticks, labels. Preset export/import (JSON). |
| v1.0 | Initial release. |

---

## Requirements

- Adobe After Effects CC 2018 or later
- No third-party dependencies
