import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recipes } from "@/lib/content";
import { readPantry, BUY } from "@/lib/pantry";
import type { Job } from "@/app/api/haul/route";

// One call for the door tablet's kitchen tile: latest cook sheet, what to buy, what is low, hauls waiting for review.
// review counts finished jobs on disk (the haul route saves each one there); ponytail: no shared module, the file is the queue.
const JOBS = path.join(process.env.AUNTIE_STATE ?? path.join(os.homedir(), ".local/state/auntie"), "hauls/jobs");
export const dynamic = "force-dynamic";

export async function GET() {
  const p = readPantry();
  const names = (f: (i: { level?: string }) => boolean) => p.sections.flatMap(s => s.name === BUY ? [] : s.items.filter(f).map(i => i.name));
  const r = recipes()[0];
  const review = fs.existsSync(JOBS) ? fs.readdirSync(JOBS).reduce((n, f) => n + ((JSON.parse(fs.readFileSync(path.join(JOBS, f), "utf8")) as Job).items?.length ?? 0), 0) : 0;
  return NextResponse.json({
    recipe: r ? { slug: r.slug, title: r.title, region: r.region, date: r.date } : null,
    buy: p.sections.find(s => s.name === BUY)?.items.map(i => i.name) ?? [],
    low: names(i => i.level === "running out" || i.level === "need more"),
    review,
  });
}
