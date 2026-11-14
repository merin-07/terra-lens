"""
TERRA-LENS: Planetary Analog Workbench - Layer Preparation & Metrics Script
Fast, high-performance generation of 800x800 scientific raster preview images across Optical, SAR, Thermal, and Slope sensors
for Moon, Mars, and all 5 Earth analog sites. Computes histogram and cross-correlation metrics.
Works in pure Python standard library (zlib, struct, math, random).
"""

import os
import math
import json
import zlib
import struct
import random
from pathlib import Path

# Paths
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_DATA = WORKSPACE_ROOT / "frontend" / "public" / "data"

TARGET_SITES = {
    "moon": ["shackleton"],
    "mars": ["jezero"]
}

EARTH_ANALOG_SITES = [
    "tablelands",
    "harrat-khaybar",
    "sredinny",
    "tuktoyaktuk",
    "lut-desert"
]

LAYERS = ["optical", "sar", "thermal", "slope"]
WIDTH, HEIGHT = 800, 800


def write_png(filepath, width, height, rgb_pixels):
    """Write an RGB PNG using standard library zlib + struct."""
    png = bytearray(b"\x89PNG\r\n\x1a\n")

    def make_chunk(chunk_type, data):
        chunk = bytearray()
        chunk.extend(struct.pack(">I", len(data)))
        chunk.extend(chunk_type)
        chunk.extend(data)
        crc = zlib.crc32(chunk_type + data)
        chunk.extend(struct.pack(">I", crc))
        return chunk

    # IHDR chunk
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png.extend(make_chunk(b"IHDR", ihdr_data))

    # Raw scanlines with filter type 0
    raw_data = bytearray()
    row_bytes = width * 3
    for y in range(height):
        raw_data.append(0)
        start = y * row_bytes
        raw_data.extend(rgb_pixels[start:start + row_bytes])

    compressed = zlib.compress(bytes(raw_data), level=5)
    png.extend(make_chunk(b"IDAT", compressed))
    png.extend(make_chunk(b"IEND", b""))

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(png)


def generate_procedural_pixels(body_type, site_id, layer_type, width=WIDTH, height=HEIGHT):
    """High-speed separable harmonic generator for 800x800 scientific rasters."""
    seed = abs(hash(f"{body_type}_{site_id}_{layer_type}")) % 100000
    rng = random.Random(seed)

    fx1 = 0.008 + (seed % 7) * 0.002
    fy1 = 0.009 + (seed % 5) * 0.002
    fx2 = fx1 * 2.3
    fy2 = fy1 * 2.1

    # Precompute 1D coordinate harmonics
    sin_x1 = [math.sin(x * fx1) for x in range(width)]
    sin_x2 = [math.sin(x * fx2 + 1.2) for x in range(width)]
    cos_y1 = [math.cos(y * fy1) for y in range(height)]
    cos_y2 = [math.cos(y * fy2 + 0.8) for y in range(height)]

    # Center coords for crater or caldera relief
    cx = width * 0.48
    cy = height * 0.50
    radius_crater = width * 0.35

    pixels = bytearray(width * height * 3)
    idx = 0

    # Build RGB palette LUT (256 values) for the layer
    palette = []
    for i in range(256):
        n = i / 255.0
        if layer_type == "optical":
            if body_type == "moon":
                v = int(n * 220)
                r, g, b = v, v, v
            elif body_type == "mars":
                r = int(min(255, 160 + n * 90))
                g = int(min(255, 75 + n * 55))
                b = int(min(255, 40 + n * 40))
            else:
                if site_id == "tablelands":
                    r = int(min(255, 175 + n * 65))
                    g = int(min(255, 120 + n * 50))
                    b = int(min(255, 70 + n * 40))
                elif site_id == "harrat-khaybar":
                    v = int(min(255, 40 + n * 55))
                    r, g, b = v, v - 2, v - 4
                elif site_id == "sredinny":
                    v = int(min(255, 48 + n * 50))
                    r, g, b = v + 4, v, v
                elif site_id == "tuktoyaktuk":
                    r = int(min(255, 95 + n * 60))
                    g = int(min(255, 125 + n * 55))
                    b = int(min(255, 90 + n * 45))
                else:
                    r = int(min(255, 205 + n * 45))
                    g = int(min(255, 150 + n * 40))
                    b = int(min(255, 90 + n * 35))

        elif layer_type == "sar":
            v = int(n * 235)
            r, g, b = v, min(255, int(v * 1.05)), min(255, int(v * 1.15))

        elif layer_type == "thermal":
            if n < 0.25:
                f = n / 0.25
                r, g, b = int(10 + f * 50), int(5 + f * 10), int(35 + f * 60)
            elif n < 0.55:
                f = (n - 0.25) / 0.30
                r, g, b = int(60 + f * 140), int(15 + f * 45), int(95 - f * 55)
            elif n < 0.85:
                f = (n - 0.55) / 0.30
                r, g, b = int(200 + f * 45), int(60 + f * 135), int(40 - f * 20)
            else:
                f = (n - 0.85) / 0.15
                r, g, b = int(245 + f * 10), int(195 + f * 55), int(20 + f * 180)

        else: # slope
            if n < 0.3:
                f = n / 0.3
                r, g, b = int(20 + f * 25), int(70 + f * 85), int(130 - f * 30)
            elif n < 0.65:
                f = (n - 0.3) / 0.35
                r, g, b = int(45 + f * 160), int(155 - f * 30), int(100 - f * 60)
            else:
                f = (n - 0.65) / 0.35
                r, g, b = int(205 + f * 45), int(125 - f * 80), int(40 + f * 120)

        palette.append((max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b))))

    # Fill pixels using separable formula
    for y in range(height):
        cy1 = cos_y1[y]
        cy2 = cos_y2[y]
        dy = y - cy
        dy2 = dy * dy

        for x in range(width):
            h_val = (sin_x1[x] * cy1 * 0.5 + 0.5) + (sin_x2[x] * cy2 * 0.25)
            # Crater rim bump for lunar / volcanic
            if body_type == "moon" and layer_type == "optical":
                dx = x - cx
                dist = math.sqrt(dx * dx + dy2)
                rim = math.exp(-((dist - radius_crater) ** 2) / 6000.0)
                h_val += rim * 0.35

            lut_idx = int(max(0.0, min(1.0, h_val)) * 255.0)
            r, g, b = palette[lut_idx]

            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
            idx += 3

    return pixels


def compute_metrics(pixels_a, pixels_b):
    """Compute histogram mean, standard deviation, and cross-correlation similarity."""
    count = len(pixels_a) // 3
    sum_a = sum_b = 0.0
    sum_sq_a = sum_sq_b = 0.0
    sum_ab = 0.0

    step = max(1, count // 1500)
    samples = 0

    for i in range(0, len(pixels_a), step * 3):
        lum_a = (0.299 * pixels_a[i] + 0.587 * pixels_a[i+1] + 0.114 * pixels_a[i+2]) / 255.0
        lum_b = (0.299 * pixels_b[i] + 0.587 * pixels_b[i+1] + 0.114 * pixels_b[i+2]) / 255.0
        sum_a += lum_a
        sum_b += lum_b
        sum_sq_a += lum_a * lum_a
        sum_sq_b += lum_b * lum_b
        sum_ab += lum_a * lum_b
        samples += 1

    mu_a = sum_a / samples
    mu_b = sum_b / samples
    var_a = (sum_sq_a / samples) - (mu_a * mu_a)
    var_b = (sum_sq_b / samples) - (mu_b * mu_b)
    std_a = math.sqrt(max(0.0, var_a))
    std_b = math.sqrt(max(0.0, var_b))

    denom = std_a * std_b
    corr = ((sum_ab / samples) - (mu_a * mu_b)) / denom if denom > 1e-7 else 0.5

    return {
        "target_mean": round(mu_a, 4),
        "analog_mean": round(mu_b, 4),
        "target_std": round(std_a, 4),
        "analog_std": round(std_b, 4),
        "structural_correlation": round(max(-1.0, min(1.0, corr)), 4)
    }


def prepare_all_layers():
    """Generates preview.png for all layers and computes metrics."""
    os.makedirs(PUBLIC_DATA, exist_ok=True)
    generated_count = 0
    target_cache = {}
    analog_cache = {}

    print("Generating Planetary Target Layers (800x800)...")
    for body, sites in TARGET_SITES.items():
        for site in sites:
            target_cache[site] = {}
            for layer in LAYERS:
                layer_dir = PUBLIC_DATA / body / site / layer
                dest_file = layer_dir / "preview.png"

                preserved_file = layer_dir / "shackleton_preview_cropped.png"
                if body == "moon" and site == "shackleton" and layer == "optical" and preserved_file.exists():
                    if not dest_file.exists():
                        import shutil
                        shutil.copy2(preserved_file, dest_file)
                    with open(dest_file, "rb") as f:
                        target_cache[site][layer] = bytearray(f.read())
                    generated_count += 1
                    continue

                px = generate_procedural_pixels(body, site, layer)
                write_png(dest_file, WIDTH, HEIGHT, px)
                target_cache[site][layer] = px
                generated_count += 1

    print("Generating Earth Analog Layers (800x800)...")
    for analog in EARTH_ANALOG_SITES:
        analog_cache[analog] = {}
        for layer in LAYERS:
            layer_dir = PUBLIC_DATA / "earth" / analog / layer
            dest_file = layer_dir / "preview.png"
            px = generate_procedural_pixels("earth", analog, layer)
            write_png(dest_file, WIDTH, HEIGHT, px)
            analog_cache[analog][layer] = px
            generated_count += 1

    print("Computing Cross-Sensor Quantitative Metrics & Histograms...")
    metrics_summary = {}
    for target_id in ["shackleton", "jezero"]:
        metrics_summary[target_id] = {}
        for analog_id in EARTH_ANALOG_SITES:
            metrics_summary[target_id][analog_id] = {}
            for layer in LAYERS:
                t_px = target_cache[target_id][layer]
                a_px = analog_cache[analog_id][layer]
                metrics = compute_metrics(t_px, a_px)
                metrics_summary[target_id][analog_id][layer] = metrics

    summary_file = WORKSPACE_ROOT / "backend" / "data" / "layer_metrics_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)

    print(f"Successfully generated {generated_count} raster preview layers across 4 sensors.")
    print(f"Metrics saved to {summary_file}")
    return metrics_summary


if __name__ == "__main__":
    prepare_all_layers()
