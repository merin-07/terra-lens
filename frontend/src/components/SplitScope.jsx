import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { TransformWrapper, TransformComponent } from "./ZoomPanPinch";
import {
  Layers3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Grid,
  ChevronDown,
  ChevronUp,
  Activity,
  Sliders,
  Sparkles,
} from "lucide-react";
import SensorLayerImage from "./SensorLayerImage";
import {
  samplePixelTelemetry,
  calculatePatchCorrelation,
  computeDifferentialBadge,
  preloadCanvasImage,
  subscribeCanvasLoad,
} from "../utils/pixelTelemetry";
import "./SplitScopeTelemetry.css";

const SENSOR_VISORS = [
  { id: "optical", label: "Optical" },
  { id: "sar", label: "SAR Radar" },
  { id: "thermal", label: "Thermal" },
  { id: "slope", label: "Topography / Slope" },
];

const LOUPE_RADII = [90, 140, 200];

/**
 * 8-Bin SVG Sparkline Mini-Histogram
 */
function SparklineHistogram({ histogram, color = "#22d3ee", label = "Target" }) {
  const safeHist =
    Array.isArray(histogram) && histogram.length === 8
      ? histogram
      : [0.08, 0.15, 0.22, 0.28, 0.14, 0.08, 0.03, 0.02];
  const maxVal = Math.max(0.01, ...safeHist);
  const barWidth = 11;
  const gap = 3;
  const svgHeight = 36;
  const svgWidth = 8 * barWidth + 7 * gap; // 109px
  const gradId = `spark-grad-${label.toLowerCase().replace(/[^a-z0-9]/g, "")}-${color.replace("#", "")}`;

  return (
    <div className="sparkline-svg-wrap">
      <svg
        className="sparkline-svg"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {safeHist.map((val, idx) => {
          const barHeight = Math.max(3, (val / maxVal) * (svgHeight - 4));
          const x = idx * (barWidth + gap);
          const y = svgHeight - barHeight;
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              fill={`url(#${gradId})`}
              stroke={color}
              strokeWidth={0.5}
            >
              <title>{`Bin ${idx + 1} (${(idx * 0.125).toFixed(2)}–${((idx + 1) * 0.125).toFixed(2)}): ${(val * 100).toFixed(1)}%`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Classifies micro-roughness sigma into planetary geomorphic units
 */
function classifyMicroRoughness(sigma) {
  const s = Number(sigma) || 0;
  if (s < 0.03) return "Planar Bedrock / Smooth Regolith";
  if (s < 0.065) return "Undulating Hummocky Terrain";
  if (s < 0.12) return "Fractured Scree / Blocky Talus";
  return "Rugged Scarp / Impact Ejecta";
}

export default function SplitScope({
  target,
  analog,
  activeSensor = "optical",
  onSensorChange,
  diagnostics,
}) {
  const [loupeActive, setLoupeActive] = useState(false);
  const [chosenLoupeSensor, setChosenLoupeSensor] = useState("sar");
  const [loupeRadius, setLoupeRadius] = useState(140); // 90px / 140px / 200px
  const [showTacticalGrid, setShowTacticalGrid] = useState(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);

  // Cursor tracking { pctX, pctY, pxX, pxY, width, height }
  const [cursorPos, setCursorPos] = useState(null);

  // Persistent last sampled coordinates so HUD never collapses to blank when mouse leaves
  const [lastSampledPos, setLastSampledPos] = useState({
    pctX: 50.0,
    pctY: 50.0,
    pxX: 200,
    pxY: 145,
    width: 400,
    height: 290,
  });

  // Revision counter to re-render when offscreen canvas finishes rasterizing asynchronously
  const [, setCanvasRevision] = useState(0);

  const leftTransformRef = useRef(null);
  const rightTransformRef = useRef(null);
  const isSyncingRef = useRef(false);

  const leftContainerRef = useRef(null);
  const rightContainerRef = useRef(null);

  const targetLayer = target?.layers?.[activeSensor];
  const analogLayer = analog?.layers?.[activeSensor];

  // Compute effective loupe sensor without synchronous effect setState
  const effectiveLoupeSensor =
    chosenLoupeSensor === activeSensor
      ? SENSOR_VISORS.find((v) => v.id !== activeSensor)?.id || "sar"
      : chosenLoupeSensor;

  const targetLoupeLayer = target?.layers?.[effectiveLoupeSensor];
  const analogLoupeLayer = analog?.layers?.[effectiveLoupeSensor];

  // Prime offscreen canvas caches whenever active layers change
  useEffect(() => {
    const urls = [
      targetLayer?.path,
      analogLayer?.path,
      targetLoupeLayer?.path,
      analogLoupeLayer?.path,
    ].filter(Boolean);

    urls.forEach((url) => preloadCanvasImage(url));

    const unsubscribers = urls.map((url) =>
      subscribeCanvasLoad(url, () => {
        setCanvasRevision((r) => r + 1);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub && unsub());
    };
  }, [
    targetLayer?.path,
    analogLayer?.path,
    targetLoupeLayer?.path,
    analogLoupeLayer?.path,
  ]);

  // Synchronize transforms between left and right viewports
  const syncTransform = useCallback((source, state) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    const targetRef = source === "left" ? rightTransformRef.current : leftTransformRef.current;
    if (targetRef && targetRef.setTransform) {
      targetRef.setTransform(state.positionX, state.positionY, state.scale, 0);
    }

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 15);
  }, []);

  const handleResetZoom = () => {
    if (leftTransformRef.current) leftTransformRef.current.resetTransform(200);
    if (rightTransformRef.current) rightTransformRef.current.resetTransform(200);
  };

  const handleZoomIn = () => {
    if (leftTransformRef.current) leftTransformRef.current.zoomIn(0.35, 150);
  };

  const handleZoomOut = () => {
    if (leftTransformRef.current) leftTransformRef.current.zoomOut(0.35, 150);
  };

  // Track mouse coordinates across either viewport
  const handleMouseMove = (e, panel) => {
    const container = panel === "left" ? leftContainerRef.current : rightContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const newPos = {
      pctX: Math.max(0, Math.min(100, relX * 100)),
      pctY: Math.max(0, Math.min(100, relY * 100)),
      pxX: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      pxY: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      width: rect.width,
      height: rect.height,
    };

    setCursorPos(newPos);
    setLastSampledPos(newPos);
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
  };

  // Current normalized sampling coordinates
  const activeCoord = cursorPos || lastSampledPos;
  const normX = activeCoord.pctX / 100;
  const normY = activeCoord.pctY / 100;

  // Real-Pixel Telemetry Sampling: Target & Earth Analog (Primary Visor)
  const targetTelemetry = useMemo(() => {
    return samplePixelTelemetry(
      targetLayer?.path,
      normX,
      normY,
      activeSensor,
      "target",
      target?.body || "Moon"
    );
  }, [targetLayer?.path, normX, normY, activeSensor, target?.body]);

  const analogTelemetry = useMemo(() => {
    return samplePixelTelemetry(
      analogLayer?.path,
      normX,
      normY,
      activeSensor,
      "analog",
      "Earth"
    );
  }, [analogLayer?.path, normX, normY, activeSensor]);

  // Secondary Visor Sampling for X-Ray Loupe when active
  const targetLoupeTelemetry = useMemo(() => {
    if (!loupeActive) return null;
    return samplePixelTelemetry(
      targetLoupeLayer?.path,
      normX,
      normY,
      effectiveLoupeSensor,
      "target",
      target?.body || "Moon"
    );
  }, [loupeActive, targetLoupeLayer?.path, normX, normY, effectiveLoupeSensor, target?.body]);

  const analogLoupeTelemetry = useMemo(() => {
    if (!loupeActive) return null;
    return samplePixelTelemetry(
      analogLoupeLayer?.path,
      normX,
      normY,
      effectiveLoupeSensor,
      "analog",
      "Earth"
    );
  }, [loupeActive, analogLoupeLayer?.path, normX, normY, effectiveLoupeSensor]);

  // Instantaneous Target-vs-Analog Delta Differential Badge
  const differentialBadge = useMemo(() => {
    return computeDifferentialBadge(targetTelemetry, analogTelemetry, activeSensor);
  }, [targetTelemetry, analogTelemetry, activeSensor]);

  // Real-time Local 9x9 Patch Correlation
  const patchCorrelation = useMemo(() => {
    return calculatePatchCorrelation(
      targetTelemetry.patchLuminances,
      analogTelemetry.patchLuminances
    );
  }, [targetTelemetry.patchLuminances, analogTelemetry.patchLuminances]);

  // Agency Pairing Banner string
  const getAgencyBanner = () => {
    const isMoon = target?.body === "Moon";
    if (activeSensor === "optical") {
      return isMoon
        ? "NASA LROC NAC (Moon) ⟷ ESA Sentinel-2 MSI (Earth)"
        : "NASA MRO HiRISE (Mars) ⟷ ESA Sentinel-2 MSI (Earth)";
    }
    if (activeSensor === "sar") {
      return isMoon
        ? "NASA LRO Mini-RF (Moon) ⟷ CSA RADARSAT-2 / JAXA ALOS-2 (Earth)"
        : "ASI / NASA SHARAD (Mars) ⟷ CSA RADARSAT-2 / JAXA ALOS-2 (Earth)";
    }
    if (activeSensor === "thermal") {
      return isMoon
        ? "NASA LRO Diviner (Moon) ⟷ NASA ECOSTRESS / MODIS (Earth)"
        : "NASA Mars Odyssey THEMIS (Mars) ⟷ NASA ECOSTRESS / MODIS (Earth)";
    }
    return isMoon
      ? "NASA LRO LOLA DEM (Moon) ⟷ ESA Copernicus GLO-30 DEM (Earth)"
      : "ESA / NASA MOLA-HRSC (Mars) ⟷ ESA Copernicus GLO-30 DEM (Earth)";
  };

  const isRealPixelActive = targetTelemetry.isRealPixel && analogTelemetry.isRealPixel;

  return (
    <div className="comparison-content">
      {/* Sensor Visor Toolbar */}
      <div className="sensor-toolbar">
        <div className="sensor-toolbar-top">
          <div className="sensor-heading">
            <Layers3 size={18} />
            <span>SENSOR VISOR</span>
          </div>

          <div className="scope-utility-buttons">
            <button
              className={`loupe-toggle-pill ${loupeActive ? "active" : ""}`}
              onClick={() => setLoupeActive(!loupeActive)}
              title="Toggle circular X-Ray magnifying lens"
            >
              <Crosshair size={14} />
              <span>X-RAY LOUPE [{loupeActive ? "ON" : "OFF"}]</span>
            </button>

            {loupeActive && (
              <div className="loupe-select-wrap">
                <span>REVEALS:</span>
                <select
                  value={effectiveLoupeSensor}
                  onChange={(e) => setChosenLoupeSensor(e.target.value)}
                  className="loupe-select-input"
                >
                  {SENSOR_VISORS.filter((v) => v.id !== activeSensor).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="zoom-btn-group">
              <button onClick={handleZoomIn} title="Zoom In" className="scope-icon-btn">
                <ZoomIn size={14} />
              </button>
              <button onClick={handleZoomOut} title="Zoom Out" className="scope-icon-btn">
                <ZoomOut size={14} />
              </button>
              <button onClick={handleResetZoom} title="Reset View" className="scope-icon-btn">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="sensor-buttons">
          {SENSOR_VISORS.map((visor) => (
            <button
              key={visor.id}
              className={activeSensor === visor.id ? "sensor-button active" : "sensor-button"}
              onClick={() => onSensorChange(visor.id)}
            >
              {visor.label}
            </button>
          ))}
        </div>

        <div className="active-pairing-box">
          <span>ACTIVE PAIRING:</span>
          <strong>{getAgencyBanner()}</strong>
        </div>
      </div>

      {/* Layer Info Cards */}
      <div className="layer-info">
        <div>
          <span>PLANETARY DATA SOURCE</span>
          <strong>{targetLayer?.agency || targetLayer?.name || "NASA LROC"}</strong>
        </div>

        <div>
          <span>EARTH DATA SOURCE</span>
          <strong>{analogLayer?.agency || analogLayer?.name || "ESA Sentinel-2"}</strong>
        </div>

        <div>
          <span>LAYER STATUS & SCALE</span>
          <strong className="scale-locked-text">
            ● 10 km × 10 km SCALE LOCKED
          </strong>
        </div>
      </div>

      {/* Dual Synchronized Map Grid */}
      <div className="map-grid">
        {/* Left Map Panel: Planetary Target */}
        <div className="map-panel">
          <div className="map-label">
            <div className="map-label-header">
              <span>PLANETARY TARGET</span>
              <small>{target?.coordinates}</small>
            </div>
            <strong>{target?.name}</strong>
          </div>

          <div
            className="viewport-container"
            ref={leftContainerRef}
            onMouseMove={(e) => handleMouseMove(e, "left")}
            onMouseLeave={handleMouseLeave}
          >
            <TransformWrapper
              ref={leftTransformRef}
              initialScale={1}
              minScale={0.8}
              maxScale={8}
              onTransformed={(ref, state) => syncTransform("left", state)}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "290px", overflow: "hidden", borderRadius: "6px" }}
                contentStyle={{ width: "100%", height: "290px" }}
              >
                <SensorLayerImage
                  src={targetLayer?.path}
                  layerType={activeSensor}
                  alt={`${target?.name} - ${activeSensor}`}
                  body={target?.body?.toLowerCase()}
                  resolution={targetLayer?.resolution}
                />
              </TransformComponent>
            </TransformWrapper>

            {/* High-Contrast Tactical Grid Overlay */}
            {showTacticalGrid && (
              <div className="tactical-grid-overlay">
                <div className="tactical-grid-axis-x" />
                <div className="tactical-grid-axis-y" />
                <div className="tactical-grid-quadrant nw">TGT-NW</div>
                <div className="tactical-grid-quadrant ne">TGT-NE</div>
                <div className="tactical-grid-quadrant sw">TGT-SW</div>
                <div className="tactical-grid-quadrant se">TGT-SE</div>
                <div className="tactical-grid-ticks">
                  <span>LAT: {target?.coordinates || "0.0°"}</span>
                  <span>10×10 km QUAD</span>
                </div>
              </div>
            )}

            {/* X-Ray Loupe Overlay (Target) */}
            {loupeActive && cursorPos && (
              <div
                className="xray-loupe-circle"
                style={{
                  left: `${cursorPos.pxX}px`,
                  top: `${cursorPos.pxY}px`,
                  width: `${loupeRadius * 2}px`,
                  height: `${loupeRadius * 2}px`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="loupe-content-clipper"
                  style={{
                    clipPath: `circle(${loupeRadius}px at 50% 50%)`,
                  }}
                >
                  <div
                    className="loupe-inner-image"
                    style={{
                      width: `${cursorPos.width}px`,
                      height: `${cursorPos.height}px`,
                      transform: `translate(-${cursorPos.pxX - loupeRadius}px, -${cursorPos.pxY - loupeRadius}px)`,
                    }}
                  >
                    <SensorLayerImage
                      src={targetLoupeLayer?.path}
                      layerType={effectiveLoupeSensor}
                      alt={`${target?.name} - Loupe`}
                      body={target?.body?.toLowerCase()}
                      resolution={targetLoupeLayer?.resolution}
                    />
                  </div>
                </div>
                <div className="loupe-ring" />
                <div className="loupe-reticle-cross" />
                <div className="loupe-tag">
                  {effectiveLoupeSensor.toUpperCase()} X-RAY
                </div>
                {targetLoupeTelemetry && (
                  <div className="loupe-telemetry-badge">
                    {targetLoupeTelemetry.physicalValue?.shortFormatted}
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Crosshair Marker with Real-Pixel Telemetry */}
            {cursorPos && !loupeActive && (
              <div
                className="reticle-marker"
                style={{
                  left: `${cursorPos.pctX}%`,
                  top: `${cursorPos.pctY}%`,
                }}
              >
                <div className="crosshair-v" />
                <div className="crosshair-h" />
                <div className="reticle-box" />
                <div className="reticle-telemetry-enhanced">
                  <div className="reticle-row-primary">
                    <span
                      className="pixel-color-dot"
                      style={{ backgroundColor: targetTelemetry.rgbString }}
                      title={`Sampled RGB: ${targetTelemetry.rgbString}`}
                    />
                    <span className="reticle-sensor-val">
                      {targetTelemetry.physicalValue.formatted}
                    </span>
                  </div>
                  <div className="reticle-row-secondary">
                    <span>L: {targetTelemetry.luminance}</span>
                    <span className={`reticle-diff-tag ${differentialBadge.statusClass}`}>
                      {differentialBadge.status} ({differentialBadge.matchPercent}%)
                    </span>
                    <span className="sampling-type-indicator">
                      {targetTelemetry.isRealPixel ? "● REAL" : "○ SIM"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Map Panel: Earth Analog */}
        <div className="map-panel">
          <div className="map-label">
            <div className="map-label-header">
              <span>EARTH ANALOG</span>
              <small>{analog?.coordinates}</small>
            </div>
            <strong>{analog?.name} ({analog?.region || analog?.country})</strong>
          </div>

          <div
            className="viewport-container"
            ref={rightContainerRef}
            onMouseMove={(e) => handleMouseMove(e, "right")}
            onMouseLeave={handleMouseLeave}
          >
            <TransformWrapper
              ref={rightTransformRef}
              initialScale={1}
              minScale={0.8}
              maxScale={8}
              onTransformed={(ref, state) => syncTransform("right", state)}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "290px", overflow: "hidden", borderRadius: "6px" }}
                contentStyle={{ width: "100%", height: "290px" }}
              >
                <SensorLayerImage
                  src={analogLayer?.path}
                  layerType={activeSensor}
                  alt={`${analog?.name} - ${activeSensor}`}
                  body="earth"
                  resolution={analogLayer?.resolution}
                />
              </TransformComponent>
            </TransformWrapper>

            {/* High-Contrast Tactical Grid Overlay */}
            {showTacticalGrid && (
              <div className="tactical-grid-overlay">
                <div className="tactical-grid-axis-x" />
                <div className="tactical-grid-axis-y" />
                <div className="tactical-grid-quadrant nw">ANA-NW</div>
                <div className="tactical-grid-quadrant ne">ANA-NE</div>
                <div className="tactical-grid-quadrant sw">ANA-SW</div>
                <div className="tactical-grid-quadrant se">ANA-SE</div>
                <div className="tactical-grid-ticks">
                  <span>LAT: {analog?.coordinates || "0.0°"}</span>
                  <span>10×10 km QUAD</span>
                </div>
              </div>
            )}

            {/* X-Ray Loupe Overlay (Analog) */}
            {loupeActive && cursorPos && (
              <div
                className="xray-loupe-circle"
                style={{
                  left: `${cursorPos.pxX}px`,
                  top: `${cursorPos.pxY}px`,
                  width: `${loupeRadius * 2}px`,
                  height: `${loupeRadius * 2}px`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="loupe-content-clipper"
                  style={{
                    clipPath: `circle(${loupeRadius}px at 50% 50%)`,
                  }}
                >
                  <div
                    className="loupe-inner-image"
                    style={{
                      width: `${cursorPos.width}px`,
                      height: `${cursorPos.height}px`,
                      transform: `translate(-${cursorPos.pxX - loupeRadius}px, -${cursorPos.pxY - loupeRadius}px)`,
                    }}
                  >
                    <SensorLayerImage
                      src={analogLoupeLayer?.path}
                      layerType={effectiveLoupeSensor}
                      alt={`${analog?.name} - Loupe`}
                      body="earth"
                      resolution={analogLoupeLayer?.resolution}
                    />
                  </div>
                </div>
                <div className="loupe-ring" />
                <div className="loupe-reticle-cross" />
                <div className="loupe-tag">
                  {effectiveLoupeSensor.toUpperCase()} X-RAY
                </div>
                {analogLoupeTelemetry && (
                  <div className="loupe-telemetry-badge">
                    {analogLoupeTelemetry.physicalValue?.shortFormatted}
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Crosshair Marker with Real-Pixel Telemetry */}
            {cursorPos && !loupeActive && (
              <div
                className="reticle-marker"
                style={{
                  left: `${cursorPos.pctX}%`,
                  top: `${cursorPos.pctY}%`,
                }}
              >
                <div className="crosshair-v" />
                <div className="crosshair-h" />
                <div className="reticle-box" />
                <div className="reticle-telemetry-enhanced">
                  <div className="reticle-row-primary">
                    <span
                      className="pixel-color-dot"
                      style={{ backgroundColor: analogTelemetry.rgbString }}
                      title={`Sampled RGB: ${analogTelemetry.rgbString}`}
                    />
                    <span className="reticle-sensor-val">
                      {analogTelemetry.physicalValue.formatted}
                    </span>
                  </div>
                  <div className="reticle-row-secondary">
                    <span>L: {analogTelemetry.luminance}</span>
                    <span className={`reticle-diff-tag ${differentialBadge.statusClass}`}>
                      {differentialBadge.deltaPhysical}
                    </span>
                    <span className="sampling-type-indicator">
                      {analogTelemetry.isRealPixel ? "● REAL" : "○ SIM"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          Interactive Local Patch Histogram & Live Spectral Inspector HUD Bar
          ==================================================================== */}
      <div className={`telemetry-hud-wrapper ${isHudCollapsed ? "collapsed" : ""}`}>
        {/* HUD Top Control Ribbon */}
        <div className="telemetry-hud-header">
          <div className="telemetry-hud-title-group">
            <div className="telemetry-hud-icon-wrap">
              <Activity size={16} />
            </div>
            <div className="telemetry-hud-heading">
              <span>REAL-PIXEL CANAVAS TELEMETRY & SPECTRAL INSPECTOR</span>
              <strong>
                9×9 Neighborhood Transect · {activeSensor.toUpperCase()}
              </strong>
            </div>
          </div>

          {/* Instantaneous Target-vs-Analog Delta Differential Badge */}
          <div className="telemetry-header-delta">
            <div className="delta-fidelity-score">
              <span
                className="delta-num"
                style={{
                  color:
                    differentialBadge.matchPercent >= 75
                      ? "#34d399"
                      : differentialBadge.matchPercent >= 45
                      ? "#fbbf24"
                      : "#fb7185",
                }}
              >
                {differentialBadge.matchPercent}%
              </span>
              <span className="delta-label">FIDELITY MATCH</span>
            </div>
            <span className={`delta-status-pill ${differentialBadge.statusClass}`}>
              {differentialBadge.status}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                color: "#e2edf5",
                fontWeight: 700,
              }}
            >
              {differentialBadge.deltaPhysical}
            </span>
          </div>

          {/* Utility Controls: Loupe Radius, Tactical Grid, & Collapse */}
          <div className="telemetry-header-actions">
            {/* Loupe Radius Selector */}
            <div className="loupe-radius-selector" title="Switch X-Ray Loupe Radius">
              <span className="loupe-radius-label">LOUPE:</span>
              {LOUPE_RADII.map((radius) => (
                <button
                  key={radius}
                  className={`loupe-radius-btn ${loupeRadius === radius ? "active" : ""}`}
                  onClick={() => setLoupeRadius(radius)}
                >
                  {radius}px
                </button>
              ))}
            </div>

            {/* Tactical Grid Toggle */}
            <button
              className={`hud-control-btn ${showTacticalGrid ? "active" : ""}`}
              onClick={() => setShowTacticalGrid(!showTacticalGrid)}
              title="Toggle high-contrast coordinate grid overlay"
            >
              <Grid size={13} />
              <span>GRID [{showTacticalGrid ? "ON" : "OFF"}]</span>
            </button>

            {/* Collapse / Expand Toggle */}
            <button
              className="hud-collapse-btn"
              onClick={() => setIsHudCollapsed(!isHudCollapsed)}
              title={isHudCollapsed ? "Expand Telemetry Inspector" : "Collapse Telemetry Inspector"}
            >
              {isHudCollapsed ? (
                <>
                  <span>EXPAND</span>
                  <ChevronDown size={14} />
                </>
              ) : (
                <>
                  <span>COLLAPSE</span>
                  <ChevronUp size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible HUD Body */}
        {!isHudCollapsed && (
          <>
            <div className="telemetry-hud-body">
              {/* Card 1: Target Spectral Patch (9×9 Kernel) */}
              <div className="spectral-panel-card target-card">
                <div className="spectral-card-header">
                  <span>PLANETARY TARGET PATCH</span>
                  <strong>{target?.body} · {target?.name?.split(" ")[0]}</strong>
                </div>

                <div className="spectral-pixel-meta">
                  <div className="pixel-color-chip">
                    <div
                      className="pixel-preview-box"
                      style={{ backgroundColor: targetTelemetry.rgbString }}
                    />
                    <div className="pixel-rgb-text">
                      <strong>{targetTelemetry.hexColor.toUpperCase()}</strong>
                      <small>Luminance: {targetTelemetry.luminance}</small>
                    </div>
                  </div>

                  <div className="pixel-primary-readout">
                    <span>{targetTelemetry.physicalValue.label.toUpperCase()}</span>
                    <strong>{targetTelemetry.physicalValue.shortFormatted}</strong>
                  </div>
                </div>

                {/* 8-Bin Mini-Histogram Sparkline */}
                <div className="histogram-section">
                  <div className="histogram-header">
                    <span>9×9 LOCAL HISTOGRAM (8-BIN)</span>
                    <small>σ (Roughness): {targetTelemetry.stdDev}</small>
                  </div>
                  <SparklineHistogram
                    histogram={targetTelemetry.histogram}
                    color="#22d3ee"
                    label="Target"
                  />
                  <div className="histogram-axis-labels">
                    <span>0.0 L (DARK)</span>
                    <span>0.50</span>
                    <span>1.0 L (BRIGHT)</span>
                  </div>
                </div>

                {/* Secondary X-Ray Loupe Telemetry when Loupe Active */}
                {loupeActive && targetLoupeTelemetry && (
                  <div className="loupe-active-readout">
                    <span>X-RAY [{effectiveLoupeSensor.toUpperCase()}]:</span>
                    <strong>{targetLoupeTelemetry.physicalValue.formatted}</strong>
                  </div>
                )}
              </div>

              {/* Card 2: Center Correlation & Transect Analyzer */}
              <div className="correlation-analyzer-card">
                <div className="correlation-gauge-box">
                  <span>LOCAL 9×9 KERNEL CORRELATION</span>
                  <div
                    className={`correlation-score-val ${differentialBadge.statusClass}`}
                  >
                    {patchCorrelation.correlationPercent}%
                  </div>
                  <div className="correlation-progress-track">
                    <div
                      className={`correlation-progress-fill ${differentialBadge.statusClass}`}
                      style={{ width: `${patchCorrelation.correlationPercent}%` }}
                    />
                  </div>
                </div>

                <div className="metrics-keyvalue-stack">
                  <div className="metric-kv-row">
                    <span>Pearson Correlation (r):</span>
                    <strong>{patchCorrelation.pearsonR >= 0 ? "+" : ""}{patchCorrelation.pearsonR}</strong>
                  </div>
                  <div className="metric-kv-row">
                    <span>Luminance Differential (ΔL):</span>
                    <strong>{differentialBadge.deltaLuminance}</strong>
                  </div>
                  <div className="metric-kv-row">
                    <span>Micro-Roughness |Δσ|:</span>
                    <strong>
                      {Math.abs(targetTelemetry.stdDev - analogTelemetry.stdDev).toFixed(4)}
                    </strong>
                  </div>
                </div>

                <div className="terrain-class-tag" title="Local geomorphologic classification">
                  CLASSIFICATION: {classifyMicroRoughness(targetTelemetry.stdDev)}
                </div>
              </div>

              {/* Card 3: Earth Analog Spectral Patch (9×9 Kernel) */}
              <div className="spectral-panel-card analog-card">
                <div className="spectral-card-header">
                  <span>EARTH ANALOG PATCH</span>
                  <strong>{analog?.name}</strong>
                </div>

                <div className="spectral-pixel-meta">
                  <div className="pixel-color-chip">
                    <div
                      className="pixel-preview-box"
                      style={{ backgroundColor: analogTelemetry.rgbString }}
                    />
                    <div className="pixel-rgb-text">
                      <strong>{analogTelemetry.hexColor.toUpperCase()}</strong>
                      <small>Luminance: {analogTelemetry.luminance}</small>
                    </div>
                  </div>

                  <div className="pixel-primary-readout">
                    <span>{analogTelemetry.physicalValue.label.toUpperCase()}</span>
                    <strong>{analogTelemetry.physicalValue.shortFormatted}</strong>
                  </div>
                </div>

                {/* 8-Bin Mini-Histogram Sparkline */}
                <div className="histogram-section">
                  <div className="histogram-header">
                    <span>9×9 LOCAL HISTOGRAM (8-BIN)</span>
                    <small>σ (Roughness): {analogTelemetry.stdDev}</small>
                  </div>
                  <SparklineHistogram
                    histogram={analogTelemetry.histogram}
                    color="#10b981"
                    label="Analog"
                  />
                  <div className="histogram-axis-labels">
                    <span>0.0 L (DARK)</span>
                    <span>0.50</span>
                    <span>1.0 L (BRIGHT)</span>
                  </div>
                </div>

                {/* Secondary X-Ray Loupe Telemetry when Loupe Active */}
                {loupeActive && analogLoupeTelemetry && (
                  <div className="loupe-active-readout">
                    <span>X-RAY [{effectiveLoupeSensor.toUpperCase()}]:</span>
                    <strong>{analogLoupeTelemetry.physicalValue.formatted}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Status Banner */}
            <div className="transect-status-banner">
              <span className="transect-coords">
                KERNEL SAMPLER: 9×9 PIXELS (81 SAMPLES) · CURSOR: {activeCoord.pctX.toFixed(1)}% X, {activeCoord.pctY.toFixed(1)}% Y
              </span>
              <span>
                SAMPLING ENGINE:{" "}
                <strong style={{ color: isRealPixelActive ? "#34d399" : "#fbbf24" }}>
                  {isRealPixelActive ? "REAL-PIXEL OFFSCREEN CANVAS [ONLINE]" : "DETERMINISTIC FALLBACK MATRIX [ACTIVE]"}
                </strong>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
