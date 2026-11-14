import { useState, useMemo } from "react";
import GlobalLocatorMap, { SITES_CATALOG } from "./GlobalLocatorMap";
import { Activity, Globe2, Layers } from "lucide-react";
import "./RadarAndLocator.css";

/**
 * Axis telemetry and instrument metadata mapping
 */
const AXIS_METADATA = {
  slope: {
    label: "SLOPE / DEM",
    unit: "Degrees (°) Grade",
    moonInstrument: "LRO LOLA (Laser Altimeter, 5m/px)",
    marsInstrument: "MRO MOLA / HRSC Stereo DTM",
    earthInstrument: "ESA Copernicus GLO-30 / JAXA AW3D30",
    description: "Evaluates surface gradient, scarp hazard profile, and traversability friction.",
  },
  radar_roughness: {
    label: "SAR ROUGHNESS",
    unit: "CPR / Backscatter Ratio",
    moonInstrument: "LRO Mini-RF S-band (2.38 GHz)",
    marsInstrument: "MRO SHARAD Radar Sounder (15–25 MHz)",
    earthInstrument: "CSA RADARSAT-2 / JAXA ALOS-2 PALSAR",
    description: "Measures sub-meter surface blockiness and volumetric subsurface scattering.",
  },
  thermal: {
    label: "THERMAL REGIME",
    unit: "Radiometric Temperature (K)",
    moonInstrument: "LRO Diviner Thermal Radiometer",
    marsInstrument: "Mars Odyssey THEMIS Multi-Band TIR",
    earthInstrument: "NASA ECOSTRESS / MODIS LST",
    description: "Assesses apparent thermal inertia, regolith grain size, and diurnal thermal cycling.",
  },
  geochemical: {
    label: "GEOCHEMISTRY",
    unit: "Spectral Index Correlation",
    moonInstrument: "LROC NAC Albedo / Mineral Band Ratio",
    marsInstrument: "MRO CRISM / HiRISE VNIR Band Ratios",
    earthInstrument: "ESA Sentinel-2 MSI (SWIR/VNIR)",
    description: "Correlates lithology, hydrated mineral absorptions, and weathering alteration crusts.",
  },
};

/**
 * RadarChart renders an overlapping 4-axis SVG spider chart comparing
 * the Planetary Target against the selected Earth Analog.
 * Enhanced with:
 * 1. Interactive Axis Inspection and Telemetry Callouts
 * 2. Integrated Mode Toggle (RADAR MATRIX | ORBITAL LOCATOR | SPLIT VIEW)
 * 3. Embedded Global & Planetary Locator Map
 */
export default function RadarChart({
  targetScores = { slope: 80, radar_roughness: 75, thermal: 90, geochemical: 70 },
  analogScores = { slope: 75, radar_roughness: 80, thermal: 65, geochemical: 85 },
  targetName = "Target",
  analogName = "Analog",
  size = 280,
  targetId,
  analogId,
  defaultMode = "radar", // "radar" | "locator" | "split"
}) {
  const [activeMode, setActiveMode] = useState(defaultMode);
  const [inspectedAxisKey, setInspectedAxisKey] = useState("slope");

  // Inferred site keys for locator map
  const activeTargetKey = useMemo(() => {
    if (targetId && SITES_CATALOG.targets[targetId]) return targetId;
    const tLower = String(targetName || "").toLowerCase();
    if (tLower.includes("mars") || tLower.includes("jezero") || tLower.includes("nili")) {
      return "jezero";
    }
    if (tLower.includes("moon") || tLower.includes("shackleton") || tLower.includes("connecting")) {
      return "shackleton";
    }
    if (targetScores?.slope === 64 || targetScores?.geochemical === 89) {
      return "jezero";
    }
    return "shackleton";
  }, [targetId, targetName, targetScores]);

  const activeAnalogKey = useMemo(() => {
    if (analogId && SITES_CATALOG.analogs[analogId]) return analogId;
    const aLower = String(analogName || "").toLowerCase();
    if (aLower.includes("tablelands")) return "tablelands";
    if (aLower.includes("harrat") || aLower.includes("khaybar")) return "harrat-khaybar";
    if (aLower.includes("sredinny") || aLower.includes("tolbachik") || aLower.includes("kamchatka")) return "sredinny";
    if (aLower.includes("tuktoyaktuk") || aLower.includes("pingo") || aLower.includes("ibyuk")) return "tuktoyaktuk";
    if (aLower.includes("lut") || aLower.includes("yardang")) return "lut-desert";

    if (analogScores?.slope === 84 || analogScores?.geochemical === 81) return "tablelands";
    if (analogScores?.radar_roughness === 89) return "harrat-khaybar";
    if (analogScores?.geochemical === 85) return "sredinny";
    if (analogScores?.thermal === 88) return "tuktoyaktuk";
    if (analogScores?.radar_roughness === 82) return "lut-desert";

    return "tablelands";
  }, [analogId, analogName, analogScores]);

  // 4 Axes Geometry
  const axes = useMemo(
    () => [
      { key: "slope", label: "SLOPE / DEM", angle: -Math.PI / 2 }, // Top
      { key: "radar_roughness", label: "SAR ROUGHNESS", angle: 0 }, // Right
      { key: "thermal", label: "THERMAL REGIME", angle: Math.PI / 2 }, // Bottom
      { key: "geochemical", label: "GEOCHEMISTRY", angle: Math.PI }, // Left
    ],
    []
  );

  const center = size / 2;
  const radius = size / 2 - 45;

  // Helper to convert value (0-100) and angle to (x, y)
  const getCoordinates = (val, angle) => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Build SVG polygon points strings
  const targetPoints = axes
    .map((axis) => {
      const val = targetScores[axis.key] ?? 50;
      const { x, y } = getCoordinates(val, axis.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const analogPoints = axes
    .map((axis) => {
      const val = analogScores[axis.key] ?? 50;
      const { x, y } = getCoordinates(val, axis.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gridRings = [25, 50, 75, 100];

  // Currently inspected axis telemetry data
  const currentAxisMeta = AXIS_METADATA[inspectedAxisKey] || AXIS_METADATA.slope;
  const tVal = targetScores[inspectedAxisKey] ?? 50;
  const aVal = analogScores[inspectedAxisKey] ?? 50;
  const delta = Math.abs(tVal - aVal);

  const deltaBadgeClass =
    delta <= 10 ? "match-high" : delta <= 22 ? "match-mid" : "match-low";
  const deltaText =
    delta <= 10 ? "EXCELLENT MATCH" : delta <= 22 ? "MODERATE FIDELITY" : "DIVERGENT GAP";

  return (
    <div className="radar-telemetry-container">
      {/* --- Mode Toggle Toolbar (Hidden in Print / Small Modal context) --- */}
      <div className="radar-mode-toolbar">
        <button
          type="button"
          className={`radar-pill-btn ${activeMode === "radar" ? "active" : ""}`}
          onClick={() => setActiveMode("radar")}
          title="Switch to 4-Axis Spider Radar Matrix"
        >
          <Activity size={12} />
          <span>RADAR MATRIX</span>
        </button>

        <button
          type="button"
          className={`radar-pill-btn ${activeMode === "locator" ? "active" : ""}`}
          onClick={() => setActiveMode("locator")}
          title="Switch to Orbital & Planetary Locator Map"
        >
          <Globe2 size={12} />
          <span>ORBITAL LOCATOR</span>
        </button>

        <button
          type="button"
          className={`radar-pill-btn ${activeMode === "split" ? "active" : ""}`}
          onClick={() => setActiveMode("split")}
          title="Side-by-side Dual Telemetry View"
        >
          <Layers size={12} />
          <span>SPLIT VIEW</span>
        </button>
      </div>

      {/* ========================================================
          MODE 1: 4-AXIS SPIDER RADAR MATRIX (With Axis Telemetry)
          ======================================================== */}
      {(activeMode === "radar" || activeMode === "split") && (
        <div className="spider-chart-viewport">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="spider-chart-svg"
          >
            {/* Background Grid Rings */}
            {gridRings.map((pct) => {
              const ringPoints = axes
                .map((axis) => {
                  const { x, y } = getCoordinates(pct, axis.angle);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ");
              return (
                <polygon
                  key={pct}
                  points={ringPoints}
                  fill={pct === 100 ? "rgba(17, 27, 40, 0.6)" : "none"}
                  stroke="#223348"
                  strokeWidth={pct === 100 ? "1.5" : "1"}
                  strokeDasharray={pct < 100 ? "3 3" : "none"}
                />
              );
            })}

            {/* Ring Percentage Labels */}
            {gridRings.map((pct) => {
              const { x, y } = getCoordinates(pct, -Math.PI / 2);
              return (
                <text
                  key={pct}
                  x={x + 3}
                  y={y + 11}
                  fill="#64748b"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {pct}
                </text>
              );
            })}

            {/* Axis Spokes & Interactive Labels */}
            {axes.map((axis) => {
              const { x, y } = getCoordinates(100, axis.angle);
              const labelDist = radius + 22;
              const lx = center + labelDist * Math.cos(axis.angle);
              const ly = center + labelDist * Math.sin(axis.angle);

              let textAnchor = "middle";
              if (axis.angle === 0) textAnchor = "start";
              if (axis.angle === Math.PI) textAnchor = "end";

              const isInspected = inspectedAxisKey === axis.key;

              return (
                <g
                  key={axis.key}
                  className="axis-group-interactive"
                  onClick={() => setInspectedAxisKey(axis.key)}
                  onMouseEnter={() => setInspectedAxisKey(axis.key)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Invisible broad stroke for easy hover hitting */}
                  <line
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  <line
                    x1={center}
                    y1={center}
                    x2={x}
                    y2={y}
                    stroke={isInspected ? "#38bdf8" : "#2a3f55"}
                    strokeWidth={isInspected ? "2.2" : "1.2"}
                    className={`axis-spoke-line ${isInspected ? "active" : ""}`}
                  />
                  <text
                    x={lx}
                    y={
                      ly +
                      (axis.angle === -Math.PI / 2 ? -4 : axis.angle === Math.PI / 2 ? 10 : 3)
                    }
                    fill={isInspected ? "#38bdf8" : "#94a3b8"}
                    fontSize={isInspected ? "10" : "9"}
                    fontWeight={isInspected ? "800" : "600"}
                    fontFamily="monospace"
                    textAnchor={textAnchor}
                    letterSpacing="0.5px"
                    className={`axis-label-text ${isInspected ? "active" : ""}`}
                  >
                    {axis.label}
                  </text>
                </g>
              );
            })}

            {/* Planetary Target Polygon (Cyan) */}
            <polygon
              points={targetPoints}
              fill="rgba(34, 211, 238, 0.2)"
              stroke="#22d3ee"
              strokeWidth="2.2"
              style={{ filter: "drop-shadow(0 0 6px rgba(34, 211, 238, 0.4))" }}
            />

            {/* Earth Analog Polygon (Emerald) */}
            <polygon
              points={analogPoints}
              fill="rgba(16, 185, 129, 0.25)"
              stroke="#10b981"
              strokeWidth="2.2"
              strokeDasharray="4 2"
              style={{ filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))" }}
            />

            {/* Target Data Nodes */}
            {axes.map((axis) => {
              const val = targetScores[axis.key] ?? 50;
              const { x, y } = getCoordinates(val, axis.angle);
              const isInspected = inspectedAxisKey === axis.key;
              return (
                <circle
                  key={`target-${axis.key}`}
                  cx={x}
                  cy={y}
                  r={isInspected ? "5" : "3.5"}
                  fill="#22d3ee"
                  stroke="#090e16"
                  strokeWidth="1.5"
                  style={{
                    filter: isInspected ? "drop-shadow(0 0 6px #22d3ee)" : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => setInspectedAxisKey(axis.key)}
                />
              );
            })}

            {/* Analog Data Nodes */}
            {axes.map((axis) => {
              const val = analogScores[axis.key] ?? 50;
              const { x, y } = getCoordinates(val, axis.angle);
              const isInspected = inspectedAxisKey === axis.key;
              return (
                <circle
                  key={`analog-${axis.key}`}
                  cx={x}
                  cy={y}
                  r={isInspected ? "5" : "3.5"}
                  fill="#10b981"
                  stroke="#090e16"
                  strokeWidth="1.5"
                  style={{
                    filter: isInspected ? "drop-shadow(0 0 6px #10b981)" : "none",
                    cursor: "pointer",
                  }}
                  onClick={() => setInspectedAxisKey(axis.key)}
                />
              );
            })}
          </svg>

          {/* Legend */}
          <div className="radar-legend-bar">
            <div className="legend-item">
              <span className="legend-swatch target" />
              <span style={{ color: "#22d3ee", fontWeight: "600" }}>{targetName}</span>
            </div>
            <div className="legend-item">
              <span className="legend-swatch analog" />
              <span style={{ color: "#10b981", fontWeight: "600" }}>{analogName}</span>
            </div>
          </div>

          {/* Interactive Axis Telemetry Card */}
          <div className="axis-telemetry-callout">
            <div className="callout-header">
              <span className="callout-axis-name">
                AXIS: {currentAxisMeta.label}
              </span>
              <span className={`callout-delta-badge ${deltaBadgeClass}`}>
                Δ {delta} PTS · {deltaText}
              </span>
            </div>

            <div className="callout-scores-grid">
              <div className="score-box target">
                <span className="score-box-label">{targetName.toUpperCase()}</span>
                <span className="score-box-val">{tVal} / 100</span>
              </div>
              <div className="score-box analog">
                <span className="score-box-label">{analogName.toUpperCase()}</span>
                <span className="score-box-val">{aVal} / 100</span>
              </div>
            </div>

            <div className="callout-sensor-info">
              <div><strong>Primary Pair:</strong> {activeTargetKey === "jezero" ? currentAxisMeta.marsInstrument : currentAxisMeta.moonInstrument} ⟷ {currentAxisMeta.earthInstrument}</div>
              <div style={{ marginTop: "3px" }}><em>{currentAxisMeta.description}</em></div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODE 2: GLOBAL & PLANETARY LOCATOR MINI-MAP
          ======================================================== */}
      {(activeMode === "locator" || activeMode === "split") && (
        <div style={{ width: "100%", marginTop: activeMode === "split" ? "16px" : "0" }}>
          <GlobalLocatorMap
            activeTargetKey={activeTargetKey}
            activeAnalogKey={activeAnalogKey}
          />
        </div>
      )}
    </div>
  );
}