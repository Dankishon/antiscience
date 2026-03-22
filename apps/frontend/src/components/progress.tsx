import { cn } from '../lib/cn';

type ProgressProps = {
  className?: string;
  hint?: string;
  label?: string;
  max?: number;
  value: number;
};

export function Progress({ className, hint, label, max = 100, value }: ProgressProps) {
  const safeMax = max <= 0 ? 1 : max;
  const safeValue = Math.max(0, Math.min(value, safeMax));
  const percentage = Math.round((safeValue / safeMax) * 100);

  return (
    <div className={cn('progress', className)}>
      {(label || hint) && (
        <div className="progressHeader">
          {label ? <span className="progressLabel">{label}</span> : null}
          {hint ? <span className="progressHint">{hint}</span> : null}
        </div>
      )}
      <div
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        className="progressTrack"
        role="progressbar"
      >
        <span className="progressFill" style={{ width: `${percentage}%` }} />
      </div>
      <span className="progressValue">{safeValue} / {safeMax}</span>
    </div>
  );
}
