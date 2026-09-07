import { useMemo } from "react";
import { Hash } from "lucide-react";

type Video = {
  hashtags?: string[] | null;
  description?: string | null;
};

export function PopularHashtags({ videos }: { videos: Video[] }) {
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of videos) {
      const fromArr = (v.hashtags ?? []).map((h) => h?.toLowerCase().replace(/^#/, "")).filter(Boolean) as string[];
      const fromDesc = Array.from((v.description ?? "").matchAll(/#([\p{L}\p{N}_]+)/gu)).map((m) => m[1].toLowerCase());
      const set = new Set([...fromArr, ...fromDesc]);
      for (const t of set) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  }, [videos]);

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-primary" />
        <h2 className="font-display text-2xl">Popular Hashtags</h2>
      </div>
      {tags.length === 0 ? (
        <div className="font-ui text-xs text-muted-foreground p-6 text-center border border-dashed border-border">
          No hashtags detected yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map(([t, c]) => (
            <span key={t} className="inline-flex items-center gap-2 border border-border px-2.5 py-1 font-data text-[10px] tracking-wider">
              <span className="text-muted-foreground">#</span>
              <span className="text-foreground">{t}</span>
              <span className="text-primary">{c}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
