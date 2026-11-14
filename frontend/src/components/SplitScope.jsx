import { useState, useRef, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "./ZoomPanPinch";
import {
  Layers3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
} from "lucide-react";
import SensorLayerImage from "./SensorLayerImage";

const SENSOR_VISORS = [
  { id: "optical", label: "Optical" },
  { id: "sar", label: "SAR Radar" },
  { id: "thermal", label: "Thermal" },
  { id: "slope", label: "Topography / Slope" },
];

export default function SplitScope({
  target,
  analog,
  activeSensor = "optical",
  onSensorChange,
}) {
  const [loupeActive, setLoupeActive] = useState(false);
  const [chosenLoupeSensor, setChosenLoupeSensor] = useState("sar");
  const [cursorPos, setCursorPos] = useState(null); // { pctX, pctY, pxX, pxY, width, height }

  const leftTransformRef = useRef(null);
  const rightTransformRef = useRef(null);
  const isSyncingRef = useRef(false);

  const leftContainerRef = useRef(null);
  const rightContainerRef = useRef(null);

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

    setCursorPos({
      pctX: Math.max(0, Math.min(100, relX * 100)),
      pctY: Math.max(0, Math.min(100, relY * 100)),
      pxX: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      pxY: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      width: rect.width,
      height: rect.height,
    });
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
  };

  // Compute effective loupe sensor without synchronous effect setState
  const effectiveLoupeSensor = chosenLoupeSensor === activeSensor
    ? (SENSOR_VISORS.find((v) => v.id !== activeSensor)?.id || "sar")
    : chosenLoupeSensor;

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

  const getSimulatedIntensity = (isTarget) => {
    if (!cursorPos) return "--";
    const xRatio = cursorPos.pctX / 100;
    const yRatio = cursorPos.pctY / 100;

    if (activeSensor === "optical") {
      const base = isTarget ? (target?.body === "Moon" ? 0.11 : 0.22) : 0.18;
      return `Albedo: ${(base + (xRatio * 0.12 - yRatio * 0.05)).toFixed(3)}`;
    }
    if (activeSensor === "sar") {
      return `CPR: ${(0.8 + (xRatio * 1.6 + yRatio * 0.4)).toFixed(2)} dB`;
    }
    if (activeSensor === "thermal") {
      const baseTemp = isTarget ? (target?.body === "Moon" ? 45 : 220) : 285;
      return `Temp: ${Math.round(baseTemp + xRatio * 60 - yRatio * 30)} K`;
    }
    return `Slope: ${(6 + xRatio * 26 + yRatio * 4).toFixed(1)}°`;
  };

  const targetLayer = target?.layers?.[activeSensor];
  const analogLayer = analog?.layers?.[activeSensor];
  const targetLoupeLayer = target?.layers?.[effectiveLoupeSensor];
  const analogLoupeLayer = analog?.layers?.[effectiveLoupeSensor];

  const loupeRadius = 75; // px

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
                <div className="loupe-tag">{effectiveLoupeSensor.toUpperCase()} X-RAY</div>
              </div>
            )}

            {/* Crosshair Marker */}
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
                <div className="reticle-telemetry">
                  <span>{getSimulatedIntensity(true)}</span>
                  <small>REL: {cursorPos.pctX.toFixed(1)}%, {cursorPos.pctY.toFixed(1)}%</small>
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
                <div className="loupe-tag">{effectiveLoupeSensor.toUpperCase()} X-RAY</div>
              </div>
            )}

            {/* Crosshair Marker */}
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
                <div className="reticle-telemetry">
                  <span>{getSimulatedIntensity(false)}</span>
                  <small>REL: {cursorPos.pctX.toFixed(1)}%, {cursorPos.pctY.toFixed(1)}%</small>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
