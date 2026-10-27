import { notFound } from "next/navigation";
import { recipe, recipes } from "@/lib/content";

export const dynamicParams = false;
export function generateStaticParams() { return recipes().map(r => ({ slug: r.slug })); }

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = recipe(slug);
  if (!r) notFound();
  return (
    <article className="prose">
      <h1>{r.title}</h1>
      <p style={{ color: "var(--muted)" }}>{[r.region, r.date, r.serves && `serves ${r.serves}`].filter(Boolean).join(" · ")}</p>
      <div dangerouslySetInnerHTML={{ __html: r.html }} />
    </article>
  );
}
