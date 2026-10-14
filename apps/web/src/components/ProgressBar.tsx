interface Props {
  current: number;
  total: number;
  ariaLabel?: string;
}

export default function ProgressBar({ current, total, ariaLabel }: Props) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal);
  const percent = (safeCurrent / safeTotal) * 100;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-valuenow={safeCurrent}
      aria-label={ariaLabel ?? 'Survey progress'}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
