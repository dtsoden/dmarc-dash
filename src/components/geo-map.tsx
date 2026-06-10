"use client";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function GeoMap({ points }: { points: { lat: number; lon: number; messages: number; failRate: number }[] }) {
  return (
    <div className="h-96 w-full">
      <ComposableMap projectionConfig={{ scale: 140 }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) => geographies.map((geo) => (
            <Geography key={geo.rsmKey} geography={geo} fill="#e5e7eb" stroke="#fff" strokeWidth={0.3} />
          ))}
        </Geographies>
        {points.map((p, i) => (
          <Marker key={i} coordinates={[p.lon, p.lat]}>
            <circle r={Math.min(3 + Math.log10(p.messages + 1) * 3, 14)}
              fill={p.failRate > 0.5 ? "#dc2626" : "#16a34a"} fillOpacity={0.6} stroke="#fff" strokeWidth={0.5} />
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
