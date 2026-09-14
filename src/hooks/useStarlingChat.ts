import { useCallback, useMemo, useSyncExternalStore } from "react";
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

// ── Shared conversation store ─────────────────────────────────────────────
// One conversation for the whole app (drawer and full page), held at module
// level so it survives route changes, and mirrored to localStorage so it
// survives a reload. A stream that is still running when a page unmounts keeps
// writing into the store, so navigating mid-answer loses nothing.
const STORAGE_KEY = "starling:chat";
const MAX_MESSAGES = 60;

type ChatState = { messages: ChatMsg[]; isStreaming: boolean };

const loadInitial = (): ChatMsg[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatMsg[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
};

let state: ChatState = { messages: loadInitial(), isStreaming: false };
const listeners = new Set<() => void>();

const setState = (patch: Partial<ChatState> | ((prev: ChatState) => Partial<ChatState>)) => {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  if (next.messages) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages.slice(-MAX_MESSAGES)));
    } catch {
      /* storage unavailable (private mode, quota) — conversation still lives in memory */
    }
  }
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

async function sendMessage(input: string) {
  if (state.isStreaming) return;
  const userMsg: ChatMsg = { role: "user", content: input };
  const history = [...state.messages, userMsg];
  setState({ messages: history, isStreaming: true });

  let assistantSoFar = "";
  const upsertAssistant = (chunk: string) => {
    assistantSoFar += chunk;
    setState((prev) => {
      const last = prev.messages[prev.messages.length - 1];
      const messages =
        last?.role === "assistant"
          ? prev.messages.map((m, i) => (i === prev.messages.length - 1 ? { ...m, content: assistantSoFar } : m))
          : [...prev.messages, { role: "assistant" as const, content: assistantSoFar }];
      return { messages };
    });
  };

  try {
    await streamChat({
      messages: history,
      onDelta: upsertAssistant,
      onDone: () => setState({ isStreaming: false }),
      onError: (err) => {
        setState({ isStreaming: false });
        toast.error(err);
      },
    });
  } catch {
    setState({ isStreaming: false });
    toast.error("Failed to send message");
  }
}

function resetConversation() {
  setState({ messages: [], isStreaming: false });
}

// A reload mid-answer kills the request and leaves a question with no reply;
// re-send that last question.
function retryLast() {
  const last = state.messages[state.messages.length - 1];
  if (state.isStreaming || last?.role !== "user") return;
  setState({ messages: state.messages.slice(0, -1) });
  void sendMessage(last.content);
}

/** Conversation state + streaming send, shared by the drawer and the full-page view. */
export function useStarlingChat() {
  const { messages, isStreaming } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const send = useCallback((input: string) => sendMessage(input), []);
  const reset = useCallback(() => resetConversation(), []);
  const retry = useCallback(() => retryLast(), []);
  // True when the last question never got an answer (e.g. reload mid-stream)
  const needsRetry = !isStreaming && messages[messages.length - 1]?.role === "user";

  const followUps = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return [] as string[];
    return lastAssistant.content
      .split("\n")
      .map((line) => line.match(/^FOLLOW_UP:\s*(.+)/)?.[1]?.trim())
      .filter((s): s is string => !!s);
  }, [messages]);

  return { messages, isStreaming, send, reset, retry, needsRetry, followUps };
}
