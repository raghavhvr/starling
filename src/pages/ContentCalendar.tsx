import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isBefore,
  parseISO,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, AlertCircle, CheckCircle, Clock, Send, MessageSquare, ChevronDown, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Deliverable = {
  id: string;
  type: string;
  status: string;
  due_date: string | null;
  description: string | null;
  submitted_url: string | null;
  notes: string | null;
  campaign_creator_id: string;
  creator_name: string;
  campaign_name: string;
  campaign_id: string;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof Clock; label: string }> = {
  pending: { color: "text-muted-foreground", bg: "bg-muted", icon: Clock, label: "Pending" },
  in_progress: { color: "text-amber-400", bg: "bg-amber-500/20", icon: Clock, label: "In Progress" },
  submitted: { color: "text-blue-400", bg: "bg-blue-500/20", icon: Send, label: "Submitted" },
  approved: { color: "text-emerald-400", bg: "bg-emerald-500/20", icon: CheckCircle, label: "Approved" },
  overdue: { color: "text-destructive", bg: "bg-destructive/20", icon: AlertCircle, label: "Overdue" },
  published: { color: "text-emerald-400", bg: "bg-emerald-500/20", icon: CheckCircle, label: "Published" },
};

const TYPE_LABELS: Record<string, string> = {
  ig_post: "IG Post",
  ig_story: "IG Story",
  ig_reel: "IG Reel",
  tiktok: "TikTok",
  youtube: "YouTube",
  snapchat: "Snapchat",
};

function getEffectiveStatus(d: { status: string; due_date: string | null }): string {
  if (d.status === "approved" || d.status === "published") return d.status;
  if (d.due_date && isBefore(parseISO(d.due_date), new Date()) && d.status !== "submitted") return "overdue";
  return d.status;
}

export default function ContentCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: deliverables = [], isLoading } = useQuery({
    queryKey: ["content-calendar-deliverables"],
    queryFn: async () => {
      // Fetch deliverables with campaign_creator info
      const { data: dels, error: dErr } = await supabase
        .from("campaign_deliverables")
        .select("*");
      if (dErr) throw dErr;

      // Fetch campaign_creators
      const ccIds = [...new Set(dels.map((d) => d.campaign_creator_id))];
      if (ccIds.length === 0) return [];
      const { data: ccs, error: ccErr } = await supabase
        .from("campaign_creators")
        .select("id, creator_id, campaign_id")
        .in("id", ccIds);
      if (ccErr) throw ccErr;

      // Fetch creators and campaigns
      const creatorIds = [...new Set(ccs.map((cc) => cc.creator_id))];
      const campaignIds = [...new Set(ccs.map((cc) => cc.campaign_id))];

      const [creatorsRes, campaignsRes] = await Promise.all([
        creatorIds.length > 0
          ? supabase.from("creators").select("id, name").in("id", creatorIds)
          : { data: [], error: null },
        campaignIds.length > 0
          ? supabase.from("campaigns").select("id, name").in("id", campaignIds)
          : { data: [], error: null },
      ]);

      const creatorMap = new Map((creatorsRes.data || []).map((c) => [c.id, c.name]));
      const campaignMap = new Map((campaignsRes.data || []).map((c) => [c.id, c.name]));
      const ccMap = new Map(ccs.map((cc) => [cc.id, cc]));

      return dels.map((d): Deliverable => {
        const cc = ccMap.get(d.campaign_creator_id);
        return {
          ...d,
          creator_name: cc ? creatorMap.get(cc.creator_id) || "Unknown" : "Unknown",
          campaign_name: cc ? campaignMap.get(cc.campaign_id) || "Unknown" : "Unknown",
          campaign_id: cc?.campaign_id || "",
        };
      });
    },
  });

  // Filtered deliverables
  const filtered = useMemo(() => {
    return deliverables.filter((d) => {
      if (filterCampaign !== "all" && d.campaign_id !== filterCampaign) return false;
      const eff = getEffectiveStatus(d);
      if (filterStatus !== "all" && eff !== filterStatus) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      return true;
    });
  }, [deliverables, filterCampaign, filterStatus, filterType]);

  // Deliverables grouped by date
  const byDate = useMemo(() => {
    const map = new Map<string, Deliverable[]>();
    filtered.forEach((d) => {
      if (d.due_date) {
        const key = d.due_date;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(d);
      }
    });
    return map;
  }, [filtered]);

  const unscheduled = useMemo(() => filtered.filter((d) => !d.due_date), [filtered]);

  // Calendar grid days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Stats for current month
  const monthDeliverables = useMemo(() => {
    return filtered.filter((d) => {
      if (!d.due_date) return false;
      const dd = parseISO(d.due_date);
      return isSameMonth(dd, currentMonth);
    });
  }, [filtered, currentMonth]);

  const stats = useMemo(() => {
    const total = monthDeliverables.length;
    let overdue = 0, submitted = 0, approved = 0;
    monthDeliverables.forEach((d) => {
      const s = getEffectiveStatus(d);
      if (s === "overdue") overdue++;
      if (s === "submitted") submitted++;
      if (s === "approved" || s === "published") approved++;
    });
    return { total, overdue, submitted, approved };
  }, [monthDeliverables]);

  // Unique campaigns for filter
  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    deliverables.forEach((d) => {
      if (d.campaign_id) map.set(d.campaign_id, d.campaign_name);
    });
    return [...map.entries()];
  }, [deliverables]);

  const selectedDayDeliverables = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return byDate.get(key) || [];
  }, [selectedDay, byDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="font-ui text-lg font-semibold text-foreground">Content Calendar</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background/60 backdrop-blur-sm flex-wrap">
        <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] mr-1">FILTERS</span>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[160px] h-8 text-xs font-data">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs font-data">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px] h-8 text-xs font-data">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-border">
        <StatPill label="This Month" value={stats.total} color="text-foreground" />
        <StatPill label="Overdue" value={stats.overdue} color="text-destructive" />
        <StatPill label="Submitted" value={stats.submitted} color="text-blue-400" />
        <StatPill label="Approved" value={stats.approved} color="text-emerald-400" />
      </div>

      {/* Month navigation + grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-secondary rounded transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h2 className="font-ui text-sm font-semibold text-foreground tracking-wide">
            {format(currentMonth, "MMMM yyyy").toUpperCase()}
          </h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-secondary rounded transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
            <div key={d} className="text-center font-data text-[9px] tracking-[0.15em] text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
          {calDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayDels = byDate.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[90px] p-1.5 text-left transition-colors flex flex-col ${
                  inMonth ? "bg-card" : "bg-background/40"
                } ${today ? "ring-1 ring-inset ring-primary/50" : ""} ${
                  isSelected ? "bg-primary/10" : "hover:bg-secondary/60"
                }`}
              >
                <span className={`font-data text-[11px] ${
                  today ? "text-primary font-semibold" : inMonth ? "text-foreground" : "text-muted-foreground/40"
                }`}>
                  {format(day, "d")}
                </span>
                <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
                  {dayDels.slice(0, 3).map((d) => {
                    const eff = getEffectiveStatus(d);
                    const cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center gap-1 px-1 py-px rounded-sm ${cfg.bg} truncate`}
                        title={`${d.creator_name} — ${TYPE_LABELS[d.type] || d.type} (${cfg.label})`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.color} bg-current`} />
                        <span className={`font-data text-[8px] leading-tight truncate ${cfg.color}`}>
                          {TYPE_LABELS[d.type] || d.type}
                        </span>
                      </div>
                    );
                  })}
                  {dayDels.length > 3 && (
                    <span className="font-data text-[8px] text-muted-foreground pl-1">+{dayDels.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Unscheduled */}
        {unscheduled.length > 0 && (
          <div className="mt-6">
            <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground mb-2">
              UNSCHEDULED ({unscheduled.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unscheduled.map((d) => (
                <DeliverableCard key={d.id} deliverable={d} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Day detail sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] bg-card border-border">
          <SheetHeader>
            <SheetTitle className="font-ui text-sm">
              {selectedDay ? format(selectedDay, "EEEE, MMMM d, yyyy") : ""}
            </SheetTitle>
            {selectedDayDeliverables.length > 0 && (
              <p className="font-data text-[10px] text-muted-foreground tracking-wider">
                {selectedDayDeliverables.length} DELIVERABLE{selectedDayDeliverables.length > 1 ? "S" : ""} DUE
              </p>
            )}
          </SheetHeader>
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
            {selectedDayDeliverables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No deliverables due this day.</p>
              </div>
            ) : (
              selectedDayDeliverables.map((d) => <ExpandableDeliverableCard key={d.id} deliverable={d} />)
            )}
          </div>
        </SheetContent>
      </Sheet>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <span className="font-data text-xs text-muted-foreground animate-pulse">Loading deliverables…</span>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-data text-lg font-semibold ${color}`}>{value}</span>
      <span className="font-data text-[10px] text-muted-foreground tracking-wider uppercase">{label}</span>
    </div>
  );
}

function DeliverableCard({ deliverable: d }: { deliverable: Deliverable }) {
  const eff = getEffectiveStatus(d);
  const cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className="p-3 bg-secondary/50 border border-border rounded space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-data text-[10px] tracking-wider text-muted-foreground uppercase">
          {TYPE_LABELS[d.type] || d.type}
        </span>
        <Badge variant="outline" className={`text-[9px] ${cfg.color} border-current`}>
          <Icon className="w-3 h-3 mr-1" />
          {cfg.label}
        </Badge>
      </div>
      <p className="font-ui text-xs font-medium text-foreground truncate">{d.creator_name}</p>
      <p className="font-data text-[10px] text-muted-foreground truncate">{d.campaign_name}</p>
      {d.description && (
        <p className="font-data text-[10px] text-muted-foreground/70 line-clamp-2">{d.description}</p>
      )}
      {d.submitted_url && (
        <a
          href={d.submitted_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-data text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> View submission
        </a>
      )}
    </div>
  );
}

function ExpandableDeliverableCard({ deliverable: d }: { deliverable: Deliverable }) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const eff = getEffectiveStatus(d);
  const cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  const handleSendNote = useCallback(async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("campaign_deliverables")
        .update({ notes: message.trim() })
        .eq("id", d.id);
      if (error) throw error;
      toast.success("Note saved to deliverable");
      setMessage("");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSending(false);
    }
  }, [message, d.id]);

  return (
    <div className="bg-secondary/50 border border-border rounded overflow-hidden transition-all">
      {/* Clickable header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left hover:bg-secondary/80 transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-data text-[10px] tracking-wider text-muted-foreground uppercase">
            {TYPE_LABELS[d.type] || d.type}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[9px] ${cfg.color} border-current`}>
              <Icon className="w-3 h-3 mr-1" />
              {cfg.label}
            </Badge>
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-ui text-xs font-medium text-foreground truncate">{d.creator_name}</p>
            <p className="font-data text-[10px] text-muted-foreground truncate">{d.campaign_name}</p>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
          {/* Description */}
          {d.description && (
            <div>
              <span className="font-data text-[9px] tracking-wider text-muted-foreground uppercase">Description</span>
              <p className="font-data text-[11px] text-foreground/80 mt-0.5">{d.description}</p>
            </div>
          )}

          {/* Due date */}
          {d.due_date && (
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="font-data text-[11px] text-muted-foreground">
                Due: {format(parseISO(d.due_date), "MMM d, yyyy")}
              </span>
            </div>
          )}

          {/* Existing notes */}
          {d.notes && (
            <div>
              <span className="font-data text-[9px] tracking-wider text-muted-foreground uppercase">Notes</span>
              <p className="font-data text-[11px] text-foreground/70 mt-0.5 bg-background/50 p-2 rounded border border-border/50">
                {d.notes}
              </p>
            </div>
          )}

          {/* Submission link */}
          {d.submitted_url && (
            <a
              href={d.submitted_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-data text-[11px] text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> View submission
            </a>
          )}

          {/* Message / note input */}
          <div className="space-y-2">
            <span className="font-data text-[9px] tracking-wider text-muted-foreground uppercase flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Add a note
            </span>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add feedback, instructions, or a message…"
              className="min-h-[60px] text-xs font-data bg-background/50 border-border/50 resize-none"
            />
            <Button
              size="sm"
              onClick={handleSendNote}
              disabled={!message.trim() || sending}
              className="w-full h-7 text-[10px] font-data tracking-wider uppercase"
            >
              <Send className="w-3 h-3 mr-1" />
              {sending ? "Saving…" : "Save Note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
