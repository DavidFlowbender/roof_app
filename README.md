# RoofCalc Pro — On-Site Roofing Estimator & Visualizer

A fast, intuitive, mobile-responsive web application designed specifically for **roofing material sellers, carpenters, and field estimators** who need to sketch what they see on-site and instantly generate accurate 2D/3D visual roofs and Bill of Quantities (BOQ) quotations for their clients without needing complex CAD software.

---

## 🏗️ Core Concept: The 3 On-Site Building Stages

When visiting a construction site, estimators encounter buildings at three distinct development stages. The app dynamically adapts its demanded parameters, smart presets, and calculations based on the selected stage:

1. **Foundation Level (Ground / DPC)**:
   - Only ground footprint dimensions are known (length, breadth, sketched polygon wings).
   - Standard presets automatically fill in roof pitch, overhang, and style.
   - User only needs to input the floor plan footprint.

2. **Parapet Level (Walls & Concrete Fascia / Blockwork Parapet)**:
   - External walls are up, and a parapet/fascia wall is cast.
   - User inputs footprint + parapet wall height and chooses between hidden roof or parapet overhang.
   - Presets fill in low-pitch internal slope, flashing, coping, and trough gutters.

3. **Woodwork Level (Carcass & Trusses Erected)**:
   - Woodwork is physically on site.
   - Demands exact measured parameters: King post apex height OR rafter length, actual overhang to fascia board, and optional timber specs (purlin spacing, truss centers).
   - Generates both sheet/tile quantities and full timber carcass estimations.

> 📖 **Full Architectural Specification**: See [PROJECT_SPECIFICATIONS.md](./PROJECT_SPECIFICATIONS.md) for detailed workflows, presets, and parameter definitions.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

