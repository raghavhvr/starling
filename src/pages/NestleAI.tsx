import { useEffect, useRef } from "react";
import { Sparkles, RotateCcw, Database, BarChart3, Users } from "lucide-react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { useStarlingChat, CHAT_SUGGESTIONS, displayContent } from "@/hooks/useStarlingChat";
import { HINTS } from "@/lib/glossary";

const SOURCES = [
  { icon: Users, label: "Creator roster", detail: "633 Nestlé MENA creators with reach, ER, ROI and SOI" },
  { icon: BarChart3, label: "Campaigns", detail: "Budgets, spend, rosters, deliverables and final results" },
  { icon: Database, label: "Media analytics", detail: "Nestlé paid-media dataset (connects via BigQuery)" },
];

const NestleAI = () => {
  const { messages, isStreaming, send, reset, followUps } = useStarlingChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const empty = messages.length === 0;

  return (
    // Fill the viewport below the 52px top bar + 40px filter bar so the input stays pinned
    <div className="flex h-[calc(100vh-92px)] flex-col">
      {/* Header */}
      <div className="relative shrink-0 overflow-hidden border-b border-border">
        <div className="hero-glow-gold absolute inset-0" />
        <div className="relative flex items-end justify-between gap-4 px-8 pt-6 pb-5">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-[2px] w-5 bg-primary" />
              <span className="font-data text-[10px] font-medium tracking-[0.25em] text-primary">
                NESTLÉ AI · INFLUENCER &amp; MEDIA ANALYTICS
              </span>
            </div>
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">
              Ask <em className="italic text-primary">anything</em> about your creators and campaigns
            </h1>
            <p className="mt-1 max-w-xl font-ui text-sm text-muted-foreground">
              Conversational access to the roster, campaign delivery and results, with live numbers pulled
              straight from the platform.
            </p>
          </div>
          {!empty && (
            <button
              onClick={reset}
              title="Start a fresh conversation"
              className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-data text-[10px] tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              NEW CONVERSATION
            </button>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl">
          {empty ? (
            <div className="space-y-8 px-6 py-10 animate-in fade-in duration-500">
              <div className="grid gap-3 sm:grid-cols-3">
                {SOURCES.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                    <s.icon className="mb-2 h-4 w-4 text-primary" />
                    <p className="font-ui text-xs font-semibold text-foreground">{s.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.detail}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-3 font-data text-[10px] tracking-[0.2em] text-muted-foreground" title={HINTS.aiSuggestions}>
                  TRY ASKING
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CHAT_SUGGESTIONS.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => send(s.query)}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-secondary/50 animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${100 + i * 50}ms`, animationFillMode: "both" }}
                    >
                      <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.query}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={{ ...msg, content: displayContent(msg) }}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                />
              ))}

              {isStreaming && messages[messages.length - 1]?.role === "user" && <ThinkingIndicator />}

              {!isStreaming && followUps.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {followUps.map((fu, i) => (
                    <button
                      key={i}
                      onClick={() => send(fu)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-secondary/50"
                    >
                      {fu}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0">
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput onSend={send} disabled={isStreaming} />
        </div>
        <p className="border-t border-border bg-card px-4 py-1.5 text-center font-data text-[9px] tracking-wider text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
          ANSWERS ARE GENERATED FROM LIVE PLATFORM DATA · VERIFY FIGURES BEFORE EXTERNAL USE
        </p>
      </div>
    </div>
  );
};

export default NestleAI;
