import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Pause, Play, Trash2, Sparkles, Flame, Users, Eye, Video, Tag, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ViewsOverTimeChart } from "@/components/creator-hub/ViewsOverTimeChart";
import { PopularHashtags } from "@/components/creator-hub/PopularHashtags";
import { CreatorGrid } from "@/components/home/CreatorGrid";
import { NESTLE_CLUSTERS, nestleizeAll } from "@/lib/nestleize";

const fmt = (n?: number | null) => {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export default function NicheDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();

  const cometId = id!;
  /* Local niches are self-managed creator segments matched against the Starling
     roster — no Virlo comet behind them. */
  const isLocal = cometId.startsWith("local-");

  const { data: niche } = useQuery({
    queryKey: ["niche", cometId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comet_niches").select("*").eq("virlo_comet_id", cometId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cometId,
  });

  const callComet = (action: string, params: any = {}, force = false) => async () => {
    const { data, error } = await supabase.functions.invoke("virlo-proxy", {
      body: { action, comet_id: cometId, params, force_refresh: force },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data?.data?.data ?? data?.data;
  };

  const refreshAll = async () => {
    toast.info("Refreshing from Virlo…");
    await Promise.all([
      callComet("comet_get", {}, true)(),
      callComet("comet_analysis_latest", {}, true)(),
      callComet("comet_trends_latest", {}, true)(),
      callComet("comet_videos", { limit: 12, order_by: "views", sort: "desc" }, true)(),
      callComet("comet_outliers", { limit: 25, order_by: "outlier_ratio", sort: "desc" }, true)(),
    ]);
    qc.invalidateQueries({ queryKey: ["comet_get", cometId] });
    qc.invalidateQueries({ queryKey: ["comet_analysis", cometId] });
    qc.invalidateQueries({ queryKey: ["comet_trends", cometId] });
    qc.invalidateQueries({ queryKey: ["comet_videos", cometId] });
    qc.invalidateQueries({ queryKey: ["comet_outliers", cometId] });
    toast.success("Refreshed");
  };

  const { data: cometInfo } = useQuery({ queryKey: ["comet_get", cometId], queryFn: callComet("comet_get"), enabled: !!cometId && !isLocal });
  const { data: analysis } = useQuery({ queryKey: ["comet_analysis", cometId], queryFn: callComet("comet_analysis_latest"), enabled: !!cometId && !isLocal, retry: false });
  const { data: trends } = useQuery({ queryKey: ["comet_trends", cometId], queryFn: callComet("comet_trends_latest"), enabled: !!cometId && !isLocal, retry: false });
  const { data: videosResp } = useQuery({ queryKey: ["comet_videos", cometId], queryFn: callComet("comet_videos", { limit: 12, order_by: "views", sort: "desc" }), enabled: !!cometId && !isLocal, retry: false });
  const { data: allVideosResp } = useQuery({ queryKey: ["comet_videos_all", cometId], queryFn: callComet("comet_videos", { limit: 100, order_by: "publish_date", sort: "desc" }), enabled: !!cometId && !isLocal, retry: false });
  const { data: outliersResp } = useQuery({ queryKey: ["comet_outliers", cometId], queryFn: callComet("comet_outliers", { limit: 25, order_by: "outlier_ratio", sort: "desc" }), enabled: !!cometId && !isLocal, retry: false });

  /* Roster for local niches */
  const { data: rosterCreators = [] } = useQuery({
    queryKey: ["niche-roster", cometId],
    queryFn: async () => {
      const { data, error } = await supabase.from("creators").select("*").in("cluster", NESTLE_CLUSTERS).order("engagement_rate", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return nestleizeAll(data);
    },
    enabled: isLocal,
  });

  const videos = videosResp?.videos ?? [];
  const outliers = outliersResp?.outliers ?? [];
  const trendsList = trends?.trends ?? [];

  const togglePause = useMutation({
    mutationFn: async () => {
      const next = !niche?.is_active;
      if (!isLocal) {
        const { error } = await supabase.functions.invoke("virlo-proxy", {
          body: { action: "comet_update", comet_id: cometId, params: { is_active: next } },
        });
        if (error) throw error;
      }
      await supabase.from("comet_niches").update({ is_active: next }).eq("virlo_comet_id", cometId);
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["niche", cometId] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!isLocal) {
        await supabase.functions.invoke("virlo-proxy", { body: { action: "comet_delete", comet_id: cometId } });
      }
      await supabase.from("comet_niches").delete().eq("virlo_comet_id", cometId);
    },
    onSuccess: () => { toast.success("Deleted"); nav("/creators"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalVideos = videosResp?.total ?? 0;
  const totalCreators = outliersResp?.total ?? 0;
  const totalViews = videos.reduce((sum: number, v: any) => sum + (v.views ?? 0), 0);
  const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;

  /* ─── Local niche: roster-powered segment view ─── */
  if (isLocal) {
    const kws = (niche?.keywords ?? []).map((k: string) => k.toLowerCase());
    const intentCluster = niche?.intent || "";
    const matched = rosterCreators.filter((c: any) => {
      const hay = `${c.name ?? ""} ${c.handle ?? ""} ${c.bio ?? ""} ${c.brand ?? ""}`.toLowerCase();
      const kwHit = kws.some((k) => k.split(" ").some((w) => w.length > 3 && hay.includes(w)));
      return (intentCluster && c.cluster === intentCluster) || kwHit;
    });
    const reach = matched.reduce((s: number, c: any) => s + (Number(c.followers) || 0), 0);
    const ers = matched.map((c: any) => Number(c.engagement_rate) || 0).filter((n: number) => n > 0);
    const avgEr = ers.length ? ers.reduce((a: number, b: number) => a + b, 0) / ers.length : 0;
    const rois = matched.map((c: any) => Number(c.roi) || 0).filter((n: number) => n > 0);
    const avgRoi = rois.length ? rois.reduce((a: number, b: number) => a + b, 0) / rois.length : 0;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Link to="/creators" className="inline-flex items-center gap-1 font-data text-[10px] tracking-wider text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3 h-3" /> CREATOR HUB
              </Link>
              <h1 className="font-display text-4xl">{niche?.name ?? "Niche"}</h1>
              <p className="font-ui text-xs text-muted-foreground max-w-2xl">
                Self-managed niche — matched live from your Starling roster across {kws.length} keywords.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(niche?.keywords ?? []).map((kw: string) => (
                  <span key={kw} className="px-2 py-0.5 border border-border rounded-full font-data text-[9px] tracking-wider text-foreground">{kw}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => togglePause.mutate()} variant="outline" size="sm" className="font-data text-[10px] tracking-wider gap-2">
                {niche?.is_active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {niche?.is_active ? "PAUSE" : "RESUME"}
              </Button>
              <Button onClick={() => { if (confirm("Delete this niche?")) remove.mutate(); }}
                variant="outline" size="sm" className="font-data text-[10px] tracking-wider gap-2 text-destructive hover:text-destructive">
                <Trash2 className="w-3 h-3" /> DELETE
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "MATCHED CREATORS", value: String(matched.length), icon: Users },
              { label: "COMBINED REACH", value: fmt(reach), icon: Eye },
              { label: "AVG ENG. RATE", value: avgEr > 0 ? `${avgEr.toFixed(1)}%` : "—", icon: Flame },
              { label: "AVG ROI", value: avgRoi > 0 ? `${avgRoi.toFixed(1)}x` : "—", icon: Sparkles },
            ].map((s) => (
              <div key={s.label} className="border border-border bg-card rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <s.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-data text-[9px] tracking-[0.15em] text-muted-foreground">{s.label}</span>
                </div>
                <p className="font-display text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="-mx-8">
            <CreatorGrid creators={matched} loading={false} />
          </div>

          <p className="font-data text-[9px] text-muted-foreground tracking-wider">
            MATCHED FROM YOUR ROSTER BY KEYWORDS &amp; CLUSTER · VIRLO LIVE DISCOVERY CAN BE LAYERED ON TOP ONCE CREDITS ARE ACTIVE
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Link to="/creators" className="inline-flex items-center gap-1 font-data text-[10px] tracking-wider text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3 h-3" /> CREATOR HUB
            </Link>
            <h1 className="font-display text-4xl">{niche?.name ?? "Niche"}</h1>
            <p className="font-ui text-xs text-muted-foreground max-w-2xl">
              {niche?.intent || `Custom niche tracking ${(niche?.keywords ?? []).length} keywords across ${(niche?.platforms ?? []).join(", ")}.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refreshAll} variant="outline" size="sm" className="font-data text-[10px] tracking-wider gap-2">
              <RefreshCw className="w-3 h-3" /> REFRESH
            </Button>
            <Button onClick={() => togglePause.mutate()} variant="outline" size="sm" className="font-data text-[10px] tracking-wider gap-2">
              {niche?.is_active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {niche?.is_active ? "PAUSE" : "RESUME"}
            </Button>
            <Button onClick={() => { if (confirm("Delete this niche?")) remove.mutate(); }}
              variant="outline" size="sm" className="font-data text-[10px] tracking-wider gap-2 text-destructive hover:text-destructive">
              <Trash2 className="w-3 h-3" /> DELETE
            </Button>
          </div>
        </div>

        {/* Processing banner */}
        {cometInfo?.is_processing && (
          <div className="p-3 border border-primary/40 bg-primary/5 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            <div className="flex-1">
              <p className="font-ui text-xs text-foreground">Virlo is currently scraping your niche.</p>
              <p className="font-data text-[10px] tracking-wider text-muted-foreground mt-0.5">
                FIRST RESULTS USUALLY APPEAR WITHIN 5–10 MINUTES · CLICK REFRESH ABOVE
              </p>
            </div>
          </div>
        )}

        {/* Meta strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 border border-border bg-card">
          <div className="font-data text-[10px] tracking-wider">
            <span className="text-muted-foreground">CADENCE · </span>
            <span className="text-primary">{niche?.cadence?.toUpperCase()}</span>
          </div>
          <div className="font-data text-[10px] tracking-wider">
            <span className="text-muted-foreground">LAST RUN · </span>
            <span className="text-foreground">{cometInfo?.last_run_at ? new Date(cometInfo.last_run_at).toLocaleString() : "—"}</span>
          </div>
          <div className="font-data text-[10px] tracking-wider">
            <span className="text-muted-foreground">NEXT RUN · </span>
            <span className="text-foreground">{cometInfo?.next_run_at ? new Date(cometInfo.next_run_at).toLocaleString() : "—"}</span>
          </div>
          <div className="font-data text-[10px] tracking-wider flex flex-wrap gap-1.5">
            <span className="text-muted-foreground">KEYWORDS · </span>
            {(niche?.keywords ?? []).slice(0, 6).map((kw: string) => (
              <span key={kw} className="px-2 py-0.5 border border-border text-foreground">{kw}</span>
            ))}
            {(niche?.keywords ?? []).length > 6 && <span className="text-muted-foreground">+{(niche?.keywords ?? []).length - 6} more</span>}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Video, label: "VIDEOS", value: fmt(totalVideos) },
            { icon: Eye, label: "AVG VIEWS", value: fmt(avgViews) },
            { icon: Users, label: "OUTLIER CREATORS", value: fmt(totalCreators) },
            { icon: Tag, label: "TRENDS", value: fmt(trendsList.length) },
          ].map((s) => (
            <div key={s.label} className="p-4 border border-border bg-card">
              <s.icon className="w-3.5 h-3.5 text-primary mb-2" />
              <p className="font-display text-2xl text-foreground">{s.value}</p>
              <p className="font-data text-[9px] tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Analysis */}
        {analysis?.analysis && (
          <div className="p-5 border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <h2 className="font-display text-xl">AI Synthesis</h2>
            </div>
            <p className="font-ui text-sm text-foreground/90 leading-relaxed">{analysis.analysis}</p>
          </div>
        )}

        {/* Views over time + hashtags */}
        {(allVideosResp?.videos?.length ?? 0) > 0 && (
          <>
            <ViewsOverTimeChart videos={allVideosResp.videos} />
            <PopularHashtags videos={allVideosResp.videos} />
          </>
        )}

        {/* Trending themes */}
        {trendsList.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-2xl">Trending Topics</h2>
            <div className="space-y-2">
              {trendsList.map((t: any) => (
                <div key={t.id} className="p-4 border border-border bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-ui text-sm font-medium text-foreground">{t.name}</h3>
                        {t.status && <span className="font-data text-[9px] tracking-wider px-1.5 py-0.5 border border-primary/40 text-primary uppercase">{t.status}</span>}
                      </div>
                      {t.why_it_works && <p className="font-ui text-xs text-muted-foreground mt-1.5">{t.why_it_works}</p>}
                      {(t.tactics ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {t.tactics.slice(0, 5).map((tac: string, i: number) => (
                            <span key={i} className="font-data text-[9px] tracking-wider px-2 py-0.5 border border-border text-muted-foreground">{tac}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="font-data text-[10px] tracking-wider text-muted-foreground shrink-0">{t.video_count ?? 0} VIDEOS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most viral */}
        {videos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <h2 className="font-display text-2xl">Most Viral</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {videos.slice(0, 8).map((v: any) => (
                <a key={v.id} href={v.url} target="_blank" rel="noreferrer"
                  className="block border border-border bg-card hover:border-primary/40 transition-colors group">
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    {v.thumbnail_url && (
                      <img src={v.thumbnail_url.startsWith("http") ? v.thumbnail_url : `https://cdn.virlo.ai/thumbnails/${v.thumbnail_url}`}
                        alt="" className="w-full h-full object-cover" loading="lazy" />
                    )}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      <span className="font-data text-[9px] tracking-wider px-1.5 py-0.5 bg-background/80 backdrop-blur text-foreground">
                        {fmt(v.views)} views
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="font-ui text-[11px] text-foreground line-clamp-2 leading-snug">{v.description || "—"}</p>
                    <div className="flex items-center justify-between mt-2 font-data text-[9px] tracking-wider text-muted-foreground">
                      <span className="truncate">@{v.author?.username ?? "unknown"}</span>
                      <span className="uppercase">{v.type}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Outlier creators */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Outlier Creators</h2>
            <span className="font-data text-[10px] tracking-wider text-muted-foreground">
              {outliers.length} found · ranked by reach vs size
            </span>
          </div>
          {outliers.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-border">
              <Loader2 className="w-5 h-5 text-muted-foreground mx-auto mb-2 animate-spin" />
              <p className="font-ui text-xs text-muted-foreground">First run still processing — check back in a few minutes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {outliers.map((o: any, i: number) => (
                <div key={o.creator_url ?? i} className="p-3 border border-border bg-card flex items-center gap-4">
                  <span className="font-data text-xs text-muted-foreground w-6 text-center">{i + 1}</span>
                  {o.creator_avatar_url ? (
                    <img src={o.creator_avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted border border-border" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-ui text-sm font-medium text-foreground truncate">{o.creator_url?.split("@").pop() ?? "Creator"}</p>
                      <span className="font-data text-[9px] tracking-wider px-1.5 py-0.5 border border-border text-muted-foreground uppercase">{o.platform}</span>
                    </div>
                    <p className="font-data text-[10px] tracking-wider text-muted-foreground mt-0.5">
                      {fmt(o.follower_count)} followers · {fmt(o.avg_views)} avg views · {o.videos_analyzed} videos analyzed
                    </p>
                    {(o.matching_topics ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(o.matching_topics ?? []).slice(0, 5).map((t: string, j: number) => (
                          <span key={j} className="font-data text-[9px] px-1.5 py-0.5 border border-primary/30 text-primary">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-display text-xl text-primary">{(o.outlier_ratio ?? 0).toFixed(1)}x</p>
                      <p className="font-data text-[9px] tracking-wider text-muted-foreground">VS AVG</p>
                    </div>
                    {o.creator_url && (
                      <a href={o.creator_url} target="_blank" rel="noreferrer"
                        className="font-data text-[10px] tracking-wider px-2 py-1 border border-border hover:border-primary text-foreground inline-flex items-center gap-1">
                        VIEW <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
