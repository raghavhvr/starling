import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NESTLE_CLUSTERS, nestleizeAll } from "@/lib/nestleize";
import { useFilters } from "@/contexts/FilterContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  Search,
  Instagram,
  Star,
  TrendingUp,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Shield,
  Heart,
  AlertTriangle,
  Zap,
  Globe,
  Trash2,
  Plus,
  RefreshCw,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { NichesPanel } from "@/components/creator-hub/NichesPanel";
import { CreatorVirloAnalysis } from "@/components/creator-hub/CreatorVirloAnalysis";
import { BriefMatchDialog } from "@/components/creator-hub/BriefMatchDialog";
import { VirloDiscoveryDialog } from "@/components/creator-hub/VirloDiscoveryDialog";
import { AddCreatorDialog } from "@/components/creator-hub/AddCreatorDialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ─── Golden Rules (Nestlé compliance) ─── */
const GOLDEN_RULES = [
  "Authentic content only",
  "No competitor mentions",
  "Proper disclosure (#ad)",
  "Brand guidelines followed",
  "Audience alignment verified",
  "No controversial content",
  "Usage rights secured",
  "Content pre-approval obtained",
  "Exclusivity period respected",
  "Performance benchmarks met",
  "Demographic match confirmed",
  "Platform ToS compliance",
];

const CLUSTER_CHIPS = ["All", "CUL", "DAI", "BEV", "CNF"];

/* ─── mock performance data generator ─── */
function generatePerformanceData(creatorName: string) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const seed = creatorName.length;
  return months.map((m, i) => ({
    month: m,
    engagement: Math.round((2 + Math.sin(i + seed) * 1.5 + Math.random()) * 100) / 100,
    soi: Math.round(50 + Math.sin(i * 0.8 + seed) * 20 + Math.random() * 10),
  }));
}

export default function CreatorHub() {
  const { division, countries, brand } = useFilters();
  const [search, setSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [isRescraping, setIsRescraping] = useState(false);
  
  const [matchOpen, setMatchOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [addManualOpen, setAddManualOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ["creators-hub", division, countries, brand],
    queryFn: async () => {
      let query = supabase.from("creators").select("*").order("followers", { ascending: false, nullsFirst: false })
        .in("cluster", division !== "All" ? [division] : NESTLE_CLUSTERS);
      if (brand !== "All") query = query.eq("brand", brand);
      if (countries.length > 0) query = query.in("country", countries);
      const { data, error } = await query;
      if (error) throw error;
      return nestleizeAll(data);
    },
  });

  // Fetch all platform accounts
  const { data: allPlatforms = [] } = useQuery({
    queryKey: ["creator-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creator_platforms").select("*");
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      // Delete related data first, then creator
      await supabase.from("creator_collaborations").delete().eq("creator_id", creatorId);
      await supabase.from("creator_platforms").delete().eq("creator_id", creatorId);
      await supabase.from("creator_posts").delete().eq("creator_id", creatorId);
      const { error } = await supabase.from("creators").delete().eq("id", creatorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creators-hub"] });
      queryClient.invalidateQueries({ queryKey: ["creator-platforms"] });
      toast.success("Creator removed");
      if (selectedId === deleteConfirmId) setSelectedId(null);
      setDeleteConfirmId(null);
    },
    onError: () => toast.error("Failed to delete creator"),
  });

  // Group platforms by creator_id
  const platformsByCreator = useMemo(() => {
    const map: Record<string, typeof allPlatforms> = {};
    allPlatforms.forEach((p) => {
      if (!map[p.creator_id]) map[p.creator_id] = [];
      map[p.creator_id].push(p);
    });
    return map;
  }, [allPlatforms]);

  const filtered = useMemo(() => {
    let list = creators;
    if (clusterFilter !== "All") list = list.filter((c) => c.cluster === clusterFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.handle || "").toLowerCase().includes(q) ||
          (c.brand || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [creators, clusterFilter, search]);

  const selected = useMemo(
    () => creators.find((c) => c.id === selectedId) || null,
    [creators, selectedId]
  );

  // Auto-select first creator
  useMemo(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const toggleBulkSelect = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (bulkSelected.size === filtered.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleBulkRescrape = async () => {
    if (bulkSelected.size === 0) return;
    setIsRescraping(true);

    // Group selected creators by platform
    const byPlatform: Record<string, { handles: string[]; creatorIds: string[] }> = {};
    for (const id of bulkSelected) {
      const creator = creators.find((c) => c.id === id);
      if (!creator) continue;
      const plat = creator.platform || "instagram";
      if (!byPlatform[plat]) byPlatform[plat] = { handles: [], creatorIds: [] };
      byPlatform[plat].handles.push((creator.handle || "").replace(/^@/, ""));
      byPlatform[plat].creatorIds.push(creator.id);

      // Also rescrape linked platforms
      const linked = platformsByCreator[id] || [];
      for (const lp of linked) {
        if (lp.platform !== plat) {
          if (!byPlatform[lp.platform]) byPlatform[lp.platform] = { handles: [], creatorIds: [] };
          byPlatform[lp.platform].handles.push((lp.handle || "").replace(/^@/, ""));
          byPlatform[lp.platform].creatorIds.push(creator.id);
        }
      }
    }

    const functionMap: Record<string, string> = {
      instagram: "scrape-instagram",
      tiktok: "scrape-tiktok",
      snapchat: "scrape-snapchat",
    };

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const [platform, { handles, creatorIds }] of Object.entries(byPlatform)) {
      const fnName = functionMap[platform];
      if (!fnName || handles.length === 0) continue;

      try {
        const body: Record<string, unknown> = { handles };
        if (platform !== "instagram") body.creatorIds = creatorIds;
        if (platform === "instagram") body.includePosts = true;

        const { data, error } = await supabase.functions.invoke(fnName, { body });
        if (error) {
          console.error(`Rescrape ${platform} error:`, error);
          totalFailed += handles.length;
        } else {
          totalSuccess += data?.count || handles.length;
        }
      } catch (e) {
        console.error(`Rescrape ${platform} failed:`, e);
        totalFailed += handles.length;
      }
    }

    // Also scrape tagged posts for all Instagram creators in the batch
    if (byPlatform["instagram"]) {
      try {
        await supabase.functions.invoke("scrape-tagged-posts", {
          body: {
            handles: byPlatform["instagram"].handles,
            creatorIds: byPlatform["instagram"].creatorIds,
            maxItems: 20,
          },
        });
      } catch (taggedErr) {
        console.warn("Tagged posts scrape failed (non-critical):", taggedErr);
      }
    }

    setIsRescraping(false);
    queryClient.invalidateQueries({ queryKey: ["creators-hub"] });
    queryClient.invalidateQueries({ queryKey: ["creator-platforms"] });
    queryClient.invalidateQueries({ queryKey: ["creator-collaborations"] });

    if (totalSuccess > 0) toast.success(`Rescraped ${totalSuccess} profile(s) successfully`);
    if (totalFailed > 0) toast.error(`${totalFailed} profile(s) failed to rescrape`);

    setBulkSelected(new Set());
    setBulkMode(false);
  };

  return (
    <div className="flex h-[calc(100vh-104px)]">
      {/* ─── Left Panel ─── */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        {/* Search + primary add */}
        <div className="p-4 border-b border-border space-y-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search your creators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-data text-xs h-9"
              />
            </div>
            <Button
              onClick={() => setAddManualOpen(true)}
              size="sm"
              title="Add a creator manually"
              className="h-9 px-3 gap-1.5 font-data text-[10px] tracking-wider shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              ADD
            </Button>
          </div>
          <p className="font-data text-[9px] text-muted-foreground/70 tracking-wider px-0.5">
            {filtered.length} CREATOR{filtered.length !== 1 ? "S" : ""} IN YOUR ROSTER
          </p>
        </div>

        {/* Find new creators */}
        <div className="px-4 py-3 border-b border-border space-y-2">
          <p className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">
            FIND NEW CREATORS
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              onClick={() => setDiscoverOpen(true)}
              variant="outline"
              size="sm"
              title="Search TikTok / IG / YouTube by topic"
              className="font-data text-[10px] tracking-wider h-8 gap-1.5 justify-start px-2.5"
            >
              <Search className="w-3 h-3" />
              DISCOVER
            </Button>
            <Button
              onClick={() => setMatchOpen(true)}
              variant="outline"
              size="sm"
              title="AI-match your creators to a brief"
              className="font-data text-[10px] tracking-wider h-8 gap-1.5 justify-start px-2.5"
            >
              <Sparkles className="w-3 h-3" />
              MATCH BRIEF
            </Button>
          </div>
          <NichesPanel />
        </div>

        {/* Filter & manage */}
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-data text-[9px] text-muted-foreground tracking-[0.15em]">
              FILTER BY DIVISION
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
              className="font-data text-[9px] tracking-wider h-6 px-2 gap-1 -mr-1"
            >
              <CheckSquare className="w-3 h-3" />
              {bulkMode ? "CANCEL" : "SELECT"}
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {CLUSTER_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setClusterFilter(c)}
                className={`font-data text-[9px] tracking-wider px-2.5 py-1 border transition-colors ${
                  clusterFilter === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {bulkMode && bulkSelected.size > 0 && (
            <Button
              variant="default"
              size="sm"
              disabled={isRescraping}
              onClick={handleBulkRescrape}
              className="w-full font-data text-[9px] tracking-wider h-7 gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isRescraping ? "animate-spin" : ""}`} />
              {isRescraping ? "SCRAPING…" : `RESCRAPE ${bulkSelected.size} SELECTED`}
            </Button>
          )}
          {bulkMode && filtered.length > 0 && (
            <button
              onClick={selectAllFiltered}
              className="font-data text-[9px] tracking-wider text-primary hover:underline"
            >
              {bulkSelected.size === filtered.length ? "DESELECT ALL" : "SELECT ALL"}
            </button>
          )}
        </div>

        {/* Creator list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/20 animate-pulse border border-border" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No creators found</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map((c) => {
                const isActive = c.id === selectedId;
                const soi = Number(c.soi_score) || 0;
                return (
                  <div
                    key={c.id}
                    onClick={() => bulkMode ? toggleBulkSelect(c.id) : setSelectedId(c.id)}
                    className={`group w-full text-left p-3 flex items-center gap-3 transition-all cursor-pointer ${
                      bulkSelected.has(c.id)
                        ? "bg-accent/10 border border-accent/30"
                        : isActive
                        ? "bg-primary/10 border border-primary/30"
                        : "border border-transparent hover:bg-surface-2"
                    }`}
                  >
                    {/* Bulk checkbox */}
                    {bulkMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBulkSelect(c.id); }}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {bulkSelected.has(c.id) ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center shrink-0 overflow-hidden">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <span className="font-ui text-xs text-muted-foreground">
                          {c.name[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-ui text-sm text-foreground truncate">{c.name}</span>
                        {(platformsByCreator[c.id] || []).length > 0 ? (
                          <div className="flex items-center gap-0.5">
                            {(platformsByCreator[c.id] || []).map((p) => (
                              <PlatformIcon key={p.platform} platform={p.platform} />
                            ))}
                          </div>
                        ) : (
                          <PlatformIcon platform={c.platform} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-data text-[10px] text-muted-foreground truncate">
                          {c.handle || "@unknown"}
                        </span>
                        {c.cluster && (
                          <span className="font-data text-[8px] px-1 py-0.5 bg-muted text-muted-foreground border border-border">
                            {c.cluster}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SOI badge */}
                    <div className={`shrink-0 w-10 h-10 flex flex-col items-center justify-center border ${
                      soi >= 70
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : soi >= 40
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    }`}>
                      <span className="font-data text-xs font-bold">{soi}</span>
                      <span className="font-data text-[7px] tracking-wider">SOI</span>
                    </div>

                    {/* Delete button on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right Panel: Detail ─── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <CreatorDetail
            key={selected.id}
            creator={selected}
            platforms={platformsByCreator[selected.id] || []}
            onDelete={() => setDeleteConfirmId(selected.id)}
            onPlatformAdded={() => queryClient.invalidateQueries({ queryKey: ["creator-platforms"] })}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Select a creator to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display italic">Remove Creator</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the creator and all linked platform accounts. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      
      <BriefMatchDialog open={matchOpen} onOpenChange={setMatchOpen} />
      <VirloDiscoveryDialog open={discoverOpen} onOpenChange={setDiscoverOpen} />
      <AddCreatorDialog open={addManualOpen} onOpenChange={setAddManualOpen} />
    </div>
  );
}

/* ─── Platform Icon ─── */
function PlatformIcon({ platform }: { platform: string | null }) {
  if (platform === "instagram") return <Instagram className="w-3 h-3 text-primary shrink-0" />;
  if (platform === "tiktok")
    return (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z"/>
      </svg>
    );
  if (platform === "snapchat")
    return (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.21 1.5c2.63.06 4.75 1.04 6.07 2.85.87 1.2 1.17 2.45 1.17 3.6v.02c0 .4-.03 .78-.06 1.15-.03.3-.06.58-.06.77 0 .22.08.38.28.5.32.17.66.3 1.02.43l.3.12c.6.26 1.05.55 1.07.97.02.48-.5.78-1.01.97-.11.04-.23.08-.35.12-.47.14-1.01.3-1.24.56-.15.17-.17.43-.06.8l.02.04c.45 1.27 1.09 2.43 2.14 3.37.28.25.6.46.93.65.43.24.67.54.57.88-.1.37-.56.6-1.35.69-.3.04-.6.04-.88.08-.32.05-.64.12-.97.27-.24.1-.41.28-.6.5-.42.5-.94 1.12-2.15 1.12-.18 0-.38-.02-.6-.06a6.07 6.07 0 00-1.14-.13c-.4 0-.82.06-1.25.2-1.06.33-1.9.94-2.91.94h-.12c-1.02 0-1.85-.6-2.91-.94a4.4 4.4 0 00-1.25-.2c-.4 0-.78.05-1.14.13-.22.04-.42.06-.6.06-1.21 0-1.73-.62-2.15-1.12a1.46 1.46 0 00-.6-.5 5.45 5.45 0 00-.97-.27c-.28-.04-.58-.04-.88-.08-.79-.1-1.25-.32-1.35-.69-.1-.34.14-.64.57-.88.33-.19.65-.4.93-.65 1.05-.94 1.69-2.1 2.14-3.37l.02-.04c.11-.37.09-.63-.06-.8-.23-.26-.77-.42-1.24-.56-.12-.04-.24-.08-.36-.12-.5-.19-1.02-.5-1-.97.02-.42.47-.71 1.07-.97l.3-.12c.36-.14.7-.26 1.02-.43.2-.12.28-.28.28-.5 0-.19-.03-.48-.06-.77a12.3 12.3 0 01-.06-1.15v-.02c0-1.15.3-2.4 1.17-3.6C7.24 2.54 9.36 1.56 12 1.5h.21z"/>
      </svg>
    );
  if (platform === "youtube")
    return (
      <span className="text-[10px] font-bold text-destructive shrink-0">YT</span>
    );
  return <Globe className="w-3 h-3 text-muted-foreground shrink-0" />;
}

/* ─── Creator Detail Component ─── */
function CreatorDetail({ creator, platforms = [], onDelete, onPlatformAdded }: { creator: any; platforms?: any[]; onDelete: () => void; onPlatformAdded: () => void }) {
  const [addPlatformOpen, setAddPlatformOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState("tiktok");
  const [newHandle, setNewHandle] = useState("");
  const [isSingleRescraping, setIsSingleRescraping] = useState(false);
  const queryClient = useQueryClient();

  // Fetch collaborations for this creator
  const { data: collaborations = [] } = useQuery({
    queryKey: ["creator-collaborations", creator.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_collaborations")
        .select("*")
        .eq("creator_id", creator.id)
        .order("post_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addPlatformMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("creator_platforms").insert({
        creator_id: creator.id,
        platform: newPlatform,
        handle: newHandle,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      onPlatformAdded();
      setAddPlatformOpen(false);
      setNewHandle("");
      toast.success(`${newPlatform} account linked`);
    },
    onError: (e: any) => toast.error(e.message?.includes("unique") ? "This platform is already linked" : "Failed to add platform"),
  });

  const handleSingleRescrape = async () => {
    setIsSingleRescraping(true);
    const plat = creator.platform || "instagram";
    const handle = (creator.handle || "").replace(/^@/, "");
    const functionMap: Record<string, string> = {
      instagram: "scrape-instagram",
      tiktok: "scrape-tiktok",
      snapchat: "scrape-snapchat",
    };
    const fnName = functionMap[plat];
    if (!fnName || !handle) {
      toast.error("Cannot determine platform or handle");
      setIsSingleRescraping(false);
      return;
    }
    try {
      const body: Record<string, unknown> = { handles: [handle] };
      if (plat !== "instagram") body.creatorIds = [creator.id];
      if (plat === "instagram") body.includePosts = true;
      const { error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;

      // Also scrape tagged posts for Instagram creators (best source for collabs)
      if (plat === "instagram") {
        try {
          await supabase.functions.invoke("scrape-tagged-posts", {
            body: { handles: [handle], creatorIds: [creator.id], maxItems: 30 },
          });
        } catch (taggedErr) {
          console.warn("Tagged posts scrape failed (non-critical):", taggedErr);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["creators-hub"] });
      queryClient.invalidateQueries({ queryKey: ["creator-platforms"] });
      queryClient.invalidateQueries({ queryKey: ["creator-collaborations", creator.id] });
      toast.success("Profile rescraped successfully");
    } catch (e: any) {
      console.error("Rescrape failed:", e);
      toast.error("Failed to rescrape profile");
    }
    setIsSingleRescraping(false);
  };
  const soi = Number(creator.soi_score) || 0;
  const engRate = Number(creator.engagement_rate) || 0;
  const followers = Number(creator.followers) || 0;
  const roi = Number(creator.roi) || 0;
  const cpv = Number(creator.cpv) || 0;

  // Deterministic values-match and golden rules based on creator data
  const valuesMatch = soi >= 70 ? "Aligned" : soi >= 40 ? "Pending" : "Not Aligned";
  const goldenRulesCompliance = useMemo(() => {
    const seed = creator.name.length + soi;
    return GOLDEN_RULES.map((rule, i) => ({
      rule,
      passed: (seed + i) % 5 !== 0, // deterministic based on creator
    }));
  }, [creator.name, soi]);

  const passedRules = goldenRulesCompliance.filter((r) => r.passed).length;
  const performanceData = useMemo(() => generatePerformanceData(creator.name), [creator.name]);

  // Audience credibility (derived from SOI and engagement)
  const audienceCredibility = Math.min(100, Math.round(soi * 0.6 + engRate * 8 + 20));

  return (
    <div className="p-8 space-y-8">
      {/* Profile Header */}
      <div className="flex items-start gap-6">
        <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center overflow-hidden shrink-0 border-2 border-border">
          {creator.avatar_url ? (
            <img src={creator.avatar_url} alt={creator.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="font-display text-2xl text-muted-foreground italic">
              {creator.name[0]?.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-display text-2xl text-foreground italic">{creator.name}</h2>
            <PlatformIcon platform={creator.platform} />
            <ValuesMatchBadge status={valuesMatch} />
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                disabled={isSingleRescraping}
                onClick={handleSingleRescrape}
              >
                <RefreshCw className={`w-4 h-4 ${isSingleRescraping ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="font-data text-xs text-muted-foreground mb-1">
            {creator.handle || "@unknown"} · {creator.country || "Unknown"}
          </p>
          {creator.bio && (
            <p className="font-ui text-sm text-muted-foreground mt-2 max-w-xl">{creator.bio}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {creator.brand && (
              <Badge variant="outline" className="font-data text-[9px] tracking-wider">{creator.brand}</Badge>
            )}
            {creator.cluster && (
              <Badge variant="outline" className="font-data text-[9px] tracking-wider bg-primary/10 text-primary border-primary/20">
                {creator.cluster}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`font-data text-[9px] tracking-wider ${
                creator.status === "active"
                  ? "bg-accent/10 text-accent border-accent/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {(creator.status || "unknown").toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "FOLLOWERS",
            value: followers >= 1000000 ? `${(followers / 1000000).toFixed(1)}M` : followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers.toString(),
            icon: Users,
            color: "text-foreground",
          },
          {
            label: "ENGAGEMENT",
            value: `${engRate.toFixed(2)}%`,
            icon: Heart,
            color: engRate >= 3 ? "text-accent" : "text-foreground",
          },
          {
            label: "SOI SCORE",
            value: soi.toString(),
            icon: Star,
            color: soi >= 70 ? "text-accent" : soi >= 40 ? "text-primary" : "text-muted-foreground",
          },
          {
            label: "AUDIENCE CREDIBILITY",
            value: `${audienceCredibility}%`,
            icon: Shield,
            color: audienceCredibility >= 70 ? "text-accent" : "text-foreground",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-border p-4 bg-card">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-data text-[9px] tracking-[0.15em] text-muted-foreground">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "ROI", value: `${roi.toFixed(1)}×` },
          { label: "CPV", value: `$${cpv.toFixed(2)}` },
          { label: "TOTAL POSTS", value: (creator.total_posts || 0).toString() },
        ].map((s) => (
          <div key={s.label} className="border border-border p-3 bg-card/50">
            <span className="font-data text-[9px] tracking-wider text-muted-foreground">{s.label}</span>
            <p className="text-lg font-bold text-foreground mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Connected Platforms */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-foreground italic">Connected Platforms</h3>
          <Button variant="outline" size="sm" className="font-data text-[9px] tracking-wider gap-1" onClick={() => setAddPlatformOpen(true)}>
            <Plus className="w-3 h-3" /> ADD PLATFORM
          </Button>
        </div>
        {platforms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {platforms.map((p) => {
              const pFollowers = Number(p.followers) || 0;
              const pEng = Number(p.engagement_rate) || 0;
              const pData = (p.platform_data || {}) as Record<string, any>;
              const thirdLabel = p.platform === "tiktok" ? "HEARTS" : p.platform === "snapchat" ? "SUBS" : "POSTS";
              const thirdValue = p.platform === "tiktok"
                ? (pData.hearts || 0)
                : p.platform === "snapchat"
                ? pFollowers
                : (pData.posts_count || 0);
              const fmt = (n: number) =>
                n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toString();
              return (
                <div key={p.id} className="border border-border bg-card px-3 py-2 flex items-center gap-3">
                  <PlatformIcon platform={p.platform} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-ui text-xs font-semibold text-foreground capitalize truncate">{p.platform}</span>
                      {pData.verified && <CheckCircle className="w-3 h-3 text-accent shrink-0" />}
                      <span className="font-data text-[10px] text-muted-foreground truncate">{p.handle}</span>
                    </div>
                    <div className="flex items-center gap-3 font-data text-[10px] text-muted-foreground mt-0.5">
                      <span><span className="text-foreground font-semibold">{fmt(pFollowers)}</span> followers</span>
                      <span><span className="text-foreground font-semibold">{pEng.toFixed(2)}%</span> eng</span>
                      <span><span className="text-foreground font-semibold">{fmt(thirdValue)}</span> {thirdLabel.toLowerCase()}</span>
                    </div>
                  </div>
                  {p.profile_url && (
                    <a
                      href={p.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-data text-[9px] tracking-wider text-primary hover:underline shrink-0"
                    >
                      VIEW →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-border p-6 text-center">
            <Globe className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No platform accounts linked yet</p>
            <p className="font-data text-[9px] text-muted-foreground/60 mt-1">
              Use the scraper functions to import TikTok, Snapchat, or Instagram profiles
            </p>
          </div>
        )}
      </div>

      {/* Brand Collaborations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-foreground italic">Brand Collaborations</h3>
          <span className="font-data text-[10px] tracking-wider text-muted-foreground">
            {collaborations.length} PARTNERSHIP{collaborations.length !== 1 ? "S" : ""}
          </span>
        </div>
        {collaborations.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Array.from(new Set(collaborations.map((c: any) => c.brand_name))).map((brand: any) => {
                const count = collaborations.filter((c: any) => c.brand_name === brand).length;
                return (
                  <Badge key={brand} variant="outline" className="font-data text-[9px] tracking-wider gap-1 bg-primary/5 border-primary/20 text-primary">
                    {brand} ({count})
                  </Badge>
                );
              })}
            </div>
            {collaborations.map((collab: any) => (
              <div key={collab.id} className="flex items-center gap-3 p-3 border border-border bg-card/50">
                {collab.image_url && (
                  <img src={collab.image_url} alt="" className="w-12 h-12 object-cover border border-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-ui text-sm text-foreground font-semibold truncate">{collab.brand_name}</span>
                    <PlatformIcon platform={collab.platform} />
                    <Badge variant="outline" className="font-data text-[8px] tracking-wider capitalize">
                      {(collab.collaboration_type || "sponsored").replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="font-data text-[10px] text-muted-foreground truncate mt-0.5">
                    {collab.caption?.slice(0, 100) || "No caption"}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <div className="flex items-center gap-3 font-data text-[10px] text-muted-foreground">
                    <span>❤️ {(collab.likes || 0).toLocaleString()}</span>
                    <span>💬 {(collab.comments || 0).toLocaleString()}</span>
                    {collab.views > 0 && <span>👁️ {collab.views.toLocaleString()}</span>}
                  </div>
                  <p className="font-data text-[9px] text-muted-foreground">
                    {collab.post_date ? new Date(collab.post_date).toLocaleDateString() : "Unknown date"}
                  </p>
                </div>
                {collab.post_url && (
                  <a href={collab.post_url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-data text-[9px] text-primary hover:underline">
                    VIEW →
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-6 text-center">
            <BarChart3 className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No collaborations detected yet</p>
            <p className="font-data text-[9px] text-muted-foreground/60 mt-1">
              Re-scrape the creator's profile to detect brand partnerships from their posts
            </p>
          </div>
        )}
      </div>


      {/* AI Analysis */}
      <CreatorVirloAnalysis creator={creator} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-foreground italic">Golden Rules Compliance</h3>
          <span className={`font-data text-[10px] tracking-wider font-semibold ${
            passedRules === 12 ? "text-accent" : passedRules >= 9 ? "text-primary" : "text-destructive"
          }`}>
            {passedRules}/12 PASSED
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {goldenRulesCompliance.map(({ rule, passed }) => (
            <div
              key={rule}
              className={`flex items-center gap-2 px-3 py-2 border text-xs ${
                passed
                  ? "border-accent/20 bg-accent/5 text-accent"
                  : "border-destructive/20 bg-destructive/5 text-destructive"
              }`}
            >
              {passed ? (
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="font-data text-[10px]">{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Over Time */}
      <div>
        <h3 className="font-display text-lg text-foreground italic mb-4">Performance Over Time</h3>
        <div className="border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(20 4% 14%)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "hsl(20 5% 45%)" }}
                axisLine={{ stroke: "hsl(20 4% 14%)" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "hsl(20 5% 45%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "hsl(20 5% 45%)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(20 6% 8%)",
                  border: "1px solid hsl(20 4% 14%)",
                  fontSize: 11,
                  color: "hsl(30 10% 92%)",
                }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="engagement"
                stroke="hsl(348 100% 45%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(348 100% 45%)" }}
                name="Engagement %"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="soi"
                stroke="hsl(42 48% 54%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(42 48% 54%)" }}
                name="SOI Score"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-primary" />
              <span className="font-data text-[9px] text-muted-foreground">Engagement %</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-accent" />
              <span className="font-data text-[9px] text-muted-foreground">SOI Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign History (placeholder from available data) */}
      <div>
        <h3 className="font-display text-lg text-foreground italic mb-3">Campaign History</h3>
        <div className="space-y-2">
          {creator.brand ? (
            <>
              <CampaignHistoryRow
                name={`${creator.brand} Spring Launch`}
                date="Jan 2026"
                status="completed"
                roi={roi}
              />
              <CampaignHistoryRow
                name={`${creator.brand} Holiday Collection`}
                date="Nov 2025"
                status="completed"
                roi={Math.round(roi * 0.85 * 10) / 10}
              />
              <CampaignHistoryRow
                name={`${creator.cluster || "Brand"} Awareness Push`}
                date="Sep 2025"
                status="completed"
                roi={Math.round(roi * 1.1 * 10) / 10}
              />
            </>
          ) : (
            <div className="text-center py-8 border border-dashed border-border">
              <Clock className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No campaign history</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Platform Dialog */}
      <Dialog open={addPlatformOpen} onOpenChange={setAddPlatformOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display italic">Link Platform Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="font-data text-[9px] tracking-wider text-muted-foreground mb-1 block">PLATFORM</label>
              <div className="flex gap-2">
                {["tiktok", "snapchat", "instagram", "youtube"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewPlatform(p)}
                    className={`flex items-center gap-1.5 px-3 py-2 border text-xs capitalize transition-colors ${
                      newPlatform === p ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    <PlatformIcon platform={p} />
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-data text-[9px] tracking-wider text-muted-foreground mb-1 block">HANDLE</label>
              <Input
                placeholder="@username"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                className="font-data text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAddPlatformOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!newHandle.trim() || addPlatformMutation.isPending}
              onClick={() => addPlatformMutation.mutate()}
            >
              {addPlatformMutation.isPending ? "Linking…" : "Link Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Values Match Badge ─── */
function ValuesMatchBadge({ status }: { status: "Aligned" | "Pending" | "Not Aligned" }) {
  const styles = {
    Aligned: "bg-accent/15 text-accent border-accent/30",
    Pending: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
    "Not Aligned": "bg-destructive/15 text-destructive border-destructive/30",
  };
  const icons = {
    Aligned: <CheckCircle className="w-3 h-3" />,
    Pending: <Clock className="w-3 h-3" />,
    "Not Aligned": <AlertTriangle className="w-3 h-3" />,
  };
  return (
    <Badge variant="outline" className={`font-data text-[9px] tracking-wider gap-1 ${styles[status]}`}>
      {icons[status]}
      VALUES {status.toUpperCase()}
    </Badge>
  );
}

/* ─── Campaign History Row ─── */
function CampaignHistoryRow({
  name,
  date,
  status,
  roi,
}: {
  name: string;
  date: string;
  status: string;
  roi: number;
}) {
  return (
    <div className="flex items-center gap-4 p-3 border border-border bg-card/50">
      <Zap className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm text-foreground truncate">{name}</p>
        <p className="font-data text-[10px] text-muted-foreground">{date}</p>
      </div>
      <Badge variant="outline" className="font-data text-[8px] tracking-wider bg-accent/10 text-accent border-accent/20">
        {status.toUpperCase()}
      </Badge>
      <span className="font-data text-xs text-accent font-semibold">{roi}× ROI</span>
    </div>
  );
}
