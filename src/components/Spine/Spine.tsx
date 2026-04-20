import type { Vacancy, Candidate, CandidateAggregation, Position, PositionCategory } from '@/entities';
import { RoleBadge } from './RoleBadge';
import { ToolStrip } from './ToolStrip';
import styles from './Spine.module.css';

export type SpineKind = 'vacancy' | 'candidate';

interface CommonProps {
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
  trailing?: React.ReactNode;
}

interface VacancySpineProps extends CommonProps {
  kind: 'vacancy';
  vacancy: Vacancy;
  position?: Position | null;
}

interface CandidateSpineProps extends CommonProps {
  kind: 'candidate';
  candidate: Candidate;
  aggregation?: CandidateAggregation | null;
  position?: Position | null;
}

export type SpineProps = VacancySpineProps | CandidateSpineProps;

function initialsForCandidate(c: Candidate): string {
  return (c.firstName.charAt(0) + c.lastName.charAt(0)).toUpperCase();
}

function initialsForVacancy(v: Vacancy): string {
  const parts = v.companyName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return v.companyName.slice(0, 2).toUpperCase();
}

export function Spine(props: SpineProps) {
  const { active, compact, onClick, className, trailing, kind } = props;

  const cls = [
    styles.spine,
    kind === 'vacancy' ? styles.spineVacancy : styles.spineCandidate,
    active ? styles.active : '',
    compact ? styles.compact : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  if (kind === 'vacancy') {
    const { vacancy, position } = props;
    const topTools = vacancy.minRequirements.slice(0, 3).map((r) => r.toolId);
    const category: PositionCategory | undefined = position?.category;

    return (
      <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined}>
        <div className={styles.avatar} data-kind="vacancy">
          {vacancy.companyLogoUrl ? (
            <img src={vacancy.companyLogoUrl} alt="" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarText}>{initialsForVacancy(vacancy)}</span>
          )}
        </div>
        <div className={styles.nameBlock}>
          <span className={styles.name} title={vacancy.companyName}>{vacancy.companyName}</span>
          <RoleBadge category={category} grade={vacancy.grade} />
        </div>
        <ToolStrip toolIds={topTools} />
        {trailing && <span className={styles.trailing}>{trailing}</span>}
      </div>
    );
  }

  const { candidate, aggregation, position } = props;
  const topToolIds = (aggregation?.toolsExperience ?? [])
    .slice(0, 3)
    .map((t) => t.toolId);
  const category: PositionCategory | undefined = position?.category;
  const displayName = `${candidate.lastName} ${candidate.firstName}`.trim();

  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className={styles.avatar} data-kind="candidate">
        {candidate.photoUrl ? (
          <img src={candidate.photoUrl} alt="" className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarText}>{initialsForCandidate(candidate)}</span>
        )}
      </div>
      <div className={styles.nameBlock}>
        <span className={styles.name} title={displayName}>{displayName}</span>
        <RoleBadge category={category} grade={aggregation?.topGrade} />
      </div>
      <ToolStrip toolIds={topToolIds} />
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
