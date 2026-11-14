import { useState, useEffect, useMemo } from "react";
import {
  Globe2,
  Moon,
  Mountain,
  Satellite,
  SlidersHorizontal,
  Layers3,
  Activity,
  FileText,
  Sparkles,
  RotateCcw,
  TrendingUp,
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

function App() {
  const [activeNav, setActiveNav] = useState("discovery"); // 'discovery' | 'weights' | 'diagnostics'
  const [targets, setTargets] = useState([]);
  const [analogs, setAnalogs] = useState([]);

  // Selections
  const [targetBody, setTargetBody] = useState("Moon");
  const [targetLocation, setTargetLocation] = useState("Shackleton Crater");
  const [selectedAnalogId, setSelectedAnalogId] = useState("tablelands");
  const [activeSensor, setActiveSensor] = useState("optical");

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
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);

  // Map target body to ID
  const selectedTargetId = targetBody === "Moon" ? "shackleton" : "jezero";

  // Initial load
  useEffect(() => {
    async function initCatalog() {
      const [tgtData, anaData] = await Promise.all([getTargets(), getAnalogs()]);
      setTargets(tgtData);
      setAnalogs(anaData);
    }
    initCatalog();
  }, []);

  // Update rankings when target or weights change
  useEffect(() => {
    let isCancelled = false;
    async function updateRankings() {
      setIsLoadingRankings(true);
      try {
        const res = await rankAnalogs(selectedTargetId, weights);
        if (!isCancelled && res?.ranked_analogs) {
          setRankedAnalogs(res.ranked_analogs);
        }
      } catch (err) {
        console.error("Ranking error:", err);
      } finally {
        if (!isCancelled) setIsLoadingRankings(false);
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

  const compositeScore = currentRankedItem?.composite_score ?? 80;

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

  const handleNavClick = (navId) => {
    setActiveNav(navId);
    const element = document.getElementById(navId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
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

  return (
    <div className="app">
      {/* Classical Left Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <Globe2 size={27} />
          <div>
            <h2>TERRA-LENS</h2>
            <span>PLANETARY ANALOG LAB</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <div
          className={`nav-item ${activeNav === "discovery" ? "active" : ""}`}
          onClick={() => handleNavClick("discovery")}
        >
          <Layers3 size={18} /> Discovery
        </div>
        <div
          className={`nav-item ${activeNav === "weights" ? "active" : ""}`}
          onClick={() => handleNavClick("weights")}
        >
          <SlidersHorizontal size={18} /> Mission Weights
        </div>
        <div
          className={`nav-item ${activeNav === "diagnostics" ? "active" : ""}`}
          onClick={() => handleNavClick("diagnostics")}
        >
          <Activity size={18} /> Diagnostics
        </div>
        <div className="nav-item" onClick={() => setIsDossierOpen(true)}>
          <Satellite size={18} /> Campaign Brief
        </div>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          SYSTEM ONLINE
          <p>Workbench v1.0</p>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <span className="eyebrow">PLANETARY SCIENCE / ANALOG DISCOVERY</span>
            <h1>Discovery Workbench</h1>
          </div>

          <div className="topbar-actions">
            <button
              className="compare-button header-dossier-btn"
              onClick={() => setIsDossierOpen(true)}
            >
              <FileText size={16} /> Generate Campaign Brief
            </button>
            <div className="top-status">● LIVE WORKSPACE</div>
          </div>
        </header>

        {/* Intro Banner */}
        <section className="intro">
          <div>
            <h2>Find Earth's planetary twins.</h2>
            <p>
              Compare planetary terrain with terrestrial analog environments
              using multi-spectral satellite observations and synchronized telemetry.
            </p>
          </div>
          <div className="intro-icon">
            <Satellite size={38} />
          </div>
        </section>

        {/* Section 1: Selection Grid */}
        <section className="selection-grid" id="discovery">
          {/* Target Panel */}
          <div className="panel">
            <div className="panel-heading">
              <Moon size={19} />
              <span>PLANETARY TARGET</span>
            </div>

            <label>Target body</label>
            <select
              value={targetBody}
              onChange={(e) => {
                setTargetBody(e.target.value);
                setTargetLocation(
                  e.target.value === "Moon"
                    ? "Shackleton Crater"
                    : "Jezero Crater Margin"
                );
              }}
            >
              <option>Moon</option>
              <option>Mars</option>
            </select>

            <label>Target location</label>
            <select
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
            >
              {targetBody === "Moon" ? (
                <>
                  <option>Shackleton Crater</option>
                  <option>Connecting Ridge</option>
                </>
              ) : (
                <>
                  <option>Jezero Crater Margin</option>
                  <option>Nili Fossae</option>
                </>
              )}
            </select>

            <div className="selection-info">
              <span>SELECTED TARGET</span>
              <strong>{activeTarget?.name || targetLocation}</strong>
              <small>{targetBody} · Coordinates: {activeTarget?.coordinates}</small>
            </div>
          </div>

          {/* Analog Panel */}
          <div className="panel">
            <div className="panel-heading">
              <Mountain size={19} />
              <span>EARTH ANALOG SITE</span>
            </div>

            <label>Analog environment</label>
            <select
              value={selectedAnalogId}
              onChange={(e) => setSelectedAnalogId(e.target.value)}
            >
              {analogs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.region || a.country})
                </option>
              ))}
            </select>

            <div className="selection-info">
              <span>SELECTED ANALOG</span>
              <strong>{activeAnalog?.name}</strong>
              <small>Earth · {activeAnalog?.region} · {activeAnalog?.coordinates}</small>
            </div>
          </div>
        </section>

        {/* Section 2: Terrain Comparison & Synchronized Split-Scope */}
        <section className="comparison">
          <div className="section-heading">
            <div>
              <h2>Terrain comparison</h2>
              <p>Side-by-side planetary and terrestrial multi-sensor analysis</p>
            </div>

            <button
              className="compare-button"
              onClick={() => setIsDossierOpen(true)}
            >
              <FileText size={16} /> View Field Dossier
            </button>
          </div>

          {/* Synchronized Split-Scope Viewports */}
          <SplitScope
            target={activeTarget}
            analog={activeAnalog}
            activeSensor={activeSensor}
            onSensorChange={setActiveSensor}
            diagnostics={diagnostics}
          />
        </section>

        {/* Section 3: Mission Priority Weighting Engine */}
        <section className="workbench-section" id="weights">
          <div className="section-heading">
            <div>
              <h2>Mission Priority Weighting Engine</h2>
              <p>Calibrate exploration criteria to rank candidate Earth analog sites in real-time</p>
            </div>
          </div>

          <div className="weights-layout-grid">
            {/* Left: Sliders & Presets */}
            <div className="panel weights-controls-card">
              <div className="panel-heading">
                <SlidersHorizontal size={18} />
                <span>MISSION PRESETS & CRITERIA WEIGHTS</span>
              </div>

              {/* Presets */}
              <div className="presets-row">
                {MISSION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`preset-btn ${activePreset === p.id ? "active" : ""}`}
                    onClick={() => applyPreset(p)}
                  >
                    <Sparkles size={12} />
                    {p.name}
                  </button>
                ))}
                <button className="reset-btn" onClick={resetWeights} title="Equalize weights">
                  <RotateCcw size={12} /> 25% Reset
                </button>
              </div>

              {/* 4 Sliders */}
              <div className="sliders-stack">
                <div className="slider-control">
                  <div className="slider-info">
                    <span>Topographic & Slope</span>
                    <strong>{weights.slope}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={weights.slope}
                    onChange={(e) => handleSliderChange("slope", e.target.value)}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-info">
                    <span>SAR Roughness & Blocks</span>
                    <strong>{weights.radar_roughness}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={weights.radar_roughness}
                    onChange={(e) => handleSliderChange("radar_roughness", e.target.value)}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-info">
                    <span>Thermal & Cryogenic Regime</span>
                    <strong>{weights.thermal}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={weights.thermal}
                    onChange={(e) => handleSliderChange("thermal", e.target.value)}
                  />
                </div>

                <div className="slider-control">
                  <div className="slider-info">
                    <span>Geochemical & Process Match</span>
                    <strong>{weights.geochemical}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={weights.geochemical}
                    onChange={(e) => handleSliderChange("geochemical", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Right: Real-time Ranked Analog Cards */}
            <div className="panel ranked-analogs-card">
              <div className="panel-heading">
                <TrendingUp size={18} />
                <span>DYNAMIC ANALOG RANKINGS</span>
                {isLoadingRankings && <span className="sync-tag">CALCULATING...</span>}
              </div>

              <div className="ranked-list">
                {rankedAnalogs.map((item) => {
                  const isSelected = item.analog_id === selectedAnalogId;
                  return (
                    <div
                      key={item.analog_id}
                      className={`ranked-item ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedAnalogId(item.analog_id)}
                    >
                      <div className="ranked-item-rank">#{item.rank}</div>
                      <div className="ranked-item-details">
                        <strong>{item.name}</strong>
                        <span>{item.region}</span>
                      </div>
                      <div className="ranked-item-score">
                        {item.composite_score}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Scientific Diagnostic Matrix */}
        <section className="workbench-section" id="diagnostics">
          <div className="section-heading">
            <div>
              <h2>Scientific Diagnostic Matrix</h2>
              <p>4-axis radar profile and 3-tier physical fidelity diagnostics</p>
            </div>
          </div>

          <div className="diagnostics-layout-grid">
            {/* Left: SVG Radar Chart & Sensor Stats */}
            <div className="panel chart-panel">
              <div className="panel-heading">
                <Activity size={18} />
                <span>4-AXIS FIDELITY PROFILE: {activeTarget?.body} vs {activeAnalog?.name}</span>
              </div>

              <RadarChart
                targetScores={radarVectors.target}
                analogScores={radarVectors.analog}
                targetName={activeTarget?.body || "Target"}
                analogName={activeAnalog?.name?.split(" ")[0] || "Analog"}
                size={270}
              />

              {/* Cross-Sensor Statistics Table */}
              <div className="stats-mini-table">
                <div className="stats-mini-row header">
                  <span>SENSOR</span>
                  <span>MEAN</span>
                  <span>MAX</span>
                  <span>UNIT</span>
                </div>
                {["optical", "sar", "thermal", "slope"].map((s) => {
                  const st = sensorStats[s] || { mean: "--", max: "--", unit: "--" };
                  return (
                    <div key={s} className="stats-mini-row">
                      <strong className={`sensor-tag ${s}`}>{s.toUpperCase()}</strong>
                      <span>{st.mean}</span>
                      <span>{st.max}</span>
                      <small>{st.unit}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: 3-Tier Diagnostic Cards */}
            <div className="tiers-column">
              {/* Tier 1: HIGH-FIDELITY MATCH */}
              <div className="diagnostic-card tier-match">
                <div className="diag-card-header">
                  <span className="diag-tag">TIER 1 OBSERVATION</span>
                  <h3>HIGH-FIDELITY MATCH</h3>
                </div>
                <p>{tiers.match}</p>
              </div>

              {/* Tier 2: WHERE ANALOGY BREAKS DOWN */}
              <div className="diagnostic-card tier-breakdown">
                <div className="diag-card-header">
                  <span className="diag-tag">TIER 2 DIVERGENCE</span>
                  <h3>WHERE ANALOGY BREAKS DOWN</h3>
                </div>
                <p>{tiers.breakdown}</p>
              </div>

              {/* Tier 3: ENGINEERING MITIGATION PROTOCOL */}
              <div className="diagnostic-card tier-mitigation">
                <div className="diag-card-header">
                  <span className="diag-tag">TIER 3 TESTING PROTOCOL</span>
                  <h3>ENGINEERING MITIGATION PROTOCOL</h3>
                </div>
                <p>{tiers.mitigation}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Classical Footer */}
        <footer>
          TERRA-LENS · Planetary Analog Discovery Workbench
          <span>MISSION OPERATIONS v1.0</span>
        </footer>
      </main>

      {/* Campaign Brief Dossier Modal */}
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
