import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type {
  Vacancy, Candidate, Position, CandidateAggregation,
} from '@/entities';
import { GRADE_LABELS } from '@/entities';
import { RoleBadge, DomainToolStack } from '@/components/Spine';
import {
  VACANCY_STATUS_LABELS,
  WORK_FORMAT_LABELS,
  CURRENCY_SYMBOLS,
} from '@/config';
import styles from './SpinePopover.module.css';

type CommonProps = {
  anchor: DOMRect;
  onClose: () => void;
  onOpenFull?: () => void;
};

type VacPopoverProps = CommonProps & {
  kind: 'vacancy';
  vacancy: Vacancy;
  position: Position | null;
};

type CandPopoverProps = CommonProps & {
  kind: 'candidate';
  candidate: Candidate;
  aggregation: CandidateAggregation | null;
  position: Position | null;
};

export type SpinePopoverProps = VacPopoverProps | CandPopoverProps;

function formatSalary(from?: number, to?: number, symbol = '₽'): string {
  if (from && to) return `${(from / 1000).toFixed(0)}–${(to / 1000).toFixed(0)}k ${symbol}`;
  if (from) return `от ${(from / 1000).toFixed(0)}k ${symbol}`;
  if (to) return `до ${(to / 1000).toFixed(0)}k ${symbol}`;
  return '—';
}

export function SpinePopover(props: SpinePopoverProps) {
  const { anchor, onClose, onOpenFull } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Position the popover near the clicked spine
  const PADDING = 8;
  const WIDTH = 340;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  let left = anchor.right + PADDING;
  if (left + WIDTH > viewportW - PADDING) {
    // Prefer left side if not enough room
    left = Math.max(PADDING, anchor.left - WIDTH - PADDING);
  }
  let top = anchor.top;
  // Keep within viewport vertically — clamp after mount via effect is simpler but use guess here
  const estHeight = 360;
  if (top + estHeight > viewportH - PADDING) {
    top = Math.max(PADDING, viewportH - estHeight - PADDING);
  }

  const style: React.CSSProperties = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${WIDTH}px`,
  };

  return (
    <div ref={ref} className={styles.popover} style={style} onClick={(e) => e.stopPropagation()}>
      <button className={styles.close} onClick={onClose} aria-label="Закрыть">
        <X size={14} />
      </button>
      {props.kind === 'vacancy'
        ? renderVacancy(props)
        : renderCandidate(props)}
      {onOpenFull && (
        <div className={styles.actionRow}>
          <button className={`${styles.linkBtn} ${styles.linkBtnPrimary}`} onClick={onOpenFull}>
            Открыть →
          </button>
        </div>
      )}
    </div>
  );
}

function renderVacancy({ vacancy: vac, position: pos }: VacPopoverProps) {
  const symbol = CURRENCY_SYMBOLS[vac.currency] ?? '₽';
  const toolIds = vac.minRequirements.map((r) => r.toolId);
  const initials = vac.companyName.slice(0, 2).toUpperCase();
  return (
    <>
      <div className={styles.header}>
        <div className={`${styles.avatar} ${styles.avatarVac}`}>
          {vac.companyLogoUrl ? (
            <img src={vac.companyLogoUrl} alt="" className={styles.avatarImg} />
          ) : (
            initials
          )}
        </div>
        <div className={styles.headerText}>
          <div className={styles.name}>{vac.companyName}</div>
          <div className={styles.meta}>
            {pos?.name ?? '—'} · {GRADE_LABELS[vac.grade]}
          </div>
        </div>
        <RoleBadge category={pos?.category} grade={vac.grade} />
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{formatSalary(vac.salaryFrom, vac.salaryTo, symbol)}</div>
          <div className={styles.statLabel}>Зарплата</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{VACANCY_STATUS_LABELS[vac.status]}</div>
          <div className={styles.statLabel}>Статус</div>
        </div>
      </div>

      <div className={styles.sec}>
        <div className={styles.secTitle}>Требования (MIN)</div>
        <DomainToolStack toolIds={toolIds} max={10} />
      </div>

      <div className={styles.sec}>
        <div className={styles.secTitle}>О вакансии</div>
        <div className={styles.kvGrid}>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Город</span>
            <span className={styles.kvValue}>{vac.location ?? '—'}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Формат</span>
            <span className={styles.kvValue}>
              {WORK_FORMAT_LABELS[vac.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? vac.workFormat}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function renderCandidate({ candidate: cand, aggregation: agg, position: pos }: CandPopoverProps) {
  const symbol = CURRENCY_SYMBOLS[cand.currency] ?? '₽';
  const initials = (cand.firstName.charAt(0) + cand.lastName.charAt(0)).toUpperCase();
  const toolIds = (agg?.toolsExperience ?? []).map((t) => t.toolId);
  return (
    <>
      <div className={styles.header}>
        <div className={`${styles.avatar} ${styles.avatarCand}`}>
          {cand.photoUrl ? (
            <img src={cand.photoUrl} alt="" className={styles.avatarImg} />
          ) : (
            initials
          )}
        </div>
        <div className={styles.headerText}>
          <div className={styles.name}>{cand.lastName} {cand.firstName}</div>
          <div className={styles.meta}>
            {pos?.name ?? '—'}{agg?.topGrade ? ` · ${GRADE_LABELS[agg.topGrade]}` : ''}
          </div>
        </div>
        <RoleBadge category={pos?.category} grade={agg?.topGrade} />
      </div>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{agg ? `${agg.totalYears}` : '—'}</div>
          <div className={styles.statLabel}>лет опыта</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {cand.salaryExpected ? `${(cand.salaryExpected / 1000).toFixed(0)}k ${symbol}` : '—'}
          </div>
          <div className={styles.statLabel}>Ожидание</div>
        </div>
      </div>

      <div className={styles.sec}>
        <div className={styles.secTitle}>Стек</div>
        <DomainToolStack toolIds={toolIds} max={12} />
      </div>

      <div className={styles.sec}>
        <div className={styles.secTitle}>О кандидате</div>
        <div className={styles.kvGrid}>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Город</span>
            <span className={styles.kvValue}>{cand.city ?? '—'}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Релокация</span>
            <span className={styles.kvValue}>{cand.relocate ? 'Да' : 'Нет'}</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Формат</span>
            <span className={styles.kvValue}>
              {WORK_FORMAT_LABELS[cand.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? cand.workFormat}
            </span>
          </div>
          <div className={styles.kv}>
            <span className={styles.kvLabel}>Гражд.</span>
            <span className={styles.kvValue}>{cand.citizenship ?? '—'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
