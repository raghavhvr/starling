import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CURATED_FOOD_TRENDS, FOOD_TREND_CATEGORIES } from "@/lib/foodTrends";
import { TrendingUp, ChevronRight, Sparkles } from "lucide-react";
import { TrendDetailPanel } from "./TrendDetailPanel";

const categoryColors: Record<string, string> = {
  Cooking: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  Recipes: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  Nutrition: "bg-sky-500/20 text-sky-500 border-sky-500/30",
  Beverages: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  Snacking: "bg-pink-500/20 text-pink-500 border-pink-500/30",
  Ingredients: "bg-lime-600/20 text-lime-600 border-lime-600/30",
  Technology: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
};

export function TrendingSection() {
  const [selectedTrend, setSelectedTrend] = useState<any | null>(null);

  const { data: liveTrends = [], isLoading } = useQuery({
    queryKey: ["trends", "reddit-food"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trends")
        .select("*")
        .eq("source", "reddit")
        .in("category", FOOD_TREND_CATEGORIES)
        .order("relevance_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const usingCurated = !isLoading && liveTrends.length === 0;
  const trends = usingCurated ? CURATED_FOOD_TRENDS : liveTrends;

  return (
    <>
      <div className="px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-data text-[11px] tracking-[0.15em] text-foreground">
              FOOD & BEVERAGE TRENDS
            </span>
            <span className="font-data text-[10px] text-muted-foreground tracking-wider">
              {usingCurated ? "MENA · CURATED" : "FROM REDDIT"}
            </span>
          </div>
          {usingCurated && (
            <span className="flex items-center gap-1.5 font-data text-[9px] text-muted-foreground tracking-wider">
              <Sparkles className="w-3 h-3 text-accent" />
              LIVE FEED ACTIVATES WITH STARLING DATA
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {trends.map((trend: any) => (
              <button
                key={trend.id}
                onClick={() => !trend.curated && setSelectedTrend(trend)}
                className={`group relative p-4 rounded-lg bg-card border text-left transition-all ${
                  selectedTrend?.id === trend.id
                    ? "border-primary/50 bg-primary/5"
                    : trend.curated
                    ? "border-border cursor-default"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-data tracking-wider border ${
                      categoryColors[trend.category || ""] || "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {trend.category || "General"}
                  </span>
                  <span className="font-data text-[10px] text-primary font-semibold">
                    {trend.relevance_score}%
                  </span>
                </div>
                <h4 className="font-ui text-sm font-medium text-foreground leading-snug mb-1">
                  {trend.title}
                </h4>
                <p className="font-ui text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {trend.description}
                </p>
                {!trend.curated && (
                  <div className="flex items-center gap-1 mt-2 text-[10px] font-data text-primary/70 group-hover:text-primary transition-colors">
                    <span>View social posts</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trend Detail Panel */}
      {selectedTrend && (
        <TrendDetailPanel
          trend={selectedTrend}
          onClose={() => setSelectedTrend(null)}
        />
      )}
    </>
  );
}
