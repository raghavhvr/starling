import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from "recharts";

interface InlineBarChartProps {
  headers: string[];
  rows: string[][];
}

function parseNumeric(val: string): number | null {
  const cleaned = val.replace(/[$,%€£¥₹\s]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatValue(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(val % 1 === 0 ? 0 : 1);
}

const GOLD_COLORS = [
  "hsl(38, 60%, 55%)", "hsl(38, 55%, 48%)", "hsl(38, 50%, 42%)", "hsl(38, 45%, 38%)",
  "hsl(38, 40%, 35%)", "hsl(38, 35%, 32%)", "hsl(38, 30%, 30%)", "hsl(38, 25%, 28%)",
];

export function InlineBarChart({ headers, rows }: InlineBarChartProps) {
  const chartData = useMemo(() => {
    if (headers.length < 2 || rows.length === 0) return null;
    let valueColIdx = -1;
    for (let ci = 1; ci < headers.length; ci++) {
      const sample = rows[0]?.[ci];
      if (sample && parseNumeric(sample) !== null) { valueColIdx = ci; break; }
    }
    if (valueColIdx === -1) return null;

    const data = rows
      .map((row) => ({
        name: row[0]?.substring(0, 18) || "",
        value: parseNumeric(row[valueColIdx] || "") ?? 0,
        label: formatValue(parseNumeric(row[valueColIdx] || "") ?? 0),
      }))
      .filter((d) => d.value !== 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    if (data.length < 2) return null;
    const mean = data.reduce((s, d) => s + d.value, 0) / data.length;
    return { data, valueLabel: headers[valueColIdx], mean };
  }, [headers, rows]);

  if (!chartData) return null;

  return (
    <div className="my-3 rounded-lg border border-border/40 p-3 bg-muted/20">
      <p className="text-[0.7rem] text-muted-foreground mb-2 font-medium">
        {chartData.valueLabel} by {headers[0]}
        <span className="ml-2 text-primary/70">— Mean: {formatValue(chartData.mean)}</span>
      </p>
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.data.length * 28)}>
        <BarChart data={chartData.data} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={100} tick={{ fill: "hsl(30, 6%, 60%)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number) => [formatValue(v), chartData.valueLabel]}
            contentStyle={{ background: "hsl(30, 6%, 14%)", border: "1px solid hsl(38, 30%, 30%)", borderRadius: 8, fontSize: 11, color: "#ffffff" }}
            itemStyle={{ color: "#ffffff" }}
            labelStyle={{ color: "#ffffff" }}
          />
          <ReferenceLine x={chartData.mean} stroke="hsl(38, 50%, 55%)" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: "Mean", position: "top", fill: "hsl(38, 50%, 55%)", fontSize: 9 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {chartData.data.map((_, i) => (
              <Cell key={i} fill={GOLD_COLORS[i % GOLD_COLORS.length]} />
            ))}
            <LabelList dataKey="label" position="right" style={{ fill: "hsl(0, 0%, 45%)", fontSize: 9, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
