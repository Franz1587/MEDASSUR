import { useState } from "react";

export type ProcessingStatus = "idle" | "processing" | "done";

/**
 * Drives the upload → processing spinner → result UX shared by every
 * simulated OCR/AI flow (Comparateur, GED). Swap the async fn passed to
 * run() for a real API call later without touching the UI.
 */
export function useSimulatedProcessing<T>() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [result, setResult] = useState<T | null>(null);

  const run = (fn: () => Promise<T>) => {
    setStatus("processing");
    fn().then((data) => {
      setResult(data);
      setStatus("done");
    });
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
  };

  return { status, result, run, reset };
}
