import axios from "axios";
import localTargets from "../data/targets.json";
import localAnalogs from "../data/analogs.json";
import localMetrics from "../data/comparison_metrics.json";

const API_BASE_URL = "http://localhost:8000";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1800, // Quick timeout for seamless offline fallback
});

/**
 * Fetch all planetary targets
 */
export async function getTargets() {
  try {
    const res = await client.get("/targets");
    return res.data;
  } catch {
    console.info("Backend offline or unreachable, falling back to local targets dataset.");
    return localTargets.planetary_targets;
  }
}

/**
 * Fetch all Earth analogs
 */
export async function getAnalogs() {
  try {
    const res = await client.get("/analogs");
    return res.data;
  } catch {
    console.info("Backend offline or unreachable, falling back to local analogs dataset.");
    return localAnalogs.earth_analogs;
  }
}

/**
 * Fetch diagnostics and sensor statistics for a target-analog pair
 */
export async function getDiagnostics(targetId, analogId) {
  try {
    const res = await client.get(`/diagnostics/${targetId}/${analogId}`);
    return res.data;
  } catch {
    console.info(`Falling back to local diagnostics for ${targetId}_${analogId}`);
    const key = `${targetId.toLowerCase()}_${analogId.toLowerCase()}`;
    const pair = localMetrics.comparison_metrics?.[key];
    if (pair) return pair;

    // Default safe fallback if pair missing
    return {
      target_id: targetId,
      analog_id: analogId,
      pair_title: `${targetId.toUpperCase()} ⟷ ${analogId.toUpperCase()}`,
      scores: { slope: 70, radar_roughness: 70, thermal: 70, geochemical: 70 },
      radar_chart_vectors: {
        target: { slope: 75, radar_roughness: 75, thermal: 75, geochemical: 75 },
        analog: { slope: 70, radar_roughness: 70, thermal: 70, geochemical: 70 },
      },
      sensor_stats: {
        optical: { mean: 0.15, max: 0.35, std_dev: 0.05, unit: "Albedo / Reflectance", agency_source: "Orbital Multi-Spectral" },
        sar: { mean: 1.2, max: 2.5, std_dev: 0.4, unit: "Backscatter CPR / dB", agency_source: "SAR Radar Profiler" },
        thermal: { mean: 220, max: 290, std_dev: 25, unit: "Kelvin (K)", agency_source: "Radiometric Radiometer" },
        slope: { mean: 15, max: 32, std_dev: 6, unit: "Degrees (°)", agency_source: "Laser / InSAR DEM" },
      },
      diagnostics: {
        match: "High degree of morphologic and geotechnical terrain alignment.",
        breakdown: "Atmospheric pressure and terrestrial water cycle differences.",
        mitigation: "Environmental encapsulation and gravity compensation for tool trials.",
      },
    };
  }
}

/**
 * Rank analogs with given weights for target
 */
export async function rankAnalogs(targetId, weights) {
  try {
    const res = await client.post("/rank-analogs", {
      target_id: targetId,
      weights,
    });
    return res.data;
  } catch {
    console.info("Using client-side ranking engine fallback.");
    return calculateLocalRanking(targetId, weights);
  }
}

/**
 * Client-side calculation of analog rankings (instant fallback)
 */
export function calculateLocalRanking(targetId, weights) {
  const wSlope = Math.max(0, parseFloat(weights.slope) || 0);
  const wRadar = Math.max(0, parseFloat(weights.radar_roughness) || 0);
  const wThermal = Math.max(0, parseFloat(weights.thermal) || 0);
  const wGeochem = Math.max(0, parseFloat(weights.geochemical) || 0);

  const total = wSlope + wRadar + wThermal + wGeochem;
  const nw =
    total <= 1e-6
      ? { slope: 0.25, radar_roughness: 0.25, thermal: 0.25, geochemical: 0.25 }
      : {
          slope: Number((wSlope / total).toFixed(4)),
          radar_roughness: Number((wRadar / total).toFixed(4)),
          thermal: Number((wThermal / total).toFixed(4)),
          geochemical: Number((wGeochem / total).toFixed(4)),
        };

  const analogs = localAnalogs.earth_analogs || [];
  const metrics = localMetrics.comparison_metrics || {};

  const ranked = analogs.map((analog) => {
    const key = `${targetId.toLowerCase()}_${analog.id.toLowerCase()}`;
    const pair = metrics[key];
    const scores = pair?.scores || {
      slope: 60,
      radar_roughness: 60,
      thermal: 60,
      geochemical: 60,
    };

    const composite =
      nw.slope * scores.slope +
      nw.radar_roughness * scores.radar_roughness +
      nw.thermal * scores.thermal +
      nw.geochemical * scores.geochemical;

    return {
      rank: 0,
      analog_id: analog.id,
      name: analog.name,
      region: analog.region,
      country: analog.country || "",
      coordinates: analog.coordinates,
      composite_score: Number(composite.toFixed(1)),
      scores,
      normalized_weights: nw,
      analog,
    };
  });

  ranked.sort((a, b) => b.composite_score - a.composite_score);
  ranked.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return {
    target_id: targetId,
    weights_applied: nw,
    ranked_analogs: ranked,
  };
}
