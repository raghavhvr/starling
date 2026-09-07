import { describe, expect, it } from "vitest";
import { applyMapping, autoMapColumns, normalizePlatform, platformFromProfileLink } from "./creatorScoring";

describe("creator upload platform parsing", () => {
  it("prefers Platform (Search), normalizes casing, and keeps Snapchat rows out of dirty legacy Platform", () => {
    const headers = ["Name", "Profile Link", "Country ", "Platform", "Platform (Search)", "Type of Profile \n"];
    const mapping = autoMapColumns(headers);
    const rows = [
      ...Array.from({ length: 52 }, (_, i) => ({ Name: `tt${i}`, "Profile Link": "TT", "Country ": "KSA ", Platform: i % 2 ? "tiktok" : "Tiktok", "Platform (Search)": " TikTok ", "Type of Profile \n": "Beauty " })),
      ...Array.from({ length: 36 }, (_, i) => ({ Name: `ig${i}`, "Profile Link": "IG", "Country ": "UAE", Platform: i % 2 ? "instagram" : "Instagram", "Platform (Search)": "Instagram", "Type of Profile \n": "Lifestyle" })),
      ...Array.from({ length: 17 }, (_, i) => ({ Name: [`niaameoun`, `alaabalkhy`, `danaalamri`, `noraalshaikh`][i] || `sc${i}`, "Profile Link": "SC", "Country ": "KSA", Platform: "Instagram", "Platform (Search)": "Snapchat", "Type of Profile \n": "Beauty" })),
    ];

    const mapped = applyMapping(rows, mapping);
    const counts = mapped.reduce<Record<string, number>>((acc, row) => {
      acc[row.platform] = (acc[row.platform] || 0) + 1;
      return acc;
    }, {});

    expect(mapping.platform).toBe("Platform (Search)");
    expect(mapped).toHaveLength(105);
    expect(counts).toEqual({ TikTok: 52, Instagram: 36, Snapchat: 17 });
    expect(mapped.filter(row => row.platform === "Snapchat").map(row => row.name)).toEqual(expect.arrayContaining(["niaameoun", "alaabalkhy", "danaalamri", "noraalshaikh"]));
  });

  it("falls back to Profile Link codes when Platform (Search) is empty", () => {
    expect(normalizePlatform("TIKTOK")).toBe("TikTok");
    expect(platformFromProfileLink("SC")).toBe("Snapchat");
    expect(platformFromProfileLink("TT")).toBe("TikTok");
    expect(platformFromProfileLink("IG")).toBe("Instagram");
  });
});