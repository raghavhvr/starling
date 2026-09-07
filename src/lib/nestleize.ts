/**
 * Translation layer between the legacy (shared Lumina/L'Oréal) database and
 * Starling's Nestlé taxonomy. The shared Supabase project stores L'Oréal-era
 * cluster codes (CPD/LL/LLD/LDB/PPD) and beauty brand names, which must not be
 * rewritten in place. Until Starling gets its own Supabase project, map those
 * values to Nestlé equivalents at display time, and expand Nestlé filter values
 * back to their legacy codes when querying.
 *
 * Mapping is cluster-consistent: every legacy brand maps to a Nestlé brand that
 * belongs to the cluster its legacy cluster maps to.
 */

const CLUSTER_MAP: Record<string, string> = {
  CPD: "CUL",
  LL: "DAI",
  LLD: "DAI",
  LDB: "BEV",
  PPD: "CNF",
};

const BRAND_MAP: Record<string, string> = {
  // CPD → CUL
  "Maybelline": "Maggi",
  "L'Oréal Paris": "Maggi",
  "Garnier": "Cerelac",
  "NYX": "Cerelac",
  // LL/LLD → DAI
  "Lancôme": "NIDO",
  "YSL Beauty": "Nesquik",
  "YSL": "Nesquik",
  "Giorgio Armani": "Carnation",
  // LDB → BEV
  "La Roche-Posay": "Nescafé",
  "CeraVe": "Milo",
  "Vichy": "Nestlé Pure Life",
  // PPD → CNF
  "Kérastase": "KitKat",
  "Shu Uemura": "Aero",
  "Redken": "Aero",
  "Urban Decay": "KitKat",
};

/**
 * Native Nestlé cluster codes. Creators imported from the Nestlé roster carry
 * these; legacy Lumina creators carry CPD/LL/LLD/LDB/PPD or null. Filtering on
 * this set scopes the roster to Nestlé creators only.
 */
export const NESTLE_CLUSTERS = ["CUL", "DAI", "BEV", "CNF"];

/** Legacy cluster codes each Nestlé cluster should match when filtering. */
const LEGACY_CLUSTERS: Record<string, string[]> = {
  CUL: ["CUL", "CPD"],
  DAI: ["DAI", "LL", "LLD"],
  BEV: ["BEV", "LDB"],
  CNF: ["CNF", "PPD"],
};

export function displayCluster(value?: string | null): string {
  if (!value) return "";
  return CLUSTER_MAP[value] || value;
}

export function displayBrand(value?: string | null): string {
  if (!value) return "";
  return BRAND_MAP[value] || value;
}

export function legacyClusterValues(cluster: string): string[] {
  return LEGACY_CLUSTERS[cluster] || [cluster];
}

export function legacyBrandValues(brand: string): string[] {
  return [brand, ...Object.keys(BRAND_MAP).filter((k) => BRAND_MAP[k] === brand)];
}

/** Shallow-copy a row, translating its `cluster` and `brand` fields. */
export function nestleize<T extends { cluster?: string | null; brand?: string | null }>(row: T): T {
  return {
    ...row,
    cluster: row.cluster ? displayCluster(row.cluster) : row.cluster,
    brand: row.brand ? displayBrand(row.brand) : row.brand,
  };
}

export function nestleizeAll<T extends { cluster?: string | null; brand?: string | null }>(rows: T[]): T[] {
  return rows.map(nestleize);
}
