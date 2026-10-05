import { FILLABLE_SLIDES, stepNumberOfSlide } from "@/lib/types";
import type { SlideId } from "@/lib/types";

export function ProgressBar({ slideId, percent }: { slideId: SlideId; percent: number }) {
  const step = stepNumberOfSlide(slideId);
  const total = FILLABLE_SLIDES.length;
  if (step === null) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-ink-muted">
          Langkah {step} dari {total}
        </p>
        <p className="font-mono text-sm text-ink-muted">{percent}%</p>
      </div>
      <div
        role="progressbar"
        aria-label="Kemajuan pengisian form"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt"
      >
        <div
          className="h-full rounded-full bg-accent transition-transform duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
