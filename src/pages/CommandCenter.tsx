import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NESTLE_CLUSTERS } from "@/lib/nestleize";
import { NESTLE_TIERS } from "@/lib/measurementFramework";
import { HINTS } from "@/lib/glossary";
import {
  BarChart3,
  Bot,
  Clapperboard,
  Landmark,
  LineChart,
  MapPin,
  MessageSquare,
  Newspaper,
  Scale,
  ShoppingBag,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

/* Priority hubs — UAE, KSA, Egypt, Morocco + one Levant hub (Iraq / Jordan / Lebanon).
   Country values in the shared DB mix names and ISO codes, so match both. */
const HUBS = [
  { label: "UAE", countries: ["UAE", "AE"] },
  { label: "Saudi Arabia", countries: ["KSA", "SA"] },
  { label: "Egypt", countries: ["Egypt", "EG"] },
  { label: "Morocco", countries: ["Morocco", "MA"] },
  { label: "Levant", countries: ["Jordan", "JO", "Lebanon", "LB", "Iraq", "IQ"], note: "Jordan · Lebanon · Iraq" },
];

/* Nestlé official tier definitions (campaigns cap at three tiers) */
const TIERS = NESTLE_TIERS;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmtCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : `${n}`;

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-5 h-[2px] bg-primary" />
        <span className="font-data text-[10px] text-primary tracking-[0.25em] font-medium uppercase">{eyebrow}</span>
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

const CommandCenter = () => {
  const navigate = useNavigate();

  const { data: creators = [] } = useQuery({
    queryKey: ["cc-creators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("id, country, followers, engagement_rate, roi, cpv, status, platform")
        .in("cluster", NESTLE_CLUSTERS);
      if (error) throw error;
      return data;
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["cc-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_posts")
        .select("id, platform, likes, comments, views, video_url");
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["cc-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("id, status, budget, spent");
      if (error) throw error;
      return data;
    },
  });

  /* Hub rollups */
  const hubStats = HUBS.map((hub) => {
    const rows = creators.filter((c) => hub.countries.includes(c.country || ""));
    return {
      ...hub,
      count: rows.length,
      er: avg(rows.map((c) => Number(c.engagement_rate) || 0).filter((n) => n > 0)),
    };
  });

  /* Influencer-level benchmarking by follower tier */
  const tierStats = TIERS.map((t) => {
    const rows = creators.filter((c) => {
      const f = Number(c.followers) || 0;
      return f >= t.min && f < t.max;
    });
    return {
      ...t,
      count: rows.length,
      er: avg(rows.map((c) => Number(c.engagement_rate) || 0).filter((n) => n > 0)),
      roi: avg(rows.map((c) => Number(c.roi) || 0).filter((n) => n > 0)),
      cpv: avg(rows.map((c) => Number(c.cpv) || 0).filter((n) => n > 0)),
    };
  });

  /* Creative analytics on post types */
  const postTypes = [
    { label: "Video / Reels", icon: Clapperboard, rows: posts.filter((p) => p.video_url) },
    { label: "Static / Carousel", icon: Newspaper, rows: posts.filter((p) => !p.video_url) },
  ].map((t) => ({
    ...t,
    count: t.rows.length,
    views: avg(t.rows.map((p) => Number(p.views) || 0).filter((n) => n > 0)),
    engagement: avg(t.rows.map((p) => (Number(p.likes) || 0) + (Number(p.comments) || 0)).filter((n) => n > 0)),
  }));

  /* Integrated activity */
  const committedBudget = campaigns.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  const spentToDate = campaigns.reduce((s, c) => s + (Number(c.spent) || 0), 0);
  const organicEngagements = posts.reduce((s, p) => s + (Number(p.likes) || 0) + (Number(p.comments) || 0), 0);
  const activeCreators = creators.filter((c) => c.status === "active").length;

  const fmtMoney = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n > 0 ? `$${Math.round(n / 1_000)}K` : "—";

  const integrated = [
    { label: "Paid Media", icon: Landmark, value: fmtMoney(committedBudget), meta: `COMMITTED · ${fmtMoney(spentToDate)} SPENT`, hint: HINTS.paidMedia },
    { label: "Organic", icon: LineChart, value: posts.length > 0 ? fmtCount(organicEngagements) : "—", meta: `ENGAGEMENTS · ${posts.length} POSTS`, hint: HINTS.organic },
    { label: "Influencers", icon: Users, value: `${creators.length}`, meta: `CREATORS · ${activeCreators} ACTIVE`, hint: HINTS.trackedCreators },
    { label: "Commerce", icon: ShoppingBag, value: "Connect", meta: "LINK RETAIL MEDIA & D2C", pending: true, hint: HINTS.commerce },
  ];

  const pillars = [
    { icon: BarChart3, title: "Overall program insights", desc: "One view of investment, reach, and share of influence across every hub and brand.", to: "/" },
    { icon: Scale, title: "Influencer-level benchmarking", desc: "Every creator scored against tier benchmarks — ER, ROI, and CPV vs. their peer set.", to: "/creators" },
    { icon: Clapperboard, title: "Creative analytics on post types", desc: "What formats earn attention — video vs. static, platform by platform.", to: "/market" },
    { icon: Workflow, title: "Workflow management", desc: "Brief, match, contract, approve, and measure — one pipeline for every activation.", to: "/campaign" },
  ];

  const aiCapabilities = [
    { icon: Scale, title: "Automated content benchmarking", desc: "Every post auto-scored against its format and tier benchmark the moment it's tracked." },
    { icon: MessageSquare, title: "Chat with your data", desc: "Ask Starling AI anything — creators, spend, campaigns — and unpack insights in plain language.", chat: true },
    { icon: Sparkles, title: "Aggregated past learnings", desc: "Verified history from every past activation feeds directly into the next brief." },
    { icon: Bot, title: "Agent recommendations", desc: "Agents assemble creator shortlists, budget splits, and analysis — ready for review." },
  ];

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 700px 400px at 88% 25%, hsl(48 95% 55% / 0.16), transparent)" }}
        />
        <div className="hero-glow-red absolute inset-0" />
        <div className="relative px-8 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-[2px] bg-primary" />
            <span className="font-data text-[10px] text-primary tracking-[0.25em] font-medium">
              CENTRALIZED OPERATIONS & ANALYTICS
            </span>
          </div>
          <h1 className="text-5xl font-display font-semibold leading-[1.05] tracking-tight mb-3">
            A <em className="text-primary italic">one stop shop</em> for all activation
          </h1>
          <p className="font-ui text-sm text-muted-foreground leading-relaxed max-w-lg">
            One operations and analytics center for all your influencer activity — program insights,
            benchmarking, creative analytics, and workflow management across every priority hub.
          </p>
        </div>
      </div>

      {/* Priority hubs */}
      <div className="px-8 py-8 border-b border-border">
        <SectionHeader eyebrow="Priority Hubs" title="Five hubs, one command center" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {hubStats.map((h) => (
            <div key={h.label} title={HINTS.priorityHubs} className="border border-border bg-card rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="font-ui text-sm font-semibold">{h.label}</span>
              </div>
              {h.note && <div className="font-data text-[9px] text-muted-foreground tracking-wider">{h.note}</div>}
              <div className="font-display text-3xl font-bold">{h.count > 0 ? h.count : "—"}</div>
              <div className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">
                CREATORS{h.er > 0 ? ` · ${h.er.toFixed(1)}% ER` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integrated activity */}
      <div className="px-8 py-8 border-b border-border">
        <SectionHeader eyebrow="Integrated View" title="Your activity, side by side" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {integrated.map((t) => (
            <div key={t.label} title={(t as any).hint} className={`border rounded-lg p-5 space-y-3 ${t.pending ? "border-dashed border-border bg-transparent" : "border-border bg-card"}`}>
              <div className="flex items-center gap-2">
                <t.icon className={`w-4 h-4 ${t.pending ? "text-muted-foreground" : "text-primary"}`} />
                <span className="font-ui text-sm font-semibold">{t.label}</span>
              </div>
              <div className={`font-display text-3xl font-bold tracking-tight ${t.pending ? "text-muted-foreground" : ""}`}>{t.value}</div>
              <div className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">{t.meta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmarking + creative analytics */}
      <div className="px-8 py-8 border-b border-border grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-8">
        <div>
          <SectionHeader eyebrow="Influencer-Level Benchmarking" title="Tier benchmarks" />
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary/60">
                  {[
                    ["TIER", HINTS.tier],
                    ["FOLLOWERS", HINTS.followers],
                    ["CREATORS", HINTS.trackedCreators],
                    ["AVG ER", HINTS.engagementRate],
                    ["AVG ROI", HINTS.roi],
                    ["AVG CPV", HINTS.avgCpv],
                  ].map(([h, hint]) => (
                    <th key={h} title={hint} className="text-left font-data text-[9px] text-muted-foreground tracking-[0.15em] px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tierStats.map((t) => (
                  <tr key={t.label} className="border-t border-border">
                    <td className="px-4 py-3 font-ui text-sm font-semibold">{t.label}</td>
                    <td className="px-4 py-3 font-data text-[11px] text-muted-foreground">{t.range}</td>
                    <td className="px-4 py-3 font-data text-sm">{t.count}</td>
                    <td className="px-4 py-3 font-data text-sm">{t.er > 0 ? `${t.er.toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-3 font-data text-sm">{t.roi > 0 ? `${t.roi.toFixed(1)}x` : "—"}</td>
                    <td className="px-4 py-3 font-data text-sm">{t.cpv > 0 ? `$${t.cpv.toFixed(3)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionHeader eyebrow="Creative Analytics" title="What formats work" />
          <div className="space-y-4">
            {postTypes.map((t) => (
              <div key={t.label} className="border border-border bg-card rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <t.icon className="w-4 h-4 text-accent" />
                  <span className="font-ui text-sm font-semibold">{t.label}</span>
                  <span className="ml-auto font-data text-[10px] text-muted-foreground">{t.count} POSTS</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-display text-2xl font-bold">{t.views > 0 ? fmtCount(Math.round(t.views)) : "—"}</div>
                    <div className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">AVG VIEWS</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-bold">{t.engagement > 0 ? fmtCount(Math.round(t.engagement)) : "—"}</div>
                    <div className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">AVG ENGAGEMENT</div>
                  </div>
                </div>
              </div>
            ))}
            <p className="font-data text-[9px] text-muted-foreground tracking-wider">
              {campaigns.length} CAMPAIGNS FEEDING THE BENCHMARK POOL
            </p>
          </div>
        </div>
      </div>

      {/* Pillars */}
      <div className="px-8 py-8 border-b border-border">
        <SectionHeader eyebrow="The Center" title="Everything in one place" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {pillars.map((p) => (
            <button
              key={p.title}
              onClick={() => navigate(p.to)}
              className="text-left border border-border bg-card rounded-lg p-5 space-y-3 hover:border-primary/40 transition-colors group"
            >
              <p.icon className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg font-semibold leading-snug">{p.title}</h3>
              <p className="font-ui text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AI */}
      <div className="px-8 py-8 pb-16">
        <SectionHeader eyebrow="Starling AI" title="Leverage AI for better understanding" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {aiCapabilities.map((c) => (
            <button
              key={c.title}
              onClick={() => c.chat && window.dispatchEvent(new CustomEvent("starling:open-chat"))}
              className={`text-left border rounded-lg p-5 space-y-3 transition-colors ${
                c.chat
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                  : "border-border bg-card cursor-default"
              }`}
            >
              <c.icon className={`w-5 h-5 ${c.chat ? "text-primary" : "text-accent"}`} />
              <h3 className="font-display text-lg font-semibold leading-snug">{c.title}</h3>
              <p className="font-ui text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
              {c.chat && (
                <span className="inline-flex items-center gap-1.5 font-data text-[10px] text-primary tracking-wider">
                  <Sparkles className="w-3 h-3" /> OPEN STARLING AI
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
