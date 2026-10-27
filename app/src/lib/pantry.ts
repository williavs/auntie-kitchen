import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./content";

// pantry.md is the source of truth. Shape: a header (anything before the first "## "), then "## Section"
// blocks of "- name [3]" (count, Fresh section) or "- name [running out]" (level, staples) lines.
// Edits rewrite the file, commit, and push so auntie's checkout can pull.
// ponytail: single household, no lock; add one if two people race.

export { LEVELS, BUY, COUNTED, key } from "./pantry-types";
import { key } from "./pantry-types";
export type { Level, Item, Section, Pantry } from "./pantry-types";
import { LEVELS, BUY, COUNTED, type Level, type Item, type Section, type Pantry } from "./pantry-types";
const FILE = () => path.join(ROOT, "pantry.md");

function parseItem(s: string): Item {
  const m = s.match(/^(.*?)\s*\[([^\]]+)\]$/);
  if (!m) return { name: s.trim() };
  const tag = m[2].trim().toLowerCase();
  if (/^\d+$/.test(tag)) return { name: m[1].trim(), count: Number(tag) };
  if ((LEVELS as readonly string[]).includes(tag)) return { name: m[1].trim(), level: tag as Level };
  return { name: s.trim() };
}
const fmt = (i: Item) => `- ${i.name}${i.count !== undefined ? ` [${i.count}]` : i.level ? ` [${i.level}]` : ""}`;

export function readPantry(): Pantry {
  const lines = fs.readFileSync(FILE(), "utf8").split("\n");
  const header: string[] = []; const sections: Section[] = [];
  for (const l of lines) {
    if (l.startsWith("## ")) sections.push({ name: l.slice(3).replace(/\s*\(.*\)\s*$/, "").trim(), items: [] });
    else if (sections.length === 0) header.push(l);
    else if (l.startsWith("- ")) sections.at(-1)!.items.push(parseItem(l.slice(2)));
  }
  return { header: header.join("\n").trimEnd(), sections };
}

function write(p: Pantry, msg: string) {
  const body = p.sections.map(s => `## ${s.name}\n${s.items.map(fmt).join("\n")}`).join("\n\n");
  fs.writeFileSync(FILE(), `${p.header}\n\n${body}\n`);
  const git = (...a: string[]) => execFileSync("git", ["-C", ROOT, ...a], { stdio: "pipe" });
  git("add", "pantry.md"); git("commit", "-qm", `pantry: ${msg}`);
  if (process.env.AUNTIE_PUSH) git("push", "-q", "origin", "HEAD:master");
}

function section(p: Pantry, name: string) {
  let s = p.sections.find(x => x.name === name);
  if (!s) { s = { name, items: [] }; const b = p.sections.findIndex(x => x.name === BUY); p.sections.splice(b < 0 ? p.sections.length : b, 0, s); }
  return s;
}
const clearBuy = (p: Pantry, name: string) => { for (const b of p.sections.filter(x => x.name === BUY)) b.items = b.items.filter(i => key(i.name) !== key(name)); };

/** "4 lemons" or "lemons 4" → {name: "lemons", count: 4} (only meaningful in the counted section). */
export function parseInput(text: string, sec: string): Item {
  const t = text.trim();
  const lead = t.match(/^(\d+)\s+(.+)$/), trail = t.match(/^(.+?)\s+(\d+)$/);
  if (sec === COUNTED && lead) return { name: lead[2], count: Number(lead[1]) };
  if (sec === COUNTED && trail) return { name: trail[1], count: Number(trail[2]) };
  return { name: t };
}

export function addItem(sec: string, text: string) {
  const p = readPantry(); const it = parseInput(text, sec); if (!it.name) throw new Error("empty item");
  const s = section(p, sec); const ex = s.items.find(i => key(i.name) === key(it.name));
  if (ex) { if (it.count !== undefined) ex.count = it.count; } else s.items.push(it);
  if (sec !== BUY) clearBuy(p, it.name);
  write(p, `add ${it.name} (${sec})`); return p;
}

export function removeItem(sec: string, name: string) {
  const p = readPantry(); const s = p.sections.find(x => x.name === sec); if (!s) throw new Error(`no section ${sec}`);
  s.items = s.items.filter(i => i.name !== name);
  write(p, `remove ${name} (${sec})`); return p;
}

export function setItem(sec: string, name: string, patch: { count?: number; level?: Level }) {
  const p = readPantry(); const s = p.sections.find(x => x.name === sec); const it = s?.items.find(i => i.name === name);
  if (!s || !it) throw new Error(`no ${name} in ${sec}`);
  if (patch.count !== undefined) {
    if (patch.count <= 0) { s.items = s.items.filter(i => i !== it); section(p, BUY).items.push({ name: it.name }); write(p, `out of ${name} → ${BUY}`); return p; }
    it.count = patch.count; delete it.level;
  }
  if (patch.level) { it.level = patch.level; delete it.count; }
  write(p, `${name}: ${patch.count ?? patch.level}`); return p;
}

/** One commit for a whole photo haul. Counted items replace the count (a haul is what is on the counter now). */
export function addMany(items: { section: string; name: string; count?: number | null }[], note: string) {
  const p = readPantry();
  for (const { section: sec, name, count } of items) {
    if (!name.trim()) continue;
    const s = section(p, sec); const ex = s.items.find(i => key(i.name) === key(name));
    const it: Item = { name: name.trim(), ...(sec === COUNTED && count ? { count } : {}) };
    if (ex) { if (it.count !== undefined) { ex.count = it.count; delete ex.level; } } else s.items.push(it);
    if (sec !== BUY) clearBuy(p, name);
  }
  write(p, `haul: ${items.length} items (${note})`); return p;
}
