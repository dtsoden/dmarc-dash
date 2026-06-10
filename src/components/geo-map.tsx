"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { Plus, Minus, Maximize2 } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const W = 800;
const H = 380;
const MIN_K = 1;
const MAX_K = 12;

interface Point {
  lat: number; lon: number; messages: number; failRate: number;
  sourceIp: string; pass: number; fail: number; country?: string;
}
const clampK = (k: number) => Math.max(MIN_K, Math.min(MAX_K, k));

export function GeoMap({ points }: { points: Point[] }) {
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<{ p: Point; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(GEO_URL).then((r) => r.json())
      .then((topo: any) => { if (alive) setGeo(feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const { paths, project } = useMemo(() => {
    if (!geo) return { paths: [] as string[], project: null as null | ((c: [number, number]) => [number, number] | null) };
    const proj = geoNaturalEarth1().fitSize([W, H], geo);
    const pathGen = geoPath(proj);
    return { paths: geo.features.map((f) => pathGen(f) || ""), project: (c: [number, number]) => proj(c) as [number, number] | null };
  }, [geo]);

  // Wheel zoom (native, non-passive so we can preventDefault), centered on the cursor.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * W;
      const cy = ((e.clientY - rect.top) / rect.height) * H;
      setT((prev) => {
        const k = clampK(prev.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
        const f = k / prev.k;
        return { k, x: cx - (cx - prev.x) * f, y: cy - (cy - prev.y) * f };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  function svgPt(e: React.PointerEvent | React.MouseEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  }
  function onPointerDown(e: React.PointerEvent) {
    drag.current = { px: e.clientX, py: e.clientY, ox: t.x, oy: t.y };
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - d.px) / rect.width) * W;
    const dy = ((e.clientY - d.py) / rect.height) * H;
    setT((prev) => ({ ...prev, x: d.ox + dx, y: d.oy + dy }));
  }
  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
  }
  function zoomBy(f: number) {
    setT((prev) => { const k = clampK(prev.k * f); const rf = k / prev.k; return { k, x: W / 2 - (W / 2 - prev.x) * rf, y: H / 2 - (H / 2 - prev.y) * rf }; });
  }

  if (!geo || !project) {
    return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading map...</div>;
  }

  const ctrlBtn = "grid size-7 place-items-center rounded-md border border-border bg-card/90 text-muted-foreground backdrop-blur transition-colors hover:text-foreground";

  return (
    <div className="relative w-full overflow-hidden">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Source geography"
        className="block h-auto cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          <g>
            {paths.map((d, i) => (
              <path key={i} d={d} className="fill-muted stroke-card" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <g>
            {points.map((p, i) => {
              const xy = project([p.lon, p.lat]);
              if (!xy) return null;
              const r = Math.min(2.5 + Math.log10(p.messages + 1) * 2.5, 12) / t.k;
              return (
                <circle key={i} cx={xy[0]} cy={xy[1]} r={r}
                  fill={p.failRate > 0.5 ? "#dc2626" : "#16a34a"} fillOpacity={0.7} stroke="#fff" strokeWidth={0.6 / t.k}
                  className="cursor-pointer"
                  onMouseEnter={(e) => { const s = svgPt(e); setHover({ p, x: s.x, y: s.y }); }}
                  onMouseMove={(e) => { const s = svgPt(e); setHover((h) => (h ? { ...h, x: s.x, y: s.y } : { p, x: s.x, y: s.y })); }}
                  onMouseLeave={() => setHover(null)} />
              );
            })}
          </g>
        </g>
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" title="Zoom in" className={ctrlBtn} onClick={() => zoomBy(1.4)}><Plus className="size-4" /></button>
        <button type="button" title="Zoom out" className={ctrlBtn} onClick={() => zoomBy(1 / 1.4)}><Minus className="size-4" /></button>
        <button type="button" title="Reset" className={ctrlBtn} onClick={() => setT({ k: 1, x: 0, y: 0 })}><Maximize2 className="size-3.5" /></button>
      </div>

      {hover && (
        <div className="pointer-events-none absolute z-10 max-w-[220px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(hover.x + 14, W), top: hover.y + 14 }}>
          <div className="font-mono font-medium text-foreground">{hover.p.sourceIp}</div>
          {hover.p.country && <div className="text-muted-foreground">{hover.p.country}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-foreground">{hover.p.messages.toLocaleString()} msgs</span>
            <span className="text-emerald-600 dark:text-emerald-400">{hover.p.pass.toLocaleString()} pass</span>
            <span className="text-red-600 dark:text-red-400">{hover.p.fail.toLocaleString()} fail</span>
          </div>
        </div>
      )}
    </div>
  );
}
