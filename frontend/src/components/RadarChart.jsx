import { useMemo } from "react";

/**
 * RadarChart renders an overlapping 4-axis SVG spider chart comparing
 * the Planetary Target against the selected Earth Analog.
 */
export default function RadarChart({
  targetScores = { slope: 80, radar_roughness: 75, thermal: 90, geochemical: 70 },
  analogScores = { slope: 75, radar_roughness: 80, thermal: 65, geochemical: 85 },
  targetName = "Target",
  analogName = "Analog",
  size = 280,
}) {
  const axes = useMemo(
    () => [
      { key: "slope", label: "SLOPE / DEM", angle: -Math.PI / 2 }, // Top
      { key: "radar_roughness", label: "SAR ROUGHNESS", angle: 0 }, // Right
      { key: "thermal", label: "THERMAL REGIME", angle: Math.PI / 2 }, // Bottom
      { key: "geochemical", label: "GEOCHEMISTRY", angle: Math.PI }, // Left
    ],
    []
  );

  const center = size / 2;
  const radius = (size / 2) - 45;

  // Helper to convert value (0-100) and angle to (x, y)
  const getCoordinates = (val, angle) => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Build SVG polygon points string
  const targetPoints = axes
    .map((axis) => {
      const val = targetScores[axis.key] ?? 50;
      const { x, y } = getCoordinates(val, axis.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const analogPoints = axes
    .map((axis) => {
      const val = analogScores[axis.key] ?? 50;
      const { x, y } = getCoordinates(val, axis.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gridRings = [25, 50, 75, 100];

  return (
    <div className="radar-chart-container" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        {/* Background Grid Rings */}
        {gridRings.map((pct) => {
          const ringPoints = axes
            .map((axis) => {
              const { x, y } = getCoordinates(pct, axis.angle);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <polygon
              key={pct}
              points={ringPoints}
              fill={pct === 100 ? "rgba(17, 27, 40, 0.6)" : "none"}
              stroke="#223348"
              strokeWidth={pct === 100 ? "1.5" : "1"}
              strokeDasharray={pct < 100 ? "3 3" : "none"}
            />
          );
        })}

        {/* Ring Percentage Labels */}
        {gridRings.map((pct) => {
          const { x, y } = getCoordinates(pct, -Math.PI / 2);
          return (
            <text
              key={pct}
              x={x + 3}
              y={y + 11}
              fill="#64748b"
              fontSize="8"
              fontFamily="monospace"
            >
              {pct}
            </text>
          );
        })}

        {/* Axis Spokes & Labels */}
        {axes.map((axis) => {
          const { x, y } = getCoordinates(100, axis.angle);
          const labelDist = radius + 22;
          const lx = center + labelDist * Math.cos(axis.angle);
          const ly = center + labelDist * Math.sin(axis.angle);

          let textAnchor = "middle";
          if (axis.angle === 0) textAnchor = "start";
          if (axis.angle === Math.PI) textAnchor = "end";

          return (
            <g key={axis.key}>
              <line
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#2a3f55"
                strokeWidth="1.2"
              />
              <text
                x={lx}
                y={ly + (axis.angle === -Math.PI / 2 ? -4 : axis.angle === Math.PI / 2 ? 10 : 3)}
                fill="#94a3b8"
                fontSize="9"
                fontWeight="600"
                fontFamily="monospace"
                textAnchor={textAnchor}
                letterSpacing="0.5px"
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {/* Planetary Target Polygon (Cyan) */}
        <polygon
          points={targetPoints}
          fill="rgba(34, 211, 238, 0.2)"
          stroke="#22d3ee"
          strokeWidth="2.2"
          style={{ filter: "drop-shadow(0 0 6px rgba(34, 211, 238, 0.4))" }}
        />

        {/* Earth Analog Polygon (Emerald) */}
        <polygon
          points={analogPoints}
          fill="rgba(16, 185, 129, 0.25)"
          stroke="#10b981"
          strokeWidth="2.2"
          strokeDasharray="4 2"
          style={{ filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))" }}
        />

        {/* Target Data Nodes */}
        {axes.map((axis) => {
          const val = targetScores[axis.key] ?? 50;
          const { x, y } = getCoordinates(val, axis.angle);
          return (
            <circle
              key={`target-${axis.key}`}
              cx={x}
              cy={y}
              r="3.5"
              fill="#22d3ee"
              stroke="#090e16"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Analog Data Nodes */}
        {axes.map((axis) => {
          const val = analogScores[axis.key] ?? 50;
          const { x, y } = getCoordinates(val, axis.angle);
          return (
            <circle
              key={`analog-${axis.key}`}
              cx={x}
              cy={y}
              r="3.5"
              fill="#10b981"
              stroke="#090e16"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "18px",
          marginTop: "12px",
          fontSize: "11px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "12px",
              height: "3px",
              backgroundColor: "#22d3ee",
              borderRadius: "2px",
              boxShadow: "0 0 6px #22d3ee",
            }}
          />
          <span style={{ color: "#22d3ee", fontWeight: "600" }}>{targetName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "12px",
              height: "3px",
              backgroundColor: "#10b981",
              borderRadius: "2px",
              borderTop: "1px dashed #10b981",
              boxShadow: "0 0 6px #10b981",
            }}
          />
          <span style={{ color: "#10b981", fontWeight: "600" }}>{analogName}</span>
        </div>
      </div>
    </div>
  );
}
