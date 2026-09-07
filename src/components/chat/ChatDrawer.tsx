import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Sparkles, Users, BarChart3, TrendingUp } from "lucide-react";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { streamChat, type ChatMessage as ChatMsg } from "@/lib/chat-stream";
import { toast } from "sonner";

const suggestions = [
  { icon: Users, label: "Top creators", query: "Who are the top 5 Nestlé roster creators by ROI?" },
  { icon: BarChart3, label: "Campaign results", query: "How did the Maggi #MadeWithMaggi Ramadan Series perform?" },
  { icon: TrendingUp, label: "Creator deep dive", query: "Tell me everything about Manal Al Alem" },
  { icon: Sparkles, label: "NIDO Egypt fit", query: "Which Egypt creators are the best fit for NIDO Al Assassy?" },
];

export function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Allow other surfaces (e.g. Command Center "Chat with your data") to open the drawer
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("starling:open-chat", openChat);
    return () => window.removeEventListener("starling:open-chat", openChat);
  }, []);

  const handleSend = useCallback(async (input: string) => {
    const userMsg: ChatMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: upsertAssistant,
        onDone: () => setIsStreaming(false),
        onError: (err) => {
          setIsStreaming(false);
          toast.error(err);
        },
      });
    } catch {
      setIsStreaming(false);
      toast.error("Failed to send message");
    }
  }, [messages]);

  // Extract follow-up suggestions from the latest assistant message
  const followUps: string[] = [];
  if (messages.length > 0) {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      const lines = lastAssistant.content.split("\n");
      for (const line of lines) {
        const match = line.match(/^FOLLOW_UP:\s*(.+)/);
        if (match) followUps.push(match[1].trim());
      }
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-all group"
        >
          <Sparkles className="h-6 w-6 group-hover:animate-pulse" />
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-background border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-card">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-sm font-semibold text-foreground">Nestlé AI</h2>
                <p className="font-data text-[10px] text-muted-foreground tracking-wider">INFLUENCER & MEDIA ANALYTICS</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-full space-y-6 animate-in fade-in duration-500">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-foreground">Ask me anything</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      I can query influencer profiles, campaign data, and Nestlé media analytics
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={s.label}
                        onClick={() => handleSend(s.query)}
                        className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/50 animate-in fade-in slide-in-from-bottom-2 duration-300"
                        style={{ animationDelay: `${100 + i * 50}ms`, animationFillMode: "both" }}
                      >
                        <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{s.label}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{s.query}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    message={{
                      ...msg,
                      // Strip FOLLOW_UP lines from display
                      content: msg.role === "assistant"
                        ? msg.content.replace(/^FOLLOW_UP:.*$/gm, "").trim()
                        : msg.content,
                    }}
                    isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                  />
                ))}

                {/* Follow-up chips */}
                {!isStreaming && followUps.length > 0 && (
                  <div className="px-4 py-3 flex flex-wrap gap-2">
                    {followUps.map((fu, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(fu)}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-card text-foreground/80 hover:border-primary/40 hover:bg-secondary/50 transition-colors"
                      >
                        {fu}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      )}
    </>
  );
}
