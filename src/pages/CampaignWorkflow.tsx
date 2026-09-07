import { useState, useMemo, useCallback } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format, parse, differenceInDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { displayBrand, displayCluster, NESTLE_CLUSTERS, nestleizeAll } from "@/lib/nestleize";
import { CURATED_FOOD_TRENDS, FOOD_TREND_CATEGORIES } from "@/lib/foodTrends";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  TrendingUp,
  FileText,
  Sparkles,
  Users,
  Eye,
  CalendarDays,
  BarChart3,
  Check,
  ChevronRight,
  Zap,
  Target,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Instagram,
  Search,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatorDetailPanel } from "@/components/home/CreatorDetailPanel";
import { TrendDetailPanel } from "@/components/home/TrendDetailPanel";
import { LiveTrackingView } from "@/components/campaign/LiveTrackingView";
import { MeasurementFrameworkPanel } from "@/components/campaign/MeasurementFrameworkPanel";
import { BulkCreatorUpload } from "@/components/campaign/BulkCreatorUpload";

/* ─── constants ─── */
const STEPS = [
  { num: 1, label: "Trends", icon: TrendingUp },
  { num: 2, label: "Brief", icon: FileText },
  { num: 3, label: "AI Optimize", icon: Sparkles },
  { num: 4, label: "Select", icon: Users },
  { num: 5, label: "Review", icon: Eye },
  { num: 6, label: "Schedule", icon: CalendarDays },
  { num: 7, label: "Measure", icon: BarChart3 },
] as const;

const BRANDS = [
  "Maggi", "Cerelac",
  "NIDO", "S-26", "Nesquik", "Carnation",
  "Nescafé", "Milo", "Nestlé Pure Life",
  "KitKat", "Aero",
];

const DIVISIONS: Record<string, string> = {
  "Maggi": "CUL", "Cerelac": "CUL",
  "NIDO": "DAI", "S-26": "DAI", "Nesquik": "DAI", "Carnation": "DAI",
  "Nescafé": "BEV", "Milo": "BEV", "Nestlé Pure Life": "BEV",
  "KitKat": "CNF", "Aero": "CNF",
};

const MARKETS = ["UAE", "KSA", "Kuwait", "Qatar", "Bahrain", "Oman", "Jordan", "Lebanon", "India"];

const normalizePlatform = (value?: string | null) => {
  const v = String(value || "").trim().toLowerCase();
  if (v.includes("snap") || v === "sc") return "snapchat";
  if (v.includes("tik") || v === "tt") return "tiktok";
  if (v.includes("insta") || v === "ig") return "instagram";
  if (v.includes("you") || v === "yt") return "youtube";
  return v || "instagram";
};

const platformLabel = (value?: string | null) => {
  const platform = normalizePlatform(value);
  if (platform === "snapchat") return "Snapchat";
  if (platform === "tiktok") return "TikTok";
  if (platform === "instagram") return "Instagram";
  if (platform === "youtube") return "YouTube";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
};

const uniqueCreatorsById = (rows: any[]) => Array.from(new Map(rows.map((c) => [c.id, c])).values());
const creatorCardKey = (c: any) => `${c.id}:${normalizePlatform(c.platform)}:${c._platformAccountId || String(c.handle || "").toLowerCase()}`;

/* ─── types ─── */
interface CampaignDraft {
  id?: string;
  name: string;
  brand: string;
  cluster: string;
  objective: string;
  target_audience: string;
  kpis: string;
  deliverables: string;
  notes: string;
  budget: number;
  start_date: string;
  end_date: string;
  age_range: string;
  demographics: string;
  markets: string[];
  step: number;
  status: string;
}

const empty: CampaignDraft = {
  name: "", brand: "", cluster: "", objective: "", target_audience: "",
  kpis: "", deliverables: "", notes: "", budget: 0,
  start_date: "", end_date: "", age_range: "", demographics: "",
  markets: [], step: 1, status: "draft",
};

/* ─── component ─── */
export default function CampaignWorkflow() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("id");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [draft, setDraft] = useState<CampaignDraft>({ ...empty });
  const [dbSpent, setDbSpent] = useState<number | null>(null);
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [contentStatuses, setContentStatuses] = useState<Record<string, "approved" | "rejected" | "pending">>({});
  const [scheduleEntries, setScheduleEntries] = useState<{ date: string; deliverable: string }[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [viewingCreator, setViewingCreator] = useState<any>(null);
  const [viewingTrend, setViewingTrend] = useState<any>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  /* ─── data queries ─── */
  const { data: trends = [] } = useQuery({
    queryKey: ["trends", "food"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trends")
        .select("*")
        .in("category", FOOD_TREND_CATEGORIES)
        .order("relevance_score", { ascending: false });
      // Shared legacy table only holds beauty rows — fall back to curated food trends
      return data && data.length > 0 ? data : CURATED_FOOD_TRENDS;
    },
  });

  const { data: creators = [] } = useQuery({
    queryKey: ["creators-workflow"],
    queryFn: async () => {
      const { data } = await supabase.from("creators").select("*").in("cluster", NESTLE_CLUSTERS).order("followers", { ascending: false, nullsFirst: false });
      const { data: platformRows } = await supabase.from("creator_platforms").select("*");
      const baseCreators = nestleizeAll(data || []);
      const byId = new Map(baseCreators.map((c: any) => [c.id, c]));
      const cards = [...baseCreators];
      const seen = new Set(baseCreators.map((c: any) => `${c.id}:${normalizePlatform(c.platform)}:${String(c.handle || "").toLowerCase()}`));

      (platformRows || []).forEach((p: any) => {
        const creator: any = byId.get(p.creator_id);
        if (!creator) return;
        const platform = normalizePlatform(p.platform);
        const handle = p.handle || creator.handle;
        const key = `${creator.id}:${platform}:${String(handle || "").toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        cards.push({
          ...creator,
          platform,
          handle,
          followers: p.followers || creator.followers || 0,
          engagement_rate: p.engagement_rate || creator.engagement_rate || 0,
          avatar_url: p.avatar_url || creator.avatar_url,
          bio: p.bio || creator.bio,
          _platformAccountId: p.id,
        });
      });

      return cards.sort((a: any, b: any) => (b.followers || 0) - (a.followers || 0));
    },
  });

  // Load existing campaign if editing
  useQuery({
    queryKey: ["campaign-edit", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
      if (data) {
        setDbSpent((data as any).spent ?? null);
        setDraft({
          id: data.id,
          name: data.name || "",
          brand: displayBrand(data.brand) || "",
          cluster: displayCluster(data.cluster) || "",
          objective: (data as any).objective || "",
          target_audience: (data as any).target_audience || "",
          kpis: (data as any).kpis || "",
          deliverables: (data as any).deliverables || "",
          notes: (data as any).notes || "",
          budget: data.budget || 0,
          start_date: data.start_date || "",
          end_date: data.end_date || "",
          age_range: (data as any).age_range || "",
          demographics: (data as any).demographics || "",
          markets: (data as any).markets || [],
          step: data.step || 1,
          status: data.status || "draft",
        });
        setCurrentStep(data.step || 1);

        // Load selected creators from campaign_creators table
        const { data: ccData } = await supabase
          .from("campaign_creators")
          .select("creator_id")
          .eq("campaign_id", data.id);
        if (ccData && ccData.length > 0) {
          setSelectedCreators(ccData.map((cc: any) => cc.creator_id));
        }
      }
      return data;
    },
  });

  /* ─── save mutation ─── */
  const saveMutation = useMutation({
    mutationFn: async (d: CampaignDraft & { _selectedCreators?: string[]; _contentStatuses?: Record<string, string>; _scheduleEntries?: { date: string; deliverable: string }[] }) => {
      const { _selectedCreators, _contentStatuses: statusMap, _scheduleEntries, ...rest } = d;
      const payload = {
        name: rest.name || "Untitled Campaign",
        brand: rest.brand,
        cluster: rest.cluster,
        budget: rest.budget,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        step: rest.step,
        status: rest.status,
        description: rest.objective,
        objective: rest.objective,
        target_audience: rest.target_audience,
        kpis: rest.kpis,
        deliverables: rest.deliverables,
        markets: rest.markets?.length ? rest.markets : null,
        age_range: rest.age_range,
        demographics: rest.demographics,
        notes: rest.notes,
      };
      let campaignId = rest.id;
      if (campaignId) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", campaignId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("campaigns").insert(payload).select().single();
        if (error) throw error;
        campaignId = data.id;
        setDraft((prev) => ({ ...prev, id: data.id }));
      }

      // Persist selected creators to campaign_creators table (exclude rejected)
      if (_selectedCreators && _selectedCreators.length > 0 && campaignId) {
        const cStatuses = statusMap || {};
        const approvedCreators = _selectedCreators.filter((id) => cStatuses[id] !== "rejected");
        const rejectedCreators = _selectedCreators.filter((id) => cStatuses[id] === "rejected");

        // Remove rejected creators from DB if they were previously saved
        if (rejectedCreators.length > 0) {
          await supabase
            .from("campaign_creators")
            .delete()
            .eq("campaign_id", campaignId)
            .in("creator_id", rejectedCreators);
        }

        // Get existing campaign creators
        const { data: existing } = await supabase
          .from("campaign_creators")
          .select("id, creator_id")
          .eq("campaign_id", campaignId);
        const existingIds = new Set((existing || []).map((e: any) => e.creator_id));
        const toInsert = approvedCreators.filter((id) => !existingIds.has(id));
        if (toInsert.length > 0) {
          await supabase.from("campaign_creators").insert(
            toInsert.map((creator_id) => ({ campaign_id: campaignId!, creator_id, status: "invited" }))
          );
        }

        // If publishing (status=active) and schedule entries exist, create deliverables
        if (rest.status === "active" && _scheduleEntries && _scheduleEntries.length > 0) {
          // Re-fetch campaign_creators to get their IDs
          const { data: ccRows } = await supabase
            .from("campaign_creators")
            .select("id, creator_id")
            .eq("campaign_id", campaignId);
          if (ccRows && ccRows.length > 0) {
            // Delete existing deliverables for this campaign's creators to avoid dupes
            const ccIds = ccRows.map((cc: any) => cc.id);
            await supabase.from("campaign_deliverables").delete().in("campaign_creator_id", ccIds);

            // Create deliverables: each schedule entry × each approved creator
            const deliverableRows: { campaign_creator_id: string; type: string; due_date: string; status: string; description: string }[] = [];
            for (const cc of ccRows) {
              for (const entry of _scheduleEntries) {
                const typeKey = entry.deliverable.toLowerCase().replace(/\s+/g, "_").replace("instagram_", "ig_");
                deliverableRows.push({
                  campaign_creator_id: cc.id,
                  type: typeKey,
                  due_date: entry.date,
                  status: "pending",
                  description: `${entry.deliverable} for campaign`,
                });
              }
            }
            if (deliverableRows.length > 0) {
              await supabase.from("campaign_deliverables").insert(deliverableRows);
            }
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign-creators"] });
      qc.invalidateQueries({ queryKey: ["content-calendar-deliverables"] });
      toast.success("Campaign saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (key: keyof CampaignDraft, val: any) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const handleBulkComplete = useCallback(async ({ creatorIds, count }: { creatorIds: string[]; count: number }) => {
    const mergedCreatorIds = Array.from(new Set([...selectedCreators, ...creatorIds]));
    setSelectedCreators(mergedCreatorIds);
    const next = 5;
    await saveMutation.mutateAsync({ ...draft, step: next, _selectedCreators: mergedCreatorIds, _contentStatuses: contentStatuses, _scheduleEntries: scheduleEntries } as any);
    // Force refetch so the creators list used by the Review step actually contains the new rows
    await qc.refetchQueries({ queryKey: ["creators-workflow"] });
    await qc.refetchQueries({ queryKey: ["campaign-creators"] });
    setShowBulkUpload(false);
    setCurrentStep(next);
    setDraft((prev) => ({ ...prev, step: next }));
    toast.success(`${count} bulk creators ready for review`);
  }, [contentStatuses, draft, qc, saveMutation, scheduleEntries, selectedCreators]);

  const goNext = () => {
    const next = Math.min(currentStep + 1, 7);
    setCurrentStep(next);
    setDraft((prev) => ({ ...prev, step: next }));
    saveMutation.mutate({ ...draft, step: next, _selectedCreators: selectedCreators, _contentStatuses: contentStatuses, _scheduleEntries: scheduleEntries } as any);
  };

  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 1));

  /* ─── filtered creators for step 4 ─── */
  const recommendedCreators = useMemo(() => {
    if (!draft.brand) return creators.slice(0, 24);
    const matched = creators.filter((c) => c.brand === draft.brand || c.cluster === draft.cluster);
    // Show all matched, or pad with others up to 24
    if (matched.length >= 24) return matched.slice(0, 24);
    const matchedCards = new Set(matched.map(creatorCardKey));
    const rest = creators.filter((c) => !matchedCards.has(creatorCardKey(c)));
    return [...matched, ...rest].slice(0, 24);
  }, [creators, draft.brand, draft.cluster]);

  /* ─── If campaign is active, show live tracking view ─── */
  if (draft.id && (draft.status === "active" || draft.status === "completed")) {
    return <LiveTrackingView campaign={{ ...draft, id: draft.id, spent: dbSpent } as any} />;
  }

  /* ─── render ─── */
  return (
    <div className="min-h-full">
      {/* Hero */}
      <section className="relative px-8 py-8 border-b border-border overflow-hidden">
        <div className="hero-glow-red absolute inset-0" />
        <div className="hero-glow-gold absolute inset-0" />
        <div className="relative z-10">
          {campaignId && (
            <button
              onClick={() => navigate("/campaigns")}
              className="flex items-center gap-1.5 font-data text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              BACK TO CAMPAIGNS
            </button>
          )}
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="font-display text-3xl text-foreground italic">Campaign Workflow</h1>
          </div>
          <p className="font-data text-[10px] text-muted-foreground tracking-widest uppercase">
            {draft.name || "New Campaign"} · Step {currentStep} of 7
          </p>
        </div>
      </section>

      {/* Progress Rail */}
      <div className="px-8 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const done = currentStep > s.num;
            const active = currentStep === s.num;
            const Icon = s.icon;
            return (
              <div key={s.num} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(s.num)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-data tracking-wider transition-all ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                      ? "bg-accent/20 text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden md:inline">{s.label.toUpperCase()}</span>
                  <span className="md:hidden">{s.num}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main: two-column */}
      <div className="flex items-start">
        {/* Left: step content */}
        <div className="flex-1 px-8 py-6 min-h-[60vh]">
          {currentStep === 1 && <StepTrends trends={trends} selected={selectedTrends} onToggle={(id) => setSelectedTrends((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} onExplore={(t) => setViewingTrend(t)} />}
          {currentStep === 2 && <StepBrief draft={draft} set={set} />}
          {currentStep === 3 && <StepAIOptimize draft={draft} set={set} trends={trends} selectedTrends={selectedTrends} />}
          {currentStep === 4 && (showBulkUpload ? <BulkCreatorUpload campaignId={draft.id} onComplete={handleBulkComplete} /> : <StepSelectCreators creators={recommendedCreators} allCreators={creators} selected={selectedCreators} onToggle={(id) => setSelectedCreators((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])} onViewProfile={(c) => setViewingCreator(c)} onBulkUpload={() => setShowBulkUpload(true)} />)}
          {currentStep === 5 && <StepReview creators={uniqueCreatorsById(creators.filter((c) => selectedCreators.includes(c.id)))} statuses={contentStatuses} onStatus={(id, s) => setContentStatuses((p) => ({ ...p, [id]: s }))} />}
          {currentStep === 6 && <StepSchedule date={scheduleDate} setDate={setScheduleDate} draft={draft} schedule={scheduleEntries} setSchedule={setScheduleEntries} />}
          {currentStep === 7 && (
            <div className="space-y-8">
              <div>
                <SectionTitle icon={BarChart3}>Measurement Framework</SectionTitle>
                <p className="font-ui text-sm text-muted-foreground mb-5">
                  One spine, tuned to this brief — Business, Brand and Media KPI layers plus the Picture of Success governance layer.
                </p>
                <MeasurementFrameworkPanel
                  campaignName={draft.name}
                  brand={draft.brand}
                  campaignId={draft.id}
                  budget={draft.budget}
                  spent={dbSpent}
                  status={draft.status}
                />
              </div>
              <StepMeasure creators={uniqueCreatorsById(creators.filter((c) => selectedCreators.includes(c.id) && contentStatuses[c.id] !== "rejected"))} />
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border">
            {currentStep > 1 && (
              <Button variant="outline" onClick={goPrev} className="font-data text-[10px] tracking-wider">
                ← PREVIOUS
              </Button>
            )}
            {currentStep < 7 ? (
              <Button onClick={goNext} className="font-data text-[10px] tracking-wider">
                NEXT STEP <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  saveMutation.mutate({ ...draft, step: 7, status: "active", _selectedCreators: selectedCreators, _contentStatuses: contentStatuses, _scheduleEntries: scheduleEntries } as any, {
                    onSuccess: () => {
                      toast.success("Campaign published!");
                      navigate("/campaigns");
                    },
                  });
                }}
                className="font-data text-[10px] tracking-wider bg-accent text-accent-foreground hover:bg-accent/90"
              >
                PUBLISH CAMPAIGN
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => saveMutation.mutate(draft)}
              className="ml-auto font-data text-[10px] tracking-wider text-muted-foreground"
            >
              SAVE DRAFT
            </Button>
          </div>
        </div>

        {/* Right: progress checklist */}
        <div className="w-72 border-l border-border px-5 py-6 hidden lg:block sticky top-0 self-start max-h-screen overflow-y-auto">
          <h3 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-4">
            Progress
          </h3>
          <div className="space-y-3">
            {STEPS.map((s) => {
              const done = currentStep > s.num;
              const active = currentStep === s.num;
              return (
                <div key={s.num} className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 flex items-center justify-center text-[9px] font-data ${
                      done
                        ? "bg-accent/20 text-accent"
                        : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-1 text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="w-3 h-3" /> : s.num}
                  </div>
                  <span
                    className={`font-ui text-xs ${
                      active ? "text-foreground font-medium" : done ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Campaign summary */}
          {(draft.name || draft.brand || draft.objective || draft.deliverables || draft.target_audience || draft.start_date) && (
            <div className="mt-8 pt-6 border-t border-border space-y-3">
              <h3 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
                Campaign
              </h3>
              {draft.name && <p className="font-ui text-sm text-foreground">{draft.name}</p>}
              {draft.brand && (
                <p className="font-data text-[9px] text-muted-foreground">{draft.brand} · {draft.cluster}</p>
              )}
              {draft.budget > 0 && (
                <p className="font-data text-[9px] text-accent">
                  ${draft.budget.toLocaleString()} budget
                </p>
              )}
              {draft.objective && (
                <div>
                  <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-1">OBJECTIVES</p>
                  <div className="flex flex-wrap gap-1">
                    {draft.objective.split(",").map((o) => o.trim()).filter(Boolean).map((o) => (
                      <span key={o} className="font-data text-[8px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {draft.target_audience && (
                <div>
                  <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-1">AUDIENCE</p>
                  <div className="flex flex-wrap gap-1">
                    {draft.target_audience.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="font-data text-[8px] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {draft.deliverables && (
                <div>
                  <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-1">DELIVERABLES</p>
                  <div className="flex flex-wrap gap-1">
                    {draft.deliverables.split(",").map((d) => d.trim()).filter(Boolean).map((d) => (
                      <span key={d} className="font-data text-[8px] px-1.5 py-0.5 bg-muted text-foreground border border-border rounded">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(draft.markets || []).length > 0 && (
                <div>
                  <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-1">MARKETS</p>
                  <div className="flex flex-wrap gap-1">
                    {(draft.markets || []).map((m) => (
                      <span key={m} className="font-data text-[8px] px-1.5 py-0.5 bg-muted text-foreground border border-border rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {draft.start_date && (
                <p className="font-data text-[9px] text-muted-foreground">
                  📅 {draft.start_date}{draft.end_date ? ` → ${draft.end_date}` : ""}
                </p>
              )}
              {selectedCreators.length > 0 && (
                <p className="font-data text-[9px] text-muted-foreground">
                  {selectedCreators.length} creators selected
                </p>
              )}
              {selectedTrends.length > 0 && (
                <p className="font-data text-[9px] text-muted-foreground">
                  {selectedTrends.length} trends linked
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <CreatorDetailPanel creator={viewingCreator} onClose={() => setViewingCreator(null)} />
      {viewingTrend && (
        <TrendDetailPanel trend={viewingTrend} onClose={() => setViewingTrend(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   STEP COMPONENTS
   ═══════════════════════════════════════════════ */

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-primary" />
      <h2 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">{children}</h2>
    </div>
  );
}

/* ─── Step 1: Trends ─── */
function StepTrends({ trends, selected, onToggle, onExplore }: { trends: any[]; selected: string[]; onToggle: (id: string) => void; onExplore?: (trend: any) => void }) {
  return (
    <div>
      <SectionTitle icon={TrendingUp}>Select Relevant Trends</SectionTitle>
      <p className="font-ui text-sm text-muted-foreground mb-6">
        Choose trends that align with your campaign to inform the brief and creator selection.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {trends.map((t) => {
          const active = selected.includes(t.id);
          return (
            <div
              key={t.id}
              className={`text-left border p-4 transition-all ${
                active ? "border-primary bg-primary/5" : "border-border bg-surface-1 hover:border-border/80"
              }`}
            >
              <button onClick={() => onToggle(t.id)} className="w-full text-left">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-ui text-sm text-foreground font-medium">{t.title}</span>
                  <span className="font-data text-[9px] text-accent ml-2 shrink-0">{t.relevance_score}%</span>
                </div>
                <p className="font-ui text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {t.description}
                </p>
              </button>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {t.brand && (
                    <span className="font-data text-[9px] text-primary tracking-wider">{t.brand}</span>
                  )}
                  <span className="font-data text-[9px] text-muted-foreground">{t.category}</span>
                </div>
                {onExplore && !t.curated && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onExplore(t); }}
                    className="font-data text-[9px] tracking-wider text-muted-foreground hover:text-primary transition-colors px-2 py-0.5 border border-border hover:border-primary/30"
                  >
                    EXPLORE ↗
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 2: Brief Input ─── */
const OBJECTIVES = [
  "Brand Awareness", "Product Launch", "Engagement Growth", "Conversions / Sales",
  "Content Creation", "Event Amplification", "Market Penetration", "Rebranding",
];

const DELIVERABLE_OPTIONS = [
  { label: "Instagram Reels", icon: "🎬" },
  { label: "Instagram Stories", icon: "📱" },
  { label: "Instagram Static Post", icon: "🖼️" },
  { label: "TikTok Video", icon: "🎵" },
  { label: "YouTube Integration", icon: "▶️" },
  { label: "YouTube Shorts", icon: "📹" },
  { label: "Blog / Article", icon: "📝" },
  { label: "Unboxing Video", icon: "📦" },
  { label: "GRWM / Tutorial", icon: "💄" },
  { label: "Live Stream", icon: "🔴" },
  { label: "UGC / Whitelisted Ad", icon: "📢" },
  { label: "Event Attendance", icon: "🎪" },
  { label: "Snapchat Story", icon: "👻" },
  { label: "Snapchat Spotlight", icon: "⚡" },
];

function StepBrief({ draft, set }: { draft: CampaignDraft; set: (k: keyof CampaignDraft, v: any) => void }) {
  const [audienceInput, setAudienceInput] = useState("");
  const [kpiInput, setKpiInput] = useState(draft.kpis || "");
  const [otherObjective, setOtherObjective] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<{ label: string; reason: string }[]>([]);
  const [aiCorrected, setAiCorrected] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Parse objectives from comma-separated string
  const selectedObjectives = useMemo(() => {
    if (!draft.objective) return [];
    return draft.objective.split(",").map((s) => s.trim()).filter(Boolean);
  }, [draft.objective]);

  const toggleObjective = (obj: string) => {
    const next = selectedObjectives.includes(obj)
      ? selectedObjectives.filter((o) => o !== obj)
      : [...selectedObjectives, obj];
    set("objective", next.join(", "));
  };

  const addOtherObjective = () => {
    if (otherObjective.trim() && !selectedObjectives.includes(otherObjective.trim())) {
      set("objective", [...selectedObjectives, otherObjective.trim()].join(", "));
      setOtherObjective("");
    }
  };

  // Audience keywords as tags
  const audienceKeywords = useMemo(() => {
    if (!draft.target_audience) return [];
    return draft.target_audience.split(",").map((s) => s.trim()).filter(Boolean);
  }, [draft.target_audience]);

  const addAudienceKeyword = useCallback(async () => {
    const kw = audienceInput.trim();
    if (!kw) return;

    setAiLoading(true);
    setAiSuggestions([]);
    setAiCorrected("");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-audience`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            keyword: kw,
            brand: draft.brand,
            existingKeywords: audienceKeywords,
          }),
        }
      );

      if (!resp.ok) {
        // Fallback: just add the keyword directly
        if (!audienceKeywords.includes(kw)) {
          set("target_audience", [...audienceKeywords, kw].join(", "));
        }
        setAudienceInput("");
        setAiLoading(false);
        return;
      }

      const data = await resp.json();
      setAiCorrected(data.corrected || kw);
      setAiSuggestions(data.suggestions || []);
    } catch {
      // Fallback: just add keyword
      if (!audienceKeywords.includes(kw)) {
        set("target_audience", [...audienceKeywords, kw].join(", "));
      }
      setAudienceInput("");
    }
    setAiLoading(false);
  }, [audienceInput, draft.brand, audienceKeywords, set]);

  const selectAiSuggestion = (label: string) => {
    if (!audienceKeywords.includes(label)) {
      set("target_audience", [...audienceKeywords, label].join(", "));
    }
    setAiSuggestions([]);
    setAiCorrected("");
    setAudienceInput("");
  };

  const addCorrectedKeyword = () => {
    if (aiCorrected && !audienceKeywords.includes(aiCorrected)) {
      set("target_audience", [...audienceKeywords, aiCorrected].join(", "));
    }
    setAiSuggestions([]);
    setAiCorrected("");
    setAudienceInput("");
  };

  const removeAudienceKeyword = (kw: string) => {
    set("target_audience", audienceKeywords.filter((k) => k !== kw).join(", "));
  };

  const suggestedKeywords = ["Gen Z", "Millennials", "Moms 25-45", "Foodies", "Home Cooking", "Family & Lifestyle", "Nutrition", "Urban", "MENA Region", "Gulf States", "Arabic Speaking", "English Speaking"];

  // Parse deliverables
  const selectedDeliverables = useMemo(() => {
    if (!draft.deliverables) return [];
    return draft.deliverables.split(",").map((s) => s.trim()).filter(Boolean);
  }, [draft.deliverables]);

  const toggleDeliverable = (d: string) => {
    const next = selectedDeliverables.includes(d)
      ? selectedDeliverables.filter((x) => x !== d)
      : [...selectedDeliverables, d];
    set("deliverables", next.join(", "));
  };

  // KPI extraction (simulated AI)
  const extractedKpis = useMemo(() => {
    if (!kpiInput) return [];
    // Patterns: support both "10M impressions" AND "3.5% CTR" style
    const patterns: { regex: RegExp; metric: string; icon: string }[] = [
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:impressions)/i, metric: "Impressions", icon: "👁️" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:reach|unique reach)/i, metric: "Reach", icon: "👥" },
      { regex: /(\d+\.?\d*)\s*%?\s*(?:er|engagement|eng\.?\s*rate)/i, metric: "Engagement Rate", icon: "💬" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:views|video views)/i, metric: "Video Views", icon: "▶️" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:clicks?)/i, metric: "Clicks", icon: "🖱️" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:conversions?|sales|purchases?)/i, metric: "Conversions", icon: "🛒" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:followers?|follower growth)/i, metric: "Follower Growth", icon: "📈" },
      { regex: /(\d+\.?\d*)\s*[xX]\s*(?:roi|return)/i, metric: "ROI Target", icon: "💰" },
      { regex: /(\$?\d+[\d.,]*\s*[MmKk]?)\s*(?:revenue|gmv)/i, metric: "Revenue", icon: "💵" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:shares?|reposts?)/i, metric: "Shares", icon: "🔄" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:comments?|replies)/i, metric: "Comments", icon: "💬" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:saves?|bookmarks?)/i, metric: "Saves", icon: "🔖" },
      { regex: /(\d+[\d.,]*\s*[MmKk]?)\s*(?:likes?)/i, metric: "Likes", icon: "❤️" },
      // Percentage-first patterns: "3.5% CTR", "2% CVR", etc.
      { regex: /(\d+\.?\d*)\s*%\s*(?:ctr|click.?through)/i, metric: "CTR", icon: "🎯" },
      { regex: /(\d+\.?\d*)\s*%\s*(?:cvr|conversion rate)/i, metric: "Conversion Rate", icon: "🛒" },
      { regex: /(\d+\.?\d*)\s*%\s*(?:vtr|view.?through|completion)/i, metric: "View-Through Rate", icon: "▶️" },
      { regex: /(\d+\.?\d*)\s*%\s*(?:bounce)/i, metric: "Bounce Rate", icon: "↩️" },
      { regex: /(\d+\.?\d*)\s*%\s*(?:cpe|cost per eng)/i, metric: "CPE", icon: "💬" },
      // Also support "CTR 3.5%", "CTR of 3.5%"
      { regex: /(?:ctr|click.?through)\s*(?:of\s+)?(\d+\.?\d*)\s*%/i, metric: "CTR", icon: "🎯" },
      { regex: /(?:cvr|conversion rate)\s*(?:of\s+)?(\d+\.?\d*)\s*%/i, metric: "Conversion Rate", icon: "🛒" },
      // CPV / CPM / CPC as dollar amounts
      { regex: /(?:cpv|cost per view)\s*(?:of\s+)?\$?(\d+\.?\d*)/i, metric: "CPV", icon: "💵" },
      { regex: /(?:cpm)\s*(?:of\s+)?\$?(\d+\.?\d*)/i, metric: "CPM", icon: "💵" },
      { regex: /(?:cpc|cost per click)\s*(?:of\s+)?\$?(\d+\.?\d*)/i, metric: "CPC", icon: "🖱️" },
    ];
    const found: { metric: string; value: string; icon: string }[] = [];
    const seenMetrics = new Set<string>();
    patterns.forEach(({ regex, metric, icon }) => {
      if (seenMetrics.has(metric)) return;
      const match = kpiInput.match(regex);
      if (match) {
        seenMetrics.add(metric);
        let val = match[1].trim();
        // Append % for rate metrics
        if (["CTR", "Conversion Rate", "View-Through Rate", "Bounce Rate", "Engagement Rate", "CPE"].includes(metric) && !val.includes("%")) {
          val = val + "%";
        }
        found.push({ metric, value: val, icon });
      }
    });
    return found;
  }, [kpiInput]);

  return (
    <div className="max-w-2xl space-y-8">
      <SectionTitle icon={FileText}>Campaign Brief</SectionTitle>

      {/* Name & Brand */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Campaign Name</label>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g., Ramadan Family Moments 2027" className="bg-card border-border font-ui" />
        </div>
        <div className="space-y-2">
          <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Brand</label>
          <Select value={draft.brand} onValueChange={(v) => { set("brand", v); set("cluster", DIVISIONS[v] || ""); }}>
            <SelectTrigger className="bg-card border-border font-ui"><SelectValue placeholder="Select brand" /></SelectTrigger>
            <SelectContent>
              {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campaign Objectives — multi-choice */}
      <div className="space-y-3">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          Campaign Objectives <span className="text-muted-foreground/60">(select multiple)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((obj) => {
            const active = selectedObjectives.includes(obj);
            return (
              <button
                key={obj}
                type="button"
                onClick={() => toggleObjective(obj)}
                className={`px-3 py-1.5 font-ui text-xs border transition-all ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
                }`}
              >
                {active && <Check className="w-3 h-3 inline mr-1" />}
                {obj}
              </button>
            );
          })}
        </div>
        {/* Other objective */}
        <div className="flex gap-2">
          <Input
            value={otherObjective}
            onChange={(e) => setOtherObjective(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOtherObjective())}
            placeholder="Other objective..."
            className="bg-card border-border font-ui text-sm h-8 max-w-[240px]"
          />
          <Button type="button" variant="outline" size="sm" onClick={addOtherObjective} className="h-8 font-data text-[9px] tracking-wider">
            ADD
          </Button>
        </div>
        {/* Custom objectives shown as removable tags */}
        {selectedObjectives.filter((o) => !OBJECTIVES.includes(o)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {selectedObjectives.filter((o) => !OBJECTIVES.includes(o)).map((o) => (
              <Badge key={o} variant="secondary" className="font-ui text-xs gap-1 bg-accent/10 text-accent border-accent/20">
                {o}
                <button type="button" onClick={() => toggleObjective(o)} className="ml-0.5 hover:text-foreground">×</button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Target Audience — keyword tags with AI */}
      <div className="space-y-3">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          Target Audience <span className="text-muted-foreground/60">(type & press Enter for AI suggestions)</span>
        </label>
        {/* Current tags */}
        {audienceKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {audienceKeywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="font-ui text-xs gap-1 bg-surface-1 border border-border">
                {kw}
                <button type="button" onClick={() => removeAudienceKeyword(kw)} className="ml-0.5 hover:text-primary">×</button>
              </Badge>
            ))}
          </div>
        )}
        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={audienceInput}
            onChange={(e) => { setAudienceInput(e.target.value); setAiSuggestions([]); setAiCorrected(""); }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAudienceKeyword())}
            placeholder="e.g., Egyptian moms cooking daily family meals → press Enter for AI suggestions..."
            className="bg-card border-border font-ui text-sm h-8"
            disabled={aiLoading}
          />
          {aiLoading && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
              <span className="font-data text-[9px] text-accent tracking-wider">THINKING...</span>
            </div>
          )}
        </div>

        {/* AI Suggestions Panel */}
        {(aiCorrected || aiSuggestions.length > 0) && (
          <div className="bg-surface-1 border border-accent/30 p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span className="font-data text-[9px] text-accent tracking-[0.2em]">AI SUGGESTIONS</span>
            </div>

            {/* Corrected keyword */}
            {aiCorrected && (
              <div className="flex items-center gap-2">
                <span className="font-data text-[9px] text-muted-foreground tracking-wider">CORRECTED:</span>
                <button
                  type="button"
                  onClick={addCorrectedKeyword}
                  className="px-2.5 py-1 font-ui text-xs border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  ✓ {aiCorrected}
                </button>
              </div>
            )}

            {/* Refined suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-data text-[9px] text-muted-foreground tracking-wider block">REFINED OPTIONS — click to add:</span>
                {aiSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectAiSuggestion(s.label)}
                    className="flex items-center gap-3 w-full text-left px-3 py-2 border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <span className="font-ui text-xs text-foreground group-hover:text-primary transition-colors">
                      {s.label}
                    </span>
                    <span className="font-data text-[9px] text-muted-foreground ml-auto">
                      {s.reason}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => { setAiSuggestions([]); setAiCorrected(""); setAudienceInput(""); }}
              className="font-data text-[9px] text-muted-foreground hover:text-foreground tracking-wider transition-colors"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Quick-add suggestions */}
        {aiSuggestions.length === 0 && !aiLoading && (
          <div>
            <span className="font-data text-[9px] text-muted-foreground tracking-wider block mb-1.5">QUICK ADD</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestedKeywords.filter((k) => !audienceKeywords.includes(k)).slice(0, 8).map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => {
                    if (!audienceKeywords.includes(kw)) {
                      set("target_audience", [...audienceKeywords, kw].join(", "));
                    }
                  }}
                  className="px-2 py-0.5 font-ui text-[10px] border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                >
                  + {kw}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPIs — free text with AI extraction */}
      <div className="space-y-3">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          KPIs <span className="text-muted-foreground/60">(type freely — AI will extract)</span>
        </label>
        <Textarea
          value={kpiInput}
          onChange={(e) => { setKpiInput(e.target.value); set("kpis", e.target.value); }}
          placeholder="e.g., We want 10M reach, at least 5% engagement rate, 200K clicks and 3.5x ROI..."
          className="bg-card border-border font-ui min-h-[60px]"
        />
        {/* Extracted KPIs */}
        {extractedKpis.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-accent" />
              <span className="font-data text-[9px] text-accent tracking-wider">AI-EXTRACTED KPIS</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {extractedKpis.map((kpi) => (
                <div key={kpi.metric} className="bg-surface-1 border border-accent/20 p-2.5">
                  <span className="text-sm block mb-0.5">{kpi.icon}</span>
                  <span className="font-display text-lg text-foreground italic block">{kpi.value}</span>
                  <span className="font-data text-[8px] text-muted-foreground tracking-wider">{kpi.metric.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Budget ($)</label>
        <Input
          type="text"
          value={draft.budget || ""}
          onChange={(e) => {
            const raw = e.target.value;
            // Parse natural language: "5m", "5M", "5 million", "5 millions", "2.5k", "250000", "250,000"
            const cleaned = raw.replace(/,/g, "").trim();
            const nlMatch = cleaned.match(/^(\d+\.?\d*)\s*(millions?|m|thousands?|k)?\s*$/i);
            if (nlMatch) {
              let num = parseFloat(nlMatch[1]);
              const suffix = (nlMatch[2] || "").toLowerCase();
              if (suffix.startsWith("m")) num *= 1_000_000;
              else if (suffix.startsWith("k") || suffix.startsWith("t")) num *= 1_000;
              set("budget", num);
            } else if (!isNaN(Number(cleaned)) && cleaned !== "") {
              set("budget", Number(cleaned));
            } else if (raw === "") {
              set("budget", 0);
            }
          }}
          placeholder="e.g., 250000, 5M, 2.5 million"
          className="bg-card border-border font-ui max-w-xs"
        />
        {draft.budget > 0 && (
          <p className="font-data text-[9px] text-accent">
            = ${draft.budget.toLocaleString()}
          </p>
        )}
      </div>

      {/* Markets — multi-select MENA */}
      <div className="space-y-3">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          Markets <span className="text-muted-foreground/60">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {MARKETS.map((m) => {
            const active = (draft.markets || []).includes(m);
            return (
              <button
                key={m}
                onClick={() => {
                  const next = active
                    ? (draft.markets || []).filter((x) => x !== m)
                    : [...(draft.markets || []), m];
                  set("markets", next);
                }}
                className={`px-3 py-1.5 text-xs font-ui border rounded transition-all ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
        {(draft.markets || []).length > 0 && (
          <p className="font-data text-[9px] text-accent">
            {(draft.markets || []).length} market{(draft.markets || []).length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      <div className="space-y-3">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          Campaign Window
        </label>

        {/* Selected range display */}
        <div className="flex items-center gap-3">
          <div className={`flex-1 p-3 rounded-lg border text-center transition-all ${draft.start_date ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
            <div className="font-data text-[9px] text-muted-foreground tracking-wider mb-1">START</div>
            <div className="font-ui text-sm text-foreground">
              {draft.start_date ? format(parse(draft.start_date, "yyyy-MM-dd", new Date()), "dd MMM yyyy") : "Select date"}
            </div>
          </div>
          {draft.start_date && draft.end_date ? (
            <div className="flex flex-col items-center gap-0.5">
              <ArrowRight className="w-4 h-4 text-primary" />
              <span className="font-data text-[9px] text-accent">
                {differenceInDays(
                  parse(draft.end_date, "yyyy-MM-dd", new Date()),
                  parse(draft.start_date, "yyyy-MM-dd", new Date())
                )} days
              </span>
            </div>
          ) : (
            <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
          )}
          <div className={`flex-1 p-3 rounded-lg border text-center transition-all ${draft.end_date ? "border-accent/40 bg-accent/5" : "border-border bg-card"}`}>
            <div className="font-data text-[9px] text-muted-foreground tracking-wider mb-1">END</div>
            <div className="font-ui text-sm text-foreground">
              {draft.end_date ? format(parse(draft.end_date, "yyyy-MM-dd", new Date()), "dd MMM yyyy") : "Select date"}
            </div>
          </div>
        </div>

        {/* Inline calendar */}
        <div className="flex justify-center rounded-lg border border-border bg-card/60 p-3 overflow-x-auto">
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={{
              from: draft.start_date ? parse(draft.start_date, "yyyy-MM-dd", new Date()) : undefined,
              to: draft.end_date ? parse(draft.end_date, "yyyy-MM-dd", new Date()) : undefined,
            } as DateRange}
            onSelect={(range) => {
              set("start_date", range?.from ? format(range.from, "yyyy-MM-dd") : "");
              set("end_date", range?.to ? format(range.to, "yyyy-MM-dd") : "");
            }}
            disabled={{ before: new Date() }}
            classNames={{
              months: "flex gap-6",
              month: "space-y-3",
              caption: "flex justify-center relative items-center h-8",
              caption_label: "font-ui text-sm font-medium text-foreground",
              nav: "flex items-center",
              nav_button: "h-6 w-6 bg-transparent hover:bg-muted rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
              nav_button_previous: "absolute left-0",
              nav_button_next: "absolute right-0",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "text-muted-foreground font-data text-[9px] tracking-wider w-9 text-center",
              row: "flex w-full mt-1",
              cell: "relative h-9 w-9 text-center text-sm p-0 focus-within:relative",
              day: "h-9 w-9 p-0 font-ui text-xs hover:bg-muted rounded-md transition-colors text-foreground",
              day_range_start: "!bg-primary !text-primary-foreground rounded-l-md rounded-r-none",
              day_range_end: "!bg-accent !text-accent-foreground rounded-r-md rounded-l-none",
              day_range_middle: "!bg-primary/10 !text-foreground rounded-none",
              day_selected: "!bg-primary !text-primary-foreground",
              day_today: "ring-1 ring-primary/50 font-semibold",
              day_disabled: "text-muted-foreground/30 hover:bg-transparent cursor-not-allowed",
              day_outside: "text-muted-foreground/20",
            }}
          />
        </div>
      </div>

      {/* Deliverables — multi-select grid */}
      <div className="space-y-3">
        <label className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase">
          Deliverables <span className="text-muted-foreground/60">(select all that apply)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DELIVERABLE_OPTIONS.map((d) => {
            const active = selectedDeliverables.includes(d.label);
            return (
              <button
                key={d.label}
                type="button"
                onClick={() => toggleDeliverable(d.label)}
                className={`flex items-center gap-2 px-3 py-2.5 border text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-border/80"
                }`}
              >
                <span className="text-sm">{d.icon}</span>
                <span className={`font-ui text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {d.label}
                </span>
                {active && <Check className="w-3 h-3 text-primary ml-auto" />}
              </button>
            );
          })}
        </div>
        {selectedDeliverables.length > 0 && (
          <p className="font-data text-[9px] text-accent">
            {selectedDeliverables.length} deliverable{selectedDeliverables.length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Step 3: AI Optimize ─── */
const ICON_MAP: Record<string, any> = { target: Target, users: Users, clock: Clock, star: Star, dollar: DollarSign };

function StepAIOptimize({ draft, set, trends, selectedTrends }: { draft: CampaignDraft; set: (k: keyof CampaignDraft, v: any) => void; trends: any[]; selectedTrends: string[] }) {
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    setAppliedIndices(new Set());
    try {
      const relevantTrends = selectedTrends.length > 0
        ? trends.filter((t) => selectedTrends.includes(t.id))
        : trends.slice(0, 5);

      const { data, error: fnErr } = await supabase.functions.invoke("optimize-campaign", {
        body: { brief: draft, trends: relevantTrends },
      });
      if (fnErr) throw fnErr;
      setSuggestions(data.suggestions || []);
    } catch (e: any) {
      setError(e.message || "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  }, [draft, trends, selectedTrends]);

  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    generate();
  }

  const handleApply = (index: number) => {
    const s = suggestions[index];
    if (s.deliverables && s.deliverables.length > 0) {
      const current = draft.deliverables ? draft.deliverables.split(",").map((x: string) => x.trim()).filter(Boolean) : [];
      const toAdd = s.deliverables.filter((d: string) => !current.includes(d));
      if (toAdd.length > 0) {
        set("deliverables", [...current, ...toAdd].join(", "));
      }
    }
    if (s.note) {
      const currentNotes = draft.notes || "";
      const separator = currentNotes.trim() ? "\n" : "";
      set("notes", currentNotes.trim() + separator + s.note);
    }
    setAppliedIndices((prev) => new Set(prev).add(index));
  };

  return (
    <div>
      <SectionTitle icon={Sparkles}>AI-Powered Optimization</SectionTitle>
      <p className="font-ui text-sm text-muted-foreground mb-4">
        Suggestions generated from your brief and {selectedTrends.length > 0 ? `${selectedTrends.length} selected trend(s)` : "latest trends"}.
      </p>

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <Sparkles className="w-5 h-5 text-accent animate-pulse" />
          <span className="font-data text-xs text-accent tracking-wider">ANALYZING BRIEF & TRENDS...</span>
        </div>
      )}

      {error && (
        <div className="border border-destructive/30 bg-destructive/5 p-4 mb-4">
          <p className="font-ui text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={generate} className="mt-2 font-data text-[9px] tracking-wider">
            RETRY
          </Button>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <>
          <div className="space-y-3">
            {suggestions.map((s: any, i: number) => {
              const applied = appliedIndices.has(i);
              const Icon = ICON_MAP[s.icon] || Sparkles;
              return (
                <div key={i} className={`border p-4 flex gap-4 transition-colors ${
                  applied ? "border-accent/50 bg-accent/5" : "border-border bg-surface-1"
                }`}>
                  <div className={`w-8 h-8 flex items-center justify-center shrink-0 mt-0.5 ${
                    applied ? "bg-accent/20" : "bg-primary/10"
                  }`}>
                    <Icon className={`w-4 h-4 ${applied ? "text-accent" : "text-primary"}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-ui text-sm text-foreground font-medium mb-1">{s.title}</h3>
                    <p className="font-ui text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                    {applied && s.deliverables?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle className="w-3 h-3 text-accent" />
                        <span className="font-data text-[9px] text-accent tracking-wider">
                          Added to deliverables: {s.deliverables.join(", ")}
                        </span>
                      </div>
                    )}
                    {applied && (!s.deliverables || s.deliverables.length === 0) && s.note && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <FileText className="w-3 h-3 text-accent" />
                        <span className="font-data text-[9px] text-accent tracking-wider">
                          Added to campaign notes
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={applied}
                    onClick={() => handleApply(i)}
                    className="ml-auto shrink-0 font-data text-[9px] tracking-wider self-center text-accent"
                  >
                    {applied ? "✓ APPLIED" : "APPLY"}
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={loading}
            className="mt-4 font-data text-[9px] tracking-wider"
          >
            <Sparkles className="w-3 h-3 mr-1.5" />
            REGENERATE
          </Button>
        </>
      )}
    </div>
  );
}



/* ─── Step 4: Select Influencers ─── */
function StepSelectCreators({ creators, allCreators, selected, onToggle, onViewProfile, onBulkUpload }: { creators: any[]; allCreators: any[]; selected: string[]; onToggle: (id: string) => void; onViewProfile: (c: any) => void; onBulkUpload: () => void }) {
  const [search, setSearch] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapedCreators, setScrapedCreators] = useState<any[]>([]);
  const [searchPlatform, setSearchPlatform] = useState("instagram");
  const qc = useQueryClient();

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const dbResults = allCreators
      .filter((c) => !creators.some((r) => r.id === c.id))
      .filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.handle || "").toLowerCase().includes(q) ||
        (c.country || "").toLowerCase().includes(q) ||
        platformLabel(c.platform).toLowerCase().includes(q)
      )
      .sort((a, b) => (b.followers || 0) - (a.followers || 0))
      .slice(0, 6);
    // Include scraped creators not yet in allCreators
    const scrapedNotInDb = scrapedCreators.filter(
      (sc) => !allCreators.some((ac) => ac.handle === sc.handle) && !dbResults.some((r) => r.handle === sc.handle)
    );
    return [...dbResults, ...scrapedNotInDb].sort((a, b) => (b.followers || 0) - (a.followers || 0));
  }, [search, allCreators, creators, scrapedCreators]);

  // Detect if search looks like a supported platform handle
  const looksLikeHandle = useMemo(() => {
    const q = search.trim();
    if (!q) return false;
    // Starts with @, is a single word, or is a supported platform URL
    return q.startsWith("@") || (!q.includes(" ") && q.length >= 3) || /(instagram|tiktok|snapchat)\.com/i.test(q);
  }, [search]);

  const cleanHandle = useMemo(() => {
    let q = search.trim();
    q = q.replace(/^https?:\/\/(www\.)?(instagram|tiktok|snapchat)\.com\/(@|add\/)?/i, "").replace(/[/?#].*$/, "");
    q = q.replace(/^@/, "");
    return q;
  }, [search]);

  const handleNotInDb = useMemo(() => {
    if (!looksLikeHandle || !cleanHandle) return true;
    return !allCreators.some(
      (c) =>
        (c.handle || "").toLowerCase().replace("@", "") === cleanHandle.toLowerCase() &&
        normalizePlatform(c.platform) === normalizePlatform(searchPlatform)
    );
  }, [looksLikeHandle, cleanHandle, allCreators, searchPlatform]);

  const handleScrape = async () => {
    if (!cleanHandle) return;
    setScraping(true);
    try {
      const platform = normalizePlatform(searchPlatform);
      const functionMap: Record<string, string> = {
        instagram: "scrape-instagram",
        tiktok: "scrape-tiktok",
        snapchat: "scrape-snapchat",
      };
      const { data, error } = await supabase.functions.invoke(functionMap[platform] || "scrape-instagram", {
        body: { handles: [cleanHandle], includePosts: platform === "instagram", postCount: 6 },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Imported @${cleanHandle} from ${platformLabel(platform)}`);
        // Refetch creators
        await qc.invalidateQueries({ queryKey: ["creators"] });
        await qc.invalidateQueries({ queryKey: ["creators-workflow"] });
        // Temporarily add to scraped list so it shows immediately
        const { data: newCreator } = await supabase
          .from("creators")
          .select("*")
          .eq("handle", `@${cleanHandle}`)
          .single();
        if (newCreator) {
          setScrapedCreators((prev) => [...prev, newCreator]);
        }
      } else {
        toast.error("Failed to import: " + (data?.results?.[0]?.error || "Unknown error"));
      }
    } catch (e) {
      toast.error("Scrape failed: " + (e as Error).message);
    } finally {
      setScraping(false);
    }
  };

  const CreatorCard = ({ c, active }: { c: any; active: boolean }) => (
    <div
      className={`text-left border p-4 rounded-2xl transition-all ${
        active ? "border-primary bg-primary/5" : "border-border bg-surface-1 hover:border-border/80"
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => onViewProfile(c)} className="shrink-0">
          {c.avatar_url ? (
            <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent hover:ring-primary transition-all cursor-pointer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </button>
        <button onClick={() => onViewProfile(c)} className="min-w-0 text-left hover:opacity-80 transition-opacity">
          <span className="font-ui text-sm text-foreground font-medium block truncate">{c.name}</span>
          <span className="font-data text-[9px] text-muted-foreground">{c.handle}</span>
          <Badge variant="outline" className="mt-1 h-5 font-data text-[8px] tracking-wider uppercase">
            {platformLabel(c.platform)}
          </Badge>
        </button>
        <button
          onClick={() => onToggle(c.id)}
          className={`ml-auto shrink-0 w-7 h-7 flex items-center justify-center rounded border transition-all ${
            active
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          {active ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs">+</span>}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="font-data text-[8px] text-muted-foreground block">FOLLOWERS</span>
          <span className="font-data text-[10px] text-foreground">
            {((c.followers || 0) / 1e6).toFixed(1)}M
          </span>
        </div>
        <div>
          <span className="font-data text-[8px] text-muted-foreground block">ROI</span>
          <span className="font-data text-[10px] text-foreground">{(c.roi || 0).toFixed(1)}x</span>
        </div>
        <div>
          <span className="font-data text-[8px] text-muted-foreground block">ENG. RATE</span>
          <span className="font-data text-[10px] text-accent">{(c.engagement_rate || 0).toFixed(1)}%</span>
        </div>
      </div>
      <button
        onClick={() => onViewProfile(c)}
        className="mt-3 w-full text-center font-data text-[9px] tracking-wider text-muted-foreground hover:text-primary py-1.5 border-t border-border transition-colors"
      >
        VIEW PROFILE & NESTLÉ HISTORY →
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle icon={Users}>Select Influencers</SectionTitle>
        <button type="button" onClick={onBulkUpload} className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black text-sm font-medium hover:bg-yellow-400 transition-colors">
          <Sparkles className="w-4 h-4" /> Add Creators in Bulk
        </button>
      </div>
      <p className="font-ui text-sm text-muted-foreground mb-4">
        Recommended creators based on brand fit. Search by name, platform, @handle, or bulk-upload an Excel/CSV roster.
      </p>

      {/* Search bar */}
      <div className="relative mb-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, platform, @handle, or URL..."
          className="bg-card border-border font-ui pl-9 pr-32"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Select value={searchPlatform} onValueChange={setSearchPlatform}>
          <SelectTrigger className="absolute right-9 top-1/2 -translate-y-1/2 h-7 w-28 border-border bg-surface-1 font-data text-[9px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="snapchat">Snapchat</SelectItem>
          </SelectContent>
        </Select>
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <p className="font-data text-[9px] text-accent mb-4">
          {selected.length} creator{selected.length > 1 ? "s" : ""} selected
        </p>
      )}

      {/* Recommended */}
      {!search && (
        <>
          <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-2">RECOMMENDED</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {creators.map((c) => (
              <CreatorCard key={creatorCardKey(c)} c={c} active={selected.includes(c.id)} />
            ))}
          </div>
        </>
      )}

      {/* Search results */}
      {search && searchResults.length > 0 && (
        <>
          <p className="font-data text-[9px] text-muted-foreground tracking-wider mb-2">
            SEARCH RESULTS ({searchResults.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {searchResults.map((c) => (
              <CreatorCard key={creatorCardKey(c)} c={c} active={selected.includes(c.id)} />
            ))}
          </div>
        </>
      )}

      {/* Import from selected platform prompt */}
      {search && searchResults.length === 0 && !scraping && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-ui text-sm text-muted-foreground mb-1">
            No creators found for "<span className="text-foreground">{search}</span>"
          </p>
          {looksLikeHandle && handleNotInDb && (
            <>
              <p className="font-ui text-xs text-muted-foreground mb-4">
                Want to import <span className="text-primary font-medium">@{cleanHandle}</span> from {platformLabel(searchPlatform)}?
              </p>
              <Button
                onClick={handleScrape}
                size="sm"
                className="font-data text-[10px] tracking-wider gap-2"
              >
                <Instagram className="w-3.5 h-3.5" />
                IMPORT @{cleanHandle.toUpperCase()}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Scraping state */}
      {scraping && (
        <div className="text-center py-8 border border-dashed border-primary/30 rounded-lg bg-primary/5">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-data text-[10px] text-primary tracking-wider">IMPORTING FROM {platformLabel(searchPlatform).toUpperCase()}</span>
          </div>
          <p className="font-ui text-xs text-muted-foreground">
            Fetching profile and recent posts for @{cleanHandle}...
          </p>
        </div>
      )}

      {/* Show scraped results after import */}
      {search && searchResults.length > 0 && scrapedCreators.length > 0 && (
        <div className="mt-4">
          <p className="font-data text-[9px] text-accent tracking-wider mb-2">JUST IMPORTED</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scrapedCreators
              .filter((sc) => searchResults.some((sr) => sr.id === sc.id))
              .map((c) => (
                <CreatorCard key={creatorCardKey(c)} c={c} active={selected.includes(c.id)} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 5: Review Content ─── */
function StepReview({ creators, statuses, onStatus }: { creators: any[]; statuses: Record<string, string>; onStatus: (id: string, s: "approved" | "rejected" | "pending") => void }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const handleSaveComment = (creatorId: string) => {
    if (commentDraft.trim()) {
      setComments((prev) => ({
        ...prev,
        [creatorId]: prev[creatorId]
          ? prev[creatorId] + "\n" + commentDraft.trim()
          : commentDraft.trim(),
      }));
    }
    setCommentDraft("");
    setOpenComment(null);
  };

  return (
    <div>
      <SectionTitle icon={Eye}>Review Content</SectionTitle>
      <p className="font-ui text-sm text-muted-foreground mb-6">
        Review submitted content from selected creators. Approve, reject, or leave feedback.
      </p>
      {creators.length === 0 ? (
        <p className="font-ui text-sm text-muted-foreground/60 italic">No creators selected yet. Go back to Step 4.</p>
      ) : (
        <div className="space-y-3">
          {/* Sort: pending first, approved second, rejected last */}
          {[...creators].sort((a, b) => {
            const order = { pending: 0, approved: 1, rejected: 2 };
            return (order[statuses[a.id] || "pending"] ?? 0) - (order[statuses[b.id] || "pending"] ?? 0);
          }).map((c) => {
            const status = statuses[c.id] || "pending";
            const isRejected = status === "rejected";
            const hasComment = !!comments[c.id];
            const isOpen = openComment === c.id;
            return (
              <div key={c.id} className={`border border-border transition-all ${isRejected ? "bg-surface-1/40 opacity-50" : "bg-surface-1"}`}>
                <div className="p-4 flex items-center gap-4">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className={`font-ui text-sm font-medium block truncate ${isRejected ? "text-muted-foreground line-through" : "text-foreground"}`}>{c.name}</span>
                    <span className="font-data text-[9px] text-muted-foreground">
                      {c.handle} · {isRejected ? "Removed from campaign" : "Content pending upload"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStatus(c.id, "approved")}
                      className={`p-1.5 transition-colors ${status === "approved" ? "text-green-500" : "text-muted-foreground hover:text-green-500"}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onStatus(c.id, "rejected")}
                      className={`p-1.5 transition-colors ${status === "rejected" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (isOpen) {
                          setOpenComment(null);
                          setCommentDraft("");
                        } else {
                          setOpenComment(c.id);
                          setCommentDraft("");
                        }
                      }}
                      className={`p-1.5 transition-colors relative ${isOpen || hasComment ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      {hasComment && !isOpen && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                      )}
                    </button>
                  </div>
                  <span className={`font-data text-[9px] tracking-wider w-20 text-right ${
                    status === "approved" ? "text-green-500" : status === "rejected" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {status === "rejected" ? "REMOVED" : status.toUpperCase()}
                  </span>
                </div>

                {/* Comment thread */}
                {isOpen && (
                  <div className="border-t border-border px-4 py-3 bg-surface-2/50">
                    {comments[c.id] && (
                      <div className="mb-3 space-y-1.5">
                        {comments[c.id].split("\n").map((line, i) => (
                          <p key={i} className="font-ui text-xs text-foreground/80 pl-3 border-l-2 border-primary/30">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveComment(c.id); }}
                        placeholder="Add a comment or revision note…"
                        className="flex-1 bg-background border border-border px-3 py-1.5 text-xs font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                      />
                      <button
                        onClick={() => handleSaveComment(c.id)}
                        disabled={!commentDraft.trim()}
                        className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-data tracking-wider disabled:opacity-40 hover:bg-primary/90 transition-colors"
                      >
                        SEND
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Step 6: Schedule ─── */
interface ScheduleEntry {
  date: string;
  deliverable: string;
}

function StepSchedule({ date, setDate, draft, schedule, setSchedule }: { date: string; setDate: (d: string) => void; draft: CampaignDraft; schedule: ScheduleEntry[]; setSchedule: React.Dispatch<React.SetStateAction<ScheduleEntry[]>> }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<string>("");
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const s = draft.start_date ? new Date(draft.start_date) : new Date();
    return s.getMonth();
  });
  const [viewYear, setViewYear] = useState<number>(() => {
    const s = draft.start_date ? new Date(draft.start_date) : new Date();
    return s.getFullYear();
  });

  // Editable quantities per deliverable type
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Parse unique deliverable types from draft
  const deliverableTypes = useMemo(() => {
    if (!draft.deliverables) return [];
    const types = [...new Set(draft.deliverables.split(",").map((s) => s.trim()).filter(Boolean))];
    return types;
  }, [draft.deliverables]);

  // Initialize quantities to 1 for each type if not set
  const getQty = (label: string) => quantities[label] ?? 1;
  const setQty = (label: string, val: number) => {
    setQuantities((prev) => ({ ...prev, [label]: Math.max(0, val) }));
  };

  // Total expected = sum of all quantities
  const totalExpected = deliverableTypes.reduce((s, d) => s + getQty(d), 0);

  // Count placed
  const placedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    schedule.forEach((s) => { counts[s.deliverable] = (counts[s.deliverable] || 0) + 1; });
    return counts;
  }, [schedule]);

  const totalPlaced = schedule.length;
  const totalRemaining = Math.max(0, totalExpected - totalPlaced);

  // Campaign date range
  const startDate = draft.start_date ? new Date(draft.start_date) : new Date();
  const endDate = draft.end_date ? new Date(draft.end_date) : new Date(startDate.getTime() + 30 * 86400000);

  // Build calendar for current view month
  const calendarData = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("default", { month: "long" });
    return { cells, month: viewMonth, year: viewYear, monthName };
  }, [viewMonth, viewYear]);

  // Months that overlap with campaign range
  const campaignMonths = useMemo(() => {
    const months: { month: number; year: number }[] = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur <= end) {
      months.push({ month: cur.getMonth(), year: cur.getFullYear() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [startDate, endDate]);

  const canGoPrev = campaignMonths.some((m) => m.year < viewYear || (m.year === viewYear && m.month < viewMonth));
  const canGoNext = campaignMonths.some((m) => m.year > viewYear || (m.year === viewYear && m.month > viewMonth));

  const goPrevMonth = () => {
    const newDate = new Date(viewYear, viewMonth - 1, 1);
    setViewMonth(newDate.getMonth());
    setViewYear(newDate.getFullYear());
  };
  const goNextMonth = () => {
    const newDate = new Date(viewYear, viewMonth + 1, 1);
    setViewMonth(newDate.getMonth());
    setViewYear(newDate.getFullYear());
  };

  const isInRange = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return d >= new Date(startDate.toDateString()) && d <= new Date(endDate.toDateString());
  };

  const dayKey = (day: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getEntriesForDay = (day: number) => schedule.filter((s) => s.date === dayKey(day));

  const handleAddToDay = () => {
    if (!selectedDay || !addingType) return;
    setSchedule((prev) => [...prev, { date: selectedDay, deliverable: addingType }]);
    setAddingType("");
  };

  const handleRemoveEntry = (index: number) => {
    setSchedule((prev) => prev.filter((_, i) => i !== index));
  };

  const getDeliverableIcon = (label: string) => {
    const opt = DELIVERABLE_OPTIONS.find((o) => o.label === label);
    return opt?.icon || "📌";
  };

  return (
    <div>
      <SectionTitle icon={CalendarDays}>Content Schedule</SectionTitle>
      <p className="font-ui text-sm text-muted-foreground mb-2">
        Set quantities for each deliverable, then place them on specific dates. This step is optional — skip if timing isn't finalized.
      </p>

      {deliverableTypes.length === 0 && (
        <div className="border border-border bg-surface-1 p-4 mt-4">
          <p className="font-ui text-xs text-muted-foreground">No deliverables selected yet. Go back to the Brief step to add deliverables, or skip this step.</p>
        </div>
      )}

      {deliverableTypes.length > 0 && (
        <>
          {/* Quantity editor */}
          <div className="border border-border bg-surface-1 p-4 mt-4 mb-6">
            <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] block mb-3">SET QUANTITIES PER DELIVERABLE</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {deliverableTypes.map((d) => (
                <div key={d} className="flex items-center gap-2 border border-border bg-background px-3 py-2">
                  <span className="text-sm">{getDeliverableIcon(d)}</span>
                  <span className="font-ui text-[10px] text-foreground flex-1 truncate">{d}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQty(d, getQty(d) - 1)}
                      className="w-5 h-5 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                    >
                      −
                    </button>
                    <span className="font-data text-sm text-foreground w-6 text-center font-bold">{getQty(d)}</span>
                    <button
                      onClick={() => setQty(d, getQty(d) + 1)}
                      className="w-5 h-5 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="font-data text-[8px] text-muted-foreground mt-2">{totalExpected} total deliverable{totalExpected !== 1 ? "s" : ""} to place</p>
          </div>

          <div className="flex gap-6">
            {/* Left: Calendar */}
            <div className="flex-1">
              <div className="bg-surface-1 border border-border p-4">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={goPrevMonth}
                    disabled={!canGoPrev}
                    className={`font-data text-[10px] px-2 py-1 border border-border transition-colors ${canGoPrev ? "text-foreground hover:bg-muted" : "text-muted-foreground/30 cursor-default"}`}
                  >
                    ← PREV
                  </button>
                  <h3 className="font-data text-[10px] text-foreground tracking-wider font-medium">
                    {calendarData.monthName.toUpperCase()} {calendarData.year}
                  </h3>
                  <button
                    onClick={goNextMonth}
                    disabled={!canGoNext}
                    className={`font-data text-[10px] px-2 py-1 border border-border transition-colors ${canGoNext ? "text-foreground hover:bg-muted" : "text-muted-foreground/30 cursor-default"}`}
                  >
                    NEXT →
                  </button>
                </div>

                {/* Month tabs for quick navigation */}
                {campaignMonths.length > 1 && (
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {campaignMonths.map((m) => {
                      const active = m.month === viewMonth && m.year === viewYear;
                      const label = new Date(m.year, m.month, 1).toLocaleString("default", { month: "short" });
                      const entriesInMonth = schedule.filter((s) => {
                        const d = new Date(s.date);
                        return d.getMonth() === m.month && d.getFullYear() === m.year;
                      }).length;
                      return (
                        <button
                          key={`${m.year}-${m.month}`}
                          onClick={() => { setViewMonth(m.month); setViewYear(m.year); }}
                          className={`font-data text-[8px] tracking-wider px-2 py-1 border transition-colors ${
                            active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label.toUpperCase()}
                          {entriesInMonth > 0 && (
                            <span className="ml-1 text-accent">{entriesInMonth}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {draft.start_date && draft.end_date && (
                  <p className="font-data text-[8px] text-accent mb-2">
                    Campaign: {draft.start_date} → {draft.end_date}
                  </p>
                )}

                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <span key={d} className="font-data text-[8px] text-muted-foreground py-1">{d}</span>
                  ))}
                  {calendarData.cells.map((d, i) => {
                    if (!d) return <span key={`e-${i}`} />;
                    const inRange = isInRange(d);
                    const entries = getEntriesForDay(d);
                    const isSelected = selectedDay === dayKey(d);
                    const isStart = draft.start_date && dayKey(d) === draft.start_date;
                    const isEnd = draft.end_date && dayKey(d) === draft.end_date;

                    return (
                      <button
                        key={i}
                        onClick={() => inRange && setSelectedDay(dayKey(d))}
                        disabled={!inRange}
                        className={`relative font-data text-[10px] py-1.5 transition-colors rounded-sm ${
                          isSelected
                            ? "bg-primary text-primary-foreground ring-1 ring-primary"
                            : isStart || isEnd
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : entries.length > 0
                            ? "bg-primary/15 text-foreground"
                            : inRange
                            ? "text-foreground hover:bg-muted cursor-pointer"
                            : "text-muted-foreground/30 cursor-default"
                        }`}
                      >
                        {d}
                        {entries.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-accent text-[7px] text-accent-foreground rounded-full flex items-center justify-center font-bold">
                            {entries.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add deliverable to selected day */}
              {selectedDay && (
                <div className="border border-border bg-surface-1 p-4 mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-data text-[10px] text-foreground tracking-wider">
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </h4>
                    <button onClick={() => setSelectedDay(null)} className="font-data text-[8px] text-muted-foreground hover:text-foreground">
                      CLOSE
                    </button>
                  </div>

                  {/* Existing entries for this day */}
                  {schedule.filter((e) => e.date === selectedDay).length > 0 && (
                    <div className="space-y-1">
                      {schedule.map((entry, idx) => entry.date === selectedDay && (
                        <div key={idx} className="flex items-center justify-between bg-background border border-border px-3 py-1.5">
                          <span className="font-ui text-xs text-foreground">
                            {getDeliverableIcon(entry.deliverable)} {entry.deliverable}
                          </span>
                          <button
                            onClick={() => handleRemoveEntry(idx)}
                            className="font-data text-[8px] text-destructive hover:text-destructive/80"
                          >
                            REMOVE
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new */}
                  <div className="flex gap-2">
                    <select
                      value={addingType}
                      onChange={(e) => setAddingType(e.target.value)}
                      className="flex-1 bg-background border border-border font-ui text-xs text-foreground px-2 py-1.5 rounded-none"
                    >
                      <option value="">Select deliverable…</option>
                      {deliverableTypes.map((d) => {
                        const placed = placedCounts[d] || 0;
                        const qty = getQty(d);
                        const remaining = Math.max(0, qty - placed);
                        return (
                          <option key={d} value={d}>
                            {getDeliverableIcon(d)} {d} ({remaining} remaining)
                          </option>
                        );
                      })}
                    </select>
                    <Button
                      size="sm"
                      disabled={!addingType}
                      onClick={handleAddToDay}
                      className="font-data text-[9px] tracking-wider"
                    >
                      ADD
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Summary panel */}
            <div className="w-56 shrink-0 space-y-4">
              {/* Remaining counter */}
              <div className="border border-border bg-surface-1 p-4 text-center space-y-1">
                <span className="font-display text-3xl font-bold text-foreground">{totalRemaining}</span>
                <span className="font-data text-[9px] text-muted-foreground tracking-wider block">REMAINING TO PLACE</span>
                <div className="h-1 bg-border mt-2 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: totalExpected > 0 ? `${((totalPlaced / totalExpected) * 100)}%` : "0%" }}
                  />
                </div>
                <span className="font-data text-[8px] text-muted-foreground">{totalPlaced}/{totalExpected} placed</span>
              </div>

              {/* Per-deliverable breakdown */}
              <div className="border border-border bg-surface-1 p-4 space-y-2">
                <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] block mb-2">DELIVERABLES</span>
                {deliverableTypes.map((label) => {
                  const qty = getQty(label);
                  const placed = placedCounts[label] || 0;
                  const done = placed >= qty && qty > 0;
                  return (
                    <div key={label} className={`flex items-center gap-2 py-1 ${done ? "opacity-60" : ""}`}>
                      <span className="text-sm">{getDeliverableIcon(label)}</span>
                      <span className="font-ui text-[10px] text-foreground flex-1 truncate">{label}</span>
                      <span className={`font-data text-[9px] ${done ? "text-accent" : "text-muted-foreground"}`}>
                        {placed}/{qty}
                      </span>
                      {done && <CheckCircle className="w-3 h-3 text-accent" />}
                    </div>
                  );
                })}
              </div>

              {/* Scheduled entries list */}
              {schedule.length > 0 && (
                <div className="border border-border bg-surface-1 p-4 space-y-2 max-h-64 overflow-y-auto">
                  <span className="font-data text-[9px] text-muted-foreground tracking-[0.2em] block mb-2">TIMELINE</span>
                  {[...schedule].sort((a, b) => a.date.localeCompare(b.date)).map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-0.5">
                      <span className="font-data text-[8px] text-muted-foreground w-12 shrink-0">
                        {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span className="text-xs">{getDeliverableIcon(entry.deliverable)}</span>
                      <span className="font-ui text-[9px] text-foreground truncate">{entry.deliverable}</span>
                    </div>
                  ))}
                </div>
              )}

              {totalRemaining === 0 && totalExpected > 0 && (
                <div className="bg-accent/10 border border-accent/30 p-3 text-center">
                  <CheckCircle className="w-5 h-5 text-accent mx-auto mb-1" />
                  <span className="font-data text-[9px] text-accent tracking-wider block">ALL PLACED</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Step 7: Measurement ─── */
function StepMeasure({ creators }: { creators: any[] }) {
  const totalFollowers = creators.reduce((s, c) => s + (c.followers || 0), 0);
  const avgRoi = creators.length > 0 ? creators.reduce((s, c) => s + (c.roi || 0), 0) / creators.length : 0;
  const avgSoi = creators.length > 0 ? creators.reduce((s, c) => s + (c.soi_score || 0), 0) / creators.length : 0;

  const metrics = [
    { label: "EST. REACH", value: `${(totalFollowers * 0.15 / 1e6).toFixed(1)}M`, sub: "15% avg reach rate" },
    { label: "EST. VIEWS", value: `${(totalFollowers * 0.08 / 1e6).toFixed(1)}M`, sub: "8% avg view rate" },
    { label: "EST. ENGAGEMENT", value: `${(totalFollowers * 0.03 / 1e3).toFixed(0)}K`, sub: "3% avg ER" },
    { label: "AVG ROI", value: `${avgRoi.toFixed(1)}x`, sub: "vs 3.2x benchmark" },
    { label: "SOI IMPACT", value: `${avgSoi.toFixed(0)}`, sub: "share of influence" },
    { label: "CREATORS", value: `${creators.length}`, sub: "active in campaign" },
  ];

  return (
    <div>
      <SectionTitle icon={BarChart3}>Performance Dashboard</SectionTitle>
      <p className="font-ui text-sm text-muted-foreground mb-6">
        Projected performance based on selected creators and historical data.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-surface-1 border border-border p-4">
            <span className="font-data text-[8px] text-muted-foreground tracking-widest block mb-1">{m.label}</span>
            <span className="font-display text-2xl text-foreground italic block">{m.value}</span>
            <span className="font-data text-[9px] text-muted-foreground">{m.sub}</span>
          </div>
        ))}
      </div>

      {creators.length > 0 && (
        <div className="mt-6">
          <h3 className="font-data text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-3">
            Creator Breakdown
          </h3>
          <div className="space-y-2">
            {creators.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-surface-1 border border-border p-3">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-2" />
                )}
                <span className="font-ui text-xs text-foreground flex-1 truncate">{c.name}</span>
                <span className="font-data text-[9px] text-muted-foreground">{((c.followers || 0) / 1e6).toFixed(1)}M</span>
                <span className="font-data text-[9px] text-accent">{(c.roi || 0).toFixed(1)}x ROI</span>
                <span className="font-data text-[9px] text-primary">SOI {c.soi_score || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
