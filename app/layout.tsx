// Shared layout for every page: top navigation bar, page content, footer.
// The footer holds the dataset credit, which the CC BY 4.0 license requires.

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { GITHUB_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Doodle Guess", template: "%s · Doodle Guess" },
  description: "Draw something and a small neural network guesses it live, right in your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-ink">
              ✏️ Doodle Guess
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium sm:gap-3">
              <Link href="/play" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                Play
              </Link>
              <Link href="/how-it-works" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink">
                How it works
              </Link>
              <a href={GITHUB_URL} className="hidden rounded-full px-3 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline">
                GitHub
              </a>
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-line px-4 py-6 text-center text-sm text-ink-3">
          Drawings data:{" "}
          <a href="https://github.com/googlecreativelab/quickdraw-dataset" className="underline hover:text-ink">
            Quick, Draw! Dataset
          </a>{" "}
          by Google, CC BY 4.0
        </footer>
      </body>
    </html>
  );
}
