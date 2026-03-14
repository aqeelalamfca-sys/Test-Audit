import { FlaskConical } from "lucide-react";

export function AlphaRibbon() {
  return (
    <div
      className="w-full bg-amber-500/10 border-b border-amber-300/30 dark:border-amber-700/40 px-3 py-1 flex items-center justify-center gap-2"
      data-testid="ribbon-beta-version"
    >
      <FlaskConical className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
        <span className="font-semibold">Beta Version</span>
        <span className="mx-1.5 text-amber-500/60 dark:text-amber-500/40">—</span>
        A preliminary release of software made available for testing, feedback, and refinement.
      </span>
    </div>
  );
}
