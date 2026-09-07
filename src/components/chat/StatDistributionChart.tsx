interface StatDistributionChartProps {
  headers: string[];
  rows: string[][];
}

export function isStatTable(headers: string[]): boolean {
  const lower = headers.map((h) => h.toLowerCase());
  const statKeywords = ["min", "max", "mean", "median", "q1", "q3", "avg", "average"];
  const matches = statKeywords.filter((kw) => lower.some((h) => h.includes(kw)));
  return matches.length >= 2;
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/[$,%]/g, "").replace(/,/g, "")) || 0;
}

function formatVal(n: number, hasPercent: boolean, hasDollar: boolean): string {
  if (hasPercent) return `${n.toFixed(2)}%`;
  if (hasDollar) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

interface MetricStats {
  name: string; min?: number; q1?: number; median?: number; q3?: number; max?: number; mean?: number;
  hasDollar: boolean; hasPercent: boolean;
}

function RangeTrack({ stat }: { stat: MetricStats }) {
  const fmt = (n: number) => formatVal(n, stat.hasPercent, stat.hasDollar);
  const allVals = [stat.min, stat.q1, stat.median, stat.q3, stat.max, stat.mean].filter((v): v is number => v != null);
  if (allVals.length === 0) return null;

  const lo = Math.min(...allVals);
  const hi = Math.max(...allVals);
  const range = hi - lo || 1;
  const pct = (v: number) => hi === lo ? 50 : ((v - lo) / range) * 100;

  const markers: { value: number; label: string; tag: string; accentClass: string }[] = [];
  if (stat.min != null) markers.push({ value: stat.min, label: fmt(stat.min), tag: "Min", accentClass: "text-muted-foreground" });
  if (stat.q1 != null) markers.push({ value: stat.q1, label: fmt(stat.q1), tag: "Q1", accentClass: "text-primary" });
  if (stat.median != null) markers.push({ value: stat.median, label: fmt(stat.median), tag: "Median", accentClass: "text-primary" });
  if (stat.mean != null) markers.push({ value: stat.mean, label: fmt(stat.mean), tag: "Mean", accentClass: "text-accent" });
  if (stat.q3 != null) markers.push({ value: stat.q3, label: fmt(stat.q3), tag: "Q3", accentClass: "text-primary" });
  if (stat.max != null) markers.push({ value: stat.max, label: fmt(stat.max), tag: "Max", accentClass: "text-muted-foreground" });

  const hasIQR = stat.q1 != null && stat.q3 != null;
  const iqrLeft = hasIQR ? pct(stat.q1!) : 0;
  const iqrWidth = hasIQR ? pct(stat.q3!) - pct(stat.q1!) : 0;

  return (
    <div className="mt-3 mb-1">
      <div className="relative h-10">
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border/50 -translate-y-1/2 rounded-full" />
        {hasIQR && (
          <div className="absolute top-1/2 -translate-y-1/2 rounded-md border border-primary/40 bg-primary/10"
            style={{ left: `${iqrLeft}%`, width: `${Math.max(iqrWidth, 1)}%`, height: "20px" }} />
        )}
        {stat.median != null && (
          <div className="absolute top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-primary" style={{ left: `${pct(stat.median)}%`, height: "24px" }} />
        )}
        {stat.mean != null && (
          <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pct(stat.mean)}%` }}>
            <div className="h-2.5 w-2.5 rounded-[1px] bg-accent rotate-45 -translate-x-1/2" />
          </div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {markers.map((m) => (
          <div key={m.tag} className="text-center">
            <span className={`block text-[9px] font-bold uppercase tracking-wider ${m.accentClass}`}>{m.tag}</span>
            <span className="block text-xs font-semibold text-foreground">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseMetrics(headers: string[], rows: string[][]): MetricStats[] {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const metricColIdx = lowerHeaders.findIndex((h) => h.includes("metric") || h.includes("measure") || h === "stat");
  const minIdx = lowerHeaders.findIndex((h) => h.includes("min"));
  const q1Idx = lowerHeaders.findIndex((h) => h.includes("q1") || h.includes("25"));
  const medianIdx = lowerHeaders.findIndex((h) => h.includes("median") || h.includes("q2"));
  const q3Idx = lowerHeaders.findIndex((h) => h.includes("q3") || h.includes("75"));
  const maxIdx = lowerHeaders.findIndex((h) => h.includes("max"));
  const meanIdx = lowerHeaders.findIndex((h) => h.includes("mean") || h.includes("avg"));

  if (metricColIdx >= 0 && (minIdx >= 0 || maxIdx >= 0 || meanIdx >= 0)) {
    return rows.map((row) => {
      const rawVal = row[minIdx >= 0 ? minIdx : maxIdx >= 0 ? maxIdx : meanIdx] || "";
      return {
        name: row[metricColIdx] || "Metric",
        min: minIdx >= 0 ? parseNum(row[minIdx]) : undefined,
        q1: q1Idx >= 0 ? parseNum(row[q1Idx]) : undefined,
        median: medianIdx >= 0 ? parseNum(row[medianIdx]) : undefined,
        q3: q3Idx >= 0 ? parseNum(row[q3Idx]) : undefined,
        max: maxIdx >= 0 ? parseNum(row[maxIdx]) : undefined,
        mean: meanIdx >= 0 ? parseNum(row[meanIdx]) : undefined,
        hasDollar: rawVal.includes("$"),
        hasPercent: rawVal.includes("%"),
      };
    });
  }

  return [];
}

export function StatDistributionChart({ headers, rows }: StatDistributionChartProps) {
  const metrics = parseMetrics(headers, rows);
  if (metrics.length === 0) return null;

  return (
    <div className="space-y-3 my-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Statistical Distribution</span>
      </div>
      {metrics.map((stat, i) => (
        <div key={i} className="rounded-xl border border-border/20 bg-card p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stat.name}</h4>
          <RangeTrack stat={stat} />
        </div>
      ))}
    </div>
  );
}
