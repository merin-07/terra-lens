import { useState } from "react";
import {
  Sliders,
  Sparkles,
  TrendingUp,
  RotateCcw,
} from "lucide-react";

const MISSION_PRESETS = [
  {
    id: "mobility",
    name: "Polar Rover Mobility",
    description: "Focus on slope steepness, wheel traction, and boulder hazard roughness.",
    weights: { slope: 50, radar_roughness: 30, thermal: 10, geochemical: 10 },
  },
  {
    id: "cryo_drill",
    name: "Subsurface Cryo-Drill",
    description: "Focus on subsurface ice dielectric boundaries and cryogenic thermal traps.",
    weights: { slope: 10, radar_roughness: 40, thermal: 40, geochemical: 10 },
  },
  {
    id: "isru",
    name: "ISRU & Dust Filtration",
    description: "Focus on mineralogy, serpentinization, clays, and abrasive particle wear.",
    weights: { slope: 10, radar_roughness: 15, thermal: 25, geochemical: 50 },
  },
];

export default function WeightingEngine({
  targets = [],
  selectedTargetId,
  onSelectTarget,
  selectedAnalogId,
  onSelectAnalog,
  weights,
  onWeightsChange,
  rankedAnalogs = [],
  isLoadingRankings = false,
}) {
  const [activePreset, setActivePreset] = useState(null);

  const handleSliderChange = (key, value) => {
    setActivePreset(null);
    onWeightsChange({
      ...weights,
      [key]: Number(value),
    });
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    onWeightsChange(preset.weights);
  };

  const resetWeights = () => {
    setActivePreset(null);
    onWeightsChange({
      slope: 25,
      radar_roughness: 25,
      thermal: 25,
      geochemical: 25,
    });
  };

  const getScoreColor = (score) => {
    if (score >= 82) return "#10b981"; // green
    if (score >= 74) return "#76d8c0"; // teal
    if (score >= 65) return "#38bdf8"; // sky blue
    return "#94a3b8"; // slate
  };

  return (
    <aside className="weighting-engine-panel">
      {/* Target Selector Toggle */}
      <div className="section-box target-toggle-box">
        <div className="box-title">
          <span className="dot-indicator" />
          PLANETARY TARGET
        </div>

        <div className="target-toggle-buttons">
          {targets.map((tgt) => {
            const isSelected = tgt.id === selectedTargetId;
            return (
              <button
                key={tgt.id}
                className={`target-btn ${isSelected ? "active" : ""}`}
                onClick={() => onSelectTarget(tgt.id)}
              >
                <span className="target-btn-body">{tgt.body?.toUpperCase()}</span>
                <strong className="target-btn-name">{tgt.name?.split("&")[0].split("/")[0].trim()}</strong>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mission Presets */}
      <div className="section-box presets-box">
        <div className="box-title-row">
          <div className="box-title">
            <Sparkles size={13} color="#76d8c0" />
            MISSION PRESETS
          </div>
          <button className="reset-weights-btn" onClick={resetWeights} title="Equalize weights">
            <RotateCcw size={11} /> 25% EQUAL
          </button>
        </div>

        <div className="preset-buttons">
          {MISSION_PRESETS.map((preset) => {
            const isPresetActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                className={`preset-pill ${isPresetActive ? "active" : ""}`}
                onClick={() => applyPreset(preset)}
                title={preset.description}
              >
                <div className="preset-pill-title">{preset.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority Sliders */}
      <div className="section-box sliders-box">
        <div className="box-title">
          <Sliders size={13} color="#76d8c0" />
          MISSION PRIORITY WEIGHTS
        </div>

        <div className="sliders-list">
          {/* Slider 1: Topographic & Slope */}
          <div className="slider-item">
            <div className="slider-header">
              <span className="slider-label">Topographic & Slope</span>
              <strong className="slider-value">{weights.slope}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.slope}
              onChange={(e) => handleSliderChange("slope", e.target.value)}
              className="slider-range"
            />
          </div>

          {/* Slider 2: SAR Roughness */}
          <div className="slider-item">
            <div className="slider-header">
              <span className="slider-label">SAR Roughness & Blocks</span>
              <strong className="slider-value">{weights.radar_roughness}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.radar_roughness}
              onChange={(e) => handleSliderChange("radar_roughness", e.target.value)}
              className="slider-range"
            />
          </div>

          {/* Slider 3: Thermal Regime */}
          <div className="slider-item">
            <div className="slider-header">
              <span className="slider-label">Thermal & Cryogenic</span>
              <strong className="slider-value">{weights.thermal}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.thermal}
              onChange={(e) => handleSliderChange("thermal", e.target.value)}
              className="slider-range"
            />
          </div>

          {/* Slider 4: Geochemical Match */}
          <div className="slider-item">
            <div className="slider-header">
              <span className="slider-label">Geochemical & Process</span>
              <strong className="slider-value">{weights.geochemical}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={weights.geochemical}
              onChange={(e) => handleSliderChange("geochemical", e.target.value)}
              className="slider-range"
            />
          </div>
        </div>
      </div>

      {/* Real-Time Ranked Earth Analogs */}
      <div className="section-box ranking-box">
        <div className="box-title-row">
          <div className="box-title">
            <TrendingUp size={13} color="#76d8c0" />
            RANKED ANALOG MATCHES
          </div>
          {isLoadingRankings && <span className="sync-spinner" />}
        </div>

        <div className="ranked-cards-scroll">
          {rankedAnalogs.map((item) => {
            const isSelected = item.analog_id === selectedAnalogId;
            const scoreColor = getScoreColor(item.composite_score);

            return (
              <div
                key={item.analog_id}
                className={`ranked-analog-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectAnalog(item.analog_id)}
              >
                <div className="card-top-row">
                  <div className="card-rank-badge">#{item.rank}</div>
                  <div className="card-info">
                    <strong className="card-name">{item.name}</strong>
                    <span className="card-region">{item.region}</span>
                  </div>
                  <div
                    className="card-score-badge"
                    style={{
                      borderColor: scoreColor,
                      color: scoreColor,
                      backgroundColor: `${scoreColor}14`,
                    }}
                  >
                    {item.composite_score}%
                  </div>
                </div>

                {/* Mini Multi-Sensor Breakdown Bars */}
                <div className="mini-bars-grid">
                  <div className="mini-bar-col" title={`Slope: ${item.scores?.slope}%`}>
                    <div className="mini-bar-track">
                      <div
                        className="mini-bar-fill"
                        style={{ height: `${item.scores?.slope || 50}%`, backgroundColor: "#a855f7" }}
                      />
                    </div>
                    <span>SLO</span>
                  </div>

                  <div className="mini-bar-col" title={`SAR: ${item.scores?.radar_roughness}%`}>
                    <div className="mini-bar-track">
                      <div
                        className="mini-bar-fill"
                        style={{ height: `${item.scores?.radar_roughness || 50}%`, backgroundColor: "#22d3ee" }}
                      />
                    </div>
                    <span>SAR</span>
                  </div>

                  <div className="mini-bar-col" title={`Thermal: ${item.scores?.thermal}%`}>
                    <div className="mini-bar-track">
                      <div
                        className="mini-bar-fill"
                        style={{ height: `${item.scores?.thermal || 50}%`, backgroundColor: "#f97316" }}
                      />
                    </div>
                    <span>THE</span>
                  </div>

                  <div className="mini-bar-col" title={`Geochem: ${item.scores?.geochemical}%`}>
                    <div className="mini-bar-track">
                      <div
                        className="mini-bar-fill"
                        style={{ height: `${item.scores?.geochemical || 50}%`, backgroundColor: "#10b981" }}
                      />
                    </div>
                    <span>GEO</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
