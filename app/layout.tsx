// Shared layout for every page: top navigation bar, page content, footer.
// The footer holds the dataset credit, which the CC BY 4.0 license requires.

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";
import ThemeToggle from "@/components/ThemeToggle";
import { DATASET_URL, EXTERNAL_LINK } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
    // suppressHydrationWarning: the head script below adds the "dark" class
    // before React loads, so <html> can differ from the server HTML on purpose.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          {/* On narrow phones the links drop to a second row, so the logo and
              the theme toggle keep the top row. */}
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3">
            <Link href="/" className="order-1 whitespace-nowrap text-base font-bold text-ink sm:text-lg">
              ✏️ Doodle Guess
            </Link>
            <ThemeToggle className="order-2 ml-auto min-[480px]:order-3 min-[480px]:ml-0" />
            <div className="order-3 -ml-2 flex w-full items-center gap-0.5 whitespace-nowrap text-sm font-medium min-[480px]:order-2 min-[480px]:ml-auto min-[480px]:w-auto sm:gap-2">
              <Link href="/play" className="rounded-full px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-3">
                Play
              </Link>
              <Link href="/how-it-works" className="rounded-full px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-3">
                How it works
              </Link>
              <SocialLinks variant="nav" />
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="flex flex-col items-center gap-3 border-t border-line px-4 py-6 text-center text-sm text-ink-3">
          <div className="flex gap-5">
            <SocialLinks variant="footer" />
          </div>
          <p>
            Drawings data:{" "}
            <a href={DATASET_URL} {...EXTERNAL_LINK} className="underline hover:text-ink">
              Quick, Draw! Dataset
            </a>{" "}
            by Google, CC BY 4.0
          </p>
        </footer>
      </body>
    </html>
  );
}
