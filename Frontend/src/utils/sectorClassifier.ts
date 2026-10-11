import type { GraphNode } from "@/types/api.types"

export type SectorCategory =
  | "Energy and Commodities"
  | "Banking and Financial Services"
  | "Aviation and Transportation"
  | "Manufacturing"
  | "Technology"
  | "Consumer Goods"
  | "Macroeconomics and Interest Rates"
  | "Corporate & Diversified"

export interface SectorConfig {
  name: SectorCategory
  shortName: string
  color: string
  bgColor: string
  borderColor: string
  accentColor: string
}

export const SECTOR_CONFIGS: Record<SectorCategory, SectorConfig> = {
  "Energy and Commodities": {
    name: "Energy and Commodities",
    shortName: "Energy & Commodities",
    color: "#b45309", // Warm Amber
    bgColor: "rgba(254, 243, 199, 0.45)",
    borderColor: "#fde68a",
    accentColor: "#d97706",
  },
  "Banking and Financial Services": {
    name: "Banking and Financial Services",
    shortName: "Banking & Finance",
    color: "#1d4ed8", // Deep Blue
    bgColor: "rgba(219, 234, 254, 0.45)",
    borderColor: "#bfdbfe",
    accentColor: "#2563eb",
  },
  "Aviation and Transportation": {
    name: "Aviation and Transportation",
    shortName: "Aviation & Logistics",
    color: "#0369a1", // Ocean Sky
    bgColor: "rgba(224, 242, 254, 0.45)",
    borderColor: "#bae6fd",
    accentColor: "#0284c7",
  },
  "Manufacturing": {
    name: "Manufacturing",
    shortName: "Manufacturing",
    color: "#4d7c0f", // Olive Green
    bgColor: "rgba(236, 252, 203, 0.45)",
    borderColor: "#d9f99d",
    accentColor: "#65a30d",
  },
  "Technology": {
    name: "Technology",
    shortName: "Technology",
    color: "#4338ca", // Indigo
    bgColor: "rgba(224, 231, 255, 0.45)",
    borderColor: "#c7d2fe",
    accentColor: "#4f46e5",
  },
  "Consumer Goods": {
    name: "Consumer Goods",
    shortName: "Consumer Goods",
    color: "#be185d", // Magenta / Rose
    bgColor: "rgba(252, 231, 243, 0.45)",
    borderColor: "#fbcfe8",
    accentColor: "#db2777",
  },
  "Macroeconomics and Interest Rates": {
    name: "Macroeconomics and Interest Rates",
    shortName: "Macro & Rates",
    color: "#6d28d9", // Purple
    bgColor: "rgba(243, 232, 255, 0.45)",
    borderColor: "#e9d5ff",
    accentColor: "#7c3aed",
  },
  "Corporate & Diversified": {
    name: "Corporate & Diversified",
    shortName: "Corporate / General",
    color: "#334155", // Slate
    bgColor: "rgba(241, 245, 249, 0.45)",
    borderColor: "#e2e8f0",
    accentColor: "#475569",
  },
}

/**
 * Deterministically identify sector membership from actual node metadata.
 * Uses node category, label keywords, ticker, and description.
 */
export function classifyNodeSector(node: GraphNode): SectorCategory {
  const text = `${node.label} ${node.category} ${node.description || ""} ${node.ticker || ""}`.toLowerCase()

  // 1. Energy & Commodities
  if (
    text.includes("oil") ||
    text.includes("crude") ||
    text.includes("petroleum") ||
    text.includes("gas") ||
    text.includes("energy") ||
    text.includes("opec") ||
    text.includes("fuel") ||
    text.includes("coal") ||
    text.includes("refin") ||
    text.includes("xle") ||
    text.includes("cl=f") ||
    text.includes("djp") ||
    text.includes("commodity")
  ) {
    return "Energy and Commodities"
  }

  // 2. Aviation and Transportation
  if (
    text.includes("airline") ||
    text.includes("aviation") ||
    text.includes("flight") ||
    text.includes("freight") ||
    text.includes("cargo") ||
    text.includes("transport") ||
    text.includes("logistics") ||
    text.includes("shipping") ||
    text.includes("dal") ||
    text.includes("ual") ||
    text.includes("aal") ||
    text.includes("fedex") ||
    text.includes("ups")
  ) {
    return "Aviation and Transportation"
  }

  // 3. Banking & Financial Services
  if (
    text.includes("bank") ||
    text.includes("credit") ||
    text.includes("lending") ||
    text.includes("loan") ||
    text.includes("liquidity") ||
    text.includes("funding") ||
    text.includes("xlf") ||
    text.includes("jpm") ||
    text.includes("goldman") ||
    text.includes("financial") ||
    text.includes("insurance")
  ) {
    return "Banking and Financial Services"
  }

  // 4. Macroeconomics & Interest Rates
  if (
    text.includes("interest rate") ||
    text.includes("inflation") ||
    text.includes("yield") ||
    text.includes("treasury") ||
    text.includes("fed") ||
    text.includes("cpi") ||
    text.includes("macro") ||
    text.includes("bond") ||
    text.includes("central bank") ||
    text.includes("monetary") ||
    text.includes("real estate") ||
    text.includes("xlre") ||
    text.includes("spy") ||
    text.includes("market index")
  ) {
    return "Macroeconomics and Interest Rates"
  }

  // 5. Technology
  if (
    text.includes("tech") ||
    text.includes("semiconductor") ||
    text.includes("software") ||
    text.includes("hardware") ||
    text.includes("cloud") ||
    text.includes("chip") ||
    text.includes("xlk") ||
    text.includes("apple") ||
    text.includes("microsoft") ||
    text.includes("nvidia")
  ) {
    return "Technology"
  }

  // 6. Manufacturing
  if (
    text.includes("manufacturing") ||
    text.includes("factory") ||
    text.includes("industrial") ||
    text.includes("automotive") ||
    text.includes("vehicle") ||
    text.includes("steel") ||
    text.includes("chemicals") ||
    text.includes("xli")
  ) {
    return "Manufacturing"
  }

  // 7. Consumer Goods
  if (
    text.includes("consumer") ||
    text.includes("retail") ||
    text.includes("staples") ||
    text.includes("grocer") ||
    text.includes("food") ||
    text.includes("beverage") ||
    text.includes("xly") ||
    text.includes("xlp")
  ) {
    return "Consumer Goods"
  }

  // Fallback by explicit category if available
  const cat = node.category.toLowerCase()
  if (cat.includes("commodity")) return "Energy and Commodities"
  if (cat.includes("macro")) return "Macroeconomics and Interest Rates"
  if (cat.includes("sector")) return "Corporate & Diversified"

  return "Corporate & Diversified"
}
