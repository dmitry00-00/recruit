import type { Vacancy } from '@/entities';
import { GradeBadge } from '@/components/ui';
import { MatchBadge } from '@/components/MatchBadge';
import { DomainToolStack } from '@/components/Spine';
import { VACANCY_STATUS_LABELS, CURRENCY_SYMBOLS } from '@/config';
import styles from './VacancyCard.module.css';

interface VacancyCardProps {
  vacancy: Vacancy;
  matchScore?: number;
  onClick?: () => void;
}

export function VacancyCard({ vacancy, matchScore, onClick }: VacancyCardProps) {
  const toolIds = vacancy.minRequirements.map((r) => r.toolId);
  const symbol = CURRENCY_SYMBOLS[vacancy.currency] ?? '₽';

  const salaryText =
    vacancy.salaryFrom && vacancy.salaryTo
      ? `${(vacancy.salaryFrom / 1000).toFixed(0)}–${(vacancy.salaryTo / 1000).toFixed(0)}k ${symbol}`
      : vacancy.salaryFrom
      ? `от ${(vacancy.salaryFrom / 1000).toFixed(0)}k ${symbol}`
      : vacancy.salaryTo
      ? `до ${(vacancy.salaryTo / 1000).toFixed(0)}k ${symbol}`
      : null;

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.header}>
        {vacancy.companyLogoUrl ? (
          <img src={vacancy.companyLogoUrl} alt="" className={styles.logo} />
        ) : (
          <div className={styles.logoPlaceholder}>
            {vacancy.companyName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className={styles.headerText}>
          <div className={styles.company}>{vacancy.companyName}</div>
          <div className={styles.title}>{vacancy.positionId}</div>
        </div>
        {matchScore != null && <MatchBadge score={matchScore} size="sm" />}
      </div>

      <div className={styles.meta}>
        <GradeBadge grade={vacancy.grade} size="sm" />
        <span
          className={styles.status}
          style={{
            background: `var(--status-${vacancy.status === 'offer_made' ? 'offer' : vacancy.status}-bg)`,
            color: `var(--status-${vacancy.status === 'offer_made' ? 'offer' : vacancy.status}-color)`,
          }}
        >
          {VACANCY_STATUS_LABELS[vacancy.status]}
        </span>
      </div>

      <div className={styles.stack}>
        <DomainToolStack toolIds={toolIds} max={8} />
      </div>

      <div className={styles.footer}>
        {salaryText && <span className={styles.salary}>{salaryText}</span>}
      </div>
    </div>
  );
}
