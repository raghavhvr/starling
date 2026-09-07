import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Plus, Telescope, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateNicheDialog } from "./CreateNicheDialog";

/* Legacy niches in the shared DB are beauty-focused — hide them from the Nestlé view */
const BEAUTY_NICHE_RE = /\b(beauty|skincare|makeup|glam|hijabi|abaya|mascara|cosmetic|fragrance|haircare)\b/i;

function isBeautyNiche(n: any): boolean {
  return BEAUTY_NICHE_RE.test(`${n.name ?? ""} ${(n.keywords ?? []).join(" ")}`);
}

/* Staged Nestlé food niches — become live Virlo trackers once credits are topped up */
const STAGED_NICHES = [
  {
    id: "staged-1",
    name: "MENA Food & Recipe Creators",
    keywords: ["home cooking", "arabic recipes", "iftar", "one-pot meals", "noodle hacks"],
    platforms: ["tiktok", "instagram", "youtube"],
    cadence: "weekly",
  },
  {
    id: "staged-2",
    name: "Moms & Family Nutrition",
    keywords: ["lunchbox ideas", "kids nutrition", "school breakfast", "family meals"],
    platforms: ["tiktok", "instagram"],
    cadence: "weekly",
  },
  {
    id: "staged-3",
    name: "Home Coffee & Beverages",
    keywords: ["iced coffee", "home barista", "spanish latte", "dalgona"],
    platforms: ["tiktok", "instagram", "youtube"],
    cadence: "weekly",
  },
];

export function NichesPanel() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: allNiches = [], isLoading } = useQuery({
    queryKey: ["comet_niches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comet_niches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const niches = allNiches.filter((n: any) => !isBeautyNiche(n));
  const showStaged = niches.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Telescope className="w-3 h-3 text-primary" />
          <span className="font-data text-[10px] tracking-wider text-muted-foreground">CUSTOM NICHES</span>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="font-data text-[10px] tracking-wider text-primary hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> NEW
        </button>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {isLoading && (
          <p className="font-data text-[10px] text-muted-foreground/60 py-2">Loading…</p>
        )}

        {!isLoading && niches.map((n: any) => (
          <Link key={n.id} to={`/creators/niche/${n.virlo_comet_id}`}
            className="block p-2.5 border border-border hover:border-primary/40 transition-colors group">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-ui text-xs font-medium text-foreground truncate">{n.name}</p>
                <p className="font-data text-[9px] text-muted-foreground tracking-wider mt-0.5 truncate">
                  {(n.platforms ?? []).join(" · ").toUpperCase()} · {n.cadence?.toUpperCase()} · {(n.keywords ?? []).length} KW
                </p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
            </div>
          </Link>
        ))}

        {!isLoading && showStaged && (
          <>
            {STAGED_NICHES.map((n) => (
              <div key={n.id} className="p-2.5 border border-dashed border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-xs font-medium text-foreground truncate">{n.name}</p>
                    <p className="font-data text-[9px] text-muted-foreground tracking-wider mt-0.5 truncate">
                      {n.platforms.join(" · ").toUpperCase()} · {n.cadence.toUpperCase()} · {n.keywords.length} KW
                    </p>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                </div>
              </div>
            ))}
            <p className="font-data text-[8px] text-muted-foreground tracking-wider px-0.5">
              STAGED · LIVE TRACKING ACTIVATES WITH VIRLO CREDITS
            </p>
          </>
        )}
      </div>

      <CreateNicheDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
