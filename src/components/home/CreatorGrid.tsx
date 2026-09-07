import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { HINTS } from "@/lib/glossary";
import { BrandLogo, hasBrandLogo } from "@/components/BrandLogo";
import { CreatorDetailPanel } from "@/components/home/CreatorDetailPanel";

interface CreatorGridProps {
  creators: Tables<"creators">[];
  loading: boolean;
}

const clusterColors: Record<string, string> = {
  CUL: "bg-primary",
  DAI: "bg-accent",
  BEV: "bg-primary",
  CNF: "bg-accent",
};

function formatFollowers(n: number | null): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function CreatorGrid({ creators, loading }: CreatorGridProps) {
  const [selected, setSelected] = useState<Tables<"creators"> | null>(null);

  if (loading) {
    return (
      <div className="px-8 py-6 grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border bg-card p-5 space-y-4 rounded-2xl">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (creators.length === 0) {
    return (
      <div className="px-8 py-16 text-center">
        <span className="font-data text-[11px] text-muted-foreground tracking-wider">
          NO CREATORS MATCH CURRENT FILTERS
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-4">
          {creators.map((c, idx) => {
            const initials = c.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const colorClass = clusterColors[c.cluster || ""] || "bg-muted";
            const roi = Number(c.roi) || 0;
            const isTop = roi >= 4;

            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="border border-border bg-card p-5 space-y-4 hover:border-muted-foreground/20 transition-colors text-left cursor-pointer group rounded-2xl"
              >
                <div className="flex items-start justify-between">
                  {isTop ? (
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-data text-[10px]">★</span>
                      <span className="font-data text-[10px] text-muted-foreground tracking-wider">
                        Top Performer
                      </span>
                    </div>
                  ) : (
                    <span className="font-data text-[10px] text-muted-foreground">
                      #{idx + 1}
                    </span>
                  )}
                  <span
                    className={`inline-block border font-data text-[9px] tracking-wider px-2 py-0.5 ${
                      isTop
                        ? "border-foreground text-foreground"
                        : c.status === "active"
                        ? "border-accent/50 text-accent"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {isTop ? "TOP" : c.status?.toUpperCase() || "—"}
                  </span>
                </div>

                {/* Avatar — real image or initials fallback */}
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={c.name}
                    className="w-12 h-12 rounded-full object-cover border border-border group-hover:border-muted-foreground/30 transition-colors"
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center`}>
                    <span className="font-ui text-sm font-semibold text-primary-foreground">
                      {initials}
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{c.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="font-data text-[10px] text-muted-foreground tracking-wide">
                      {c.handle || "—"}{!hasBrandLogo(c.brand) && ` · ${c.brand || c.cluster || "—"}`}
                    </p>
                    {hasBrandLogo(c.brand) && <BrandLogo brand={c.brand} className="h-5" />}
                  </div>
                  {(c as any).bio && (
                    <p className="font-ui text-[11px] text-muted-foreground leading-relaxed mt-1.5 line-clamp-2">
                      {(c as any).bio}
                    </p>
                  )}
                </div>

                <div className="flex gap-4 items-baseline flex-wrap">
                  <div title={HINTS.roi}>
                    <span className="font-display text-xl font-bold text-primary">
                      {roi.toFixed(1)}x
                    </span>
                    <span className="font-data text-[9px] text-muted-foreground ml-1 tracking-wider">
                      ROI
                    </span>
                  </div>
                  <div title={HINTS.followers}>
                    <span className="font-display text-xl font-bold text-foreground">
                      {formatFollowers(c.followers)}
                    </span>
                    <span className="font-data text-[9px] text-muted-foreground ml-1 tracking-wider">
                      FOLLOWERS
                    </span>
                  </div>
                  <div title={HINTS.engagementRate}>
                    <span className="font-display text-xl font-bold text-foreground">
                      {Number(c.engagement_rate).toFixed(1)}%
                    </span>
                    <span className="font-data text-[9px] text-muted-foreground ml-1 tracking-wider">
                      ENG
                    </span>
                  </div>
                  {c.soi_score ? (
                    <div title={HINTS.shareOfInfluence}>
                      <span className="font-display text-xl font-bold text-foreground">
                        {c.soi_score}
                      </span>
                      <span className="font-data text-[9px] text-muted-foreground ml-1 tracking-wider">
                        SOI
                      </span>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <CreatorDetailPanel
        creator={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
