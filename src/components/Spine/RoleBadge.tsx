import { Code2, Bug, BarChart2, GitBranch, Palette, Target, Database, Briefcase } from 'lucide-react';
import type { PositionCategory, Grade } from '@/entities';
import { GRADE_LABELS, POSITION_CATEGORY_LABELS } from '@/entities';
import { GradeChevrons } from './GradeChevrons';
import styles from './Spine.module.css';

const ICON_MAP: Record<PositionCategory, typeof Code2> = {
  developer: Code2,
  qa:        Bug,
  analyst:   BarChart2,
  devops:    GitBranch,
  designer:  Palette,
  manager:   Target,
  data:      Database,
};

interface Props {
  category?: PositionCategory | null;
  grade?: Grade;
  size?: number;
}

export function RoleBadge({ category, grade, size = 13 }: Props) {
  const Icon = category ? ICON_MAP[category] : Briefcase;
  const title = [
    category ? POSITION_CATEGORY_LABELS[category] : 'Должность',
    grade ? GRADE_LABELS[grade] : null,
  ].filter(Boolean).join(' · ');

  return (
    <span className={styles.roleBadge} title={title}>
      <Icon size={size} className={styles.roleBadgeIcon} />
      {grade && <GradeChevrons grade={grade} />}
    </span>
  );
}
