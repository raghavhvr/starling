import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nestleizeAll } from "@/lib/nestleize";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInDays, isPast, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  User,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertTriangle,
  Link,
  TrendingUp,
  Users,
  Heart,
  MessageSquare,
  ExternalLink,
  DollarSign,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  Zap,
  Star,
  ArrowUpRight,
  Clock,
  PlayCircle,
  Sparkles,
  HelpCircle,
  Mail,
  Send,
  X,
  Lightbulb,
  BookOpen,
} from "lucide-react";

const DELIVERABLE_LABELS: Record<string, { label: string; icon: string }> = {
  ig_story: { label: "Instagram Story", icon: "📱" },
  ig_reel: { label: "Instagram Reel", icon: "🎬" },
  ig_post: { label: "Instagram Post", icon: "📸" },
  tiktok: { label: "TikTok Video", icon: "🎵" },
  snapchat: { label: "Snapchat", icon: "👻" },
  youtube: { label: "YouTube Video", icon: "▶️" },
  youtube_short: { label: "YouTube Short", icon: "📹" },
  blog: { label: "Blog Post", icon: "📝" },
  other: { label: "Other", icon: "📦" },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  submitted: "bg-accent/20 text-accent",
  approved: "bg-accent/30 text-accent",
};

const MaggiBriefCard = ({ preview = false }: { preview?: boolean }) => (
  <div className="rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 via-card to-primary/5 p-5 space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="font-data text-[9px] tracking-[0.2em] text-accent uppercase">
          {preview ? "Coming Up" : "The Brief"}
        </span>
        <h4 className="font-display text-2xl text-foreground italic mt-1">Maggi #MadeWithMaggi 🍜</h4>
        <p className="font-ui text-xs text-muted-foreground mt-1 leading-relaxed">
          A creator-led cooking series about the dish that tastes like home — your signature family recipe, elevated with Maggi as the secret step.
        </p>
      </div>
      {preview && (
        <Badge variant="outline" className="rounded-full font-data text-[8px] tracking-wider bg-accent/10 text-accent border-accent/30 uppercase shrink-0">
          Preview
        </Badge>
      )}
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-card/60 border border-border p-3">
        <span className="font-data text-[9px] tracking-wider text-muted-foreground">PRODUCT</span>
        <p className="font-ui text-xs text-foreground mt-1">Maggi Bouillon & Seasoning Range</p>
      </div>
      <div className="rounded-2xl bg-card/60 border border-border p-3">
        <span className="font-data text-[9px] tracking-wider text-muted-foreground">HASHTAGS & TAGS</span>
        <p className="font-ui text-xs text-foreground mt-1">#MadeWithMaggi · #MaggiMoments · @maggiarabia</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-accent" />
          <span className="font-data text-[10px] tracking-[0.15em] text-accent uppercase">Do's</span>
        </div>
        <ul className="font-ui text-[12px] text-foreground space-y-1.5 leading-relaxed list-disc pl-4">
          <li>Cook a real family recipe — the dish that tastes like home.</li>
          <li>Show the Maggi product clearly during the cooking process.</li>
          <li>Film in bright, warm, naturally lit kitchen settings.</li>
          <li>Keep the tone personal, emotional, and authentic.</li>
          <li>Include the family moment — who you cook this dish for.</li>
          <li>Show the finished dish with a clean, appetising close-up.</li>
          <li>Use #MadeWithMaggi, #MaggiMoments and tag @maggiarabia.</li>
          <li>Add the paid partnership / ad disclosure.</li>
          <li>Submit for written approval before going live.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-4 h-4 text-primary" />
          <span className="font-data text-[10px] tracking-[0.15em] text-primary uppercase">Keep it brand-safe</span>
        </div>
        <ul className="font-ui text-[12px] text-foreground space-y-1.5 leading-relaxed list-disc pl-4">
          <li>No other seasoning or competitor brands on camera.</li>
          <li>No copyrighted music — licensed or approved audio only.</li>
          <li>No health or nutrition claims beyond approved messaging.</li>
          <li>No messy, unappetising, or wasteful food shots.</li>
          <li>Avoid alcohol in frame or in the recipe.</li>
          <li>No dark, moody, or low-light environments.</li>
          <li>Avoid sensitive topics, politics, or controversial themes.</li>
          <li>Don't reshare or repurpose old content for this brief.</li>
          <li>Don't post before receiving final written approval.</li>
        </ul>
      </div>
    </div>

    <div className="rounded-2xl bg-card/60 border border-border p-4">
      <span className="font-data text-[9px] tracking-wider text-muted-foreground">SIMPLE CONTENT FLOW</span>
      <p className="font-ui text-[12px] text-foreground mt-2 leading-relaxed">
        Introduce your family recipe → prep together → add the Maggi step → reveal the finished dish → share the moment at the table.
      </p>
    </div>
  </div>
);

type TabKey = "myportal" | "dashboard" | "campaigns" | "calendar" | "analytics" | "profile";

export default function CreatorPortal() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("myportal");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [submittingUrl, setSubmittingUrl] = useState<Record<string, string>>({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");

  // Get creator record linked to this user (or first available creator if admin previewing)
  const { data: creator, isLoading: creatorLoading } = useQuery({
    queryKey: ["my-creator-profile", user?.id, isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: own } = await supabase
        .from("creators")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (own) return own;
      if (isAdmin) {
        const { data: anyCreator } = await supabase
          .from("creators")
          .select("*")
          .not("user_id", "is", null)
          .limit(1)
          .maybeSingle();
        return anyCreator;
      }
      return null;
    },
  });


  // Get all campaign assignments for this creator
  const { data: assignments = [] } = useQuery({
    queryKey: ["my-campaign-assignments", creator?.id],
    enabled: !!creator?.id,
    queryFn: async () => {
      const { data: ccData, error } = await supabase
        .from("campaign_creators")
        .select("*")
        .eq("creator_id", creator!.id);
      if (error) throw error;
      if (!ccData || ccData.length === 0) return [];

      const campaignIds = ccData.map((cc: any) => cc.campaign_id);
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("*")
        .in("id", campaignIds);

      const ccIds = ccData.map((cc: any) => cc.id);
      const { data: deliverables } = await supabase
        .from("campaign_deliverables")
        .select("*")
        .in("campaign_creator_id", ccIds)
        .order("due_date", { ascending: true });

      const nestleCampaigns = nestleizeAll(campaigns || []);
      return ccData.map((cc: any) => ({
        ...cc,
        campaign: nestleCampaigns.find((c: any) => c.id === cc.campaign_id),
        deliverables: (deliverables || []).filter((d: any) => d.campaign_creator_id === cc.id),
      }));
    },
  });

  // Get creator platforms
  const { data: platforms = [] } = useQuery({
    queryKey: ["my-platforms", creator?.id],
    enabled: !!creator?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_platforms")
        .select("*")
        .eq("creator_id", creator!.id);
      if (error) throw error;
      return data;
    },
  });

  // Get collaborations
  const { data: collaborations = [] } = useQuery({
    queryKey: ["my-collaborations", creator?.id],
    enabled: !!creator?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_collaborations")
        .select("*")
        .eq("creator_id", creator!.id)
        .order("post_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const updateDeliverableStatus = useMutation({
    mutationFn: async ({ id, status, submitted_url }: { id: string; status: string; submitted_url?: string }) => {
      const update: any = { status };
      if (submitted_url) update.submitted_url = submitted_url;
      const { error } = await supabase.from("campaign_deliverables").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-campaign-assignments"] });
      toast.success("Deliverable updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Computed stats
  const allDeliverables = useMemo(() => assignments.flatMap((a: any) => a.deliverables || []), [assignments]);
  const totalDeliverables = allDeliverables.length;
  const completedDeliverables = allDeliverables.filter((d: any) => d.status === "approved" || d.status === "submitted").length;
  const overdueDeliverables = allDeliverables.filter((d: any) => d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted").length;
  const activeCampaigns = assignments.filter((a: any) => a.campaign?.status === "active").length;
  const totalEarnings = assignments.reduce((sum: number, a: any) => sum + (Number(a.fee) || 0), 0);
  const pendingEarnings = assignments
    .filter((a: any) => a.status !== "completed")
    .reduce((sum: number, a: any) => sum + (Number(a.fee) || 0), 0);

  // Upcoming deadlines
  const upcomingDeadlines = useMemo(() => {
    return allDeliverables
      .filter((d: any) => d.due_date && !isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted")
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }, [allDeliverables]);

  // Notifications
  const notifications = useMemo(() => {
    const notifs: { id: string; type: string; message: string; time: string; urgent: boolean }[] = [];
    allDeliverables.forEach((d: any) => {
      if (d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted") {
        notifs.push({
          id: `overdue-${d.id}`,
          type: "overdue",
          message: `${(DELIVERABLE_LABELS[d.type] || DELIVERABLE_LABELS.other).label} is overdue`,
          time: format(new Date(d.due_date), "MMM d"),
          urgent: true,
        });
      }
      if (d.due_date && !isPast(new Date(d.due_date)) && differenceInDays(new Date(d.due_date), new Date()) <= 3 && d.status !== "approved" && d.status !== "submitted") {
        notifs.push({
          id: `soon-${d.id}`,
          type: "deadline",
          message: `${(DELIVERABLE_LABELS[d.type] || DELIVERABLE_LABELS.other).label} due in ${differenceInDays(new Date(d.due_date), new Date())}d`,
          time: format(new Date(d.due_date), "MMM d"),
          urgent: false,
        });
      }
      if (d.status === "approved") {
        notifs.push({
          id: `approved-${d.id}`,
          type: "approved",
          message: `${(DELIVERABLE_LABELS[d.type] || DELIVERABLE_LABELS.other).label} was approved`,
          time: "Recently",
          urgent: false,
        });
      }
    });
    return notifs;
  }, [allDeliverables]);

  if (creatorLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <User className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Creator Profile Linked</h2>
          <p className="text-sm text-muted-foreground">
            Your account hasn't been linked to a creator profile yet. Please contact your campaign manager to get set up.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any; badge?: number }[] = [
    { key: "myportal", label: "MY PORTAL", icon: Sparkles },
    { key: "dashboard", label: "OVERVIEW", icon: Zap },
    { key: "campaigns", label: "CAMPAIGNS", icon: Megaphone },
    { key: "calendar", label: "CALENDAR", icon: CalendarIcon },
    { key: "analytics", label: "ANALYTICS", icon: BarChart3 },
    { key: "profile", label: "PROFILE", icon: User, badge: notifications.filter(n => n.urgent).length || undefined },
  ];

  return (
    <div className="min-h-full">
      {/* Friendly Hero */}
      <section className="relative px-8 py-10 border-b border-border overflow-hidden rounded-b-3xl">
        <div className="hero-glow-red absolute inset-0" />
        <div className="hero-glow-gold absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/40 ring-4 ring-primary/10">
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt={creator.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground bg-muted">
                    {creator.name?.[0]}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center border-2 border-background">
                <CheckCircle className="w-3 h-3 text-accent-foreground" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl text-foreground italic tracking-tight">
                  Hi {creator.name?.split(" ")[0]} 👋
                </h1>
                <div className="flex items-center gap-1 border border-accent/40 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 text-accent" />
                  <span className="font-data text-[9px] text-accent tracking-widest">VERIFIED CREATOR</span>
                </div>
              </div>
              <p className="font-ui text-sm text-muted-foreground mt-1">
                Welcome back — here's everything happening with your collabs today.
              </p>
            </div>
          </div>

          {/* Quick earnings highlight */}
          <div className="text-right">
            <span className="font-data text-[9px] tracking-[0.2em] text-muted-foreground">TOTAL EARNINGS</span>
            <p className="font-display text-3xl text-accent italic mt-0.5">
              ${totalEarnings.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* Stats strip with animated feel */}
      <div className="grid grid-cols-5 gap-3 px-8 py-5 border-b border-border">
        {[
          { label: "Active Campaigns", value: activeCampaigns, color: "text-primary", icon: Megaphone },
          { label: "Deliverables", value: `${completedDeliverables}/${totalDeliverables}`, color: "text-foreground", icon: CheckCircle },
          { label: "Needs Attention", value: overdueDeliverables, color: overdueDeliverables > 0 ? "text-primary" : "text-muted-foreground", icon: AlertTriangle },
          { label: "Engagement", value: `${creator.engagement_rate || 0}%`, color: "text-accent", icon: Heart },
          { label: "Updates", value: notifications.length, color: notifications.some(n => n.urgent) ? "text-primary" : "text-muted-foreground", icon: Bell },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 rounded-2xl border border-border bg-card hover:bg-card/80 transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-ui text-[11px] text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-2xl font-display font-bold ${s.color} italic`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-8">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 font-data text-[10px] tracking-[0.15em] py-3 border-b-2 transition-all ${
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-0.5 -right-2 w-4 h-4 bg-primary text-primary-foreground font-data text-[8px] flex items-center justify-center rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {/* ─── MY PORTAL (onboarding & brand intro) ─── */}
        {activeTab === "myportal" && (
          <div className="space-y-8">
            {/* Welcome / walkthrough */}
            <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/5 p-8">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-data text-[10px] tracking-[0.25em] text-primary uppercase">Welcome to your portal</span>
              </div>
              <h2 className="font-display text-4xl text-foreground italic">A quick tour, {creator.name?.split(" ")[0]} ✨</h2>
              <p className="font-ui text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                Everything you need to collaborate with Maggi lives here. Take 2 minutes to get familiar — then jump into your first brief.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                {[
                  { icon: Zap, title: "Overview", desc: "Your live snapshot — deadlines, earnings, notifications.", tab: "dashboard" as TabKey },
                  { icon: Megaphone, title: "Campaigns", desc: "Open a brief, see do's & don'ts, submit your content.", tab: "campaigns" as TabKey },
                  { icon: CalendarIcon, title: "Calendar", desc: "Visualize every deliverable across the month.", tab: "calendar" as TabKey },
                  { icon: BarChart3, title: "Analytics", desc: "Track how your content performed for the brand.", tab: "analytics" as TabKey },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.title}
                      onClick={() => setActiveTab(s.tab)}
                      className="text-left rounded-2xl border border-border bg-card/60 p-4 hover:border-primary/40 transition-colors group"
                    >
                      <Icon className="w-4 h-4 text-primary mb-2" />
                      <p className="font-ui text-sm font-semibold text-foreground">{s.title}</p>
                      <p className="font-ui text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                      <span className="font-data text-[9px] tracking-widest text-primary mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        OPEN <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meet Maggi */}
            <div className="rounded-3xl border border-border bg-card p-8">
              <div className="flex items-start justify-between gap-6 mb-6">
                <div>
                  <span className="font-data text-[10px] tracking-[0.25em] text-accent uppercase">Meet the brand</span>
                  <h3 className="font-display text-3xl text-foreground italic mt-1">Maggi 💛</h3>
                  <p className="font-ui text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                    Born in a Swiss kitchen, loved everywhere. Maggi is one of the world's most trusted food brands — warm, accessible, and built around the everyday joy of cooking. Across MENA, the brand stands for family, flavour, and sharing the table.
                  </p>
                  <p className="font-ui text-sm text-foreground italic mt-3">"Whatever you cook, cook it with love — and a little Maggi."</p>
                </div>
                <div className="hidden md:flex shrink-0 w-24 h-24 rounded-full bg-gradient-to-br from-accent/30 to-primary/20 items-center justify-center border border-accent/30">
                  <Heart className="w-10 h-10 text-accent" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: "7rfA-YQ9Jl8", title: "Maybe This Christmas — Brand Microdrama" },
                  { id: "5m80UAElP9Y", title: "Lash Sensational Sky High Mascara" },
                ].map((v) => (
                  <div key={v.id} className="rounded-2xl overflow-hidden border border-border bg-muted/30">
                    <div className="aspect-video">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${v.id}`}
                        title={v.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="px-4 py-3 flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-primary" />
                      <span className="font-ui text-xs text-foreground">{v.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Examples we love */}
            <div className="rounded-3xl border border-border bg-card p-8">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="w-4 h-4 text-gold" />
                <span className="font-data text-[10px] tracking-[0.25em] text-gold uppercase">Inspiration</span>
              </div>
              <h3 className="font-display text-3xl text-foreground italic">Examples we love 🌟</h3>
              <p className="font-ui text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                Here's the energy, lighting and storytelling we'd love to see for #MadeWithMaggi. Use these as a moodboard — not a template.
              </p>

              <div className="rounded-2xl overflow-hidden border border-border bg-muted/30 mt-6 grid grid-cols-1 md:grid-cols-[280px_1fr]">
                <video
                  src="/examples/maggi-family-recipe.mp4"
                  className="w-full h-full aspect-[9/16] md:aspect-auto object-cover"
                  controls
                  playsInline
                />
                <div className="p-5">
                  <span className="font-data text-[9px] tracking-widest text-accent">REFERENCE · COOK WITH ME</span>
                  <p className="font-display text-xl text-foreground italic mt-1">My Family Recipe, Made With Maggi</p>
                  <p className="font-ui text-[12px] text-muted-foreground mt-2 leading-relaxed">Warm light, real kitchen, clear product hero, appetising final dish. This is the energy we're chasing.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {[
                  { tag: "TONE", title: "Personal & emotional", desc: "Speak directly to camera. Share who you cook this dish for before the reveal." },
                  { tag: "LIGHT", title: "Bright & golden", desc: "Natural daylight or warm key light. Avoid moody shadows or heavy color filters." },
                  { tag: "PACE", title: "Snappy first 3s", desc: "Hook viewers immediately — sizzling pan or finished dish in frame from second one." },
                  { tag: "PRODUCT", title: "Hero the Maggi step", desc: "At least one clear close-up of the pack, the pour, and the flavour payoff." },
                  { tag: "STORY", title: "Real, not scripted", desc: "Voiceover or to-camera in your own words. No reading off a teleprompter." },
                  { tag: "AUDIO", title: "Trending sound OK", desc: "Layer a trending audio low under your voiceover for algorithmic lift." },
                  { tag: "CAPTION", title: "Tag #MadeWithMaggi", desc: "Always include the hashtag and tag @maggiarabia in caption + sticker." },
                  { tag: "FRAME", title: "Vertical 9:16", desc: "Shoot vertical, keep faces and the dish safely inside the center 80%." },
                  { tag: "VIBE", title: "Warm & generous", desc: "Smile. Share the food. Make it feel like an invitation to your table." },
                ].map((e) => (
                  <div key={e.title} className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-data text-[9px] tracking-widest text-accent">{e.tag}</span>
                        <span className="font-data text-[9px] tracking-widest text-muted-foreground">DO THIS ✓</span>
                      </div>
                      <p className="font-display text-base text-foreground italic mt-1">{e.title}</p>
                      <p className="font-ui text-[11px] text-muted-foreground mt-1 leading-snug">{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: BookOpen, title: "Read the brief", desc: "Dive into the full Maggi #MadeWithMaggi brief.", action: () => setActiveTab("campaigns") },
                { icon: HelpCircle, title: "Need help?", desc: "Chat with your campaign manager — we usually reply within an hour.", action: () => setHelpOpen(true) },
                { icon: Mail, title: "Brand contact", desc: "creators@maggi-mena.com for anything urgent.", action: () => window.location.href = "mailto:creators@maggi-mena.com" },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.title}
                    onClick={r.action}
                    className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors group"
                  >
                    <Icon className="w-5 h-5 text-primary mb-3" />
                    <p className="font-ui text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="font-ui text-[11px] text-muted-foreground mt-1 leading-relaxed">{r.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── DASHBOARD / OVERVIEW ─── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Friendly "How it works" guide */}
            <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-2xl text-foreground italic">Here's how it works ✨</h2>
                  <p className="font-ui text-sm text-muted-foreground mt-1">Three simple steps to keep your collabs flowing.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { n: "1", title: "Check your brief", desc: "Open a campaign to see what the brand wants — tone, hashtags, do's & don'ts.", icon: Megaphone, color: "bg-primary/10 text-primary" },
                  { n: "2", title: "Create & submit", desc: "Film your content, then paste the link in the deliverable card. We'll notify the brand.", icon: Link, color: "bg-accent/10 text-accent" },
                  { n: "3", title: "Get paid", desc: "Once your content is approved, your fee moves to your earnings. Easy.", icon: DollarSign, color: "bg-gold/10 text-gold" },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.n} className="rounded-2xl bg-card/60 border border-border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.color} font-display italic font-bold`}>{step.n}</div>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="font-ui text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="font-ui text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <MaggiBriefCard preview />

          <div className="grid grid-cols-3 gap-6">
            {/* Left column: Upcoming + Notifications */}
            <div className="col-span-2 space-y-6">
              {/* Upcoming deadlines */}
              <div>
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> UPCOMING DEADLINES
                </h3>
                {upcomingDeadlines.length === 0 ? (
                  <div className="border border-dashed border-border p-8 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto text-accent/30 mb-2" />
                    <p className="font-ui text-sm text-muted-foreground italic">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingDeadlines.map((d: any) => {
                      const typeInfo = DELIVERABLE_LABELS[d.type] || DELIVERABLE_LABELS.other;
                      const daysLeft = differenceInDays(new Date(d.due_date), new Date());
                      const campaign = assignments.find((a: any) => a.deliverables.some((del: any) => del.id === d.id))?.campaign;
                      return (
                        <div key={d.id} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-muted-foreground/20 transition-colors group">
                          <div className="w-10 h-10 flex items-center justify-center border border-border bg-muted/50 text-lg shrink-0">
                            {typeInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-ui text-sm text-foreground">{typeInfo.label}</p>
                            <p className="font-data text-[10px] text-muted-foreground mt-0.5">
                              {campaign?.name} · {d.description || "No description"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-display text-lg font-bold italic ${daysLeft <= 3 ? "text-primary" : "text-foreground"}`}>
                              {daysLeft}d
                            </span>
                            <p className="font-data text-[9px] text-muted-foreground tracking-wider">
                              {format(new Date(d.due_date), "MMM d")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active campaigns quick view */}
              <div>
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-3 flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5" /> ACTIVE CAMPAIGNS
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {assignments.filter((a: any) => a.campaign).map((assignment: any) => {
                    const campaign = assignment.campaign;
                    const deliverables = assignment.deliverables || [];
                    const completed = deliverables.filter((d: any) => d.status === "approved" || d.status === "submitted").length;
                    const pct = deliverables.length > 0 ? Math.round((completed / deliverables.length) * 100) : 0;
                    return (
                      <button
                        key={assignment.id}
                        onClick={() => { setActiveTab("campaigns"); setExpandedCampaign(assignment.id); }}
                        className="rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/30 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className="font-data text-[8px] tracking-wider bg-primary/10 text-primary border-primary/20 uppercase">
                            {campaign.status}
                          </Badge>
                          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <p className="font-display text-lg text-foreground italic">{campaign.name}</p>
                        <p className="font-data text-[10px] text-muted-foreground tracking-wide mt-1">{campaign.brand}</p>
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-data text-[9px] text-muted-foreground">{completed}/{deliverables.length} deliverables</span>
                            <span className="font-data text-[9px] text-primary font-semibold">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1" />
                        </div>
                        {assignment.fee > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <span className="font-data text-[9px] text-muted-foreground">FEE</span>
                            <span className="font-display text-lg text-accent italic ml-2">${Number(assignment.fee).toLocaleString()}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right column: Notifications + Earnings */}
            <div className="space-y-6">
              {/* Earnings card */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-4 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> EARNINGS
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className="font-data text-[9px] tracking-wider text-muted-foreground">TOTAL</span>
                    <p className="font-display text-3xl text-accent italic font-bold">${totalEarnings.toLocaleString()}</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <span className="font-data text-[9px] tracking-wider text-muted-foreground">PENDING</span>
                    <p className="font-display text-xl text-foreground italic">${pendingEarnings.toLocaleString()}</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <span className="font-data text-[9px] tracking-wider text-muted-foreground">CAMPAIGNS</span>
                    <p className="font-display text-xl text-foreground italic">{assignments.length}</p>
                  </div>
                  {/* Earnings per campaign breakdown */}
                  <div className="border-t border-border pt-3 space-y-2">
                    {assignments.filter((a: any) => a.campaign && a.fee > 0).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between">
                        <span className="font-data text-[10px] text-muted-foreground truncate">{a.campaign.name}</span>
                        <span className="font-data text-[10px] text-accent">${Number(a.fee).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-3 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5" /> NOTIFICATIONS
                  {notifications.filter(n => n.urgent).length > 0 && (
                    <span className="w-4 h-4 bg-primary text-primary-foreground font-data text-[8px] flex items-center justify-center rounded-full">
                      {notifications.filter(n => n.urgent).length}
                    </span>
                  )}
                </h3>
                {notifications.length === 0 ? (
                  <p className="font-ui text-xs text-muted-foreground italic py-4 text-center">No notifications</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className={`flex items-start gap-3 p-2 border-l-2 ${n.urgent ? "border-primary bg-primary/5" : "border-border"}`}>
                        <div className="shrink-0 mt-0.5">
                          {n.type === "overdue" && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                          {n.type === "deadline" && <Clock className="w-3.5 h-3.5 text-primary" />}
                          {n.type === "approved" && <CheckCircle className="w-3.5 h-3.5 text-accent" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-ui text-[11px] text-foreground">{n.message}</p>
                          <span className="font-data text-[9px] text-muted-foreground">{n.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ─── CAMPAIGNS TAB ─── */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border">
                <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground italic">No campaigns assigned yet</p>
              </div>
            ) : (
              assignments.map((assignment: any) => {
                const campaign = assignment.campaign;
                if (!campaign) return null;
                const isExpanded = expandedCampaign === assignment.id;
                const deliverables = assignment.deliverables || [];
                const completed = deliverables.filter((d: any) => d.status === "approved" || d.status === "submitted").length;
                const overdue = deliverables.filter((d: any) => d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted").length;
                const pct = deliverables.length > 0 ? Math.round((completed / deliverables.length) * 100) : 0;
                const daysLeft = campaign.end_date ? differenceInDays(new Date(campaign.end_date), new Date()) : null;

                return (
                  <div key={assignment.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setExpandedCampaign(isExpanded ? null : assignment.id)}
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-card/80 transition-colors"
                    >
                      <Megaphone className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-display text-lg text-foreground italic">{campaign.name}</span>
                          <Badge variant="outline" className="font-data text-[8px] tracking-wider bg-primary/20 text-primary border-primary/30 uppercase">
                            {campaign.status}
                          </Badge>
                          {overdue > 0 && (
                            <Badge variant="outline" className="font-data text-[8px] tracking-wider bg-destructive/10 text-destructive border-destructive/20">
                              {overdue} OVERDUE
                            </Badge>
                          )}
                          {daysLeft !== null && daysLeft > 0 && (
                            <span className="font-data text-[9px] text-muted-foreground">{daysLeft}d remaining</span>
                          )}
                        </div>
                        <span className="font-data text-[10px] text-muted-foreground">
                          {campaign.brand} · {completed}/{deliverables.length} deliverables · Fee: ${Number(assignment.fee || 0).toLocaleString()}
                        </span>
                      </div>
                      {deliverables.length > 0 && (
                        <div className="w-24 shrink-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-data text-[9px] text-muted-foreground">Progress</span>
                            <span className="font-data text-[9px] text-primary">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1" />
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-5 py-4 bg-muted/20 space-y-3">
                        {campaign.objective && (
                          <div className="p-3 rounded-xl border border-border bg-card">
                            <span className="font-data text-[9px] tracking-wider text-muted-foreground">CAMPAIGN OBJECTIVE</span>
                            <p className="font-ui text-xs text-foreground mt-1">{campaign.objective}</p>
                          </div>
                        )}

                        {/* Maggi #MadeWithMaggi brief — shown when campaign matches */}
                        {(/maggi/i.test(`${campaign.name} ${campaign.brand || ""}`)) && <MaggiBriefCard />}

                        <div>
                          <span className="font-data text-[9px] tracking-[0.15em] text-muted-foreground uppercase mb-2 block">YOUR DELIVERABLES</span>
                          {deliverables.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground/60 py-4 text-center border border-dashed border-border italic">
                              No deliverables assigned yet
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {deliverables.map((d: any) => {
                                const typeInfo = DELIVERABLE_LABELS[d.type] || DELIVERABLE_LABELS.other;
                                const isOverdue = d.due_date && isPast(new Date(d.due_date)) && d.status !== "approved" && d.status !== "submitted";
                                const daysUntilDue = d.due_date ? differenceInDays(new Date(d.due_date), new Date()) : null;

                                return (
                                  <div key={d.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm">{typeInfo.icon}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-ui text-[12px] text-foreground">{typeInfo.label}</span>
                                          <Badge variant="outline" className={`font-data text-[8px] tracking-wider ${STATUS_STYLES[d.status] || STATUS_STYLES.pending}`}>
                                            {isOverdue ? "OVERDUE" : d.status?.toUpperCase().replace("_", " ")}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          {d.due_date && (
                                            <span className={`font-data text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                                              <CalendarIcon className="w-3 h-3" />
                                              Due {format(new Date(d.due_date), "MMM d, yyyy")}
                                              {daysUntilDue !== null && daysUntilDue > 0 && ` (${daysUntilDue}d left)`}
                                              {isOverdue && ` (${Math.abs(daysUntilDue!)}d late)`}
                                            </span>
                                          )}
                                          {d.description && (
                                            <span className="font-data text-[10px] text-muted-foreground">· {d.description}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pl-7">
                                      <Select
                                        value={d.status}
                                        onValueChange={(v) => updateDeliverableStatus.mutate({ id: d.id, status: v })}
                                      >
                                        <SelectTrigger className="h-7 w-32 text-[10px] font-data">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="in_progress">In Progress</SelectItem>
                                          <SelectItem value="submitted">Submitted</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        placeholder="Paste content URL..."
                                        value={submittingUrl[d.id] || d.submitted_url || ""}
                                        onChange={(e) => setSubmittingUrl((p) => ({ ...p, [d.id]: e.target.value }))}
                                        className="h-7 flex-1 text-[11px] font-data"
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!submittingUrl[d.id]}
                                        onClick={() => {
                                          updateDeliverableStatus.mutate({
                                            id: d.id,
                                            status: "submitted",
                                            submitted_url: submittingUrl[d.id],
                                          });
                                          setSubmittingUrl((p) => ({ ...p, [d.id]: "" }));
                                        }}
                                        className="h-7 font-data text-[9px]"
                                      >
                                        <Link className="w-3 h-3 mr-0.5" /> SUBMIT
                                      </Button>
                                    </div>

                                    {d.submitted_url && (
                                      <div className="pl-7">
                                        <a
                                          href={d.submitted_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-data text-[10px] text-primary hover:underline flex items-center gap-1"
                                        >
                                          <ExternalLink className="w-3 h-3" /> {d.submitted_url}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── CALENDAR TAB ─── */}
        {activeTab === "calendar" && (
          <ContentCalendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            deliverables={allDeliverables}
            assignments={assignments}
          />
        )}

        {/* ─── ANALYTICS TAB ─── */}
        {activeTab === "analytics" && (
          <PerformanceAnalytics
            creator={creator}
            collaborations={collaborations}
            assignments={assignments}
            allDeliverables={allDeliverables}
          />
        )}

        {/* ─── PROFILE TAB ─── */}
        {activeTab === "profile" && (
          <div className="space-y-6 max-w-3xl">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Followers", value: (creator.followers || 0).toLocaleString(), icon: Users, color: "text-foreground" },
                { label: "Engagement", value: `${creator.engagement_rate || 0}%`, icon: Heart, color: "text-accent" },
                { label: "ROI", value: `${creator.roi || 0}x`, icon: TrendingUp, color: "text-primary" },
                { label: "Total Posts", value: creator.total_posts || 0, icon: MessageSquare, color: "text-foreground" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="border border-border p-4 bg-card">
                    <Icon className="w-4 h-4 text-muted-foreground mb-2" />
                    <p className={`font-display text-2xl font-bold italic ${s.color}`}>{s.value}</p>
                    <span className="font-data text-[9px] tracking-wider text-muted-foreground">{s.label.toUpperCase()}</span>
                  </div>
                );
              })}
            </div>

            {creator.bio && (
              <div className="border border-border p-4 bg-card">
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">BIO</h3>
                <p className="font-ui text-sm text-foreground leading-relaxed">{creator.bio}</p>
              </div>
            )}

            {platforms.length > 0 && (
              <div>
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-3">CONNECTED PLATFORMS</h3>
                <div className="space-y-2">
                  {platforms.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                      <span className="text-sm">
                        {p.platform === "instagram" ? "📸" : p.platform === "tiktok" ? "🎵" : "👻"}
                      </span>
                      <div className="flex-1">
                        <span className="font-ui text-sm text-foreground">@{p.handle}</span>
                        <span className="font-data text-[10px] text-muted-foreground ml-2">
                          {(p.followers || 0).toLocaleString()} followers · {p.engagement_rate || 0}% engagement
                        </span>
                      </div>
                      <Badge variant="outline" className="font-data text-[8px] tracking-wider uppercase">
                        {p.platform}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {collaborations.length > 0 && (
              <div>
                <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-3">RECENT COLLABORATIONS</h3>
                <div className="space-y-2">
                  {collaborations.slice(0, 10).map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                      {c.image_url && (
                        <img src={c.image_url} alt="" className="w-10 h-10 object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-ui text-sm text-foreground">{c.brand_name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="font-data text-[8px] tracking-wider">{c.collaboration_type}</Badge>
                          {c.post_date && (
                            <span className="font-data text-[10px] text-muted-foreground">
                              {format(new Date(c.post_date), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 font-data text-[10px] text-muted-foreground">
                        {c.likes > 0 && <span>❤️ {c.likes.toLocaleString()}</span>}
                        {c.comments > 0 && <span>💬 {c.comments.toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Help / Chat */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="font-ui text-xs font-semibold">Chat with us</span>
      </button>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end p-0 md:p-6 bg-background/60 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:w-[420px] h-[80vh] md:h-[560px] bg-card border border-border rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-ui text-sm font-semibold text-foreground">We're here to help</p>
                  <p className="font-data text-[9px] tracking-widest text-muted-foreground">USUALLY REPLIES IN ~1H</p>
                </div>
              </div>
              <button onClick={() => setHelpOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-4 py-2.5 max-w-[85%]">
                  <p className="font-ui text-xs text-foreground leading-relaxed">
                    Hi {creator.name?.split(" ")[0]} 👋 — I'm your campaign manager. Got questions about the brief, deadlines, or payment? Drop a note below.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {["I have a question about the brief", "When do I get paid?", "Can I change my deliverable?", "Need a deadline extension"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setHelpMessage(q)}
                    className="px-3 py-1.5 rounded-full border border-border bg-card text-[11px] text-foreground/80 hover:border-primary/40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!helpMessage.trim()) return;
                toast.success("Message sent — we'll get back to you shortly ✨");
                setHelpMessage("");
                setHelpOpen(false);
              }}
              className="border-t border-border p-3 flex items-center gap-2"
            >
              <Input
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
                placeholder="Type your message…"
                className="flex-1"
              />
              <Button type="submit" size="icon" className="rounded-full shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ CONTENT CALENDAR COMPONENT ═══ */
function ContentCalendar({
  month,
  onMonthChange,
  deliverables,
  assignments,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  deliverables: any[];
  assignments: any[];
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);

  const getEventsForDay = (day: Date) => {
    return deliverables.filter((d: any) => d.due_date && isSameDay(new Date(d.due_date), day));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl text-foreground italic">
          {format(month, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMonthChange(subMonths(month, 1))}
            className="w-8 h-8 border border-border flex items-center justify-center hover:bg-card transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => onMonthChange(new Date())}
            className="px-3 h-8 border border-border font-data text-[10px] tracking-wider text-muted-foreground hover:bg-card transition-colors"
          >
            TODAY
          </button>
          <button
            onClick={() => onMonthChange(addMonths(month, 1))}
            className="w-8 h-8 border border-border flex items-center justify-center hover:bg-card transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-border mb-1">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <div key={d} className="p-2 text-center font-data text-[9px] tracking-[0.15em] text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[100px] border border-border/30 bg-background/50" />
        ))}
        {days.map((day) => {
          const events = getEventsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] border border-border/50 p-1.5 ${
                isToday ? "bg-primary/5 border-primary/30" : "hover:bg-card/50"
              } transition-colors`}
            >
              <span className={`font-data text-[10px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {events.map((ev: any) => {
                  const typeInfo = DELIVERABLE_LABELS[ev.type] || DELIVERABLE_LABELS.other;
                  const isOverdue = isPast(day) && ev.status !== "approved" && ev.status !== "submitted";
                  return (
                    <div
                      key={ev.id}
                      className={`px-1.5 py-0.5 text-[9px] font-data truncate border-l-2 ${
                        isOverdue
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : ev.status === "submitted" || ev.status === "approved"
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-primary bg-primary/10 text-primary"
                      }`}
                    >
                      {typeInfo.icon} {typeInfo.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
        {[
          { color: "bg-primary", label: "Pending / In Progress" },
          { color: "bg-accent", label: "Submitted / Approved" },
          { color: "bg-destructive", label: "Overdue" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className={`w-3 h-1.5 ${l.color}`} />
            <span className="font-data text-[9px] text-muted-foreground tracking-wider">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ PERFORMANCE ANALYTICS COMPONENT ═══ */
function PerformanceAnalytics({
  creator,
  collaborations,
  assignments,
  allDeliverables,
}: {
  creator: any;
  collaborations: any[];
  assignments: any[];
  allDeliverables: any[];
}) {
  // Deliverable status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, submitted: 0, approved: 0 };
    allDeliverables.forEach((d: any) => {
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [allDeliverables]);

  // Top collaborations by engagement
  const topCollabs = useMemo(() => {
    return [...collaborations]
      .sort((a: any, b: any) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0)))
      .slice(0, 5);
  }, [collaborations]);

  const totalEngagement = collaborations.reduce((sum: any, c: any) => sum + (c.likes || 0) + (c.comments || 0), 0);
  const avgEngPerPost = collaborations.length > 0 ? Math.round(totalEngagement / collaborations.length) : 0;

  return (
    <div className="space-y-6">
      {/* Top-level analytics cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "TOTAL REACH", value: (creator.followers || 0).toLocaleString(), sub: "based on followers", icon: Eye, color: "text-foreground" },
          { label: "AVG. ENGAGEMENT", value: avgEngPerPost.toLocaleString(), sub: "per post", icon: Heart, color: "text-accent" },
          { label: "TOTAL COLLABORATIONS", value: collaborations.length, sub: "all time", icon: Users, color: "text-foreground" },
          { label: "COMPLETION RATE", value: allDeliverables.length > 0 ? `${Math.round(((statusBreakdown.submitted + statusBreakdown.approved) / allDeliverables.length) * 100)}%` : "—", sub: "deliverables", icon: CheckCircle, color: "text-primary" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="border border-border p-5 bg-card">
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="font-data text-[8px] tracking-[0.2em] text-muted-foreground">{s.label}</span>
              </div>
              <p className={`font-display text-3xl font-bold italic ${s.color}`}>{s.value}</p>
              <span className="font-data text-[9px] text-muted-foreground tracking-wider">{s.sub}</span>
            </div>
          );
        })}
      </div>

      {/* Deliverable status visual */}
      <div className="border border-border p-5 bg-card">
        <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-4">DELIVERABLE STATUS BREAKDOWN</h3>
        <div className="flex h-6 overflow-hidden">
          {Object.entries(statusBreakdown).map(([status, count]) => {
            if (count === 0 || allDeliverables.length === 0) return null;
            const pct = (count / allDeliverables.length) * 100;
            const colors: Record<string, string> = {
              pending: "bg-muted",
              in_progress: "bg-primary",
              submitted: "bg-accent",
              approved: "bg-accent",
            };
            return (
              <div
                key={status}
                className={`${colors[status] || "bg-muted"} flex items-center justify-center transition-all`}
                style={{ width: `${pct}%` }}
              >
                <span className="font-data text-[8px] text-primary-foreground font-semibold">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3">
          {Object.entries(statusBreakdown).filter(([_, c]) => c > 0).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 ${status === "pending" ? "bg-muted" : status === "in_progress" ? "bg-primary" : "bg-accent"}`} />
              <span className="font-data text-[9px] text-muted-foreground tracking-wider capitalize">{status.replace("_", " ")} ({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top performing content */}
      {topCollabs.length > 0 && (
        <div className="border border-border p-5 bg-card">
          <h3 className="font-data text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-4">TOP PERFORMING CONTENT</h3>
          <div className="space-y-3">
            {topCollabs.map((c: any, i: number) => {
              const totalEng = (c.likes || 0) + (c.comments || 0);
              return (
                <div key={c.id} className="flex items-center gap-4 p-3 border border-border hover:border-muted-foreground/20 transition-colors">
                  <span className="font-display text-xl font-bold text-muted-foreground italic w-6 text-center">
                    {i + 1}
                  </span>
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="w-12 h-12 object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-muted flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-ui text-sm text-foreground">{c.brand_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="font-data text-[8px] tracking-wider">{c.platform}</Badge>
                      {c.post_date && (
                        <span className="font-data text-[10px] text-muted-foreground">
                          {format(new Date(c.post_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg text-accent italic font-bold">{totalEng.toLocaleString()}</p>
                    <span className="font-data text-[9px] text-muted-foreground tracking-wider">ENGAGEMENTS</span>
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
