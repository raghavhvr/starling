import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useStarlingChat, CHAT_SUGGESTIONS, displayContent } from "@/hooks/useStarlingChat";

export function ChatDrawer() {
  const [open, setOpen] = useState(false);
  const { messages, isStreaming, send, followUps } = useStarlingChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

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

  // The full-page Nestlé AI view already is the chat; no floating drawer there
  if (pathname === "/ai") return null;

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
                    {CHAT_SUGGESTIONS.slice(0, 4).map((s, i) => (
                      <button
                        key={s.label}
                        onClick={() => send(s.query)}
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
                    message={{ ...msg, content: displayContent(msg) }}
                    isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                  />
                ))}

                {isStreaming && messages[messages.length - 1]?.role === "user" && <ThinkingIndicator />}

                {/* Follow-up chips */}
                {!isStreaming && followUps.length > 0 && (
                  <div className="px-4 py-3 flex flex-wrap gap-2">
                    {followUps.map((fu, i) => (
                      <button
                        key={i}
                        onClick={() => send(fu)}
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

          <ChatInput onSend={send} disabled={isStreaming} />
        </div>
      )}
    </>
  );
}
