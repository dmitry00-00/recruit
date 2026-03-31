import { MATCH_THRESHOLDS } from '@/config';
import styles from './MatchBadge.module.css';

interface MatchBadgeProps {
  score: number;
  mode?: 'min' | 'max';
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 36, md: 48, lg: 64 };
const strokes = { sm: 3, md: 4, lg: 5 };

function getColor(score: number): string {
  if (score >= MATCH_THRESHOLDS.HIGH) return 'var(--match)';
  if (score >= MATCH_THRESHOLDS.MEDIUM) return 'var(--amber)';
  return 'var(--gap)';
}

export function MatchBadge({ score, size = 'md' }: MatchBadgeProps) {
  const s = sizes[size];
  const stroke = strokes[size];
  const r = (s - stroke) / 2;
  const c = Math.PI * 2 * r;
  const offset = c - (score / 100) * c;
  const color = getColor(score);

  return (
    <div className={`${styles.wrapper} ${styles[size]}`}>
      <svg width={s} height={s}>
        <circle
          cx={s / 2}
          cy={s / 2}
          r={r}
          fill="none"
          stroke="var(--border-tertiary)"
          strokeWidth={stroke}
        />
        <circle
          cx={s / 2}
          cy={s / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${s / 2} ${s / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <span className={styles.score} style={{ color }}>
        {Math.round(score)}
      </span>
    </div>
  );
}
