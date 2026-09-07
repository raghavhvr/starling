import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Megaphone, ArrowRight, Users, TrendingUp, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NESTLE_CLUSTERS, nestleizeAll } from "@/lib/nestleize";
import { HINTS } from "@/lib/glossary";
import { useFilters } from "@/contexts/FilterContext";
import { BrandLogo } from "@/components/BrandLogo";
import { HeroSection } from "@/components/home/HeroSection";
import { MetricStrip } from "@/components/home/MetricStrip";
import { CreatorGrid } from "@/components/home/CreatorGrid";
import { TrendingSection } from "@/components/home/TrendingSection";
import { VirloTrendsCard } from "@/components/home/VirloTrendsCard";

const tabs = ["TOP PERFORMERS", "CAMPAIGNS", "BRAND INSIGHTS", "WATCH LIST"];

const statusStyles: Record<string, string> = {
  active: "bg-primary/15 text-primary border-primary/30",
  draft: "bg-muted text-muted-foreground border-border",
  completed: "bg-accent/20 text-accent border-accent/30",
  paused: "bg-destructive/15 text-destructive border-destructive/30",
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtFollowers = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : `${n}`;

const Index = () => {
  const [activeTab, setActiveTab] = useState(0);
  const navigate = useNavigate();
  const { division, countries, brand, setBrand } = useFilters();

  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ["creators", division, countries, brand],
    queryFn: async () => {
      let query = supabase.from("creators").select("*").order("roi", { ascending: false, nullsFirst: false })
        .in("cluster", division !== "All" ? [division] : NESTLE_CLUSTERS);
      if (brand !== "All") query = query.eq("brand", brand);
      if (countries.length > 0) query = query.in("country", countries);
      const { data, error } = await query;
      if (error) throw error;
      return nestleizeAll(data);
    },
  });

  const { data: allCampaigns = [] } = useQuery({
    queryKey: ["campaigns-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*");
      if (error) throw error;
      return nestleizeAll(data);
    },
  });
  // Filter after nestleize so legacy-coded rows (e.g. an old CPD cluster) land
  // in their translated Nestlé cluster instead of leaking foreign data
  const campaigns = division === "All" ? allCampaigns : allCampaigns.filter((c) => c.cluster === division);

  // Total investment = committed campaign budgets (the legacy financial_data
  // table holds pre-Starling media records and would overstate the number)
  const totalInvestment = campaigns.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
  const avgCPV = creators.length > 0
    ? creators.reduce((sum, c) => sum + (Number(c.cpv) || 0), 0) / creators.length
    : 0;
  const avgSOI = creators.length > 0
    ? creators.reduce((sum, c) => sum + (Number(c.soi_score) || 0), 0) / creators.length
    : 0;
  // Share of Influence for the hero: reach-weighted — audience size carries the
  // influence, so VIP/Top-tier creators weigh in proportionally
  const totalFollowers = creators.reduce((sum, c) => sum + (Number(c.followers) || 0), 0);
  const weightedSOI = totalFollowers > 0
    ? creators.reduce((sum, c) => sum + (Number(c.soi_score) || 0) * (Number(c.followers) || 0), 0) / totalFollowers
    : 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  /* Tab views */
  // Top performers = best measured ROI in the roster (relative ranking, dataset-agnostic)
  const topPerformers = creators.filter((c) => (Number(c.roi) || 0) > 0).slice(0, 24);
  const topIds = new Set(topPerformers.map((c) => c.id));
  // Watch list = high influence scores not yet among the top performers — activation candidates
  const watchList = creators
    .filter((c) => (Number(c.soi_score) || 0) >= 75 && !topIds.has(c.id))
    .sort((a, b) => (Number(b.soi_score) || 0) - (Number(a.soi_score) || 0));
  const statusOrder: Record<string, number> = { active: 0, draft: 1, paused: 2, completed: 3 };
  const campaignCards = [...campaigns].sort(
    (a, b) => (statusOrder[a.status || "draft"] ?? 1) - (statusOrder[b.status || "draft"] ?? 1)
  );
  const brandInsights = [...creators.reduce((m, c) => {
    if (!c.brand) return m;
    const rows = m.get(c.brand) || [];
    rows.push(c);
    m.set(c.brand, rows);
    return m;
  }, new Map<string, typeof creators>())]
    .map(([b, rows]) => ({
      brand: b,
      count: rows.length,
      followers: rows.reduce((s, c) => s + (Number(c.followers) || 0), 0),
      er: avg(rows.map((c) => Number(c.engagement_rate) || 0).filter((n) => n > 0)),
      roi: avg(rows.map((c) => Number(c.roi) || 0).filter((n) => n > 0)),
      campaigns: campaigns.filter((cp) => cp.brand === b).length,
    }))
    .sort((a, b) => b.count - a.count);

  const tabCounts = [topPerformers.length, campaignCards.length, brandInsights.length, watchList.length];

  return (
    <div className="min-h-full">
      <HeroSection
        creatorCount={creators.length}
        soiPercent={weightedSOI}
      />

      <MetricStrip
        totalInvestment={totalInvestment}
        soiPercent={avgSOI}
        avgCPV={avgCPV}
        activeCampaigns={activeCampaigns}
      />

      {/* Tab Bar */}
      <div className="border-b border-border px-8">
        <div className="flex gap-8">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              title={[HINTS.topPerformers, HINTS.campaignsTab, HINTS.brandInsights, HINTS.watchList][i]}
              onClick={() => setActiveTab(i)}
              className={`font-data text-[11px] tracking-[0.15em] py-3 border-b-2 transition-colors ${
                i === activeTab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              <span className="ml-2 text-muted-foreground">
                {tabCounts[i]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 0 && <CreatorGrid creators={topPerformers} loading={creatorsLoading} />}

      {activeTab === 1 && (
        <div className="px-8 py-6">
          {campaignCards.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-lg">
              <Megaphone className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="font-ui text-sm text-muted-foreground">No campaigns yet.</p>
              <button onClick={() => navigate("/brief")} className="mt-2 text-xs text-primary hover:underline">
                Create your first brief
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {campaignCards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate("/campaigns")}
                  className="group text-left p-4 rounded-lg bg-card border border-border hover:border-primary/40 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-data tracking-wider uppercase border ${statusStyles[c.status || "draft"] || statusStyles.draft}`}>
                      {(c.status || "draft") === "draft" ? "planned" : c.status}
                    </span>
                    {c.budget ? (
                      <span className="font-data text-[10px] text-muted-foreground">
                        ${Number(c.budget).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  <h4 className="font-display text-base font-semibold leading-snug line-clamp-1">{c.name}</h4>
                  <p className="font-data text-[10px] text-muted-foreground tracking-wider">
                    {[c.brand, c.cluster].filter(Boolean).join(" · ") || "UNASSIGNED"}
                  </p>
                  {c.status === "completed" && (
                    <p className="font-data text-[9px] text-accent tracking-wider line-clamp-1">
                      {c.kpis || (c.spent ? `$${Number(c.spent).toLocaleString()} SPENT OF $${Number(c.budget || 0).toLocaleString()}` : "")}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-data text-[9px] text-muted-foreground">
                      {c.start_date ? format(new Date(c.start_date), "MMM d") : "—"}
                      {" → "}
                      {c.end_date ? format(new Date(c.end_date), "MMM d, yyyy") : "—"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 2 && (
        <div className="px-8 py-6">
          {brandInsights.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-lg">
              <p className="font-ui text-sm text-muted-foreground">No creators assigned to brands yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {brandInsights.map((b) => (
                <button
                  key={b.brand}
                  onClick={() => { setBrand(b.brand); setActiveTab(0); }}
                  className="group text-left p-4 rounded-lg bg-card border border-border hover:border-primary/40 transition-all space-y-3"
                  title={`Filter the platform to ${b.brand}`}
                >
                  <div className="flex items-center justify-between">
                    <BrandLogo brand={b.brand} className="h-8" />
                    <span className="font-data text-[9px] text-muted-foreground">{b.campaigns} CAMPAIGNS</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="font-display text-xl font-bold">{b.count}</div>
                      <div className="font-data text-[8px] text-muted-foreground tracking-wider flex items-center gap-1"><Users className="w-2.5 h-2.5" />CREATORS</div>
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold">{b.er > 0 ? `${b.er.toFixed(1)}%` : "—"}</div>
                      <div className="font-data text-[8px] text-muted-foreground tracking-wider flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" />AVG ER</div>
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold">{b.roi > 0 ? `${b.roi.toFixed(1)}x` : "—"}</div>
                      <div className="font-data text-[8px] text-muted-foreground tracking-wider flex items-center gap-1"><Eye className="w-2.5 h-2.5" />AVG ROI</div>
                    </div>
                  </div>
                  <div className="font-data text-[9px] text-muted-foreground tracking-wider">
                    {fmtFollowers(b.followers)} COMBINED REACH
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 3 && <CreatorGrid creators={watchList} loading={creatorsLoading} />}

      <TrendingSection />

      <VirloTrendsCard />
    </div>
  );
};

export default Index;
