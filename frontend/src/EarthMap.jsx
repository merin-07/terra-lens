
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const analogLocations = {
  "Tablelands, Canada": {
    center: [-57.73, 49.59],
    zoom: 10,
  },
  "Harrat Khaybar, Saudi Arabia": {
    center: [39.9, 25.7],
    zoom: 9,
  },
  "Tolbachik, Kamchatka": {
    center: [160.33, 55.83],
    zoom: 9,
  },
  "Tuktoyaktuk Pingos, Canada": {
    center: [-133.04, 69.44],
    zoom: 10,
  },
  "Lut Desert, Iran": {
    center: [59.0, 29.8],
    zoom: 9,
  },
};

export default function EarthMap({ analog }) {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const marker = useRef(null);

  useEffect(() => {
    const initialLocation =
      analogLocations[analog] || analogLocations["Tablelands, Canada"];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: initialLocation.center,
      zoom: initialLocation.zoom,
    });

    map.addControl(
      new maplibregl.NavigationControl(),
      "top-right"
    );

    const mapMarker = new maplibregl.Marker({
      color: "#76d8c0",
    })
      .setLngLat(initialLocation.center)
      .addTo(map);

    mapInstance.current = map;
    marker.current = mapMarker;

    return () => {
      map.remove();
      mapInstance.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const location =
      analogLocations[analog] || analogLocations["Tablelands, Canada"];

    const map = mapInstance.current;

    if (!map) return;

    map.flyTo({
      center: location.center,
      zoom: location.zoom,
      essential: true,
      duration: 1200,
    });

    marker.current?.setLngLat(location.center);
  }, [analog]);

  return (
    <div className="earth-map-container">
      <div ref={mapContainer} className="earth-map" />

      <div className="map-credit">
        OpenStreetMap · Approximate analog location
      </div>
    </div>
  );
}
