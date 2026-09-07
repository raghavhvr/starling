import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displayBrand, displayCluster } from "@/lib/nestleize";
import { HINTS } from "@/lib/glossary";
import { format, differenceInDays, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  Circle,
  Plus,
  MessageSquare,
  TrendingUp,
  Package,
  AlertCircle,
  Clock,
  CalendarDays,
  DollarSign,
  Target,
  Eye,
  Users,
  FileText,
  Zap,
  ArrowLeft,
  ArrowRight,
  Send,
  X,
} from "lucide-react";
import { CampaignInfluencers } from "./CampaignInfluencers";
import { MeasurementFrameworkPanel } from "./MeasurementFrameworkPanel";

interface Campaign {
  id: string;
  name: string;
  brand: string | null;
  cluster: string | null;
  budget: number | null;
  spent: number | null;
  start_date: string | null;
  end_date: string | null;
  objective: string | null;
  deliverables: string | null;
  target_audience: string | null;
  kpis: string | null;
  notes: string | null;
  markets: string[] | null;
  status: string | null;
}

interface Props {
  campaign: Campaign;
}

type ActivityType = "note" | "post_delivered" | "change" | "metric_update";

const typeConfig: Record<ActivityType, { icon: typeof MessageSquare; label: string; color: string }> = {
  note: { icon: MessageSquare, label: "Note", color: "text-primary" },
  post_delivered: { icon: CheckCircle, label: "Delivered", color: "text-accent" },
  change: { icon: AlertCircle, label: "Change", color: "text-yellow-500" },
  metric_update: { icon: TrendingUp, label: "Metric", color: "text-primary" },
};

export function LiveTrackingView({ campaign }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "measurement" | "influencers" | "deliverables" | "timeline" | "notes">("overview");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<ActivityType>("note");
  const [showNoteForm, setShowNoteForm] = useState(false);

  const { data: activities = [] } = useQuery({
    queryKey: ["campaign-activities", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_activities")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addActivity = useMutation({
    mutationFn: async (activity: { type: string; title: string; content?: string; metadata?: any }) => {
      const { error } = await supabase.from("campaign_activities").insert({
        campaign_id: campaign.id,
        ...activity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-activities", campaign.id] });
      toast.success("Activity logged");
      setNoteTitle("");
      setNoteContent("");
      setShowNoteForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDeliverable = (deliverable: string, currentlyDone: boolean) => {
    if (currentlyDone) return;
    addActivity.mutate({
      type: "post_delivered",
      title: `${deliverable} delivered`,
      content: `Marked "${deliverable}" as delivered`,
    });
  };

  // Parse deliverables
  const deliverablesList = useMemo(() => {
    if (!campaign.deliverables) return [];
    return campaign.deliverables.split(",").map((d) => d.trim()).filter(Boolean);
  }, [campaign.deliverables]);

  const deliveredSet = useMemo(() => {
    const set = new Set<string>();
    activities
      .filter((a) => a.type === "post_delivered")
      .forEach((a) => {
        deliverablesList.forEach((d) => {
          if (a.title?.includes(d)) set.add(d);
        });
      });
    return set;
  }, [activities, deliverablesList]);

  const deliveredCount = deliveredSet.size;
  const totalDeliverables = deliverablesList.length;
  const deliveryPct = totalDeliverables > 0 ? Math.round((deliveredCount / totalDeliverables) * 100) : 0;

  // Campaign timeline
  const isCompleted = campaign.status === "completed";
  const startDate = campaign.start_date ? new Date(campaign.start_date) : null;
  const endDate = campaign.end_date ? new Date(campaign.end_date) : null;
  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) : 0;
  const elapsedDays = startDate
    ? Math.max(0, Math.min(totalDays || Infinity, differenceInDays(isCompleted && endDate ? endDate : new Date(), startDate)))
    : 0;
  const timelinePct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;
  const budget = Number(campaign.budget) || 0;
  const spent = Number(campaign.spent) || 0;
  const budgetPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  const tabs = [
    { key: "overview" as const, label: "OVERVIEW", icon: Eye },
    { key: "measurement" as const, label: "MEASUREMENT", icon: Target },
    { key: "influencers" as const, label: "INFLUENCERS", icon: Users },
    { key: "deliverables" as const, label: "DELIVERABLES", icon: Package },
    { key: "timeline" as const, label: "TIMELINE", icon: Clock },
    { key: "notes" as const, label: "NOTES", icon: MessageSquare },
  ];

  return (
    <div className="min-h-full">
      {/* Hero */}
      <section className="relative px-8 py-8 border-b border-border overflow-hidden">
        <div className="hero-glow-red absolute inset-0" />
        <div className="hero-glow-gold absolute inset-0" />
        <div className="relative z-10">
          <button
            onClick={() => navigate("/campaigns")}
            className="flex items-center gap-1.5 font-data text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO CAMPAIGNS
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-accent" />
            <h1 className="font-display text-3xl text-foreground italic">{campaign.name}</h1>
            <Badge
              className={`font-data text-[9px] tracking-wider uppercase ${
                isCompleted
                  ? "bg-accent/20 text-accent border-accent/30"
                  : "bg-primary/15 text-primary border-primary/30"
              }`}
            >
              {isCompleted ? "COMPLETED" : "LIVE"}
            </Badge>
          </div>
          <p className="font-data text-[10px] text-muted-foreground tracking-widest uppercase">
            {displayBrand(campaign.brand)} · {displayCluster(campaign.cluster)}
            {isCompleted && startDate && endDate
              ? ` · ${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`
              : startDate
              ? ` · Started ${format(startDate, "MMM d, yyyy")}`
              : ""}
          </p>
        </div>
      </section>

      {/* Metrics Strip */}
      <div className="grid grid-cols-4 border-b border-border">
        {[
          {
            label: "TIMELINE",
            value: `Day ${elapsedDays}/${totalDays}`,
            sub: timelinePct + "% elapsed",
            pct: timelinePct,
            color: "bg-primary",
            hint: HINTS.timeline,
          },
          {
            label: "DELIVERABLES",
            value: `${deliveredCount}/${totalDeliverables}`,
            sub: deliveryPct + "% complete",
            pct: deliveryPct,
            color: "bg-accent",
            hint: HINTS.deliverables,
          },
          {
            label: "BUDGET",
            value: `$${spent.toLocaleString()}`,
            sub: `of $${budget.toLocaleString()} (${budgetPct}%)`,
            pct: budgetPct,
            color: budgetPct > 90 ? "bg-destructive" : "bg-primary",
            hint: HINTS.budget,
          },
          {
            label: "ACTIVITIES",
            value: activities.length.toString(),
            sub: `${activities.filter((a) => a.type === "note").length} notes`,
            pct: null,
            color: "",
            hint: HINTS.activities,
          },
        ].map((m) => (
          <div key={m.label} title={m.hint} className="p-5 border-r border-border last:border-r-0">
            <span className="font-data text-[9px] tracking-[0.2em] text-muted-foreground">{m.label}</span>
            <p className="text-xl font-bold text-foreground mt-1">{m.value}</p>
            <p className="font-data text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
            {m.pct !== null && (
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${m.color} transition-all`} style={{ width: `${m.pct}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border px-8">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 font-data text-[10px] tracking-[0.15em] py-3 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex">
        <div className="flex-1 px-8 py-6 min-h-[50vh]">
          {activeTab === "overview" && (
            <OverviewTab
              campaign={campaign}
              activities={activities}
              deliveredCount={deliveredCount}
              totalDeliverables={totalDeliverables}
            />
          )}
          {activeTab === "measurement" && (
            <MeasurementFrameworkPanel
              campaignName={campaign.name}
              brand={campaign.brand}
              campaignId={campaign.id}
              budget={campaign.budget}
              spent={campaign.spent}
              status={campaign.status}
            />
          )}
          {activeTab === "influencers" && (
            <CampaignInfluencers
              campaignId={campaign.id}
              campaignStartDate={campaign.start_date}
              campaignEndDate={campaign.end_date}
            />
          )}
          {activeTab === "deliverables" && (
            <DeliverablesTab
              deliverables={deliverablesList}
              delivered={deliveredSet}
              onToggle={toggleDeliverable}
            />
          )}
          {activeTab === "timeline" && (
            <TimelineTab activities={activities} />
          )}
          {activeTab === "notes" && (
            <NotesTab
              activities={activities.filter((a) => a.type === "note" || a.type === "change")}
              showForm={showNoteForm}
              setShowForm={setShowNoteForm}
              noteTitle={noteTitle}
              setNoteTitle={setNoteTitle}
              noteContent={noteContent}
              setNoteContent={setNoteContent}
              noteType={noteType}
              setNoteType={setNoteType}
              onSubmit={() => {
                if (!noteTitle.trim()) return;
                addActivity.mutate({ type: noteType, title: noteTitle, content: noteContent });
              }}
              isPending={addActivity.isPending}
            />
          )}
        </div>

        {/* Right sidebar - campaign info */}
        <div className="w-72 border-l border-border px-5 py-6 hidden lg:block sticky top-0 self-start max-h-screen overflow-y-auto">
          <h3 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-4">
            Campaign Details
          </h3>
          <div className="space-y-3">
            {campaign.brand && (
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">BRAND</span>
                <p className="font-ui text-sm text-foreground">{displayBrand(campaign.brand)}</p>
              </div>
            )}
            {campaign.objective && (
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">OBJECTIVES</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {campaign.objective.split(",").map((o) => o.trim()).filter(Boolean).map((o) => (
                    <span key={o} className="font-data text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {campaign.target_audience && (
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">AUDIENCE</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {campaign.target_audience.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span key={t} className="font-data text-[8px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {campaign.kpis && (
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">KPIs</span>
                <p className="font-ui text-xs text-muted-foreground mt-1">{campaign.kpis}</p>
              </div>
            )}
            {startDate && (
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">DATES</span>
                <p className="font-data text-xs text-foreground mt-1">
                  {format(startDate, "MMM d")} → {endDate ? format(endDate, "MMM d, yyyy") : "TBD"}
                </p>
              </div>
            )}
            {(campaign.markets || []).length > 0 && (
              <div>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">MARKETS</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(campaign.markets || []).map((m) => (
                    <span key={m} className="font-data text-[8px] px-1.5 py-0.5 bg-muted text-foreground border border-border rounded">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function OverviewTab({
  campaign,
  activities,
  deliveredCount,
  totalDeliverables,
}: {
  campaign: Campaign;
  activities: any[];
  deliveredCount: number;
  totalDeliverables: number;
}) {
  const recentActivities = activities.slice(0, 5);
  const isCompleted = campaign.status === "completed";
  const resultChips = (campaign.kpis || "").split("·").map((s) => s.trim()).filter(Boolean);
  const resultsNote = (campaign.notes || "").startsWith("RESULTS:") ? campaign.notes : null;

  return (
    <div className="space-y-6">
      {isCompleted && resultChips.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-foreground mb-4">Final Results</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {resultChips.map((chip) => {
              const [value, ...rest] = chip.split(" ");
              return (
                <div key={chip} className="border border-accent/30 bg-accent/5 p-4 rounded-lg">
                  <p className="font-display text-xl font-bold text-foreground">{value}</p>
                  <p className="font-data text-[9px] text-muted-foreground tracking-wider uppercase mt-1">
                    {rest.join(" ")}
                  </p>
                </div>
              );
            })}
          </div>
          {resultsNote && (
            <div className="mt-4 border border-border bg-card p-4 rounded-lg">
              <span className="font-data text-[9px] text-accent tracking-[0.2em] uppercase">Results & Learnings</span>
              <p className="font-ui text-sm text-foreground leading-relaxed mt-2">
                {resultsNote.replace(/^RESULTS:\s*/, "")}
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="font-display text-lg text-foreground mb-4">Campaign Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border p-4 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-accent" />
              <span className="font-data text-[10px] tracking-wider text-muted-foreground">DELIVERY PROGRESS</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {deliveredCount}/{totalDeliverables}
            </p>
            <Progress value={totalDeliverables > 0 ? (deliveredCount / totalDeliverables) * 100 : 0} className="mt-2 h-1.5" />
          </div>
          <div className="border border-border p-4 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-data text-[10px] tracking-wider text-muted-foreground">ACTIVITY</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{activities.length}</p>
            <p className="font-data text-[10px] text-muted-foreground mt-1">
              {activities.filter((a) => a.type === "change").length} changes logged
            </p>
          </div>
        </div>
      </div>

      {recentActivities.length > 0 && (
        <div>
          <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-3">
            RECENT ACTIVITY
          </h3>
          <div className="space-y-2">
            {recentActivities.map((a) => {
              const config = typeConfig[a.type as ActivityType] || typeConfig.note;
              const Icon = config.icon;
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 border border-border bg-card/50">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-sm text-foreground">{a.title}</p>
                    {a.content && (
                      <p className="font-data text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
                    )}
                  </div>
                  <span className="font-data text-[9px] text-muted-foreground shrink-0">
                    {format(new Date(a.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DeliverablesTab({
  deliverables,
  delivered,
  onToggle,
}: {
  deliverables: string[];
  delivered: Set<string>;
  onToggle: (d: string, done: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Deliverables Checklist</h2>
        <span className="font-data text-[10px] text-muted-foreground tracking-wider">
          {delivered.size}/{deliverables.length} COMPLETED
        </span>
      </div>

      {deliverables.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border">
          <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No deliverables defined</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliverables.map((d) => {
            const done = delivered.has(d);
            return (
              <button
                key={d}
                onClick={() => onToggle(d, done)}
                className={`w-full flex items-center gap-3 p-4 border transition-all text-left ${
                  done
                    ? "border-accent/30 bg-accent/5"
                    : "border-border bg-card hover:bg-card/80"
                }`}
              >
                {done ? (
                  <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`font-ui text-sm ${done ? "text-accent line-through" : "text-foreground"}`}>
                  {d}
                </span>
                {done && (
                  <Badge variant="outline" className="ml-auto font-data text-[8px] tracking-wider text-accent border-accent/20">
                    DELIVERED
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimelineTab({ activities }: { activities: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-foreground">Activity Timeline</h2>

      {activities.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border">
          <Clock className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
          <div className="space-y-0">
            {activities.map((a, i) => {
              const config = typeConfig[a.type as ActivityType] || typeConfig.note;
              const Icon = config.icon;
              const showDateHeader =
                i === 0 ||
                format(new Date(a.created_at), "yyyy-MM-dd") !==
                  format(new Date(activities[i - 1].created_at), "yyyy-MM-dd");

              return (
                <div key={a.id}>
                  {showDateHeader && (
                    <div className="flex items-center gap-3 py-3 pl-8">
                      <span className="font-data text-[10px] tracking-wider text-muted-foreground font-semibold">
                        {isToday(new Date(a.created_at))
                          ? "TODAY"
                          : format(new Date(a.created_at), "EEEE, MMM d").toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-3 py-2 relative">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      a.type === "post_delivered" ? "bg-accent/20" :
                      a.type === "change" ? "bg-yellow-500/20" :
                      "bg-primary/20"
                    }`}>
                      <Icon className={`w-3 h-3 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pb-3">
                      <div className="flex items-center gap-2">
                        <p className="font-ui text-sm text-foreground">{a.title}</p>
                        <Badge variant="outline" className={`font-data text-[8px] tracking-wider ${config.color} border-current/20`}>
                          {config.label.toUpperCase()}
                        </Badge>
                      </div>
                      {a.content && (
                        <p className="font-data text-[11px] text-muted-foreground mt-1">{a.content}</p>
                      )}
                      <span className="font-data text-[9px] text-muted-foreground/60 mt-1 block">
                        {format(new Date(a.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NotesTab({
  activities,
  showForm,
  setShowForm,
  noteTitle,
  setNoteTitle,
  noteContent,
  setNoteContent,
  noteType,
  setNoteType,
  onSubmit,
  isPending,
}: {
  activities: any[];
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  noteTitle: string;
  setNoteTitle: (v: string) => void;
  noteContent: string;
  setNoteContent: (v: string) => void;
  noteType: ActivityType;
  setNoteType: (v: ActivityType) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground">Notes & Changes</h2>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="font-data text-[10px] tracking-wider"
        >
          {showForm ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
          {showForm ? "CANCEL" : "ADD NOTE"}
        </Button>
      </div>

      {showForm && (
        <div className="border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex gap-2">
            {(["note", "change"] as ActivityType[]).map((t) => (
              <button
                key={t}
                onClick={() => setNoteType(t)}
                className={`font-data text-[10px] tracking-wider px-3 py-1.5 border transition-colors ${
                  noteType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "note" ? "📝 NOTE" : "⚠️ CHANGE"}
              </button>
            ))}
          </div>
          <Input
            placeholder="Title (e.g., Creator swap, Schedule change...)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            className="font-ui text-sm"
          />
          <Textarea
            placeholder="Details (optional)..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={3}
            className="font-ui text-sm resize-none"
          />
          <Button
            onClick={onSubmit}
            disabled={!noteTitle.trim() || isPending}
            className="font-data text-[10px] tracking-wider"
          >
            <Send className="w-3 h-3 mr-1" />
            {isPending ? "SAVING..." : "SAVE"}
          </Button>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No notes or changes logged yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const config = typeConfig[a.type as ActivityType] || typeConfig.note;
            const Icon = config.icon;
            return (
              <div key={a.id} className="border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-ui text-sm font-medium text-foreground">{a.title}</p>
                      <Badge variant="outline" className={`font-data text-[8px] tracking-wider ${config.color}`}>
                        {config.label.toUpperCase()}
                      </Badge>
                    </div>
                    {a.content && (
                      <p className="font-data text-[11px] text-muted-foreground">{a.content}</p>
                    )}
                    <span className="font-data text-[9px] text-muted-foreground/60 mt-2 block">
                      {format(new Date(a.created_at), "MMM d, yyyy · HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
