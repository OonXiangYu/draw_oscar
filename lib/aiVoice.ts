// Makes up a short, fun "AI voice" line from the model's current top guesses.
// It only uses the probabilities, so the voice "thinks out loud" like a person.

import { withArticle } from "./labels";
import type { Prediction } from "./types";

// A few extra jokes for some classes. Used when the model is quite sure.
const SPECIAL_LINES: Record<string, string> = {
  sun: "It's the sun! I can feel the warmth.",
  moon: "A moon! Or a banana... no, a moon.",
  banana: "A banana! Unless it's a moon...",
  bicycle: "A bicycle! Two wheels, I see them.",
  cat: "A cat! Meow.",
  pizza: "Pizza! Now I'm hungry.",
  snowman: "A snowman! Brr.",
  bee: "A bee! Bzzz.",
  rainbow: "A rainbow! Too bad I can't see colors.",
  hamburger: "A hamburger! Extra cheese, please.",
};

/**
 * Picks the line to show.
 * In: top guesses (most likely first). Out: one short sentence.
 */
export function aiVoiceLine(predictions: Prediction[]): string {
  const [first, second] = predictions;
  if (!first) return "Go ahead, start drawing. I'm watching...";

  const a = withArticle(first.label);
  const p = first.probability;

  // Change the tone with the confidence, so the voice feels alive.
  if (p < 0.25) return "Hmm... I have no idea yet. Keep going!";
  if (p < 0.5 && second) return `I see... ${a}? Or maybe ${withArticle(second.label)}?`;
  if (p < 0.75) return `Is it ${a}?`;
  if (p < 0.92) return `I think it's ${a}!`;
  return SPECIAL_LINES[first.label] ?? `Oh, I know! It's ${a}!`;
}
