import { HINTS } from "@/lib/glossary";

interface MetricStripProps {
  totalInvestment: number;
  soiPercent: number;
  avgCPV: number;
  activeCampaigns: number;
}

export function MetricStrip({ totalInvestment, soiPercent, avgCPV, activeCampaigns }: MetricStripProps) {
  const metrics = [
    {
      label: "TOTAL INVESTMENT",
      value:
        totalInvestment >= 1_000_000
          ? `$${(totalInvestment / 1_000_000).toFixed(2)}M`
          : totalInvestment > 0
          ? `$${Math.round(totalInvestment / 1_000)}K`
          : "$0",
      accent: false,
    },
    {
      label: "AVG SOI SCORE",
      value: soiPercent > 0 ? `${soiPercent.toFixed(0)}` : "—",
      accent: false,
    },
    {
      label: "AVG. CPV",
      value: avgCPV > 0 ? `$${avgCPV.toFixed(3)}` : "—",
      accent: false,
    },
    {
      label: "ACTIVE CAMPAIGNS",
      value: activeCampaigns.toString(),
      accent: true,
    },
  ];

  const hints: Record<string, string> = {
    "TOTAL INVESTMENT": HINTS.totalInvestment,
    "AVG SOI SCORE": HINTS.avgSoi,
    "AVG. CPV": HINTS.avgCpv,
    "ACTIVE CAMPAIGNS": HINTS.activeCampaigns,
  };

  return (
    <div className="px-8 py-4">
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} title={hints[m.label]} className="border border-border bg-card p-5 space-y-2 rounded-xl">
            <span className="font-data text-[10px] text-muted-foreground tracking-[0.2em]">
              {m.label}
            </span>
            <div className={`font-display text-3xl font-bold tracking-tight ${m.accent ? "text-accent" : "text-foreground"}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
