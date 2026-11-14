import { Printer, X, CheckCircle, AlertTriangle, Wrench } from "lucide-react";
import RadarChart from "./RadarChart";
import SensorLayerImage from "./SensorLayerImage";

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

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

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
    match: "High degree of morphologic and geotechnical terrain alignment.",
    breakdown: "Atmospheric pressure and terrestrial water cycle differences.",
    mitigation: "Environmental encapsulation and gravity compensation for tool trials.",
  };

  const sensorStats = diagnostics?.sensor_stats || {};

  return (
    <div className="dossier-modal-overlay" onClick={onClose}>
      <div className="dossier-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Controls Bar */}
        <div className="dossier-actions-bar">
          <div className="dossier-actions-left">
            <span className="dossier-pill-security">OFFICIAL SCIENTIFIC FLIGHT DOSSIER</span>
            <span className="dossier-code">
              TL-DOSSIER-{target?.id?.toUpperCase()}-{analog?.id?.toUpperCase()}
            </span>
          </div>

          <div className="dossier-actions-right">
            <button className="dossier-print-btn" onClick={handlePrint}>
              <Printer size={15} />
              PRINT / SAVE PDF
            </button>
            <button className="dossier-close-btn" onClick={onClose} title="Close (ESC)">
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
                Campaign Brief: {target?.name?.split("&")[0].trim()} Analog Validation
              </h1>
              <div className="header-submeta">
                <span>DEPLOYMENT CANDIDATE: <strong>{analog?.formal_name || analog?.name}</strong></span>
                <span>COORDINATES: <strong>{analog?.coordinates}</strong></span>
                <span>DATE STAMP: <strong>{dateStamp}</strong></span>
              </div>
            </div>

            {/* Dynamic SVG Mission Patch */}
            <div className="mission-patch-container">
              <svg width="110" height="110" viewBox="0 0 110 110" className="mission-patch-svg">
                <defs>
                  <linearGradient id="patch-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#042f2e" />
                  </linearGradient>
                  <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>

                {/* Outer Ring */}
                <circle cx="55" cy="55" r="51" fill="url(#patch-grad)" stroke="#76d8c0" strokeWidth="2.5" />
                <circle cx="55" cy="55" r="46" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" />

                {/* Orbital Trajectory */}
                <path
                  d="M 18,72 C 30,25 80,25 92,72"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Center Planetary Glyphs */}
                <circle cx="42" cy="46" r="10" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
                <circle cx="68" cy="54" r="14" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />

                {/* Stars */}
                <circle cx="30" cy="30" r="1.5" fill="#ffffff" />
                <circle cx="80" cy="32" r="1.2" fill="#ffffff" />
                <circle cx="55" cy="22" r="1.5" fill="#f59e0b" />
                <circle cx="75" cy="80" r="1.2" fill="#ffffff" />

                {/* Typography around bottom */}
                <text x="55" y="93" fill="#76d8c0" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                  TERRA-LENS EXPEDITION
                </text>
              </svg>
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
                  <span>SLOPE:</span> <strong>{weights.slope}%</strong>
                </div>
                <div className="weight-pill">
                  <span>SAR ROUGHNESS:</span> <strong>{weights.radar_roughness}%</strong>
                </div>
                <div className="weight-pill">
                  <span>THERMAL:</span> <strong>{weights.thermal}%</strong>
                </div>
                <div className="weight-pill">
                  <span>GEOCHEMICAL:</span> <strong>{weights.geochemical}%</strong>
                </div>
              </div>
              <p className="weights-desc">
                Analog suitability optimized for planetary surface traversability, volatile cryo-sampling, and regolith mechanical shear validation.
              </p>
            </div>
          </div>

          {/* Side-by-side 4-sensor strip */}
          <section className="dossier-sensor-strip-section">
            <h3 className="dossier-section-title">SIDE-BY-SIDE 4-SENSOR MULTI-SPECTRAL STRIP</h3>
            <div className="sensor-strip-grid">
              {["optical", "sar", "thermal", "slope"].map((sensorKey) => {
                const targetL = target?.layers?.[sensorKey];
                const analogL = analog?.layers?.[sensorKey];
                return (
                  <div key={sensorKey} className="sensor-strip-card">
                    <div className="sensor-strip-header">
                      <span className={`strip-sensor-badge ${sensorKey}`}>{sensorKey.toUpperCase()}</span>
                      <small>{targetL?.resolution} vs {analogL?.resolution}</small>
                    </div>

                    <div className="sensor-strip-previews">
                      <div className="strip-preview-pane">
                        <SensorLayerImage
                          src={targetL?.path}
                          layerType={sensorKey}
                          alt="Target Preview"
                          body={target?.body?.toLowerCase()}
                        />
                        <span className="strip-pane-tag">{target?.body}</span>
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
                      <small><strong>TGT:</strong> {targetL?.agency}</small>
                      <small><strong>EARTH:</strong> {analogL?.agency}</small>
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
                targetName={target?.name?.split("&")[0].trim() || "Target"}
                analogName={analog?.name || "Analog"}
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
                <strong>GEOLOGIC MATRIX:</strong> {analog?.geologic_context}
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
