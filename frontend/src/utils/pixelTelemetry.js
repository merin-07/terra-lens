/**
 * TERRA-LENS: Real-Pixel Canvas Telemetry Readout & Live Spectral Neighborhood Inspector
 * Zero-dependency utility for offscreen HTML5 canvas pixel sampling, 9x9 neighborhood analysis,
 * micro-roughness calculation, 8-bin histograms, and scientific sensor physical calibrations.
 */

// In-memory cache of offscreen HTML5 canvas elements keyed by image src URL
const canvasCache = new Map();
const loadListeners = new Map();

/**
 * Preloads an image into an offscreen canvas using willReadFrequently: true
 * @param {string} imageSrc - Source URL of the image
 * @returns {Promise<object>} Cache entry containing { status, canvas, ctx, width, height }
 */
export function preloadCanvasImage(imageSrc) {
  if (!imageSrc || typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  if (canvasCache.has(imageSrc)) {
    const cached = canvasCache.get(imageSrc);
    if (cached.status === "loaded") return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    let entry = canvasCache.get(imageSrc);
    if (!entry) {
      entry = {
        status: "loading",
        canvas: null,
        ctx: null,
        width: 0,
        height: 0,
      };
      canvasCache.set(imageSrc, entry);
    }

    if (!loadListeners.has(imageSrc)) {
      loadListeners.set(imageSrc, []);
    }
    loadListeners.get(imageSrc).push(resolve);

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const w = img.naturalWidth || 256;
        const h = img.naturalHeight || 256;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);

        entry.status = "loaded";
        entry.canvas = canvas;
        entry.ctx = ctx;
        entry.width = w;
        entry.height = h;

        const cbs = loadListeners.get(imageSrc) || [];
        loadListeners.delete(imageSrc);
        cbs.forEach((cb) => cb(entry));
      } catch (err) {
        console.warn("Canvas rasterization error for", imageSrc, err);
        entry.status = "error";
        const cbs = loadListeners.get(imageSrc) || [];
        loadListeners.delete(imageSrc);
        cbs.forEach((cb) => cb(entry));
      }
    };

    img.onerror = () => {
      entry.status = "error";
      const cbs = loadListeners.get(imageSrc) || [];
      loadListeners.delete(imageSrc);
      cbs.forEach((cb) => cb(entry));
    };

    img.src = imageSrc;
  });
}

/**
 * Subscribes to canvas load completion for an image src
 * @param {string} imageSrc
 * @param {Function} callback
 */
export function subscribeCanvasLoad(imageSrc, callback) {
  if (!imageSrc || typeof callback !== "function") return () => {};
  const cached = canvasCache.get(imageSrc);
  if (cached && cached.status === "loaded") {
    callback(cached);
    return () => {};
  }
  if (!loadListeners.has(imageSrc)) {
    loadListeners.set(imageSrc, []);
  }
  loadListeners.get(imageSrc).push(callback);
  return () => {
    const list = loadListeners.get(imageSrc);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    }
  };
}

/**
 * Standard perceived photometric luminance (ITU-R BT.709)
 * @param {number} r - 0..255
 * @param {number} g - 0..255
 * @param {number} b - 0..255
 * @returns {number} Luminance L in [0, 1]
 */
export function calculateLuminance(r, g, b) {
  const normR = Math.max(0, Math.min(255, r)) / 255;
  const normG = Math.max(0, Math.min(255, g)) / 255;
  const normB = Math.max(0, Math.min(255, b)) / 255;
  const L = 0.2126 * normR + 0.7152 * normG + 0.0722 * normB;
  return Math.max(0, Math.min(1, L));
}

/**
 * Maps normalized luminance [0, 1] to scientific physical instrument scales
 * @param {number} L - Perceived luminance in [0, 1]
 * @param {string} sensorKey - "optical" | "sar" | "thermal" | "slope"
 * @param {string} siteRole - "target" | "analog" | "moon" | "mars" | "earth"
 * @param {string} [targetBody="Moon"] - "Moon" | "Mars"
 */
export function mapLuminanceToSensor(L, sensorKey = "optical", siteRole = "target", targetBody = "Moon") {
  const clampedL = Math.max(0, Math.min(1, Number.isFinite(L) ? L : 0.5));
  const isEarth =
    siteRole === "analog" ||
    siteRole === "earth" ||
    (typeof siteRole === "string" && siteRole.toLowerCase().includes("earth"));

  switch (sensorKey) {
    case "optical": {
      // Radiance / Lambertian Albedo (0.04 to 0.45 A)
      const albedo = 0.04 + clampedL * (0.45 - 0.04);
      const radiance = clampedL * 28.5; // W / (m² · sr · nm)
      return {
        sensor: "optical",
        label: "Lambertian Albedo",
        primaryValue: Number(albedo.toFixed(3)),
        unit: "A",
        formatted: `Albedo: ${albedo.toFixed(3)} A`,
        shortFormatted: `${albedo.toFixed(3)} A`,
        details: {
          albedo: Number(albedo.toFixed(3)),
          radiance: Number(radiance.toFixed(1)),
        },
      };
    }

    case "sar": {
      // Backscatter sigma_0 (-24.0 to +6.5 dB) and Circular Polarization Ratio (CPR: 0.35 to 2.20)
      const sigma0 = -24.0 + clampedL * (6.5 - -24.0);
      const cpr = 0.35 + clampedL * (2.2 - 0.35);
      return {
        sensor: "sar",
        label: "Radar Backscatter",
        primaryValue: Number(sigma0.toFixed(1)),
        secondaryValue: Number(cpr.toFixed(2)),
        unit: "dB",
        formatted: `σ₀: ${sigma0 >= 0 ? "+" : ""}${sigma0.toFixed(1)} dB · CPR: ${cpr.toFixed(2)}`,
        shortFormatted: `${sigma0 >= 0 ? "+" : ""}${sigma0.toFixed(1)} dB`,
        details: {
          sigma0: Number(sigma0.toFixed(1)),
          cpr: Number(cpr.toFixed(2)),
        },
      };
    }

    case "thermal": {
      // Brightness Temperature: 40 K to 220 K (Moon/Mars); 235 K to 343 K (Earth)
      const isMars = !isEarth && typeof targetBody === "string" && targetBody.toLowerCase() === "mars";
      let tempK;
      if (isEarth) {
        tempK = 235 + clampedL * (343 - 235);
      } else if (isMars) {
        tempK = 145 + clampedL * (255 - 145);
      } else {
        // Moon (cryogenic shadowed cold traps to illuminated rim)
        tempK = 40 + clampedL * (220 - 40);
      }
      const tempC = tempK - 273.15;
      const roundedK = Math.round(tempK);
      const roundedC = Math.round(tempC);

      return {
        sensor: "thermal",
        label: "Brightness Temperature",
        primaryValue: roundedK,
        secondaryValue: roundedC,
        unit: "K",
        formatted: `Temp: ${roundedK} K (${roundedC >= 0 ? "+" : ""}${roundedC}°C)`,
        shortFormatted: `${roundedK} K`,
        details: {
          tempK: roundedK,
          tempC: roundedC,
        },
      };
    }

    case "slope":
    default: {
      // Local Topographic Gradient (0.0° to 42.5°)
      const slopeDeg = clampedL * 42.5;
      return {
        sensor: "slope",
        label: "Topographic Gradient",
        primaryValue: Number(slopeDeg.toFixed(1)),
        unit: "°",
        formatted: `Slope: ${slopeDeg.toFixed(1)}°`,
        shortFormatted: `${slopeDeg.toFixed(1)}°`,
        details: {
          slopeDeg: Number(slopeDeg.toFixed(1)),
        },
      };
    }
  }
}

/**
 * Deterministic mathematical fallback calculation for telemetry
 * Prevents NaN or flicker if image is loading, missing, or crossOrigin restricted.
 */
export function getDeterministicFallback(
  normX = 0.5,
  normY = 0.5,
  sensorKey = "optical",
  siteRole = "target",
  targetBody = "Moon"
) {
  const x = Math.max(0, Math.min(1, normX));
  const y = Math.max(0, Math.min(1, normY));
  const isEarth = siteRole === "analog" || siteRole === "earth";

  // Deterministic 2D wave texture
  const waveA = Math.sin(x * 14.5 + y * 9.2);
  const waveB = Math.cos(x * 22.1 - y * 18.4);
  const baseL = isEarth ? 0.48 : 0.38;
  const simL = Math.max(0.05, Math.min(0.95, baseL + waveA * 0.18 + waveB * 0.14 + (x * 0.15 - y * 0.1)));

  const r = Math.round(simL * 255);
  const g = Math.round(Math.max(0, Math.min(255, isEarth ? (simL + 0.05) * 255 : (simL - 0.02) * 255)));
  const b = Math.round(Math.max(0, Math.min(255, isEarth ? (simL - 0.04) * 255 : (simL + 0.03) * 255)));

  // Synthesize 9x9 neighborhood patch around deterministic coordinate
  const patchLuminances = [];
  const hist = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const px = Math.max(0, Math.min(1, x + dx * 0.015));
      const py = Math.max(0, Math.min(1, y + dy * 0.015));
      const pL = Math.max(0.02, Math.min(0.98, simL + Math.sin(px * 35 + py * 28) * 0.08 + (dx + dy) * 0.006));
      patchLuminances.push(pL);

      const bin = Math.min(7, Math.max(0, Math.floor(pL * 8)));
      hist[bin] += 1;
    }
  }

  // Mean & standard deviation
  let sum = 0;
  for (let i = 0; i < patchLuminances.length; i++) sum += patchLuminances[i];
  const mean = sum / patchLuminances.length;

  let varSum = 0;
  for (let i = 0; i < patchLuminances.length; i++) {
    const diff = patchLuminances[i] - mean;
    varSum += diff * diff;
  }
  const variance = varSum / patchLuminances.length;
  const stdDev = Math.sqrt(variance);

  const physicalValue = mapLuminanceToSensor(simL, sensorKey, siteRole, targetBody);

  return {
    isRealPixel: false,
    rgba: [r, g, b, 255],
    rgbString: `rgb(${r}, ${g}, ${b})`,
    hexColor: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
    luminance: Number(simL.toFixed(3)),
    mean: Number(mean.toFixed(3)),
    variance: Number(variance.toFixed(5)),
    stdDev: Number(stdDev.toFixed(4)),
    histogram: hist.map((count) => Number((count / patchLuminances.length).toFixed(3))),
    rawHistogram: hist,
    patchLuminances,
    physicalValue,
  };
}

/**
 * Samples real pixel telemetry and a 9x9 neighborhood patch from cached canvas
 * Automatically degrades gracefully to deterministic simulation on delay or error.
 *
 * @param {string} imageSrc - Image URL
 * @param {number} normX - Normalized horizontal coordinate [0, 1]
 * @param {number} normY - Normalized vertical coordinate [0, 1]
 * @param {string} sensorKey - "optical" | "sar" | "thermal" | "slope"
 * @param {string} siteRole - "target" | "analog" | "moon" | "mars" | "earth"
 * @param {string} [targetBody="Moon"]
 * @returns {object} Real-pixel telemetry data structure
 */
export function samplePixelTelemetry(
  imageSrc,
  normX = 0.5,
  normY = 0.5,
  sensorKey = "optical",
  siteRole = "target",
  targetBody = "Moon"
) {
  const clampedX = Math.max(0, Math.min(1, Number.isFinite(normX) ? normX : 0.5));
  const clampedY = Math.max(0, Math.min(1, Number.isFinite(normY) ? normY : 0.5));

  // Trigger lazy preloading if not yet cached
  if (imageSrc && !canvasCache.has(imageSrc)) {
    preloadCanvasImage(imageSrc);
  }

  const cached = imageSrc ? canvasCache.get(imageSrc) : null;

  if (!cached || cached.status !== "loaded" || !cached.ctx) {
    return getDeterministicFallback(clampedX, clampedY, sensorKey, siteRole, targetBody);
  }

  try {
    const { ctx, width, height } = cached;
    const pxX = Math.floor(clampedX * (width - 1));
    const pxY = Math.floor(clampedY * (height - 1));

    // Sample exact center pixel [R, G, B, A]
    const centerData = ctx.getImageData(pxX, pxY, 1, 1).data;
    const r = centerData[0];
    const g = centerData[1];
    const b = centerData[2];
    const a = centerData[3];
    const centerL = calculateLuminance(r, g, b);

    // Sample 9x9 neighborhood patch centered at (pxX, pxY)
    const patchStartX = Math.max(0, Math.min(width - 9, pxX - 4));
    const patchStartY = Math.max(0, Math.min(height - 9, pxY - 4));
    const patchImageData = ctx.getImageData(patchStartX, patchStartY, 9, 9).data;

    const patchLuminances = [];
    const hist = [0, 0, 0, 0, 0, 0, 0, 0];
    let lumSum = 0;

    const totalPixels = 9 * 9;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const pr = patchImageData[idx];
      const pg = patchImageData[idx + 1];
      const pb = patchImageData[idx + 2];
      const pL = calculateLuminance(pr, pg, pb);

      patchLuminances.push(pL);
      lumSum += pL;

      const bin = Math.min(7, Math.max(0, Math.floor(pL * 8)));
      hist[bin] += 1;
    }

    const mean = lumSum / totalPixels;

    // Standard deviation (micro-roughness)
    let varSum = 0;
    for (let i = 0; i < patchLuminances.length; i++) {
      const diff = patchLuminances[i] - mean;
      varSum += diff * diff;
    }
    const variance = varSum / totalPixels;
    const stdDev = Math.sqrt(variance);

    const physicalValue = mapLuminanceToSensor(centerL, sensorKey, siteRole, targetBody);

    return {
      isRealPixel: true,
      rgba: [r, g, b, a],
      rgbString: `rgb(${r}, ${g}, ${b})`,
      hexColor: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
      luminance: Number(centerL.toFixed(3)),
      mean: Number(mean.toFixed(3)),
      variance: Number(variance.toFixed(5)),
      stdDev: Number(stdDev.toFixed(4)),
      histogram: hist.map((count) => Number((count / totalPixels).toFixed(3))),
      rawHistogram: hist,
      patchLuminances,
      physicalValue,
    };
  } catch (err) {
    // If canvas tainted by CORS or read error, seamlessly fall back
    console.warn("Real-pixel sampling fallback triggered:", err);
    return getDeterministicFallback(clampedX, clampedY, sensorKey, siteRole, targetBody);
  }
}

/**
 * Calculates Pearson Correlation and real-time match percentage between two 9x9 patches
 * @param {number[]} patchA - 81 normalized luminances
 * @param {number[]} patchB - 81 normalized luminances
 * @returns {object} { pearsonR, correlationPercent, covariance }
 */
export function calculatePatchCorrelation(patchA, patchB) {
  if (!patchA || !patchB || patchA.length === 0 || patchB.length === 0) {
    return { pearsonR: 0.85, correlationPercent: 85, covariance: 0.02 };
  }

  const n = Math.min(patchA.length, patchB.length);
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < n; i++) {
    sumA += patchA[i];
    sumB += patchB[i];
  }

  const meanA = sumA / n;
  const meanB = sumB / n;

  let numer = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const da = patchA[i] - meanA;
    const db = patchB[i] - meanB;
    numer += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  let r = 0;

  if (denom > 1e-7) {
    r = Math.max(-1, Math.min(1, numer / denom));
  } else {
    // Patches are nearly flat/uniform: calculate closeness of means
    r = 1 - Math.min(1, Math.abs(meanA - meanB) * 2);
  }

  // Correlation percentage scaled between 0% and 100%
  // Blends Pearson spatial texture correlation and mean photometric proximity
  const spatialScore = ((r + 1) / 2) * 100;
  const proximityScore = Math.max(0, (1 - Math.abs(meanA - meanB)) * 100);
  const blendedScore = Math.max(0, Math.min(100, Math.round(spatialScore * 0.6 + proximityScore * 0.4)));

  return {
    pearsonR: Number(r.toFixed(3)),
    correlationPercent: blendedScore,
    covariance: Number((numer / n).toFixed(5)),
  };
}

/**
 * Computes instantaneous Target-vs-Analog Delta Differential Badge metrics
 * @param {object} targetTelemetry
 * @param {object} analogTelemetry
 * @param {string} sensorKey
 * @returns {object} Differential metrics and visual formatting
 */
export function computeDifferentialBadge(targetTelemetry, analogTelemetry, sensorKey = "optical") {
  if (!targetTelemetry || !analogTelemetry) {
    return {
      matchPercent: 78,
      divergencePercent: 22,
      deltaLuminance: 0.05,
      deltaPhysical: "Δ --",
      status: "BALANCED",
      statusClass: "status-balanced",
    };
  }

  const lumT = targetTelemetry.luminance ?? 0.5;
  const lumA = analogTelemetry.luminance ?? 0.5;
  const deltaL = Math.abs(lumT - lumA);

  const valT = targetTelemetry.physicalValue?.primaryValue ?? 0;
  const valA = analogTelemetry.physicalValue?.primaryValue ?? 0;
  const deltaVal = valT - valA;

  let deltaPhysical = "";
  switch (sensorKey) {
    case "optical":
      deltaPhysical = `Δ ${deltaVal >= 0 ? "+" : ""}${deltaVal.toFixed(3)} A`;
      break;
    case "sar":
      deltaPhysical = `Δ ${deltaVal >= 0 ? "+" : ""}${deltaVal.toFixed(1)} dB`;
      break;
    case "thermal":
      deltaPhysical = `Δ ${deltaVal >= 0 ? "+" : ""}${Math.round(deltaVal)} K`;
      break;
    case "slope":
    default:
      deltaPhysical = `Δ ${deltaVal >= 0 ? "+" : ""}${deltaVal.toFixed(1)}°`;
      break;
  }

  const patchCorr = calculatePatchCorrelation(
    targetTelemetry.patchLuminances,
    analogTelemetry.patchLuminances
  );

  const matchPercent = patchCorr.correlationPercent;
  const divergencePercent = 100 - matchPercent;

  let status = "BALANCED";
  let statusClass = "status-balanced";

  if (matchPercent >= 75) {
    status = "HIGH FIDELITY";
    statusClass = "status-high";
  } else if (matchPercent < 45) {
    status = "DIVERGENT";
    statusClass = "status-divergent";
  }

  return {
    matchPercent,
    divergencePercent,
    deltaLuminance: Number(deltaL.toFixed(3)),
    deltaPhysical,
    status,
    statusClass,
    pearsonR: patchCorr.pearsonR,
  };
}

