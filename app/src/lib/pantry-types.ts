export const LEVELS = ["fresh", "stale", "running out", "need more"] as const;
export type Level = typeof LEVELS[number];
export type Item = { name: string; count?: number; level?: Level };
export type Section = { name: string; items: Item[] };
export type Pantry = { header: string; sections: Section[] };
export const BUY = "Buy next";
export const COUNTED = "Fresh";
// ponytail: "tomato" and "tomatoes" are one line; strip a plural s/es, good enough for a kitchen.
export const key = (n: string) => n.toLowerCase().split(" (")[0].trim().replace(/(?<=[oxs]|ch|sh)es$/, "").replace(/s$/, "");
