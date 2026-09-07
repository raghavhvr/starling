import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displayBrand } from "@/lib/nestleize";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Sparkles, TrendingUp, DollarSign, Eye, Activity,
  Zap, AlertTriangle, Target, Calendar, Building2, MapPin, User, Hash, Megaphone,
} from "lucide-react";

export interface BQAd {
  brand: string;
  campaign: string;
  ad_name: string;
  market: string;
  date: string;
  spend: number;
  impressions: number;
  views: number;
  engagements: number;
  cpm: number;
  cpv: number;
  cpe: number;
  // derived friendly fields
  short_campaign: string;
  short_ad: string;
  ad_set: string;
}

interface Props {
  creator: {
    id: string;
    name: string;
    handle: string | null;
    country: string | null;
    followers: number | null;
    engagement_rate: number | null;
  };
  searchTerms: string[];
}

// ─── Number formatters (always commas, 2 decimals where it matters) ───
const intFmt = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "0";

const decFmt = (n: number, d = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "0";

const money = (n: number) => `$${decFmt(n, 2)}`;

// Compact axis labels (still readable, 2 decimals)
function axisCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (Math.abs(n) >= 1_000_000) return `${decFmt(n / 1_000_000, 2)}M`;
  if (Math.abs(n) >= 1_000) return `${decFmt(n / 1_000, 2)}K`;
  return decFmt(n, 0);
}
const axisMoney = (n: number) => `$${axisCompact(n)}`;

// ─── Friendly campaign / ad name parsing ───
const NOISE = new Set([
  "na", "sa", "ae", "gcc", "x", "tbd", "wm", "auc", "acst", "ifv", "cta",
  "pros", "cons", "aw", "cpv", "cpm", "vv", "vvc", "video", "views",
  "spa", "ar", "en", "d2c", "shop-now", "learn-more", "more-than-30s",
  "16s-30s", "7s-15s", "15s", "17s", "6s-or-less", "service",
  "ertl", "feed", "skip", "noredirect", "skip_programmatic",
  "even", "no-button", "ifv-na", "none", "tactical", "promotion",
  "video-other", "spark1025-",
]);

function looksLikeId(s: string): boolean {
  return /^(ym\d+|fb\d+|tt\d+|gtt[a-z0-9]+|gfb[a-z0-9]+|gdv[a-z0-9]+|gsc[a-z0-9]+|dv\d+|bo#?\d+|campid-?\d+(-\d+)*)$/i.test(s);
}

function cleanSegment(seg: string): string {
  if (!seg) return "";
  return seg
    .split(/[-|]/)
    .filter((p) => {
      const low = p.toLowerCase();
      if (!low) return false;
      if (NOISE.has(low)) return false;
      if (looksLikeId(low)) return false;
      if (/^\d{4,}$/.test(low)) return false;
      return true;
    })
    .join(" ")
    .trim();
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function prettifyCampaign(code: string, brand: string): string {
  if (!code) return brand || "—";
  const parts = code.split("_");
  // Heuristic: campaign code structure is brand_category_market_<readable>_<rest>
  // Pick segment with the most letters & at least one date hint
  const candidates = parts.slice(2, 7).map(cleanSegment).filter(Boolean);
  const best =
    candidates.find((s) => s.length >= 8 && /[a-z]{4,}/i.test(s)) ||
    candidates[0] ||
    cleanSegment(parts[parts.length - 1]) ||
    "";
  const final = titleCase(best).slice(0, 60).trim();
  return final || titleCase(cleanSegment(parts[0])) || code.slice(0, 40);
}

function prettifyAd(adName: string, creatorFirstName: string): string {
  if (!adName) return "—";
  const parts = adName.split("_");
  // Find the segment that mentions the creator first
  const lower = creatorFirstName.toLowerCase();
  const creatorPart = parts.find((p) => p.toLowerCase().includes(lower));
  const audiencePart = parts[0]; // e.g. coreaudience-Interest-yaraaziz
  const seg = creatorPart || audiencePart;
  return titleCase(cleanSegment(seg)).slice(0, 60) || adName.slice(0, 40);
}

function prettifyAdSet(adName: string): string {
  // Ad set is roughly the second/third segment which describes asset+audience
  const parts = adName.split("_");
  const candidate = [parts[1], parts[2], parts[3]].find(
    (p) => p && !looksLikeId(p) && p.length > 4
  );
  return titleCase(cleanSegment(candidate || "")).slice(0, 50) || "—";
}

export function CreatorHistoryAnalytics({ creator, searchTerms }: Props) {
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<BQAd | null>(null);

  const creatorFirstName = creator.name?.split(" ")[0] || "";

  const { data: ads = [], isLoading } = useQuery<BQAd[]>({
    queryKey: ["bq-ad-lines", creator.id],
    queryFn: async () => {
      if (!searchTerms.length) return [];
      const ors = searchTerms
        .flatMap((t) => [
          `LOWER(Ad_Name) LIKE '%${t}%'`,
          `LOWER(Campaign) LIKE '%${t}%'`,
          `LOWER(Account_Name) LIKE '%${t}%'`,
        ])
        .join(" OR ");
      const query = `
        SELECT
          Brand, Campaign, Ad_Name, Market, Date,
          SUM(Spends) AS spend,
          SUM(Impressions) AS impressions,
          SUM(Video_Views) AS views,
          SUM(Engagements) AS engagements
        FROM \`wavemaker-mena-groupm.Nestle.Nestle_main_media\`
        WHERE (${ors}) AND Spends > 0
        GROUP BY Brand, Campaign, Ad_Name, Market, Date
        ORDER BY Date ASC
        LIMIT 1000
      `;
      const { data, error } = await supabase.functions.invoke("bigquery-query", { body: { query } });
      if (error) throw error;
      return (data.rows || []).map((r: any) => {
        const spend = parseFloat(r.spend) || 0;
        const impressions = parseFloat(r.impressions) || 0;
        const views = parseFloat(r.views) || 0;
        const engagements = parseFloat(r.engagements) || 0;
        return {
          brand: displayBrand(r.Brand),
          campaign: r.Campaign,
          ad_name: r.Ad_Name,
          market: r.Market,
          date: r.Date,
          spend,
          impressions,
          views,
          engagements,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          cpv: views > 0 ? spend / views : 0,
          cpe: engagements > 0 ? spend / engagements : 0,
          short_campaign: prettifyCampaign(r.Campaign, r.Brand),
          short_ad: prettifyAd(r.Ad_Name, creatorFirstName),
          ad_set: prettifyAdSet(r.Ad_Name),
        } as BQAd;
      });
    },
    enabled: !!creator.id && searchTerms.length > 0,
  });

  const totals = useMemo(() => {
    const spend = ads.reduce((s, a) => s + a.spend, 0);
    const impressions = ads.reduce((s, a) => s + a.impressions, 0);
    const views = ads.reduce((s, a) => s + a.views, 0);
    const engagements = ads.reduce((s, a) => s + a.engagements, 0);
    return {
      adCount: ads.length,
      brandCount: new Set(ads.map((a) => a.brand)).size,
      marketCount: new Set(ads.map((a) => a.market)).size,
      spend,
      impressions,
      views,
      engagements,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      cpv: views > 0 ? spend / views : 0,
      cpe: engagements > 0 ? spend / engagements : 0,
    };
  }, [ads]);

  const stats = useMemo(() => {
    if (!ads.length) return null;
    const spends = ads.map((a) => a.spend);
    const cpms = ads.filter((a) => a.cpm > 0).map((a) => a.cpm);
    const cpvs = ads.filter((a) => a.cpv > 0).map((a) => a.cpv);
    const dates = ads.map((a) => a.date).sort();
    const days = dates.length > 1
      ? Math.max(1, Math.round(
          (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000
        ))
      : 1;
    return {
      days,
      spendMin: Math.min(...spends),
      spendMax: Math.max(...spends),
      spendAvg: spends.reduce((a, b) => a + b, 0) / spends.length,
      cpmMin: cpms.length ? Math.min(...cpms) : 0,
      cpmMax: cpms.length ? Math.max(...cpms) : 0,
      cpmAvg: cpms.length ? cpms.reduce((a, b) => a + b, 0) / cpms.length : 0,
      cpvMin: cpvs.length ? Math.min(...cpvs) : 0,
      cpvMax: cpvs.length ? Math.max(...cpvs) : 0,
      cpvAvg: cpvs.length ? cpvs.reduce((a, b) => a + b, 0) / cpvs.length : 0,
      from: dates[0],
      to: dates[dates.length - 1],
    };
  }, [ads]);

  // Time series — bin by month if too many days, else daily
  const timeSeries = useMemo(() => {
    if (!ads.length) return [];
    const useMonthly = stats && stats.days > 90;
    const bin = (d: string) => (useMonthly ? d.slice(0, 7) : d);
    const map = new Map<string, { date: string; spend: number; impressions: number; views: number }>();
    for (const a of ads) {
      const k = bin(a.date);
      const cur = map.get(k) || { date: k, spend: 0, impressions: 0, views: 0 };
      cur.spend += a.spend;
      cur.impressions += a.impressions;
      cur.views += a.views;
      map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [ads, stats]);

  const tiers = useMemo(() => {
    const buckets = [
      { name: "<$50", min: 0, max: 50 },
      { name: "$50–250", min: 50, max: 250 },
      { name: "$250–1K", min: 250, max: 1000 },
      { name: "$1K–5K", min: 1000, max: 5000 },
      { name: "$5K+", min: 5000, max: Infinity },
    ];
    return buckets.map((b) => {
      const inB = ads.filter((a) => a.spend >= b.min && a.spend < b.max);
      const spend = inB.reduce((s, a) => s + a.spend, 0);
      const impressions = inB.reduce((s, a) => s + a.impressions, 0);
      const views = inB.reduce((s, a) => s + a.views, 0);
      return {
        tier: b.name,
        ads: inB.length,
        impPerDollar: spend > 0 ? impressions / spend : 0,
        viewsPerDollar: spend > 0 ? views / spend : 0,
        avgCpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      };
    }).filter((t) => t.ads > 0);
  }, [ads]);

  const brandBreakdown = useMemo(() => {
    const m = new Map<string, { brand: string; spend: number; impressions: number; views: number; ads: number }>();
    for (const a of ads) {
      const cur = m.get(a.brand) || { brand: a.brand, spend: 0, impressions: 0, views: 0, ads: 0 };
      cur.spend += a.spend;
      cur.impressions += a.impressions;
      cur.views += a.views;
      cur.ads += 1;
      m.set(a.brand, cur);
    }
    return [...m.values()].sort((a, b) => b.spend - a.spend);
  }, [ads]);

  const aiPayload = useMemo(() => ({ creator, ads: ads.slice(0, 80), totals }), [creator, ads, totals]);

  const { data: aiInsight, isFetching: aiLoading, refetch: runAi } = useQuery({
    queryKey: ["creator-ai-insight", creator.id, ads.length],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze-creator-history", { body: aiPayload });
      if (error) throw error;
      return data;
    },
    enabled: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
        <span className="font-data text-[10px] text-muted-foreground tracking-wider">
          PULLING SPONSORED POSTS FROM BIGQUERY…
        </span>
      </div>
    );
  }

  if (!ads.length) {
    return (
      <div className="text-center py-12 border border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          No sponsored posts found in BigQuery for{" "}
          <span className="font-data text-foreground">{searchTerms.join(", ")}</span>.
        </p>
      </div>
    );
  }

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    fontSize: 11,
  };

  return (
    <div className="space-y-5">
      {/* Top KPI strip */}
      <div className="grid grid-cols-4 gap-2">
        <Kpi icon={DollarSign} label="MEDIA SPEND" value={money(totals.spend)} accent />
        <Kpi icon={Activity} label="SPONSORED POSTS" value={intFmt(totals.adCount)} />
        <Kpi icon={Eye} label="IMPRESSIONS" value={intFmt(totals.impressions)} />
        <Kpi icon={TrendingUp} label="VIEWS" value={intFmt(totals.views)} />
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="ACTIVE WINDOW" value={`${intFmt(stats.days)} days`} sub={`${stats.from} → ${stats.to}`} />
          <Kpi
            label="COST PER 1K IMPRESSIONS"
            value={money(totals.cpm)}
            sub={`min ${money(stats.cpmMin)} · max ${money(stats.cpmMax)}`}
          />
          <Kpi
            label="COST PER VIEW"
            value={`$${decFmt(totals.cpv, 4)}`}
            sub={`min $${decFmt(stats.cpvMin, 4)} · max $${decFmt(stats.cpvMax, 4)}`}
          />
        </div>
      )}

      {/* Time series */}
      {timeSeries.length > 1 && (
        <ChartFrame title="SPEND & IMPRESSIONS OVER TIME" hint={stats && stats.days > 90 ? "Grouped by month" : "Daily"}>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={timeSeries} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                angle={-35}
                textAnchor="end"
                height={50}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis yAxisId="l" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={axisMoney} width={56} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={axisCompact} width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, n: any) => (n === "Spend" ? money(Number(v)) : intFmt(Number(v)))}
                labelFormatter={(l) => `📅 ${l}`}
              />
              <Line yAxisId="l" type="monotone" dataKey="spend" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} name="Spend" />
              <Line yAxisId="r" type="monotone" dataKey="impressions" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} name="Impressions" />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}

      {/* Spend tier efficiency */}
      {tiers.length > 0 && (
        <ChartFrame title="VALUE PER DOLLAR BY BUDGET TIER" hint="Higher = more impressions earned per $1 spent">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tiers} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} height={28} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={axisCompact} width={52} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => `${decFmt(Number(v), 2)} imp / $`}
              />
              <Bar dataKey="impPerDollar" fill="hsl(var(--primary))" name="Impressions per $1" />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-5 gap-1 mt-2">
            {tiers.map((t) => (
              <div key={t.tier} className="text-center">
                <div className="font-data text-[8px] text-muted-foreground">{t.tier}</div>
                <div className="font-data text-[10px] text-foreground">{intFmt(t.ads)} posts</div>
                <div className="font-data text-[8px] text-muted-foreground">CPM {money(t.avgCpm)}</div>
              </div>
            ))}
          </div>
        </ChartFrame>
      )}

      {/* Spend vs Impressions scatter */}
      {ads.length > 2 && (
        <ChartFrame title="SPEND vs IMPRESSIONS · EACH SPONSORED POST">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="spend"
                name="Spend"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={axisMoney}
                height={28}
                label={{ value: "Spend ($)", position: "insideBottom", offset: -4, fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                type="number"
                dataKey="impressions"
                name="Impressions"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={axisCompact}
                width={56}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={tooltipStyle}
                formatter={(v: any, n: any) => (n === "Spend" ? money(Number(v)) : intFmt(Number(v)))}
              />
              <Scatter data={ads} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}

      {/* Brand breakdown */}
      <div className="space-y-2">
        <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">SPEND BY BRAND</span>
        {brandBreakdown.map((b) => (
          <div key={b.brand} className="border border-border bg-background p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs font-medium text-foreground">{b.brand}</span>
              <span className="font-display text-sm font-bold text-foreground">{money(b.spend)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-data text-[9px] text-muted-foreground">
              <span>{intFmt(b.ads)} sponsored posts</span>
              <span>{intFmt(b.impressions)} impressions</span>
              <span>CPM {b.impressions > 0 ? money((b.spend / b.impressions) * 1000) : "—"}</span>
            </div>
            <div className="w-full h-1 bg-border">
              <div className="h-full bg-primary" style={{ width: `${Math.max(3, (b.spend / brandBreakdown[0].spend) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* AI summary */}
      <div className="border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-data text-[10px] tracking-[0.2em] text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI INFLUENCER READ
          </span>
          <button
            onClick={() => { setAiOpen(true); runAi(); }}
            disabled={aiLoading}
            className="font-data text-[9px] tracking-wider px-3 py-1.5 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            {aiLoading ? "ANALYZING…" : aiInsight ? "REGENERATE" : "GENERATE"}
          </button>
        </div>

        {aiOpen && aiLoading && (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="font-data text-[10px] text-muted-foreground tracking-wider">AI READING THE DATA…</span>
          </div>
        )}

        {aiInsight && !aiLoading && (
          <div className="space-y-3">
            {aiInsight.verdict && (
              <p className="font-ui text-sm text-foreground leading-relaxed border-l-2 border-primary pl-3">
                {aiInsight.verdict}
              </p>
            )}
            {Array.isArray(aiInsight.strengths) && aiInsight.strengths.length > 0 && (
              <AiBlock icon={Zap} label="STRENGTHS" items={aiInsight.strengths} color="text-emerald-400 border-emerald-500/40" />
            )}
            {Array.isArray(aiInsight.watchouts) && aiInsight.watchouts.length > 0 && (
              <AiBlock icon={AlertTriangle} label="WATCH-OUTS" items={aiInsight.watchouts} color="text-amber-400 border-amber-500/40" />
            )}
            {aiInsight.spend_efficiency && (
              <div className="border border-border bg-background p-3">
                <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">SPEND EFFICIENCY</span>
                <p className="font-ui text-xs text-foreground mt-1 leading-relaxed">{aiInsight.spend_efficiency}</p>
              </div>
            )}
            {Array.isArray(aiInsight.best_fit_brands) && aiInsight.best_fit_brands.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">BEST FIT</span>
                {aiInsight.best_fit_brands.map((b: string) => (
                  <span key={b} className="font-data text-[9px] px-2 py-0.5 border border-primary/40 text-primary">{b}</span>
                ))}
              </div>
            )}
            {aiInsight.recommendation && (
              <div className="border border-primary/30 bg-background p-3 flex gap-2">
                <Target className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p className="font-ui text-xs text-foreground leading-relaxed">{aiInsight.recommendation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sponsored Posts list — friendly names, click for details */}
      <div className="space-y-2">
        <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">
          SPONSORED POSTS ({intFmt(ads.length)}) · TOP 20 BY SPEND · CLICK FOR DETAILS
        </span>
        {[...ads].sort((a, b) => b.spend - a.spend).slice(0, 20).map((a, i) => (
          <button
            key={i}
            onClick={() => setSelectedAd(a)}
            className="w-full text-left border border-border bg-background p-3 space-y-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-ui text-xs font-medium text-foreground truncate">
                  {a.short_campaign}
                </div>
                <div className="font-data text-[9px] text-muted-foreground truncate mt-0.5">
                  {a.short_ad}
                </div>
              </div>
              <span className="font-display text-sm font-bold text-foreground whitespace-nowrap">
                {money(a.spend)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 font-data text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><Building2 className="w-2.5 h-2.5" /> {a.brand}</span>
              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {a.market}</span>
              <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {a.date}</span>
              <span className="flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> {intFmt(a.impressions)}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-primary/5 border border-primary/20 p-3 text-center">
        <span className="font-data text-[8px] text-primary tracking-wider">
          BIGQUERY · WAVEMAKER MENA · NESTLE_MAIN_MEDIA · MATCHED ON: {searchTerms.join(", ")}
        </span>
      </div>

      {/* Ad detail dialog */}
      <Dialog open={!!selectedAd} onOpenChange={(open) => !open && setSelectedAd(null)}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold text-foreground leading-snug">
              {selectedAd?.short_campaign}
            </DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="space-y-5 mt-2">
              {/* Influencer confirmation banner */}
              <div className="border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="font-data text-[10px] text-foreground">
                  Influencer match: <span className="text-primary font-medium">{creator.name}</span>
                </span>
                <span className="font-data text-[8px] text-muted-foreground ml-auto">
                  Matched on “{searchTerms.find((t) => selectedAd.ad_name.toLowerCase().includes(t)) || searchTerms[0]}”
                </span>
              </div>

              {/* Naming breakdown */}
              <div className="space-y-2">
                <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">NAMING</span>
                <NamingRow icon={Megaphone} label="CAMPAIGN NAME" pretty={selectedAd.short_campaign} raw={selectedAd.campaign} />
                <NamingRow icon={Hash} label="AD SET" pretty={selectedAd.ad_set} raw={selectedAd.ad_name.split("_").slice(1, 4).join("_")} />
                <NamingRow icon={Activity} label="AD NAME" pretty={selectedAd.short_ad} raw={selectedAd.ad_name} />
              </div>

              {/* Context */}
              <div className="grid grid-cols-3 gap-3">
                <Field icon={Building2} label="BRAND" value={selectedAd.brand} />
                <Field icon={MapPin} label="MARKET" value={selectedAd.market} />
                <Field icon={Calendar} label="DATE" value={selectedAd.date} />
              </div>

              {/* Performance metrics */}
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] block mb-3">PERFORMANCE</span>
                <div className="grid grid-cols-4 gap-2">
                  <Metric label="MEDIA SPEND" value={money(selectedAd.spend)} accent />
                  <Metric label="IMPRESSIONS" value={intFmt(selectedAd.impressions)} />
                  <Metric label="VIDEO VIEWS" value={intFmt(selectedAd.views)} />
                  <Metric label="ENGAGEMENTS" value={intFmt(selectedAd.engagements)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Metric label="COST / 1K IMP" value={selectedAd.cpm > 0 ? money(selectedAd.cpm) : "—"} />
                  <Metric label="COST / VIEW" value={selectedAd.cpv > 0 ? `$${decFmt(selectedAd.cpv, 4)}` : "—"} />
                  <Metric label="COST / ENGAGEMENT" value={selectedAd.cpe > 0 ? money(selectedAd.cpe) : "—"} />
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 p-3 text-center">
                <span className="font-data text-[8px] text-primary tracking-wider">
                  VERIFIED FROM BIGQUERY · WAVEMAKER MENA
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon?: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="border border-border bg-background p-2.5 space-y-1">
      <div className="flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
        <span className="font-data text-[8px] text-muted-foreground tracking-[0.15em]">{label}</span>
      </div>
      <div className={`font-display text-base font-bold tracking-tight ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="font-data text-[8px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChartFrame({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">{title}</span>
        {hint && <span className="font-data text-[8px] text-muted-foreground italic">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function AiBlock({ icon: Icon, label, items, color }: { icon: any; label: string; items: string[]; color: string }) {
  return (
    <div className={`border ${color} bg-background p-3`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3" />
        <span className="font-data text-[9px] tracking-[0.2em]">{label}</span>
      </div>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="font-ui text-xs text-foreground leading-relaxed pl-3 relative">
            <span className="absolute left-0 top-2 w-1 h-1 bg-current rounded-full" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NamingRow({ icon: Icon, label, pretty, raw }: { icon: any; label: string; pretty: string; raw: string }) {
  return (
    <div className="border border-border bg-background p-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="font-data text-[8px] text-muted-foreground tracking-[0.15em]">{label}</span>
      </div>
      <p className="font-ui text-sm text-foreground">{pretty}</p>
      <p className="font-data text-[9px] text-muted-foreground break-all leading-snug">{raw}</p>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-data text-[9px] text-muted-foreground tracking-wider">{label}</span>
      </div>
      <p className="font-ui text-sm text-foreground">{value}</p>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border bg-background p-2.5 space-y-1">
      <span className="font-data text-[8px] text-muted-foreground tracking-wider block">{label}</span>
      <div className={`font-display text-base font-bold ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
