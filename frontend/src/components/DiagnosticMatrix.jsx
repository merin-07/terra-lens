import {
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Activity,
  Layers,
  BarChart3,
} from "lucide-react";
import RadarChart from "./RadarChart";

export default function DiagnosticMatrix({
  target,
  analog,
  diagnostics,
}) {
  const scores = diagnostics?.scores || {
    slope: 75,
    radar_roughness: 70,
    thermal: 65,
    geochemical: 80,
  };

  const radarVectors = diagnostics?.radar_chart_vectors || {
    target: target?.baseline_profile || { slope: 80, radar_roughness: 75, thermal: 90, geochemical: 70 },
    analog: scores,
  };

  const sensorStats = diagnostics?.sensor_stats || {};
  const tiers = diagnostics?.diagnostics || {
    match: "Morphologic and lithologic characteristics correlate across multi-spectral observation bands.",
    breakdown: "Atmospheric density, precipitation cycles, and terrestrial gravity limit direct environmental fidelity.",
    mitigation: "Compensate through environmental vacuum shrouds and counterbalanced drill downforce.",
  };

  return (
    <aside className="diagnostic-matrix-panel">
      {/* Header */}
      <div className="diag-header">
        <div className="diag-title-row">
          <Activity size={15} color="#76d8c0" />
          <span className="diag-title">SCIENTIFIC DIAGNOSTIC MATRIX</span>
        </div>
        <div className="diag-pair-badge">
          {target?.body?.toUpperCase()}: {target?.name?.split("&")[0].trim()} ⟷ {analog?.name}
        </div>
      </div>

      <div className="diag-scrollable-content">
        {/* Radar Spider Chart Card */}
        <div className="diag-card chart-card">
          <div className="card-section-label">
            <BarChart3 size={13} color="#76d8c0" />
            MULTI-CRITERIA FIDELITY PROFILE
          </div>
          <RadarChart
            targetScores={radarVectors.target}
            analogScores={radarVectors.analog}
            targetName={target?.body || "Target"}
            analogName={analog?.name?.split(" ")[0] || "Analog"}
            size={270}
          />
        </div>

        {/* 4 Sensor Summary Statistics */}
        <div className="diag-card stats-card">
          <div className="card-section-label">
            <Layers size={13} color="#76d8c0" />
            CROSS-SENSOR STATISTICAL METRICS
          </div>
          <div className="stats-table">
            <div className="stats-row stats-row-header">
              <span>LAYER</span>
              <span>MEAN</span>
              <span>MAX</span>
              <span>STD DEV</span>
              <span>UNIT</span>
            </div>

            {["optical", "sar", "thermal", "slope"].map((key) => {
              const stat = sensorStats[key] || {
                mean: "--",
                max: "--",
                std_dev: "--",
                unit: "--",
                agency_source: "--",
              };
              return (
                <div key={key} className="stats-row" title={stat.agency_source}>
                  <strong className={`stat-key-badge ${key}`}>{key.toUpperCase()}</strong>
                  <span className="stat-num">{stat.mean}</span>
                  <span className="stat-num">{stat.max}</span>
                  <span className="stat-num">{stat.std_dev}</span>
                  <span className="stat-unit">{stat.unit}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Tier Diagnostic Cards */}
        <div className="tiers-container">
          {/* Tier 1: HIGH-FIDELITY MATCH (Green accent) */}
          <div className="tier-card tier-match">
            <div className="tier-header">
              <CheckCircle2 size={16} className="tier-icon" />
              <div className="tier-title-wrap">
                <span className="tier-tag">TIER 1 OBSERVATION</span>
                <h4>HIGH-FIDELITY MATCH</h4>
              </div>
            </div>
            <p className="tier-content">{tiers.match}</p>
          </div>

          {/* Tier 2: WHERE ANALOGY BREAKS DOWN (Red alert accent) */}
          <div className="tier-card tier-breakdown">
            <div className="tier-header">
              <AlertTriangle size={16} className="tier-icon" />
              <div className="tier-title-wrap">
                <span className="tier-tag">TIER 2 CRITICAL DIVERGENCE</span>
                <h4>WHERE ANALOGY BREAKS DOWN</h4>
              </div>
            </div>
            <p className="tier-content">{tiers.breakdown}</p>
          </div>

          {/* Tier 3: ENGINEERING MITIGATION PROTOCOL (Blue tactical accent) */}
          <div className="tier-card tier-mitigation">
            <div className="tier-header">
              <Wrench size={16} className="tier-icon" />
              <div className="tier-title-wrap">
                <span className="tier-tag">TIER 3 TESTING PROTOCOL</span>
                <h4>ENGINEERING MITIGATION PROTOCOL</h4>
              </div>
            </div>
            <p className="tier-content">{tiers.mitigation}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
