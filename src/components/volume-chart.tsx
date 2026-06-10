"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export function VolumeChart({ data }: { data: { day: string; pass: number; fail: number }[] }) {
  // Only render the chart on the client, after mount, so ResponsiveContainer measures a
  // real container size (avoids the Recharts "width(-1) height(-1)" warning on SSR/hydration).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="h-72 w-full">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" strokeOpacity={0.5} />
            <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} className="text-muted-foreground" />
            <Tooltip
              cursor={{ fill: "currentColor", opacity: 0.06 }}
              contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="pass" stackId="a" fill="var(--chart-1)" name="DMARC pass" radius={[0, 0, 0, 0]} />
            <Bar dataKey="fail" stackId="a" fill="#dc2626" name="DMARC fail" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
