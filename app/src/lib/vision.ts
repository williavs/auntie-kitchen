import sharp from "sharp";
import { COUNTED } from "./pantry-types";

// Reads a haul photo or a receipt with a llama-server vision model (AUNTIE_VISION; see deploy/).
// One image per read, resized to SIDE / RECEIPT_SIDE. Keep output JSON short.
// ponytail: one model, sequential calls; Willy reviews every proposal before it touches pantry.md.
const VISION = process.env.AUNTIE_VISION ?? "http://127.0.0.1:8080";
const SIDE = 768, RECEIPT_SIDE = 1024; // Qwen image tokens scale with pixels; receipts need the extra resolution (bench 2026-10-21: 9/9 lines at ~1000 px, 7/9 at 768), produce does not.

export type Found = { name: string; count: number | null; section: string };

const SECTIONS: [RegExp, string][] = [
  [/cumin|mustard seed|coriander seed|cardamom|clove|cinnamon|curry leaf|curry leaves|fenugreek|methi|peppercorn|bay leaf|dried chil|star anise|fennel seed|hing|asafoetida/i, "Whole spices"],
  [/turmeric|chilli powder|chili powder|garam masala|powder|masala|amchur/i, "Ground spices"],
  [/\bdal\b|lentil|rice|flour|atta|chickpea|rajma|bean|poha|semolina|rava|oats|pasta|bread/i, "Dals and grains"],
  [/ghee|butter|oil|coconut milk|cream/i, "Fats"],
  [/yog|dahi|curd|milk|egg|tofu|paneer|cheese|salmon|shrimp|fish|prawn/i, "Dairy / protein"],
  [/sugar|salt|jaggery|almond|cashew|peanut|raisin|tamarind|vinegar|pickle|sauce|can\b|tinned|jar/i, "Dry goods"],
];
export const guessSection = (name: string) => SECTIONS.find(([re]) => re.test(name))?.[1] ?? COUNTED;

const SCHEMA = {
  type: "object",
  properties: { items: { type: "array", items: { type: "object", properties: { n: { type: "string" }, c: { type: "integer" } }, required: ["n", "c"] } } },
  required: ["items"],
};

async function ask(jpeg: Buffer, prompt: string): Promise<{ n: string; c: number }[]> {
  const r = await fetch(`${VISION}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "vision", temperature: 0, max_tokens: 700,
      response_format: { type: "json_schema", json_schema: { name: "items", schema: SCHEMA } },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }] }],
    }),
  });
  if (!r.ok) throw new Error(`vision ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content).items;
}

const clean = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
function merge(rows: { n: string; c: number }[], counted: boolean): Found[] {
  const out = new Map<string, Found>();
  for (const { n, c } of rows) {
    const name = clean(n); if (!name) continue;
    const section = guessSection(name);
    const count = counted && section === COUNTED && c > 0 ? c : null;
    const ex = out.get(name);
    if (ex) ex.count = ex.count !== null && count !== null ? ex.count + count : ex.count ?? count;
    else out.set(name, { name, count, section });
  }
  return [...out.values()];
}

// Prompt tuned on Commons photos 2026-10-21: adding the pantry list or "only if sure" made the 2B model drop items.
const HAUL = `This is a photo of groceries or a produce haul for a home kitchen. List every food item you can see. n = a short plain name a cook would use; c = how many whole pieces you can actually see for fruits and vegetables, 0 for anything else. Write compact JSON on one line.`;
const RECEIPT = `This is a photo of a grocery receipt. List each product line as a short item name in n, exactly as printed, top to bottom. Ignore product codes, prices, dates, totals, card and tax lines. Only transcribe what you can read. Set c to 1. Write compact JSON on one line.`;
// ponytail: belt and braces for lines the model keeps anyway (totals, card, footer).
const NOISE = /total|summe|visa|debit|mwst|netto|brutto|eur|danke|thank|artikel|preis|karriere|www\.|\.at\b|\.com|stra(ss|ß)e|tel\b|uid|atu\d|liefer|bestell|change|cash|card|subtotal|tax|balance|approved|auth/i;
const productLine = (n: string) => { const t = n.replace(/^\s*\d{3,}\s+/, "").replace(/\s+\d+[.,]\d{2}\s*[A-Z]?\s*$/, "").trim(); return !t || NOISE.test(t) || !/[a-z]{3}/i.test(t) || /^[\d\s.,:\/*#%-]+$/.test(t) ? "" : t; };

export async function readHaul(photo: Buffer): Promise<Found[]> {
  const jpeg = await sharp(photo).rotate().resize(SIDE, SIDE, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  return merge(await ask(jpeg, HAUL), true);
}

export async function readReceipt(photo: Buffer): Promise<Found[]> {
    // One image, no tiling: Qwen3.5-9B reads a whole receipt in frame (bench 2026-10-21). trim() drops the table edge around the paper.
  const jpeg = await sharp(await sharp(photo).rotate().trim({ threshold: 40 }).toBuffer()).resize(RECEIPT_SIDE, RECEIPT_SIDE, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  return merge((await ask(jpeg, RECEIPT)).map(r => ({ n: productLine(r.n), c: 1 })), false);
}

/** Resized copy for the haul archive (outside git; the Pi's microSD is write-light). */
export const archiveJpeg = (photo: Buffer) => sharp(photo).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
