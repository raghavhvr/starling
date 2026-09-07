// Transform the Nestlé MENA roster Excel into creators-table rows.
// Metrics are derived from the Sample Performance sheet where present:
//   ER   = engagements / impressions
//   CPV  = fee / video views
//   ROI  = earned-media value (engagements*$0.40 + clicks*$1.50 + views*$0.01) / fee
//   SOI  = tier base score adjusted by ER (platform influence score)
// Output: public/seed/nestle-creators.json (fetched by the browser for import).
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const src = "C:/Users/Raghavendra.Reddy/OneDrive - insidemedia.net/Desktop/L'Oreal/Lumnia/Lumina/Creators/Nestle_MENA_Creator_Roster_Sample.xlsx";
const wb = XLSX.readFile(src);
const roster = XLSX.utils.sheet_to_json(wb.Sheets["Creator Roster"]);
const perf = XLSX.utils.sheet_to_json(wb.Sheets["Sample Performance"]);

// Aggregate performance per creator
const perfBy = new Map();
for (const p of perf) {
  const id = p["Creator ID"];
  const cur = perfBy.get(id) || { fee: 0, impressions: 0, views: 0, engagements: 0, clicks: 0, posts: 0 };
  cur.fee += Number(p["Fee (USD)"]) || 0;
  cur.impressions += Number(p["Impressions"]) || 0;
  cur.views += Number(p["Video Views"]) || 0;
  cur.engagements += Number(p["Engagements"]) || 0;
  cur.clicks += Number(p["Link Clicks"]) || 0;
  cur.posts += 1;
  perfBy.set(id, cur);
}

const TIER_SOI = { VIP: 92, Top: 86, Macro: 80, Mid: 72, Micro: 62, Nano: 52 };

let genericIdx = 0;
const pillarCluster = (pillar) => {
  const p = (pillar || "").toLowerCase();
  if (/coffee|beverage|drink|barista|juice|tea/.test(p)) return "BEV";
  if (/dessert|snack|baking|chocolate|sweet|pastry/.test(p)) return "CNF";
  if (/family|parent|mum|mom|kids|nutrition|health/.test(p)) return "DAI";
  if (/food|cook|recipe|chef|cuisine/.test(p)) return "CUL";
  // Generalist creators (city/lifestyle pillars) spread across CUL/BEV/CNF so
  // every cluster carries a workable pool
  return ["CUL", "BEV", "CNF"][genericIdx++ % 3];
};

const rows = roster.map((r, i) => {
  const brandFit = String(r["Brand Fit"] || "").trim();
  let brand = null;
  let cluster;
  if (brandFit === "Nido") { brand = "NIDO"; cluster = "DAI"; }
  else if (brandFit === "Maggi") { brand = "Maggi"; cluster = "CUL"; }
  else if (brandFit === "Both") { brand = i % 2 === 0 ? "Maggi" : "NIDO"; cluster = i % 2 === 0 ? "CUL" : "DAI"; }
  else { brand = null; cluster = pillarCluster(r["Content Pillar"]); }

  const tier = String(r["Tier"] || "Micro").trim();
  const p = perfBy.get(r["Creator ID"]);

  let engagement_rate = null, roi = null, cpv = null, soi = TIER_SOI[tier] ?? 60;
  if (p && p.impressions > 0 && p.fee > 0) {
    engagement_rate = Math.round((p.engagements / p.impressions) * 100 * 100) / 100;
    cpv = p.views > 0 ? Math.round((p.fee / p.views) * 1000) / 1000 : null;
    const emv = p.engagements * 0.4 + p.clicks * 1.5 + p.views * 0.01;
    roi = Math.round((emv / p.fee) * 10) / 10;
    soi = Math.min(98, Math.round((TIER_SOI[tier] ?? 60) + Math.min(8, engagement_rate * 2)));
  } else {
    soi = (TIER_SOI[tier] ?? 60) - 5;
  }

  const bioParts = [
    r["Content Pillar"],
    r["Bio / Fit Rationale"],
    r["Audience Skew"] ? `Audience: ${r["Audience Skew"]}` : null,
    `Tier: ${tier}`,
  ].filter(Boolean);

  return {
    name: String(r["Creator Name"] || "").trim(),
    handle: String(r["Primary Handle"] || "").trim(),
    country: String(r["Market"] || "").trim(),
    platform: String(r["Primary Platform"] || "").trim(),
    followers: Number(r["Followers (primary)"]) || null,
    bio: bioParts.join(" · "),
    brand,
    cluster,
    engagement_rate,
    roi,
    cpv,
    soi_score: soi,
    status: p ? "active" : "prospect",
    total_posts: p ? p.posts : null,
  };
}).filter((r) => r.name);

mkdirSync("public/seed", { recursive: true });
writeFileSync("public/seed/nestle-creators.json", JSON.stringify(rows));
const withPerf = rows.filter((r) => r.roi !== null).length;
console.log(`Wrote ${rows.length} creators (${withPerf} with performance metrics) to public/seed/nestle-creators.json`);
console.log("Sample:", JSON.stringify(rows[0], null, 1));
