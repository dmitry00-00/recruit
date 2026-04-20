import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  Vacancy,
  Candidate,
  Position,
  CandidateAggregation,
  WorkEntry,
} from '@/entities';
import { GRADE_LABELS, POSITION_CATEGORY_LABELS } from '@/entities';
import { Spine } from '@/components/Spine';
import { RoleBadge } from '@/components/Spine';
import { ToolStrip } from '@/components/Spine';
import { MatchBadge } from '@/components/MatchBadge';
import {
  VACANCY_STATUS_LABELS,
  WORK_FORMAT_LABELS,
  CURRENCY_SYMBOLS,
} from '@/config';
import styles from './TabletShell.module.css';

interface CommonProps {
  positions: Position[];
  onOpenFull?: (id: string) => void;
  matchScoreById?: Record<string, number>;
  className?: string;
}

interface VacancyTabletProps extends CommonProps {
  kind: 'vacancy';
  items: Vacancy[];
}

interface CandidateTabletProps extends CommonProps {
  kind: 'candidate';
  items: Candidate[];
  aggregationById: Record<string, CandidateAggregation | undefined>;
  getWorkEntries: (candidateId: string) => Promise<WorkEntry[]>;
}

export type TabletViewProps = VacancyTabletProps | CandidateTabletProps;

function formatSalary(from?: number, to?: number, symbol = '₽'): string {
  if (from && to) return `${(from / 1000).toFixed(0)}–${(to / 1000).toFixed(0)}k ${symbol}`;
  if (from) return `от ${(from / 1000).toFixed(0)}k ${symbol}`;
  if (to) return `до ${(to / 1000).toFixed(0)}k ${symbol}`;
  return '—';
}

function formatPeriod(start: Date, end?: Date, isCurrent?: boolean): string {
  const s = start instanceof Date ? start : new Date(start);
  const e = isCurrent ? null : (end instanceof Date ? end : end ? new Date(end) : null);
  const startLabel = `${s.getFullYear()}`;
  const endLabel = e ? `${e.getFullYear()}` : isCurrent ? 'н.в.' : '—';
  return `${startLabel}–${endLabel}`;
}

function logoBg(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const h = hash % 360;
  return `hsl(${h}, 55%, 42%)`;
}

export function TabletView(props: TabletViewProps) {
  const { positions, onOpenFull, matchScoreById, kind, className } = props;
  const positionMap = useMemo(() => {
    const m = new Map<string, Position>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'card' | 'full'>('card');
  const [activeWorkEntryId, setActiveWorkEntryId] = useState<string | null>(null);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);

  // Lazy-load candidate work entries for full-sheet
  useEffect(() => {
    if (kind !== 'candidate' || mode !== 'full' || !activeId) return;
    const p = props as CandidateTabletProps;
    let cancelled = false;
    p.getWorkEntries(activeId).then((entries) => {
      if (!cancelled) setWorkEntries(entries);
    });
    return () => { cancelled = true; };
  }, [kind, mode, activeId, props]);

  const handleSpineClick = useCallback((id: string) => {
    setActiveId((prev) => (prev === id ? null : id));
    setMode('card');
    setActiveWorkEntryId(null);
    setWorkEntries([]);
  }, []);

  const col2Open = activeId !== null;
  const col3Open = col2Open && mode === 'full' && activeWorkEntryId !== null;

  // ── Render helpers ────────────────────────────────────────
  const renderDeck = () => {
    if (kind === 'vacancy') {
      return (props as VacancyTabletProps).items.map((v) => {
        const pos = positionMap.get(v.positionId) ?? null;
        const score = matchScoreById?.[v.id];
        return (
          <Spine
            key={v.id}
            kind="vacancy"
            vacancy={v}
            position={pos}
            active={activeId === v.id}
            onClick={() => handleSpineClick(v.id)}
            trailing={score != null ? <MatchBadge score={score} size="sm" /> : undefined}
          />
        );
      });
    }
    const p = props as CandidateTabletProps;
    return p.items.map((c) => {
      const agg = p.aggregationById[c.id] ?? null;
      const pos = c.positionId ? positionMap.get(c.positionId) ?? null : null;
      const score = matchScoreById?.[c.id];
      return (
        <Spine
          key={c.id}
          kind="candidate"
          candidate={c}
          aggregation={agg}
          position={pos}
          active={activeId === c.id}
          onClick={() => handleSpineClick(c.id)}
          trailing={score != null ? <MatchBadge score={score} size="sm" /> : undefined}
        />
      );
    });
  };

  const renderCol2 = () => {
    if (!activeId) return null;
    if (kind === 'vacancy') {
      const vac = (props as VacancyTabletProps).items.find((v) => v.id === activeId);
      if (!vac) return null;
      const pos = positionMap.get(vac.positionId) ?? null;
      return mode === 'card'
        ? renderVacancyCard(vac, pos)
        : renderVacancyFull(vac, pos);
    }
    const p = props as CandidateTabletProps;
    const cand = p.items.find((c) => c.id === activeId);
    if (!cand) return null;
    const agg = p.aggregationById[cand.id] ?? null;
    const pos = cand.positionId ? positionMap.get(cand.positionId) ?? null : null;
    return mode === 'card'
      ? renderCandidateCard(cand, agg, pos)
      : renderCandidateFull(cand, agg, pos);
  };

  const renderCol3 = () => {
    if (!col3Open || kind !== 'candidate') return null;
    const entry = workEntries.find((e) => e.id === activeWorkEntryId);
    if (!entry) return null;
    return renderWorkEntryDetail(entry);
  };

  // ── Vacancy views ─────────────────────────────────────────
  function renderVacancyCard(vac: Vacancy, pos: Position | null) {
    const symbol = CURRENCY_SYMBOLS[vac.currency] ?? '₽';
    const toolIds = vac.minRequirements.map((r) => r.toolId);
    const initials = vac.companyName.slice(0, 2).toUpperCase();
    return (
      <div className={styles.col2Body}>
        <div className={styles.fsHeader}>
          <div className={`${styles.avatar} ${styles.avatarVac}`}>
            {vac.companyLogoUrl
              ? <img src={vac.companyLogoUrl} alt="" className={styles.avatarImg} />
              : initials}
          </div>
          <div className={styles.fsHeaderText}>
            <div className={styles.fsName}>{vac.companyName}</div>
            <div className={styles.fsMeta}>
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
          <ToolStrip toolIds={toolIds} max={10} />
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>О вакансии</div>
          <div className={styles.demoGrid}>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Город</span>
              <span className={styles.demoValue}>{vac.location ?? '—'}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Формат</span>
              <span className={styles.demoValue}>
                {WORK_FORMAT_LABELS[vac.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? vac.workFormat}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button
            className={`${styles.linkBtn} ${styles.linkBtnPrimary}`}
            onClick={() => setMode('full')}
          >
            Полный лист →
          </button>
          {onOpenFull && (
            <button
              className={styles.linkBtn}
              onClick={(e) => { e.stopPropagation(); onOpenFull(vac.id); }}
            >
              Открыть
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderVacancyFull(vac: Vacancy, pos: Position | null) {
    const symbol = CURRENCY_SYMBOLS[vac.currency] ?? '₽';
    const maxToolIds = vac.maxRequirements.map((r) => r.toolId);
    const minToolIds = vac.minRequirements.map((r) => r.toolId);
    const initials = vac.companyName.slice(0, 2).toUpperCase();
    return (
      <div className={styles.col2Body}>
        <div className={styles.fsHeader}>
          <div className={`${styles.avatar} ${styles.avatarVac}`}>
            {vac.companyLogoUrl
              ? <img src={vac.companyLogoUrl} alt="" className={styles.avatarImg} />
              : initials}
          </div>
          <div className={styles.fsHeaderText}>
            <div className={styles.fsName}>{vac.companyName}</div>
            <div className={styles.fsMeta}>
              {pos ? POSITION_CATEGORY_LABELS[pos.category] : '—'} · {GRADE_LABELS[vac.grade]}
            </div>
          </div>
          <RoleBadge category={pos?.category} grade={vac.grade} />
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>Требования — MIN</div>
          <ToolStrip toolIds={minToolIds} max={20} />
        </div>

        {maxToolIds.length > 0 && (
          <div className={styles.sec}>
            <div className={styles.secTitle}>Желательно — MAX</div>
            <ToolStrip toolIds={maxToolIds} max={20} />
          </div>
        )}

        <div className={styles.sec}>
          <div className={styles.secTitle}>Условия</div>
          <div className={styles.demoGrid}>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Зарплата</span>
              <span className={styles.demoValue}>{formatSalary(vac.salaryFrom, vac.salaryTo, symbol)}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Статус</span>
              <span className={styles.demoValue}>{VACANCY_STATUS_LABELS[vac.status]}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Город</span>
              <span className={styles.demoValue}>{vac.location ?? '—'}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Формат</span>
              <span className={styles.demoValue}>
                {WORK_FORMAT_LABELS[vac.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? vac.workFormat}
              </span>
            </div>
          </div>
        </div>

        {vac.notes && (
          <div className={styles.sec}>
            <div className={styles.secTitle}>Заметки</div>
            <p className={styles.textLine}>{vac.notes}</p>
          </div>
        )}

        <div className={styles.actionRow}>
          <button className={styles.linkBtn} onClick={() => setMode('card')}>← Карточка</button>
          {onOpenFull && (
            <button
              className={`${styles.linkBtn} ${styles.linkBtnPrimary}`}
              onClick={(e) => { e.stopPropagation(); onOpenFull(vac.id); }}
            >
              Открыть вакансию ↗
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Candidate views ─────────────────────────────────────
  function renderCandidateCard(
    cand: Candidate,
    agg: CandidateAggregation | null,
    pos: Position | null,
  ) {
    const symbol = CURRENCY_SYMBOLS[cand.currency] ?? '₽';
    const initials = (cand.firstName.charAt(0) + cand.lastName.charAt(0)).toUpperCase();
    const toolIds = (agg?.toolsExperience ?? []).map((t) => t.toolId);
    return (
      <div className={styles.col2Body}>
        <div className={styles.fsHeader}>
          <div className={`${styles.avatar} ${styles.avatarCand}`}>
            {cand.photoUrl
              ? <img src={cand.photoUrl} alt="" className={styles.avatarImg} />
              : initials}
          </div>
          <div className={styles.fsHeaderText}>
            <div className={styles.fsName}>{cand.lastName} {cand.firstName}</div>
            <div className={styles.fsMeta}>
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
          <ToolStrip toolIds={toolIds} max={12} />
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>О кандидате</div>
          <div className={styles.demoGrid}>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Город</span>
              <span className={styles.demoValue}>{cand.city ?? '—'}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Релокация</span>
              <span className={styles.demoValue}>{cand.relocate ? 'Да' : 'Нет'}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Формат</span>
              <span className={styles.demoValue}>
                {WORK_FORMAT_LABELS[cand.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? cand.workFormat}
              </span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Гражд.</span>
              <span className={styles.demoValue}>{cand.citizenship ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <button
            className={`${styles.linkBtn} ${styles.linkBtnPrimary}`}
            onClick={() => setMode('full')}
          >
            Полный лист →
          </button>
          {onOpenFull && (
            <button
              className={styles.linkBtn}
              onClick={(e) => { e.stopPropagation(); onOpenFull(cand.id); }}
            >
              Открыть
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderCandidateFull(
    cand: Candidate,
    agg: CandidateAggregation | null,
    pos: Position | null,
  ) {
    const initials = (cand.firstName.charAt(0) + cand.lastName.charAt(0)).toUpperCase();
    const sortedEntries = [...workEntries].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
    );
    return (
      <div className={styles.col2Body}>
        <div className={styles.fsHeader}>
          <div className={`${styles.avatar} ${styles.avatarCand}`}>
            {cand.photoUrl
              ? <img src={cand.photoUrl} alt="" className={styles.avatarImg} />
              : initials}
          </div>
          <div className={styles.fsHeaderText}>
            <div className={styles.fsName}>{cand.lastName} {cand.firstName}</div>
            <div className={styles.fsMeta}>
              {pos?.name ?? '—'}{agg?.topGrade ? ` · ${GRADE_LABELS[agg.topGrade]}` : ''} · {cand.city ?? '—'}
            </div>
          </div>
          <RoleBadge category={pos?.category} grade={agg?.topGrade} />
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>Опыт работы</div>
          {sortedEntries.length === 0 ? (
            <p className={styles.textLine} style={{ color: 'var(--text-tertiary)' }}>
              Опыт не указан
            </p>
          ) : (
            <div className={styles.subDeck}>
              {sortedEntries.map((entry) => {
                const entryPos = positionMap.get(entry.positionId) ?? null;
                const bg = logoBg(entry.companyName);
                const isActive = activeWorkEntryId === entry.id;
                const short = entry.companyName.slice(0, 2).toUpperCase();
                return (
                  <div
                    key={entry.id}
                    className={`${styles.expSpine} ${isActive ? styles.expSpineActive : ''}`}
                    onClick={() => setActiveWorkEntryId(isActive ? null : entry.id)}
                  >
                    <div className={styles.expLogo} style={{ background: bg }}>
                      {entry.companyLogoUrl
                        ? <img src={entry.companyLogoUrl} alt="" className={styles.expLogoImg} />
                        : short}
                    </div>
                    <span className={styles.expTitle}>{entryPos?.name ?? entry.companyName}</span>
                    <RoleBadge category={entryPos?.category} grade={entry.grade} size={11} />
                    <span className={styles.expPeriod}>{formatPeriod(entry.startDate, entry.endDate, entry.isCurrent)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>О кандидате</div>
          <div className={styles.demoGrid}>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Город</span>
              <span className={styles.demoValue}>{cand.city ?? '—'}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Релокация</span>
              <span className={styles.demoValue}>{cand.relocate ? 'Да' : 'Нет'}</span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Формат</span>
              <span className={styles.demoValue}>
                {WORK_FORMAT_LABELS[cand.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? cand.workFormat}
              </span>
            </div>
            <div className={styles.demoItem}>
              <span className={styles.demoLabel}>Гражд.</span>
              <span className={styles.demoValue}>{cand.citizenship ?? '—'}</span>
            </div>
            {(cand.email || cand.phone || cand.telegramHandle) && (
              <div className={`${styles.demoItem} ${styles.demoItemWide}`}>
                <span className={styles.demoLabel}>Контакты</span>
                <span className={styles.demoValue}>
                  {[cand.phone, cand.email, cand.telegramHandle].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actionRow}>
          <button className={styles.linkBtn} onClick={() => setMode('card')}>← Карточка</button>
          {onOpenFull && (
            <button
              className={`${styles.linkBtn} ${styles.linkBtnPrimary}`}
              onClick={(e) => { e.stopPropagation(); onOpenFull(cand.id); }}
            >
              Открыть профиль ↗
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderWorkEntryDetail(entry: WorkEntry) {
    const entryPos = positionMap.get(entry.positionId) ?? null;
    const symbol = CURRENCY_SYMBOLS[entry.currency] ?? '₽';
    const toolIds = entry.tools.map((t) => t.toolId);
    const bg = logoBg(entry.companyName);
    const short = entry.companyName.slice(0, 2).toUpperCase();
    return (
      <div className={styles.col3Body}>
        <div className={styles.fsHeader}>
          <div className={styles.expLogo} style={{ background: bg, width: 32, height: 32, borderRadius: 8, fontSize: 12 }}>
            {entry.companyLogoUrl
              ? <img src={entry.companyLogoUrl} alt="" className={styles.expLogoImg} />
              : short}
          </div>
          <div className={styles.fsHeaderText}>
            <div className={styles.fsName}>{entry.companyName}</div>
            <div className={styles.fsMeta}>
              {entryPos?.name ?? '—'} · {GRADE_LABELS[entry.grade]} · {formatPeriod(entry.startDate, entry.endDate, entry.isCurrent)}
            </div>
          </div>
          <RoleBadge category={entryPos?.category} grade={entry.grade} />
        </div>

        {entry.responsibilities && (
          <div className={styles.sec}>
            <div className={styles.secTitle}>Задачи</div>
            <p className={styles.textLine}>{entry.responsibilities}</p>
          </div>
        )}

        {toolIds.length > 0 && (
          <div className={styles.sec}>
            <div className={styles.secTitle}>Стек</div>
            <ToolStrip toolIds={toolIds} max={20} />
          </div>
        )}

        {entry.salary != null && (
          <div className={styles.sec}>
            <div className={styles.secTitle}>Зарплата</div>
            <p className={styles.textLine}>
              {(entry.salary / 1000).toFixed(0)}k {symbol}
            </p>
          </div>
        )}

        <div className={styles.actionRow}>
          <button className={styles.linkBtn} onClick={() => setActiveWorkEntryId(null)}>
            ← Весь опыт
          </button>
        </div>
      </div>
    );
  }

  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.tablet} ${className ?? ''}`}>
      <div className={styles.col1}>{renderDeck()}</div>

      <div className={`${styles.col2} ${col2Open ? styles.open : ''} ${col3Open ? styles.merged : ''}`}>
        {renderCol2()}
      </div>

      <div className={`${styles.col3} ${col3Open ? styles.open : ''}`}>
        {renderCol3()}
      </div>
    </div>
  );
}
