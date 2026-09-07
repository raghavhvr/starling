/**
 * Live Governance-layer computations (Picture of Success).
 * Computed from platform data:
 *   - On-time delivery: of deliverables already due, share delivered (approved/submitted)
 *   - Approval rate: approved share of reviewed deliverables (first-time-approval proxy)
 *   - Budget variance: |1 − spent/budget| — final for completed campaigns, in-flight utilisation otherwise
 * Creative hygiene, creator compliance and CreatorIQ adoption remain manual attestations.
 */

export interface DeliverableRow {
  status: string;
  due_date: string | null;
}

export interface GovernanceLive {
  onTimePct: number | null;      // null = nothing due yet
  dueCount: number;
  approvalPct: number | null;    // null = nothing reviewed yet
  reviewedCount: number;
  budgetVariancePct: number | null; // completed campaigns only
  utilisationPct: number | null;    // spent/budget for in-flight context
}

const DELIVERED = new Set(["approved", "submitted"]);

export function computeGovernance(
  deliverables: DeliverableRow[],
  opts: { budget?: number | null; spent?: number | null; completed?: boolean }
): GovernanceLive {
  const today = new Date().toISOString().slice(0, 10);

  const due = deliverables.filter((d) => d.due_date && d.due_date <= today);
  const onTime = due.filter((d) => DELIVERED.has(d.status)).length;

  const reviewed = deliverables.filter((d) => d.status === "approved" || d.status === "submitted");
  const approved = deliverables.filter((d) => d.status === "approved").length;

  const budget = Number(opts.budget) || 0;
  const spent = Number(opts.spent) || 0;

  return {
    onTimePct: due.length > 0 ? Math.round((onTime / due.length) * 100) : null,
    dueCount: due.length,
    approvalPct: reviewed.length > 0 ? Math.round((approved / reviewed.length) * 100) : null,
    reviewedCount: reviewed.length,
    budgetVariancePct: opts.completed && budget > 0 ? Math.round(Math.abs(1 - spent / budget) * 1000) / 10 : null,
    utilisationPct: budget > 0 && spent > 0 ? Math.round((spent / budget) * 100) : null,
  };
}

export type KpiState = "on" | "watch" | "off" | "na";

export function stateFor(value: number | null, target: number, direction: "gte" | "lte"): KpiState {
  if (value === null) return "na";
  if (direction === "gte") return value >= target ? "on" : value >= target - 10 ? "watch" : "off";
  return value <= target ? "on" : value <= target + 3 ? "watch" : "off";
}
