import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { NESTLE_CLUSTERS, nestleizeAll } from "@/lib/nestleize";
import { NESTLE_TIERS } from "@/lib/measurementFramework";
import { computeGovernance, stateFor, type KpiState } from "@/lib/governance";
import { HINTS } from "@/lib/glossary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, ShieldCheck, Users, ArrowRight } from "lucide-react";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

const STATE_STYLES: Record<KpiState, string> = {
  on: "text-emerald-600",
  watch: "text-accent",
  off: "text-destructive",
  na: "text-muted-foreground",
};

const tierFor = (followers?: number | null) => {
  const f = Number(followers) || 0;
  return NESTLE_TIERS.find((t) => f >= t.min && f < t.max)?.label ?? "Nano";
};

const statusStyles: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  draft: "bg-muted text-muted-foreground",
  completed: "bg-accent/20 text-accent",
};

const Measurement = () => {
  const navigate = useNavigate();
  const [brand, setBrand] = useState("All");
  const [market, setMarket] = useState("All");
  const [tier, setTier] = useState("All");
  const [campStatus, setCampStatus] = useState("All");
  const [sortBy, setSortBy] = useState<"roi" | "engagement_rate" | "followers" | "soi_score">("roi");

  const { data: creators = [] } = useQuery({
    queryKey: ["measurement-creators"],
    queryFn: async () => {
      const rows: any[] = [];
      for (let off = 0; ; off += 1000) {
        const { data, error } = await supabase.from("creators").select("*")
          .in("cluster", NESTLE_CLUSTERS).range(off, off + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return nestleizeAll(rows);
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["measurement-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return nestleizeAll(data);
    },
  });

  const { data: deliverablesByCampaign = new Map() } = useQuery({
    queryKey: ["measurement-deliverables", campaigns.length],
    enabled: campaigns.length > 0,
    queryFn: async () => {
      const { data: ccs } = await supabase.from("campaign_creators").select("id, campaign_id")
        .in("campaign_id", campaigns.map((c: any) => c.id));
      const ccToCampaign = new Map((ccs || []).map((cc: any) => [cc.id, cc.campaign_id]));
      const map = new Map<string, { status: string; due_date: string | null }[]>();
      const ids = (ccs || []).map((cc: any) => cc.id);
      for (let i = 0; i < ids.length; i += 80) {
        const { data: ds } = await supabase.from("campaign_deliverables").select("status, due_date, campaign_creator_id")
          .in("campaign_creator_id", ids.slice(i, i + 80));
        (ds || []).forEach((d: any) => {
          const cid = ccToCampaign.get(d.campaign_creator_id);
          if (!cid) return;
          if (!map.has(cid)) map.set(cid, []);
          map.get(cid)!.push({ status: d.status, due_date: d.due_date });
        });
      }
      return map;
    },
  });

  /* ─── filters applied ─── */
  const brands = useMemo(() => ["All", ...[...new Set(creators.map((c: any) => c.brand).filter(Boolean))].sort()], [creators]);
  const markets = useMemo(() => ["All", ...[...new Set(creators.map((c: any) => c.country).filter(Boolean))].sort()], [creators]);

  const filteredCreators = useMemo(() => creators.filter((c: any) =>
    (brand === "All" || c.brand === brand) &&
    (market === "All" || c.country === market) &&
    (tier === "All" || tierFor(c.followers) === tier)
  ), [creators, brand, market, tier]);

  const filteredCampaigns = useMemo(() => campaigns.filter((c: any) =>
    (brand === "All" || c.brand === brand) &&
    (market === "All" || (c.markets || []).includes(market)) &&
    (campStatus === "All" || c.status === campStatus)
  ), [campaigns, brand, market, campStatus]);

  /* ─── performance strip ─── */
  const reach = filteredCreators.reduce((s: number, c: any) => s + (Number(c.followers) || 0), 0);
  const ers = filteredCreators.map((c: any) => Number(c.engagement_rate) || 0).filter((n: number) => n > 0);
  const rois = filteredCreators.map((c: any) => Number(c.roi) || 0).filter((n: number) => n > 0);
  const cpvs = filteredCreators.map((c: any) => Number(c.cpv) || 0).filter((n: number) => n > 0);

  /* ─── governance across filtered campaigns ─── */
  const allDeliverables = filteredCampaigns.flatMap((c: any) => deliverablesByCampaign.get(c.id) || []);
  const gov = computeGovernance(allDeliverables, {});
  const completedCamps = filteredCampaigns.filter((c: any) => c.status === "completed" && Number(c.budget) > 0);
  const variance = completedCamps.length
    ? Math.round(avg(completedCamps.map((c: any) => Math.abs(1 - (Number(c.spent) || 0) / Number(c.budget)) * 100)) * 10) / 10
    : null;

  const govTiles = [
    { label: "ON-TIME DELIVERY", target: "≥ 95%", value: gov.onTimePct, suffix: "%", state: stateFor(gov.onTimePct, 95, "gte"), note: `${gov.dueCount} DUE TO DATE`, hint: HINTS.onTime },
    { label: "APPROVAL RATE", target: "≥ 90%", value: gov.approvalPct, suffix: "%", state: stateFor(gov.approvalPct, 90, "gte"), note: `${gov.reviewedCount} REVIEWED`, hint: HINTS.approvalRate },
    { label: "BUDGET VARIANCE", target: "≤ 2%", value: variance, suffix: "%", state: stateFor(variance, 2, "lte"), note: `${completedCamps.length} COMPLETED FLIGHTS`, hint: HINTS.budgetVariance },
    { label: "CREATOR COMPLIANCE", target: "100%", value: null, suffix: "", state: "na" as KpiState, note: "MANUAL ATTESTATION", hint: "Disclosure and contract compliance per creator — attested by the campaign team, not yet auto-computed." },
    { label: "CREATIVE HYGIENE", target: "100%", value: null, suffix: "", state: "na" as KpiState, note: "MANUAL ATTESTATION", hint: "Brand and QA checklist adherence for every asset — attested by the campaign team." },
    { label: "CREATORIQ ADOPTION", target: "100%", value: null, suffix: "", state: "na" as KpiState, note: "MANUAL ATTESTATION", hint: "Share of activity managed through the platform — audited periodically." },
  ];

  const sortedCreators = useMemo(() =>
    [...filteredCreators].sort((a: any, b: any) => (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0)).slice(0, 25),
  [filteredCreators, sortBy]);

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="hero-glow-gold absolute inset-0" />
        <div className="relative px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-[2px] bg-primary" />
            <span className="font-data text-[10px] text-primary tracking-[0.25em] font-medium">
              MEASUREMENT · BUSINESS / BRAND / MEDIA / GOVERNANCE
            </span>
          </div>
          <h1 className="text-4xl font-display font-semibold leading-tight tracking-tight mb-1">
            Performance &amp; <em className="text-primary italic">accountability</em>
          </h1>
          <p className="font-ui text-sm text-muted-foreground max-w-lg">
            Live creator and campaign performance against the Picture of Success governance targets.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 border-b border-border flex flex-wrap items-center gap-3">
        <span className="font-data text-[10px] text-muted-foreground tracking-[0.2em]">FILTER</span>
        {[
          { value: brand, set: setBrand, options: brands, label: "Brand" },
          { value: market, set: setMarket, options: markets, label: "Market" },
          { value: tier, set: setTier, options: ["All", ...NESTLE_TIERS.map((t) => t.label)], label: "Tier" },
          { value: campStatus, set: setCampStatus, options: ["All", "active", "draft", "completed"], label: "Campaign status" },
        ].map((f) => (
          <Select key={f.label} value={f.value} onValueChange={f.set}>
            <SelectTrigger className="w-[150px] h-8 font-ui text-xs bg-card">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o: string) => (
                <SelectItem key={o} value={o} className="font-ui text-xs">
                  {o === "All" ? `All ${f.label.toLowerCase()}s` : o === "draft" ? "planned" : o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Performance strip */}
      <div className="px-8 py-5 grid grid-cols-2 lg:grid-cols-5 gap-3 border-b border-border">
        {[
          { label: "CREATORS", value: String(filteredCreators.length), hint: HINTS.trackedCreators },
          { label: "COMBINED REACH", value: fmtCount(reach), hint: HINTS.followers },
          { label: "AVG ENG. RATE", value: ers.length ? `${avg(ers).toFixed(1)}%` : "—", hint: HINTS.engagementRate },
          { label: "AVG ROI", value: rois.length ? `${avg(rois).toFixed(1)}x` : "—", hint: HINTS.roi },
          { label: "AVG CPV", value: cpvs.length ? `$${avg(cpvs).toFixed(3)}` : "—", hint: HINTS.avgCpv },
        ].map((m) => (
          <div key={m.label} title={m.hint} className="border border-border bg-card rounded-lg p-4">
            <span className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">{m.label}</span>
            <p className="font-display text-2xl font-bold mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Governance scorecard */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <h2 className="font-display text-2xl font-semibold">Governance — Picture of Success</h2>
          <span className="font-data text-[9px] text-muted-foreground tracking-wider ml-2">LIVE ACROSS FILTERED CAMPAIGNS</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {govTiles.map((t) => (
            <div key={t.label} title={t.hint} className="border border-border bg-card rounded-lg p-4">
              <span className="font-data text-[8px] text-muted-foreground tracking-[0.15em]">{t.label}</span>
              <p className={`font-display text-2xl font-bold mt-1 ${STATE_STYLES[t.state]}`}>
                {t.value !== null ? `${t.value}${t.suffix}` : "—"}
              </p>
              <p className="font-data text-[8px] text-muted-foreground tracking-wider mt-1">TARGET {t.target}</p>
              <p className="font-data text-[8px] text-muted-foreground/70 tracking-wider">{t.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign performance */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-display text-2xl font-semibold">Campaign performance</h2>
        </div>
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="bg-secondary/60">
                {[
                  ["CAMPAIGN", "Campaign name, brand and markets"],
                  ["STATUS", "Active = in flight · Planned = brief saved · Completed = results recorded"],
                  ["FLIGHT", "Campaign start and end dates"],
                  ["BUDGET", "Committed campaign budget"],
                  ["SPENT", "Spend to date (and % of budget utilised)"],
                  ["DELIVERABLES", HINTS.deliverables],
                  ["ON-TIME", HINTS.onTime],
                  ["", ""],
                ].map(([h, hint], i) => (
                  <th key={h || i} title={hint} className="text-left font-data text-[9px] text-muted-foreground tracking-[0.15em] px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map((c: any) => {
                const ds = deliverablesByCampaign.get(c.id) || [];
                const g = computeGovernance(ds, { budget: c.budget, spent: c.spent, completed: c.status === "completed" });
                const delivered = ds.filter((d: any) => d.status === "approved" || d.status === "submitted").length;
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/campaign?id=${c.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-ui text-sm font-semibold">{c.name}</p>
                      <p className="font-data text-[9px] text-muted-foreground tracking-wider">{[c.brand, (c.markets || []).join("/")].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-data text-[9px] tracking-wider uppercase rounded px-1.5 py-0.5 ${statusStyles[c.status || "draft"] || statusStyles.draft}`}>
                        {(c.status || "draft") === "draft" ? "planned" : c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-data text-[10px] text-muted-foreground">
                      {c.start_date ? format(new Date(c.start_date), "MMM yy") : "—"}{c.end_date ? ` – ${format(new Date(c.end_date), "MMM yy")}` : ""}
                    </td>
                    <td className="px-4 py-3 font-data text-xs">{c.budget ? `$${Number(c.budget).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3 font-data text-xs">
                      {c.spent ? `$${Number(c.spent).toLocaleString()}` : "—"}
                      {g.utilisationPct !== null && <span className="text-muted-foreground"> ({g.utilisationPct}%)</span>}
                    </td>
                    <td className="px-4 py-3 font-data text-xs">{ds.length > 0 ? `${delivered}/${ds.length}` : "—"}</td>
                    <td className={`px-4 py-3 font-data text-xs ${STATE_STYLES[stateFor(g.onTimePct, 95, "gte")]}`}>
                      {g.onTimePct !== null ? `${g.onTimePct}%` : "—"}
                    </td>
                    <td className="px-4 py-3"><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creator performance */}
      <div className="px-8 py-6 pb-16">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display text-2xl font-semibold">Creator performance</h2>
            <span className="font-data text-[9px] text-muted-foreground tracking-wider ml-2">TOP 25 OF {filteredCreators.length}</span>
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[170px] h-8 font-ui text-xs bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roi" className="font-ui text-xs">Sort by ROI</SelectItem>
              <SelectItem value="engagement_rate" className="font-ui text-xs">Sort by Eng. rate</SelectItem>
              <SelectItem value="followers" className="font-ui text-xs">Sort by Followers</SelectItem>
              <SelectItem value="soi_score" className="font-ui text-xs">Sort by SOI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-secondary/60">
                {[
                  ["CREATOR", HINTS.trackedCreators],
                  ["TIER", HINTS.tier],
                  ["MARKET", "Creator's primary market"],
                  ["FOLLOWERS", HINTS.followers],
                  ["ENG. RATE", HINTS.engagementRate],
                  ["ROI", HINTS.roi],
                  ["CPV", HINTS.avgCpv],
                  ["SOI", HINTS.shareOfInfluence],
                ].map(([h, hint]) => (
                  <th key={h} title={hint} className="text-left font-data text-[9px] text-muted-foreground tracking-[0.15em] px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCreators.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    <p className="font-ui text-sm font-medium">{c.name}</p>
                    <p className="font-data text-[9px] text-muted-foreground">{c.handle}{c.brand ? ` · ${c.brand}` : ""}</p>
                  </td>
                  <td className="px-4 py-2.5 font-data text-[10px]">{tierFor(c.followers)}</td>
                  <td className="px-4 py-2.5 font-data text-[10px] text-muted-foreground">{c.country || "—"}</td>
                  <td className="px-4 py-2.5 font-data text-xs">{fmtCount(Number(c.followers) || 0)}</td>
                  <td className="px-4 py-2.5 font-data text-xs">{c.engagement_rate ? `${Number(c.engagement_rate).toFixed(1)}%` : "—"}</td>
                  <td className="px-4 py-2.5 font-data text-xs font-semibold">{c.roi ? `${Number(c.roi).toFixed(1)}x` : "—"}</td>
                  <td className="px-4 py-2.5 font-data text-xs">{c.cpv ? `$${Number(c.cpv).toFixed(3)}` : "—"}</td>
                  <td className="px-4 py-2.5 font-data text-xs text-accent font-semibold">{c.soi_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Measurement;
