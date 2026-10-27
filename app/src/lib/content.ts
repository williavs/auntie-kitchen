import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

// ponytail: content is read from the repo at build time; push = rebuild.
export const ROOT = process.env.AUNTIE_ROOT ?? path.resolve(process.cwd(), "..");

export type Recipe = { slug: string; title: string; region: string; date: string; serves?: string; html: string };

export function recipes(): Recipe[] {
  const dir = path.join(ROOT, "recipes");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".md")).map(f => {
    const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
    const slug = f.replace(/\.md$/, "");
    return { slug, title: data.title ?? f, region: data.region ?? "", date: slug.slice(0, 10), serves: data.serves, html: marked.parse(content) as string };
  }).sort((a, b) => b.slug.localeCompare(a.slug));
}

export function recipe(slug: string) { return recipes().find(r => r.slug === slug); }

export function page(name: "pantry" | "cook-log") {
  return marked.parse(fs.readFileSync(path.join(ROOT, `${name}.md`), "utf8")) as string;
}
