# QuickLayers MINI

A lightweight, dockable ScriptUI panel for **Adobe After Effects (CC 2018+)** with accordion-style sections for fast layer creation, FX, layer tools, expressions, project management, and cache purging — all in one compact panel.

---

## Features

### QL Mini — Layer Creation
| Button | Action |
|--------|--------|
| Solid | Creates a white Solid with Fill effect |
| Text | Creates a Text layer centered in comp |
| Adjustment | Creates an Adjustment layer |
| Null | Creates a Null object |
| Shape | Creates a Shape layer |
| Camera | Creates a Camera |
| Light | Creates a Light |

### FX
Applies effects to all selected layers (adds if not already present):

| Button | Effect |
|--------|--------|
| Fill | ADBE Fill |
| Tint | ADBE Tint |
| Gradient Ramp | ADBE Ramp |
| Gaussian Blur | ADBE Gaussian Blur 2 |
| Noise | ADBE Noise |
| Lumetri Color | ADBE Lumetri Color |
| Drop Shadow | ADBE Drop Shadow |
| Glow | ADBE Glow |

### Layer — Tools & Utilities
| Button | Action |
|--------|--------|
| Duplicate | Duplicates selected layers with auto-incremented names |
| Reverse Order | Reverses the stacking order of selected layers |
| Easy Ease All | Applies Easy Ease to all keyframes on selected layers |
| Fit to Comp | Scales layer to fill the comp (cover mode) |
| Flip H / Flip V | Flips layer scale horizontally or vertically |
| Center Anchor | Centers the anchor point while keeping visual position |
| Label Color | Opens a dropdown to set label color on selected layers (17 colors) |
| Time Remap | Enables Time Remapping on selected layers |
| Trim to Work Area | Trims selected layers' in/out points to the comp Work Area |
| Pre-compose | Pre-composes selected layers with a custom name dialog (auto-numbered default) |
| Un-precompose | Extracts all layers from a pre-comp back into the main comp |

### Expression
| Button | What it applies |
|--------|----------------|
| Wiggle | `wiggle(2, 20)` → Position |
| Loop | `loopOut("cycle")` → all animated properties (≥ 2 keyframes) |
| Time | `time * 90` → Rotation (continuous auto-spin) |
| Random | `random(50, 100)` → Opacity (flicker) |
| Auto Fade | Fade in/out over 15 frames at layer in/out points → Opacity |
| Motion Trail | Position delay + opacity falloff by layer index → Position & Opacity |
| Blink | Toggle Opacity 100/0 every 0.5 seconds → Opacity |

### Project
| Button | Action |
|--------|--------|
| Import Footage | Opens a multi-file import dialog |
| New Comp from Selection | Creates a new comp from footage selected in the Project panel |
| Snapshot | Adds current frame to Render Queue as a PNG |
| Render Queue | Adds active comp to the Render Queue |
| Export H.264 | Adds comp to Render Queue with H.264 template |
| Export Alpha | Adds comp to Render Queue with PNG Sequence + Alpha |
| Collect Files | Runs File > Dependencies > Collect Files |
| Find Missing | Lists all missing footage items |
| Clean Project | Removes unused footage from the project |

### Purge
| Button | Action |
|--------|--------|
| Purge Cache | Opens the Purge Memory & Disk Cache dialog |

---

## Install

1. Download `AshikMotion-QLmini -v1.3.0.jsx`
2. Copy it to your After Effects ScriptUI Panels folder:

   | Platform | Path |
   |----------|------|
   | **macOS** | `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/` |
   | **Windows** | `C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\` |

3. Restart After Effects
4. Go to **Window** menu → click **AshikMotion-QLmini -v1.3.0**

The panel docks anywhere in your AE workspace.

---

## Version History

| Version | Changes |
|---------|---------|
| **v1.3.0** | Added Auto Fade, Motion Trail, Blink, Time, Random to Expression section. |
| v1.2.0 | Added Label Color, Time Remap, Trim to Work Area (Layer). Gaussian Blur (FX). Expression section with Wiggle & Loop. Import Footage, New Comp from Selection, Clean Project (Project). |
| v1.1.0 | Fixed Un-precompose (now uses Copy/Paste approach). |
| v1.0.9 | Removed broken scrollbar, simplified UI structure. |
| v1.0.8 | Separated Pre-compose and Un-precompose into two buttons. |
| v1.0.7 | Merged Layer and Utilities sections. |
| v1.0.0 | Initial release — accordion UI, layer creation, FX, layer tools, project tools, purge. |

---

## Requirements

- Adobe After Effects CC 2018 or later
- No third-party dependencies
