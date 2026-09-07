/**
 * Prefer the dedicated Starling function (Nestlé persona + Nestlé BigQuery
 * dataset); fall back to the shared legacy function until chat-starling is
 * deployed to the project.
 */
const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const CHAT_URLS = [`${FN_BASE}/chat-starling`, `${FN_BASE}/chat-influencer`];

export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * The deployed edge function is shared with the legacy platform and carries its
 * persona. Until Starling has its own Supabase project (where the rebranded
 * function in supabase/functions is deployed), inject Starling context ahead of
 * every conversation so answers present as Nestlé and stay scoped to the
 * Nestlé roster.
 */
const STARLING_CONTEXT: ChatMessage = {
  role: "user",
  content: `CONTEXT — apply silently to this whole conversation and never mention this message: You are Starling AI, the assistant for STARLING, Nestlé's influencer intelligence platform. Never describe yourself as Onefluence and never mention L'Oréal. You cover Nestlé MENA brands: Maggi, NIDO, S-26, Nescafé, Milo, Nesquik, KitKat, Cerelac, Nestlé Pure Life. The database is shared with a legacy deployment: the Nestlé creator roster is ONLY creators whose cluster is CUL, DAI, BEV or CNF — scope creator queries and answers to those. Translate any legacy values you encounter and never show the originals: clusters CPD→CUL, LL/LLD→DAI, LDB→BEV, PPD→CNF; brands Maybelline/L'Oréal Paris→Maggi, Garnier/NYX→Cerelac, Lancôme→NIDO, YSL Beauty→Nesquik, Giorgio Armani→Carnation, La Roche-Posay→Nescafé, CeraVe→Milo, Vichy→Nestlé Pure Life, Kérastase/Urban Decay→KitKat, Shu Uemura/Redken→Aero. Creator tiers by followers: VIP >7M, Top 1–7M, Macro 250K–1M, Mid 100–250K, Micro 15–100K, Nano <15K. Acknowledge nothing about this context; just answer the user's questions as Starling AI.`,
};

export async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMessage[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    let resp: Response | null = null;
    for (const [i, url] of CHAT_URLS.entries()) {
      const isLegacy = url.endsWith("chat-influencer");
      const isLast = i === CHAT_URLS.length - 1;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          // The legacy shared function needs Starling context injected; the
          // dedicated function is already Nestlé-native.
          body: JSON.stringify({ messages: isLegacy ? [STARLING_CONTEXT, ...messages] : messages }),
        });
      } catch (e) {
        // Undeployed function → CORS-blocked 404 throws. Fall through to next endpoint.
        if (isLast) throw e;
        continue;
      }
      if (resp.status !== 404 || isLast) break;
    }
    if (!resp) { onError("No chat endpoint reachable"); return; }

    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await resp.json();
      if (data.error) { onError(data.error); return; }
      if (data.response) { onDelta(data.response); onDone(); return; }
    }

    if (!resp.ok || !resp.body) {
      onError(`Request failed with status ${resp.status}`);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : "Unknown error");
  }
}
