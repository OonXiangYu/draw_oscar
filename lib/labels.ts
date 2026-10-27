// Loads the list of class names (labels.json) and turns them into nice text.
// labels[i] is the name of output i of the model, so the order matters.

let labelsPromise: Promise<string[]> | null = null;

/**
 * Fetches labels.json once and caches it.
 * Returns the array of class names, in model output order.
 */
export function loadLabels(): Promise<string[]> {
  if (!labelsPromise) {
    labelsPromise = fetch("/model/labels.json").then((res) => {
      if (!res.ok) throw new Error(`Could not load labels (HTTP ${res.status})`);
      return res.json() as Promise<string[]>;
    });
    // If loading fails, forget the failed promise so a retry can work.
    labelsPromise.catch(() => {
      labelsPromise = null;
    });
  }
  return labelsPromise;
}

/**
 * Makes a class name look nice for the screen: "light bulb" -> "Light bulb".
 */
export function displayName(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Class names that are already plural, so they do not take "a" or "an".
const PLURAL_LABELS = new Set(["eyeglasses", "scissors"]);

/**
 * Adds the right English article: "an apple", "a cat", "scissors".
 */
export function withArticle(label: string): string {
  if (PLURAL_LABELS.has(label)) return label;
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
