"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export function VolumeChart({ data }: { data: { day: string; pass: number; fail: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="day" fontSize={12} /><YAxis fontSize={12} />
          <Tooltip /><Legend />
          <Bar dataKey="pass" stackId="a" fill="#16a34a" name="DMARC pass" />
          <Bar dataKey="fail" stackId="a" fill="#dc2626" name="DMARC fail" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
