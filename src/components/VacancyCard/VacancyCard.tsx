import type { Vacancy } from '@/entities';
import { GradeBadge } from '@/components/ui';
import { MatchBadge } from '@/components/MatchBadge';
import { VACANCY_STATUS_LABELS, CURRENCY_SYMBOLS, CARD_MAX_TOOLS_SHOWN } from '@/config';
import { getToolById } from '@/utils';
import styles from './VacancyCard.module.css';

interface VacancyCardProps {
  vacancy: Vacancy;
  matchScore?: number;
  onClick?: () => void;
}

export function VacancyCard({ vacancy, matchScore, onClick }: VacancyCardProps) {
  const tools = vacancy.minRequirements.map((r) => getToolById(r.toolId)).filter(Boolean);
  const visibleTools = tools.slice(0, CARD_MAX_TOOLS_SHOWN);
  const extraCount = tools.length - visibleTools.length;
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
        {salaryText && <span className={styles.salary}>{salaryText}</span>}
      </div>
    </div>
  );
}
