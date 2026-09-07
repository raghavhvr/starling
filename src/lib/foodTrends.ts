/**
 * Food-trend taxonomy and curated fallback set shared by the Home trending
 * section and the Campaign Flow trends step. The shared legacy `trends` table
 * only holds beauty rows, so both surfaces filter to these categories and fall
 * back to the curated list until Starling's own Reddit scraper populates real
 * food rows.
 */

/**
 * Categories used to filter the shared trends table. Deliberately excludes
 * "Ingredients" and "Technology" — the legacy beauty scraper used those same
 * category names, so beauty rows would leak through. Once Starling has its own
 * Supabase project, they can be added back.
 */
export const FOOD_TREND_CATEGORIES = [
  "Cooking",
  "Recipes",
  "Nutrition",
  "Beverages",
  "Snacking",
];

export const CURATED_FOOD_TRENDS = [
  {
    id: "curated-1",
    curated: true,
    title: "One-pot family iftars",
    category: "Cooking",
    relevance_score: 94,
    description: "Creators film single-pot Ramadan mains from prep to table — low effort, high comfort, built around stock and seasoning as the flavour hero.",
  },
  {
    id: "curated-2",
    curated: true,
    title: "Maggi hacks & elevated noodles",
    category: "Recipes",
    relevance_score: 91,
    description: "Upgraded instant-noodle builds — street-style toppings, cheese pulls, and fusion sauces — keep pulling massive Gen Z watch time across MENA and India.",
  },
  {
    id: "curated-3",
    curated: true,
    title: "Iced coffee at home",
    category: "Beverages",
    relevance_score: 88,
    description: "Spanish lattes, dalgona revivals, and 15-second home-barista clips make instant coffee the most remixed pantry item on TikTok.",
  },
  {
    id: "curated-4",
    curated: true,
    title: "High-protein school lunches",
    category: "Nutrition",
    relevance_score: 85,
    description: "Moms share lunchbox formulas built on milk, eggs, and fortified staples — nutrition claims are scrutinised in comments, authenticity wins.",
  },
  {
    id: "curated-5",
    curated: true,
    title: "Air-fryer Arabic snacks",
    category: "Snacking",
    relevance_score: 82,
    description: "Sambousek, kibbeh, and halloumi bites re-made in the air fryer — 'healthier heritage' framing performs across Gulf audiences.",
  },
  {
    id: "curated-6",
    curated: true,
    title: "Grandma's recipe, my way",
    category: "Recipes",
    relevance_score: 79,
    description: "Creators cook a family recipe alongside (or on a call with) the matriarch who taught them — the highest-comment format in food right now.",
  },
];
