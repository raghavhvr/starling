import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Plus, CheckCircle2, Instagram } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface PreviewResult {
  handle: string;
  platform: "instagram" | "tiktok";
  name?: string;
  avatar_url?: string;
  followers?: number;
  bio?: string;
  added?: boolean;
  creator_id?: string;
}

const PLATFORMS: { key: "instagram" | "tiktok"; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

function formatFollowers(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function AddCreatorDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [addingHandle, setAddingHandle] = useState<string | null>(null);

  const reset = () => {
    setQuery("");
    setResults([]);
    setSearching(false);
    setAddingHandle(null);
  };

  const runSearch = async () => {
    const handle = query.trim().replace(/^@/, "").replace(/\/$/, "");
    if (!handle) return;
    setSearching(true);
    setResults([]);
    try {
      // Show an immediate placeholder card so user can act
      setResults([{ handle, platform }]);
    } finally {
      setSearching(false);
    }
  };

  const addCreator = async (r: PreviewResult) => {
    setAddingHandle(r.handle);
    try {
      const fn = r.platform === "tiktok" ? "scrape-tiktok" : "scrape-instagram";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { handles: [r.handle] },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      if (result?.status === "no_data") {
        toast.error(`No ${r.platform} profile found for @${r.handle}`);
        return;
      }
      if (result?.status === "error") {
        toast.error(result.error || "Failed to add creator");
        return;
      }
      // Re-fetch the freshly created creator for preview card
      const { data: creatorRow } = await supabase
        .from("creators")
        .select("id, name, avatar_url, followers, bio")
        .eq("handle", `@${r.handle}`)
        .maybeSingle();

      setResults((prev) =>
        prev.map((p) =>
          p.handle === r.handle
            ? {
                ...p,
                added: true,
                creator_id: creatorRow?.id,
                name: creatorRow?.name,
                avatar_url: creatorRow?.avatar_url || undefined,
                followers: creatorRow?.followers || undefined,
                bio: creatorRow?.bio || undefined,
              }
            : p,
        ),
      );
      toast.success(`Added ${creatorRow?.name || r.handle} to your roster`);
      qc.invalidateQueries({ queryKey: ["creators-hub"] });
      qc.invalidateQueries({ queryKey: ["creators"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddingHandle(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add Creator</DialogTitle>
          <p className="font-ui text-xs text-muted-foreground mt-1">
            Search by social handle. We'll pull their profile, followers, and recent posts automatically.
          </p>
        </DialogHeader>

        {/* Platform tabs */}
        <div className="flex gap-1.5 mt-4">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`font-data text-[10px] tracking-wider px-3 py-1.5 border transition-colors ${
                platform === p.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              }`}
            >
              {p.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data text-xs text-muted-foreground">
              @
            </span>
            <Input
              autoFocus
              placeholder="yaraazizi"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              className="pl-7 font-data text-xs"
            />
          </div>
          <Button
            onClick={runSearch}
            disabled={!query.trim() || searching}
            className="font-data text-xs gap-2"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Search
          </Button>
        </div>

        <p className="font-data text-[9px] text-muted-foreground/70 tracking-wider mt-2">
          ENTER A HANDLE · CLICK ADD TO IMPORT REAL PROFILE DATA
        </p>

        {/* Results */}
        <div className="mt-4 space-y-2 min-h-[120px]">
          {results.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border">
              <Search className="w-6 h-6 text-muted-foreground/50 mx-auto mb-2" />
              <p className="font-ui text-xs text-muted-foreground">
                Type a handle and press Enter to find a creator.
              </p>
            </div>
          ) : (
            results.map((r) => (
              <div
                key={`${r.platform}-${r.handle}`}
                className="flex items-center gap-3 p-3 border border-border bg-card"
              >
                {r.avatar_url ? (
                  <img
                    src={r.avatar_url}
                    alt={r.handle}
                    className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center border border-border shrink-0">
                    <Instagram className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm font-medium text-foreground truncate">
                    {r.name || `@${r.handle}`}
                  </p>
                  <p className="font-data text-[10px] text-muted-foreground tracking-wide truncate">
                    @{r.handle} · {r.platform.toUpperCase()}
                    {r.followers ? ` · ${formatFollowers(r.followers)} followers` : ""}
                  </p>
                  {r.bio && (
                    <p className="font-ui text-[11px] text-muted-foreground/80 line-clamp-1 mt-0.5">
                      {r.bio}
                    </p>
                  )}
                </div>
                {r.added ? (
                  <span className="inline-flex items-center gap-1 font-data text-[10px] tracking-wider text-accent shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ADDED
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => addCreator(r)}
                    disabled={addingHandle === r.handle}
                    className="font-data text-[10px] tracking-wider h-8 gap-1.5 shrink-0"
                  >
                    {addingHandle === r.handle ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    {addingHandle === r.handle ? "ADDING…" : "ADD"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
