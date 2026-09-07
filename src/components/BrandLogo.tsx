import maggiLogo from "@/assets/maggi-logo.webp";
import nidoLogo from "@/assets/nido-logo.webp";

const BRAND_LOGOS: Record<string, string> = {
  "Maggi": maggiLogo,
  "NIDO": nidoLogo,
};

interface BrandLogoProps {
  brand?: string | null;
  /** Height class for the logo image (default h-6) */
  className?: string;
}

/**
 * Official brand logo where we have the asset, otherwise a Nestlé-yellow text
 * chip fallback so every brand renders consistently.
 */
export function BrandLogo({ brand, className = "h-6" }: BrandLogoProps) {
  if (!brand) return null;
  const logo = BRAND_LOGOS[brand];
  if (logo) {
    return <img src={logo} alt={brand} className={`${className} w-auto object-contain inline-block`} />;
  }
  return (
    <span className="px-2.5 h-6 rounded-full bg-[#FFDD00] text-[#D0021B] text-[10px] font-ui font-bold inline-flex items-center">
      {brand}
    </span>
  );
}

export function hasBrandLogo(brand?: string | null): boolean {
  return Boolean(brand && BRAND_LOGOS[brand]);
}
