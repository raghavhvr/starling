/**
 * Central glossary — hover explanations for metrics, short forms and areas.
 * Used as native `title` tooltips across the platform.
 */

export const GLOSSARY: Record<string, string> = {
  // Metrics
  SOI: "Share of Influence — Starling's 0–100 influence score per creator, built from tier and engagement. Roster-level SOI is weighted by audience reach.",
  ER: "Engagement Rate — engagements (likes, comments, shares) ÷ impressions.",
  ROI: "Return on Investment — earned media value (engagements, clicks and views at standard rates) ÷ creator fee.",
  CPV: "Cost Per View — media fee ÷ video views.",
  CPM: "Cost Per Mille — fee per 1,000 impressions.",
  REACH: "Combined audience size — sum of follower counts.",
  INVESTMENT: "Committed campaign budgets across the portfolio (planned + active + completed).",

  // Clusters
  CUL: "Culinary cluster — Maggi, Cerelac.",
  DAI: "Dairy & Nutrition cluster — NIDO, S-26, Nesquik, Carnation.",
  BEV: "Beverages cluster — Nescafé, Milo, Nestlé Pure Life.",
  CNF: "Confectionery cluster — KitKat, Aero.",

  // Tiers (Nestlé follower bands)
  TIER: "Creator tier by follower count: VIP >7M · Top 1–7M · Macro 250K–1M · Mid 100K–250K · Micro 15K–100K · Nano <15K. Campaigns cap at three tiers.",

  // Measurement
  BHT: "Brand Health Tracker — Nestlé's brand KPI source (awareness, trial, Brand Power).",
  GOVERNANCE: "Picture of Success operating targets — approval, hygiene, compliance, delivery, budget and platform adoption.",
  CREATIVE_SCALE: "Nestlé Creative Scale — content quality rating from Wasteful to Legendary.",

  // Statuses
  STATUS_ACTIVE: "Campaign currently in flight.",
  STATUS_PLANNED: "Brief saved and scheduled — not yet launched.",
  STATUS_COMPLETED: "Flight finished — final results and learnings recorded.",
};

/** Convenience lookups used as title attributes. */
export const HINTS = {
  trackedCreators: "Creators in the Starling roster matching the current filters.",
  shareOfInfluence: GLOSSARY.SOI,
  totalInvestment: GLOSSARY.INVESTMENT,
  avgSoi: "Average per-creator SOI score (unweighted) — the typical creator's influence score. " + GLOSSARY.SOI,
  avgCpv: GLOSSARY.CPV,
  activeCampaigns: GLOSSARY.STATUS_ACTIVE,
  topPerformers: "The roster's best measured creators, ranked by ROI (earned media value ÷ fee).",
  campaignsTab: "All campaigns — active, planned and completed.",
  brandInsights: "Per-brand rollup: creators, engagement, ROI and campaigns for each Nestlé brand.",
  watchList: "High-influence creators (SOI ≥ 75) not yet among the top performers — activation candidates.",
  engagementRate: GLOSSARY.ER,
  roi: GLOSSARY.ROI,
  followers: "Audience size on the creator's primary platform.",
  clusters: "Nestlé category clusters: CUL Culinary · DAI Dairy & Nutrition · BEV Beverages · CNF Confectionery.",
  brands: "Focus brands for this platform.",
  tier: GLOSSARY.TIER,
  priorityHubs: "Nestlé MENA priority markets: UAE, Saudi Arabia, Egypt, Morocco and one Levant hub (Jordan / Lebanon / Iraq).",
  paidMedia: "Committed campaign budgets and spend to date.",
  organic: "Engagement on tracked organic creator posts.",
  commerce: "Retail media & D2C — connects when a commerce data source is linked.",
  onTime: "Of deliverables already due, the share delivered (approved or submitted). Picture of Success target ≥ 95%.",
  approvalRate: "Approved share of reviewed deliverables — first-time-approval proxy. Picture of Success target ≥ 90%.",
  budgetVariance: "How far final spend landed from plan on completed campaigns: |1 − spent ÷ budget|. Picture of Success target ≤ 2%.",
  timeline: "Days elapsed of the campaign flight.",
  deliverables: "Delivered vs total contracted deliverables.",
  budget: "Spend to date against committed budget.",
  activities: "Logged campaign events — notes, deliveries, metric updates and changes.",
  business: "Business KPI layer — commercial outcomes (share, penetration). Source: Nielsen / retail panel.",
  brandLayer: "Brand KPI layer — awareness, trial, Brand Power. Source: Brand Health Tracker (BHT).",
  media: "Media KPI layer — engagement, SOV, completion. Source: platform analytics & social listening.",
  governance: GLOSSARY.GOVERNANCE,
  creativeTarget: GLOSSARY.CREATIVE_SCALE,
};
