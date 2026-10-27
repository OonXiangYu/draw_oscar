// Shows a loading message while the model downloads, or an error with a
// "Try again" button if it fails. Shows nothing once the model is ready.

import type { ModelStatus } from "@/lib/types";

interface ModelStatusNoticeProps {
  status: ModelStatus;
  error: string | null;
  onRetry: () => void;
}

export default function ModelStatusNotice({ status, error, onRetry }: ModelStatusNoticeProps) {
  if (status === "ready") return null;

  if (status === "loading") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
        Loading the AI model (about 2 MB)...
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
      <span>
        <strong>The AI model could not load.</strong> Check your internet connection and try again.
        {error && <span className="block text-xs text-ink-2">Details: {error}</span>}
      </span>
      <button type="button" onClick={onRetry} className="btn-secondary shrink-0">
        Try again
      </button>
    </div>
  );
}
