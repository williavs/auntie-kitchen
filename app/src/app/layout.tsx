import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import Proposal from "@/components/Proposal";

export const metadata: Metadata = { title: "Auntie Kitchen", description: "Home Indian cooking, one cook at a time" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="flex gap-5 px-4 py-3 text-base border-b" style={{ borderColor: "var(--rule)" }}>
          <Link href="/">Recipes</Link>
          <Link href="/pantry">Pantry</Link>
          <Link href="/log">Log</Link>
          <Link href="/haul">Haul</Link>
        </nav>
        <main className="px-4 py-5 max-w-[46rem] mx-auto">{children}</main>
        <Proposal />
      </body>
    </html>
  );
}
