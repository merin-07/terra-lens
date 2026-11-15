# TERRA-LENS

## Problem
Visual optical similarity is misleading for planetary exploration missions. Visible imagery only reveals surface albedo, failing to capture subsurface boulder hazards, cryogenic thermal regimes, slope traversability limits, or weathering divergence where Lunar and Martian landers and rovers must operate.

## The Solution
TERRA-LENS is a multi-sensor planetary analog workbench that matches Lunar (Shackleton) and Martian (Jezero) landing targets with high-fidelity Earth analog sites using harmonized NASA, ESA, CSA, and JAXA datasets:
- **SAR Radar**: Surface roughness and subsurface block abundance (Circular Polarization Ratio / CPR).
- **Thermal Radiometry**: Diurnal temperature swings and apparent thermal inertia.
- **Topographic DEM & Slope**: Gradients and traversability envelopes.
- **Geochemistry**: Lithologic and process match.

Key capabilities include a synchronized dual split-scope with pan/zoom lock, an X-ray magnifying loupe, a mission priority weighting engine with real-time analog ranking, 3-tier physical fidelity diagnostics (Match, Breakdown, Mitigation), and exportable flight dossiers (PDF, JSON manifest, Markdown brief, and dynamic SVG mission patch).

## How to Run

### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API runs at `http://localhost:8000` (docs at `http://localhost:8000/docs`).

### 2. Frontend (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev
```
UI runs at `http://localhost:5173`.

### 3. Non-Visual Test Suite
```bash
python backend/tests_non_visual.py
```
