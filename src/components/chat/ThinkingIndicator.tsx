import { Sparkles } from "lucide-react";

/** Shown between sending a question and the first streamed token. */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-4" title="Nestlé AI is querying the platform data">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-data text-[10px] tracking-wider text-muted-foreground">QUERYING PLATFORM DATA</span>
        <span className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
