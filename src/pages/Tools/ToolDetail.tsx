import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Users, LayoutDashboard, TrendingUp,
  Clock, Wallet, Target,
} from 'lucide-react';
import type { WorkEntry } from '@/entities';
import { GRADE_LABELS } from '@/entities';
import {
  useVacancyStore, useCandidateStore, usePositionStore, useToolTreeStore,
} from '@/stores';
import {
  getToolById, getSubcategoryById, getCategoryById, getSubcategoryDomain,
  DOMAIN_LABELS,
} from '@/utils/toolTreeHelpers';
import { getToolUsageStats } from '@/utils/toolStats';
import { formatSalary } from '@/utils/salaryStats';
import { db } from '@/db';
import styles from './ToolDetail.module.css';

const CURRENCY_SYMBOL: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€', KZT: '₸' };

export function ToolDetail() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();

  // Subscribe to tree updates so the tool name reflects renames immediately.
  useToolTreeStore((s) => s.tree);

  const vacancies = useVacancyStore((s) => s.vacancies);
  const candidates = useCandidateStore((s) => s.candidates);
  const positions = usePositionStore((s) => s.positions);

  const loadVacancies = useVacancyStore((s) => s.load);
  const loadCandidates = useCandidateStore((s) => s.load);
  const loadPositions = usePositionStore((s) => s.load);

  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);

  useEffect(() => {
    if (vacancies.length === 0) loadVacancies();
    if (candidates.length === 0) loadCandidates();
    if (positions.length === 0) loadPositions();
  }, [vacancies.length, candidates.length, positions.length, loadVacancies, loadCandidates, loadPositions]);

  useEffect(() => {
    db.workEntries.toArray().then(setWorkEntries);
  }, []);

  const tool = toolId ? getToolById(toolId) : undefined;
  const sub = tool ? getSubcategoryById(tool.subcategoryId) : undefined;
  const cat = sub ? getCategoryById(sub.categoryId) : undefined;
  const domain = sub ? getSubcategoryDomain(sub.id) : 'misc';

  const stats = useMemo(() => {
    if (!toolId) return null;
    return getToolUsageStats(toolId, vacancies, candidates, workEntries, positions);
  }, [toolId, vacancies, candidates, workEntries, positions]);

  if (!tool || !toolId) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Назад
        </button>
        <p className={styles.empty} style={{ marginTop: 20 }}>Инструмент не найден</p>
      </div>
    );
  }

  const positionMap = new Map(positions.map((p) => [p.id, p]));

  const scarcityClass =
    !stats || stats.scarcity < 0.5 ? styles.scarcityLow :
    stats.scarcity < 1.5 ? styles.scarcityMid : styles.scarcityHigh;

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Назад
        </button>
      </div>

      <header className={styles.header}>
        <div className={styles.logoBlock}>
          {tool.logoUrl
            ? <img src={tool.logoUrl} alt={tool.name} />
            : <span className={styles.logoFallback}>{tool.name.charAt(0).toUpperCase()}</span>
          }
        </div>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{tool.name}</h1>
          <div className={styles.breadcrumb}>
            {cat && <span>{cat.name}</span>}
            {sub && <>
              <span>›</span>
              <Link to={`/tools/sub/${sub.id}`}>{sub.name}</Link>
            </>}
            <span>·</span>
            <span>{DOMAIN_LABELS[domain]}</span>
          </div>
          {tool.aliases && tool.aliases.length > 0 && (
            <div className={styles.aliases}>
              <span className={styles.aliasesLabel}>Алиасы:</span>
              {tool.aliases.join(', ')}
            </div>
          )}
        </div>
      </header>

      {stats && (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><LayoutDashboard size={11} /> Должности</span>
              <span className={styles.statValue}>{stats.positionIds.length}</span>
              <span className={styles.statHint}>включают эту подкатегорию</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><Briefcase size={11} /> Вакансии</span>
              <span className={styles.statValue}>{stats.demand}</span>
              <span className={styles.statHint}>
                {stats.vacanciesMin.length} обязат. · {stats.vacanciesMax.length} желат.
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><Users size={11} /> Кандидаты</span>
              <span className={styles.statValue}>{stats.supply}</span>
              <span className={styles.statHint}>с этим инструментом в опыте</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><Target size={11} /> Спрос/Предложение</span>
              <span className={`${styles.statValue} ${scarcityClass}`}>
                {stats.scarcity.toFixed(2)}
              </span>
              <span className={styles.statHint}>
                {stats.scarcity > 1.5 ? 'дефицит' : stats.scarcity < 0.5 ? 'избыток' : 'баланс'}
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><Clock size={11} /> Опыт (запрос)</span>
              <span className={styles.statValue}>
                {stats.avgMinYearsRequested ? stats.avgMinYearsRequested.toFixed(1) : '—'}
              </span>
              <span className={styles.statHint}>средний minYears в вакансиях</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><TrendingUp size={11} /> Опыт (факт)</span>
              <span className={styles.statValue}>
                {stats.medianYearsExperienced ? stats.medianYearsExperienced.toFixed(1) : '—'}
              </span>
              <span className={styles.statHint}>медиана у кандидатов</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}><Wallet size={11} /> Зарплата</span>
              <span className={styles.statValue}>
                {stats.avgSalaryFrom > 0
                  ? `${formatSalary(stats.avgSalaryFrom, '₽')}–${formatSalary(stats.avgSalaryTo, '₽')}`
                  : '—'}
              </span>
              <span className={styles.statHint}>средний диапазон вакансий</span>
            </div>
          </div>

          {/* ── Positions ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <LayoutDashboard size={14} /> Связанные должности
              <span className={styles.sectionCount}>{stats.positionIds.length}</span>
            </div>
            {stats.positionIds.length === 0 ? (
              <p className={styles.empty}>Нет должностей, требующих эту подкатегорию</p>
            ) : (
              <div className={styles.positionChips}>
                {stats.positionIds.map((pid) => {
                  const p = positionMap.get(pid);
                  return p ? (
                    <Link key={pid} to={`/positions/${pid}`} className={styles.positionChip}>
                      {p.name} · {p.subcategory}
                    </Link>
                  ) : null;
                })}
              </div>
            )}
          </section>

          {/* ── Vacancies ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Briefcase size={14} /> Вакансии
              <span className={styles.sectionCount}>{stats.vacanciesAll.length}</span>
            </div>
            {stats.vacanciesAll.length === 0 ? (
              <p className={styles.empty}>Нет вакансий с этим инструментом</p>
            ) : (
              <div className={styles.list}>
                {stats.vacanciesAll.slice(0, 25).map((v) => {
                  const isMin = stats.vacanciesMin.some((x) => x.id === v.id);
                  const minReq = v.minRequirements.find((r) => r.toolId === toolId);
                  const symbol = CURRENCY_SYMBOL[v.currency] ?? '₽';
                  return (
                    <div
                      key={v.id}
                      className={styles.listRow}
                      onClick={() => navigate(`/vacancies/${v.id}`)}
                    >
                      <div className={styles.listMain}>
                        <span className={styles.listTitle}>{v.companyName}</span>
                        <span className={styles.listSubtitle}>
                          {positionMap.get(v.positionId)?.name ?? v.positionId}
                          {v.location ? ` · ${v.location}` : ''}
                        </span>
                      </div>
                      <span className={styles.listGrade}>{GRADE_LABELS[v.grade]}</span>
                      <span className={isMin ? styles.tagMin : styles.tagMax}>
                        {isMin ? 'min' : 'max'}
                        {minReq?.minYears != null ? ` ${minReq.minYears}+ y` : ''}
                      </span>
                      <span className={styles.listMeta}>
                        {v.salaryFrom
                          ? `${formatSalary(v.salaryFrom, symbol)}${v.salaryTo ? '–' + formatSalary(v.salaryTo, symbol) : ''}`
                          : '—'}
                      </span>
                    </div>
                  );
                })}
                {stats.vacanciesAll.length > 25 && (
                  <div className={styles.listRow} style={{ cursor: 'default', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    … и ещё {stats.vacanciesAll.length - 25}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Candidates ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Users size={14} /> Кандидаты
              <span className={styles.sectionCount}>{stats.candidates.length}</span>
            </div>
            {stats.candidates.length === 0 ? (
              <p className={styles.empty}>Нет кандидатов с этим инструментом</p>
            ) : (
              <div className={styles.list}>
                {stats.candidates.slice(0, 25).map(({ candidate, totalYears, entries }) => (
                  <div
                    key={candidate.id}
                    className={`${styles.listRow} ${styles.listRowCandidate}`}
                    onClick={() => navigate(`/candidates/${candidate.id}`)}
                  >
                    <div className={styles.listMain}>
                      <span className={styles.listTitle}>
                        {candidate.lastName} {candidate.firstName}
                      </span>
                      <span className={styles.listSubtitle}>
                        {candidate.city ?? '—'}
                        {candidate.positionId ? ` · ${positionMap.get(candidate.positionId)?.name ?? ''}` : ''}
                      </span>
                    </div>
                    <span className={styles.listGrade}>
                      {totalYears.toFixed(1)} лет
                    </span>
                    <span className={styles.listMeta}>
                      {entries.length} {entries.length === 1 ? 'место' : 'мест'}
                    </span>
                    <span className={styles.listMeta}>
                      {entries.slice(0, 2).map((e) => e.companyName).join(', ')}
                      {entries.length > 2 ? '…' : ''}
                    </span>
                  </div>
                ))}
                {stats.candidates.length > 25 && (
                  <div className={styles.listRow} style={{ cursor: 'default', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    … и ещё {stats.candidates.length - 25}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
