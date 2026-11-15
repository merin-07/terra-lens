import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Activity,
  Crosshair,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
} from "lucide-react";
import SplitScope from "./components/SplitScope";
import RadarChart from "./components/RadarChart";
import CampaignDossierModal from "./components/CampaignDossierModal";
import {
  getTargets,
  getAnalogs,
  getDiagnostics,
  rankAnalogs,
} from "./services/api";
import "./App.css";

const MISSION_PRESETS = [
  {
    id: "mobility",
    name: "Polar Rover Mobility",
    weights: { slope: 50, radar_roughness: 30, thermal: 10, geochemical: 10 },
  },
  {
    id: "cryo_drill",
    name: "Subsurface Cryo-Drill",
    weights: { slope: 10, radar_roughness: 40, thermal: 40, geochemical: 10 },
  },
  {
    id: "isru",
    name: "ISRU & Dust Filtration",
    weights: { slope: 10, radar_roughness: 15, thermal: 25, geochemical: 50 },
  },
];

const WAVELENGTHS = [
  { id: "optical", label: "Optical" },
  { id: "sar", label: "SAR Radar" },
  { id: "thermal", label: "Thermal" },
  { id: "slope", label: "Elevation" },
];

const LOUPE_RADII = [90, 140, 200];

/**
 * Animated SVG Circular Score Progress Ring (0-100%)
 */
function CircularScoreRing({ score = 80, size = 38, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const offset = circumference - (progress / 100) * circumference;

  const color =
    progress >= 80
      ? "#34d399"
      : progress >= 65
      ? "#38bdf8"
      : progress >= 50
      ? "#fbbf24"
      : "#fb7185";

  return (
    <div className="circular-score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s ease",
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
          }}
        />
      </svg>
      <span className="score-ring-val" style={{ color }}>
        {progress}%
      </span>
    </div>
  );
}

function App() {
  const [targets, setTargets] = useState([]);
  const [analogs, setAnalogs] = useState([]);

  // Selections
  const [targetBody, setTargetBody] = useState("Moon"); // "Moon" | "Mars"
  const [selectedAnalogId, setSelectedAnalogId] = useState("tablelands");
  const [activeSensor, setActiveSensor] = useState("optical"); // "optical" | "sar" | "thermal" | "slope"

  // Mission priority weights
  const [weights, setWeights] = useState({
    slope: 25,
    radar_roughness: 25,
    thermal: 25,
    geochemical: 25,
  });
  const [activePreset, setActivePreset] = useState(null);

  const [rankedAnalogs, setRankedAnalogs] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);

  // Overlays & Modals
  const [isWeightsOpen, setIsWeightsOpen] = useState(false);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [isTransectOpen, setIsTransectOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  // X-Ray Magnifying Loupe
  const [loupeActive, setLoupeActive] = useState(false);
  const [chosenLoupeSensor, setChosenLoupeSensor] = useState("sar");
  const [loupeRadius, setLoupeRadius] = useState(140);

  // Diagnostic tabs inside Radar Overlay
  const [diagTab, setDiagTab] = useState("ALL"); // 'ALL' | 'MATCH' | 'BREAKDOWN' | 'MITIGATION' | 'STATS'

  // Live real-pixel telemetry reported by SplitScope
  const [telemetry, setTelemetry] = useState(null);

  const splitScopeRef = useRef(null);

  // Target ID mapping
  const selectedTargetId = targetBody === "Moon" ? "shackleton" : "jezero";

  // Initial load
  useEffect(() => {
    async function initCatalog() {
      try {
        const [tgtData, anaData] = await Promise.all([getTargets(), getAnalogs()]);
        setTargets(tgtData);
        setAnalogs(anaData);
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    initCatalog();
  }, []);

  // Update rankings when target or weights change
  useEffect(() => {
    let isCancelled = false;
    async function updateRankings() {
      try {
        const res = await rankAnalogs(selectedTargetId, weights);
        if (!isCancelled && res?.ranked_analogs) {
          setRankedAnalogs(res.ranked_analogs);
        }
      } catch (err) {
        console.error("Ranking error:", err);
      }
    }
    updateRankings();
    return () => {
      isCancelled = true;
    };
  }, [selectedTargetId, weights]);

  // Update diagnostics when target or analog changes
  useEffect(() => {
    let isCancelled = false;
    async function updateDiagnostics() {
      try {
        const diagData = await getDiagnostics(selectedTargetId, selectedAnalogId);
        if (!isCancelled) {
          setDiagnostics(diagData);
        }
      } catch (err) {
        console.error("Diagnostics error:", err);
      }
    }
    updateDiagnostics();
    return () => {
      isCancelled = true;
    };
  }, [selectedTargetId, selectedAnalogId]);

  const activeTarget = useMemo(() => {
    return targets.find((t) => t.id === selectedTargetId) || targets[0];
  }, [targets, selectedTargetId]);

  const activeAnalog = useMemo(() => {
    return analogs.find((a) => a.id === selectedAnalogId) || analogs[0];
  }, [analogs, selectedAnalogId]);

  const currentRankedItem = useMemo(() => {
    return rankedAnalogs.find((r) => r.analog_id === selectedAnalogId);
  }, [rankedAnalogs, selectedAnalogId]);

  const compositeScore = currentRankedItem?.composite_score ?? 81.5;

  const currentAnalogIndex = useMemo(() => {
    const idx = analogs.findIndex((a) => a.id === selectedAnalogId);
    return idx >= 0 ? idx : 0;
  }, [analogs, selectedAnalogId]);

  const currentAnalogRank = currentRankedItem?.rank ?? currentAnalogIndex + 1;

  // Cycle through Earth Analogs
  const handlePrevAnalog = useCallback(() => {
    if (analogs.length === 0) return;
    const newIndex = (currentAnalogIndex - 1 + analogs.length) % analogs.length;
    setSelectedAnalogId(analogs[newIndex].id);
  }, [analogs, currentAnalogIndex]);

  const handleNextAnalog = useCallback(() => {
    if (analogs.length === 0) return;
    const newIndex = (currentAnalogIndex + 1) % analogs.length;
    setSelectedAnalogId(analogs[newIndex].id);
  }, [analogs, currentAnalogIndex]);

  // Weight Slider Handlers
  const handleSliderChange = (key, val) => {
    setActivePreset(null);
    setWeights((prev) => ({
      ...prev,
      [key]: Number(val),
    }));
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setWeights(preset.weights);
  };

  const resetWeights = () => {
    setActivePreset(null);
    setWeights({ slope: 25, radar_roughness: 25, thermal: 25, geochemical: 25 });
  };

  const tiers = diagnostics?.diagnostics || {
    match: "Morphologic and lithologic characteristics correlate across multi-spectral observation bands.",
    breakdown: "Atmospheric density, precipitation cycles, and terrestrial gravity limit direct environmental fidelity.",
    mitigation: "Compensate through environmental vacuum shrouds and counterbalanced drill downforce.",
  };

  const sensorStats = diagnostics?.sensor_stats || {};
  const radarVectors = diagnostics?.radar_chart_vectors || {
    target: activeTarget?.baseline_profile || { slope: 80, radar_roughness: 75, thermal: 90, geochemical: 70 },
    analog: diagnostics?.scores || { slope: 75, radar_roughness: 70, thermal: 65, geochemical: 80 },
  };

  // Safe fallback telemetry values
  const targetReadout =
    telemetry?.targetTelemetry?.physicalValue?.formatted || "0.21 Albedo (LROC NAC)";
  const analogReadout =
    telemetry?.analogTelemetry?.physicalValue?.formatted || "0.22 Albedo (Sentinel-2)";
  const deltaBadge = telemetry?.differentialBadge || {
    deltaPhysical: "+0.001 A",
    status: "High Fidelity",
    statusClass: "high",
  };

  return (
    <div className="spatial-experience-root">
      {/* ====================================================================
          LAYER 0: FULL-BLEED 100vw × 100vh DUAL WORLD CANVAS (z-index: 1)
          ==================================================================== */}
      <SplitScope
        ref={splitScopeRef}
        target={activeTarget}
        analog={activeAnalog}
        activeSensor={activeSensor}
        loupeActive={loupeActive}
        chosenLoupeSensor={chosenLoupeSensor}
        loupeRadius={loupeRadius}
        showTransect={isTransectOpen}
        onCloseTransect={() => setIsTransectOpen(false)}
        onTelemetryChange={setTelemetry}
      />

      {/* ====================================================================
          LAYER 1: ATMOSPHERIC VIGNETTES & CENTER LIGHT SEAM (z-index: 10)
          ==================================================================== */}
      <div className="cinematic-vignette-top" />
      <div className="cinematic-vignette-bottom" />
      <div className="world-light-seam" />

      {/* ====================================================================
          LAYER 2: EDITORIAL WORLD HEADERS (z-index: 20)
          ==================================================================== */}
      {/* Top-Left: Planetary Target Header */}
      <header className="editorial-world-overlay target-overlay">
        <div className="eyebrow-glass-pill">
          <span className="eyebrow-accent-dot" />
          <span>
            TARGET WORLD · {activeTarget?.coordinates || "89.9°S, 0.0°E"} ·{" "}
            {activeTarget?.layers?.[activeSensor]?.instrument || "NASA LROC NAC"}
          </span>
        </div>

        <h1 className="editorial-world-title">
          {activeTarget?.name || "Shackleton Crater"}
        </h1>

        <div className="editorial-sensor-readout">
          <span>Cursor Telemetry: {targetReadout}</span>
          <span className="readout-divider">·</span>
          <span>Scale 10 × 10 km Locked</span>
        </div>
      </header>

      {/* Top-Right: Earth Analog Header */}
      <header className="editorial-world-overlay analog-overlay">
        <div className="analog-eyebrow-row">
          <div className="eyebrow-glass-pill">
            <span>
              EARTH ANALOG #{String(currentAnalogRank).padStart(2, "0")} OF 05 ·{" "}
              {activeAnalog?.coordinates || "49.46°N, 57.95°W"} ·{" "}
              {activeAnalog?.layers?.[activeSensor]?.instrument || "ESA Sentinel-2"}
            </span>
          </div>
          <div className="fidelity-match-pill">
            {compositeScore}% MATCH
          </div>
        </div>

        <div className="analog-title-row">
          <button
            className="hero-cycle-btn"
            onClick={handlePrevAnalog}
            title="Previous Earth Analog"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="editorial-world-title">
            {activeAnalog?.name || "The Tablelands"}
          </h1>
          <button
            className="hero-cycle-btn"
            onClick={handleNextAnalog}
            title="Next Earth Analog"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="editorial-sensor-readout right-align">
          <span>{analogReadout}</span>
          <span className="readout-divider">·</span>
          <span className={`delta-tag ${deltaBadge.statusClass}`}>
            Δ {deltaBadge.deltaPhysical} · {deltaBadge.status}
          </span>
        </div>
      </header>

      {/* ====================================================================
          LAYER 3: TOP-CENTER SPATIAL NAVIGATION CAPSULE (z-index: 30)
          ==================================================================== */}
      <nav className="top-center-capsule">
        {/* Brand Mark */}
        <div className="capsule-brand">
          <svg className="capsule-brand-ring" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="12" cy="12" r="5" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2" fill="#34d399" />
          </svg>
          <span className="capsule-brand-title">TERRA·LENS</span>
        </div>

        {/* Planet Switcher Segmented Pill */}
        <div className="capsule-planet-track">
          <button
            className={`capsule-planet-pill ${targetBody === "Moon" ? "active" : ""}`}
            onClick={() => setTargetBody("Moon")}
          >
            Moon · Shackleton
          </button>
          <button
            className={`capsule-planet-pill ${targetBody === "Mars" ? "active" : ""}`}
            onClick={() => setTargetBody("Mars")}
          >
            Mars · Jezero
          </button>
        </div>

        {/* Flight Dossier Action Pill */}
        <button
          className="capsule-dossier-btn"
          onClick={() => setIsDossierOpen(true)}
        >
          Flight Dossier ↗
        </button>
      </nav>

      {/* ====================================================================
          LAYER 4: BOTTOM-CENTER VISIONOS FLOATING CONTROL DOCK (z-index: 30)
          ==================================================================== */}
      <div className="bottom-dock-container">
        {/* Floating Sub-Pill for X-Ray Loupe Controls (Progressive Disclosure) */}
        {loupeActive && (
          <div className="loupe-floating-subpill">
            <div className="subpill-section">
              <span className="subpill-label">REVEALS:</span>
              <div className="subpill-buttons">
                {WAVELENGTHS.filter((w) => w.id !== activeSensor).map((w) => (
                  <button
                    key={w.id}
                    className={`subpill-btn ${chosenLoupeSensor === w.id ? "active" : ""}`}
                    onClick={() => setChosenLoupeSensor(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="subpill-divider" />

            <div className="subpill-section">
              <span className="subpill-label">LENS SIZE:</span>
              <div className="subpill-buttons">
                {LOUPE_RADII.map((radius) => (
                  <button
                    key={radius}
                    className={`subpill-btn ${loupeRadius === radius ? "active" : ""}`}
                    onClick={() => setLoupeRadius(radius)}
                  >
                    {radius}px
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <footer className="spatial-vision-dock">
          {/* Group 1: Wavelength Selector Pills */}
          <div className="dock-pill-group">
            {WAVELENGTHS.map((wave) => (
              <button
                key={wave.id}
                className={`wavelength-pill ${activeSensor === wave.id ? "active" : ""}`}
                onClick={() => setActiveSensor(wave.id)}
              >
                {wave.label}
              </button>
            ))}
          </div>

          <div className="dock-divider" />

          {/* Group 2: X-Ray Lens & Zoom Micro-Pills */}
          <div className="dock-pill-group">
            <button
              className={`lens-toggle-pill ${loupeActive ? "active" : ""}`}
              onClick={() => setLoupeActive(!loupeActive)}
              title="Toggle Circular X-Ray Magnifying Lens"
            >
              <Crosshair size={14} />
              <span>X-Ray Lens</span>
            </button>

            <button
              className="dock-icon-btn"
              onClick={() => splitScopeRef.current?.zoomIn()}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button
              className="dock-icon-btn"
              onClick={() => splitScopeRef.current?.zoomOut()}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              className="dock-icon-btn"
              onClick={() => splitScopeRef.current?.resetZoom()}
              title="Reset View 1:1"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="dock-divider" />

          {/* Group 3: Spatial Overlay Drawer Triggers */}
          <div className="dock-pill-group">
            <button
              className={`overlay-trigger-pill ${isWeightsOpen ? "active" : ""}`}
              onClick={() => {
                setIsWeightsOpen(!isWeightsOpen);
                if (!isWeightsOpen) {
                  setIsRadarOpen(false);
                  setIsTransectOpen(false);
                }
              }}
            >
              <Sparkles size={14} />
              <span>Analogs & Weights</span>
            </button>

            <button
              className={`overlay-trigger-pill ${isRadarOpen ? "active" : ""}`}
              onClick={() => {
                setIsRadarOpen(!isRadarOpen);
                if (!isRadarOpen) {
                  setIsWeightsOpen(false);
                  setIsTransectOpen(false);
                }
              }}
            >
              <Compass size={14} />
              <span>Insights & Radar</span>
            </button>

            <button
              className={`overlay-trigger-pill ${isTransectOpen ? "active" : ""}`}
              onClick={() => {
                setIsTransectOpen(!isTransectOpen);
                if (!isTransectOpen) {
                  setIsWeightsOpen(false);
                  setIsRadarOpen(false);
                }
              }}
            >
              <Activity size={14} />
              <span>Transect</span>
            </button>
          </div>
        </footer>
      </div>

      {/* ====================================================================
          LAYER 5: APPLE VISIONOS SPATIAL GLASS OVERLAYS (z-index: 40)
          ==================================================================== */}
      {/* Overlay A: Mission Priority & Analog Selection */}
      {isWeightsOpen && (
        <div className="spatial-glass-sheet weights-overlay">
          <div className="sheet-header">
            <div className="sheet-title-group">
              <SlidersHorizontal size={18} color="#38bdf8" />
              <h3>Mission Priority & Analog Selection</h3>
            </div>

            <div className="sheet-actions">
              {/* 3 Mission Profile Preset Pills */}
              <div className="presets-pill-row">
                {MISSION_PRESETS.map((p) => {
                  const isActive = activePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      className={`preset-chip ${isActive ? "active" : ""}`}
                      onClick={() => applyPreset(p)}
                    >
                      <Sparkles size={12} />
                      <span>{p.name}</span>
                    </button>
                  );
                })}
                <button className="equalize-btn" onClick={resetWeights}>
                  <RotateCcw size={11} />
                  <span>Equalize 25%</span>
                </button>
              </div>

              <button
                className="sheet-close-btn"
                onClick={() => setIsWeightsOpen(false)}
                title="Close Sheet"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Middle Row: 4 Sleek Priority Sliders */}
          <div className="priority-sliders-row">
            <div className="spatial-slider-box">
              <div className="slider-header-mini">
                <span>Topographic Slope</span>
                <strong className="slider-val">{weights.slope}%</strong>
              </div>
              <input
                type="range"
                className="spatial-range-slider"
                min="0"
                max="100"
                step="5"
                value={weights.slope}
                onChange={(e) => handleSliderChange("slope", e.target.value)}
              />
            </div>

            <div className="spatial-slider-box">
              <div className="slider-header-mini">
                <span>SAR Roughness</span>
                <strong className="slider-val">{weights.radar_roughness}%</strong>
              </div>
              <input
                type="range"
                className="spatial-range-slider"
                min="0"
                max="100"
                step="5"
                value={weights.radar_roughness}
                onChange={(e) => handleSliderChange("radar_roughness", e.target.value)}
              />
            </div>

            <div className="spatial-slider-box">
              <div className="slider-header-mini">
                <span>Thermal Regime</span>
                <strong className="slider-val">{weights.thermal}%</strong>
              </div>
              <input
                type="range"
                className="spatial-range-slider"
                min="0"
                max="100"
                step="5"
                value={weights.thermal}
                onChange={(e) => handleSliderChange("thermal", e.target.value)}
              />
            </div>

            <div className="spatial-slider-box">
              <div className="slider-header-mini">
                <span>Geochemistry</span>
                <strong className="slider-val">{weights.geochemical}%</strong>
              </div>
              <input
                type="range"
                className="spatial-range-slider"
                min="0"
                max="100"
                step="5"
                value={weights.geochemical}
                onChange={(e) => handleSliderChange("geochemical", e.target.value)}
              />
            </div>
          </div>

          {/* Bottom Row: 5-Card Interactive Analog Filmstrip */}
          <div className="analog-filmstrip-grid">
            {rankedAnalogs.map((item) => {
              const isSelected = item.analog_id === selectedAnalogId;
              const matchingAnalog = analogs.find((a) => a.id === item.analog_id);
              const previewSrc =
                matchingAnalog?.layers?.optical?.path ||
                `/data/earth/${item.analog_id}/optical/preview.png`;

              return (
                <div
                  key={item.analog_id}
                  className={`filmstrip-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedAnalogId(item.analog_id)}
                >
                  <div className="filmstrip-thumb-wrap">
                    <img
                      src={previewSrc}
                      alt={item.name}
                      className="filmstrip-thumb-img"
                      onError={(e) => {
                        e.currentTarget.src =
                          "/data/moon/shackleton/optical/shackleton_preview_cropped.png";
                      }}
                    />
                    <div className="filmstrip-rank-badge">#{item.rank}</div>
                    <div className="filmstrip-ring-overlay">
                      <CircularScoreRing score={item.composite_score} size={32} strokeWidth={2.5} />
                    </div>
                  </div>

                  <div className="filmstrip-info">
                    <strong className="filmstrip-title">{item.name}</strong>
                    <span className="filmstrip-region">{item.region}</span>
                    <div className="filmstrip-mini-bars">
                      <span title="Slope">SLO {item.scores?.slope ?? 75}%</span>
                      <span title="SAR">SAR {item.scores?.radar_roughness ?? 70}%</span>
                      <span title="Thermal">THE {item.scores?.thermal ?? 65}%</span>
                      <span title="Geochem">GEO {item.scores?.geochemical ?? 80}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overlay B: Fidelity Insights & Radar Studio */}
      {isRadarOpen && (
        <div className="spatial-glass-sheet radar-overlay">
          <div className="sheet-header">
            <div className="sheet-title-group">
              <Compass size={18} color="#38bdf8" />
              <h3>Fidelity Insights, Radar & Geospatial Coordinates</h3>
            </div>
            <button
              className="sheet-close-btn"
              onClick={() => setIsRadarOpen(false)}
              title="Close Studio"
            >
              <X size={16} />
            </button>
          </div>

          <div className="radar-studio-grid">
            {/* Left Column: Interactive Radar Chart & Global Map */}
            <div className="radar-chart-well">
              <RadarChart
                targetScores={radarVectors.target}
                analogScores={radarVectors.analog}
                targetName={activeTarget?.body || "Target"}
                analogName={activeAnalog?.name?.split(" ")[0] || "Analog"}
                targetId={selectedTargetId}
                analogId={selectedAnalogId}
                size={270}
                defaultMode="radar"
              />
            </div>

            {/* Right Column: Segmented Diagnostic Tiers & Statistics */}
            <div className="studio-diagnostics-column">
              <div className="studio-tabs-row">
                <button
                  className={`studio-tab-btn ${diagTab === "ALL" ? "active" : ""}`}
                  onClick={() => setDiagTab("ALL")}
                >
                  All Insights
                </button>
                <button
                  className={`studio-tab-btn ${diagTab === "MATCH" ? "active" : ""}`}
                  onClick={() => setDiagTab("MATCH")}
                >
                  High-Fidelity Match
                </button>
                <button
                  className={`studio-tab-btn ${diagTab === "BREAKDOWN" ? "active" : ""}`}
                  onClick={() => setDiagTab("BREAKDOWN")}
                >
                  Where Analogy Breaks Down
                </button>
                <button
                  className={`studio-tab-btn ${diagTab === "MITIGATION" ? "active" : ""}`}
                  onClick={() => setDiagTab("MITIGATION")}
                >
                  Engineering Mitigation
                </button>
                <button
                  className={`studio-tab-btn ${diagTab === "STATS" ? "active" : ""}`}
                  onClick={() => setDiagTab("STATS")}
                >
                  Sensor Statistics
                </button>
              </div>

              {diagTab !== "STATS" ? (
                <div className="studio-cards-stack">
                  {(diagTab === "ALL" || diagTab === "MATCH") && (
                    <div className="studio-insight-card match">
                      <div className="insight-card-top">
                        <span className="insight-badge match">TIER 1 MATCH</span>
                        <h4>HIGH-FIDELITY OBSERVATION</h4>
                      </div>
                      <p>{tiers.match}</p>
                    </div>
                  )}

                  {(diagTab === "ALL" || diagTab === "BREAKDOWN") && (
                    <div className="studio-insight-card breakdown">
                      <div className="insight-card-top">
                        <span className="insight-badge breakdown">TIER 2 DIVERGENCE</span>
                        <h4>WHERE ANALOGY BREAKS DOWN</h4>
                      </div>
                      <p>{tiers.breakdown}</p>
                    </div>
                  )}

                  {(diagTab === "ALL" || diagTab === "MITIGATION") && (
                    <div className="studio-insight-card mitigation">
                      <div className="insight-card-top">
                        <span className="insight-badge mitigation">TIER 3 TESTING PROTOCOL</span>
                        <h4>ENGINEERING MITIGATION PROTOCOL</h4>
                      </div>
                      <p>{tiers.mitigation}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="studio-stats-table-wrap">
                  <table className="studio-stats-table">
                    <thead>
                      <tr>
                        <th>SENSOR</th>
                        <th>MEAN VALUE</th>
                        <th>PEAK VALUE</th>
                        <th>ENGINEERING UNIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["optical", "sar", "thermal", "slope"].map((s) => {
                        const st = sensorStats[s] || { mean: "--", max: "--", unit: "--" };
                        return (
                          <tr key={s}>
                            <td>
                              <strong className={`stat-sensor-name ${s}`}>
                                {s.toUpperCase()}
                              </strong>
                            </td>
                            <td>{st.mean}</td>
                            <td>{st.max}</td>
                            <td className="stat-unit">{st.unit}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign Dossier Export Modal */}
      <CampaignDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        target={activeTarget}
        analog={activeAnalog}
        diagnostics={diagnostics}
        weights={weights}
        compositeScore={compositeScore}
      />
    </div>
  );
}

export default App;
