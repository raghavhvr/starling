import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, ExternalLink, Heart, MessageCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

/* ─── Reddit SVG icon ─── */
const RedditIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={className} fill="currentColor">
    <path d="M15.8 10.3c0-.6-.5-1.1-1.1-1.1-.3 0-.6.1-.8.3-.8-.5-1.8-.9-2.9-.9l.5-2.4 1.7.4c0 .5.4.8.8.8.5 0 .8-.4.8-.8s-.4-.8-.8-.8c-.3 0-.6.2-.7.5L11.6 5.8c-.1 0-.2 0-.2.1s-.1.2-.1.2l-.6 2.7c-1.2.1-2.2.4-3 .9-.2-.2-.5-.3-.8-.3-.6 0-1.1.5-1.1 1.1 0 .4.2.8.6 1-.1.2-.1.5-.1.7 0 1.8 2.1 3.2 4.7 3.2s4.7-1.4 4.7-3.2c0-.2 0-.5-.1-.7.4-.3.6-.6.6-1zM8.3 11.1c0-.5.4-.8.8-.8s.8.4.8.8-.4.8-.8.8-.8-.3-.8-.8zm4.6 2.2c-.6.6-1.6.6-2 .6-.3 0-1.3 0-2-.6-.1-.1-.1-.2 0-.3.1-.1.2-.1.3 0 .4.4 1.2.5 1.6.5.5 0 1.2-.2 1.6-.5.1-.1.2-.1.3 0 .2.1.2.2.2.3zm-.2-1.4c-.5 0-.8-.4-.8-.8s.4-.8.8-.8.8.4.8.8-.3.8-.8.8z" />
  </svg>
);

/* ─── X/Twitter SVG icon ─── */
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ─── Instagram SVG icon ─── */
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

/* ─── TikTok SVG icon ─── */
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.8.1V9.01a6.27 6.27 0 0 0-.8-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.77 1.52V6.82a4.84 4.84 0 0 1-1.01-.13z" />
  </svg>
);

/* ─── Facebook SVG icon ─── */
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

type PlatformCfg = { label: string; color: string; Icon: React.FC<{ className?: string }> };

const platformConfig: Record<string, PlatformCfg> = {
  reddit: { label: "Reddit", color: "text-orange-400 bg-orange-500/15 border-orange-500/30", Icon: RedditIcon },
  instagram: { label: "Instagram", color: "text-pink-400 bg-pink-500/15 border-pink-500/30", Icon: InstagramIcon },
  tiktok: { label: "TikTok", color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30", Icon: TikTokIcon },
  facebook: { label: "Facebook", color: "text-blue-400 bg-blue-500/15 border-blue-500/30", Icon: FacebookIcon },
  twitter: { label: "X / Twitter", color: "text-neutral-300 bg-neutral-500/15 border-neutral-500/30", Icon: XIcon },
};

interface TrendDetailPanelProps {
  trend: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    relevance_score: number | null;
  };
  onClose: () => void;
}

export function TrendDetailPanel({ trend, onClose }: TrendDetailPanelProps) {
  const queryClient = useQueryClient();
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["trend-comments", trend.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trend_comments")
        .select("*")
        .eq("trend_id", trend.id)
        .order("likes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-trend-comments", {
        body: {
          trend_id: trend.id,
          topic: trend.title,
          platforms: ["reddit", "instagram", "tiktok", "facebook", "twitter"],
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["trend-comments", trend.id] });
      queryClient.invalidateQueries({ queryKey: ["trend-insights", trend.id] });
      toast.success(`Scraped ${data.count} posts across ${Object.keys(data.platforms || {}).length} platforms`);
    },
    onError: (err) => {
      toast.error("Failed to scrape: " + (err as Error).message);
    },
  });

  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ["trend-insights", trend.id],
    enabled: showInsights && comments.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("summarize-trend-comments", {
        body: { trend_id: trend.id, trend_title: trend.title },
      });
      if (error) throw error;
      return data;
    },
  });

  const platforms = [...new Set(comments.map((c: any) => c.platform))];
  const filtered = activePlatform
    ? comments.filter((c: any) => c.platform === activePlatform)
    : comments;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col bg-background border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 bg-card">
        <div className="flex-1 min-w-0">
          <p className="font-data text-[10px] tracking-[0.2em] text-primary mb-1">
            {trend.category || "TREND"} · {trend.relevance_score}%
          </p>
          <h2 className="font-display text-base font-semibold text-foreground leading-snug">
            {trend.title}
          </h2>
          <p className="font-ui text-xs text-muted-foreground mt-1 line-clamp-2">
            {trend.description}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Platform filter tabs + action buttons */}
      <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setActivePlatform(null)}
            className={`px-2.5 py-1 rounded text-[10px] font-data tracking-wider border transition-colors ${
              activePlatform === null
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            ALL ({comments.length})
          </button>
          {platforms.map((p: string) => {
            const cfg = platformConfig[p];
            if (!cfg) return null;
            const count = comments.filter((c: any) => c.platform === p).length;
            return (
              <button
                key={p}
                onClick={() => setActivePlatform(activePlatform === p ? null : p)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-data tracking-wider border transition-colors ${
                  activePlatform === p ? cfg.color : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <cfg.Icon className="w-3 h-3" />
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 shrink-0">
          {comments.length > 0 && (
            <button
              onClick={() => { setShowInsights(true); if (insights) refetchInsights(); }}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[10px] font-data tracking-wider text-primary transition-all disabled:opacity-50"
            >
              {insightsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Insights
            </button>
          )}
          <button
            onClick={() => scrapeMutation.mutate()}
            disabled={scrapeMutation.isPending}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card hover:bg-muted text-[10px] font-data tracking-wider text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            {scrapeMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {scrapeMutation.isPending ? "Scraping…" : "Scrape"}
          </button>
        </div>
      </div>

      {/* AI Insights panel */}
      {showInsights && (
        <div className="border-b border-border px-5 py-4 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="font-data text-[10px] tracking-[0.2em] text-primary">AI INTELLIGENCE</span>
            </div>
            <button onClick={() => setShowInsights(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
          {insightsLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="font-ui text-xs text-muted-foreground">Analyzing {comments.length} posts with AI…</span>
            </div>
          ) : insights?.summary ? (
            <div className="prose prose-sm prose-invert max-w-none font-ui text-xs text-foreground/80 leading-relaxed [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_strong]:text-foreground [&_li]:text-foreground/80 [&_p]:text-foreground/80">
              <ReactMarkdown>{insights.summary}</ReactMarkdown>
            </div>
          ) : (
            <p className="font-ui text-xs text-muted-foreground">No insights available.</p>
          )}
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="font-ui text-sm text-muted-foreground mb-2">
              No social media posts found yet
            </p>
            <p className="font-ui text-xs text-muted-foreground/60 mb-4">
              Click "Scrape" to pull relevant posts from Reddit, Instagram, TikTok, Facebook & X
            </p>
            <button
              onClick={() => scrapeMutation.mutate()}
              disabled={scrapeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded border border-primary/30 bg-primary/10 text-xs font-ui text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {scrapeMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {scrapeMutation.isPending ? "Scraping live posts…" : "Scrape live posts"}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((comment: any) => {
              const cfg = platformConfig[comment.platform];
              if (!cfg) return null;
              return (
                <div key={comment.id} className="px-5 py-3.5 hover:bg-card/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-data tracking-wider border ${cfg.color}`}>
                      <cfg.Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <span className="font-data text-[11px] text-foreground font-medium">
                      {comment.author || "anonymous"}
                    </span>
                    {comment.metadata?.subreddit && (
                      <span className="font-data text-[10px] text-muted-foreground">
                        r/{comment.metadata.subreddit}
                      </span>
                    )}
                    {comment.source_url && (
                      <a
                        href={comment.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="font-ui text-xs text-foreground/80 leading-relaxed line-clamp-4">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    {(comment.likes || 0) > 0 && (
                      <span className="flex items-center gap-1 font-data text-[10px] text-muted-foreground">
                        <Heart className="w-3 h-3" /> {comment.likes.toLocaleString()}
                      </span>
                    )}
                    {(comment.replies || 0) > 0 && (
                      <span className="flex items-center gap-1 font-data text-[10px] text-muted-foreground">
                        <MessageCircle className="w-3 h-3" /> {comment.replies.toLocaleString()}
                      </span>
                    )}
                    {comment.metadata?.views && Number(comment.metadata.views) > 0 && (
                      <span className="font-data text-[10px] text-muted-foreground">
                        👁 {Number(comment.metadata.views).toLocaleString()} views
                      </span>
                    )}
                    {comment.metadata?.shares && Number(comment.metadata.shares) > 0 && (
                      <span className="font-data text-[10px] text-muted-foreground">
                        🔄 {Number(comment.metadata.shares).toLocaleString()} shares
                      </span>
                    )}
                    {comment.metadata?.retweets && Number(comment.metadata.retweets) > 0 && (
                      <span className="font-data text-[10px] text-muted-foreground">
                        🔁 {Number(comment.metadata.retweets).toLocaleString()} retweets
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
