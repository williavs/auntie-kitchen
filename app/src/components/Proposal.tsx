"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTED, key } from "@/lib/pantry-types";
import type { Job } from "@/app/api/haul/route";

// Human in the loop, app-wide: mounted in the layout, polls the haul jobs, and when a scan finishes pops a native <dialog>
// with auntie's proposal. Willy fixes it and taps Add, or Not now (the Haul page can reopen it). Nothing reaches pantry.md otherwise.
type Row = { id: number; on: boolean; name: string; count: number | null; section: string };
type Have = Record<string, { section: string; count?: number }>;
export const REVIEW = "haul-review"; // window event: the Haul page's Review button

export default function Proposal() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pantry, setPantry] = useState<{ sections: string[]; have: Have }>({ sections: [COUNTED], have: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dlg = useRef<HTMLDialogElement>(null);
  const seen = useRef(""); // ready set already shown; "Not now" remembers it for this browser session so a reload does not nag
  const router = useRouter();
  const pending = jobs.some(j => !j.done);
  const ready = jobs.filter(j => j.done && j.items);

  useEffect(() => {
    const tick = async () => { const r = await fetch("/api/haul", { cache: "no-store" }); if (r.ok) setJobs(await r.json()); };
    tick(); const t = setInterval(tick, pending ? 3000 : 15000); return () => clearInterval(t);
  }, [pending]);

  async function open() {
    const p = await fetch("/api/pantry", { cache: "no-store" });
    const { have } = p.ok ? await p.json().then(j => { setPantry(j); return j as { have: Have }; }) : { have: {} as Have };
    const found: Row[] = [];
    for (const it of ready.flatMap(j => j.items!)) {
      const ex = found.find(f => f.name === it.name);
      if (ex) ex.count = ex.count !== null && it.count !== null ? ex.count + it.count : ex.count ?? it.count;
      else found.push({ id: found.length, on: true, ...it, section: have[key(it.name)]?.section ?? it.section });
    }
    setError(""); setRows(found);
  }
  // Pop when a scan finishes (a ready set we have not shown yet) and when the Haul page asks.
  const readyKey = ready.map(j => j.id).join();
  useEffect(() => { if (!pending && ready.length && seen.current !== readyKey && sessionStorage.getItem("haul-seen") !== readyKey) { seen.current = readyKey; open(); } }, [pending, readyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => open(); window.addEventListener(REVIEW, h); return () => window.removeEventListener(REVIEW, h); }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (rows && !dlg.current?.open) dlg.current?.showModal(); if (!rows) dlg.current?.close(); }, [rows]);

  const verdict = (r: Row) => { const h = pantry.have[key(r.name)]; return !h ? "new" : r.section === COUNTED && r.count !== null && h.count !== r.count ? `have ${h.count ?? "some"} → ${r.count}` : "have"; };
  const patch = (id: number, p: Partial<Row>) => setRows(rs => rs!.map(r => r.id === id ? { ...r, ...p } : r));
  const chosen = rows?.filter(r => r.on && r.name.trim()) ?? [];

  async function save() {
    setBusy(true);
    const r = await fetch("/api/pantry", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "addMany", items: chosen.map(({ name, count, section }) => ({ name: name.trim(), count, section })), note: ready.map(j => j.photo).join(" ") }) });
    setBusy(false);
    if (!r.ok) { setError("Could not save. Tell auntie."); return; }
    await fetch("/api/haul", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: ready.map(j => j.id) }) });
    setJobs(js => js.filter(j => !j.done)); setRows(null); router.refresh();
  }

  return (
    <dialog ref={dlg} onClose={() => setRows(null)} className="m-auto w-[min(100vw-1rem,44rem)] max-h-[90dvh] p-4 rounded-2xl border-2 backdrop:bg-black/60" style={{ background: "var(--bg)", color: "inherit", borderColor: "var(--rule)" }}>
      {rows && (
        <div className="prose">
          <h2 className="!mt-0">Auntie saw {rows.length} {rows.length === 1 ? "item" : "items"}</h2>
          {rows.length === 0 ? <p>Nothing recognised. Try a closer photo in better light.</p> : <p style={{ color: "var(--muted)" }}>Fix names and counts, untick what is wrong, then add.</p>}
          <ul className="!list-none !p-0">
            {rows.map(r => (
              <li key={r.id} className="!mb-0 py-2 border-b flex flex-wrap items-center gap-2" style={{ borderColor: "var(--rule)", opacity: r.on ? 1 : 0.5 }}>
                <input type="checkbox" className="w-7 h-7 accent-[var(--accent)]" checked={r.on} aria-label={`Keep ${r.name}`} onChange={e => patch(r.id, { on: e.target.checked })} />
                <span className="text-sm px-2 py-1 rounded-lg" style={{ background: "var(--rule)", color: "var(--muted)" }}>{verdict(r)}</span>
                <input value={r.name} aria-label="Item name" onChange={e => patch(r.id, { name: e.target.value })} className="flex-1 min-w-[8rem] min-h-[48px] px-3 rounded-xl border-2 bg-transparent" style={{ borderColor: "var(--rule)" }} />
                {r.section === COUNTED && (
                  <span className="flex items-center gap-1">
                    <button type="button" className="x" aria-label="One less" onClick={() => patch(r.id, { count: Math.max(0, (r.count ?? 1) - 1) || null })}>−</button>
                    <span className="min-w-[2ch] text-center font-bold tabular-nums">{r.count ?? "–"}</span>
                    <button type="button" className="x" aria-label="One more" onClick={() => patch(r.id, { count: (r.count ?? 0) + 1 })}>+</button>
                  </span>
                )}
                <select value={r.section} aria-label="Section" onChange={e => patch(r.id, { section: e.target.value, count: e.target.value === COUNTED ? r.count : null })} className="min-h-[48px] px-2 rounded-xl border-2 bg-transparent" style={{ borderColor: "var(--rule)" }}>
                  {pantry.sections.map(s => <option key={s}>{s}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <button type="button" className="chip" disabled={busy} onClick={() => { sessionStorage.setItem("haul-seen", readyKey); setRows(null); }}>Not now</button>
            <button type="button" className="btn flex-1" disabled={busy || chosen.length === 0} onClick={save}>{busy ? "…" : `Add ${chosen.length} to pantry`}</button>
          </div>
          {error && <p role="alert" style={{ color: "var(--accent)" }}>{error}</p>}
        </div>
      )}
    </dialog>
  );
}
