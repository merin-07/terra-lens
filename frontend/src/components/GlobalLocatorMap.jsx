import { useState, useMemo } from "react";
import { Globe2, Moon, Compass } from "lucide-react";

/**
 * Verified Fallback Catalog for all 2 Planetary Targets & 5 Earth Analogs
 * Sources: NASA PDS, USGS Astrogeology, ESA Copernicus, CSA RADARSAT, JAXA
 */
export const SITES_CATALOG = {
  targets: {
    shackleton: {
      id: "shackleton",
      body: "Moon",
      name: "Shackleton Crater & Connecting Ridge",
      shortName: "Shackleton Crater",
      coordinates: "89.9°S, 0.0°E",
      latitude: -89.9,
      longitude: 0.0,
      elevation: "-4.2 km (floor) to +1.2 km (rim crest)",
      biome: "South Pole-Aitken Basin Rim / Cryogenic Polar PSR",
      distFromEquator: "9,988 km S (Pole Adjacent: 12 km)",
      geologic_setting: "South Pole-Aitken (SPA) volatile trap with permanently shadowed interior cold-traps (<40 K) and high-illumination rim peaks.",
      baseline_profile: { slope: 82, radar_roughness: 76, thermal: 94, geochemical: 70 },
      primary_instrument: "LRO LOLA (Altimetry) / Mini-RF (CPR SAR)",
    },
    jezero: {
      id: "jezero",
      body: "Mars",
      name: "Jezero Crater Margin & Nili Fossae",
      shortName: "Jezero Crater",
      coordinates: "18.38°N, 77.58°E",
      latitude: 18.38,
      longitude: 77.58,
      elevation: "-2.5 km (floor) to -1.8 km (rim crest)",
      biome: "Western Isidis Margin / Ancient Fluvio-Lacustrine Delta",
      distFromEquator: "1,085 km N of Martian Equator",
      geologic_setting: "Ancient Noachian/Hesperian open-basin lake fed by Neretva Vallis, preserving smectite-bearing clay delta scarps.",
      baseline_profile: { slope: 64, radar_roughness: 68, thermal: 72, geochemical: 89 },
      primary_instrument: "MRO HiRISE (0.25m Optical) / SHARAD (Radar)",
    },
  },
  analogs: {
    tablelands: {
      id: "tablelands",
      name: "The Tablelands",
      formal_name: "Tablelands Ultramafic Massif",
      country: "Canada",
      region: "Newfoundland",
      coordinates: "49.46°N, 57.95°W",
      latitude: 49.46,
      longitude: -57.95,
      elevation: "500–700 m a.s.l.",
      climate: "Sub-boreal alpine barrens / oceanic maritime",
      lithology: "Serpentinized mantle peridotite (harzburgite and dunite)",
      distFromEquator: "5,490 km N",
      mission_relevance: "Premier analog for Martian serpentinization, Mg-carbonate formation, and rocky rover mobility.",
      fidelity_scores: { slope: 84, radar_roughness: 68, thermal: 64, geochemical: 81 },
    },
    "harrat-khaybar": {
      id: "harrat-khaybar",
      name: "Harrat Khaybar",
      formal_name: "Harrat Khaybar Volcanic Field",
      country: "Saudi Arabia",
      region: "Al Madinah Province",
      coordinates: "25.68°N, 39.95°E",
      latitude: 25.68,
      longitude: 39.95,
      elevation: "700–2,093 m a.s.l.",
      climate: "Hyper-arid subtropical desert",
      lithology: "Alkali olivine basalt, 'a'a flows, comenditic rhyolite",
      distFromEquator: "2,855 km N",
      mission_relevance: "Key terrestrial analog for lunar maria and Martian flood basalts, lava tubes, and cave ingress.",
      fidelity_scores: { slope: 66, radar_roughness: 89, thermal: 58, geochemical: 76 },
    },
    sredinny: {
      id: "sredinny",
      name: "Tolbachik / Sredinny",
      formal_name: "Tolbachinsky Dol Volcanic Field",
      country: "Russia",
      region: "Kamchatka Peninsula",
      coordinates: "55.83°N, 160.33°E",
      latitude: 55.83,
      longitude: 160.33,
      elevation: "1,200–3,682 m a.s.l.",
      climate: "Sub-polar volcanic tundra / alpine sub-arctic",
      lithology: "High-alumina basaltic scoria, tephra, volcanic bombs",
      distFromEquator: "6,208 km N",
      mission_relevance: "Historical Lunokhod trials testbed; prime analog for low-bearing loose regolith sinkage and shear strength.",
      fidelity_scores: { slope: 78, radar_roughness: 74, thermal: 62, geochemical: 85 },
    },
    tuktoyaktuk: {
      id: "tuktoyaktuk",
      name: "Tuktoyaktuk Pingos",
      formal_name: "Ibyuk & Split Hill Pingo Complex",
      country: "Canada",
      region: "Northwest Territories",
      coordinates: "69.44°N, 133.03°W",
      latitude: 69.44,
      longitude: -133.03,
      elevation: "0–50 m a.s.l.",
      climate: "Continuous arctic permafrost / polar tundra",
      lithology: "Massive segregated pure ground ice cores under silt",
      distFromEquator: "7,720 km N (Arctic Circle: +305 km)",
      mission_relevance: "Leading analog for Martian ground ice extraction, polygonal patterned terrain, and cryo-drilling.",
      fidelity_scores: { slope: 72, radar_roughness: 65, thermal: 88, geochemical: 62 },
    },
    "lut-desert": {
      id: "lut-desert",
      name: "Lut Desert Yardangs",
      formal_name: "Dasht-e Lut Yardang Field ('Kaluts')",
      country: "Iran",
      region: "Kerman & Sistan-Baluchestan",
      coordinates: "30.57°N, 58.38°E",
      latitude: 30.57,
      longitude: 58.38,
      elevation: "116–300 m a.s.l.",
      climate: "Hyper-arid subtropical continental interior",
      lithology: "Indurated clay-siltstone, gypsum evaporites, gravel hamada",
      distFromEquator: "3,398 km N",
      mission_relevance: "Aerodynamic analog for Martian mega-yardang corridors, extreme thermal cycling, and wind abrasion.",
      fidelity_scores: { slope: 70, radar_roughness: 82, thermal: 80, geochemical: 68 },
    },
  },
};

/**
 * Coordinate projection helpers for Earth World Map
 * Projection: Equirectangular / Plate Carree (width 400, height 210)
 * Bounds: [-180, 180] lon, [-90, 90] lat
 */
function projectEarth(lat, lon, width = 400, height = 210) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export default function GlobalLocatorMap({
  activeTargetKey = "shackleton",
  activeAnalogKey = "tablelands",
  onSelectAnalog,
}) {
  const [hoveredSite, setHoveredSite] = useState(null);

  // Normalize target object
  const currentTarget = useMemo(() => {
    return SITES_CATALOG.targets[activeTargetKey] || SITES_CATALOG.targets.shackleton;
  }, [activeTargetKey]);

  // Normalize analog object
  const currentAnalog = useMemo(() => {
    return SITES_CATALOG.analogs[activeAnalogKey] || SITES_CATALOG.analogs.tablelands;
  }, [activeAnalogKey]);

  // Earth map projection parameters
  const mapW = 400;
  const mapH = 210;

  // Compute Earth analog positions
  const projectedAnalogs = useMemo(() => {
    return Object.values(SITES_CATALOG.analogs).map((site) => {
      const { x, y } = projectEarth(site.latitude, site.longitude, mapW, mapH);
      return {
        ...site,
        px: x,
        py: y,
        isActive: site.id === currentAnalog.id,
      };
    });
  }, [currentAnalog.id]);

  const activeProjected = projectedAnalogs.find((a) => a.isActive);

  return (
    <div className="global-locator-container">
      <div className="locator-dual-grid">
        {/* ========================================================
            LEFT PANEL: Planetary Target Locator (Moon or Mars)
            ======================================================== */}
        <div className="locator-card">
          <div className="locator-header">
            <div className="locator-title-badge planetary">
              {currentTarget.body === "Moon" ? <Moon size={14} /> : <Globe2 size={14} />}
              <span>{currentTarget.body.toUpperCase()} TARGET LOCATOR</span>
            </div>
            <span className="locator-coord-badge">{currentTarget.coordinates}</span>
          </div>

          <div className="locator-svg-wrap">
            {currentTarget.body === "Moon" ? (
              /* --- LUNAR SOUTH POLAR ORTHOGRAPHIC MAP (80°S - 90°S) --- */
              <svg viewBox="0 0 240 180" className="locator-svg-canvas">
                {/* Background Space & Outer Polar Boundary */}
                <rect width="240" height="180" fill="#070c14" />

                {/* Outer Polar Disk (80°S Lat boundary) */}
                <circle cx="120" cy="90" r="76" fill="#0d1827" stroke="#1f334a" strokeWidth="1.2" />

                {/* Concentric Latitude Graticules */}
                <circle cx="120" cy="90" r="54" fill="none" stroke="#192b40" strokeWidth="0.8" strokeDasharray="3 3" />
                <circle cx="120" cy="90" r="30" fill="none" stroke="#223954" strokeWidth="0.8" strokeDasharray="2 2" />
                <circle cx="120" cy="90" r="10" fill="none" stroke="#2a4566" strokeWidth="0.9" />

                {/* Meridian Radiating Lines */}
                <line x1="120" y1="14" x2="120" y2="166" stroke="#182a3d" strokeWidth="0.75" />
                <line x1="44" y1="90" x2="196" y2="90" stroke="#182a3d" strokeWidth="0.75" />
                <line x1="66" y1="36" x2="174" y2="144" stroke="#152435" strokeWidth="0.6" strokeDasharray="2 3" />
                <line x1="66" y1="144" x2="174" y2="36" stroke="#152435" strokeWidth="0.6" strokeDasharray="2 3" />

                {/* South Pole-Aitken Basin Rim Arc Shading */}
                <path
                  d="M 50 110 Q 90 145 155 130 Q 185 105 180 60"
                  fill="none"
                  stroke="#1e3650"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.4"
                />

                {/* Neighboring Impact Craters (de Gerlache, Shoemaker, Faustini) */}
                <ellipse cx="88" cy="82" rx="11" ry="9" className="lunar-crater-wall" />
                <text x="88" y="85" fill="#64748b" fontSize="5.5" textAnchor="middle" fontFamily="monospace">de Gerlache</text>

                <ellipse cx="152" cy="74" rx="14" ry="11" className="lunar-crater-wall" />
                <text x="152" y="77" fill="#64748b" fontSize="5.5" textAnchor="middle" fontFamily="monospace">Shoemaker</text>

                <ellipse cx="146" cy="118" rx="12" ry="9" className="lunar-crater-wall" />
                <text x="146" y="121" fill="#64748b" fontSize="5.5" textAnchor="middle" fontFamily="monospace">Faustini</text>

                {/* Connecting Ridge Illumination Peak Arc */}
                <path
                  d="M 112 80 Q 116 86 120 90"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="drop-shadow(0 0 4px #38bdf8)"
                />

                {/* Shackleton Crater (21 km rim) with Permanently Shadowed Interior (PSR) */}
                <circle cx="120" cy="90" r="7.5" className="lunar-psr-shadow" />
                <circle cx="120" cy="90" r="7.5" fill="none" stroke="#22d3ee" strokeWidth="1.2" />

                {/* Pulsing Target Radar Reticle */}
                <circle cx="120" cy="90" r="14" fill="none" stroke="#22d3ee" className="sonar-pulse-ring" />
                <line x1="108" y1="90" x2="114" y2="90" stroke="#22d3ee" strokeWidth="1.2" />
                <line x1="126" y1="90" x2="132" y2="90" stroke="#22d3ee" strokeWidth="1.2" />
                <line x1="120" y1="78" x2="120" y2="84" stroke="#22d3ee" strokeWidth="1.2" />
                <line x1="120" y1="96" x2="120" y2="102" stroke="#22d3ee" strokeWidth="1.2" />

                {/* Tactical Labels */}
                <text x="120" y="104" fill="#38bdf8" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  SHACKLETON (89.9°S)
                </text>
                <text x="120" y="112" fill="#94a3b8" fontSize="5.5" textAnchor="middle" fontFamily="monospace">
                  CONNECTING RIDGE PEAK
                </text>
                <text x="120" y="24" fill="#475569" fontSize="6" textAnchor="middle" fontFamily="monospace">
                  0° MERIDIAN (PRIME)
                </text>
                <text x="120" y="174" fill="#475569" fontSize="6" textAnchor="middle" fontFamily="monospace">
                  180° MERIDIAN
                </text>
              </svg>
            ) : (
              /* --- MARS JEZERO & NILI FOSSAE TOPOGRAPHIC SECTOR --- */
              <svg viewBox="0 0 240 180" className="locator-svg-canvas">
                <rect width="240" height="180" fill="#080b11" />

                {/* Topographic Grid Lines */}
                <line x1="20" y1="40" x2="220" y2="40" className="graticule-line" />
                <line x1="20" y1="80" x2="220" y2="80" className="graticule-line" />
                <line x1="20" y1="120" x2="220" y2="120" className="graticule-line" />
                <line x1="20" y1="160" x2="220" y2="160" className="graticule-line" />

                <line x1="60" y1="10" x2="60" y2="170" className="graticule-line" />
                <line x1="120" y1="10" x2="120" y2="170" className="graticule-line" />
                <line x1="180" y1="10" x2="180" y2="170" className="graticule-line" />

                {/* Isidis Planitia Basin Arc */}
                <path
                  d="M 140 10 Q 210 70 190 160"
                  fill="rgba(15, 23, 42, 0.4)"
                  stroke="#334155"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
                <text x="180" y="90" fill="#475569" fontSize="7" fontFamily="monospace" transform="rotate(45, 180, 90)">
                  ISIDIS BASIN
                </text>

                {/* Syrtis Major Volcanic Shield Base */}
                <ellipse cx="65" cy="130" rx="35" ry="25" fill="rgba(30, 27, 24, 0.5)" stroke="#78350f" strokeWidth="1" />
                <text x="65" y="132" fill="#92400e" fontSize="6" textAnchor="middle" fontFamily="monospace">
                  SYRTIS MAJOR
                </text>

                {/* Nili Fossae Graben Fractures */}
                <path d="M 85 45 Q 98 65 92 88" className="mars-fault-line" />
                <path d="M 94 40 Q 106 60 100 82" className="mars-fault-line" />
                <text x="86" y="38" fill="#d97706" fontSize="6" fontFamily="monospace">
                  NILI FOSSAE
                </text>

                {/* Jezero Crater Rim (45 km) */}
                <circle cx="132" cy="78" r="16" fill="rgba(180, 83, 9, 0.15)" stroke="#f59e0b" strokeWidth="1.2" />

                {/* River Delta Fan & Neretva Vallis Inflow Channel */}
                <path d="M 108 76 Q 118 77 122 78" stroke="#38bdf8" strokeWidth="1.8" fill="none" />
                <path d="M 122 78 L 129 73 L 130 84 Z" className="mars-delta-fan" />

                {/* Target Pulsing Reticle */}
                <circle cx="130" cy="78" r="22" fill="none" stroke="#f59e0b" className="sonar-pulse-ring" />
                <line x1="120" y1="78" x2="124" y2="78" stroke="#f59e0b" strokeWidth="1.5" />
                <line x1="136" y1="78" x2="140" y2="78" stroke="#f59e0b" strokeWidth="1.5" />
                <line x1="130" y1="68" x2="130" y2="72" stroke="#f59e0b" strokeWidth="1.5" />
                <line x1="130" y1="84" x2="130" y2="88" stroke="#f59e0b" strokeWidth="1.5" />

                {/* Tactical Labels */}
                <text x="132" y="102" fill="#fbbf24" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  JEZERO CRATER SCARP
                </text>
                <text x="132" y="110" fill="#94a3b8" fontSize="5.5" textAnchor="middle" fontFamily="monospace">
                  18.38°N, 77.58°E · ELEV -2.5 KM
                </text>
              </svg>
            )}
          </div>
        </div>

        {/* ========================================================
            RIGHT PANEL: Earth Analog World Geolocation Map
            ======================================================== */}
        <div className="locator-card">
          <div className="locator-header">
            <div className="locator-title-badge terrestrial">
              <Compass size={14} />
              <span>EARTH ANALOGS (5 GLOBAL SITES)</span>
            </div>
            <span className="locator-coord-badge">ACTIVE: {currentAnalog.name.toUpperCase()}</span>
          </div>

          <div className="locator-svg-wrap">
            <svg viewBox={`0 0 ${mapW} ${mapH}`} className="locator-svg-canvas">
              {/* Deep Ocean Base */}
              <rect width={mapW} height={mapH} fill="#080e18" />

              {/* Latitude Graticules (30° intervals) */}
              <line x1="0" y1={mapH * 0.166} x2={mapW} y2={mapH * 0.166} className="graticule-line" />
              <line x1="0" y1={mapH * 0.333} x2={mapW} y2={mapH * 0.333} className="graticule-line" />
              <line x1="0" y1={mapH * 0.5} x2={mapW} y2={mapH * 0.5} className="graticule-equator" />
              <line x1="0" y1={mapH * 0.666} x2={mapW} y2={mapH * 0.666} className="graticule-line" />
              <line x1="0" y1={mapH * 0.833} x2={mapW} y2={mapH * 0.833} className="graticule-line" />

              {/* Longitude Graticules (60° intervals) */}
              <line x1={mapW * 0.166} y1="0" x2={mapW * 0.166} y2={mapH} className="graticule-line" />
              <line x1={mapW * 0.333} y1="0" x2={mapW * 0.333} y2={mapH} className="graticule-line" />
              <line x1={mapW * 0.5} y1="0" x2={mapW * 0.5} y2={mapH} className="graticule-equator" />
              <line x1={mapW * 0.666} y1="0" x2={mapW * 0.666} y2={mapH} className="graticule-line" />
              <line x1={mapW * 0.833} y1="0" x2={mapW * 0.833} y2={mapH} className="graticule-line" />

              {/* Stylized Continent Outlines (Equirectangular) */}
              <g className="continents-layer">
                {/* North America & Greenland */}
                <path
                  d="M 38 18 L 65 14 L 92 18 L 84 38 L 108 42 L 138 48 L 132 62 L 105 60 L 98 75 L 85 92 L 68 85 L 55 60 L 32 35 Z"
                  className="continent-path"
                />
                <path
                  d="M 125 10 L 150 8 L 145 28 L 128 32 Z"
                  className="continent-path"
                />

                {/* South America */}
                <path
                  d="M 98 100 L 125 104 L 140 120 L 132 145 L 118 178 L 106 172 L 95 125 Z"
                  className="continent-path"
                />

                {/* Eurasia */}
                <path
                  d="M 188 32 L 235 25 L 305 22 L 350 25 L 382 34 L 375 60 L 350 70 L 305 75 L 265 65 L 245 80 L 215 62 L 185 45 Z"
                  className="continent-path"
                />

                {/* Africa */}
                <path
                  d="M 188 78 L 230 75 L 255 92 L 248 135 L 225 160 L 208 145 L 180 102 Z"
                  className="continent-path"
                />

                {/* Australia */}
                <path
                  d="M 320 120 L 355 122 L 362 148 L 332 152 L 315 138 Z"
                  className="continent-path"
                />

                {/* Antarctica */}
                <path
                  d="M 10 195 L 390 195 L 370 205 L 30 205 Z"
                  className="continent-path"
                />
              </g>

              {/* Equator & Meridian Text */}
              <text x="4" y={mapH * 0.5 - 3} fill="#475569" fontSize="6.5" fontFamily="monospace">
                EQUATOR 0°
              </text>
              <text x={mapW * 0.5 + 4} y="10" fill="#475569" fontSize="6.5" fontFamily="monospace">
                0° PRIME
              </text>

              {/* Inter-Site Connecting Orbital Arc to Active Site */}
              {activeProjected && (
                <path
                  d={`M 15 15 Q ${activeProjected.px * 0.6} ${activeProjected.py * 0.4} ${activeProjected.px} ${activeProjected.py}`}
                  className="orbital-transfer-arc"
                />
              )}

              {/* Plot all 5 Earth Analog Pins */}
              {projectedAnalogs.map((site) => (
                <g
                  key={site.id}
                  className={`site-pin-node ${site.isActive ? "active" : ""}`}
                  transform={`translate(${site.px}, ${site.py})`}
                  onClick={() => onSelectAnalog && onSelectAnalog(site.id)}
                  onMouseEnter={() => setHoveredSite(site)}
                  onMouseLeave={() => setHoveredSite(null)}
                >
                  {/* Active Sonar Rings */}
                  {site.isActive && (
                    <>
                      <circle cx="0" cy="0" r="14" fill="none" stroke="#10b981" className="sonar-pulse-ring" />
                      <circle cx="0" cy="0" r="8" fill="none" stroke="#34d399" strokeWidth="1" strokeDasharray="2 2" />
                      <line x1="-8" y1="0" x2="-3" y2="0" stroke="#10b981" strokeWidth="1.2" />
                      <line x1="3" y1="0" x2="8" y2="0" stroke="#10b981" strokeWidth="1.2" />
                      <line x1="0" y1="-8" x2="0" y2="-3" stroke="#10b981" strokeWidth="1.2" />
                      <line x1="0" y1="3" x2="0" y2="8" stroke="#10b981" strokeWidth="1.2" />
                    </>
                  )}

                  {/* Pin Core */}
                  <circle
                    cx="0"
                    cy="0"
                    r={site.isActive ? "4" : "2.5"}
                    fill={site.isActive ? "#10b981" : "#38bdf8"}
                    stroke="#0b131f"
                    strokeWidth="1.2"
                    style={{ filter: site.isActive ? "drop-shadow(0 0 6px #10b981)" : "none" }}
                  />

                  {/* Label tag */}
                  <text
                    x="6"
                    y="3"
                    fill={site.isActive ? "#34d399" : "#94a3b8"}
                    fontSize={site.isActive ? "7.5" : "6"}
                    fontWeight={site.isActive ? "bold" : "normal"}
                    fontFamily="monospace"
                  >
                    {site.name.split(" ")[0]}
                  </text>
                </g>
              ))}
            </svg>

            {/* Tactical Hover Tooltip */}
            {hoveredSite && (
              <div className="tactical-pin-tooltip">
                <div className="tooltip-top-row">
                  <span className="tooltip-site-name">
                    {hoveredSite.name} ({hoveredSite.country})
                  </span>
                  <span className="tooltip-status-tag">
                    {hoveredSite.isActive ? "SELECTED ANALOG" : "ANALOG SITE"}
                  </span>
                </div>
                <div className="tooltip-sub-row">
                  <div><strong>Coords:</strong> {hoveredSite.coordinates} · <strong>Elev:</strong> {hoveredSite.elevation}</div>
                  <div><strong>Equator Dist:</strong> {hoveredSite.distFromEquator}</div>
                  <div><strong>Lithology:</strong> {hoveredSite.lithology}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}