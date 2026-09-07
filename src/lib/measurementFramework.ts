/**
 * Nestlé measurement framework — one spine, three tunings.
 *
 * Every brief uses the same four layers: Business / Brand / Media (Nestlé's ICB
 * KPI structure) plus Governance (from Picture of Success). Brand KPIs source
 * from the Brand Health Tracker (BHT); Business KPIs from Nielsen / retail
 * panel. Attribution is designed in at brief stage: geo or cell holdouts, and
 * content tagging by flavour, market, tier and territory so the Media layer can
 * be diagnosed. Creator content is scored on the Nestlé Creative Scale
 * (Wasteful → Legendary).
 */

export interface Kpi {
  kpi: string;
  target?: string;
  source?: string;
  proposed?: boolean;
}

export interface FrameworkLayer {
  layer: "Business" | "Brand" | "Media" | "Governance";
  kpis: Kpi[];
}

export interface MeasurementFramework {
  creativeTarget: string;
  creativeTargetNote?: string;
  attribution: string;
  layers: FrameworkLayer[];
}

/** Picture of Success governance KPIs — identical spine across every brief. */
export const GOVERNANCE_KPIS: Kpi[] = [
  { kpi: "First-time approval rate", target: "≥ 90%", source: "Workflow" },
  { kpi: "Creative hygiene", target: "100%", source: "QA checklist" },
  { kpi: "Creator compliance (disclosure & contract)", target: "100%", source: "Workflow" },
  { kpi: "On-time delivery", target: "≥ 95%", source: "Deliverables tracker" },
  { kpi: "Budget variance", target: "≤ 2%", source: "Finance reconciliation" },
  { kpi: "CreatorIQ adoption", target: "100%", source: "Platform audit" },
];

const ATTRIBUTION_DEFAULT =
  "Geo / cell holdout designed at brief stage. BHT feeds Brand KPIs; Nielsen / retail panel feeds Business KPIs — neither isolates creator contribution alone. Content tagged at brief stage by flavour, market, tier and territory for Media-layer diagnostics.";

const FRAMEWORKS: { match: RegExp; framework: MeasurementFramework }[] = [
  {
    // Brief 1 — S-26 Gold KIDS (Magnetic Tiles) · credibility & governance in a regulated category
    match: /s-?26/i,
    framework: {
      creativeTarget: "Distinctive+",
      creativeTargetNote: "Nestlé Creative Scale (Wasteful → Legendary)",
      attribution:
        "Geo holdout across KSA/UAE vs KWT/QAT cells. BHT feeds Brand KPIs; Nielsen GUM panel feeds Business KPIs. HCP vs mother creator content tagged separately for credibility diagnostics.",
      layers: [
        {
          layer: "Business",
          kpis: [{ kpi: "GUM market share", target: "+100 bps by end 2027", source: "Nielsen / retail panel" }],
        },
        {
          layer: "Brand",
          kpis: [
            { kpi: "Trial", target: "+5% vs end-2025 report", source: "BHT" },
            { kpi: "Brand Power vs Similac", target: "At par — KSA & UAE", source: "BHT" },
            { kpi: "Sentiment among mothers", target: "Positive trend", source: "BHT / social listening" },
          ],
        },
        {
          layer: "Media",
          kpis: [
            { kpi: "Share of voice vs competition", target: "Top 3", source: "Social listening" },
            { kpi: "HCP vs mother creator credibility split", target: "Tracked per flight", source: "Content tagging" },
          ],
        },
        {
          layer: "Governance",
          kpis: [
            ...GOVERNANCE_KPIS,
            { kpi: "Claims compliance (regulated category)", target: "100%", source: "Legal / regulatory review" },
            { kpi: "WHO Code incident rate", target: "0", source: "Compliance log" },
          ],
        },
      ],
    },
  },
  {
    // Brief 2 — MAGGI World Cuisine · Gen Z cultural relevance
    match: /world cuisine/i,
    framework: {
      creativeTarget: "Distinctive",
      creativeTargetNote: "Nestlé Creative Scale (Wasteful → Legendary)",
      attribution: ATTRIBUTION_DEFAULT,
      layers: [
        {
          layer: "Business",
          kpis: [{ kpi: "Value-up noodles position", target: "Key player · share gain", source: "Nielsen / retail panel" }],
        },
        {
          layer: "Brand",
          kpis: [
            { kpi: "World Cuisine awareness", target: "Uplift vs baseline", source: "BHT" },
            { kpi: "World Cuisine trial", target: "Uplift vs baseline", source: "BHT" },
          ],
        },
        {
          layer: "Media",
          kpis: [
            { kpi: "Engagement & virality (shares, saves)", target: "vs creator's own benchmark", source: "Platform analytics" },
            { kpi: "Earned-to-paid ratio", target: "Tracked per flight", source: "Media reporting" },
            { kpi: "Occasion coverage", target: "All briefed occasions", source: "Content tagging" },
          ],
        },
        { layer: "Governance", kpis: GOVERNANCE_KPIS },
      ],
    },
  },
  {
    // Brief 3 — NIDO Al Assassy, Egypt · operational delivery; soft KPIs turned into numbers
    match: /assas+y|el assasy|al assassy/i,
    framework: {
      creativeTarget: "Distinctive",
      creativeTargetNote: "Proposed — not stated in brief · Nestlé Creative Scale (Wasteful → Legendary)",
      attribution:
        "City-level holdout within Egypt. Brand-lift study carries 'iron' message recall; retail panel proposed for penetration. Audience-quality verification (lower B/C SEC reach) over follower counts.",
      layers: [
        {
          layer: "Business",
          kpis: [
            { kpi: "Household penetration — lower B/C SEC", target: "+150 bps (proposed)", source: "Retail panel", proposed: true },
            { kpi: "Share vs loose milk", target: "Switching gain (proposed)", source: "Retail panel", proposed: true },
          ],
        },
        {
          layer: "Brand",
          kpis: [
            { kpi: "Awareness of iron fortification importance", target: "Uplift vs baseline", source: "BHT / brand lift" },
            { kpi: "'Iron' message recall", target: "Measured in brand lift", source: "Brand lift study" },
            { kpi: "NIDO Al Assassy = the affordable fortified milk", target: "Association uplift", source: "BHT" },
          ],
        },
        {
          layer: "Media",
          kpis: [
            { kpi: "Video completion rate", target: "≥ 35%", source: "Platform analytics" },
            { kpi: "Positive mother comments", target: "≥ 80% of classified sentiment", source: "Comment classification" },
            { kpi: "Reach into lower B/C SEC", target: "Audience quality, not follower count", source: "Audience verification" },
          ],
        },
        {
          layer: "Governance",
          kpis: [
            ...GOVERNANCE_KPIS,
            { kpi: "Payment timeliness (Egypt creators)", target: "100% on terms", source: "Finance" },
            { kpi: "WHT compliance", target: "100%", source: "Finance / tax" },
          ],
        },
      ],
    },
  },
];

/** Generic fallback so every campaign carries the same four-layer spine. */
function defaultFramework(brand?: string | null): MeasurementFramework {
  return {
    creativeTarget: "Distinctive",
    creativeTargetNote: "Nestlé Creative Scale (Wasteful → Legendary)",
    attribution: ATTRIBUTION_DEFAULT,
    layers: [
      { layer: "Business", kpis: [{ kpi: `${brand || "Brand"} share / penetration movement`, target: "Set at brief stage", source: "Nielsen / retail panel" }] },
      {
        layer: "Brand",
        kpis: [
          { kpi: "Awareness & trial uplift", target: "vs BHT baseline", source: "BHT" },
          { kpi: "Brand Power movement", target: "vs BHT baseline", source: "BHT" },
        ],
      },
      {
        layer: "Media",
        kpis: [
          { kpi: "Engagement rate", target: "vs creator's own benchmark", source: "Platform analytics" },
          { kpi: "Share of voice", target: "vs competitive set", source: "Social listening" },
        ],
      },
      { layer: "Governance", kpis: GOVERNANCE_KPIS },
    ],
  };
}

export function getFramework(campaignName?: string | null, brand?: string | null): MeasurementFramework {
  const name = campaignName || "";
  const hit = FRAMEWORKS.find((f) => f.match.test(name));
  return hit ? hit.framework : defaultFramework(brand);
}

/**
 * Creator tiers (follower bands per Nestlé's definitions; campaigns cap at
 * three tiers). Platform labels: VIP, Top, Macro, Mid, Micro, Nano — these map
 * one-to-one onto Nestlé's submission labels (VIP→Celebrities, Top→Mega,
 * Macro→Large, Mid→Medium, Micro→Micro, Nano→Nano) if ever needed in documents.
 */
export const NESTLE_TIERS = [
  { label: "VIP", min: 7_000_000, max: Infinity, range: "> 7M" },
  { label: "Top", min: 1_000_000, max: 7_000_000, range: "1M – 7M" },
  { label: "Macro", min: 250_000, max: 1_000_000, range: "250K – 1M" },
  { label: "Mid", min: 100_000, max: 250_000, range: "100K – 250K" },
  { label: "Micro", min: 15_000, max: 100_000, range: "15K – 100K" },
  { label: "Nano", min: 0, max: 15_000, range: "< 15K" },
];
