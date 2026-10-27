"use client";
import { useEffect, useRef, useState } from "react";
import { REVIEW } from "@/components/Proposal";
import type { Job } from "@/app/api/haul/route";

// Take a photo, it uploads at once, carry on cooking. The proposal pops up app-wide when the scan is done (Proposal.tsx).
type Mode = "haul" | "receipt";
const HINT: Record<Mode, string> = { haul: "Lay the food out on the counter in one layer, good light. About 45 s a photo.", receipt: "Flat, whole receipt in frame, good light, no shadow. Long receipt: two photos. About a minute each." };

export default function Haul() {
  const [mode, setMode] = useState<Mode>("haul");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sending, setSending] = useState(0);
  const [error, setError] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const pending = jobs.filter(j => !j.done).length + sending;
  const ready = jobs.filter(j => j.done && j.items).flatMap(j => j.items!).length;

  const refresh = async () => { const r = await fetch("/api/haul", { cache: "no-store" }); if (r.ok) setJobs(await r.json()); };
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, []);

  async function send(files: File[]) {
    setError(""); setSending(n => n + files.length);
    const sent = await Promise.all(files.map(f => { const fd = new FormData(); fd.append("photo", f); fd.append("mode", mode); return fetch("/api/haul", { method: "POST", body: fd }); }));
    const bad = sent.find(r => !r.ok);
    if (bad) setError((await bad.json()).error ?? "Could not send the photo. Tell auntie.");
    setSending(n => n - files.length); refresh();
  }

  return (
    <div className="prose">
      <h1>Haul</h1>
      <div className="flex gap-2" role="group" aria-label="What is in the photo">
        {(["haul", "receipt"] as Mode[]).map(m => <button key={m} type="button" className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "haul" ? "Food haul" : "Receipt"}</button>)}
      </div>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{HINT[mode]}</p>
      <input ref={pick} type="file" accept="image/*" capture="environment" multiple hidden onChange={e => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; if (picked.length) send(picked); }} />
      <button type="button" className="btn w-full min-h-[64px] text-lg" onClick={() => pick.current?.click()}>Take a photo</button>
      <p role="status" aria-live="polite" className="mt-3">
        {pending > 0 && `Auntie is looking at ${pending} ${pending === 1 ? "photo" : "photos"}. Carry on, she will pop up when she is done. `}
        {ready > 0 && <button type="button" className="chip" onClick={() => window.dispatchEvent(new Event(REVIEW))}>Review {ready} items</button>}
      </p>
      {error && <p role="alert" style={{ color: "var(--accent)" }}>{error}</p>}
    </div>
  );
}
