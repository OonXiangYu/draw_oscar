// Home page: a one-line pitch, a big "Start drawing" button and links.

import Link from "next/link";
import { EXTERNAL_LINK, REPO_URL } from "@/lib/site";

const FEATURES = [
  { title: "Live guesses", text: "The AI guesses while you draw, about 7 times per second." },
  { title: "54 things to draw", text: "From apples to umbrellas, trained on 810,000 real doodles." },
  { title: "100% in your browser", text: "No server. Your drawing never leaves your device." },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-12 py-6 text-center sm:py-12">
      <section className="flex max-w-2xl flex-col items-center gap-5">
        <p className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-2">
          A machine learning demo
        </p>
        <h1 className="text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
          You draw. A neural network guesses what it is, live.
        </h1>
        <p className="text-lg text-ink-2">
          A small CNN trained on Google&apos;s Quick, Draw! doodles, running right here in your browser.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/play" className="btn-primary px-8 py-4 text-lg">
            Start drawing
          </Link>
          <Link href="/how-it-works" className="btn-secondary px-5 py-3 text-base">
            How it works
          </Link>
        </div>
        <a href={REPO_URL} {...EXTERNAL_LINK} className="text-sm text-ink-3 underline hover:text-ink">
          View source code
        </a>
      </section>

      <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card text-left">
            <h2 className="mb-1 font-semibold text-ink">{f.title}</h2>
            <p className="text-sm text-ink-2">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
