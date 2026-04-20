import type { Candidate, CandidateAggregation } from '@/entities';
import { GradeBadge } from '@/components/ui';
import { MatchBadge } from '@/components/MatchBadge';
import { DomainToolStack } from '@/components/Spine';
import { CURRENCY_SYMBOLS } from '@/config';
import styles from './CandidateCard.module.css';

interface CandidateCardProps {
  candidate: Candidate;
  aggregation?: CandidateAggregation;
  matchScore?: number;
  onClick?: () => void;
}

export function CandidateCard({ candidate, aggregation, matchScore, onClick }: CandidateCardProps) {
  const toolIds = (aggregation?.toolsExperience ?? []).map((t) => t.toolId);
  const symbol = CURRENCY_SYMBOLS[candidate.currency] ?? '₽';
  const initials =
    (candidate.firstName.charAt(0) + candidate.lastName.charAt(0)).toUpperCase();

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.header}>
        {candidate.photoUrl ? (
          <img src={candidate.photoUrl} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarPlaceholder}>{initials}</div>
        )}
        <div className={styles.headerText}>
          <div className={styles.name}>
            {candidate.lastName} {candidate.firstName}
          </div>
          <div className={styles.subtitle}>
            {aggregation ? `${aggregation.totalYears} лет опыта` : ''}
          </div>
        </div>
        {matchScore != null && <MatchBadge score={matchScore} size="sm" />}
      </div>

      <div className={styles.meta}>
        {aggregation?.topGrade && <GradeBadge grade={aggregation.topGrade} size="sm" />}
      </div>

      <div className={styles.stack}>
        <DomainToolStack toolIds={toolIds} max={8} />
      </div>

      <div className={styles.footer}>
        {aggregation && (
          <span className={styles.experience}>
            {aggregation.totalYears} лет
          </span>
        )}
        {candidate.salaryExpected && (
          <span className={styles.salary}>
            {(candidate.salaryExpected / 1000).toFixed(0)}k {symbol}
          </span>
        )}
      </div>
    </div>
  );
}
