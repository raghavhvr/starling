import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import confetti from "canvas-confetti";
import {
  Upload, Zap, Layers, Send, Sparkles, FileSpreadsheet, Check, AlertCircle,
  ChevronRight, X, Search, Edit3, Download, Info,
} from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CreatorRow, ScoreResult, Weights, DEFAULT_WEIGHTS,
  score, autoMapColumns, applyMapping, normalizeER, normalizePlatform, isNeedsReview, getFlag,
} from "@/lib/creatorScoring";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

type EnrichedRow = CreatorRow & { _id: string; _result?: ScoreResult; _status: "pending" | "parsing" | "scoring" | "grouping" | "done"; _needsReview: boolean; _flag?: string | null; _creatorId?: string; _avatarUrl?: string | null };

const EXPECTED_FIELDS: { key: keyof CreatorRow; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "handle", label: "Handle / Profile Link" },
  { key: "tier", label: "Tier" },
  { key: "country", label: "Country", required: true },
  { key: "platform", label: "Platform", required: true },
  { key: "profile_type", label: "Profile Type" },
  { key: "community", label: "Community / Tribe" },
  { key: "er", label: "Engagement Rate" },
  { key: "market", label: "Market %" },
  { key: "rationale", label: "Rationale / Notes" },
];

const DEFAULT_DELIVERABLES: Record<string, string> = {
  HERO: "1 hero Reel + 1 TikTok GRT + 5 Stories, 2 rounds feedback, 14-day window",
  STRONG: "1 hero Reel or TikTok + 3 Stories, 1 round feedback, 10-day window",
  MAYBE: "1 TikTok or Reel + 2 Stories, 1 round feedback, 7-day window",
  SKIP: "Manually review before activation",
  REVIEW: "Hold — fill missing data first",
};

const TIER_FOLLOWERS: Record<string, number> = { TOP: 1_000_000, MACRO: 300_000, MID: 80_000, MICRO: 20_000, NANO: 5_000 };

function fmt(n: number) { return new Intl.NumberFormat("en-US").format(n); }

interface FileMeta { filename: string; rows: number; cols: number; }

interface BulkCreatorUploadProps {
  campaignId?: string | null;
  onComplete?: (payload: { creatorIds: string[]; count: number }) => void | Promise<void>;
}

function normalizeHandle(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(ig|tt|sc)$/i.test(raw)) return "";
  let cleaned = raw
    .replace(/^https?:\/\/(www\.)?(instagram|tiktok|snapchat|youtube|twitter|x|facebook|fb)\.com\/(@|add\/|channel\/|user\/|c\/)?/i, "")
    .replace(/^https?:\/\/(www\.)?(instagr\.am|youtu\.be)\//i, "")
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .trim();
  if (/^(ig|tt|sc)$/i.test(cleaned)) return "";
  return cleaned ? `@${cleaned.toLowerCase()}` : "";
}

export function BulkCreatorUpload({ campaignId, onComplete }: BulkCreatorUploadProps = {}) {
  const [step, setStep] = useState(1);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [parsing, setParsing] = useState(false);
  const [erConverted, setErConverted] = useState(false);
  const [enriched, setEnriched] = useState<EnrichedRow[]>([]);
  const [enrichElapsed, setEnrichElapsed] = useState(0);
  const [enrichDone, setEnrichDone] = useState(false);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [showWeights, setShowWeights] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{ name: string; w: Weights }[]>([]);
  const [deliverables, setDeliverables] = useState(DEFAULT_DELIVERABLES);
  const [activated, setActivated] = useState(false);
  const [activatedRoster, setActivatedRoster] = useState<EnrichedRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<{ tier?: string; country?: string; bucket?: string }>({});
  const [editing, setEditing] = useState<EnrichedRow | null>(null);
  const [activity, setActivity] = useState<{ ts: Date; text: string }[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [elrotzCreator, setElrotzCreator] = useState<CreatorRow | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ done: 0, total: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  const log = useCallback((text: string) => setActivity(a => [{ ts: new Date(), text }, ...a].slice(0, 50)), []);

  useEffect(() => {
    let cancelled = false;
    const loadElrotz = async () => {
      const { data } = await supabase
        .from("creators")
        .select("name, handle, country, platform, followers, engagement_rate, bio")
        .eq("handle", "@elrotz")
        .maybeSingle();
      if (!cancelled && data) {
        setElrotzCreator({
          name: data.name || "@elrotz",
          handle: data.handle || "@elrotz",
          tier: (data.followers || 0) >= 300000 ? "Macro" : (data.followers || 0) >= 80000 ? "Mid" : "Micro",
          country: data.country || "Mexico",
          platform: data.platform || "Instagram",
          profile_type: "Existing creator record",
          community: data.bio || "Creator list match",
          er: data.engagement_rate || "0",
          market: "",
          rationale: "Existing creator in the database — flagged as off-region for removal in review",
          _source: "Creator database",
        });
      }
    };
    loadElrotz();
    return () => { cancelled = true; };
  }, []);

  /* PARSE FILE */
  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      let parsedRows: Record<string, any>[] = [];
      let headerList: string[] = [];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
        parsedRows = result.data as Record<string, any>[];
        headerList = result.meta.fields?.map(f => f.trim()) || [];
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        // Pick the influencer sheet, not the first summary tab. Prefer tabs named "USE THIS FOR" and
        // headers containing the canonical Platform (Search) + Profile Link columns.
        const KEY_HINTS = [/platform\s*\(\s*search\s*\)/i, /profile\s*link/i, /name/i, /handle/i, /country/i, /tier/i, /community/i, /profile/i, /\ber\b|engagement/i, /market/i];
        let best: { name: string; aoa: any[][]; headerIdx: number; score: number } | null = null;
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
          if (!aoa.length) continue;
          // try first 6 rows as candidate header rows
          for (let i = 0; i < Math.min(6, aoa.length); i++) {
            const row = (aoa[i] || []).map((c: any) => String(c ?? "").trim());
            const nonEmpty = row.filter(Boolean).length;
            if (nonEmpty < 3) continue;
            const sheetBoost = /use\s*this\s*for/i.test(sheetName) ? 10000 : /summary|groupings/i.test(sheetName) ? -10000 : 0;
            const canonicalBoost = row.some(h => /platform\s*\(\s*search\s*\)/i.test(h)) ? 5000 : 0;
            const score = sheetBoost + canonicalBoost + KEY_HINTS.reduce((acc, p) => acc + (row.some(h => p.test(h)) ? 1 : 0), 0) * 100 + nonEmpty;
            if (!best || score > best.score) best = { name: sheetName, aoa, headerIdx: i, score };
          }
        }
        if (!best) { toast.error("No usable sheet found"); setParsing(false); return; }
        if (best.name !== wb.SheetNames[0]) log(`Using sheet "${best.name}" (best header match)`);
        const headerRow = best.aoa[best.headerIdx] || [];
        headerList = headerRow.map((h: any, i: number) => {
          const v = String(h ?? "").trim();
          return v || `Column ${i + 1}`;
        });
        // Dedupe duplicate header names so mapping select keys don't collide
        const seen = new Map<string, number>();
        headerList = headerList.map(h => {
          const n = (seen.get(h) || 0) + 1;
          seen.set(h, n);
          return n === 1 ? h : `${h} (${n})`;
        });
        parsedRows = best.aoa.slice(best.headerIdx + 1)
          .filter(row => Array.isArray(row) && row.some(c => String(c ?? "").trim()))
          .filter(row => !String(row[0] ?? "").toLowerCase().startsWith("total"))
          .map(row => {
            const obj: Record<string, any> = {};
            headerList.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
          });
      }

      if (parsedRows.length === 0) { toast.error("No data rows found in file"); setParsing(false); return; }

      const auto = autoMapColumns(headerList);
      // append vs replace
      setRawRows(prev => [...prev, ...parsedRows.map(r => ({ ...r, __source: file.name }))]);
      setHeaders(prev => Array.from(new Set([...prev, ...headerList])));
      setMapping(prev => Object.keys(prev).length ? prev : auto);
      setFiles(prev => [...prev, { filename: file.name, rows: parsedRows.length, cols: headerList.length }]);
      log(`Uploaded ${file.name} · ${parsedRows.length} rows`);
      toast.success(`Detected ${parsedRows.length} rows · ${headerList.length} columns`);
      setStep(2);
    } catch (e: any) {
      toast.error("Parse failed: " + e.message);
    } finally {
      setParsing(false);
    }
  }, [log]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragRef.current?.classList.remove("border-primary");
    const fileList = Array.from(e.dataTransfer.files);
    for (const f of fileList) await parseFile(f);
  }, [parseFile]);

  const onFiles = useCallback(async (fs: FileList | null) => {
    if (!fs) return;
    for (const f of Array.from(fs)) await parseFile(f);
  }, [parseFile]);

  /* MAPPED ROWS */
  const mappedRows = useMemo<CreatorRow[]>(() => {
    if (!Object.keys(mapping).length) return [];
      const exactHeader = (name: string) => headers.find(h => h.trim().toLowerCase() === name.toLowerCase());
      const platformSearchHeader = headers.find(h => /^platform\s*\(\s*search\s*\)$/i.test(h.trim()));
    const strictMapping = {
      ...mapping,
      handle: exactHeader("handle") || mapping.handle,
        platform: platformSearchHeader || mapping.platform,
    };
    let rows = applyMapping(rawRows, strictMapping);
    rows = rows.map((r, i) => ({ ...r, _source: rawRows[i]?.__source }));
    const norm = normalizeER(rows);
    return norm.rows;
  }, [rawRows, headers, mapping]);

  // Side-effect for ER conversion notice (kept out of useMemo to avoid render loops)
  useEffect(() => {
    if (!Object.keys(mapping).length || rawRows.length === 0) return;
    const rows = applyMapping(rawRows, mapping);
    const norm = normalizeER(rows);
    if (norm.converted && !erConverted) {
      setErConverted(true);
      toast("ER values detected as decimals — converted to percent.", { icon: "🔁" });
    }
  }, [rawRows, mapping, erConverted]);

  const needsReviewCount = useMemo(() => mappedRows.filter(isNeedsReview).length, [mappedRows]);

  /* ENRICH (Step 3) */
  const startEnrichment = useCallback(async () => {
    setStep(3);
    setEnrichDone(false);
    setEnrichElapsed(0);
    const start = Date.now();
    const normalizedHandles = new Set(mappedRows.map(r => normalizeHandle(r.handle)).filter(Boolean));
    const seeded: CreatorRow[] = elrotzCreator && !normalizedHandles.has("@elrotz") ? [...mappedRows, elrotzCreator] : mappedRows;
    const initial: EnrichedRow[] = seeded.map((r, i) => ({
      ...r, _id: `${i}-${r.name}-${r.handle}`,
      _status: "pending", _needsReview: isNeedsReview(r), _flag: getFlag(r),
    }));
    setEnriched(initial);

    const interval = setInterval(() => setEnrichElapsed((Date.now() - start) / 1000), 100);

    for (let i = 0; i < initial.length; i++) {
      await new Promise(r => setTimeout(r, Math.max(15, 50 - Math.floor(initial.length / 50))));
      const result = score(initial[i], weights);
      setEnriched(prev => prev.map((row, idx) => idx === i ? { ...row, _result: result, _status: "done" } : row));
    }
    clearInterval(interval);
    setEnrichElapsed((Date.now() - start) / 1000);
    setEnrichDone(true);
    log(`Enriched ${initial.length} creators`);
  }, [mappedRows, weights, log, elrotzCreator]);

  // Re-score live on weights change (after first enrichment)
  useEffect(() => {
    if (!enrichDone) return;
    setEnriched(prev => prev.map(r => ({ ...r, _result: score(r, weights) })));
  }, [weights, enrichDone]);

  // Auto-advance: once mapping is valid on step 2, kick off enrichment automatically
  useEffect(() => {
    if (step === 2 && mapping.name && mappedRows.length > 0 && enriched.length === 0) {
      const t = setTimeout(() => startEnrichment(), 600);
      return () => clearTimeout(t);
    }
  }, [step, mapping, mappedRows, enriched.length, startEnrichment]);

  // Auto-advance: once enrichment is done on step 3, move to grouping/review
  useEffect(() => {
    if (step === 3 && enrichDone) {
      const t = setTimeout(() => setStep(4), 800);
      return () => clearTimeout(t);
    }
  }, [step, enrichDone]);

  /* TIERS */
  const buckets = useMemo(() => {
    const b = { HERO: [] as EnrichedRow[], STRONG: [] as EnrichedRow[], MAYBE: [] as EnrichedRow[], SKIP: [] as EnrichedRow[], REVIEW: [] as EnrichedRow[] };
    enriched.forEach(r => {
      if (r._flag) b.REVIEW.push(r);
      else if (r._needsReview) b.REVIEW.push(r);
      else if (r._result) b[r._result.bucket].push(r);
    });
    return b;
  }, [enriched]);

  const removeCreator = useCallback((id: string, name: string) => {
    setEnriched(prev => prev.filter(r => r._id !== id));
    setActivatedRoster(prev => prev.filter(r => r._id !== id));
    log(`Removed ${name}`);
    toast.success(`Removed ${name}`);
  }, [log]);

  const stats = useMemo(() => {
    const totals = enriched.filter(r => r._result).map(r => r._result!.total);
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const maxIdx = totals.length ? totals.indexOf(Math.max(...totals)) : -1;
    const top = maxIdx >= 0 ? enriched.filter(r => r._result)[maxIdx] : null;
    return { ingested: enriched.length, scored: enriched.filter(r => r._status === "done").length, avg, top };
  }, [enriched]);

  const summary = useMemo(() => {
    const A = buckets.HERO.length + buckets.STRONG.length + buckets.MAYBE.length;
    const tiers = [buckets.HERO, buckets.STRONG, buckets.MAYBE].filter(t => t.length > 0).length;
    return {
      A, B: tiers,
      C: buckets.HERO.length * 2 + buckets.STRONG.length * 1 + buckets.MAYBE.length * 1,
      D: buckets.HERO.length * 5 + buckets.STRONG.length * 3 + buckets.MAYBE.length * 2,
      E: buckets.SKIP.length, F: buckets.REVIEW.length,
    };
  }, [buckets]);


  /* ACTIVATE */
  const activate = useCallback(async () => {
    // Activate ALL enriched creators (every tier + needs-review). Nothing is "skipped" — everyone is segmented.
    const roster = enriched.map(r => ({ ...r, _status: "done" as const }));
    setSavingCampaign(true);
    try {
      // Build a clean handle from the name (no ugly @creator_NNN-- placeholders)
      const slugifyName = (name?: string) => {
        const slug = String(name || "")
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "") // strip diacritics
          .replace(/[^a-zA-Z0-9]+/g, "")
          .toLowerCase()
          .slice(0, 40);
        return slug ? `@${slug}` : "";
      };

      // First pass: try to match each row to an existing creator by NAME (case-insensitive)
      // so a row "Yara Aziz" links to the existing @yaraaziz profile (with avatar).
      const namesToLookup = Array.from(new Set(
        roster.map(r => (r.name || "").trim()).filter(Boolean)
      ));
      const existingByName = new Map<string, { id: string; handle: string }>();
      if (namesToLookup.length > 0) {
        // Postgres ILIKE ANY via .or() chain — chunked to keep URL short
        const CHUNK = 50;
        for (let i = 0; i < namesToLookup.length; i += CHUNK) {
          const chunk = namesToLookup.slice(i, i + CHUNK);
          const orExpr = chunk.map(n => `name.ilike.%${n.replace(/[%,()]/g, "")}%`).join(",");
          const { data } = await supabase
            .from("creators")
            .select("id, name, handle")
            .or(orExpr);
          (data || []).forEach((c: any) => {
            const cn = (c.name || "").toLowerCase();
            chunk.forEach(n => {
              const ln = n.toLowerCase();
              if (cn.includes(ln) || ln.includes(cn.split(" ").slice(-2).join(" "))) {
                if (!existingByName.has(ln)) existingByName.set(ln, { id: c.id, handle: c.handle });
              }
            });
          });
        }
      }

      // Resolve a handle for every row: explicit handle > existing-by-name match > slug from name
      const resolveHandle = (r: typeof roster[number]) => {
        const explicit = normalizeHandle(r.handle);
        if (explicit) return explicit;
        const matched = existingByName.get((r.name || "").toLowerCase().trim());
        if (matched?.handle) return normalizeHandle(matched.handle);
        return slugifyName(r.name) || `@creator_${r._id.slice(0, 6)}`;
      };

      const rosterWithHandles = roster.map(r => ({ row: r, handle: resolveHandle(r) }));
      const handles = Array.from(new Set(rosterWithHandles.map(x => x.handle).filter(Boolean)));
      const existingByHandle = new Map<string, string>();
      if (handles.length > 0) {
        const { data, error } = await supabase
          .from("creators")
          .select("id, handle")
          .in("handle", handles);
        if (error) throw error;
        (data || []).forEach((c: any) => existingByHandle.set(normalizeHandle(c.handle), c.id));
      }

      const toInsert = rosterWithHandles
        .filter(x => x.handle && !existingByHandle.has(x.handle))
        .map(({ row: r, handle }) => ({
          name: r.name || handle.replace(/^@/, "") || "Unnamed creator",
          handle,
          country: r.country || null,
          platform: (normalizePlatform(r.platform) || "Instagram").toLowerCase(),
          engagement_rate: Number.parseFloat(String(r.er)) || 0,
          soi_score: r._result?.total || 0,
          bio: [r.profile_type, r.community, r.rationale].filter(Boolean).join(" · ") || null,
          status: "active",
        }));

      if (toInsert.length > 0) {
        const seen = new Set<string>();
        const uniqueInsert = toInsert.filter(r => {
          const h = normalizeHandle(r.handle);
          if (!h || seen.has(h)) return false;
          seen.add(h);
          return true;
        });
        const { data, error } = await supabase
          .from("creators")
          .upsert(uniqueInsert, { onConflict: "handle", ignoreDuplicates: false })
          .select("id, handle");
        if (error) throw error;
        (data || []).forEach((c: any) => existingByHandle.set(normalizeHandle(c.handle), c.id));
        const stillMissing = uniqueInsert
          .map(r => normalizeHandle(r.handle))
          .filter(h => h && !existingByHandle.has(h));
        if (stillMissing.length > 0) {
          const { data: refetch } = await supabase
            .from("creators")
            .select("id, handle")
            .in("handle", stillMissing);
          (refetch || []).forEach((c: any) => existingByHandle.set(normalizeHandle(c.handle), c.id));
        }
      }

      const creatorIds = rosterWithHandles
        .map(x => existingByHandle.get(x.handle))
        .filter(Boolean) as string[];
      if (campaignId && creatorIds.length > 0) {
        const { data: existingLinks, error: linkReadError } = await supabase
          .from("campaign_creators")
          .select("creator_id")
          .eq("campaign_id", campaignId);
        if (linkReadError) throw linkReadError;
        const linked = new Set((existingLinks || []).map((r: any) => r.creator_id));
        const linkRows = creatorIds.filter(id => !linked.has(id)).map(creator_id => ({ campaign_id: campaignId, creator_id, status: "invited" }));
        if (linkRows.length > 0) {
          // Use upsert with ignoreDuplicates so re-running the activation flow on a
          // campaign that already has some of these creators linked doesn't crash.
          const { error } = await supabase
            .from("campaign_creators")
            .upsert(linkRows, { onConflict: "campaign_id,creator_id", ignoreDuplicates: true });
          if (error && !/duplicate key|23505/i.test(error.message || "")) throw error;
        }
      }

      // Pull avatar_url + canonical name for the resolved creators so the review table
      // shows the real profile image AND the real creator name (not the spreadsheet placeholder).
      const allIds = Array.from(new Set(creatorIds));
      const metaById = new Map<string, { avatar_url: string | null; name: string | null; handle: string | null }>();
      if (allIds.length > 0) {
        const { data: enrichedRows } = await supabase
          .from("creators")
          .select("id, avatar_url, name, handle")
          .in("id", allIds);
        (enrichedRows || []).forEach((c: any) => metaById.set(c.id, { avatar_url: c.avatar_url, name: c.name, handle: c.handle }));
      }
      const rosterWithAvatars = rosterWithHandles.map(({ row, handle }) => {
        const id = existingByHandle.get(handle);
        const meta = id ? metaById.get(id) : null;
        return {
          ...row,
          _creatorId: id,
          _avatarUrl: meta?.avatar_url || null,
          // Prefer the canonical creator name from the DB if the spreadsheet had a placeholder
          name: meta?.name || row.name,
          handle,
        };
      });

      setActivatedRoster(rosterWithAvatars);
      setActivated(true);
      log(`Activated ${rosterWithAvatars.length} creators`);
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ["#FFD400", "#1B1F3A", "#fff"] });
      toast.success(`${fmt(roster.length)} creators added to campaign review`);

      // Kick off profile enrichment — pulls real avatars, bios, follower counts
      // for every supported platform (Instagram, TikTok, Snapchat).
      // Pass aligned creatorIds so the scraper updates the exact creator row.
      const byPlatform: Record<"instagram" | "tiktok" | "snapchat", { handles: string[]; creatorIds: string[] }> = {
        instagram: { handles: [], creatorIds: [] },
        tiktok: { handles: [], creatorIds: [] },
        snapchat: { handles: [], creatorIds: [] },
      };
      for (const r of rosterWithAvatars) {
        const p = normalizePlatform(r.platform) || "Instagram";
        const h = normalizeHandle(r.handle);
        const id = r._creatorId;
        if (!h || !id) continue;
        const bucket = p === "TikTok" ? byPlatform.tiktok : p === "Snapchat" ? byPlatform.snapchat : byPlatform.instagram;
        bucket.handles.push(h);
        bucket.creatorIds.push(id);
      }
      const totalToEnrich = byPlatform.instagram.handles.length + byPlatform.tiktok.handles.length + byPlatform.snapchat.handles.length;
      if (totalToEnrich > 0) {
        if (byPlatform.snapchat.handles.length > 0) {
          log(`Scraping ${byPlatform.snapchat.handles.length} Snapchat profiles via Scrape Creators…`);
          toast.info(`Pulling ${byPlatform.snapchat.handles.length} Snapchat profiles`);
        }
        enrichProfilesInBackground(byPlatform).catch(e => console.error("Background enrichment failed:", e));
      }

      if (onComplete) {
        await onComplete({ creatorIds, count: roster.length });
        return;
      }
    } catch (e: any) {
      toast.error(e.message || "Could not add creators to campaign");
      setSavingCampaign(false);
      return;
    }
    setSavingCampaign(false);
  }, [enriched, log, campaignId, onComplete]);

  const enrichProfilesInBackground = useCallback(async (byPlatform: { instagram: { handles: string[]; creatorIds: string[] }; tiktok: { handles: string[]; creatorIds: string[] }; snapchat: { handles: string[]; creatorIds: string[] } }) => {
    const total = byPlatform.instagram.handles.length + byPlatform.tiktok.handles.length + byPlatform.snapchat.handles.length;
    setScraping(true);
    setScrapeProgress({ done: 0, total });
    log(`Scraping ${total} profiles for avatars + bios (IG ${byPlatform.instagram.handles.length} · TT ${byPlatform.tiktok.handles.length} · SC ${byPlatform.snapchat.handles.length})…`);

    const refreshAvatars = async (handles: string[]) => {
      if (handles.length === 0) return;
      const { data: refreshed } = await supabase
        .from("creators")
        .select("handle, avatar_url, bio, followers")
        .in("handle", handles);
      if (refreshed && refreshed.length > 0) {
        const byHandle = new Map<string, { avatar_url: string | null }>();
        refreshed.forEach((c: any) => byHandle.set((c.handle || "").toLowerCase(), c));
        setActivatedRoster(prev => prev.map(r => {
          const h = (r.handle || "").toLowerCase();
          const match = byHandle.get(h);
          if (!match) return r;
          return { ...r, _avatarUrl: match.avatar_url || r._avatarUrl };
        }));
      }
    };

    const runScraper = async (fnName: string, group: { handles: string[]; creatorIds: string[] }, batchSize: number) => {
      for (let i = 0; i < group.handles.length; i += batchSize) {
        const handles = group.handles.slice(i, i + batchSize);
        const creatorIds = group.creatorIds.slice(i, i + batchSize);
        try {
          await supabase.functions.invoke(fnName, { body: { handles, creatorIds, includePosts: false } });
        } catch (e) {
          console.error(`${fnName} batch error:`, e);
        }
        await refreshAvatars(handles);
        setScrapeProgress(p => ({ done: p.done + handles.length, total: p.total }));
      }
    };

    // Run platforms in parallel — they hit different Apify actors
    await Promise.all([
      runScraper("scrape-instagram", byPlatform.instagram, 15),
      runScraper("scrape-tiktok", byPlatform.tiktok, 15),
      runScraper("scrape-snapchat", byPlatform.snapchat, 15),
    ]);

    setScraping(false);
    log(`Profile enrichment complete · ${total} creators refreshed`);
    toast.success(`Enriched ${total} profiles with real photos & bios`);
  }, [log]);


  const reach = useMemo(() => {
    if (!activated) return null;
    let impressions = 0;
    activatedRoster.forEach(r => {
      const tierKey = (r.tier || "").toUpperCase().replace(/[^A-Z]/g, "").includes("TOP") ? "TOP"
        : r.tier?.toLowerCase().includes("macro") ? "MACRO"
        : r.tier?.toLowerCase().includes("mid") ? "MID"
        : r.tier?.toLowerCase().includes("micro") ? "MICRO"
        : r.tier?.toLowerCase().includes("nano") ? "NANO" : "MID";
      const followers = TIER_FOLLOWERS[tierKey];
      const er = parseFloat(String(r.er)) || 3;
      impressions += followers * (er / 100) * 5;
    });
    const cpm = 8;
    const cost = (impressions / 1000) * cpm;
    return { impressions: Math.round(impressions), cost: Math.round(cost), cpm };
  }, [activated, activatedRoster]);

  /* RENDER STEP 1 */
  const renderStep1 = () => (
    <div
      ref={dragRef}
      onDragOver={(e) => { e.preventDefault(); dragRef.current?.classList.add("border-primary"); }}
      onDragLeave={() => dragRef.current?.classList.remove("border-primary")}
      onDrop={onDrop}
      className="border-2 border-dashed border-border rounded-3xl p-16 text-center transition-colors bg-gradient-to-b from-yellow-500/5 to-transparent min-h-[400px] flex flex-col items-center justify-center"
    >
      <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mb-6">
        <Upload className="w-9 h-9 text-yellow-500" />
      </div>
      <h2 className="font-serif text-4xl mb-3">Skip the one-by-one. Drop your creator list.</h2>
      <p className="text-muted-foreground max-w-xl mb-8">
        Upload an Excel or CSV. We'll enrich, score, and group it against your active brief — live.
      </p>
      <input
        type="file" id="bulk-file" multiple accept=".xlsx,.xls,.csv"
        className="hidden" onChange={(e) => onFiles(e.target.files)}
      />
      <label htmlFor="bulk-file" className="cursor-pointer">
        <span className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-yellow-500 text-black font-medium hover:bg-yellow-400 transition-colors shadow-sm">
          <FileSpreadsheet className="w-4 h-4" /> Browse files
        </span>
      </label>
      <div className="mt-6 text-xs text-muted-foreground tracking-wide uppercase">
        Drag &amp; drop · Click to browse · Up to 5,000 rows
      </div>
      {parsing && <div className="mt-6 text-sm text-yellow-500 animate-pulse">Parsing…</div>}
      {files.length > 0 && (
        <div className="mt-8 text-xs text-muted-foreground">
          {files.map(f => <div key={f.filename}>✓ {f.filename} · {fmt(f.rows)} rows · {f.cols} cols</div>)}
        </div>
      )}
    </div>
  );

  /* STEP 2 */
  const renderStep2 = () => (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Detected columns ({headers.length})</h3>
        <div className="border border-border divide-y divide-border">
          {headers.map(h => (
            <div key={h} className="px-3 py-2 text-sm font-mono">{h}</div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Map to platform fields</h3>
        <div className="space-y-2">
          {EXPECTED_FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm">{f.label}{f.required && <span className="text-red-500"> *</span>}</div>
              </div>
              <div className="flex-1">
                <Select value={mapping[f.key] || "_none"} onValueChange={(v) => setMapping(m => ({ ...m, [f.key]: v === "_none" ? null : v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="-- not mapped --" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-- not mapped --</SelectItem>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {mapping[f.key] && <Check className="w-4 h-4 text-green-500" />}
            </div>
          ))}
        </div>
        {needsReviewCount > 0 && (
          <div className="mt-4 p-3 border border-yellow-500/40 bg-yellow-500/5 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <span>{fmt(needsReviewCount)} rows are missing Country, Platform, or Name. They'll be flagged "Needs Review" after scoring.</span>
          </div>
        )}
        <Button onClick={startEnrichment} className="mt-6 w-full bg-yellow-500 text-black hover:bg-yellow-400" disabled={!mapping.name}>
          Looks good — enrich <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  /* STEP 3 */
  const renderStep3 = () => (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Stat label="Creators ingested" value={fmt(stats.ingested)} />
        <Stat label={`Scored in ${enrichElapsed.toFixed(1)}s`} value={fmt(stats.scored)} />
        <Stat label="Average score" value={`${stats.avg.toFixed(1)} / 100`} />
        <Stat label="Top score" value={stats.top ? `${stats.top._result?.total} — ${stats.top.name}` : "—"} />
      </div>

      <div className="border border-border mb-4">
        <button onClick={() => setShowWeights(s => !s)} className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted">
          <Sparkles className="w-4 h-4" /> Scoring weights {showWeights ? "▼" : "▶"}
        </button>
        {showWeights && (
          <div className="p-4 grid grid-cols-3 gap-4 border-t border-border">
            {(Object.keys(weights) as (keyof Weights)[]).map(k => (
              <div key={k}>
                <div className="text-xs uppercase tracking-wider mb-2 flex justify-between"><span>{k}</span><span className="font-mono">{weights[k]}</span></div>
                <Slider value={[weights[k]]} max={50} min={0} step={1} onValueChange={(v) => setWeights(w => ({ ...w, [k]: v[0] }))} />
              </div>
            ))}
            <div className="col-span-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const name = prompt("Template name?");
                if (name) { setSavedTemplates(t => [...t, { name, w: weights }]); log(`Saved template: ${name}`); }
              }}>Save as template</Button>
              {savedTemplates.map(t => <Button key={t.name} size="sm" variant="ghost" onClick={() => setWeights(t.w)}>{t.name}</Button>)}
            </div>
          </div>
        )}
      </div>

      <div className="border border-border max-h-[400px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider sticky top-0">
            <tr><th className="text-left p-2">Status</th><th className="text-left p-2">Name</th><th className="text-left p-2">Handle</th><th className="text-left p-2">Country</th><th className="text-left p-2">Tier</th><th className="text-right p-2 font-mono">Score</th><th className="text-left p-2">Bucket</th></tr>
          </thead>
          <tbody>
            {enriched.map(r => (
              <tr key={r._id} className="border-t border-border hover:bg-muted/50 group relative" title={r._result ? `Market ${r._result.scores.market} · Tribe ${r._result.scores.tribe} · Profile ${r._result.scores.profile} · ER ${r._result.scores.er} · Tier ${r._result.scores.tier} · Safety ${r._result.scores.safety}` : ""}>
                <td className="p-2">
                  {r._status === "pending" ? <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30" />
                    : r._status === "done" ? <Check className="w-3 h-3 text-green-500" />
                    : <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                </td>
                <td className="p-2">{r.name}</td>
                <td className="p-2 text-muted-foreground text-xs font-mono truncate max-w-[160px]">{r.handle}</td>
                <td className="p-2">{r.country}</td>
                <td className="p-2 text-xs">{r.tier}</td>
                <td className="p-2 text-right font-mono">{r._result?.total ?? "—"}</td>
                <td className="p-2">{r._needsReview ? <Badge variant="outline" className="text-xs">Review</Badge> : r._result && <Badge className={bucketColor(r._result.bucket)}>{r._result.bucket}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enrichDone && (
        <Button onClick={() => setStep(4)} className="mt-4 bg-yellow-500 text-black hover:bg-yellow-400">
          Group &amp; activate <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  /* STEP 4 */
  const flaggedRows = useMemo(() => enriched.filter(r => r._flag || r._needsReview), [enriched]);
  const outlier = useMemo(
    () => enriched.find(r => (r.handle || "").toLowerCase().includes("elrotz")) || null,
    [enriched]
  );
  const renderStep4 = () => (
    <div>
      <AnalysisPanel rows={enriched} />

      {outlier && (
        <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/15 border border-yellow-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/80 mb-1">Outlier to investigate</div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h4 className="font-serif text-2xl">{outlier.name}</h4>
                <span className="text-xs text-muted-foreground font-mono">{outlier.handle}</span>
                {outlier._flag && (
                  <Badge variant="outline" className="rounded-full text-xs border-yellow-500/40 text-yellow-500">
                    {outlier._flag}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Sits outside the MENA target region but scored well on engagement. Worth a manual look before you decide to keep or drop.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => removeCreator(outlier._id, outlier.name)}
            >
              <X className="w-3 h-3" /> Drop
            </Button>
          </div>
        </div>
      )}

      <Button onClick={activate} disabled={enriched.length === 0 || savingCampaign} className="rounded-full bg-yellow-500 text-black hover:bg-yellow-400">
        <Send className="w-4 h-4" /> {savingCampaign ? "Adding to campaign…" : "Activate creators"}
      </Button>
    </div>
  );

  /* ROSTER (post-activation) */
  const filteredRoster = useMemo(() => {
    return activatedRoster.filter(r => {
      if (activeFilter.tier && r.tier !== activeFilter.tier) return false;
      if (activeFilter.country && r.country !== activeFilter.country) return false;
      if (activeFilter.bucket && r._result?.bucket !== activeFilter.bucket) return false;
      return true;
    });
  }, [activatedRoster, activeFilter]);

  const renderRoster = () => {
    const top3 = [...activatedRoster].filter(r => r._result?.bucket === "HERO").sort((a, b) => (b._result!.total - a._result!.total)).slice(0, 3);
    return (
      <div>

        <div className="flex gap-4 mb-4 items-center text-sm">
          <span><strong>{fmt(activatedRoster.length)}</strong> active</span>
          <span className="text-muted-foreground">·</span>
          <span><strong>{fmt(activatedRoster.length)}</strong> awaiting concept</span>
          {reach && <>
            <span className="text-muted-foreground">·</span>
            <span>~<strong>{fmt(reach.impressions)}</strong> impressions</span>
            <span className="text-muted-foreground">·</span>
            <span>est. <strong>${fmt(reach.cost)}</strong> @ ${reach.cpm} CPM</span>
          </>}
          {scraping && (
            <span className="flex items-center gap-2 text-yellow-600 animate-pulse">
              <Sparkles className="w-3 h-3" />
              Enriching profiles · {scrapeProgress.done}/{scrapeProgress.total}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setStep(1); setActivated(false); }}>+ Add more creators</Button>
            <Button size="sm" variant="outline" onClick={() => setShowActivity(true)}>Activity</Button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <Select value={activeFilter.bucket || "_all"} onValueChange={(v) => setActiveFilter(f => ({ ...f, bucket: v === "_all" ? undefined : v }))}>
            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Bucket" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All buckets</SelectItem>
              {["HERO", "STRONG", "MAYBE"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeFilter.country || "_all"} onValueChange={(v) => setActiveFilter(f => ({ ...f, country: v === "_all" ? undefined : v }))}>
            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All countries</SelectItem>
              {Array.from(new Set(activatedRoster.map(r => r.country).filter(Boolean))).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeFilter.tier || "_all"} onValueChange={(v) => setActiveFilter(f => ({ ...f, tier: v === "_all" ? undefined : v }))}>
            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All tiers</SelectItem>
              {Array.from(new Set(activatedRoster.map(r => r.tier).filter(Boolean))).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border overflow-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider sticky top-0">
              <tr>
                <th className="text-left p-2 w-12"></th>
                <th className="text-left p-2">Name</th><th className="text-left p-2">Country</th><th className="text-left p-2">Tier</th>
                <th className="text-right p-2 font-mono">Score</th><th className="text-left p-2">Platform</th><th className="text-left p-2">Bucket</th>
                <th className="text-left p-2">Status</th><th className="text-left p-2">Source</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map(r => {
                const initials = (r.name || "?").split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                const cleanHandle = (r.handle || "").replace(/^@/, "").trim();
                const platformKey = (r.platform || "").toLowerCase();
                // Cascade: try the actual platform first, then others, then initials
                const platformOrder: string[] = [];
                if (platformKey.includes("snap")) platformOrder.push("snapchat", "instagram", "tiktok");
                else if (platformKey.includes("tiktok")) platformOrder.push("tiktok", "instagram", "snapchat");
                else if (platformKey.includes("youtube")) platformOrder.push("youtube", "instagram", "tiktok");
                else platformOrder.push("instagram", "tiktok", "snapchat");
                const fallbackChain = cleanHandle ? platformOrder.map(p => `https://unavatar.io/${p}/${cleanHandle}?fallback=false`) : [];
                const avatarSrc = r._avatarUrl || fallbackChain[0] || null;
                return (
                  <tr key={r._id} className="border-t border-border hover:bg-muted/50 cursor-pointer" onClick={() => setEditing(r)}>
                    <td className="p-2">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt={r.name}
                          data-fallback-idx={r._avatarUrl ? "-1" : "0"}
                          data-fallback-chain={JSON.stringify(fallbackChain)}
                          className="w-8 h-8 rounded-full object-cover border border-border bg-muted"
                          loading="lazy"
                          onError={(e) => {
                            const img = e.currentTarget;
                            const chain: string[] = JSON.parse(img.dataset.fallbackChain || "[]");
                            const idx = parseInt(img.dataset.fallbackIdx || "0", 10);
                            const next = idx + 1;
                            if (next < chain.length) {
                              img.dataset.fallbackIdx = String(next);
                              img.src = chain[next];
                            } else {
                              img.style.display = "none";
                              const sib = img.nextElementSibling as HTMLElement | null;
                              if (sib) sib.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="w-8 h-8 rounded-full bg-yellow-500/15 border border-yellow-500/30 items-center justify-center text-[10px] font-medium text-yellow-700"
                        style={{ display: avatarSrc ? "none" : "flex" }}
                      >
                        {initials}
                      </div>
                    </td>
                    <td className="p-2">{r.name}<div className="text-[10px] text-muted-foreground font-mono">{r.handle}</div></td>
                    <td className="p-2">{r.country}</td>
                    <td className="p-2 text-xs">{r.tier}</td>
                    <td className="p-2 text-right font-mono">{r._result?.total}</td>
                    <td className="p-2 text-xs">{r.platform}</td>
                    <td className="p-2"><Badge className={bucketColor(r._result?.bucket)}>{r._result?.bucket}</Badge></td>
                    <td className="p-2 text-xs text-muted-foreground">Awaiting concept</td>
                    <td className="p-2 text-xs text-muted-foreground truncate max-w-[120px]">{r._source}</td>
                    <td className="p-2"><Edit3 className="w-3 h-3 text-muted-foreground" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* MAIN RENDER */
  return (
    <div className="space-y-6">
      {/* Stepper */}
      {!activated && (
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider">
          {[
            { n: 1, l: "Drop", icon: Upload },
            { n: 2, l: "Map", icon: Layers },
            { n: 3, l: "Enrich", icon: Zap },
            { n: 4, l: "Activate", icon: Send },
          ].map(s => (
            <div key={s.n} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-colors ${step === s.n ? "border-yellow-500 text-yellow-500 bg-yellow-500/5" : step > s.n ? "border-green-500/40 text-green-500 bg-green-500/5" : "border-border text-muted-foreground"}`}>
              <s.icon className="w-3 h-3" /> {s.l}
            </div>
          ))}
        </div>
      )}

      {!activated ? (
        <>
          {step === 1 && renderStep1()}
          {step === 2 && (rawRows.length > 0 ? renderStep2() : <EmptyStep label="Upload a file in Step 1 to continue" />)}
          {step === 3 && (enriched.length > 0 || mappedRows.length > 0 ? renderStep3() : <EmptyStep label="Upload a file in Step 1 to continue" />)}
          {step === 4 && (enriched.length > 0 ? renderStep4() : <EmptyStep label="Upload a file in Step 1 to continue" />)}
        </>
      ) : renderRoster()}

      {/* Override drawer */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-[400px]">
          <SheetHeader><SheetTitle>{editing?.name}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-4 mt-4 text-sm">
              <div><span className="text-muted-foreground">Handle:</span> {editing.handle}</div>
              <div><span className="text-muted-foreground">Score:</span> {editing._result?.total} ({editing._result?.bucket})</div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Tier</label>
                <Input defaultValue={editing.tier} onBlur={(e) => {
                  setActivatedRoster(prev => prev.map(r => r._id === editing._id ? { ...r, tier: e.target.value } : r));
                  log(`Override: ${editing.name} tier → ${e.target.value}`);
                }} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Private note</label>
                <Textarea placeholder="Note…" />
              </div>
              <Badge variant="outline">Edited</Badge>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Activity drawer */}
      <Sheet open={showActivity} onOpenChange={setShowActivity}>
        <SheetContent className="w-[400px]">
          <SheetHeader><SheetTitle>Activity</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2 text-sm">
            {activity.map((a, i) => (
              <div key={i} className="border-b border-border pb-2">
                <div className="text-xs text-muted-foreground">{a.ts.toLocaleTimeString()}</div>
                <div>{a.text}</div>
              </div>
            ))}
            {activity.length === 0 && <div className="text-muted-foreground text-xs">No activity yet.</div>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-lg mt-1">{value}</div>
    </div>
  );
}

function EmptyStep({ label }: { label: string }) {
  return <div className="border border-dashed border-border p-12 text-center text-muted-foreground text-sm">{label}</div>;
}

function bucketColor(b?: string) {
  switch (b) {
    case "HERO": return "bg-yellow-500 text-black hover:bg-yellow-500";
    case "STRONG": return "bg-yellow-500/30 text-yellow-500 hover:bg-yellow-500/30";
    case "MAYBE": return "bg-muted text-foreground hover:bg-muted";
    case "SKIP": return "bg-red-500/20 text-red-500 hover:bg-red-500/20";
    default: return "bg-muted";
  }
}

function TierCard({ label, count, rows, deliverable, onChangeDeliverable }: {
  label: string; count: number; rows: EnrichedRow[]; deliverable: string; onChangeDeliverable: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-colors hover:border-yellow-500/40">
      <button onClick={() => setOpen(o => !o)} className="w-full p-4 text-left hover:bg-muted/40 transition-colors">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="font-serif text-3xl mt-1.5">{fmt(count)}</div>
      </button>
      {open && (
        <div className="border-t border-border p-3 space-y-2 max-h-[300px] overflow-auto">
          <Textarea value={deliverable} onChange={(e) => onChangeDeliverable(e.target.value)} className="text-xs h-20 rounded-xl" />
          <div className="space-y-1">
            {rows.slice(0, 50).map(r => (
              <div key={r._id} className="text-xs flex justify-between gap-2">
                <span className="truncate">{r.name}</span>
                <span className="text-muted-foreground font-mono">{r._result?.total ?? "—"}</span>
              </div>
            ))}
            {rows.length > 50 && <div className="text-xs text-muted-foreground">+ {rows.length - 50} more</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Composite Score Explainer (hover card) ─── */
function CompositeScoreExplainer() {
  const Row = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[11px] text-foreground">{value}</span>
      {hint && <span className="text-[10px] text-muted-foreground/70 italic">{hint}</span>}
    </div>
  );
  return (
    <div className="text-foreground">
      <div className="px-4 pt-4 pb-2 border-b border-border/60">
        <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-500/90 mb-1">Composite Score · 0–100</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Three signals: <span className="text-foreground">audience size</span>, <span className="text-foreground">engagement quality</span>, <span className="text-foreground">local relevance</span>. Caps prevent any single dimension from carrying the score.
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60">
        <div className="p-3">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Tier weight</div>
          <div className="font-serif text-2xl text-foreground">5–40</div>
          <div className="text-[10px] text-muted-foreground mt-1">audience size</div>
        </div>
        <div className="p-3">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Engagement</div>
          <div className="font-serif text-2xl text-foreground">0–30</div>
          <div className="text-[10px] text-muted-foreground mt-1">ER% × 600, capped</div>
        </div>
        <div className="p-3">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Market</div>
          <div className="font-serif text-2xl text-foreground">0–30</div>
          <div className="text-[10px] text-muted-foreground mt-1">Market% × 50, capped</div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border/60">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Tier points</div>
        <div className="grid grid-cols-5 gap-1 text-center">
          {[["TOP/VIP","40"],["MACRO","30"],["MID","20"],["MICRO","10"],["NANO","5"]].map(([k,v]) => (
            <div key={k} className="rounded-lg bg-muted/40 py-1.5">
              <div className="text-[9px] text-muted-foreground">{k}</div>
              <div className="font-mono text-xs text-foreground">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border/60">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Worked example · Layali Boker</div>
        <Row label="TOP tier" value="40" />
        <Row label="ER 4.58% × 600" value="27.5" hint="capped @30" />
        <Row label="Market 42.92% × 50" value="21.5" hint="capped @30" />
        <div className="flex items-baseline justify-between border-t border-border/60 mt-1.5 pt-1.5">
          <span className="text-[11px] text-foreground">Composite</span>
          <span className="font-mono text-sm text-yellow-500">89.0 · A — Lead</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Priority bands</div>
        <div className="flex gap-1.5 text-[10px]">
          <div className="flex-1 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-2 py-1.5">
            <div className="font-mono text-yellow-500">≥ 70</div>
            <div className="text-muted-foreground">A — Lead</div>
          </div>
          <div className="flex-1 rounded-md border border-border bg-muted/30 px-2 py-1.5">
            <div className="font-mono text-foreground">50–69</div>
            <div className="text-muted-foreground">B — Power Player</div>
          </div>
          <div className="flex-1 rounded-md border border-border bg-muted/30 px-2 py-1.5">
            <div className="font-mono text-foreground">&lt; 50</div>
            <div className="text-muted-foreground">C — Rising Star</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analysis Panel ─── */
function AnalysisPanel({ rows }: { rows: EnrichedRow[] }) {
  const stats = useMemo(() => {
    const total = rows.length;
    const ers = rows.map(r => parseFloat(String(r.er))).filter(n => isFinite(n) && n > 0);
    const avgER = ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : 0;
    const scores = rows.map(r => r._result?.total ?? 0).filter(n => n > 0);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const groupBy = (key: (r: EnrichedRow) => string, normalize?: (s: string) => string) => {
      const m = new Map<string, EnrichedRow[]>();
      rows.forEach(r => {
        let k = (key(r) || "").trim();
        if (normalize) k = normalize(k);
        if (!k) k = "—";
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(r);
      });
      return Array.from(m.entries()).map(([k, rs]) => {
        const ers = rs.map(r => parseFloat(String(r.er))).filter(n => isFinite(n) && n > 0);
        const avgER = ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null;
        const scs = rs.map(r => r._result?.total ?? 0).filter(n => n > 0);
        const avgSc = scs.length ? scs.reduce((a, b) => a + b, 0) / scs.length : 0;
        const aTier = rs.filter(r => r._result?.bucket === "HERO").length;
        return { key: k, count: rs.length, avgER, avgScore: avgSc, aTier };
      }).sort((a, b) => b.count - a.count);
    };

    const normPlat = (s: string) => {
      const x = (s || "").toLowerCase().trim();
      if (!x) return "—";
      if (x.includes("tiktok") || x === "tt" || x === "tik tok") return "TikTok";
      if (x.includes("snap") || x === "sc" || x === "snapchat") return "Snapchat";
      if (x.includes("insta") || x === "ig") return "Instagram";
      if (x.includes("youtube") || x === "yt") return "YouTube";
      return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const tiers = groupBy(r => r.tier, s => s.toUpperCase());
    const platforms = groupBy(r => r.platform, normPlat);
    const countries = groupBy(r => r.country, s => s.toUpperCase());
    const communities = groupBy(r => r.community);
    const profiles = groupBy(r => r.profile_type);

    // Strategic Role assignment (deterministic, single role per creator)
    const roleOrder = ["Awareness Driver", "Brand Storyteller", "Conversion / Trust", "Engagement Builder", "Reach Amplifier"];
    const assignRole = (r: EnrichedRow): string => {
      const er = parseFloat(String(r.er));
      const followers = Number((r as any).followers) || 0;
      const tier = (r.tier || "").toUpperCase();
      const bucket = r._result?.bucket;
      if (isFinite(er) && er >= 6) return "Conversion / Trust";
      if (bucket === "HERO") return "Awareness Driver";
      if (followers >= 250000 || tier.includes("TOP") || tier.includes("MACRO")) return "Reach Amplifier";
      if (isFinite(er) && er >= 4) return "Engagement Builder";
      return "Brand Storyteller";
    };
    const roleStats = roleOrder.map(role => {
      const rs = rows.filter(r => assignRole(r) === role);
      const ers = rs.map(r => parseFloat(String(r.er))).filter(n => isFinite(n) && n > 0);
      const avgER = ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null;
      const scs = rs.map(r => r._result?.total ?? 0).filter(n => n > 0);
      const avgSc = scs.length ? scs.reduce((a, b) => a + b, 0) / scs.length : 0;
      return { role, count: rs.length, avgER, avgScore: avgSc };
    });

    return { total, avgER, avgScore, tiers, platforms, countries, communities, profiles, roleStats };
  }, [rows]);

  const Section = ({ title, data, valueKey = "key" }: { title: string; data: any[]; valueKey?: string }) => (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
        <h5 className="text-[11px] uppercase tracking-[0.18em] text-foreground/80 font-medium">{title}</h5>
      </div>
      <div className="divide-y divide-border/60">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5">{title.split(" ").pop()}</div>
          <div className="col-span-2 text-right">Creators</div>
          <div className="col-span-2 text-right">Avg ER</div>
          <div className="col-span-2 text-right">Avg Score</div>
          <div className="col-span-1 text-right">A-Tier</div>
        </div>
        {data.slice(0, 8).map((d, i) => {
          const maxCount = Math.max(...data.map(x => x.count));
          const pct = (d.count / maxCount) * 100;
          return (
            <div key={i} className="relative grid grid-cols-12 gap-2 px-4 py-2 text-xs items-center hover:bg-muted/30">
              <div className="absolute inset-y-0 left-0 bg-yellow-500/5" style={{ width: `${pct}%` }} />
              <div className="col-span-5 relative truncate font-medium">{d[valueKey]}</div>
              <div className="col-span-2 relative text-right font-mono">{d.count}</div>
              <div className="col-span-2 relative text-right font-mono text-muted-foreground">{d.avgER != null ? `${d.avgER.toFixed(2)}%` : "—"}</div>
              <div className="col-span-2 relative text-right font-mono text-muted-foreground">{d.avgScore.toFixed(1)}</div>
              <div className="col-span-1 relative text-right font-mono text-yellow-500">{d.aTier || "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mb-6 space-y-4">
      {/* Hero KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Creators", value: fmt(stats.total), tip: "Number of creators in your uploaded list after parsing." },
          { label: "Avg ER%", value: `${stats.avgER.toFixed(2)}%`, tip: "Average Engagement Rate across all creators with a numeric ER. ER = (likes + comments) ÷ followers." },
          {
            label: "Avg Composite Score",
            value: stats.avgScore.toFixed(1),
            tip: "COMPOSITE_SCORE",
          },
        ].map(k => (
          <HoverCard key={k.label} openDelay={120}>
            <HoverCardTrigger asChild>
              <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/20 p-5 cursor-help transition-colors hover:border-yellow-500/40">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5">
                  {k.label}
                  <Info className="h-3 w-3 opacity-60" />
                </div>
                <div className="font-serif text-4xl">{k.value}</div>
              </div>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-[420px] p-0 border-border bg-card/95 backdrop-blur-xl">
              {k.tip === "COMPOSITE_SCORE" ? <CompositeScoreExplainer /> : (
                <div className="p-4 text-xs text-muted-foreground leading-relaxed">{k.tip}</div>
              )}
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Breakdown by Platform" data={stats.platforms} />
        <Section title="Breakdown by Country" data={stats.countries} />
        <Section title="Breakdown by Tier" data={stats.tiers} />
        <Section title="Breakdown by Community" data={stats.communities} />
        <Section title="Breakdown by Profile Type" data={stats.profiles} />

        {/* Strategic Role breakdown */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
            <h5 className="text-[11px] uppercase tracking-[0.18em] text-foreground/80 font-medium">Breakdown by Strategic Role</h5>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2">Strategic Role</th>
                <th className="text-right px-3 py-2"># Creators</th>
                <th className="text-right px-3 py-2">Avg ER%</th>
                <th className="text-right px-4 py-2">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stats.roleStats.map(r => (
                <tr key={r.role} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{r.role}</td>
                  <td className="text-right px-3 py-2 font-mono">{r.count || "—"}</td>
                  <td className="text-right px-3 py-2 font-mono text-muted-foreground">{r.avgER != null ? `${r.avgER.toFixed(2)}%` : "—"}</td>
                  <td className="text-right px-4 py-2 font-mono">{r.avgScore ? r.avgScore.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
