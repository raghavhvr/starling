import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText, Lightbulb, Tag, Clock, MessageSquare, Zap,
  ChevronDown, ChevronUp, Sparkles, Loader2, Quote, TrendingUp, ExternalLink, RefreshCw, Play,
} from "lucide-react";

interface Props {
  creator: {
    id: string;
    name: string;
    handle: string | null;
    platform: string | null;
    virlo_tracking_id?: string | null;
    virlo_tracking_status?: string | null;
  };
}

type AnalysisReport = {
  report?: {
    analysis?: {
      overview?: {
        headline?: string;
        recent_focus?: string;
        content_focus?: string;
        growth_insight?: string;
      };
      what_works?: Array<{ insight: string; evidence?: string; evidence_video_ids?: string[] }>;
      content_themes?: Array<{ name: string; description?: string; avg_views?: number; video_count?: number; video_ids?: string[]; evidence_video_ids?: string[] }>;
      posting_patterns?: {
        frequency?: string;
        best_formats?: string[];
        optimal_duration?: string;
      };
      audience_sentiment?: {
        overall_summary?: string;
        sentiment_labels?: string[];
        notable_comments?: Array<{ likes?: number; content: string; insight?: string }>;
      };
      sentiment_mascot_url?: string;
    };
    created_at?: string;
  };
  account?: { latest_followers?: number; display_name?: string };
};

function fmt(n?: number) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

async function callVirlo(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("virlo-proxy", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export function CreatorVirloAnalysis({ creator }: Props) {
  const qc = useQueryClient();
  const [showWorksEvidence, setShowWorksEvidence] = useState<Record<number, boolean>>({});
  const [showComments, setShowComments] = useState(false);

  const trackingId = creator.virlo_tracking_id;
  const platform = creator.platform === "snapchat" ? null : creator.platform; // Virlo doesn't support snapchat tracking

  // Poll the report every 15s until analysis is ready
  const { data: reportData, isLoading, isFetching, refetch, error: reportError } = useQuery<{ data: AnalysisReport } | null>({
    queryKey: ["virlo-report", creator.id, trackingId],
    enabled: !!trackingId,
    refetchInterval: (q) => {
      const d = q.state.data as any;
      return d?.data?.report?.analysis ? false : 15_000;
    },
    queryFn: async () => {
      try {
        const res = await callVirlo("tracking_creator_report", { tracking_id: trackingId });
        return (res as any)?.data ?? null;
      } catch (e: any) {
        if (/404|not.?found|not.?ready|processing/i.test(String(e?.message))) return null;
        throw e;
      }
    },
  });

  // Fetch the creator's tracked posts (for video evidence rendering)
  const { data: postsData } = useQuery<any>({
    queryKey: ["virlo-posts", creator.id, trackingId],
    enabled: !!trackingId && !!reportData?.data?.report?.analysis,
    queryFn: async () => {
      try {
        const res = await callVirlo("tracking_creator_posts", { tracking_id: trackingId });
        return (res as any)?.data ?? null;
      } catch {
        return null;
      }
    },
  });

  // Fetch posting cadence (per day-of-week / hour heatmap data)
  const { data: cadenceData } = useQuery<any>({
    queryKey: ["virlo-cadence", creator.id, trackingId],
    enabled: !!trackingId && !!reportData?.data?.report?.analysis,
    queryFn: async () => {
      try {
        const res = await callVirlo("tracking_creator_cadence", { tracking_id: trackingId });
        return (res as any)?.data ?? null;
      } catch {
        return null;
      }
    },
  });
  const postsList: any[] = (() => {
    const d = postsData?.data ?? postsData;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.posts)) return d.posts;
    if (Array.isArray(d?.videos)) return d.videos;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  })();
  const postsById = new Map<string, any>();
  for (const p of postsList) {
    const ids = [
      p?.id,
      p?.video_id,
      p?.post_id,
      p?.external_id,
      p?.externalId,
      p?.shortcode,
      p?.code,
      p?.aweme_id,
      p?.media_id,
      p?.pk,
    ];
    for (const id of ids) {
      if (id != null) postsById.set(String(id), p);
    }
  }

  // Track elapsed time since polling started (for UX)
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!trackingId || reportData?.data?.report?.analysis) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [trackingId, reportData, startedAt]);

  const startTracking = useMutation({
    mutationFn: async () => {
      if (!platform) throw new Error("AI analysis only supports TikTok, Instagram, and YouTube");
      const handle = (creator.handle || "").replace(/^@/, "");
      if (!handle) throw new Error("Missing creator handle");
      const res = await callVirlo("tracking_create_creator", {
        // Omit collection_depth: Virlo charges +$0.50 for "standard" on top of the $0.25 initial cycle.
        // The lightweight initial cycle still generates the AI report and avoids false 402s on smaller balances.
        params: { platform, handle, scrape_cadence: "daily" },
      });
      const id = (res as any)?.data?.data?.id;
      if (!id) throw new Error("Failed to start tracking");
      const { error } = await supabase
        .from("creators")
        .update({
          virlo_tracking_id: id,
          virlo_tracking_platform: platform,
          virlo_tracking_status: "active",
        })
        .eq("id", creator.id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      toast.success("Tracking started — polling for analysis…");
      qc.invalidateQueries({ queryKey: ["creators-hub"] });
      qc.invalidateQueries({ queryKey: ["virlo-report", creator.id] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (/402|insufficient.?credits|payment.?required/i.test(msg)) {
        toast.error("The intelligence engine does not have enough available credits for that request.");
      } else {
        toast.error(msg || "Failed to start tracking");
      }
    },
  });

  const refreshAll = useMutation({
    mutationFn: async () => {
      if (!trackingId) return;
      await Promise.all([
        callVirlo("tracking_creator_report", { tracking_id: trackingId, force_refresh: true }),
        callVirlo("tracking_creator_posts", { tracking_id: trackingId, force_refresh: true }),
      ]);
    },
    onSuccess: () => {
      toast.success("Analysis refreshed");
      qc.invalidateQueries({ queryKey: ["virlo-report", creator.id, trackingId] });
      qc.invalidateQueries({ queryKey: ["virlo-posts", creator.id, trackingId] });
      qc.invalidateQueries({ queryKey: ["virlo-cadence", creator.id, trackingId] });
    },
    onError: (e: any) => toast.error(String(e?.message || "Refresh failed")),
  });

  /* ── Empty state: not tracked yet ── */
  if (!trackingId) {
    if (!platform) {
      return (
        <div className="border border-dashed border-border p-6 text-center">
          <Sparkles className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">AI analysis is available for TikTok, Instagram, and YouTube creators.</p>
        </div>
      );
    }
    return (
      <div className="border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
        <Sparkles className="w-6 h-6 mx-auto text-primary" />
        <div>
          <p className="font-display text-base text-foreground">AI Creator Analysis</p>
          <p className="text-xs text-muted-foreground mt-1">
            Generate an in-depth report with content themes, audience sentiment, what's working, and posting patterns.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => startTracking.mutate()}
          disabled={startTracking.isPending}
          className="font-data text-[10px] tracking-wider gap-2"
        >
          {startTracking.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {startTracking.isPending ? "STARTING…" : "GENERATE ANALYSIS"}
        </Button>
        <p className="font-data text-[8px] text-muted-foreground/60 tracking-wider">~$0.25 per cycle · runs daily</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">Loading analysis…</p>
      </div>
    );
  }

  const analysis = reportData?.data?.report?.analysis;
  const createdAt = reportData?.data?.report?.created_at;

  if (!analysis) {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const tooLong = elapsed > 240; // >4 min
    return (
      <div className="border border-border bg-card p-6 text-center space-y-3">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
        <div>
          <p className="font-display text-base text-foreground">Analysis in progress</p>
          <p className="text-xs text-muted-foreground mt-1">
            We're collecting posts, analyzing themes, and scoring sentiment. First-time analyses typically take 1–3 minutes.
          </p>
          <p className="font-data text-[10px] text-muted-foreground/70 tracking-wider mt-2">
            ELAPSED: {mins}:{secs.toString().padStart(2, "0")} · POLLING EVERY 15s
          </p>
        </div>
        {tooLong && (
          <p className="text-xs text-amber-500">
            Taking longer than usual — the job may still be queued, or this tracking ID may belong to a previous failed request.
          </p>
        )}
        <Button size="sm" variant="outline" onClick={() => refetch()} className="font-data text-[9px] tracking-wider">
          REFRESH NOW
        </Button>
      </div>
    );
  }

  const ov = analysis.overview;
  const works = analysis.what_works || [];
  const themes = analysis.content_themes || [];
  const patterns = analysis.posting_patterns;
  const sentiment = analysis.audience_sentiment;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-foreground italic flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Creator Analysis
        </h3>
        <div className="flex items-center gap-3">
          <span className="font-data text-[9px] text-muted-foreground tracking-wider">
            {createdAt ? `GENERATED ${new Date(createdAt).toLocaleDateString()}` : "GENERATED"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refreshAll.mutate()}
            disabled={refreshAll.isPending || isFetching}
            className="font-data text-[9px] tracking-wider gap-1.5 h-7"
          >
            <RefreshCw className={`w-3 h-3 ${refreshAll.isPending ? "animate-spin" : ""}`} />
            {refreshAll.isPending ? "REFRESHING…" : "REFRESH"}
          </Button>
        </div>
      </div>

      {/* Overview */}
      {ov && (
        <Section icon={FileText} title="Overview">
          {ov.headline && <p className="font-ui text-sm text-foreground font-semibold leading-relaxed">{ov.headline}</p>}
          {ov.content_focus && <p className="font-ui text-xs text-muted-foreground leading-relaxed mt-2">{ov.content_focus}</p>}
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {ov.recent_focus && (
              <SubBlock icon={Clock} label="RECENT FOCUS">{ov.recent_focus}</SubBlock>
            )}
            {ov.growth_insight && (
              <SubBlock icon={TrendingUp} label="GROWTH INSIGHT">{ov.growth_insight}</SubBlock>
            )}
          </div>
        </Section>
      )}

      {/* What Works */}
      {works.length > 0 && (
        <Section icon={Lightbulb} title="What Works for This Creator" subtitle="Winning patterns identified from content performance data">
          <div className="space-y-3">
            {works.map((w, i) => (
              <div key={i} className="border border-border bg-background p-4">
                <div className="flex gap-3">
                  <div className="w-7 h-7 shrink-0 bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-sm text-foreground font-semibold leading-snug">{w.insight}</p>
                    {w.evidence && (
                      <p className="font-ui text-xs text-muted-foreground mt-1.5 leading-relaxed">{w.evidence}</p>
                    )}
                    {w.evidence_video_ids && w.evidence_video_ids.length > 0 && (
                      <button
                        onClick={() => setShowWorksEvidence((p) => ({ ...p, [i]: !p[i] }))}
                        className="mt-2 inline-flex items-center gap-1 font-data text-[10px] text-primary hover:underline"
                      >
                        {showWorksEvidence[i] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showWorksEvidence[i] ? "Hide" : "Show"} {w.evidence_video_ids.length} video{w.evidence_video_ids.length > 1 ? "s" : ""}
                      </button>
                    )}
                    {showWorksEvidence[i] && w.evidence_video_ids && (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {w.evidence_video_ids.map((vid) => (
                          <EvidenceCard
                            key={vid}
                            videoId={String(vid)}
                            handle={(creator.handle || "").replace(/^@/, "")}
                            platform={(creator.platform || "").toLowerCase()}
                            post={postsById.get(String(vid))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Content Themes */}
      {themes.length > 0 && (
        <Section icon={Tag} title="Content Themes" subtitle="Recurring topics and formats this creator builds content around">
          <div className="space-y-5">
            {themes.map((t, i) => {
              const themeVideoIds = t.video_ids || t.evidence_video_ids || [];
              return (
                <div key={i} className="flex gap-3">
                  <div className="w-1 bg-primary shrink-0 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <p className="font-ui text-sm text-foreground font-semibold">{t.name}</p>
                      <div className="flex gap-3 font-data text-[10px] text-muted-foreground">
                        {t.video_count != null && <span>{t.video_count} videos</span>}
                        {t.avg_views != null && <span>{fmt(t.avg_views)} avg views</span>}
                      </div>
                    </div>
                    {t.description && <p className="font-ui text-xs text-muted-foreground leading-relaxed mt-1">{t.description}</p>}
                    {themeVideoIds.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {themeVideoIds.slice(0, 6).map((vid) => (
                          <EvidenceCard
                            key={vid}
                            videoId={String(vid)}
                            handle={(creator.handle || "").replace(/^@/, "")}
                            platform={(creator.platform || "").toLowerCase()}
                            post={postsById.get(String(vid))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Posting Patterns */}
      {(patterns || cadenceData) && (
        <Section icon={Clock} title="Creator Posting Patterns">
          <div className="space-y-2">
            {patterns?.frequency && (
              <PatternBullet>{patterns.frequency}</PatternBullet>
            )}
            {patterns?.optimal_duration && (
              <PatternBullet><span className="text-foreground font-semibold">Optimal duration: </span>{patterns.optimal_duration}</PatternBullet>
            )}
            {patterns?.best_formats && patterns.best_formats.length > 0 && (
              <PatternBullet>
                <span className="text-foreground font-semibold">Top formats: </span>
                {patterns.best_formats.join("; ")}
              </PatternBullet>
            )}
          </div>
          <CadenceHeatmap cadence={cadenceData} />
        </Section>
      )}

      {/* Audience Sentiment */}
      {sentiment && (
        <Section icon={MessageSquare} title="Audience Sentiment">
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              {sentiment.sentiment_labels && sentiment.sentiment_labels.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="font-data text-[9px] text-muted-foreground tracking-wider">AUDIENCE SENTIMENT:</span>
                  {sentiment.sentiment_labels.map((l) => (
                    <span
                      key={l}
                      className="font-data text-[10px] px-2 py-0.5 capitalize border border-accent/30 bg-accent/10 text-accent"
                    >
                      {l.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
              {sentiment.overall_summary && (
                <p className="font-ui text-sm text-muted-foreground leading-relaxed">{sentiment.overall_summary}</p>
              )}
            </div>
          </div>

          {sentiment.notable_comments && sentiment.notable_comments.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowComments((s) => !s)}
                className="inline-flex items-center gap-1 font-data text-[10px] text-primary hover:underline mb-3"
              >
                {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showComments ? "Hide" : "Show"} {sentiment.notable_comments.length} notable comments
              </button>
              {showComments && (
                <div className="grid md:grid-cols-2 gap-3">
                  {sentiment.notable_comments.map((c, i) => (
                    <div key={i} className="border border-border bg-background p-3">
                      <Quote className="w-3 h-3 text-muted-foreground mb-1.5" />
                      <p className="font-ui text-sm text-foreground italic leading-snug">"{c.content}"</p>
                      {c.insight && (
                        <p className="font-ui text-xs text-muted-foreground mt-2 leading-relaxed">{c.insight}</p>
                      )}
                      {c.likes != null && (
                        <p className="font-data text-[9px] text-muted-foreground mt-2">❤️ {fmt(c.likes)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      <KeyInsights creator={creator} analysis={analysis} />

      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="font-data text-[9px] text-muted-foreground tracking-wider">
          AI CREATOR TRACKING · UPDATED EVERY 24H
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, subtitle, children,
}: {
  icon: any; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-base text-foreground">{title}</h4>
          {subtitle && <p className="font-ui text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function SubBlock({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-primary" />
        <span className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">{label}</span>
      </div>
      <p className="font-ui text-xs text-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function CadenceHeatmap({ cadence }: { cadence: any }) {
  // Try to extract a 7x24 grid of post counts from various possible shapes
  const grid = useMemoCadence(cadence);
  if (!grid) return null;

  const max = Math.max(1, ...grid.flat());
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="font-data text-[9px] text-muted-foreground tracking-[0.15em] mb-3">
        POSTING ACTIVITY · DAY × HOUR (LOCAL)
      </p>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex gap-1 pl-9 mb-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="w-3.5 text-center font-data text-[8px] text-muted-foreground/60">
                {h % 6 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {grid.map((row, di) => (
            <div key={di} className="flex gap-1 items-center mb-1">
              <span className="w-8 font-data text-[9px] text-muted-foreground tracking-wider">{days[di]}</span>
              {row.map((v, hi) => {
                const intensity = v / max;
                return (
                  <div
                    key={hi}
                    title={`${days[di]} ${hi}:00 — ${v} posts`}
                    className="w-3.5 h-3.5 border border-border/50"
                    style={{
                      backgroundColor: v === 0 ? "transparent" : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useMemoCadence(cadence: any): number[][] | null {
  if (!cadence) return null;
  const c = cadence?.data ?? cadence;
  // Shape 1: { day_hour_matrix: number[7][24] }
  if (Array.isArray(c?.day_hour_matrix) && c.day_hour_matrix.length === 7) return c.day_hour_matrix;
  if (Array.isArray(c?.matrix) && c.matrix.length === 7) return c.matrix;
  if (Array.isArray(c?.heatmap) && c.heatmap.length === 7) return c.heatmap;
  // Shape 2: { entries: [{ day_of_week: 0-6, hour: 0-23, count: n }] }
  const entries: any[] =
    c?.entries || c?.data || c?.cadence || c?.posts || (Array.isArray(c) ? c : []);
  if (Array.isArray(entries) && entries.length > 0 && entries[0] && typeof entries[0] === "object") {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let any = false;
    for (const e of entries) {
      const d = e.day_of_week ?? e.dayOfWeek ?? e.day ?? e.weekday;
      const h = e.hour ?? e.hour_of_day ?? e.hourOfDay;
      const n = e.count ?? e.posts ?? e.value ?? 1;
      if (d != null && h != null) {
        const di = ((Number(d) % 7) + 7) % 7;
        const hi = Math.max(0, Math.min(23, Number(h)));
        grid[di][hi] += Number(n) || 0;
        any = true;
      }
    }
    if (any) return grid;
  }
  return null;
}

function KeyInsights({ creator, analysis }: { creator: Props["creator"]; analysis: any }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{ insights: Array<{ insight: string; tip: string }> }>({
    queryKey: ["creator-key-insights", creator.id, analysis?.overview?.headline],
    enabled: !!analysis,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-creator-insights", {
        body: { creator, analysis },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
  });

  const insights = data?.insights || [];

  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h4 className="font-data text-[11px] text-foreground tracking-[0.2em]">KEY INSIGHTS</h4>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="font-data text-[9px] tracking-wider gap-1.5 h-7"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          REGENERATE
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-ui text-sm">Generating strategic insights…</span>
        </div>
      )}

      {error && (
        <p className="font-ui text-xs text-destructive">Could not generate insights. {String((error as any)?.message || "")}</p>
      )}

      {!isLoading && !error && insights.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {insights.map((it, i) => (
            <div key={i} className="border border-border bg-background p-4 space-y-3">
              <div className="flex gap-2.5">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                <p className="font-ui text-sm text-foreground leading-relaxed">{it.insight}</p>
              </div>
              {it.tip && (
                <div className="border border-emerald-500/20 bg-emerald-500/5 p-3 flex gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="font-ui text-xs text-emerald-300/90 leading-relaxed">
                    <span className="font-semibold text-emerald-300">Tip: </span>{it.tip}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatternBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
      <p className="font-ui text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function EvidenceCard({
  videoId, handle, platform, post,
}: {
  videoId: string;
  handle: string;
  platform: string;
  post: any;
}) {
  const [playing, setPlaying] = useState(false);

  const postUrl = post?.url || post?.post_url || post?.permalink || post?.share_url || post?.web_url;
  const cleanHandle = (handle || post?.author?.username || post?.username || "").replace(/^@/, "");
  const inferredPlatform = (
    platform ||
    post?.platform ||
    post?.type ||
    (/tiktok\.com/i.test(postUrl || "") ? "tiktok" : /instagram\.com/i.test(postUrl || "") ? "instagram" : /youtu/i.test(postUrl || "") ? "youtube" : "")
  ).toLowerCase();
  const displayId = String(post?.external_id || post?.video_id || post?.post_id || post?.shortcode || videoId);

  let fallbackUrl: string | undefined;
  let platformLabel = "POST";
  if (inferredPlatform === "tiktok" && cleanHandle) {
    fallbackUrl = `https://www.tiktok.com/@${cleanHandle}/video/${displayId}`;
    platformLabel = "TIKTOK";
  } else if (inferredPlatform === "instagram") {
    fallbackUrl = `https://www.instagram.com/p/${displayId}/`;
    platformLabel = "INSTAGRAM";
  } else if (inferredPlatform === "youtube") {
    fallbackUrl = `https://www.youtube.com/watch?v=${displayId}`;
    platformLabel = "YOUTUBE";
  }

  // Fetch TikTok thumbnail via oEmbed if no thumb in Virlo payload
  const { data: oembed } = useQuery({
    queryKey: ["tiktok-oembed", cleanHandle, displayId],
    enabled: inferredPlatform === "tiktok" && !!cleanHandle && !post?.thumbnail_url && !post?.cover_url,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("tiktok-oembed", {
        body: { handle: cleanHandle, video_id: displayId },
      });
      if (error) return null;
      return data as { thumbnail_url?: string; video_url?: string; title?: string; post_url?: string };
    },
  });

  const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-proxy`;
  const proxify = (u?: string) =>
    u && /tiktokcdn|cdninstagram|fbcdn|muscdn/i.test(u) ? `${proxyBase}?url=${encodeURIComponent(u)}` : u;

  const rawThumb =
    post?.thumbnail_url || post?.thumbnail || post?.cover_url || post?.cover || post?.image_url || post?.display_url || post?.media_url || post?.image || post?.images?.[0]?.url || post?.media?.thumbnail_url || post?.video?.cover_url || oembed?.thumbnail_url;
  const thumb = proxify(rawThumb);

  const rawVideo =
    post?.video_url || post?.play_url || post?.download_url || oembed?.video_url || post?.media_url || post?.video?.play_addr?.url_list?.[0] || post?.video?.download_addr?.url_list?.[0] || post?.media?.video_url || post?.video?.url;
  const videoSrc = proxify(rawVideo);

  const url = postUrl || oembed?.post_url || fallbackUrl;
  const views = post?.views ?? post?.view_count ?? post?.play_count;
  const likes = post?.likes ?? post?.like_count;
  const caption = post?.caption || post?.title || post?.description || oembed?.title;

  // YouTube → embed iframe inline
  const isYouTube = inferredPlatform === "youtube";
  const isTikTok = inferredPlatform === "tiktok";
  const isInstagram = inferredPlatform === "instagram";
  const canEmbed = isYouTube || isTikTok || isInstagram || !!videoSrc;

  return (
    <div className="group block border border-border bg-background hover:border-primary/50 transition-colors overflow-hidden">
      <div className="aspect-[9/16] bg-muted overflow-hidden relative">
        {playing && isYouTube ? (
          <iframe
            src={`https://www.youtube.com/embed/${displayId}?autoplay=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : playing && isTikTok ? (
          <iframe
            src={`https://www.tiktok.com/embed/v2/${displayId}?lang=en-US`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : playing && isInstagram ? (
          <iframe
            src={`https://www.instagram.com/p/${displayId}/embed`}
            className="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : playing && videoSrc ? (
          <video
            src={videoSrc}
            poster={thumb}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-black"
          />
        ) : thumb ? (
          <>
            <img
              src={thumb}
              alt={caption?.slice(0, 60) || "post"}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            {canEmbed ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
                aria-label="Play video"
              >
                <span className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                </span>
              </button>
            ) : url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0"
                aria-label="Open post"
              />
            ) : null}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 via-muted to-background flex flex-col items-center justify-center gap-2 p-3 relative">
            {canEmbed ? <Play className="w-6 h-6 text-primary/70 fill-primary/40" /> : <ExternalLink className="w-5 h-5 text-primary/60" />}
            <span className="font-data text-[9px] text-muted-foreground tracking-wider">{platformLabel}</span>
            <code className="font-data text-[8px] text-muted-foreground/70 text-center break-all leading-tight">
              {videoId.slice(0, 14)}…
            </code>
            {canEmbed && <span className="font-data text-[8px] text-primary/80 tracking-wider">TAP TO PREVIEW</span>}
            {canEmbed && (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
                aria-label="Play video"
              >
                <span className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        {caption && (
          <p className="font-ui text-[10px] text-foreground leading-snug line-clamp-2">{caption}</p>
        )}
        {(views != null || likes != null) && (
          <div className="flex items-center justify-between font-data text-[9px] text-muted-foreground">
            <span>{views != null ? `${fmt(views)} views` : ""}</span>
            <span>{likes != null ? `❤ ${fmt(likes)}` : ""}</span>
          </div>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-data text-[9px] text-primary hover:underline"
          >
            OPEN ORIGINAL <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}
