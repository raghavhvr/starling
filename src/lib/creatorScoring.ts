export interface CreatorRow {
  name: string;
  handle: string;
  tier: string;
  country: string;
  platform: string;
  profile_type: string;
  community: string;
  er: string | number;
  market: string | number;
  rationale: string;
  _raw?: Record<string, any>;
  _source?: string;
}

export interface ScoreResult {
  scores: { market: number; tribe: number; profile: number; er: number; tier: number; safety: number };
  total: number;
  bucket: "HERO" | "STRONG" | "MAYBE" | "SKIP";
}

export type Weights = { market: number; tribe: number; profile: number; er: number; tier: number; safety: number };

export const DEFAULT_WEIGHTS: Weights = { market: 20, tribe: 25, profile: 20, er: 15, tier: 10, safety: 10 };

export const CANONICAL_PLATFORMS = ["Instagram", "TikTok", "Snapchat"] as const;

export function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizePlatform(value: unknown): string {
  const raw = normalizeText(value);
  const v = raw.toLowerCase();
  if (!v) return "";
  if (v === "sc" || v.includes("snapchat") || v.includes("snap")) return "Snapchat";
  if (v === "tt" || v.includes("tiktok") || v.includes("tik tok")) return "TikTok";
  if (v === "ig" || v.includes("instagram") || v.includes("insta")) return "Instagram";
  return "";
}

export function platformFromProfileLink(value: unknown): string {
  const raw = normalizeText(value);
  const v = raw.toLowerCase();
  if (!v) return "";
  if (/^sc\b/.test(v) || v.includes("snapchat.com")) return "Snapchat";
  if (/^tt\b/.test(v) || v.includes("tiktok.com")) return "TikTok";
  if (/^ig\b/.test(v) || v.includes("instagram.com") || v.includes("instagr.am")) return "Instagram";
  return "";
}

const headerMatches = (header: string, pattern: RegExp) => pattern.test(normalizeText(header));

function valueByHeader(row: Record<string, any>, pattern: RegExp): string {
  const key = Object.keys(row).find(h => headerMatches(h, pattern));
  return key ? normalizeText(row[key]) : "";
}

export function score(row: CreatorRow, weights: Weights = DEFAULT_WEIGHTS): ScoreResult {
  const country = (row.country || "").trim();
  let sMarketRaw = ["KSA", "UAE", "Saudi Arabia", "United Arab Emirates"].includes(country) ? 20
    : country === "Kuwait" ? 8
    : country === "Jordan" ? 3
    : 5;
  const sMarket = Math.round((sMarketRaw / 20) * weights.market);

  const c = (row.community || "").toLowerCase();
  let sTribeRaw = 0;
  if (c.includes("modest fashion") || c.includes("hijabi")) sTribeRaw = Math.max(sTribeRaw, 25);
  if (c.includes("lifestyle")) sTribeRaw = Math.max(sTribeRaw, 22);
  if (c.includes("fashion & styling") || c.includes("fashion and styling")) sTribeRaw = Math.max(sTribeRaw, 22);
  if (c.includes("gym goers") || c.includes("active lifestyle") || c.includes("gym")) sTribeRaw = Math.max(sTribeRaw, 22);
  if (c.includes("photographers") || c.includes("photography")) sTribeRaw = Math.max(sTribeRaw, 18);
  if (c.includes("general beauty") && sTribeRaw < 15) sTribeRaw = 15;
  const tribeCount = [
    c.includes("modest fashion") || c.includes("hijabi"),
    c.includes("lifestyle"),
    c.includes("fashion & styling") || c.includes("fashion and styling"),
    c.includes("gym goers") || c.includes("active lifestyle") || c.includes("gym"),
    c.includes("photographers") || c.includes("photography"),
  ].filter(Boolean).length;
  if (tribeCount >= 2) sTribeRaw = Math.min(25, sTribeRaw + 2);
  if (!c) sTribeRaw = 10;
  const sTribe = Math.round((sTribeRaw / 25) * weights.tribe);

  const p = (row.profile_type || "").toLowerCase();
  const sProfileRaw =
    p.includes("eye makeup guru") ? 20 :
    p.includes("beauty maven") ? 18 :
    p.includes("beauty it girl") ? 17 :
    p.includes("makeup artist") ? 16 :
    p.includes("lifestyle beauty") ? 15 :
    p === "beauty" ? 15 :
    (p.includes("athletes") || p.includes("fitness") || p.includes("active lifestyle")) ? 14 :
    p.includes("lifestyle") ? 13 :
    p.includes("funky") ? 10 :
    p.includes("fashion") ? 11 :
    p.includes("entertainment") ? 7 : 8;
  const sProfile = Math.round((sProfileRaw / 20) * weights.profile);

  const er = parseFloat(String(row.er));
  const sERRaw = !isFinite(er) ? 7
    : er >= 6 ? 15 : er >= 4 ? 12 : er >= 2 ? 9 : er >= 1 ? 6 : 2;
  const sER = Math.round((sERRaw / 15) * weights.er);

  const t = (row.tier || "").toLowerCase();
  const sTierRaw = t.includes("top") ? 10 : t.includes("macro") ? 9 : t.includes("mid") ? 8
    : t.includes("micro") ? 7 : t.includes("nano") ? 5 : 6;
  const sTier = Math.round((sTierRaw / 10) * weights.tier);

  let sSafetyRaw = 8;
  if (c.includes("modest fashion") || c.includes("hijabi")) sSafetyRaw += 2;
  if (p.includes("entertainment") && !p.includes("beauty") && !c.replace("general beauty", "").includes("beauty")) sSafetyRaw -= 2;
  if (p.includes("funky")) sSafetyRaw -= 1;
  sSafetyRaw = Math.max(0, Math.min(10, sSafetyRaw));
  const sSafety = Math.round((sSafetyRaw / 10) * weights.safety);

  const total = sMarket + sTribe + sProfile + sER + sTier + sSafety;
  const maxTotal = weights.market + weights.tribe + weights.profile + weights.er + weights.tier + weights.safety;
  const normalized = Math.round((total / maxTotal) * 100);
  const bucket: ScoreResult["bucket"] = normalized >= 88 ? "HERO" : normalized >= 78 ? "STRONG" : normalized >= 65 ? "MAYBE" : "SKIP";

  return {
    scores: { market: sMarket, tribe: sTribe, profile: sProfile, er: sER, tier: sTier, safety: sSafety },
    total: normalized,
    bucket,
  };
}

const FIELD_PATTERNS: Record<keyof Omit<CreatorRow, "_raw" | "_source">, RegExp[]> = {
  name: [/^name$/i, /full[\s_]?name/i, /creator[\s_]?name/i],
  handle: [/^handle$/i, /^@?handle/i, /username/i, /profile[\s_]?link/i, /profile[\s_]?url/i, /^profile$/i, /^link$/i, /^url$/i, /^ig$/i, /^tt$/i],
  tier: [/tier/i],
  country: [/country/i, /^market$/i, /region/i, /location/i],
  platform: [/^platform\s*\(\s*search\s*\)$/i, /channel/i],
  profile_type: [/type[\s_]?of[\s_]?profile/i, /profile[\s_]?type/i, /^profile$/i, /category/i],
  community: [/community/i, /tribe/i, /niche/i],
  er: [/^er$/i, /er[\s_]?%/i, /engagement/i],
  market: [/market[\s_]?%/i, /audience[\s_]?%/i],
  rationale: [/rationale/i, /notes?/i, /description/i, /comments?/i],
};

export function autoMapColumns(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const field of Object.keys(FIELD_PATTERNS) as (keyof typeof FIELD_PATTERNS)[]) {
    const patterns = FIELD_PATTERNS[field];
    let found: string | undefined;
    for (const p of patterns) {
      found = headers.find(h => headerMatches(h, p));
      if (found) break;
    }
    mapping[field] = found || null;
  }

  const explicitHandle = headers.find(h => headerMatches(h, /^handle$/i));
  if (explicitHandle) mapping.handle = explicitHandle;

  const platformSearch = headers.find(h => headerMatches(h, /^platform\s*\(\s*search\s*\)$/i));
  if (platformSearch) mapping.platform = platformSearch;

  // Prefer "Tier (Normalized)" over plain "Tier" when present
  const tierNorm = headers.find(h => headerMatches(h, /tier\s*\(\s*normali[sz]ed\s*\)/i));
  if (tierNorm) mapping.tier = tierNorm;

  return mapping;
}

export function applyMapping(rows: Record<string, any>[], mapping: Record<string, string | null>, source?: string): CreatorRow[] {
  return rows.map(r => {
    const out: any = { _raw: r, _source: source };
    for (const field of Object.keys(mapping)) {
      const src = mapping[field];
      out[field] = src ? normalizeText(r[src]) : "";
    }
    const platformSearch = valueByHeader(r, /^platform\s*\(\s*search\s*\)$/i);
    const profileLink = valueByHeader(r, /^profile\s*link$/i) || valueByHeader(r, /profile\s*(url|link)|^link$|^url$/i);
    out.platform = normalizePlatform(platformSearch) || platformFromProfileLink(profileLink) || normalizePlatform(out.platform);
    for (const field of ["name", "handle", "tier", "country", "profile_type", "community", "rationale"] as const) {
      out[field] = normalizeText(out[field]);
    }
    return out as CreatorRow;
  });
}

export function normalizeER(rows: CreatorRow[]): { rows: CreatorRow[]; converted: boolean } {
  const numbers = rows.map(r => parseFloat(String(r.er))).filter(n => isFinite(n));
  if (numbers.length === 0) return { rows, converted: false };
  const max = Math.max(...numbers);
  if (max < 1) {
    return {
      rows: rows.map(r => ({ ...r, er: isFinite(parseFloat(String(r.er))) ? parseFloat(String(r.er)) * 100 : r.er })),
      converted: true,
    };
  }
  return { rows, converted: false };
}

export function isNeedsReview(row: CreatorRow): boolean {
  return !row.name || !row.platform || !row.country;
}

export const MENA_COUNTRIES = [
  "ksa", "saudi arabia", "uae", "united arab emirates", "kuwait", "qatar", "bahrain",
  "oman", "jordan", "lebanon", "egypt", "morocco", "tunisia", "algeria", "iraq", "palestine",
];

export function getFlag(row: CreatorRow): string | null {
  const c = (row.country || "").trim().toLowerCase();
  if (!c) return null;
  if (!MENA_COUNTRIES.some(m => c.includes(m))) return `Off-region: ${row.country}`;
  return null;
}
