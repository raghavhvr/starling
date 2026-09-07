// Check the content-pillar distribution of "Review" (unassigned-brand) creators
// to see whether BEV/CNF clusters can be legitimately populated.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const src = "C:/Users/Raghavendra.Reddy/OneDrive - insidemedia.net/Desktop/L'Oreal/Lumnia/Lumina/Creators/Nestle_MENA_Creator_Roster_Sample.xlsx";
const wb = XLSX.readFile(src);
const roster = XLSX.utils.sheet_to_json(wb.Sheets["Creator Roster"]);

const review = roster.filter((r) => String(r["Brand Fit"]).trim() === "Review");
const pillars = {};
review.forEach((r) => {
  const p = String(r["Content Pillar"] || "(blank)").trim();
  pillars[p] = (pillars[p] || 0) + 1;
});
console.log("Review rows:", review.length);
console.log(JSON.stringify(pillars, null, 1));
