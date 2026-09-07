import { createContext, useContext, useState, ReactNode, useMemo } from "react";

const DIVISIONS = ["All", "CUL", "DAI", "BEV", "CNF"] as const;

const COUNTRIES = [
  "UAE", "KSA", "Egypt", "Morocco",
  "Jordan", "Lebanon", "Iraq",
  "Kuwait", "Qatar", "Bahrain", "Oman", "Yemen", "India",
] as const;

const BRANDS_BY_DIVISION: Record<string, string[]> = {
  All: ["Maggi", "NIDO", "S-26", "Nescafé", "Milo", "Nesquik", "KitKat", "Cerelac", "Nestlé Pure Life", "Carnation", "Aero"],
  CUL: ["Maggi", "Cerelac"],
  DAI: ["NIDO", "S-26", "Nesquik", "Carnation"],
  BEV: ["Nescafé", "Milo", "Nestlé Pure Life"],
  CNF: ["KitKat", "Aero"],
};

export type Division = (typeof DIVISIONS)[number];
export type Country = (typeof COUNTRIES)[number];

interface FilterState {
  division: Division;
  countries: Country[];
  brand: string;
  setDivision: (d: Division) => void;
  setCountries: (c: Country[]) => void;
  setBrand: (b: string) => void;
  availableBrands: string[];
  divisions: readonly string[];
  allCountries: readonly string[];
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [division, setDivision] = useState<Division>("All");
  const [countries, setCountries] = useState<Country[]>([]);
  const [brand, setBrand] = useState<string>("All");

  const availableBrands = useMemo(
    () => ["All", ...BRANDS_BY_DIVISION[division]],
    [division]
  );

  // Reset brand when division changes if current brand isn't in new list
  const handleDivisionChange = (d: Division) => {
    setDivision(d);
    if (!BRANDS_BY_DIVISION[d].includes(brand) && brand !== "All") {
      setBrand("All");
    }
  };

  return (
    <FilterContext.Provider
      value={{
        division,
        countries,
        brand,
        setDivision: handleDivisionChange,
        setCountries,
        setBrand,
        availableBrands,
        divisions: DIVISIONS,
        allCountries: COUNTRIES,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
