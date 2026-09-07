import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { displayCluster } from "@/lib/nestleize";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ExternalLink, Star, Search } from "lucide-react";
import { toast } from "sonner";

export interface BriefData {
  brand?: string;
  objective?: string;
  markets?: string[];
  audience?: string;
  deliverables?: string;
  notes?: string;
  rawText?: string;
}

interface RankedCreator {
  source: "virlo" | "trusted";
  data: any;
  score: number;
  reason: string;
  angle: string;
}

interface Plan {
  keywords: string[];
  ideal_creator: string;
  audience_tags: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialBrief?: BriefData;
}

export function BriefMatchDialog({ open, onOpenChange, initialBrief }: Props) {
  const [briefText, setBriefText] = useState(
    initialBrief
      ? [
          initialBrief.brand && `Brand: ${initialBrief.brand}`,
          initialBrief.objective && `Objective: ${initialBrief.objective}`,
          initialBrief.markets?.length && `Markets: ${initialBrief.markets.join(", ")}`,
          initialBrief.audience && `Audience: ${initialBrief.audience}`,
          initialBrief.deliverables && `Deliverables: ${initialBrief.deliverables}`,
          initialBrief.notes && `Notes: ${initialBrief.notes}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  );

  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [trusted, setTrusted] = useState<RankedCreator[]>([]);
  const [discoveries, setDiscoveries] = useState<RankedCreator[]>([]);

  const reset = () => {
    setLoading(false);
    setPlan(null);
    setTrusted([]);
    setDiscoveries([]);
    setStatusLabel("");
  };

  const start = async () => {
    if (!briefText.trim()) {
      toast.error("Paste or describe your brief first");
      return;
    }
    setLoading(true);
    setTrusted([]);
    setDiscoveries([]);
    setPlan(null);
    setStatusLabel("Reading brief…");

    const brief: BriefData = { ...initialBrief, rawText: briefText, notes: briefText };

    try {
      const { data, error } = await supabase.functions.invoke(
        "match-brief-to-creators",
        { body: { action: "start", brief } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPlan(data.plan);
      setTrusted(data.trusted ?? []);
      setStatusLabel("Searching MENA creators…");

      if (data.orbit_id) {
        await poll(data.orbit_id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  };

  const poll = async (orbit_id: string, attempt = 0) => {
    if (attempt > 60) {
      setStatusLabel("Discovery timed out");
      setLoading(false);
      return;
    }
    const { data } = await supabase.functions.invoke("match-brief-to-creators", {
      body: { action: "poll", orbit_id },
    });

    if (data?.status === "completed") {
      setDiscoveries(data.discoveries ?? []);
      setStatusLabel("");
      setLoading(false);
      toast.success(`Found ${data.discoveries?.length ?? 0} new discoveries`);
      return;
    }
    setStatusLabel(`Analyzing creators (${attempt * 5}s)…`);
    setTimeout(() => poll(orbit_id, attempt + 1), 5000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Match Creators to Brief
          </DialogTitle>
          <p className="font-ui text-xs text-muted-foreground mt-1">
            AI extracts themes, then surfaces trusted partners + new MENA discoveries.
          </p>
        </DialogHeader>

        {/* INPUT */}
        <div className="my-4 space-y-3">
          <Textarea
            placeholder="Paste brief details here — brand, objective, audience, deliverables…"
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            disabled={loading}
            className="font-ui text-xs min-h-[120px]"
          />
          <Button
            onClick={start}
            disabled={loading || !briefText.trim()}
            className="font-data text-xs gap-2"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {loading ? statusLabel || "Working…" : "Find Matching Creators"}
          </Button>
        </div>

        {/* PLAN */}
        {plan && (
          <div className="border border-border bg-card p-4 mb-4 space-y-2">
            <p className="font-data text-[9px] text-muted-foreground tracking-wider">
              AI MATCH PLAN
            </p>
            <p className="font-ui text-sm text-foreground">{plan.ideal_creator}</p>
            <div className="flex flex-wrap gap-1.5">
              {plan.keywords.map((k) => (
                <span
                  key={k}
                  className="font-data text-[10px] px-2 py-0.5 border border-primary/40 text-primary"
                >
                  {k}
                </span>
              ))}
              {plan.audience_tags.map((t) => (
                <span
                  key={t}
                  className="font-data text-[10px] px-2 py-0.5 border border-border text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TRUSTED PARTNERS */}
        {(trusted.length > 0 || (plan && !loading)) && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-3.5 h-3.5 text-primary" />
              <h3 className="font-display text-base">Trusted Partners</h3>
              <span className="font-data text-[9px] text-muted-foreground tracking-wider">
                {trusted.length} MATCHES · FROM YOUR ROSTER
              </span>
            </div>
            {trusted.length === 0 ? (
              <p className="font-ui text-xs text-muted-foreground border border-dashed border-border p-6 text-center">
                No trusted partners matched this brief.
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {trusted.map((c, i) => (
                  <CreatorCard key={`t-${i}`} c={c} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* DISCOVERIES */}
        {plan && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-3.5 h-3.5 text-accent" />
              <h3 className="font-display text-base">New Discoveries</h3>
              <span className="font-data text-[9px] text-muted-foreground tracking-wider">
                {discoveries.length} MATCHES
              </span>
            </div>
            {loading && discoveries.length === 0 ? (
              <div className="border border-dashed border-border p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="font-ui text-xs text-muted-foreground">{statusLabel}</p>
                <p className="font-data text-[9px] text-muted-foreground/60 mt-1">
                  Typically 1–3 minutes
                </p>
              </div>
            ) : discoveries.length === 0 ? (
              <p className="font-ui text-xs text-muted-foreground border border-dashed border-border p-6 text-center">
                No new discoveries returned.
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {discoveries.map((c, i) => (
                  <CreatorCard key={`d-${i}`} c={c} />
                ))}
              </div>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatorCard({ c }: { c: RankedCreator }) {
  const isVirlo = c.source === "virlo";
  const d = c.data;
  const name = d.creator_name || d.name || d.creator_handle || d.handle || "Unknown";
  const handle = (d.creator_handle || d.handle || "").replace("@", "");
  const followers = d.creator_followers || d.followers;
  const avatar = d.creator_avatar || d.avatar_url;
  const url = d.url;

  return (
    <div className="p-4 bg-card border border-border hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-2 mb-2">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-ui text-xs font-medium text-foreground truncate">
            {name}
          </p>
          {handle && (
            <p className="font-data text-[9px] text-muted-foreground truncate">
              @{handle}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-base text-primary leading-none">{c.score}</p>
          <p className="font-data text-[8px] text-muted-foreground tracking-wider">FIT</p>
        </div>
      </div>

      <p className="font-ui text-[11px] text-foreground/80 leading-relaxed mb-2">
        {c.reason}
      </p>
      <p className="font-data text-[9px] text-accent tracking-wider mb-3">
        ANGLE · {c.angle}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 font-data text-[9px] text-muted-foreground">
          {d.platform && <span className="uppercase">{d.platform}</span>}
          {followers ? (
            <span>{Intl.NumberFormat("en", { notation: "compact" }).format(followers)} followers</span>
          ) : null}
          {!isVirlo && d.cluster && <span>{displayCluster(d.cluster)}</span>}
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-data text-primary hover:underline"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
