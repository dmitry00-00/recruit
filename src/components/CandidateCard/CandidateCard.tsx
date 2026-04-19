import type { Candidate, CandidateAggregation } from '@/entities';
import { GradeBadge } from '@/components/ui';
import { MatchBadge } from '@/components/MatchBadge';
import { CURRENCY_SYMBOLS, CARD_MAX_TOOLS_SHOWN } from '@/config';
import { getToolById } from '@/utils';
import styles from './CandidateCard.module.css';

interface CandidateCardProps {
  candidate: Candidate;
  aggregation?: CandidateAggregation;
  matchScore?: number;
  onClick?: () => void;
}

export function CandidateCard({ candidate, aggregation, matchScore, onClick }: CandidateCardProps) {
  const tools = (aggregation?.toolsExperience ?? [])
    .map((t) => getToolById(t.toolId))
    .filter(Boolean);
  const visibleTools = tools.slice(0, CARD_MAX_TOOLS_SHOWN);
  const extraCount = tools.length - visibleTools.length;
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

      <div className={styles.tools}>
        {visibleTools.map(
          (tool) =>
            tool && (
              tool.logoUrl ? (
                <img
                  key={tool.id}
                  src={tool.logoUrl}
                  alt={tool.name}
                  title={tool.name}
                  className={styles.toolIcon}
                />
              ) : (
                <span key={tool.id} className={styles.toolMore} title={tool.name}>
                  {tool.name.slice(0, 3)}
                </span>
              )
            ),
        )}
        {extraCount > 0 && (
          <span className={styles.toolMore}>+{extraCount}</span>
        )}
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
