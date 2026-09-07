import heroImage from "@/assets/hero-home.jpg";
import { HINTS } from "@/lib/glossary";

interface HeroSectionProps {
  creatorCount: number;
  soiPercent: number;
}

export function HeroSection({ creatorCount, soiPercent }: HeroSectionProps) {
  return (
    <div className="relative overflow-hidden min-h-[300px]">
      {/* Maggi & NIDO creator-kitchen key visual */}
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})`, backgroundPosition: "center 35%" }}
      />
      {/* Readability washes — keep the left text column on solid ground */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
      <div className="hero-glow-red absolute inset-0" />

      <div className="relative px-8 pt-10 pb-8">
        <div className="flex justify-between items-start">
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center gap-3">
              <div className="w-5 h-[2px] bg-primary" />
              <span className="font-data text-[10px] text-primary tracking-[0.25em] font-medium">
                NESTLÉ INFLUENCER INTELLIGENCE PLATFORM
              </span>
            </div>
            <h1 className="text-6xl font-display font-semibold leading-[1.05] tracking-tight">
              Real people.
              <br />
              <em className="text-primary italic">Real moments.</em>
              <br />
              <span className="text-muted-foreground/50">Maggi &amp; NIDO.</span>
            </h1>
            <p className="font-ui text-sm text-muted-foreground leading-relaxed max-w-md">
              Unified creator intelligence across 31 markets, 10 categories, and
              140 million consumers — from brief to measurement.
            </p>
          </div>

          <div className="text-right space-y-6 bg-background/60 backdrop-blur-sm rounded-2xl px-6 py-5 -mr-2">
            <div title={HINTS.trackedCreators}>
              <span className="font-display text-7xl font-bold text-primary tracking-tight">
                {creatorCount.toLocaleString()}
              </span>
              <div className="font-data text-[10px] text-muted-foreground tracking-[0.25em] mt-1">
                TRACKED CREATORS
              </div>
            </div>
            <div title={HINTS.shareOfInfluence}>
              <span className="font-display text-5xl font-bold text-accent tracking-tight">
                {soiPercent > 0 ? `${soiPercent.toFixed(1)}%` : "—"}
              </span>
              <div className="font-data text-[10px] text-muted-foreground tracking-[0.25em] mt-1">
                SHARE OF INFLUENCE
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
