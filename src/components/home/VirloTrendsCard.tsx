import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, RefreshCw, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface VirloTrend {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  category?: string;
  platform?: string;
  ranking?: number;
  url?: string;
  groupTitle?: string;
}

export function VirloTrendsCard() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<VirloTrend | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["virlo-trends-digest"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("virlo-proxy", {
        body: { action: "trends_digest" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  const refresh = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("virlo-proxy", {
        body: { action: "trends_digest", force_refresh: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virlo-trends-digest"] });
      toast.success("Cross-platform trends refreshed");
    },
    onError: (e) => toast.error("Refresh failed: " + (e as Error).message),
  });

  const trends = useMemo<VirloTrend[]>(() => {
    const root = data?.data?.data ?? data?.data;
    if (!root) return [];

    const groups = Array.isArray(root) ? root : [root];
    const flat: VirloTrend[] = [];

    for (const group of groups) {
      const groupTitle = group?.title;
      const items = group?.trends ?? group?.items ?? (Array.isArray(group) ? group : null);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const t = item?.trend ?? item;
        flat.push({
          id: item?.id ?? t?.id,
          title: t?.name ?? t?.title,
          description: t?.description ?? t?.summary,
          category: t?.trend_type ?? t?.category,
          ranking: item?.ranking ?? t?.ranking,
          url: t?.url,
          groupTitle,
        });
      }
    }
    // Legacy Virlo account tracks beauty orbits — hide those for the Nestlé view
    const beautyRe = /\b(beauty|makeup|make-up|skincare|skin care|haircare|hair care|fragrance|cosmetics?|lashes?|mascara|lipstick|serum|moisturi[sz]er|foundation|blush|eyeliner|perfume|salon|manicure|contour)\b/i;
    return flat
      .filter((t) => !beautyRe.test(`${t.title ?? ""} ${t.description ?? ""} ${t.category ?? ""} ${t.groupTitle ?? ""}`))
      .slice(0, 12);
  }, [data]);

  const cachedAt = data?.expires_at
    ? new Date(new Date(data.expires_at).getTime() - 7 * 86_400_000)
    : null;

  return (
    <div className="px-8 py-6 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-primary" />
          <span className="font-data text-[11px] tracking-[0.15em] text-foreground">
            CROSS-PLATFORM TRENDS
          </span>
          <span className="font-data text-[10px] text-muted-foreground tracking-wider">
            TIKTOK · YOUTUBE · INSTAGRAM
          </span>
          {data?.cached && cachedAt && (
            <span className="font-data text-[9px] text-muted-foreground tracking-wider">
              · CACHED {cachedAt.toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="flex items-center gap-2 px-3 py-1.5 border border-border bg-card hover:bg-muted text-xs font-ui text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
          {refresh.isPending ? "Fetching…" : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border">
          <Globe className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No trends loaded yet.</p>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Fetch today's cross-platform digest
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {trends.map((t, i) => {
            const title = t.title || t.name || `Trend #${i + 1}`;
            const desc = t.description || t.summary || "";
            return (
              <button
                key={t.id || i}
                onClick={() => setSelected(t)}
                className="text-left p-4 bg-card border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  {t.category && (
                    <span className="px-2 py-0.5 text-[10px] font-data tracking-wider border border-border text-muted-foreground">
                      {t.category}
                    </span>
                  )}
                  {t.ranking && (
                    <span className="font-data text-[10px] text-primary font-semibold">
                      #{t.ranking}
                    </span>
                  )}
                </div>
                <h4 className="font-ui text-sm font-medium text-foreground leading-snug mb-1 line-clamp-2">
                  {title}
                </h4>
                {desc && (
                  <p className="font-ui text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {desc}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && <TrendDetail trend={selected} onClose={() => setSelected(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TrendDetail({ trend, onClose }: { trend: VirloTrend; onClose: () => void }) {
  const title = trend.title || trend.name || "Trend";
  const desc = trend.description || trend.summary || "";
  const query = encodeURIComponent(title);

  const { data: videosResp, isLoading: videosLoading } = useQuery({
    queryKey: ["virlo-videos-digest"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("virlo-proxy", {
        body: { action: "videos_digest", params: { limit: 50 } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    staleTime: 1000 * 60 * 60,
  });

  const allVideos: any[] = videosResp?.data?.data ?? videosResp?.data ?? [];

  // Try to match videos to this trend by keywords
  const keywords = title
    .toLowerCase()
    .replace(/[^\w\s#]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scored = allVideos
    .map((v) => {
      const hay = `${v.description ?? ""} ${(v.hashtags ?? []).join(" ")}`.toLowerCase();
      const score = keywords.reduce((s, k) => s + (hay.includes(k) ? 1 : 0), 0);
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);

  const matched = scored.filter((s) => s.score > 0).map((s) => s.v);
  const videos = (matched.length > 0 ? matched : allVideos).slice(0, 12);
  const isFallback = matched.length === 0 && videos.length > 0;

  const links = [
    { label: "TikTok", url: `https://www.tiktok.com/search?q=${query}` },
    { label: "YouTube", url: `https://www.youtube.com/results?search_query=${query}` },
    { label: "Instagram", url: `https://www.instagram.com/explore/tags/${encodeURIComponent(title.replace(/\s+/g, "").toLowerCase())}/` },
    { label: "Google", url: `https://www.google.com/search?q=${query}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {trend.groupTitle && (
            <p className="font-data text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              {trend.groupTitle}
            </p>
          )}
          <h2 className="font-display text-2xl text-foreground leading-tight">{title}</h2>
          <div className="flex items-center gap-2">
            {trend.ranking && (
              <span className="font-data text-[11px] text-primary font-semibold">
                RANK #{trend.ranking}
              </span>
            )}
            {trend.category && (
              <span className="px-2 py-0.5 text-[10px] font-data tracking-wider border border-border text-muted-foreground uppercase">
                {trend.category}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {desc && (
        <div>
          <p className="font-data text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-2">
            Why it's trending
          </p>
          <p className="font-ui text-sm text-foreground leading-relaxed">{desc}</p>
        </div>
      )}

      <div>
        <p className="font-data text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-3">
          {isFallback ? "Top viral videos right now" : "Related viral videos"}
          {isFallback && (
            <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal">
              · no exact matches for this trend
            </span>
          )}
        </p>
        {videosLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-video bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <p className="font-ui text-xs text-muted-foreground">No videos available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {videos.map((v) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="group block border border-border bg-card hover:border-primary/50 transition-colors overflow-hidden"
              >
                {v.thumbnail_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img
                      src={v.thumbnail_url}
                      alt={v.description ?? "video"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted" />
                )}
                <div className="p-2 space-y-1">
                  <p className="font-ui text-[11px] text-foreground line-clamp-2 leading-snug">
                    {v.description || "Untitled"}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-[10px] font-data text-muted-foreground">
                    <span className="uppercase tracking-wider">{v.type}</span>
                    {typeof v.views === "number" && (
                      <span>{Intl.NumberFormat("en", { notation: "compact" }).format(v.views)} views</span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="font-data text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-3">
          Search on platforms
        </p>
        <div className="grid grid-cols-2 gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 border border-border bg-card hover:border-primary/50 hover:bg-muted text-sm font-ui text-foreground transition-colors"
            >
              <span>{l.label}</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
