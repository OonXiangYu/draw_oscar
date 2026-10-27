// "How it works" page: the data, the model, the results and the mistakes.
// The content lives in components/HowItWorks.tsx, which loads metrics.json.

import type { Metadata } from "next";
import HowItWorks from "@/components/HowItWorks";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold text-ink">How it works</h1>
      <p className="mb-4 max-w-2xl text-ink-2">
        From 810,000 doodles to a model that runs in your browser: the data, the network, how well it does, and where it
        gets confused.
      </p>
      <HowItWorks />
    </div>
  );
}
