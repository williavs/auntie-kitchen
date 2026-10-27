import Link from "next/link";
import { recipes } from "@/lib/content";

export default function Home() {
  const list = recipes();
  return (
    <div className="prose">
      <h1>Recipes</h1>
      {list.length === 0 && <p>No recipes yet.</p>}
      <ul className="!list-none !p-0">
        {list.map(r => (
          <li key={r.slug} className="!mb-4">
            <Link href={`/r/${r.slug}`} className="text-[1.3rem] font-bold">{r.title}</Link>
            <div className="text-base" style={{ color: "var(--muted)" }}>{r.region}{r.region && r.date ? " · " : ""}{r.date}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
