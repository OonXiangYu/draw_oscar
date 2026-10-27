// Shared TypeScript types used across the app.
// Keeping them in one place means the model code, the UI and the charts all
// agree on the shape of the data.

/** One guess from the model: a class and how sure the model is about it. */
export interface Prediction {
  /** Position of this class in the model output (and in labels.json). */
  index: number;
  /** Raw class name from labels.json, e.g. "light bulb". */
  label: string;
  /** Probability from 0 to 1 (after softmax). */
  probability: number;
}

/** One row of the training history in metrics.json. */
export interface HistoryEntry {
  epoch: number;
  /** Average training loss for this epoch. */
  loss: number;
  /** Top-1 accuracy on the validation set (0 to 1). */
  val_acc: number;
  /** Top-3 accuracy on the validation set (0 to 1). */
  val_top3: number;
}

/** A pair of classes the model often mixes up on the test set. */
export interface Confusion {
  /** The real class of the drawing. */
  true: string;
  /** What the model guessed instead. */
  pred: string;
  /** How many test drawings had this mistake. */
  count: number;
}

/** The full contents of public/model/metrics.json. */
export interface Metrics {
  test_top1: number;
  test_top3: number;
  history: HistoryEntry[];
  classes: string[];
  /** Accuracy per class, in the same order as `classes`. */
  per_class_acc: number[];
  /** confusion_matrix[trueIndex][predictedIndex] = number of test drawings. */
  confusion_matrix: number[][];
  top_confusions: Confusion[];
}

/** Where the model is in its life cycle. */
export type ModelStatus = "loading" | "ready" | "error";
