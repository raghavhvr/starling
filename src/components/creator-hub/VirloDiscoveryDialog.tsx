import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface OrbitVideo {
  id?: string;
  title?: string;
  caption?: string;
  url?: string;
  platform?: string;
  views?: number;
  likes?: number;
  creator_handle?: string;
  creator_name?: string;
  creator_avatar?: string;
  creator_followers?: number;
}

export function VirloDiscoveryDialog({ open, onOpenChange }: Props) {
  const [keywords, setKeywords] = useState("");
  const [orbitId, setOrbitId] = useState<string | null>(null);
  const [videos, setVideos] = useState<OrbitVideo[]>([]);
  const [polling, setPolling] = useState(false);

  const startSearch = useMutation({
    mutationFn: async () => {
      const list = keywords.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
      if (list.length === 0) throw new Error("Enter at least one keyword");
      const { data, error } = await supabase.functions.invoke("virlo-proxy", {
        body: {
          action: "orbit_create",
          params: { name: `MENA Food: ${list.join(", ")}`, keywords: list },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const id = data?.data?.data?.orbit_id || data?.data?.orbit_id || data?.data?.id;
      if (!id) {
        toast.error("No orbit_id in response");
        return;
      }
      setOrbitId(id);
      toast.success("Search queued. Polling for results…");
      pollResults(id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [statusLabel, setStatusLabel] = useState("Queued…");

  const pollResults = async (id: string, attempt = 0) => {
    if (attempt > 60) {
      setPolling(false);
      setStatusLabel("Timed out");
      toast.error("Search is taking too long. Try again later.");
      return;
    }
    setPolling(true);

    // 1. Check status (cheap endpoint, force_refresh to skip cache)
    const { data: statusData } = await supabase.functions.invoke("virlo-proxy", {
      body: { action: "orbit_get", orbit_id: id, force_refresh: true },
    });
    const inner = statusData?.data?.data ?? statusData?.data;
    const status = inner?.status;

    if (status === "failed") {
      setPolling(false);
      setStatusLabel("Failed");
      toast.error("Discovery job failed");
      return;
    }

    if (status !== "completed") {
      setStatusLabel(
        status === "queued" ? "Queued…" : `Analyzing videos (${attempt * 5}s)…`,
      );
      setTimeout(() => pollResults(id, attempt + 1), 5000);
      return;
    }

    // 2. Job completed — fetch the videos
    setStatusLabel("Loading videos…");
    const { data, error } = await supabase.functions.invoke("virlo-proxy", {
      body: { action: "orbit_videos", orbit_id: id, params: { page: 1, limit: 24 }, force_refresh: true },
    });
    if (error || data?.error) {
      setPolling(false);
      toast.error("Failed to load videos");
      return;
    }
    const list: OrbitVideo[] =
      data?.data?.data?.videos || data?.data?.videos || [];
    setVideos(list);
    setPolling(false);
    if (list.length > 0) toast.success(`Found ${list.length} videos`);
    else toast.info("Search completed but no videos matched");
  };

  const reset = () => {
    setKeywords("");
    setOrbitId(null);
    setVideos([]);
    setPolling(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Discover New Creators
          </DialogTitle>
          <p className="font-ui text-xs text-muted-foreground mt-1">
            Search across TikTok, YouTube, and Instagram by topic. Results cached for 7 days.
          </p>
        </DialogHeader>

        <div className="flex gap-2 my-4">
          <Input
            placeholder="e.g. niacinamide, arabic GRWM, oud fragrance"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={startSearch.isPending || polling}
            className="font-data text-xs"
          />
          <Button
            onClick={() => startSearch.mutate()}
            disabled={startSearch.isPending || polling || !keywords.trim()}
            className="font-data text-xs gap-2"
          >
            {startSearch.isPending || polling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {polling ? "Analyzing…" : "Search"}
          </Button>
        </div>

        <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-3">
          COMMA-SEPARATED · MAX 5 KEYWORDS · CACHED 7 DAYS
        </p>

        {videos.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-ui text-sm text-muted-foreground">
              {polling
                ? statusLabel
                : "Enter food & lifestyle keywords to discover trending MENA creators."}
            </p>
            {polling && (
              <p className="font-data text-[10px] text-muted-foreground/60 mt-2">
                Typically takes 1–3 minutes
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {videos.map((v, i) => (
              <div
                key={v.id || i}
                className="p-4 bg-card border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  {v.creator_avatar && (
                    <img
                      src={v.creator_avatar}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-border"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-ui text-xs font-medium text-foreground truncate">
                      {v.creator_name || v.creator_handle || "Unknown"}
                    </p>
                    {v.creator_handle && (
                      <p className="font-data text-[9px] text-muted-foreground truncate">
                        @{v.creator_handle.replace("@", "")}
                      </p>
                    )}
                  </div>
                  {v.platform && (
                    <span className="ml-auto px-1.5 py-0.5 text-[9px] font-data tracking-wider border border-border text-muted-foreground">
                      {v.platform.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="font-ui text-xs text-muted-foreground line-clamp-3 mb-2">
                  {v.title || v.caption || "—"}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 font-data text-[10px] text-muted-foreground">
                    {v.views ? <span>{Intl.NumberFormat().format(v.views)} views</span> : null}
                    {v.likes ? <span>{Intl.NumberFormat().format(v.likes)} likes</span> : null}
                  </div>
                  {v.url && (
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-data text-primary hover:underline"
                    >
                      Watch <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
