import { after, NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { archiveJpeg, readHaul, readReceipt, type Found } from "@/lib/vision";

// A photo read is a job: POST starts it and returns at once, GET lists jobs, DELETE clears them once added or dismissed.
// Reads take 30-60 s on the homelab model (AUNTIE_VISION) and the phone screen locks, so the page polls instead of waiting.
// Jobs live in memory and as JSON under ~/.local/state/auntie/hauls/jobs. ponytail: a restart mid-read loses that job; retake the photo.
export type Job = { id: string; mode: "haul" | "receipt"; photo: string; started: number; done?: number; items?: Found[]; error?: string };
const STATE = process.env.AUNTIE_STATE ?? path.join(os.homedir(), ".local/state/auntie");
const HAULS = path.join(STATE, "hauls"), JOBS = path.join(HAULS, "jobs");
const jobs = new Map<string, Job>();
const save = (j: Job) => { fs.mkdirSync(JOBS, { recursive: true }); fs.writeFileSync(path.join(JOBS, `${j.id}.json`), JSON.stringify(j)); };
function load() {
  if (jobs.size || !fs.existsSync(JOBS)) return;
  for (const f of fs.readdirSync(JOBS)) { const j: Job = JSON.parse(fs.readFileSync(path.join(JOBS, f), "utf8")); if (j.done) jobs.set(j.id, j); }
}
const list = () => { load(); return [...jobs.values()].sort((a, b) => a.started - b.started); };

export async function GET() { return NextResponse.json(list()); }

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("photo"), mode = form.get("mode");
  if (!(file instanceof File) || file.size === 0 || file.size > 25e6) return NextResponse.json({ error: "need a photo under 25 MB" }, { status: 400 });
  if (mode !== "haul" && mode !== "receipt") return NextResponse.json({ error: "mode must be haul or receipt" }, { status: 400 });
  const photo = Buffer.from(await file.arrayBuffer());
  const now = new Date(), day = now.toISOString().slice(0, 10), id = `${day}-${now.toTimeString().slice(0, 8).replace(/:/g, "")}-${mode}`;
  let archived: Buffer;
  try { archived = await archiveJpeg(photo); } catch { return NextResponse.json({ error: "that is not a photo I can read" }, { status: 400 }); }
  fs.mkdirSync(path.join(HAULS, day), { recursive: true });
  fs.writeFileSync(path.join(HAULS, day, `${id}.jpg`), archived);
  const job: Job = { id, mode, photo: `${day}/${id}.jpg`, started: Date.now() };
  load(); jobs.set(id, job);
  after(() => (mode === "haul" ? readHaul(photo) : readReceipt(photo))
    .then(items => { job.items = items; }, e => { job.error = (e as Error).message; })
    .finally(() => { job.done = Date.now(); save(job); }));
  return NextResponse.json(job, { status: 202 });
}

export async function DELETE(req: Request) {
  const ids: unknown = (await req.json()).ids;
  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids" }, { status: 400 });
  for (const id of ids) if (typeof id === "string" && jobs.delete(id)) fs.rmSync(path.join(JOBS, `${id}.json`), { force: true });
  return NextResponse.json(list());
}
