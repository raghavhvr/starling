import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PLATFORMS = ["youtube", "tiktok", "instagram"] as const;
const CADENCES = ["daily", "weekly", "monthly"] as const;
const TIME_RANGES = ["today", "this_week", "this_month", "this_year"] as const;

export function CreateNicheDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram"]);
  const [cadence, setCadence] = useState<string>("weekly");
  const [timeRange, setTimeRange] = useState<string>("this_week");
  const [minViews, setMinViews] = useState("10000");
  const [intent, setIntent] = useState("");

  const reset = () => {
    setName(""); setKeywords(""); setPlatforms(["tiktok", "instagram"]);
    setCadence("weekly"); setTimeRange("this_week"); setMinViews("10000"); setIntent("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const kw = keywords.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
      if (!name.trim()) throw new Error("Name required");
      if (kw.length === 0) throw new Error("At least one keyword required");
      if (platforms.length === 0) throw new Error("Select at least one platform");

      const { data, error } = await supabase.functions.invoke("virlo-proxy", {
        body: {
          action: "comet_create",
          params: {
            name: name.trim(),
            keywords: kw,
            platforms,
            cadence,
            min_views: parseInt(minViews) || 0,
            time_range: timeRange,
            is_active: true,
            intent: intent.trim() || undefined,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const inner = data?.data?.data ?? data?.data;
      const virloId = inner?.id;
      if (!virloId) throw new Error("No comet id in response");

      const { data: userRes } = await supabase.auth.getUser();
      const { error: insertErr } = await supabase.from("comet_niches").insert({
        virlo_comet_id: virloId,
        name: name.trim(),
        keywords: kw,
        platforms,
        cadence,
        min_views: parseInt(minViews) || 0,
        time_range: timeRange,
        is_active: true,
        intent: intent.trim() || null,
        created_by: userRes.user?.id ?? null,
      });
      if (insertErr) throw insertErr;
      return virloId;
    },
    onSuccess: () => {
      toast.success("Niche created. First scrape running…");
      qc.invalidateQueries({ queryKey: ["comet_niches"] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Create Custom Niche</DialogTitle>
          <p className="font-ui text-xs text-muted-foreground mt-1">
            Continuously discover videos & outlier creators across YouTube, TikTok, Instagram.
            Costs $0.50 per scheduled run.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="font-data text-[10px] tracking-wider text-muted-foreground">NAME</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MENA Food Trends" className="font-ui text-sm mt-1" />
          </div>

          <div>
            <Label className="font-data text-[10px] tracking-wider text-muted-foreground">KEYWORDS · COMMA-SEPARATED · MAX 20</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)}
              placeholder="niacinamide, arabic GRWM, oud fragrance" className="font-data text-xs mt-1" />
          </div>

          <div>
            <Label className="font-data text-[10px] tracking-wider text-muted-foreground">PLATFORMS</Label>
            <div className="flex gap-2 mt-1">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className={`font-data text-[10px] tracking-wider px-3 py-1.5 border transition-colors ${
                    platforms.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="font-data text-[10px] tracking-wider text-muted-foreground">CADENCE</Label>
              <select value={cadence} onChange={(e) => setCadence(e.target.value)}
                className="w-full mt-1 bg-card border border-border h-9 px-2 font-data text-xs">
                {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="font-data text-[10px] tracking-wider text-muted-foreground">TIME RANGE</Label>
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
                className="w-full mt-1 bg-card border border-border h-9 px-2 font-data text-xs">
                {TIME_RANGES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label className="font-data text-[10px] tracking-wider text-muted-foreground">MIN VIEWS</Label>
              <Input type="number" value={minViews} onChange={(e) => setMinViews(e.target.value)}
                className="font-data text-xs mt-1 h-9" />
            </div>
          </div>

          <div>
            <Label className="font-data text-[10px] tracking-wider text-muted-foreground">INTENT · OPTIONAL</Label>
            <Input value={intent} onChange={(e) => setIntent(e.target.value)}
              placeholder="What's the goal of this niche?" className="font-ui text-xs mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}
              className="font-data text-[10px] tracking-wider">CANCEL</Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}
              className="font-data text-[10px] tracking-wider gap-2">
              {create.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              CREATE NICHE · $0.50
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
