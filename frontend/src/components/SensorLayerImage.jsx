import { useState, useEffect } from "react";
import { preloadCanvasImage } from "../utils/pixelTelemetry";

const BASE_FALLBACK_IMAGE = "/data/moon/shackleton/optical/shackleton_preview_cropped.png";

/**
 * SensorLayerImage renders multi-spectral planetary and terrestrial imagery.
 * When real derived raster PNGs are present on disk, they render cleanly with zero distortion.
 * If an image fails or is missing, it gracefully falls back to the base texture
 * and activates simulated scientific SVG/CSS colormaps (SAR speckle, Inferno LUT, Slope relief).
 */
export default function SensorLayerImage({
  src,
  layerType = "optical",
  alt = "Sensor Layer",
  className = "",
  style = {},
  body = "earth",
  resolution = "10 m/px",
  onLoad,
}) {
  const [failedSrc, setFailedSrc] = useState(null);

  const isFailed = failedSrc === src;
  const currentSrc = isFailed ? BASE_FALLBACK_IMAGE : (src || BASE_FALLBACK_IMAGE);

  // Preload and prime offscreen canvas cache whenever image source changes
  useEffect(() => {
    if (currentSrc) {
      preloadCanvasImage(currentSrc);
    }
  }, [currentSrc]);

  const handleError = () => {
    if (src && failedSrc !== src) {
      setFailedSrc(src);
      preloadCanvasImage(BASE_FALLBACK_IMAGE);
    }
  };

  const handleImageLoad = (e) => {
    preloadCanvasImage(currentSrc);
    if (onLoad) onLoad(e);
  };

  // Determine filter style: only apply heavy colormaps if falling back on error
  const getFilterStyle = () => {
    if (!isFailed) {
      // Real scientific PNG raster - render raw and crisp
      return { filter: "none" };
    }

    // Fallback colormaps over base optical texture
    switch (layerType) {
      case "sar":
        return {
          filter: "grayscale(100%) contrast(190%) brightness(105%)",
        };
      case "thermal":
        return {
          filter: "grayscale(100%) contrast(160%) brightness(110%)",
        };
      case "slope":
        return {
          filter: "grayscale(90%) contrast(175%) brightness(100%)",
        };
      case "optical":
      default:
        if (body === "mars") {
          return {
            filter: "sepia(0.35) saturate(1.4) hue-rotate(-12deg) contrast(115%)",
          };
        }
        if (body === "moon") {
          return {
            filter: "grayscale(100%) contrast(120%) brightness(102%)",
          };
        }
        return {
          filter: "contrast(110%) saturate(1.15)",
        };
    }
  };

  return (
    <div
      className={`sensor-image-wrapper ${className}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Base Imagery */}
      <img
        src={currentSrc}
        alt={alt}
        crossOrigin="anonymous"
        onLoad={handleImageLoad}
        onError={handleError}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
          ...getFilterStyle(),
        }}
      />

      {/* Fallback SAR Speckle & Cyan Backscatter Overlay */}
      {isFailed && layerType === "sar" && (
        <>
          <div
            className="sar-speckle-overlay"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "radial-gradient(circle, rgba(34, 211, 238, 0.12) 0%, rgba(6, 78, 59, 0.08) 100%)",
              mixBlendMode: "screen",
            }}
          />
          <div
            className="sar-noise-layer"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.18,
              backgroundImage: "radial-gradient(#ffffff 0.85px, transparent 0.85px)",
              backgroundSize: "4px 4px",
              mixBlendMode: "overlay",
            }}
          />
        </>
      )}

      {/* Fallback Thermal Radiometric Inferno/Magma False-Color Overlay */}
      {isFailed && layerType === "thermal" && (
        <div
          className="thermal-inferno-lut"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "linear-gradient(135deg, rgba(20, 5, 45, 0.88) 0%, rgba(115, 20, 110, 0.85) 30%, rgba(235, 75, 40, 0.82) 65%, rgba(254, 220, 60, 0.85) 90%, rgba(255, 255, 240, 0.92) 100%)",
            mixBlendMode: "color-dodge",
          }}
        />
      )}

      {/* Fallback Topographic Slope Relief Gradient Overlay */}
      {isFailed && layerType === "slope" && (
        <div
          className="slope-relief-lut"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "linear-gradient(145deg, rgba(30, 64, 175, 0.65) 0%, rgba(13, 148, 136, 0.6) 28%, rgba(234, 179, 8, 0.6) 60%, rgba(225, 29, 72, 0.7) 85%, rgba(255, 255, 255, 0.8) 100%)",
            mixBlendMode: "overlay",
          }}
        />
      )}

      {/* Telemetry Corner Indicator */}
      <div
        className="sensor-resolution-badge"
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 8px",
          borderRadius: "4px",
          background: "rgba(7, 11, 18, 0.85)",
          border: "1px solid rgba(104, 189, 246, 0.25)",
          color: "#68bdf6",
          fontSize: "9px",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.8px",
          textTransform: "uppercase",
          pointerEvents: "none",
          zIndex: 4,
          backdropFilter: "blur(4px)",
        }}
      >
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor:
              layerType === "sar"
                ? "#22d3ee"
                : layerType === "thermal"
                ? "#f97316"
                : layerType === "slope"
                ? "#a855f7"
                : "#68bdf6",
            boxShadow: `0 0 6px ${
              layerType === "sar"
                ? "#22d3ee"
                : layerType === "thermal"
                ? "#f97316"
                : layerType === "slope"
                ? "#a855f7"
                : "#68bdf6"
            }`,
          }}
        />
        {layerType.toUpperCase()} · {resolution}
      </div>

      {isFailed && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            padding: "2px 6px",
            borderRadius: "3px",
            background: "rgba(20, 26, 38, 0.9)",
            border: "1px solid rgba(245, 166, 35, 0.4)",
            color: "#f5a623",
            fontSize: "8px",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.5px",
            pointerEvents: "none",
            zIndex: 4,
          }}
        >
          SYNTHETIC SCI-LUT FALLBACK
        </div>
      )}
    </div>
  );
}
