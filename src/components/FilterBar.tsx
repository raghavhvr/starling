import { useFilters, type Country } from "@/contexts/FilterContext";
import { GLOSSARY } from "@/lib/glossary";
import { ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export function FilterBar() {
  const {
    division,
    countries,
    brand,
    setDivision,
    setCountries,
    setBrand,
    availableBrands,
    divisions,
    allCountries,
  } = useFilters();

  const toggleCountry = (c: Country) => {
    setCountries(
      countries.includes(c) ? countries.filter((x) => x !== c) : [...countries, c]
    );
  };

  return (
    <div className="h-10 flex items-center gap-3 px-6 border-b border-border bg-background/60 backdrop-blur-sm shrink-0">
      <span
        title="Global filters — every page scopes its data to the selected cluster, markets and brand"
        className="font-data text-[9px] text-muted-foreground tracking-[0.2em] mr-1"
      >
        FILTERS
      </span>

      {/* Division selector */}
      <div className="flex items-center gap-1">
        {divisions.map((d) => (
          <button
            key={d}
            title={GLOSSARY[d] || "All clusters — no cluster filter applied"}
            onClick={() => setDivision(d as typeof division)}
            className={`font-data text-[10px] tracking-wider px-2.5 py-1 transition-colors ${
              division === d
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Country multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            title="Filter by market — multi-select across the priority hubs and wider MENA + India"
            className="flex items-center gap-1.5 font-data text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1 hover:bg-surface-2"
          >
            {countries.length === 0
              ? "ALL MARKETS"
              : `${countries.length} MARKET${countries.length > 1 ? "S" : ""}`}
            <ChevronDown className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-card border-border" align="start">
          <div className="space-y-1">
            <button
              onClick={() => setCountries([])}
              className="w-full text-left font-data text-[10px] tracking-wider px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              Clear all
            </button>
            {allCountries.map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={countries.includes(c as Country)}
                  onCheckedChange={() => toggleCountry(c as Country)}
                  className="w-3.5 h-3.5"
                />
                <span className="font-data text-[10px] tracking-wider text-foreground">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-5 bg-border" />

      {/* Brand selector */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            title="Filter by Nestlé brand — the list follows the selected cluster"
            className="flex items-center gap-1.5 font-data text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1 hover:bg-surface-2"
          >
            {brand === "All" ? "ALL BRANDS" : brand.toUpperCase()}
            <ChevronDown className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 bg-card border-border" align="start">
          {availableBrands.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={`w-full text-left font-data text-[10px] tracking-wider px-3 py-1.5 transition-colors ${
                brand === b
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
              }`}
            >
              {b.toUpperCase()}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {(division !== "All" || countries.length > 0 || brand !== "All") && (
        <>
          <div className="w-px h-5 bg-border" />
          <button
            onClick={() => {
              setDivision("All");
              setCountries([]);
              setBrand("All");
            }}
            className="flex items-center gap-1 font-data text-[9px] tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            RESET
          </button>
        </>
      )}
    </div>
  );
}
