import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NESTLE_CLUSTERS, nestleizeAll } from "@/lib/nestleize";
import { useFilters } from "@/contexts/FilterContext";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Users,
  Zap,
  Activity,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BENCHMARK_ROI = 3.2;
const BENCHMARK_CPV = 0.032;

const DIVISION_META: Record<string, { label: string; color: string }> = {
  CUL: { label: "Culinary", color: "bg-primary" },
  DAI: { label: "Dairy", color: "bg-accent" },
  BEV: { label: "Beverages", color: "bg-primary" },
  CNF: { label: "Confectionery", color: "bg-accent" },
};

// Simulated media vs organic split data per campaign style
function generateMediaSplit(brand: string, spent: number) {
  const influencerPct = 0.55 + Math.random() * 0.2;
  const influencerFees = spent * influencerPct;
  const adSpend = spent - influencerFees;
  return { influencerFees, adSpend, influencerPct };
}

export default function Financial() {
  const { division, countries, brand } = useFilters();
  const [timePeriod, setTimePeriod] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  const { data: creators = [] } = useQuery({
    queryKey: ["creators-financial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .in("cluster", NESTLE_CLUSTERS)
        .order("followers", { ascending: false });
      if (error) throw error;
      return nestleizeAll(data);
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-financial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return nestleizeAll(data);
    },
  });

  // Apply global filters
  const filtered = useMemo(() => {
    let list = creators;
    if (division !== "All") list = list.filter((c) => c.cluster === division);
    if (countries.length > 0) list = list.filter((c) => countries.includes(c.country as any));
    if (brand !== "All") list = list.filter((c) => c.brand === brand);
    if (platformFilter !== "all") list = list.filter((c) => c.platform === platformFilter);
    return list;
  }, [creators, division, countries, brand, platformFilter]);

  // Hero stat
  const totalInvestment = useMemo(() => {
    return filtered.reduce((sum, c) => {
      const est = (c.followers || 0) * (c.cpv || 0.03) * 0.01;
      return sum + est;
    }, 0);
  }, [filtered]);

  // By division
  const byDivision = useMemo(() => {
    const map: Record<string, { count: number; investment: number; avgRoi: number }> = {};
    filtered.forEach((c) => {
      const div = c.cluster || "Unknown";
      if (!map[div]) map[div] = { count: 0, investment: 0, avgRoi: 0 };
      map[div].count++;
      map[div].investment += (c.followers || 0) * (c.cpv || 0.03) * 0.01;
      map[div].avgRoi += c.roi || 0;
    });
    Object.values(map).forEach((v) => {
      if (v.count > 0) v.avgRoi = v.avgRoi / v.count;
    });
    return map;
  }, [filtered]);

  // By brand
  const byBrand = useMemo(() => {
    const map: Record<string, { count: number; investment: number; avgRoi: number }> = {};
    filtered.forEach((c) => {
      const b = c.brand || "Unassigned";
      if (!map[b]) map[b] = { count: 0, investment: 0, avgRoi: 0 };
      map[b].count++;
      map[b].investment += (c.followers || 0) * (c.cpv || 0.03) * 0.01;
      map[b].avgRoi += c.roi || 0;
    });
    Object.values(map).forEach((v) => {
      if (v.count > 0) v.avgRoi = v.avgRoi / v.count;
    });
    return map;
  }, [filtered]);

  // Leaderboard & Laggerboard
  const ranked = useMemo(() => {
    return [...filtered]
      .filter((c) => c.roi && c.roi > 0)
      .sort((a, b) => (b.roi || 0) - (a.roi || 0));
  }, [filtered]);

  const leaders = ranked.slice(0, 10);
  const laggers = [...ranked].reverse().slice(0, 10);

  // Media vs Organic data
  const mediaSplitData = useMemo(() => {
    if (campaigns.length === 0) {
      // Generate from brands
      const brands = Object.keys(byBrand);
      return brands.map((b) => {
        const inv = byBrand[b].investment;
        const split = generateMediaSplit(b, inv);
        return { name: b, ...split, total: inv };
      });
    }
    return campaigns.map((c) => {
      const total = c.spent || c.budget || 10000;
      const split = generateMediaSplit(c.name, total);
      return { name: c.name, ...split, total };
    });
  }, [campaigns, byBrand]);

  // Investment trends over time (simulated monthly data from creators)
  const investmentTrends = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((month, i) => {
      const base = totalInvestment / 12;
      const variance = 0.7 + Math.sin(i * 0.8) * 0.3 + Math.random() * 0.2;
      return {
        month,
        investment: Math.round(base * variance),
        cumulative: 0,
      };
    });
  }, [totalInvestment]);

  // Fill cumulative
  useMemo(() => {
    let cum = 0;
    investmentTrends.forEach((d) => {
      cum += d.investment;
      d.cumulative = cum;
    });
  }, [investmentTrends]);

  // ROI distribution data
  const roiDistribution = useMemo(() => {
    const buckets = [
      { range: "0-1x", min: 0, max: 1, count: 0 },
      { range: "1-2x", min: 1, max: 2, count: 0 },
      { range: "2-3x", min: 2, max: 3, count: 0 },
      { range: "3-4x", min: 3, max: 4, count: 0 },
      { range: "4-5x", min: 4, max: 5, count: 0 },
      { range: "5x+", min: 5, max: 999, count: 0 },
    ];
    filtered.forEach((c) => {
      const roi = c.roi || 0;
      const bucket = buckets.find((b) => roi >= b.min && roi < b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [filtered]);

  const fmt = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  // Chart colors from CSS vars
  const chartRed = "hsl(348, 100%, 45%)";
  const chartGold = "hsl(42, 48%, 54%)";
  const chartMuted = "hsl(20, 5%, 25%)";
  const chartFg = "hsl(30, 10%, 92%)";

  return (
    <div className="min-h-full">
      {/* Hero */}
      <section className="relative px-8 py-10 border-b border-border overflow-hidden">
        <div className="hero-glow-red absolute inset-0" />
        <div className="hero-glow-gold absolute inset-0" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <h1 className="font-display text-3xl text-foreground italic">
              Financial Governance
            </h1>
          </div>
          <p className="font-data text-[10px] text-muted-foreground tracking-widest uppercase mb-8">
            Investment overview · ROI tracking · Budget allocation
          </p>

          {/* Hero stat */}
          <div className="flex items-end gap-6">
            <div>
              <span className="font-data text-[10px] text-muted-foreground tracking-widest uppercase block mb-1">
                Total Investment (Est.)
              </span>
              <span className="font-display text-5xl text-foreground italic">
                {fmt(totalInvestment)}
              </span>
            </div>
            <div className="flex items-center gap-1 pb-2">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              <span className="font-data text-xs text-green-500">+12.4% YoY</span>
            </div>

            {/* Time period & Platform filter */}
            <div className="ml-auto flex items-center gap-3">
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger className="w-32 h-8 font-data text-[10px] tracking-wider bg-surface-1 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL TIME</SelectItem>
                  <SelectItem value="q1">Q1 2026</SelectItem>
                  <SelectItem value="q2">Q2 2026</SelectItem>
                  <SelectItem value="ytd">YTD</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-32 h-8 font-data text-[10px] tracking-wider bg-surface-1 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL PLATFORMS</SelectItem>
                  <SelectItem value="instagram">INSTAGRAM</SelectItem>
                  <SelectItem value="tiktok">TIKTOK</SelectItem>
                  <SelectItem value="youtube">YOUTUBE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Investment by Division */}
      <section className="px-8 py-6 border-b border-border">
        <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-4">
          Investment by Division
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(DIVISION_META).map(([key, meta]) => {
            const data = byDivision[key];
            return (
              <div key={key} className="bg-surface-1 border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 ${meta.color}`} />
                  <span className="font-data text-[10px] tracking-widest text-muted-foreground">
                    {key}
                  </span>
                </div>
                <span className="font-display text-2xl text-foreground italic block">
                  {data ? fmt(data.investment) : "$0"}
                </span>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-data text-[9px] text-muted-foreground">
                    {data?.count || 0} creators
                  </span>
                  <span className="font-data text-[9px] text-accent">
                    Avg ROI {data ? data.avgRoi.toFixed(1) : "0"}x
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Investment by Brand */}
      <section className="px-8 py-6 border-b border-border">
        <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-4">
          Investment by Brand
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(byBrand)
            .sort((a, b) => b[1].investment - a[1].investment)
            .map(([brandName, data]) => (
              <div key={brandName} className="bg-surface-1 border border-border p-3">
                <span className="font-data text-[9px] tracking-wider text-muted-foreground block mb-1 truncate">
                  {brandName.toUpperCase()}
                </span>
                <span className="font-display text-lg text-foreground italic block">
                  {fmt(data.investment)}
                </span>
                <div className="flex items-center gap-1 mt-1">
                  {data.avgRoi >= BENCHMARK_ROI ? (
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-primary" />
                  )}
                  <span
                    className={`font-data text-[9px] ${
                      data.avgRoi >= BENCHMARK_ROI ? "text-green-500" : "text-primary"
                    }`}
                  >
                    {data.avgRoi.toFixed(1)}x ROI
                  </span>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Charts Section */}
      <section className="px-8 py-6 border-b border-border">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Investment Trends */}
          <div className="bg-surface-1 border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-accent" />
              <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                Investment Trends (Monthly)
              </h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={investmentTrends} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartMuted} opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: chartFg, fontSize: 9, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: chartMuted }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: chartFg, fontSize: 9, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => fmt(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(20, 6%, 8%)",
                      border: "1px solid hsl(20, 4%, 14%)",
                      borderRadius: 0,
                      fontFamily: "JetBrains Mono",
                      fontSize: 10,
                      color: chartFg,
                    }}
                    formatter={(value: number) => [fmt(value), "Investment"]}
                    labelStyle={{ color: chartFg, fontFamily: "JetBrains Mono", fontSize: 10 }}
                  />
                  <Bar dataKey="investment" radius={[2, 2, 0, 0]}>
                    {investmentTrends.map((_, index) => (
                      <Cell key={index} fill={index % 2 === 0 ? chartRed : chartGold} opacity={0.85} />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke={chartGold}
                    strokeWidth={2}
                    dot={false}
                    yAxisId={0}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-primary opacity-85" />
                <span className="font-data text-[9px] text-muted-foreground">Monthly Spend</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-accent" />
                <span className="font-data text-[9px] text-muted-foreground">Cumulative</span>
              </div>
            </div>
          </div>

          {/* ROI Distribution */}
          <div className="bg-surface-1 border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                ROI Distribution
              </h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roiDistribution} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartMuted} opacity={0.3} />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: chartFg, fontSize: 9, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: chartMuted }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: chartFg, fontSize: 9, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(20, 6%, 8%)",
                      border: "1px solid hsl(20, 4%, 14%)",
                      borderRadius: 0,
                      fontFamily: "JetBrains Mono",
                      fontSize: 10,
                      color: chartFg,
                    }}
                    formatter={(value: number) => [value, "Creators"]}
                    labelStyle={{ color: chartFg, fontFamily: "JetBrains Mono", fontSize: 10 }}
                  />
                  {/* Benchmark line at 3-4x bucket */}
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {roiDistribution.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.min >= BENCHMARK_ROI ? chartGold : chartRed}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-primary opacity-85" />
                <span className="font-data text-[9px] text-muted-foreground">Below Benchmark</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-accent opacity-85" />
                <span className="font-data text-[9px] text-muted-foreground">At/Above {BENCHMARK_ROI}x</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Media vs Organic Split */}
      <section className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
            Media vs Organic Split
          </h2>
        </div>
        <div className="space-y-2">
          {mediaSplitData.slice(0, 8).map((item) => (
            <div key={item.name} className="bg-surface-1 border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-data text-[10px] text-foreground tracking-wider truncate max-w-[200px]">
                  {item.name.toUpperCase()}
                </span>
                <span className="font-data text-[10px] text-muted-foreground">
                  {fmt(item.total)}
                </span>
              </div>
              <div className="flex h-3 overflow-hidden">
                <div
                  className="bg-primary/80 transition-all"
                  style={{ width: fmtPct(item.influencerPct) }}
                />
                <div
                  className="bg-accent/80 transition-all"
                  style={{ width: fmtPct(1 - item.influencerPct) }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="font-data text-[9px] text-primary">
                  Influencer Fees: {fmt(item.influencerFees)} ({fmtPct(item.influencerPct)})
                </span>
                <span className="font-data text-[9px] text-accent">
                  Ad Spend: {fmt(item.adSpend)} ({fmtPct(1 - item.influencerPct)})
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard & Laggerboard */}
      <section className="px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                ROI Leaderboard
              </h2>
            </div>
            <div className="bg-surface-1 border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground">#</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground">CREATOR</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground">BRAND</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">ROI</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">VS BENCH</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">CPV</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">CPP</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">CPE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaders.map((c, i) => {
                    const roiDiff = ((c.roi || 0) - BENCHMARK_ROI) / BENCHMARK_ROI * 100;
                    const cpp = ((c.followers || 1) * (c.cpv || 0.03) * 0.01) / (c.total_posts || 1);
                    const cpe = (c.cpv || 0.03) / ((c.engagement_rate || 0.01) || 0.01);
                    return (
                      <TableRow key={c.id} className="border-border">
                        <TableCell className="font-data text-[10px] text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center">
                                <Users className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-ui text-xs text-foreground block leading-tight truncate max-w-[120px]">
                                {c.name}
                              </span>
                              <span className="font-data text-[9px] text-muted-foreground">{c.handle}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-data text-[9px] text-muted-foreground">{c.brand}</TableCell>
                        <TableCell className="font-data text-[10px] text-foreground text-right">{(c.roi || 0).toFixed(1)}x</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-data text-[10px] ${roiDiff >= 0 ? "text-green-500" : "text-primary"}`}>
                            {roiDiff >= 0 ? "+" : ""}{roiDiff.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="font-data text-[10px] text-muted-foreground text-right">${(c.cpv || 0).toFixed(3)}</TableCell>
                        <TableCell className="font-data text-[10px] text-muted-foreground text-right">${cpp.toFixed(0)}</TableCell>
                        <TableCell className="font-data text-[10px] text-muted-foreground text-right">${cpe.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Laggerboard */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-primary" />
              <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                ROI Laggerboard
              </h2>
            </div>
            <div className="bg-surface-1 border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground">#</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground">CREATOR</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground">BRAND</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">ROI</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">VS BENCH</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">CPV</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">CPP</TableHead>
                    <TableHead className="font-data text-[9px] tracking-widest text-muted-foreground text-right">CPE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laggers.map((c, i) => {
                    const roiDiff = ((c.roi || 0) - BENCHMARK_ROI) / BENCHMARK_ROI * 100;
                    const cpp = ((c.followers || 1) * (c.cpv || 0.03) * 0.01) / (c.total_posts || 1);
                    const cpe = (c.cpv || 0.03) / ((c.engagement_rate || 0.01) || 0.01);
                    return (
                      <TableRow key={c.id} className="border-border">
                        <TableCell className="font-data text-[10px] text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center">
                                <Users className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-ui text-xs text-foreground block leading-tight truncate max-w-[120px]">
                                {c.name}
                              </span>
                              <span className="font-data text-[9px] text-muted-foreground">{c.handle}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-data text-[9px] text-muted-foreground">{c.brand}</TableCell>
                        <TableCell className="font-data text-[10px] text-foreground text-right">{(c.roi || 0).toFixed(1)}x</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-data text-[10px] ${roiDiff >= 0 ? "text-green-500" : "text-primary"}`}>
                            {roiDiff >= 0 ? "+" : ""}{roiDiff.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="font-data text-[10px] text-muted-foreground text-right">${(c.cpv || 0).toFixed(3)}</TableCell>
                        <TableCell className="font-data text-[10px] text-muted-foreground text-right">${cpp.toFixed(0)}</TableCell>
                        <TableCell className="font-data text-[10px] text-muted-foreground text-right">${cpe.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
