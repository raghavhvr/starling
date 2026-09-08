// Imports the exported Starling data (scripts/data/*.json) into a fresh
// Supabase project. Run AFTER migrations are applied (supabase db push).
//
// Requires in .env:
//   NEW_SUPABASE_URL="https://<new-ref>.supabase.co"
//   NEW_SUPABASE_SERVICE_ROLE_KEY="<service-role key>"   (bypasses RLS for import)
//
// Idempotent: rows upsert on their preserved primary keys.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const URL_ = env.NEW_SUPABASE_URL;
const KEY = env.NEW_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY in .env first.");
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" };

// Normalize any legacy values so the new database is native-Nestlé throughout
const CLUSTER_MAP = { CPD: "CUL", LL: "DAI", LLD: "DAI", LDB: "BEV", PPD: "CNF" };
const BRAND_MAP = {
  "Maybelline": "Maggi", "L'Oréal Paris": "Maggi", "Garnier": "Cerelac", "NYX": "Cerelac",
  "Lancôme": "NIDO", "YSL Beauty": "Nesquik", "YSL": "Nesquik", "Giorgio Armani": "Carnation",
  "La Roche-Posay": "Nescafé", "CeraVe": "Milo", "Vichy": "Nestlé Pure Life",
  "Kérastase": "KitKat", "Shu Uemura": "Aero", "Redken": "Aero", "Urban Decay": "KitKat",
};
const normalize = (row) => ({
  ...row,
  ...(row.cluster !== undefined ? { cluster: CLUSTER_MAP[row.cluster] || row.cluster } : {}),
  ...(row.brand !== undefined && row.brand ? { brand: BRAND_MAP[row.brand] || row.brand } : {}),
});

const load = (name) => JSON.parse(readFileSync(join(root, "scripts", "data", `${name}.json`), "utf8"));

async function importTable(table, rows, conflictKey = "id") {
  let done = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const res = await fetch(`${URL_}/rest/v1/${table}?on_conflict=${conflictKey}`, {
      method: "POST",
      headers: H,
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      console.error(`${table} chunk ${i / 200} failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      process.exit(1);
    }
    done += chunk.length;
  }
  console.log(`${table}: ${done} rows imported`);
}

// Dependency order; creators/campaigns first, then join tables
await importTable("creators", load("creators").map(normalize));
await importTable("campaigns", load("campaigns").map(normalize));
await importTable("campaign_creators", load("campaign_creators"));
await importTable("campaign_deliverables", load("campaign_deliverables"));
await importTable("campaign_activities", load("campaign_activities"));
await importTable("comet_niches", load("comet_niches"));

console.log("Import complete.");
