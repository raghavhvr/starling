import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, BarChart3, TrendingUp, Sparkles, ShieldCheck, MapPin, type LucideIcon } from "lucide-react";
import { streamChat, type ChatMessage as ChatMsg } from "@/lib/chat-stream";

export type ChatSuggestion = { icon: LucideIcon; label: string; query: string };

export const CHAT_SUGGESTIONS: ChatSuggestion[] = [
  { icon: Users, label: "Top creators", query: "Who are the top 5 Nestlé roster creators by ROI?" },
  { icon: BarChart3, label: "Campaign results", query: "How did the Maggi #MadeWithMaggi Ramadan Series perform?" },
  { icon: TrendingUp, label: "Creator deep dive", query: "Tell me everything about Manal Al Alem" },
  { icon: Sparkles, label: "NIDO Egypt fit", query: "Which Egypt creators are the best fit for NIDO Al Assassy?" },
  { icon: ShieldCheck, label: "Active flight check", query: "How is the active campaign tracking on spend and deliverables?" },
  { icon: MapPin, label: "KSA family creators", query: "Find Saudi family creators with over 500K followers for a Maggi launch" },
];

// Strip FOLLOW_UP lines the model appends so they render as chips, not text
export const displayContent = (msg: ChatMsg) =>
  msg.role === "assistant" ? msg.content.replace(/^FOLLOW_UP:.*$/gm, "").trim() : msg.content;

/** Conversation state + streaming send, shared by the drawer and the full-page view. */
export function useStarlingChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const send = useCallback(async (input: string) => {
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

  const reset = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const followUps = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return [] as string[];
    return lastAssistant.content
      .split("\n")
      .map((line) => line.match(/^FOLLOW_UP:\s*(.+)/)?.[1]?.trim())
      .filter((s): s is string => !!s);
  }, [messages]);

  return { messages, isStreaming, send, reset, followUps };
}
