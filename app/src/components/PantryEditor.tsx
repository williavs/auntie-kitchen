"use client";
import { useEffect, useRef, useState } from "react";
import { BUY, COUNTED, LEVELS, type Item, type Level, type Pantry } from "@/lib/pantry-types";

type Body = { action: "add" | "remove" | "set"; section: string; item: string; count?: number; level?: Level };
const next = (l?: Level): Level => LEVELS[(l ? LEVELS.indexOf(l) + 1 : 0) % LEVELS.length];

export default function PantryEditor({ initial }: { initial: Pantry }) {
  const [p, setP] = useState(initial);
  const [section, setSection] = useState(initial.sections[0]?.name ?? COUNTED);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ section: string; item: string; label: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { try { const s = localStorage.getItem("pantry.section"); if (s && p.sections.some(x => x.name === s)) setSection(s); } catch {} }, []);
  const pick = (s: string) => { setSection(s); try { localStorage.setItem("pantry.section", s); } catch {} input.current?.focus(); };

  async function call(b: Body) {
    setBusy(true);
    const r = await fetch("/api/pantry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    setBusy(false);
    if (!r.ok) { alert("Could not save. Tell auntie."); return false; }
    setP(await r.json()); return true;
  }
  const toast = (section: string, item: string, label: string) => { setUndo({ section, item, label }); clearTimeout(undoTimer.current); undoTimer.current = setTimeout(() => setUndo(null), 6000); };
  async function add() { const t = text.trim(); if (!t || busy) return; if (await call({ action: "add", section, item: t })) { setText(""); input.current?.focus(); } }
  async function remove(sec: string, it: Item) { if (await call({ action: "remove", section: sec, item: it.name })) toast(sec, it.name, `Removed ${it.name}`); }
  async function count(sec: string, it: Item, n: number) {
    if (await call({ action: "set", section: sec, item: it.name, count: n }) && n <= 0) toast(sec, it.name, `Out of ${it.name}, moved to Buy next`);
  }
  const needMore = p.sections.filter(s => s.name !== BUY).flatMap(s => s.items.filter(i => i.level === "need more").map(i => ({ ...i, from: s.name })));

  return (
    <div className="prose">
      <h1>Pantry</h1>
      <form onSubmit={e => { e.preventDefault(); add(); }} className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3" style={{ background: "var(--bg)" }}>
        <label htmlFor="add" className="block text-base font-bold mb-1">Add to {section}</label>
        <div className="flex gap-2">
          <input id="add" ref={input} value={text} onChange={e => setText(e.target.value)} autoComplete="off" enterKeyHint="done" disabled={busy}
            placeholder={section === COUNTED ? "e.g. 4 lemons" : "e.g. hing"}
            className="flex-1 min-h-[52px] px-3 rounded-xl border-2 bg-transparent" style={{ borderColor: "var(--rule)" }} />
          <button type="submit" disabled={busy || !text.trim()} className="btn min-w-[72px]">{busy ? "…" : "Add"}</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {p.sections.map(s => <button key={s.name} type="button" onClick={() => pick(s.name)} aria-pressed={s.name === section} className="chip">{s.name}</button>)}
        </div>
      </form>

      {p.sections.map(s => (
        <section key={s.name}>
          <h2>{s.name}</h2>
          {s.items.length === 0 && (s.name !== BUY || needMore.length === 0) && <p style={{ color: "var(--muted)" }}>Nothing here.</p>}
          <ul className="!list-none !p-0">
            {s.items.map(it => (
              <li key={it.name} className="flex items-center gap-2 !mb-0 border-b" style={{ borderColor: "var(--rule)" }}>
                <span className="flex-1 py-2">{it.name}</span>
                {s.name === COUNTED && (
                  <span className="flex items-center gap-1">
                    <button type="button" className="x" aria-label={`One less ${it.name}`} disabled={busy || it.count === undefined} onClick={() => count(s.name, it, (it.count ?? 1) - 1)}>−</button>
                    <span className="min-w-[2ch] text-center font-bold tabular-nums" aria-live="polite">{it.count ?? "–"}</span>
                    <button type="button" className="x" aria-label={`One more ${it.name}`} disabled={busy} onClick={() => count(s.name, it, (it.count ?? 0) + 1)}>+</button>
                  </span>
                )}
                {s.name !== COUNTED && s.name !== BUY && (
                  <button type="button" className="lvl" data-level={it.level ?? ""} disabled={busy} aria-label={`${it.name}: ${it.level ?? "no level"}. Tap to change`}
                    onClick={() => call({ action: "set", section: s.name, item: it.name, level: next(it.level) })}>{it.level ?? "level?"}</button>
                )}
                <button type="button" onClick={() => remove(s.name, it)} aria-label={`Remove ${it.name}`} className="x" disabled={busy}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
                </button>
              </li>
            ))}
            {s.name === BUY && needMore.map(it => (
              <li key={`nm-${it.from}-${it.name}`} className="flex items-center gap-2 !mb-0 border-b" style={{ borderColor: "var(--rule)" }}>
                <span className="flex-1 py-2">{it.name} <span className="text-base" style={{ color: "var(--muted)" }}>need more · {it.from}</span></span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {undo && (
        <div role="status" className="fixed left-4 right-4 bottom-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg" style={{ background: "var(--fg)", color: "var(--bg)" }}>
          <span className="flex-1">{undo.label}</span>
          <button type="button" className="btn" onClick={async () => { const u = undo; setUndo(null); await call({ action: "add", section: u.section, item: u.item }); }}>Undo</button>
        </div>
      )}
    </div>
  );
}
