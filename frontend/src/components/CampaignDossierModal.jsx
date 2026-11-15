import { useId, useMemo } from "react";
import {
  Printer,
  X,
  CheckCircle,
  AlertTriangle,
  Wrench,
  FileJson,
  FileText,
  Download,
  ShieldCheck,
  Clock,
  Box,
  Compass,
} from "lucide-react";
import RadarChart from "./RadarChart";
import SensorLayerImage from "./SensorLayerImage";
import "./CampaignDossierModal.css";

/**
 * Procedural helper to compute normalized weights
 */
function normalizeWeights(rawWeights) {
  const wSlope = Math.max(0, parseFloat(rawWeights?.slope) || 0);
  const wRadar = Math.max(0, parseFloat(rawWeights?.radar_roughness) || 0);
  const wThermal = Math.max(0, parseFloat(rawWeights?.thermal) || 0);
  const wGeochem = Math.max(0, parseFloat(rawWeights?.geochemical) || 0);
  const total = wSlope + wRadar + wThermal + wGeochem;

  if (total <= 1e-6) {
    return { slope: 0.25, radar_roughness: 0.25, thermal: 0.25, geochemical: 0.25 };
  }
  return {
    slope: Number((wSlope / total).toFixed(4)),
    radar_roughness: Number((wRadar / total).toFixed(4)),
    thermal: Number((wThermal / total).toFixed(4)),
    geochemical: Number((wGeochem / total).toFixed(4)),
  };
}

/**
 * Trigger browser file download helper
 */
function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CampaignDossierModal({
  isOpen,
  onClose,
  target,
  analog,
  diagnostics,
  weights,
  compositeScore = 80,
  dateStamp = "2026-11-15",
}) {
  const patchId = useId().replace(/:/g, "");

  // Safe fallback extractions
  const targetId = target?.id || "shackleton";
  const targetName = target?.name || "Shackleton Crater & Connecting Ridge";
  const targetBody = target?.body || "Moon";
  const targetCoords = target?.coordinates || "89.9°S, 0.0°E";

  const analogId = analog?.id || "tablelands";
  const analogName = analog?.name || "The Tablelands";
  const analogFormal = analog?.formal_name || analogName;
  const analogRegion = analog?.region || "Newfoundland, Canada";
  const analogCoords = analog?.coordinates || "49.46°N, 57.95°W";
  const analogGeology = analog?.geologic_context || "Ophiolitic ultramafic mantle peridotite and serpentinized harzburgite.";

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

  const tiers = diagnostics?.diagnostics || {
    match: "Morphologic and lithologic characteristics correlate across multi-spectral observation bands.",
    breakdown: "Atmospheric density, precipitation cycles, and terrestrial gravity limit direct environmental fidelity.",
    mitigation: "Compensate through environmental vacuum shrouds and counterbalanced drill downforce.",
  };

  const sensorStats = diagnostics?.sensor_stats || {
    optical: { mean: 0.15, max: 0.35, std_dev: 0.05, unit: "Albedo / Reflectance", agency_source: "Orbital Multi-Spectral" },
    sar: { mean: 1.2, max: 2.5, std_dev: 0.4, unit: "Backscatter CPR / dB", agency_source: "SAR Radar Profiler" },
    thermal: { mean: 220, max: 290, std_dev: 25, unit: "Kelvin (K)", agency_source: "Radiometric Radiometer" },
    slope: { mean: 15, max: 32, std_dev: 6, unit: "Degrees (°)", agency_source: "Laser / InSAR DEM" },
  };

  const safeWeights = useMemo(() => ({
    slope: weights?.slope ?? 25,
    radar_roughness: weights?.radar_roughness ?? 25,
    thermal: weights?.thermal ?? 25,
    geochemical: weights?.geochemical ?? 25,
  }), [weights?.slope, weights?.radar_roughness, weights?.thermal, weights?.geochemical]);

  const normWeights = useMemo(() => normalizeWeights(safeWeights), [safeWeights]);

  // Procedural Mission Serial Hash
  const serialHash = useMemo(() => {
    const tCode = targetId.slice(0, 3).toUpperCase();
    const aCode = analogId.slice(0, 3).toUpperCase();
    const scoreHex = Math.round(compositeScore).toString(16).toUpperCase();
    return `TL-${tCode}-${aCode}-${scoreHex}X8`;
  }, [targetId, analogId, compositeScore]);

  // Dynamic TRL & Simulation Protocol Specifications
  const trlData = useMemo(() => {
    const isMoon = targetBody.toLowerCase() === "moon";
    if (isMoon) {
      return {
        duration: "14-Day Lunar Day/Night Cycle Simulation",
        chamber: "Cryogenic Thermal-Vacuum Sim-Chamber (<40 K to 390 K, 10⁻⁶ Torr)",
        gravityCrane: "0.16G Gravity-Offload Suspension Rig (Rover Traversability)",
        citations: "NASA PDS LRO LROC/Mini-RF/Diviner/LOLA; CSA RADARSAT-2 / JAXA ALOS-2",
        targetTRL: "TRL 4 ➔ TRL 6 Planetary Surface Validation",
      };
    }
    return {
      duration: "21-Day Mars Sol Traverse & Sample Coring Campaign",
      chamber: "Mars Environmental Hypobaric Chamber (6–8 mbar CO₂, Dust Aeolian Wind)",
      gravityCrane: "0.38G Active Cable Counterbalance (Drill & Wheel Shear Validation)",
      citations: "NASA MRO HiRISE/SHARAD, Odyssey THEMIS; ESA Copernicus GLO-30 DEM",
      targetTRL: "TRL 4 ➔ TRL 6 Mars Sample Return Readiness",
    };
  }, [targetBody]);

  if (!isOpen) return null;

  // 1. Action: Print / Save PDF
  const handlePrint = () => {
    window.print();
  };

  // 2. Action: Export JSON Manifest
  const handleExportJSON = () => {
    const manifest = {
      $schema: "https://terra-lens.space/schemas/campaign-dossier-v2.json",
      document_id: `TL-DOSSIER-${targetId.toUpperCase()}-${analogId.toUpperCase()}`,
      mission_serial_hash: serialHash,
      generation_timestamp: new Date().toISOString(),
      date_stamp: dateStamp,
      organization: "TERRA-LENS EXPEDITION SYSTEMS · PLANETARY ANALOG DIVISION",
      security_classification: "OFFICIAL SCIENTIFIC FLIGHT CERTIFICATION // UNCLASSIFIED",
      target_profile: {
        id: targetId,
        name: targetName,
        body: targetBody,
        coordinates: targetCoords,
        layers: target?.layers || {},
      },
      analog_candidate: {
        id: analogId,
        name: analogName,
        formal_name: analogFormal,
        region: analogRegion,
        country: analog?.country || "",
        coordinates: analogCoords,
        geologic_context: analogGeology,
        layers: analog?.layers || {},
      },
      mission_weights: {
        raw: safeWeights,
        normalized: normWeights,
      },
      evaluation: {
        composite_fidelity_score: compositeScore,
        tier_rating: compositeScore >= 80 ? "TIER-1 PRIMARY FLIGHT ANALOG" : "TIER-2 SUPPLEMENTAL TEST ANALOG",
        category_scores: scores,
        radar_chart_vectors: radarVectors,
        sensor_quantitative_statistics: sensorStats,
      },
      scientific_diagnostics: {
        tier_1_high_fidelity_match: tiers.match,
        tier_2_where_analogy_breaks_down: tiers.breakdown,
        tier_3_engineering_mitigation: tiers.mitigation,
      },
      trl_field_certification_matrix: trlData,
      signoff: {
        principal_investigator: "Dr. H. Schmitt / Exploration Directorate",
        analog_operations_lead: "Certified for Field Deployment",
        quality_assurance: "Flight Readiness Review Approved",
      },
    };

    const jsonString = JSON.stringify(manifest, null, 2);
    downloadFile(jsonString, `terra-lens-dossier-${targetId}-${analogId}.json`, "application/json");
  };

  // 3. Action: Export Markdown Brief
  const handleExportMarkdown = () => {
    const markdownContent = `# TERRA-LENS Planetary Analog Campaign Brief
**Document Code:** \`TL-DOSSIER-${targetId.toUpperCase()}-${analogId.toUpperCase()}\`  
**Serial Hash:** \`${serialHash}\`  
**Export Date:** ${dateStamp}  
**Classification:** Official Scientific Flight Certification // Unclassified  

---

## 1. Executive Summary & Assessment
- **Planetary Target:** ${targetName} (${targetBody}, Coordinates: \`${targetCoords}\`)
- **Earth Analog Candidate:** ${analogFormal} (${analogRegion}, Coordinates: \`${analogCoords}\`)
- **Composite Fidelity Score:** **${compositeScore}%** (${compositeScore >= 80 ? "TIER-1 PRIMARY FLIGHT ANALOG" : "TIER-2 SUPPLEMENTAL TEST ANALOG"})

### Active Mission Priority Profile
| Criteria Axis | Raw Weight | Normalized Weight | Match Score |
| :--- | :---: | :---: | :---: |
| **Topographic Slope & DEM** | ${safeWeights.slope}% | ${(normWeights.slope * 100).toFixed(1)}% | ${scores.slope}% |
| **SAR Roughness & Blocks** | ${safeWeights.radar_roughness}% | ${(normWeights.radar_roughness * 100).toFixed(1)}% | ${scores.radar_roughness}% |
| **Thermal & Cryogenic Regime** | ${safeWeights.thermal}% | ${(normWeights.thermal * 100).toFixed(1)}% | ${scores.thermal}% |
| **Geochemical & Lithology** | ${safeWeights.geochemical}% | ${(normWeights.geochemical * 100).toFixed(1)}% | ${scores.geochemical}% |

---

## 2. Cross-Sensor Quantitative Metrics
| Sensor Layer | Target Agency | Earth Agency | Mean Value | Max Value | Std Dev | Physical Unit |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **OPTICAL** | ${target?.layers?.optical?.agency || "Orbital NAC"} | ${analog?.layers?.optical?.agency || "Sentinel-2"} | ${sensorStats.optical?.mean} | ${sensorStats.optical?.max} | ${sensorStats.optical?.std_dev} | ${sensorStats.optical?.unit} |
| **SAR RADAR** | ${target?.layers?.sar?.agency || "Mini-RF"} | ${analog?.layers?.sar?.agency || "RADARSAT-2"} | ${sensorStats.sar?.mean} | ${sensorStats.sar?.max} | ${sensorStats.sar?.std_dev} | ${sensorStats.sar?.unit} |
| **THERMAL** | ${target?.layers?.thermal?.agency || "Diviner"} | ${analog?.layers?.thermal?.agency || "ECOSTRESS"} | ${sensorStats.thermal?.mean} | ${sensorStats.thermal?.max} | ${sensorStats.thermal?.std_dev} | ${sensorStats.thermal?.unit} |
| **SLOPE / DEM** | ${target?.layers?.slope?.agency || "LOLA"} | ${analog?.layers?.slope?.agency || "GLO-30"} | ${sensorStats.slope?.mean} | ${sensorStats.slope?.max} | ${sensorStats.slope?.std_dev} | ${sensorStats.slope?.unit} |

*Geologic Context:* ${analogGeology}

---

## 3. 3-Tier Scientific Diagnostic Assessment

> [!NOTE]
> **TIER 1 — HIGH-FIDELITY MATCH**  
> ${tiers.match}

> [!WARNING]
> **TIER 2 — WHERE THE ANALOGY BREAKS DOWN**  
> ${tiers.breakdown}

> [!TIP]
> **TIER 3 — ENGINEERING MITIGATION PROTOCOL**  
> ${tiers.mitigation}

---

## 4. TRL Field Certification & Deployment Recommendations
- **Recommended Field Test Campaign:** ${trlData.duration}
- **Required Sim-Chambers for Tier-2 Mitigation:** ${trlData.chamber}
- **Gravity-Offload Protocols:** ${trlData.gravityCrane}
- **Primary Sensor Dataset Citations:** ${trlData.citations}
- **Target TRL Progression:** ${trlData.targetTRL}

---

## 5. Certification Sign-Off
- **Principal Investigator:** Dr. H. Schmitt / Exploration Directorate
- **Analog Operations Lead:** Certified for Campaign Validation
- **Quality Assurance Verification:** APPROVED FOR FLIGHT READINESS (Stamp: \`${serialHash}\`)

*Report generated automatically by TERRA-LENS Planetary Analog Discovery Workbench.*
`;

    downloadFile(markdownContent, `terra-lens-brief-${targetId}-${analogId}.md`, "text/markdown");
  };

  // 4. Action: Download Standalone SVG Mission Patch
  const handleDownloadSVG = () => {
    const svgElement = document.getElementById(`mission-patch-svg-${patchId}`);
    if (!svgElement) return;
    const svgXml = new XMLSerializer().serializeToString(svgElement);
    downloadFile(svgXml, `mission-patch-${targetId}-${analogId}.svg`, "image/svg+xml");
  };

  // Procedural SVG Terrain Glyphs based on active Target & Analog
  const renderBiomeTerrainGlyphs = () => {
    const isMoon = targetBody.toLowerCase() === "moon";

    return (
      <g className="patch-procedural-terrain">
        {/* Planetary Target Background Silhouette */}
        {isMoon ? (
          // Lunar Crater Rim & Ridge Profile
          <path
            d="M 22,68 Q 38,50 55,60 Q 72,48 90,66 L 90,82 L 22,82 Z"
            fill="rgba(56, 189, 248, 0.22)"
            stroke="#38bdf8"
            strokeWidth="1.2"
          />
        ) : (
          // Martian Jezero Delta Fan & Crater Wall
          <path
            d="M 22,66 C 36,54 50,68 64,52 C 78,64 85,58 90,68 L 90,82 L 22,82 Z"
            fill="rgba(249, 115, 22, 0.25)"
            stroke="#f97316"
            strokeWidth="1.2"
          />
        )}

        {/* Earth Analog Specific Biome Glyph */}
        {analogId === "tablelands" && (
          // Ultramafic mantle peridotite mountain ridge
          <path
            d="M 30,76 L 45,56 L 60,68 L 74,52 L 86,76 Z"
            fill="rgba(234, 179, 8, 0.3)"
            stroke="#eab308"
            strokeWidth="1.4"
          />
        )}

        {analogId === "harrat-khaybar" && (
          // Volcanic cone & circular lava tube collapse skylight
          <g>
            <path
              d="M 32,76 L 48,58 L 56,64 L 64,58 L 80,76 Z"
              fill="rgba(239, 68, 68, 0.25)"
              stroke="#ef4444"
              strokeWidth="1.4"
            />
            <ellipse cx="56" cy="62" rx="4" ry="2" fill="#090e17" stroke="#ef4444" strokeWidth="1" />
          </g>
        )}

        {analogId === "sredinny" && (
          // Kamchatka volcanic stratocone with snowy cinder crest
          <path
            d="M 28,76 L 56,48 L 84,76 Z"
            fill="rgba(168, 85, 247, 0.25)"
            stroke="#a855f7"
            strokeWidth="1.4"
          />
        )}

        {analogId === "tuktoyaktuk" && (
          // Arctic ice-cored pingo dome hill
          <path
            d="M 30,76 Q 56,46 82,76 Z"
            fill="rgba(34, 211, 238, 0.3)"
            stroke="#22d3ee"
            strokeWidth="1.4"
          />
        )}

        {analogId === "lut-desert" && (
          // Mega-yardang streamlined wind corridors
          <path
            d="M 26,76 L 42,60 L 52,76 L 68,60 L 78,76 Z"
            fill="rgba(245, 158, 11, 0.3)"
            stroke="#f59e0b"
            strokeWidth="1.4"
          />
        )}
      </g>
    );
  };

  return (
    <div className="dossier-modal-overlay" onClick={onClose}>
      <div className="dossier-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Controls Bar */}
        <div className="dossier-actions-bar">
          <div className="dossier-actions-left">
            <span className="dossier-pill-security">OFFICIAL SCIENTIFIC FLIGHT DOSSIER</span>
            <span className="dossier-code">
              TL-DOSSIER-{targetId.toUpperCase()}-{analogId.toUpperCase()}
            </span>
          </div>

          <div className="dossier-actions-right">
            <div className="dossier-btn-group">
              <button
                className="dossier-btn dossier-btn-primary"
                onClick={handlePrint}
                title="Print or Save PDF"
              >
                <Printer size={14} />
                PRINT / SAVE PDF
              </button>

              <button
                className="dossier-btn dossier-btn-secondary"
                onClick={handleExportJSON}
                title="Download JSON Manifest"
              >
                <FileJson size={14} />
                EXPORT JSON
              </button>

              <button
                className="dossier-btn dossier-btn-secondary"
                onClick={handleExportMarkdown}
                title="Download Markdown Field Brief"
              >
                <FileText size={14} />
                EXPORT MD
              </button>

              <button
                className="dossier-btn dossier-btn-accent"
                onClick={handleDownloadSVG}
                title="Download Dynamic SVG Mission Patch"
              >
                <Download size={14} />
                PATCH SVG
              </button>
            </div>

            <button
              className="dossier-close-btn"
              onClick={onClose}
              title="Close modal (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Dossier Document */}
        <div className="dossier-document" id="printable-dossier">
          {/* Document Header */}
          <header className="dossier-header">
            <div className="header-meta">
              <span className="org-title">TERRA-LENS EXPEDITION SYSTEMS · PLANETARY ANALOG DIVISION</span>
              <h1 className="dossier-main-title">
                Campaign Brief: {targetName.split("&")[0].trim()} Analog Validation
              </h1>
              <div className="header-submeta">
                <span>DEPLOYMENT CANDIDATE: <strong>{analogFormal}</strong></span>
                <span>COORDINATES: <strong>{analogCoords}</strong></span>
                <span>DATE STAMP: <strong>{dateStamp}</strong></span>
              </div>
            </div>

            {/* Dynamic Upgraded SVG Mission Patch */}
            <div className="mission-patch-wrapper">
              <div className="mission-patch-container">
                <svg
                  id={`mission-patch-svg-${patchId}`}
                  width="120"
                  height="120"
                  viewBox="0 0 110 110"
                  className="mission-patch-svg"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id={`patch-grad-${patchId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#08101a" />
                      <stop offset="100%" stopColor="#052723" />
                    </linearGradient>
                    <linearGradient id={`ring-grad-${patchId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#76d8c0" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>

                  {/* Outer Outer Solid Ring */}
                  <circle cx="55" cy="55" r="51" fill={`url(#patch-grad-${patchId})`} stroke={`url(#ring-grad-${patchId})`} strokeWidth="2.5" />
                  <circle cx="55" cy="55" r="46" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" />

                  {/* Orbital Ellipse Trajectory */}
                  <path
                    d="M 16,70 C 26,22 84,22 94,70"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Dynamic Procedural Terrain Glyphs */}
                  {renderBiomeTerrainGlyphs()}

                  {/* Celestial Disc Glyphs */}
                  <circle cx="36" cy="40" r="9" fill={targetBody.toLowerCase() === "moon" ? "#94a3b8" : "#f97316"} stroke="#090e17" strokeWidth="1.5" />
                  <circle cx="72" cy="46" r="12" fill="#10b981" stroke="#090e17" strokeWidth="1.5" />

                  {/* Constellation Star Markers */}
                  <circle cx="28" cy="26" r="1.3" fill="#ffffff" />
                  <circle cx="82" cy="28" r="1.2" fill="#ffffff" />
                  <circle cx="55" cy="18" r="1.6" fill="#f59e0b" />
                  <circle cx="78" cy="80" r="1.2" fill="#ffffff" />

                  {/* Typography across Bottom */}
                  <text
                    x="55"
                    y="95"
                    fill="#76d8c0"
                    fontSize="6.5"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                    letterSpacing="0.8px"
                  >
                    TERRA-LENS · {targetId.toUpperCase()}
                  </text>
                </svg>
              </div>
              <span className="mission-patch-hash">{serialHash}</span>
            </div>
          </header>

          {/* Primary Assessment Banner */}
          <div className="dossier-composite-banner">
            <div className="composite-badge-col">
              <span className="composite-label">COMPOSITE FIDELITY SCORE</span>
              <div className="composite-score-huge">{compositeScore}%</div>
              <span className="composite-rating">
                {compositeScore >= 80 ? "TIER-1 PRIMARY FLIGHT ANALOG" : "TIER-2 SUPPLEMENTAL TEST ANALOG"}
              </span>
            </div>

            <div className="composite-weights-col">
              <span className="weights-label">ACTIVE MISSION PRIORITY PROFILE</span>
              <div className="weights-bar-summary">
                <div className="weight-pill">
                  <span>SLOPE:</span> <strong>{safeWeights.slope}%</strong>
                </div>
                <div className="weight-pill">
                  <span>SAR ROUGHNESS:</span> <strong>{safeWeights.radar_roughness}%</strong>
                </div>
                <div className="weight-pill">
                  <span>THERMAL:</span> <strong>{safeWeights.thermal}%</strong>
                </div>
                <div className="weight-pill">
                  <span>GEOCHEMICAL:</span> <strong>{safeWeights.geochemical}%</strong>
                </div>
              </div>
              <p className="weights-desc">
                Analog suitability calibrated for planetary surface mobility, drill shear endurance, volatile cold-trapping, and lithologic process match.
              </p>
            </div>
          </div>

          {/* Side-by-side 4-sensor strip */}
          <section className="dossier-sensor-strip-section">
            <h3 className="dossier-section-title">
              <Compass size={14} /> SIDE-BY-SIDE 4-SENSOR MULTI-SPECTRAL STRIP
            </h3>
            <div className="sensor-strip-grid">
              {["optical", "sar", "thermal", "slope"].map((sensorKey) => {
                const targetL = target?.layers?.[sensorKey];
                const analogL = analog?.layers?.[sensorKey];
                return (
                  <div key={sensorKey} className="sensor-strip-card">
                    <div className="sensor-strip-header">
                      <span className={`strip-sensor-badge ${sensorKey}`}>{sensorKey.toUpperCase()}</span>
                      <small>{targetL?.resolution || "10 m/px"} vs {analogL?.resolution || "10 m/px"}</small>
                    </div>

                    <div className="sensor-strip-previews">
                      <div className="strip-preview-pane">
                        <SensorLayerImage
                          src={targetL?.path}
                          layerType={sensorKey}
                          alt="Target Preview"
                          body={targetBody.toLowerCase()}
                        />
                        <span className="strip-pane-tag">{targetBody.toUpperCase()}</span>
                      </div>

                      <div className="strip-preview-pane">
                        <SensorLayerImage
                          src={analogL?.path}
                          layerType={sensorKey}
                          alt="Analog Preview"
                          body="earth"
                        />
                        <span className="strip-pane-tag">EARTH</span>
                      </div>
                    </div>

                    <div className="sensor-strip-sources">
                      <small><strong>TGT:</strong> {targetL?.agency || "Orbital"}</small>
                      <small><strong>EARTH:</strong> {analogL?.agency || "Copernicus"}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Radar Chart & Sensor Statistics Grid */}
          <section className="dossier-grid-two-col">
            {/* Left: Overlapping SVG Radar Chart */}
            <div className="dossier-box">
              <h3 className="dossier-section-title">4-AXIS FIDELITY RADAR PROFILE</h3>
              <RadarChart
                targetScores={radarVectors.target}
                analogScores={radarVectors.analog}
                targetName={targetName.split("&")[0].trim() || "Target"}
                analogName={analogName || "Analog"}
                size={260}
              />
            </div>

            {/* Right: Sensor Numerical Statistics */}
            <div className="dossier-box">
              <h3 className="dossier-section-title">CROSS-SENSOR QUANTITATIVE METRICS</h3>
              <table className="dossier-stats-table">
                <thead>
                  <tr>
                    <th>SENSOR</th>
                    <th>MEAN</th>
                    <th>MAX</th>
                    <th>STD DEV</th>
                    <th>UNIT</th>
                  </tr>
                </thead>
                <tbody>
                  {["optical", "sar", "thermal", "slope"].map((key) => {
                    const st = sensorStats[key] || { mean: "--", max: "--", std_dev: "--", unit: "--" };
                    return (
                      <tr key={key}>
                        <td className="bold-cell">{key.toUpperCase()}</td>
                        <td>{st.mean}</td>
                        <td>{st.max}</td>
                        <td>{st.std_dev}</td>
                        <td className="unit-cell">{st.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="site-geology-note">
                <strong>GEOLOGIC MATRIX:</strong> {analogGeology}
              </div>
            </div>
          </section>

          {/* 3-Tier Scientific Diagnostic Assessment Table */}
          <section className="dossier-diagnostics-section">
            <h3 className="dossier-section-title">3-TIER SCIENTIFIC DIAGNOSTIC PROTOCOL</h3>
            <div className="dossier-tier-table">
              <div className="tier-row match-row">
                <div className="tier-col-label">
                  <CheckCircle size={15} color="#10b981" />
                  <span>HIGH-FIDELITY MATCH</span>
                </div>
                <div className="tier-col-body">{tiers.match}</div>
              </div>

              <div className="tier-row breakdown-row">
                <div className="tier-col-label">
                  <AlertTriangle size={15} color="#ef4444" />
                  <span>WHERE ANALOGY BREAKS DOWN</span>
                </div>
                <div className="tier-col-body">{tiers.breakdown}</div>
              </div>

              <div className="tier-row mitigation-row">
                <div className="tier-col-label">
                  <Wrench size={15} color="#38bdf8" />
                  <span>ENGINEERING MITIGATION</span>
                </div>
                <div className="tier-col-body">{tiers.mitigation}</div>
              </div>
            </div>
          </section>

          {/* Upgraded TRL Field Certification Matrix */}
          <section className="trl-matrix-section">
            <h3 className="dossier-section-title">
              <ShieldCheck size={15} /> TRL FIELD CERTIFICATION & DEPLOYMENT PROTOCOL
            </h3>
            <div className="trl-grid">
              <div className="trl-card">
                <div className="trl-card-header">
                  <Clock size={13} />
                  <span>TEST DURATION</span>
                </div>
                <div className="trl-card-val">{trlData.duration.split(" ")[0]}</div>
                <p className="trl-card-desc">{trlData.duration}</p>
              </div>

              <div className="trl-card">
                <div className="trl-card-header">
                  <Box size={13} />
                  <span>TIER-2 SIMULATION</span>
                </div>
                <div className="trl-card-val">Sim-Chamber</div>
                <p className="trl-card-desc">{trlData.chamber}</p>
              </div>

              <div className="trl-card">
                <div className="trl-card-header">
                  <Wrench size={13} />
                  <span>GRAVITY OFFLOAD</span>
                </div>
                <div className="trl-card-val">Active Rig</div>
                <p className="trl-card-desc">{trlData.gravityCrane}</p>
              </div>

              <div className="trl-card">
                <div className="trl-card-header">
                  <ShieldCheck size={13} />
                  <span>READINESS GATE</span>
                </div>
                <div className="trl-card-val">TRL 4 ➔ TRL 6</div>
                <p className="trl-card-desc">{trlData.targetTRL}</p>
              </div>
            </div>
          </section>

          {/* Signoff / Certification Block */}
          <footer className="dossier-signoff">
            <div className="signoff-box">
              <span className="signoff-role">PRINCIPAL INVESTIGATOR</span>
              <div className="signoff-line">Dr. H. Schmitt / Exploration Directorate</div>
            </div>
            <div className="signoff-box">
              <span className="signoff-role">ANALOG FIELD OPERATIONS LEAD</span>
              <div className="signoff-line">CERTIFIED FOR CAMPAIGN VALIDATION</div>
            </div>
            <div className="signoff-box">
              <span className="signoff-role">QUALITY ASSURANCE VERIFICATION</span>
              <div className="signoff-stamp">APPROVED FOR FLIGHT READINESS</div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
