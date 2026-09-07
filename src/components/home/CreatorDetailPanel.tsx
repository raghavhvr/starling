import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { displayBrand, displayCluster } from "@/lib/nestleize";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Instagram, Globe, TrendingUp, Users, Eye, BarChart3, Heart, MessageCircle, Star, Calendar, MapPin, Building2, ThumbsUp, Award, ChevronRight, Target, DollarSign, Megaphone, FileText, Clock, CheckCircle2, Handshake, ExternalLink, Play, Camera, Loader2 } from "lucide-react";
import { CreatorHistoryAnalytics } from "./CreatorHistoryAnalytics";

interface BQCampaign {
  brand: string;
  campaign: string;
  market: string;
  total_spend: number;
  total_impressions: number;
  total_views: number;
  total_engagements: number;
  period?: string;
}

interface BQBrandSummary {
  brand: string;
  total_spend: number;
  total_impressions: number;
  total_views: number;
  total_engagements: number;
  period?: string;
}

interface CreatorDetailPanelProps {
  creator: Tables<"creators"> | null;
  onClose: () => void;
}

function formatFollowers(n: number | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const clusterLabels: Record<string, string> = {
  CUL: "Culinary",
  DAI: "Dairy",
  BEV: "Beverages",
  CNF: "Confectionery",
};

function parseCompactNumber(value?: string, suffix?: string): number {
  const base = Number(value ?? 0);
  if (!Number.isFinite(base)) return 0;

  switch ((suffix ?? "").toUpperCase()) {
    case "B":
      return base * 1_000_000_000;
    case "M":
      return base * 1_000_000;
    case "K":
      return base * 1_000;
    default:
      return base;
  }
}

function isStoredNestleHistoryCollab(collab: Tables<"creator_collaborations">): boolean {
  const shortcode = collab.shortcode?.toLowerCase() || "";
  const caption = collab.caption?.toLowerCase() || "";

  return shortcode.startsWith("bq_") || caption.includes("bigquery verified");
}

function extractStoredNestleCampaign(collab: Tables<"creator_collaborations">): BQCampaign {
  const caption = collab.caption ?? "";
  const spendMatch = caption.match(/\$(\d+(?:\.\d+)?)\s*([KMB])?/i);
  const impressionsMatch = caption.match(/(\d+(?:\.\d+)?)\s*([KMB])?\s+impressions/i);
  const viewsMatch = caption.match(/(\d+(?:\.\d+)?)\s*([KMB])?\s+views/i);
  const engagementsMatch = caption.match(/(\d+(?:\.\d+)?)\s*([KMB])?\s+engagements/i);
  const marketMatch = caption.match(/\b(?:across|in)\s+(.+?)\s+\(BigQuery verified\)/i);
  const periodMatch = caption.match(/Period:\s*(.+?)$/i);

  return {
    brand: displayBrand(collab.brand_name),
    campaign: `${displayBrand(collab.brand_name)} media campaign`,
    market: marketMatch?.[1] || "Multiple markets",
    total_spend: parseCompactNumber(spendMatch?.[1], spendMatch?.[2]),
    total_impressions: parseCompactNumber(impressionsMatch?.[1], impressionsMatch?.[2]),
    total_views: (collab.views && collab.views > 0) ? collab.views : parseCompactNumber(viewsMatch?.[1], viewsMatch?.[2]),
    total_engagements: (collab.likes && collab.likes > 0) ? (collab.likes + (collab.comments || 0)) : parseCompactNumber(engagementsMatch?.[1], engagementsMatch?.[2]),
    period: periodMatch?.[1]?.trim(),
  };
}

function aggregateHistoryByBrand(campaigns: BQCampaign[]): BQBrandSummary[] {
  const brandMap = new Map<string, BQBrandSummary>();

  campaigns.forEach((campaign) => {
    const current = brandMap.get(campaign.brand) || {
      brand: campaign.brand,
      total_spend: 0,
      total_impressions: 0,
      total_views: 0,
      total_engagements: 0,
      period: undefined as string | undefined,
    };

    current.total_spend += campaign.total_spend;
    current.total_impressions += campaign.total_impressions;
    current.total_views += campaign.total_views;
    current.total_engagements += campaign.total_engagements;
    if (campaign.period && !current.period) current.period = campaign.period;

    brandMap.set(campaign.brand, current);
  });

  return [...brandMap.values()].sort((a, b) => b.total_spend - a.total_spend);
}

/* BigQuery Nestlé history falls back to live fetch only when no verified import is saved */

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: Play,
  snapchat: Camera,
  youtube: Globe,
};

const platformColors: Record<string, string> = {
  instagram: "border-pink-500/50 text-pink-400 bg-pink-500/10",
  tiktok: "border-cyan-500/50 text-cyan-400 bg-cyan-500/10",
  snapchat: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
  youtube: "border-red-500/50 text-red-400 bg-red-500/10",
};

export function CreatorDetailPanel({ creator, onClose }: CreatorDetailPanelProps) {
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");
  const [selectedCampaign, setSelectedCampaign] = useState<BQCampaign | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  const { data: platforms = [] } = useQuery({
    queryKey: ["creator-platforms", creator?.id],
    queryFn: async () => {
      if (!creator) return [];
      const { data, error } = await supabase
        .from("creator_platforms")
        .select("*")
        .eq("creator_id", creator.id)
        .order("followers", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!creator,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["creator-posts", creator?.id],
    queryFn: async () => {
      if (!creator) return [];
      const { data, error } = await supabase
        .from("creator_posts")
        .select("*")
        .eq("creator_id", creator.id)
        .order("post_date", { ascending: false })
        .limit(18);
      if (error) throw error;
      return data;
    },
    enabled: !!creator,
  });

  const { data: collaborations = [], isLoading: collaborationsLoading } = useQuery({
    queryKey: ["creator-collaborations", creator?.id],
    queryFn: async () => {
      if (!creator) return [];
      const { data, error } = await supabase
        .from("creator_collaborations")
        .select("*")
        .eq("creator_id", creator.id)
        .order("post_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!creator,
  });

  const storedNestleCampaigns = useMemo(
    () => collaborations
      .filter(isStoredNestleHistoryCollab)
      .map(extractStoredNestleCampaign)
      .sort((a, b) => b.total_spend - a.total_spend),
    [collaborations]
  );

  const displayCollaborations = useMemo(
    () => collaborations.filter((collab) => !isStoredNestleHistoryCollab(collab)),
    [collaborations]
  );

  const shouldFetchLiveHistory = !!creator && activeTab === "history" && !collaborationsLoading && storedNestleCampaigns.length === 0;

  // Fetch real Nestlé history from BigQuery
  const creatorSearchName = creator?.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  const creatorHandle = creator?.handle?.replace("@", "").toLowerCase() || "";

  const { data: bqBrands = [], isLoading: bqLoading } = useQuery<BQBrandSummary[]>({
    queryKey: ["bq-history-brands", creator?.id],
    queryFn: async () => {
      if (!creator) return [];
      const searchTerms = [creatorSearchName, creatorHandle].filter(Boolean);
      if (searchTerms.length === 0) return [];
      const conditions = searchTerms.flatMap(t => [
        `LOWER(Campaign) LIKE '%${t}%'`,
        `LOWER(Ad_Name) LIKE '%${t}%'`,
        `LOWER(Account_Name) LIKE '%${t}%'`,
      ]).join(" OR ");
      const query = `SELECT Brand, SUM(Spends) as total_spend, SUM(Impressions) as total_impressions, SUM(Video_Views) as total_views, SUM(Engagements) as total_engagements FROM \`wavemaker-mena-groupm.Nestle.Nestle_main_media\` WHERE ${conditions} GROUP BY Brand ORDER BY total_spend DESC`;
      const { data, error } = await supabase.functions.invoke("bigquery-query", { body: { query } });
      if (error) throw error;
      return (data.rows || []).map((r: any) => ({
        brand: displayBrand(r.Brand),
        total_spend: parseFloat(r.total_spend) || 0,
        total_impressions: parseFloat(r.total_impressions) || 0,
        total_views: parseFloat(r.total_views) || 0,
        total_engagements: parseFloat(r.total_engagements) || 0,
      })).filter((r: BQBrandSummary) => r.total_spend > 0);
    },
    enabled: shouldFetchLiveHistory,
  });

  const { data: bqCampaigns = [], isLoading: bqCampaignsLoading } = useQuery<BQCampaign[]>({
    queryKey: ["bq-history-campaigns", creator?.id],
    queryFn: async () => {
      if (!creator) return [];
      const searchTerms = [creatorSearchName, creatorHandle].filter(Boolean);
      if (searchTerms.length === 0) return [];
      const conditions = searchTerms.flatMap(t => [
        `LOWER(Campaign) LIKE '%${t}%'`,
        `LOWER(Ad_Name) LIKE '%${t}%'`,
        `LOWER(Account_Name) LIKE '%${t}%'`,
      ]).join(" OR ");
      const query = `SELECT Brand, Campaign, Market, SUM(Spends) as total_spend, SUM(Impressions) as total_impressions, SUM(Video_Views) as total_views, SUM(Engagements) as total_engagements FROM \`wavemaker-mena-groupm.Nestle.Nestle_main_media\` WHERE ${conditions} GROUP BY Brand, Campaign, Market ORDER BY total_spend DESC LIMIT 50`;
      const { data, error } = await supabase.functions.invoke("bigquery-query", { body: { query } });
      if (error) throw error;
      return (data.rows || []).map((r: any) => ({
        brand: displayBrand(r.Brand),
        campaign: r.Campaign,
        market: r.Market,
        total_spend: parseFloat(r.total_spend) || 0,
        total_impressions: parseFloat(r.total_impressions) || 0,
        total_views: parseFloat(r.total_views) || 0,
        total_engagements: parseFloat(r.total_engagements) || 0,
      })).filter((r: BQCampaign) => r.total_spend > 0);
    },
    enabled: shouldFetchLiveHistory,
  });

  if (!creator) return null;

  const roi = Number(creator.roi) || 0;
  const engRate = Number(creator.engagement_rate) || 0;
  const cpv = Number(creator.cpv) || 0;
  const initials = creator.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const stats = [
    { label: "FOLLOWERS", value: formatFollowers(creator.followers), icon: Users },
    { label: "TOTAL POSTS", value: (creator.total_posts || 0).toLocaleString(), icon: BarChart3 },
    { label: "ENG. RATE", value: `${engRate.toFixed(1)}%`, icon: TrendingUp },
    { label: "ROI", value: `${roi.toFixed(1)}x`, icon: Eye, accent: true },
    { label: "SOI SCORE", value: creator.soi_score?.toString() || "—", icon: Globe },
    { label: "CPV", value: cpv > 0 ? `$${cpv.toFixed(3)}` : "—", icon: BarChart3 },
  ];

  const historyCampaigns = storedNestleCampaigns.length > 0 ? storedNestleCampaigns : bqCampaigns;
  const historyBrands = storedNestleCampaigns.length > 0 ? aggregateHistoryByBrand(storedNestleCampaigns) : bqBrands;
  const historyLoading = activeTab === "history" && (collaborationsLoading || (shouldFetchLiveHistory && (bqLoading || bqCampaignsLoading)));
  const isUsingSavedHistory = storedNestleCampaigns.length > 0;

  const totalHistorySpend = historyBrands.reduce((s, h) => s + h.total_spend, 0);
  const totalHistoryImpressions = historyBrands.reduce((s, h) => s + h.total_impressions, 0);
  const uniqueBrands = historyBrands.map((h) => h.brand);
  const uniqueMarkets = [...new Set(historyCampaigns.map((h) => h.market))];

  return (
    <Sheet open={!!creator} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] bg-card border-border p-0 overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>{creator.name}</SheetTitle>
        </SheetHeader>

        {/* Header with avatar */}
        <div className="relative">
          <div className="h-32 bg-gradient-to-br from-primary/20 via-background to-accent/10" />
          <div className="absolute bottom-0 left-6 translate-y-1/2">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.name}
                className="w-20 h-20 rounded-full object-cover border-4 border-card"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center border-4 border-card">
                <span className="font-ui text-xl font-bold text-primary-foreground">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile info */}
        <div className="pt-14 px-6 pb-2">
          <h2 className="font-display text-2xl font-bold text-foreground">{creator.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Instagram className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-data text-[11px] text-muted-foreground tracking-wide">
              {creator.handle || "—"}
            </span>
          </div>

          {/* Platform pills */}
          {platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button
                onClick={() => setActivePlatform(null)}
                className={`font-data text-[9px] tracking-wider px-2.5 py-1 border transition-colors ${
                  activePlatform === null
                    ? "border-foreground text-foreground bg-foreground/5"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                ALL PLATFORMS
              </button>
              {platforms.map((p) => {
                const Icon = platformIcons[p.platform] || Globe;
                const colorCls = platformColors[p.platform] || "border-border text-muted-foreground bg-muted";
                const isActive = activePlatform === p.platform;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlatform(isActive ? null : p.platform)}
                    className={`font-data text-[9px] tracking-wider px-2.5 py-1 border transition-colors flex items-center gap-1 ${
                      isActive ? colorCls : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {p.platform.toUpperCase()}
                    <span className="opacity-60">{formatFollowers(p.followers)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Show active platform bio if different */}
          {(() => {
            const activePlat = activePlatform ? platforms.find(p => p.platform === activePlatform) : null;
            const bio = activePlat?.bio || creator.bio;
            return bio ? (
              <p className="font-ui text-xs text-muted-foreground leading-relaxed mt-3 border-l-2 border-border pl-3">
                {bio}
              </p>
            ) : null;
          })()}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {creator.cluster && (
              <span className="border border-primary/40 text-primary font-data text-[9px] tracking-wider px-2.5 py-1">
                {displayCluster(creator.cluster)}
              </span>
            )}
            {creator.brand && (
              <span className="border border-border text-foreground font-data text-[9px] tracking-wider px-2.5 py-1">
                {displayBrand(creator.brand)}
              </span>
            )}
            {creator.country && (
              <span className="border border-border text-muted-foreground font-data text-[9px] tracking-wider px-2.5 py-1">
                {creator.country}
              </span>
            )}
            {historyBrands.length > 0 && (
              <span className="border border-accent/40 text-accent font-data text-[9px] tracking-wider px-2.5 py-1 flex items-center gap-1">
                <Award className="w-3 h-3" />
                {historyBrands.length} NESTLÉ BRAND{historyBrands.length > 1 ? "S" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-4 border-b border-border">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("profile")}
              className={`font-data text-[10px] tracking-[0.15em] py-2.5 border-b-2 transition-colors ${
                activeTab === "profile"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              PROFILE
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`font-data text-[10px] tracking-[0.15em] py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              NESTLÉ HISTORY
              {historyBrands.length > 0 && (
                <span className="bg-accent/20 text-accent px-1.5 py-0.5 text-[8px] rounded">
                  {historyBrands.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {activeTab === "profile" ? (
            <>
              {/* Platform-specific stats when a platform is selected */}
              {activePlatform && (() => {
                const plat = platforms.find(p => p.platform === activePlatform);
                if (!plat) return null;
                const pd = (plat.platform_data || {}) as Record<string, any>;
                const platStats = [
                  { label: "FOLLOWERS", value: formatFollowers(plat.followers), icon: Users },
                  { label: "ENG. RATE", value: `${Number(plat.engagement_rate || 0).toFixed(1)}%`, icon: TrendingUp },
                  ...(pd.hearts ? [{ label: "HEARTS/LIKES", value: formatFollowers(pd.hearts), icon: Heart }] : []),
                  ...(pd.videos ? [{ label: "VIDEOS", value: formatFollowers(pd.videos), icon: Play }] : []),
                  ...(pd.verified !== undefined ? [{ label: "VERIFIED", value: pd.verified ? "✓" : "✗", icon: CheckCircle2 }] : []),
                  ...(pd.following ? [{ label: "FOLLOWING", value: formatFollowers(pd.following), icon: Users }] : []),
                ];
                const Icon = platformIcons[plat.platform] || Globe;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">
                        {plat.platform.toUpperCase()} STATS
                      </span>
                      {plat.profile_url && (
                        <a href={plat.profile_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                          <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {platStats.map((s) => (
                        <div key={s.label} className="border border-border bg-background p-3 space-y-1.5">
                          <div className="flex items-center gap-1">
                            <s.icon className="w-3 h-3 text-muted-foreground" />
                            <span className="font-data text-[8px] text-muted-foreground tracking-[0.15em]">
                              {s.label}
                            </span>
                          </div>
                          <div className="font-display text-xl font-bold tracking-tight text-foreground">
                            {s.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Overall Stats (shown when no platform selected or always) */}
              {!activePlatform && (
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="border border-border bg-background p-3 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <s.icon className="w-3 h-3 text-muted-foreground" />
                      <span className="font-data text-[8px] text-muted-foreground tracking-[0.15em]">
                        {s.label}
                      </span>
                    </div>
                    <div className={`font-display text-xl font-bold tracking-tight ${s.accent ? "text-primary" : "text-foreground"}`}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              )}

              {/* Division */}
              {creator.cluster && clusterLabels[displayCluster(creator.cluster)] && (
                <div className="border-l-2 border-primary pl-3">
                  <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">CLUSTER</span>
                  <p className="font-ui text-sm text-foreground">{clusterLabels[displayCluster(creator.cluster)]}</p>
                </div>
              )}

              {/* SOI Performance bar */}
              <div className="space-y-2">
                <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">
                  PERFORMANCE INDEX
                </span>
                <div className="h-1.5 bg-border overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                    style={{ width: `${Math.min((creator.soi_score || 0), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between font-data text-[9px] text-muted-foreground">
                  <span>0</span>
                  <span>SOI {creator.soi_score || 0}/100</span>
                  <span>100</span>
                </div>
              </div>

              {/* Recent Posts Grid */}
              {(() => {
                const filteredPosts = activePlatform
                  ? posts.filter((p: any) => (p.platform || 'instagram') === activePlatform)
                  : posts;
                if (filteredPosts.length === 0) return null;
                return (
                  <div className="space-y-3">
                    <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em]">
                      RECENT POSTS ({filteredPosts.length}){activePlatform ? ` · ${activePlatform.toUpperCase()}` : ""}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {filteredPosts.map((post: any) => {
                        const postPlatform = post.platform || 'instagram';
                        const PostIcon = platformIcons[postPlatform] || Instagram;
                        const linkUrl = post.video_url || post.instagram_url || "#";
                        return (
                          <a
                            key={post.id}
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative aspect-square group overflow-hidden bg-surface-2"
                            onMouseEnter={() => setSelectedPost(post.id)}
                            onMouseLeave={() => setSelectedPost(null)}
                          >
                            {post.image_url ? (
                              <img
                                src={post.image_url}
                                alt={post.caption?.slice(0, 50) || "Post"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <PostIcon className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            {/* Platform badge */}
                            {postPlatform !== 'instagram' && (
                              <div className="absolute top-1 left-1">
                                <PostIcon className="w-3 h-3 text-white drop-shadow-md" />
                              </div>
                            )}
                            <div className={`absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200 ${
                              selectedPost === post.id ? "opacity-100" : "opacity-0"
                            }`}>
                              <div className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-primary" />
                                <span className="font-data text-[10px] text-foreground">
                                  {formatCount(post.likes || 0)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3 text-accent" />
                                <span className="font-data text-[10px] text-foreground">
                                  {formatCount(post.comments || 0)}
                                </span>
                              </div>
                              {(post.views ?? 0) > 0 && (
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3 text-muted-foreground" />
                                  <span className="font-data text-[10px] text-foreground">
                                    {formatCount(post.views)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Brand Collaborations */}
              {displayCollaborations.length > 0 && (() => {
                const filteredCollabs = activePlatform
                  ? displayCollaborations.filter(c => c.platform === activePlatform)
                  : displayCollaborations;
                if (filteredCollabs.length === 0) return null;
                const collabTypeColors: Record<string, string> = {
                  paid_partnership: "bg-green-500/10 text-green-400 border-green-500/20",
                  paid_ad: "bg-green-500/10 text-green-400 border-green-500/20",
                  sponsored: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                  ambassador: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                  gifted: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                  brand_mention: "bg-muted text-muted-foreground border-border",
                  tagged: "bg-muted text-muted-foreground border-border",
                };
                const collabTypeLabels: Record<string, string> = {
                  paid_partnership: "PAID",
                  paid_ad: "PAID AD",
                  sponsored: "SPONSORED",
                  ambassador: "AMBASSADOR",
                  gifted: "GIFTED",
                  brand_mention: "MENTION",
                  tagged: "TAGGED",
                };
                // Group by brand
                const brandMap = new Map<string, typeof filteredCollabs>();
                for (const c of filteredCollabs) {
                  const key = displayBrand(c.brand_name).toLowerCase();
                  if (!brandMap.has(key)) brandMap.set(key, []);
                  brandMap.get(key)!.push(c);
                }
                const sortedBrands = [...brandMap.entries()].sort((a, b) => b[1].length - a[1].length);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] flex items-center gap-1.5">
                        <Handshake className="w-3.5 h-3.5" />
                        BRAND COLLABORATIONS ({filteredCollabs.length}){activePlatform ? ` · ${activePlatform.toUpperCase()}` : ""}
                      </span>
                      <span className="font-data text-[8px] text-muted-foreground">
                        {sortedBrands.length} BRAND{sortedBrands.length !== 1 ? "S" : ""}
                      </span>
                    </div>

                    {sortedBrands.slice(0, 10).map(([brandKey, collabs]) => {
                      const displayName = displayBrand(collabs[0].brand_name);
                      const latestCollab = collabs[0];
                      return (
                        <div key={brandKey} className="border border-border bg-background p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="font-data text-[9px] font-bold text-primary">
                                  {displayName.slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <span className="font-ui text-xs font-medium text-foreground">{displayName}</span>
                                <span className="font-data text-[8px] text-muted-foreground block">
                                  {collabs.length} post{collabs.length !== 1 ? "s" : ""}
                                  {latestCollab.post_date && ` · latest ${new Date(latestCollab.post_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                                </span>
                              </div>
                            </div>
                            <span className={`font-data text-[8px] px-2 py-0.5 border rounded ${collabTypeColors[latestCollab.collaboration_type || "tagged"] || collabTypeColors.tagged}`}>
                              {collabTypeLabels[latestCollab.collaboration_type || "tagged"] || "TAGGED"}
                            </span>
                          </div>

                          {/* Show thumbnails of collab posts */}
                          {collabs.filter(c => c.image_url).length > 0 && (
                            <div className="flex gap-1 overflow-x-auto">
                              {collabs.filter(c => c.image_url).slice(0, 4).map((c) => (
                                <a
                                  key={c.id}
                                  href={c.post_url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative w-14 h-14 flex-shrink-0 overflow-hidden group"
                                >
                                  <img src={c.image_url!} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="w-3 h-3 text-foreground" />
                                  </div>
                                </a>
                              ))}
                              {collabs.filter(c => c.image_url).length > 4 && (
                                <div className="w-14 h-14 flex-shrink-0 bg-muted flex items-center justify-center">
                                  <span className="font-data text-[9px] text-muted-foreground">+{collabs.filter(c => c.image_url).length - 4}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Engagement summary */}
                          <div className="flex gap-3">
                            <span className="font-data text-[8px] text-muted-foreground flex items-center gap-0.5">
                              <Heart className="w-2.5 h-2.5" /> {formatCount(collabs.reduce((s, c) => s + (c.likes || 0), 0))}
                            </span>
                            <span className="font-data text-[8px] text-muted-foreground flex items-center gap-0.5">
                              <MessageCircle className="w-2.5 h-2.5" /> {formatCount(collabs.reduce((s, c) => s + (c.comments || 0), 0))}
                            </span>
                            {collabs.reduce((s, c) => s + (c.views || 0), 0) > 0 && (
                              <span className="font-data text-[8px] text-muted-foreground flex items-center gap-0.5">
                                <Eye className="w-2.5 h-2.5" /> {formatCount(collabs.reduce((s, c) => s + (c.views || 0), 0))}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {sortedBrands.length > 10 && (
                      <p className="font-data text-[9px] text-muted-foreground text-center">
                        +{sortedBrands.length - 10} more brands
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Platform links */}
              <div className="flex flex-col gap-2">
                {creator.handle && (
                  <a
                    href={`https://instagram.com/${creator.handle.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 border border-border px-4 py-2.5 hover:bg-surface-2 transition-colors w-full justify-center"
                  >
                    <Instagram className="w-4 h-4 text-foreground" />
                    <span className="font-data text-[10px] tracking-wider text-foreground">
                      VIEW ON INSTAGRAM
                    </span>
                  </a>
                )}
                {platforms.filter(p => p.platform !== 'instagram' && p.profile_url).map(p => {
                  const Icon = platformIcons[p.platform] || Globe;
                  return (
                    <a
                      key={p.id}
                      href={p.profile_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 border border-border px-4 py-2.5 hover:bg-surface-2 transition-colors w-full justify-center"
                    >
                      <Icon className="w-4 h-4 text-foreground" />
                      <span className="font-data text-[10px] tracking-wider text-foreground">
                        VIEW ON {p.platform.toUpperCase()}
                      </span>
                    </a>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Nestlé History Tab — granular ad-line BigQuery analytics ── */
            <CreatorHistoryAnalytics
              creator={{
                id: creator.id,
                name: creator.name,
                handle: creator.handle,
                country: creator.country,
                followers: creator.followers,
                engagement_rate: Number(creator.engagement_rate) || 0,
              }}
              searchTerms={[creatorSearchName, creatorHandle, creator.name?.toLowerCase().split(" ")[0] || ""].filter(Boolean)}
            />
          )}
        </div>

        {/* Campaign Detail Modal */}
        <Dialog open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
          <DialogContent className="max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold text-foreground leading-snug">
                {selectedCampaign?.campaign}
              </DialogTitle>
            </DialogHeader>

            {selectedCampaign && (
              <div className="space-y-5 mt-2">
                {/* Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-data text-[9px] text-muted-foreground tracking-wider">BRAND</span>
                    </div>
                    <p className="font-ui text-sm text-foreground">{selectedCampaign.brand}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-data text-[9px] text-muted-foreground tracking-wider">MARKET</span>
                    </div>
                    <p className="font-ui text-sm text-foreground">{selectedCampaign.market}</p>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div>
                  <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] block mb-3">PERFORMANCE METRICS</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "IMPRESSIONS", value: formatCount(selectedCampaign.total_impressions), icon: Eye },
                      { label: "VIDEO VIEWS", value: formatCount(selectedCampaign.total_views), icon: Play },
                      { label: "ENGAGEMENTS", value: formatCount(selectedCampaign.total_engagements), icon: Heart },
                      { label: "MEDIA SPEND", value: `$${selectedCampaign.total_spend >= 1000 ? `${(selectedCampaign.total_spend / 1000).toFixed(1)}K` : selectedCampaign.total_spend.toFixed(0)}`, icon: DollarSign, accent: true },
                    ].map((m) => (
                      <div key={m.label} className="border border-border bg-background p-3 space-y-1">
                        <div className="flex items-center gap-1">
                          <m.icon className="w-3 h-3 text-muted-foreground" />
                          <span className="font-data text-[7px] text-muted-foreground tracking-wider">{m.label}</span>
                        </div>
                        <div className={`font-display text-lg font-bold ${m.accent ? "text-accent" : "text-foreground"}`}>
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-primary/5 border border-primary/20 p-3 text-center">
                  <span className="font-data text-[8px] text-primary tracking-wider">
                    {isUsingSavedHistory ? "VERIFIED FROM SAVED BIGQUERY IMPORT" : "VERIFIED FROM BIGQUERY · WAVEMAKER MENA"}
                  </span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
