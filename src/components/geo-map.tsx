"use client";
import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const W = 800;
const H = 380;

interface Point { lat: number; lon: number; messages: number; failRate: number }

// Self-contained SVG world map (d3-geo). Scales to its container; no external map
// component, so nothing escapes the card.
export function GeoMap({ points }: { points: Point[] }) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topo: any) => { if (alive) setGeo(feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const { paths, project } = useMemo(() => {
    if (!geo) return { paths: [] as string[], project: null as null | ((c: [number, number]) => [number, number] | null) };
    const proj = geoNaturalEarth1().fitSize([W, H], geo);
    const pathGen = geoPath(proj);
    return {
      paths: geo.features.map((f) => pathGen(f) || ""),
      project: (c: [number, number]) => proj(c) as [number, number] | null,
    };
  }, [geo]);

  if (!geo || !project) {
    return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading map...</div>;
  }

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Source geography" className="block h-auto">
        <g>
          {paths.map((d, i) => (
            <path key={i} d={d} className="fill-muted stroke-card" strokeWidth={0.5} />
          ))}
        </g>
        <g>
          {points.map((p, i) => {
            const xy = project([p.lon, p.lat]);
            if (!xy) return null;
            const r = Math.min(2.5 + Math.log10(p.messages + 1) * 2.5, 12);
            return (
              <circle key={i} cx={xy[0]} cy={xy[1]} r={r}
                fill={p.failRate > 0.5 ? "#dc2626" : "#16a34a"} fillOpacity={0.65} stroke="#fff" strokeWidth={0.6} />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
