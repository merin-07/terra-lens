import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { TransformWrapper, TransformComponent } from "./ZoomPanPinch";
import { Activity, X } from "lucide-react";
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
  { id: "slope", label: "Elevation" },
];

/**
 * 8-Bin SVG Sparkline Mini-Histogram
 */
function SparklineHistogram({ histogram, color = "#38bdf8", label = "Target" }) {
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
            <stop offset="100%" stopColor={color} stopOpacity="0.25" />
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
              <title>{`Bin ${idx + 1}: ${(val * 100).toFixed(1)}%`}</title>
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

const SplitScope = forwardRef(function SplitScope(
  {
    target,
    analog,
    activeSensor = "optical",
    loupeActive = false,
    chosenLoupeSensor = "sar",
    loupeRadius = 140,
    showTransect = false,
    onCloseTransect,
    onTelemetryChange,
  },
  ref
) {
  // Cursor tracking { pctX, pctY, pxX, pxY, width, height }
  const [cursorPos, setCursorPos] = useState(null);

  // Persistent last sampled coordinates so readouts never collapse to blank
  const [lastSampledPos, setLastSampledPos] = useState({
    pctX: 50.0,
    pctY: 50.0,
    pxX: 400,
    pxY: 300,
    width: 800,
    height: 600,
  });

  // Sensor Calibration Laser Sweep trigger
  const [isScanning, setIsScanning] = useState(false);
  useEffect(() => {
    let timer;
    const animFrame = requestAnimationFrame(() => {
      setIsScanning(true);
      timer = setTimeout(() => setIsScanning(false), 420);
    });
    return () => {
      cancelAnimationFrame(animFrame);
      if (timer) clearTimeout(timer);
    };
  }, [target?.id, analog?.id, activeSensor]);

  // Revision counter for asynchronous offscreen canvas rasterization
  const [, setCanvasRevision] = useState(0);

  const leftTransformRef = useRef(null);
  const rightTransformRef = useRef(null);
  const isSyncingRef = useRef(false);

  const leftContainerRef = useRef(null);
  const rightContainerRef = useRef(null);

  const targetLayer = target?.layers?.[activeSensor];
  const analogLayer = analog?.layers?.[activeSensor];

  // Effective loupe sensor (reveals a different layer than active)
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

  const handleResetZoom = useCallback(() => {
    if (leftTransformRef.current) leftTransformRef.current.resetTransform(180);
    if (rightTransformRef.current) rightTransformRef.current.resetTransform(180);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (leftTransformRef.current) leftTransformRef.current.zoomIn(0.35, 150);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (leftTransformRef.current) leftTransformRef.current.zoomOut(0.35, 150);
  }, []);

  // Imperative handle for parent dock actions
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleResetZoom,
    }),
    [handleZoomIn, handleZoomOut, handleResetZoom]
  );

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

  // Real-Pixel Telemetry Sampling: Target & Earth Analog
  const targetTelemetry = useMemo(() => {
    return samplePixelTelemetry(
      targetLayer?.path,
      normX,
      normY,
      activeSensor,
      target?.body?.toLowerCase() || "moon"
    );
  }, [targetLayer?.path, normX, normY, activeSensor, target?.body]);

  const analogTelemetry = useMemo(() => {
    return samplePixelTelemetry(
      analogLayer?.path,
      normX,
      normY,
      activeSensor,
      "earth"
    );
  }, [analogLayer?.path, normX, normY, activeSensor]);

  // Secondary X-Ray Loupe Telemetry
  const targetLoupeTelemetry = useMemo(() => {
    if (!loupeActive) return null;
    return samplePixelTelemetry(
      targetLoupeLayer?.path,
      normX,
      normY,
      effectiveLoupeSensor,
      target?.body?.toLowerCase() || "moon"
    );
  }, [loupeActive, targetLoupeLayer?.path, normX, normY, effectiveLoupeSensor, target?.body]);

  const analogLoupeTelemetry = useMemo(() => {
    if (!loupeActive) return null;
    return samplePixelTelemetry(
      analogLoupeLayer?.path,
      normX,
      normY,
      effectiveLoupeSensor,
      "earth"
    );
  }, [loupeActive, analogLoupeLayer?.path, normX, normY, effectiveLoupeSensor]);

  // Instantaneous Differential Metrics
  const differentialBadge = useMemo(() => {
    return computeDifferentialBadge(
      targetTelemetry.physicalValue,
      analogTelemetry.physicalValue,
      activeSensor
    );
  }, [targetTelemetry.physicalValue, analogTelemetry.physicalValue, activeSensor]);

  // 9x9 Neighborhood Cross-Correlation
  const patchCorrelation = useMemo(() => {
    return calculatePatchCorrelation(
      targetTelemetry.patchLuminances,
      analogTelemetry.patchLuminances
    );
  }, [targetTelemetry.patchLuminances, analogTelemetry.patchLuminances]);

  // Notify parent of updated telemetry for Layer 2 editorial headers
  useEffect(() => {
    if (onTelemetryChange) {
      onTelemetryChange({
        targetTelemetry,
        analogTelemetry,
        differentialBadge,
        patchCorrelation,
      });
    }
  }, [targetTelemetry, analogTelemetry, differentialBadge, patchCorrelation, onTelemetryChange]);

  return (
    <div className="split-scope-viewport-root">
      {/* ====================================================================
          LEFT WORLD: PLANETARY TARGET (50vw × 100vh)
          ==================================================================== */}
      <div
        className="split-scope-pane left-pane"
        ref={leftContainerRef}
        onMouseMove={(e) => handleMouseMove(e, "left")}
        onMouseLeave={handleMouseLeave}
      >
        {/* Optical Corner Fiducial Brackets */}
        <div className="viewport-fiducial tl">┌</div>
        <div className="viewport-fiducial tr">┐</div>
        <div className="viewport-fiducial bl">└</div>
        <div className="viewport-fiducial br">┘</div>

        {/* 420ms Laser Calibration Sweep */}
        {isScanning && <div className="laser-calibration-scanline" />}

        <TransformWrapper
          ref={leftTransformRef}
          initialScale={1}
          minScale={0.8}
          maxScale={8}
          onTransformed={(r, state) => syncTransform("left", state)}
        >
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
            }}
            contentStyle={{ width: "100%", height: "100%" }}
          >
            <SensorLayerImage
              src={targetLayer?.path}
              layerType={activeSensor}
              alt={`${target?.name} - ${activeSensor}`}
              body={target?.body?.toLowerCase()}
              resolution={targetLayer?.resolution}
              className={isScanning ? "focus-pull-active" : ""}
            />
          </TransformComponent>
        </TransformWrapper>

        {/* Circular X-Ray Magnifying Loupe Overlay */}
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
              style={{ clipPath: `circle(${loupeRadius}px at 50% 50%)` }}
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
            <svg className="loupe-gyro-bezel" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="0.8"
                strokeDasharray="1.5 3"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="0.5"
              />
              <line x1="50" y1="2" x2="50" y2="7" stroke="#38bdf8" strokeWidth="1.2" />
              <line x1="50" y1="93" x2="50" y2="98" stroke="#38bdf8" strokeWidth="1.2" />
              <line x1="2" y1="50" x2="7" y2="50" stroke="#38bdf8" strokeWidth="1.2" />
              <line x1="93" y1="50" x2="98" y2="50" stroke="#38bdf8" strokeWidth="1.2" />
            </svg>
            <div className="loupe-rim-pill">
              <span>{effectiveLoupeSensor.toUpperCase()} X-RAY</span>
              {targetLoupeTelemetry && (
                <strong>{targetLoupeTelemetry.physicalValue?.shortFormatted}</strong>
              )}
            </div>
          </div>
        )}

        {/* Minimalist Precision Reticle */}
        {cursorPos && !loupeActive && (
          <div
            className="spatial-reticle"
            style={{
              left: `${cursorPos.pctX}%`,
              top: `${cursorPos.pctY}%`,
            }}
          >
            <div className="reticle-line-v" />
            <div className="reticle-line-h" />
            <div className="reticle-center-pip" />
            <div className="reticle-glass-pill">
              <span
                className="reticle-swatch"
                style={{ backgroundColor: targetTelemetry.rgbString }}
              />
              <span className="reticle-val">
                {targetTelemetry.physicalValue.formatted}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          RIGHT WORLD: EARTH ANALOG (50vw × 100vh)
          ==================================================================== */}
      <div
        className="split-scope-pane right-pane"
        ref={rightContainerRef}
        onMouseMove={(e) => handleMouseMove(e, "right")}
        onMouseLeave={handleMouseLeave}
      >
        {/* Optical Corner Fiducial Brackets */}
        <div className="viewport-fiducial tl">┌</div>
        <div className="viewport-fiducial tr">┐</div>
        <div className="viewport-fiducial bl">└</div>
        <div className="viewport-fiducial br">┘</div>

        {/* 420ms Laser Calibration Sweep */}
        {isScanning && <div className="laser-calibration-scanline" />}

        <TransformWrapper
          ref={rightTransformRef}
          initialScale={1}
          minScale={0.8}
          maxScale={8}
          onTransformed={(r, state) => syncTransform("right", state)}
        >
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
            }}
            contentStyle={{ width: "100%", height: "100%" }}
          >
            <SensorLayerImage
              src={analogLayer?.path}
              layerType={activeSensor}
              alt={`${analog?.name} - ${activeSensor}`}
              body="earth"
              resolution={analogLayer?.resolution}
              className={isScanning ? "focus-pull-active" : ""}
            />
          </TransformComponent>
        </TransformWrapper>

        {/* Circular X-Ray Magnifying Loupe Overlay */}
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
              style={{ clipPath: `circle(${loupeRadius}px at 50% 50%)` }}
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
            <svg className="loupe-gyro-bezel" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="0.8"
                strokeDasharray="1.5 3"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="0.5"
              />
              <line x1="50" y1="2" x2="50" y2="7" stroke="#38bdf8" strokeWidth="1.2" />
              <line x1="50" y1="93" x2="50" y2="98" stroke="#38bdf8" strokeWidth="1.2" />
              <line x1="2" y1="50" x2="7" y2="50" stroke="#38bdf8" strokeWidth="1.2" />
              <line x1="93" y1="50" x2="98" y2="50" stroke="#38bdf8" strokeWidth="1.2" />
            </svg>
            <div className="loupe-rim-pill">
              <span>{effectiveLoupeSensor.toUpperCase()} X-RAY</span>
              {analogLoupeTelemetry && (
                <strong>{analogLoupeTelemetry.physicalValue?.shortFormatted}</strong>
              )}
            </div>
          </div>
        )}

        {/* Minimalist Precision Reticle */}
        {cursorPos && !loupeActive && (
          <div
            className="spatial-reticle"
            style={{
              left: `${cursorPos.pctX}%`,
              top: `${cursorPos.pctY}%`,
            }}
          >
            <div className="reticle-line-v" />
            <div className="reticle-line-h" />
            <div className="reticle-center-pip" />
            <div className="reticle-glass-pill">
              <span
                className="reticle-swatch"
                style={{ backgroundColor: analogTelemetry.rgbString }}
              />
              <span className="reticle-val">
                {analogTelemetry.physicalValue.formatted}
              </span>
              <span className={`reticle-delta-pill ${differentialBadge.statusClass}`}>
                {differentialBadge.deltaPhysical}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          FLOATING 9×9 TRANSECT HISTOGRAM POPOVER (APPLE VISIONOS FROSTED GLASS)
          ==================================================================== */}
      {showTransect && (
        <div className="spatial-transect-popover">
          <div className="transect-popover-header">
            <div className="transect-popover-title">
              <Activity size={15} color="#38bdf8" />
              <span>9×9 KERNEL TRANSECT & LOCAL HISTOGRAMS</span>
              <span className="transect-sensor-tag">{activeSensor.toUpperCase()}</span>
            </div>
            <button
              className="spatial-close-btn"
              onClick={onCloseTransect}
              title="Close Transect Popover"
            >
              <X size={14} />
            </button>
          </div>

          <div className="transect-popover-grid">
            {/* Target Histogram */}
            <div className="transect-patch-box">
              <div className="transect-box-meta">
                <span>
                  {target?.body} · {target?.name?.split(" ")[0]}
                </span>
                <strong>{targetTelemetry.physicalValue.shortFormatted}</strong>
              </div>
              <SparklineHistogram
                histogram={targetTelemetry.histogram}
                color="#38bdf8"
                label="Target"
              />
              <div className="transect-box-foot">
                <span>σ (Roughness): {targetTelemetry.stdDev}</span>
              </div>
            </div>

            {/* Center Gauge */}
            <div className="transect-center-gauge">
              <div className="transect-corr-label">PEARSON CORRELATION (r)</div>
              <div className="transect-corr-val">
                {patchCorrelation.pearsonR >= 0 ? "+" : ""}
                {patchCorrelation.pearsonR}
              </div>
              <div className="transect-corr-match">
                {patchCorrelation.correlationPercent}% Parametric Match
              </div>
              <div className="transect-class-pill">
                {classifyMicroRoughness(targetTelemetry.stdDev)}
              </div>
            </div>

            {/* Analog Histogram */}
            <div className="transect-patch-box">
              <div className="transect-box-meta">
                <span>{analog?.name}</span>
                <strong>{analogTelemetry.physicalValue.shortFormatted}</strong>
              </div>
              <SparklineHistogram
                histogram={analogTelemetry.histogram}
                color="#34d399"
                label="Analog"
              />
              <div className="transect-box-foot">
                <span>σ (Roughness): {analogTelemetry.stdDev}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SplitScope;
