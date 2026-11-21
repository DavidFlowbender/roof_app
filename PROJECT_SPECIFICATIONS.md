# RoofCalc Pro — On-Site Estimator Specification & Product Philosophy

## 1. Executive Summary & Core Audience

### Target Persona: The On-Site Roof Salesperson & Field Estimator
- **Who they are**: Roofing material vendors, sales reps, carpenters, and field estimators who interact directly with building owners/clients on construction sites.
- **The Problem**: They are **not CAD draftsmen or architects**. Complex CAD tools (AutoCAD, Revit, SketchUp) are too complicated, slow, and unsuitable for rapid on-site quotation.
- **The Solution**: 
  1. The user visits the site, takes measurements or sketches on paper what they see.
  2. They quickly transfer that sketch/measurements into this app.
  3. The app generates an instant, professional, client-ready 2D/3D visual and material estimate (Bill of Quantities / Quotation).

---

## 2. The Three On-Site Building Stages

When an estimator arrives at a site, a building is typically in one of **three distinct physical stages**:

```
[ 1. Foundation Level ]  -->  [ 2. Parapet Level ]  -->  [ 3. Woodwork Level ]
  (Only Footprint Known)        (Walls & Parapet Built)     (Timber Skeleton Erected)
```

### Stage 1: Foundation Level (Ground / Trench / DPC)
* **On-Site Reality**: Only the foundation footing, trenches, or German floor slab / DPC are visible.
* **What the User Knows & Measures**:
  - Footprint outline: Overall lengths, breadths, offsets, wings (L-shape, T-shape, Cross, or custom polygon).
* **What is Unknown On-Site**:
  - Roof pitch, roof height, eaves overhang, truss design, parapet presence.
* **App Behavior**:
  - **Demanded Parameters**: Only the footprint (Length, Breadth, or 2D polygon sketch).
  - **Automatic Standard Presets**:
    - Roof Type: Standard Hip Roof (or Gable).
    - Pitch: Standard 26.5° (6:12 ratio) or 30° standard residential slope.
    - Overhang: Standard 0.45m (1.5 ft) eaves.
    - Standard waste allowance (10%).
  - **Tweakability**: Presets are pre-filled silently with a clear badge: *"Standard Presets Applied — Tap to Customize"*. The user can optionally tweak pitch, style, or overhang if the client specified preferences.

---

### Stage 2: Parapet Level (Lintel / Blockwork Parapet / Concrete Fascia)
* **On-Site Reality**: External walls are erected up to lintel or ceiling level, and a concrete fascia or blockwork parapet wall has been cast around the building perimeter.
* **What the User Knows & Measures**:
  - Footprint perimeter and wall dimensions.
  - Parapet height (e.g., 0.6m, 0.9m, 1.2m / 2ft to 4ft).
  - Parapet wall thickness (e.g., 150mm / 6" or 225mm / 9" block).
  - Roof Style: Usually **Concealed / Hidden Roof** (draining into an internal perimeter trough/gutter) or **Parapet with overhang**.
* **What the User Does NOT Know**:
  - Exact timber lengths or internal truss carcass (not yet installed).
* **App Behavior**:
  - **Demanded Parameters**:
    - Building footprint / sketch.
    - Parapet height (defaults to standard 0.9m / 3ft, easily adjusted).
    - Roof configuration: Hidden / Concealed Roof vs. Standard Eaves.
  - **Automatic Standard Presets**:
    - Pitch: Low-to-moderate slope (typically 15°–20° / 3:12–4:12) specifically designed to stay concealed behind the parapet wall height.
    - Internal trough gutter length = perimeter of the parapet wall.
    - Flashing / zinc apron lining around the parapet junction.
    - Parapet coping / capping tiles/sheet trims.
  - **Tweakability**: User can adjust parapet height, trough gutter width, pitch, and flashing specifications.

---

### Stage 3: Woodwork Level (Carcass / Timber Trusses Erected)
* **On-Site Reality**: The carpenters have already framed and erected the wooden roof carcass (tie beams, king posts, rafters, purlins, wall plates).
* **What the User Knows & Can Measure Directly**:
  - King post height (apex height measured from tie beam to ridge beam).
  - Actual rafter length (measured directly along the timber slope).
  - Actual pitch / slope angle.
  - Actual overhang (measured from outer block wall to the installed fascia board).
  - Purlin / batten spacing and truss centers.
  - Number of hips, valleys, ridges, and gutters already physically framed.
* **App Behavior**:
  - **Demanded Parameters**:
    - Footprint dimensions / sketch.
    - Measured King Post Height **OR** Measured Rafter Length **OR** Exact Pitch Angle.
    - Measured Overhang to Fascia Board.
  - **Additional Woodwork Estimator Capabilities (Optional / Unlocked)**:
    - Purlin spacing (e.g., 370mm for stone-coated tiles, 600–900mm for longspan aluminum).
    - Truss / rafter spacing (e.g., 1.2m / 4ft standard).
    - Timber bill of quantities: Rafters (2x4, 2x6), Purlins (2x3, 2x2), Tie beams (2x6), Wall plates.
  - **Automatic Standard Presets**:
    - Standard king post height derived from span if user only measured rafters, or vice versa.
    - Standard timber sizes and spacing if the user only wants the sheet/tile estimate.
  - **Tweakability**: Full control over timber dimensions, actual measured heights, and spacing.

---

## 3. UI/UX Design Principles for the "Layman First" Experience

1. **Stage Switcher at the Top**:
   - A prominent 3-stage visual selector (`[ 🏗️ Foundation ] [ 🧱 Parapet ] [ 🪵 Woodwork ]`) right at the start of the workflow.
   - Switching stages instantly reconfigures the input form to only demand the parameters relevant to that stage.

2. **Standard Presets by Default (Zero Barrier to Entry)**:
   - The user should be able to get a preliminary quotation in under **30 seconds** by simply inputting the footprint or drawing the sketch.
   - Presets must represent real-world construction norms (e.g., Nigerian / West African & general tropical construction standards).

3. **"Never Lock the Door" — 100% Tweakable**:
   - Every preset field is visible in an "Adjust / Advanced Details" drawer or collapsible card.
   - Clear visual indicators show whether a value is a `Preset` (auto-filled) or `Customized` (edited by user).
   - A quick "Reset to Stage Defaults" button is always available.

4. **Visual Sketcher Integration**:
   - The 2D diagram sketcher allows drawing room-by-room or dragging vertices.
   - Instant 3D visualization displays the building walls, parapet (if Stage 2), or exposed woodwork skeleton (if Stage 3).

5. **Client-Ready Quotes**:
   - One-click PDF generation detailing materials, accessories, labor, and client/contractor information tailored to the current stage.

---

## 4. Technical Architecture Roadmap

- **State Management**: Add `buildingStage: 'foundation' | 'parapet' | 'woodwork'` to `App.jsx`.
- **Defaults Engine (`stagePresets.js`)**:
  - Export preset definitions for each stage.
  - Include helper functions to compute derived parameters when moving between stages.
- **Form Components**:
  - `StageSelector.jsx`: Visual segmented control with stage badges and icons.
  - `StageParametersPanel.jsx`: Dynamic inputs showing mandatory vs. preset fields for the active stage.
  - `WoodworkSpecsPanel.jsx`: Timber sizing and spacing parameters when Stage 3 is selected.
- **Math Engine (`roofMath.js`)**:
  - Incorporate parapet wall height, parapet gutter calculations, and woodwork carcass bill of materials.
- **PDF & BOQ Generator**:
  - State the building stage on the quote (e.g., *"Estimate based on Foundation Stage Presets"* vs. *"Measured Woodwork On-Site Quote"*).
