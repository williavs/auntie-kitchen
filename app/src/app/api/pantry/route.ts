import { NextResponse } from "next/server";
import { addItem, addMany, removeItem, setItem, readPantry, key, LEVELS, BUY } from "@/lib/pantry";

// What the pantry holds, keyed like addMany matches: the haul proposal marks each line new / have / count change against it.
export async function GET() {
  const p = readPantry();
  const have: Record<string, { section: string; count?: number }> = {};
  for (const s of p.sections) if (s.name !== BUY) for (const i of s.items) have[key(i.name)] = { section: s.name, count: i.count };
  return NextResponse.json({ sections: p.sections.map(s => s.name).filter(s => s !== BUY), have });
}

export async function POST(req: Request) {
  const b = await req.json();
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
  if (b.action === "addMany") {
    if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 60 || !b.items.every((i: { section?: unknown; name?: unknown }) => typeof i.section === "string" && typeof i.name === "string" && i.name.length <= 120)) return bad("bad items");
    try { return NextResponse.json(addMany(b.items, String(b.note ?? "").slice(0, 200))); } catch (e) { return bad((e as Error).message); }
  }
  if (typeof b.section !== "string" || typeof b.item !== "string" || b.item.length > 120 || !b.item.trim()) return bad("bad input");
  try {
    if (b.action === "add") return NextResponse.json(addItem(b.section, b.item));
    if (b.action === "remove") return NextResponse.json(removeItem(b.section, b.item));
    if (b.action === "set") {
      if (typeof b.count === "number" && Number.isInteger(b.count)) return NextResponse.json(setItem(b.section, b.item, { count: b.count }));
      if (LEVELS.includes(b.level)) return NextResponse.json(setItem(b.section, b.item, { level: b.level }));
      return bad("set needs count or level");
    }
    return bad("bad action");
  } catch (e) { return bad((e as Error).message); }
}
