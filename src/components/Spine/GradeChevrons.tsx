import type { Grade } from '@/entities';

const GRADE_RANK: Record<Grade, number> = {
  intern: 1,
  junior: 1,
  middle: 2,
  senior: 3,
  lead: 4,
  principal: 5,
  staff: 5,
};

const GRADE_COLOR: Record<Grade, string> = {
  intern:    '#888780',
  junior:    '#888780',
  middle:    '#1D9E75',
  senior:    '#185FA5',
  lead:      '#854F0B',
  principal: '#9333EA',
  staff:     '#9333EA',
};

interface Props {
  grade: Grade;
  size?: number;
}

export function GradeChevrons({ grade, size = 5 }: Props) {
  const n = GRADE_RANK[grade];
  const color = GRADE_COLOR[grade];
  const W = size * 2.4;
  const H = size;
  const GAP = size * 0.5;
  const svgH = n * H + (n - 1) * GAP + 1;

  const paths: string[] = [];
  for (let i = 0; i < n; i++) {
    const y = 0.5 + i * (H + GAP);
    paths.push(`M1 ${y} L${W / 2} ${y + H - 0.5} L${W - 1} ${y}`);
  }

  return (
    <svg
      width={W}
      height={svgH}
      viewBox={`0 0 ${W} ${svgH}`}
      style={{ display: 'block', flexShrink: 0 }}
      aria-label={grade}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </svg>
  );
}
