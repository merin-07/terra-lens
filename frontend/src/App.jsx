import EarthMap from "./EarthMap";
import { useState } from "react";
import analogData from "./data/analogs_data.json";
import {
  Globe2,
  Moon,
  Mountain,
  Satellite,
  SlidersHorizontal,
  Search,
  Layers3,
  Activity,
} from "lucide-react";
import "./App.css";

function App() {
  const [target, setTarget] = useState("Moon");
  const [site, setSite] = useState("Shackleton Crater");
  const [analog, setAnalog] = useState("Tablelands, Canada");
  const [sensor, setSensor] = useState("Optical");

  const sensorKey = {
    Optical: "optical",
    SAR: "sar",
    Thermal: "thermal",
    "Topography / Slope": "topography",
  }[sensor];

  const analogIds = {
    "Tablelands, Canada": "tablelands",
    "Harrat Khaybar, Saudi Arabia": "harrat_khaybar",
    "Tolbachik, Kamchatka": "tolbachik",
    "Tuktoyaktuk Pingos, Canada": "tuktoyaktuk",
    "Lut Desert, Iran": "lut_desert",
  };

  const selectedTarget = analogData.planetary_targets.find(
    (item) => item.id === target.toLowerCase()
  );

  const selectedAnalog = analogData.earth_analogs.find(
    (item) => item.id === analogIds[analog]
  );

  const planetaryLayer = selectedTarget?.layers[sensorKey];
  const earthLayer = selectedAnalog?.layers[sensorKey];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Globe2 size={27} />
          <div>
            <h2>TERRA-LENS</h2>
            <span>PLANETARY ANALOG LAB</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <div className="nav-item active"><Layers3 size={18} /> Discovery</div>
        <div className="nav-item"><Satellite size={18} /> Data Explorer</div>
        <div className="nav-item"><Activity size={18} /> Diagnostics</div>
        <div className="nav-item"><SlidersHorizontal size={18} /> Mission Weights</div>

        <div className="sidebar-bottom">
          <span className="status-dot" />
          SYSTEM ONLINE
          <p>Prototype v0.1</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">PLANETARY SCIENCE / ANALOG DISCOVERY</span>
            <h1>Discovery Workbench</h1>
          </div>
          <div className="top-status">● DATA WORKSPACE</div>
        </header>

        <section className="intro">
          <div>
            <h2>Find Earth's planetary twins.</h2>
            <p>
              Compare planetary terrain with terrestrial analog environments
              using multi-spectral satellite observations.
            </p>
          </div>
          <div className="intro-icon"><Satellite size={38} /></div>
        </section>

        <section className="selection-grid">
          <div className="panel">
            <div className="panel-heading">
              <Moon size={19} />
              <span>PLANETARY TARGET</span>
            </div>

            <label>Target body</label>
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setSite(
                  e.target.value === "Moon"
                    ? "Shackleton Crater"
                    : "Jezero Crater Margin"
                );
              }}
            >
              <option>Moon</option>
              <option>Mars</option>
            </select>

            <label>Target location</label>
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              {target === "Moon" ? (
                <>
                  <option>Shackleton Crater</option>
                  <option>Connecting Ridge</option>
                </>
              ) : (
                <>
                  <option>Jezero Crater Margin</option>
                  <option>Nili Fossae</option>
                </>
              )}
            </select>

            <div className="selection-info">
              <span>SELECTED TARGET</span>
              <strong>{site}</strong>
              <small>{target} · Planetary dataset</small>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <Mountain size={19} />
              <span>EARTH ANALOG SITE</span>
            </div>

            <label>Analog environment</label>
            <select value={analog} onChange={(e) => setAnalog(e.target.value)}>
              <option>Tablelands, Canada</option>
              <option>Harrat Khaybar, Saudi Arabia</option>
              <option>Tolbachik, Kamchatka</option>
              <option>Tuktoyaktuk Pingos, Canada</option>
              <option>Lut Desert, Iran</option>
            </select>

            <div className="selection-info">
              <span>SELECTED ANALOG</span>
              <strong>{analog}</strong>
              <small>Earth · Terrestrial dataset</small>
            </div>
          </div>
        </section>

        <section className="comparison">
          <div className="section-heading">
            <div>
              <h2>Terrain comparison</h2>
              <p>Side-by-side planetary and terrestrial analysis</p>
            </div>

            <button
              className="compare-button"
              onClick={() =>
                alert(`Target: ${site}\nEarth analog: ${analog}`)
              }
            >
              <Search size={16} /> Compare sites
            </button>
          </div>

          <div className="sensor-toolbar">
            <div className="sensor-heading">
              <Layers3 size={18} />
              <span>SENSOR VISOR</span>
            </div>

            <div className="sensor-buttons">
              {["Optical", "SAR", "Thermal", "Topography / Slope"].map((layer) => (
                <button
                  key={layer}
                  className={sensor === layer ? "sensor-button active" : "sensor-button"}
                  onClick={() => setSensor(layer)}
                >
                  {layer}
                </button>
              ))}
            </div>

            <p>Active layer: <strong>{sensor}</strong></p>
          </div>

          <div className="layer-info">
            <div>
              <span>PLANETARY DATA SOURCE</span>
              <strong>{planetaryLayer?.source || "Source unavailable"}</strong>
            </div>

            <div>
              <span>EARTH DATA SOURCE</span>
              <strong>{earthLayer?.source || "Source unavailable"}</strong>
            </div>

            <div>
              <span>LAYER STATUS</span>
              <strong>
                {earthLayer?.asset ? "IMAGE AVAILABLE" : "AWAITING IMAGE DATA"}
              </strong>
            </div>
          </div>

          <div className="map-grid">
            <div className="map-panel">
              <div className="map-label">
                <span>PLANETARY TARGET</span>
                <strong>{site}</strong>
              </div>

              <div className="map-placeholder lunar">
                <Moon size={54} />
                <span>{target.toUpperCase()} TERRAIN</span>
                <small>Planetary imagery will appear here</small>
              </div>
            </div>

            <div className="map-panel">
              <div className="map-label">
                <span>EARTH ANALOG</span>
                <strong>{analog}</strong>
              </div>

              <EarthMap analog={analog} />
            </div>
          </div>
        </section>

        <footer>
          TERRA-LENS · Planetary Analog Discovery Workbench
          <span>DEVELOPMENT BUILD 0.1</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
