import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Landmark, Heart, Megaphone, ShieldCheck, Sparkles, Crosshair } from "lucide-react";
import { getFramework } from "@/lib/measurementFramework";
import { computeGovernance, stateFor, type GovernanceLive, type KpiState } from "@/lib/governance";

import { HINTS } from "@/lib/glossary";

const LAYER_META: Record<string, { icon: typeof Landmark; note: string; accent: string; hint: string }> = {
  Business: { icon: Landmark, note: "NIELSEN / RETAIL PANEL", accent: "text-primary", hint: HINTS.business },
  Brand: { icon: Heart, note: "BRAND HEALTH TRACKER", accent: "text-primary", hint: HINTS.brandLayer },
  Media: { icon: Megaphone, note: "PLATFORM & LISTENING", accent: "text-primary", hint: HINTS.media },
  Governance: { icon: ShieldCheck, note: "PICTURE OF SUCCESS · LIVE", accent: "text-accent", hint: HINTS.governance },
};

const STATE_STYLES: Record<KpiState, string> = {
  on: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  watch: "bg-accent/15 text-accent border-accent/30",
  off: "bg-destructive/10 text-destructive border-destructive/30",
  na: "bg-muted text-muted-foreground border-border",
};

function LiveChip({ value, state }: { value: string; state: KpiState }) {
  return (
    <span className={`font-data text-[9px] tracking-wider border rounded px-1.5 py-0.5 ${STATE_STYLES[state]}`}>
      {value}
    </span>
  );
}

/** Live value for a governance KPI row, matched by KPI label. */
function governanceLive(kpi: string, live: GovernanceLive | null, completed: boolean): { value: string; state: KpiState } | null {
  if (!live) return null;
  if (kpi === "First-time approval rate") {
    if (live.approvalPct === null) return { value: "NO REVIEWS YET", state: "na" };
    return { value: `LIVE ${live.approvalPct}%`, state: stateFor(live.approvalPct, 90, "gte") };
  }
  if (kpi === "On-time delivery") {
    if (live.onTimePct === null) return { value: "NOTHING DUE YET", state: "na" };
    return { value: `LIVE ${live.onTimePct}%`, state: stateFor(live.onTimePct, 95, "gte") };
  }
  if (kpi === "Budget variance") {
    if (completed && live.budgetVariancePct !== null) {
      return { value: `FINAL ${live.budgetVariancePct}%`, state: stateFor(live.budgetVariancePct, 2, "lte") };
    }
    if (live.utilisationPct !== null) return { value: `IN FLIGHT · ${live.utilisationPct}% UTILISED`, state: "na" };
    return { value: "NOT STARTED", state: "na" };
  }
  // Creative hygiene, creator compliance, CreatorIQ adoption, brief-specific ops KPIs
  return { value: "MANUAL ATTESTATION", state: "na" };
}

interface Props {
  campaignName?: string | null;
  brand?: string | null;
  campaignId?: string | null;
  budget?: number | null;
  spent?: number | null;
  status?: string | null;
}

/**
 * One spine, tuned per brief: Business / Brand / Media KPI layers plus the
 * Picture of Success Governance layer — governance wired to live platform data.
 */
export function MeasurementFrameworkPanel({ campaignName, brand, campaignId, budget, spent, status }: Props) {
  const fw = getFramework(campaignName, brand);
  const completed = status === "completed";

  const { data: deliverables = [] } = useQuery({
    queryKey: ["governance-deliverables", campaignId],
    queryFn: async () => {
      const { data: ccs } = await supabase.from("campaign_creators").select("id").eq("campaign_id", campaignId!);
      const ids = (ccs || []).map((c: any) => c.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("campaign_deliverables").select("status, due_date").in("campaign_creator_id", ids);
      return data || [];
    },
    enabled: !!campaignId,
  });

  const live = campaignId ? computeGovernance(deliverables, { budget, spent, completed }) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div title={HINTS.creativeTarget} className="flex items-center gap-2 border border-accent/40 bg-accent/5 rounded-lg px-3 py-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="font-data text-[10px] tracking-wider text-muted-foreground">CREATIVE TARGET</span>
          <span className="font-ui text-sm font-bold text-foreground">{fw.creativeTarget}</span>
        </div>
        {fw.creativeTargetNote && (
          <span className="font-data text-[9px] text-muted-foreground tracking-wider">{fw.creativeTargetNote.toUpperCase()}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {fw.layers.map((layer) => {
          const meta = LAYER_META[layer.layer];
          const Icon = meta.icon;
          const isGov = layer.layer === "Governance";
          return (
            <div key={layer.layer} title={meta.hint} className="border border-border bg-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${meta.accent}`} />
                  <span className="font-display text-base font-semibold">{layer.layer}</span>
                </div>
                <span className="font-data text-[8px] text-muted-foreground tracking-[0.15em]">
                  {isGov && !campaignId ? "PICTURE OF SUCCESS" : meta.note}
                </span>
              </div>
              <div className="space-y-2">
                {layer.kpis.map((k) => {
                  const liveVal = isGov ? governanceLive(k.kpi, live, completed) : null;
                  return (
                    <div key={k.kpi} className="flex items-start justify-between gap-3 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                      <div className="min-w-0">
                        <p className="font-ui text-xs text-foreground leading-snug">
                          {k.kpi}
                          {k.proposed && (
                            <span className="ml-1.5 font-data text-[8px] text-primary tracking-wider border border-primary/30 rounded px-1 py-0.5 align-middle">
                              PROPOSED
                            </span>
                          )}
                        </p>
                        {k.source && (
                          <p className="font-data text-[8px] text-muted-foreground tracking-wider mt-0.5">{k.source.toUpperCase()}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {k.target && (
                          <span className="font-data text-[10px] font-semibold text-foreground text-right">{k.target}</span>
                        )}
                        {liveVal && <LiveChip value={liveVal.value} state={liveVal.state} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border border-dashed border-border rounded-lg p-3 flex items-start gap-2.5">
        <Crosshair className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <div>
          <span className="font-data text-[9px] text-primary tracking-[0.15em]">ATTRIBUTION — DESIGNED IN AT BRIEF STAGE</span>
          <p className="font-ui text-xs text-muted-foreground leading-relaxed mt-1">{fw.attribution}</p>
        </div>
      </div>
    </div>
  );
}
