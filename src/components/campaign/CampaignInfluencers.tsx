import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NESTLE_CLUSTERS } from "@/lib/nestleize";
import { format, differenceInDays, isPast } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Users,
  UserPlus,
  X,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Instagram,
  Trash2,
  Send,
} from "lucide-react";

const DELIVERABLE_TYPES = [
  { value: "ig_story", label: "Instagram Story", icon: "📱" },
  { value: "ig_reel", label: "Instagram Reel", icon: "🎬" },
  { value: "ig_post", label: "Instagram Post", icon: "📸" },
  { value: "tiktok", label: "TikTok Video", icon: "🎵" },
  { value: "snapchat", label: "Snapchat", icon: "👻" },
  { value: "youtube", label: "YouTube Video", icon: "▶️" },
  { value: "youtube_short", label: "YouTube Short", icon: "📹" },
  { value: "blog", label: "Blog Post", icon: "📝" },
  { value: "other", label: "Other", icon: "📦" },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-muted text-muted-foreground", label: "PENDING" },
  in_progress: { color: "bg-primary/20 text-primary", label: "IN PROGRESS" },
  submitted: { color: "bg-accent/20 text-accent", label: "SUBMITTED" },
  approved: { color: "bg-accent/30 text-accent", label: "APPROVED" },
  overdue: { color: "bg-destructive/20 text-destructive", label: "OVERDUE" },
};

const CREATOR_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  invited: { color: "bg-muted text-muted-foreground border-border", label: "INVITED" },
  confirmed: { color: "bg-primary/20 text-primary border-primary/30", label: "CONFIRMED" },
  declined: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "DECLINED" },
  completed: { color: "bg-accent/20 text-accent border-accent/30", label: "COMPLETED" },
};

interface Props {
  campaignId: string;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
}

export function CampaignInfluencers({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const qc = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
  const [showDeliverableForm, setShowDeliverableForm] = useState<string | null>(null);
  const [newDeliverable, setNewDeliverable] = useState({ type: "ig_post", due_date: "", description: "" });

  // Fetch campaign creators with their creator details
  const { data: campaignCreators = [] } = useQuery({
    queryKey: ["campaign-creators", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_creators")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch creator details for each
      const creatorIds = data.map((cc: any) => cc.creator_id);
      if (creatorIds.length === 0) return [];

      const { data: creators } = await supabase
        .from("creators")
        .select("*")
        .in("id", creatorIds);

      // Show only Nestlé-roster creators — legacy rows on shared campaigns stay
      // in the DB (they belong to the other platform) but are hidden here.
      return data
        .map((cc: any) => ({
          ...cc,
          creator: (creators || []).find((c: any) => c.id === cc.creator_id),
        }))
        .filter((cc: any) => cc.creator && NESTLE_CLUSTERS.includes(cc.creator.cluster));
    },
  });

  // Fetch deliverables for all campaign creators
  const campaignCreatorIds = campaignCreators.map((cc: any) => cc.id);
  const { data: allDeliverables = [] } = useQuery({
    queryKey: ["campaign-deliverables", campaignId, campaignCreatorIds],
    queryFn: async () => {
      if (campaignCreatorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("campaign_deliverables")
        .select("*")
        .in("campaign_creator_id", campaignCreatorIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: campaignCreatorIds.length > 0,
  });

  // Search creators to add
  const { data: searchResults = [] } = useQuery({
    queryKey: ["search-creators-for-campaign", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .in("cluster", NESTLE_CLUSTERS)
        .or(`name.ilike.%${searchQuery}%,handle.ilike.%${searchQuery}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length > 1,
  });

  const addCreator = useMutation({
    mutationFn: async (creatorId: string) => {
      const { error } = await supabase.from("campaign_creators").insert({
        campaign_id: campaignId,
        creator_id: creatorId,
        status: "invited",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-creators", campaignId] });
      toast.success("Influencer added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCreator = useMutation({
    mutationFn: async (ccId: string) => {
      const { error } = await supabase.from("campaign_creators").delete().eq("id", ccId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-creators", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-deliverables", campaignId] });
      toast.success("Influencer removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCreatorStatus = useMutation({
    mutationFn: async ({ ccId, status }: { ccId: string; status: string }) => {
      const { error } = await supabase.from("campaign_creators").update({ status }).eq("id", ccId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-creators", campaignId] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addDeliverable = useMutation({
    mutationFn: async ({ ccId, type, due_date, description }: { ccId: string; type: string; due_date: string; description: string }) => {
      const { error } = await supabase.from("campaign_deliverables").insert({
        campaign_creator_id: ccId,
        type,
        due_date: due_date || null,
        description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-deliverables", campaignId] });
      toast.success("Deliverable assigned");
      setShowDeliverableForm(null);
      setNewDeliverable({ type: "ig_post", due_date: "", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDeliverableStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("campaign_deliverables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-deliverables", campaignId] });
      toast.success("Deliverable updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_deliverables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-deliverables", campaignId] });
      toast.success("Deliverable removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stats
  const totalDeliverables = allDeliverables.length;
  const completedDeliverables = allDeliverables.filter((d: any) => d.status === "approved" || d.status === "submitted").length;
  const overdueDeliverables = allDeliverables.filter((d: any) => d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted").length;
  const existingCreatorIds = new Set(campaignCreators.map((cc: any) => cc.creator_id));

  const daysToLaunch = campaignStartDate ? differenceInDays(new Date(campaignStartDate), new Date()) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Campaign Influencers</h2>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="font-data text-[10px] tracking-wider">
          <UserPlus className="w-3 h-3 mr-1" /> ADD INFLUENCER
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "INFLUENCERS", value: campaignCreators.length, color: "text-foreground" },
          { label: "DELIVERABLES", value: `${completedDeliverables}/${totalDeliverables}`, color: "text-primary" },
          { label: "OVERDUE", value: overdueDeliverables, color: overdueDeliverables > 0 ? "text-destructive" : "text-muted-foreground" },
          {
            label: daysToLaunch !== null && daysToLaunch > 0 ? "DAYS TO LAUNCH" : "STATUS",
            value: daysToLaunch !== null && daysToLaunch > 0
              ? daysToLaunch
              : campaignEndDate && isPast(new Date(campaignEndDate))
              ? "COMPLETED"
              : "LIVE",
            color: "text-accent",
          },
        ].map((s) => (
          <div key={s.label} className="border border-border p-3 bg-card">
            <span className="font-data text-[9px] tracking-[0.15em] text-muted-foreground">{s.label}</span>
            <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Influencer list */}
      {campaignCreators.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border">
          <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No influencers assigned yet</p>
          <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="font-data text-[10px] tracking-wider">
            <Plus className="w-3 h-3 mr-1" /> ADD YOUR FIRST INFLUENCER
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaignCreators.map((cc: any) => {
            const creator = cc.creator;
            const isExpanded = expandedCreator === cc.id;
            const creatorDeliverables = allDeliverables.filter((d: any) => d.campaign_creator_id === cc.id);
            const completedCount = creatorDeliverables.filter((d: any) => d.status === "approved" || d.status === "submitted").length;
            const overdueCount = creatorDeliverables.filter((d: any) => d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted").length;
            const statusConf = CREATOR_STATUS_CONFIG[cc.status] || CREATOR_STATUS_CONFIG.invited;
            const pct = creatorDeliverables.length > 0 ? Math.round((completedCount / creatorDeliverables.length) * 100) : 0;

            return (
              <div key={cc.id} className="border border-border bg-card overflow-hidden">
                {/* Creator row */}
                <button
                  onClick={() => setExpandedCreator(isExpanded ? null : cc.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-card/80 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                    {creator?.avatar_url ? (
                      <img src={creator.avatar_url} alt={creator?.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm font-bold">
                        {creator?.name?.[0] || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-sm font-medium text-foreground truncate">{creator?.name || "Unknown"}</span>
                      <Badge variant="outline" className={`font-data text-[8px] tracking-wider ${statusConf.color}`}>
                        {statusConf.label}
                      </Badge>
                      {overdueCount > 0 && (
                        <Badge variant="outline" className="font-data text-[8px] tracking-wider bg-destructive/10 text-destructive border-destructive/20">
                          {overdueCount} OVERDUE
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-data text-[10px] text-muted-foreground">@{(creator?.handle || "").replace(/^@/, "")}</span>
                      <span className="font-data text-[10px] text-muted-foreground">
                        {completedCount}/{creatorDeliverables.length} deliverables
                      </span>
                    </div>
                  </div>
                  {creatorDeliverables.length > 0 && (
                    <div className="w-24 shrink-0">
                      <div className="flex justify-between mb-1">
                        <span className="font-data text-[9px] text-muted-foreground">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded: deliverables */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-3">
                    {/* Status + actions */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-data text-[9px] tracking-wider text-muted-foreground">STATUS:</span>
                      <Select value={cc.status} onValueChange={(v) => updateCreatorStatus.mutate({ ccId: cc.id, status: v })}>
                        <SelectTrigger className="h-7 w-32 text-[10px] font-data">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invited">Invited</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCreator.mutate(cc.id)}
                        className="text-destructive/60 hover:text-destructive font-data text-[10px]"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> REMOVE
                      </Button>
                    </div>

                    {/* Deliverables list */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-data text-[9px] tracking-[0.15em] text-muted-foreground uppercase">Assigned Deliverables</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeliverableForm(showDeliverableForm === cc.id ? null : cc.id)}
                          className="h-6 font-data text-[9px] tracking-wider"
                        >
                          <Plus className="w-3 h-3 mr-0.5" /> ASSIGN
                        </Button>
                      </div>

                      {showDeliverableForm === cc.id && (
                        <div className="border border-primary/20 bg-primary/5 p-3 space-y-2 mb-2">
                          <div className="flex gap-2">
                            <Select value={newDeliverable.type} onValueChange={(v) => setNewDeliverable((p) => ({ ...p, type: v }))}>
                              <SelectTrigger className="h-8 flex-1 text-[11px] font-data">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DELIVERABLE_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.icon} {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="date"
                              value={newDeliverable.due_date}
                              onChange={(e) => setNewDeliverable((p) => ({ ...p, due_date: e.target.value }))}
                              className="h-8 w-40 text-[11px] font-data"
                              placeholder="Due date"
                            />
                          </div>
                          <Input
                            placeholder="Notes (optional)..."
                            value={newDeliverable.description}
                            onChange={(e) => setNewDeliverable((p) => ({ ...p, description: e.target.value }))}
                            className="h-8 text-[11px] font-data"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowDeliverableForm(null)} className="h-7 font-data text-[9px]">
                              CANCEL
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => addDeliverable.mutate({ ccId: cc.id, ...newDeliverable })}
                              disabled={addDeliverable.isPending}
                              className="h-7 font-data text-[9px]"
                            >
                              <Send className="w-3 h-3 mr-0.5" /> ADD
                            </Button>
                          </div>
                        </div>
                      )}

                      {creatorDeliverables.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground/60 py-3 text-center border border-dashed border-border">
                          No deliverables assigned yet
                        </p>
                      ) : (
                        creatorDeliverables.map((d: any) => {
                          const typeInfo = DELIVERABLE_TYPES.find((t) => t.value === d.type) || DELIVERABLE_TYPES[8];
                          const isOverdue = d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted";
                          const effectiveStatus = isOverdue ? "overdue" : d.status;
                          const statusInfo = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
                          const daysUntilDue = d.due_date ? differenceInDays(new Date(d.due_date), new Date()) : null;

                          return (
                            <div key={d.id} className="flex items-center gap-3 p-2.5 border border-border bg-card group">
                              <span className="text-sm shrink-0">{typeInfo.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-ui text-[12px] text-foreground">{typeInfo.label}</span>
                                  <Badge variant="outline" className={`font-data text-[8px] tracking-wider ${statusInfo.color}`}>
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {d.due_date && (
                                    <span className={`font-data text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-destructive" : daysUntilDue !== null && daysUntilDue <= 3 ? "text-yellow-500" : "text-muted-foreground"}`}>
                                      <Calendar className="w-3 h-3" />
                                      {format(new Date(d.due_date), "MMM d")}
                                      {daysUntilDue !== null && daysUntilDue > 0 && (
                                        <span className="ml-1">({daysUntilDue}d left)</span>
                                      )}
                                      {isOverdue && <span className="ml-1">({Math.abs(daysUntilDue!)}d late)</span>}
                                    </span>
                                  )}
                                  {d.description && (
                                    <span className="font-data text-[10px] text-muted-foreground truncate">{d.description}</span>
                                  )}
                                </div>
                              </div>
                              <Select
                                value={effectiveStatus === "overdue" ? d.status : d.status}
                                onValueChange={(v) => updateDeliverableStatus.mutate({ id: d.id, status: v })}
                              >
                                <SelectTrigger className="h-6 w-28 text-[9px] font-data opacity-0 group-hover:opacity-100 transition-opacity">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="submitted">Submitted</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                </SelectContent>
                              </Select>
                              <button
                                onClick={() => deleteDeliverable.mutate(d.id)}
                                className="p-1 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add influencer dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Influencer to Campaign</DialogTitle>
            <DialogDescription>Search for creators to add to this campaign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {searchQuery.length < 2 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Type to search creators...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No creators found</p>
              ) : (
                searchResults.map((c: any) => {
                  const alreadyAdded = existingCreatorIds.has(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 border border-border hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {c.name?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-ui text-sm text-foreground truncate">{c.name}</p>
                        <p className="font-data text-[10px] text-muted-foreground">
                          @{(c.handle || "").replace(/^@/, "")} · {(c.followers || 0).toLocaleString()} followers
                        </p>
                      </div>
                      {alreadyAdded ? (
                        <Badge variant="outline" className="font-data text-[9px] text-accent border-accent/30">ADDED</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addCreator.mutate(c.id)}
                          disabled={addCreator.isPending}
                          className="h-7 font-data text-[9px]"
                        >
                          <Plus className="w-3 h-3 mr-0.5" /> ADD
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
