import type { Grade } from '@/entities';
import { GRADE_LABELS } from '@/entities';
import { GRADE_COLORS } from '@/config';
import { Badge } from './Badge';

interface GradeBadgeProps {
  grade: Grade;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const colors = GRADE_COLORS[grade];
  return (
    <Badge size={size} bg={colors.bg} color={colors.text} border={colors.border}>
      {GRADE_LABELS[grade]}
    </Badge>
  );
}
