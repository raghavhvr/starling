import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

type Video = {
  publish_date?: string;
  views?: number;
  type?: string;
};

const RANGES = [
  { key: "5D", days: 5 },
  { key: "1W", days: 7 },
  { key: "2W", days: 14 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "1Y", days: 365 },
  { key: "MAX", days: 0 },
] as const;

const PLATFORMS = [
  { key: "all", label: "ALL" },
  { key: "tiktok", label: "TIKTOK" },
  { key: "youtube_short", label: "SHORTS" },
  { key: "instagram", label: "REELS" },
] as const;

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export function ViewsOverTimeChart({ videos }: { videos: Video[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1M");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["key"]>("all");

  const { series, totals } = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const cutoff = days ? Date.now() - days * 86_400_000 : 0;
    const filtered = videos.filter((v) => {
      if (!v.publish_date) return false;
      const t = new Date(v.publish_date).getTime();
      if (cutoff && t < cutoff) return false;
      if (platform !== "all" && v.type !== platform) return false;
      return true;
    });

    const byDay = new Map<string, { day: string; tiktok: number; youtube_short: number; instagram: number }>();
    for (const v of filtered) {
      const d = new Date(v.publish_date!).toISOString().slice(0, 10);
      if (!byDay.has(d)) byDay.set(d, { day: d, tiktok: 0, youtube_short: 0, instagram: 0 });
      const row = byDay.get(d)!;
      const k = (v.type ?? "tiktok") as "tiktok" | "youtube_short" | "instagram";
      if (k in row) (row as any)[k] += v.views ?? 0;
    }
    const series = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    const total = filtered.reduce((s, v) => s + (v.views ?? 0), 0);
    const peak = series.reduce((m, r) => Math.max(m, r.tiktok + r.youtube_short + r.instagram), 0);
    const avg = series.length ? Math.round(total / series.length) : 0;
    return { series, totals: { total, peak, avg } };
  }, [videos, range, platform]);

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="font-display text-2xl">Views Over Time</h2>
        </div>
        <div className="flex gap-1 flex-wrap">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`font-data text-[10px] tracking-wider px-2.5 py-1 border ${
                platform === p.key ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 font-data text-[10px] tracking-wider">
        <span className="text-muted-foreground">TOTAL VIEWS · <span className="text-foreground">{fmt(totals.total)}</span></span>
        <span className="text-muted-foreground">AVG DAILY · <span className="text-foreground">{fmt(totals.avg)}</span></span>
        <span className="text-muted-foreground">PEAK DAY · <span className="text-foreground">{fmt(totals.peak)}</span></span>
      </div>

      <div className="flex gap-1 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`font-data text-[10px] tracking-wider px-2.5 py-1 border ${
              range === r.key ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.key}
          </button>
        ))}
      </div>

      <div className="h-72 w-full">
        {series.length === 0 ? (
          <div className="h-full flex items-center justify-center font-ui text-xs text-muted-foreground border border-dashed border-border">
            No data in selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ttFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ytFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="igFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short" })} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={fmt} width={50} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontFamily: "inherit", fontSize: 11 }}
                formatter={(v: any) => fmt(Number(v))}
                labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "inherit", letterSpacing: "0.05em" }} />
              <Area type="monotone" dataKey="tiktok" name="TikTok" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#ttFill)" />
              <Area type="monotone" dataKey="youtube_short" name="Shorts" stroke="#ef4444" strokeWidth={2} fill="url(#ytFill)" />
              <Area type="monotone" dataKey="instagram" name="Reels" stroke="#ec4899" strokeWidth={2} fill="url(#igFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
