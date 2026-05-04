import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useFilterStore, useVacancyStore, useCandidateStore, usePositionStore, useAuthStore } from '@/stores';
import { VacancyCard } from '@/components/VacancyCard';
import { CandidateCard } from '@/components/CandidateCard';
import { Spine } from '@/components/Spine';
import { SpinePopover } from '@/components/SpinePopover';
import { RoadMap } from '@/components/RoadMap';
import { TreePicker } from '@/components/TreePicker';
import { EmptyState, Button, Pagination } from '@/components/ui';
import { VACANCY_STATUS_LABELS, CURRENCY_SYMBOLS, WORK_FORMAT_LABELS } from '@/config';
import { GRADE_LABELS, GRADE_ORDER } from '@/entities';
import { aggregateCandidate, computeRoadmap, getToolSubcategoryMap } from '@/utils';
import { db } from '@/db';
import type {
  ViewMode, Grade, CandidateAggregation, Candidate, Vacancy, Position, WorkEntry,
  WorkFormat, VacancyStatus,
} from '@/entities';
import styles from './Dashboard.module.css';

type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronDown size={10} style={{ opacity: 0.3 }} />;
  return dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

export function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isCandidateRole = currentUser?.role === 'candidate';

  const {
    recordType,
    positionCategory,
    positionSubcategory,
    section,
    companyFilter,
    positionIdFilter,
    cityFilter,
    statusFilter,
    gradeFilter,
    salaryMin,
    salaryMax,
    workFormatFilter,
    setCompanyFilter,
    setCityFilter,
    setStatusFilter,
    setWorkFormatFilter,
    setSalaryRange,
  } = useFilterStore();
  const { vacancies, loading: vLoading, load: loadVacancies } = useVacancyStore();
  const { candidates, loading: cLoading, load: loadCandidates } = useCandidateStore();
  const { positions, load: loadPositions } = usePositionStore();
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Sort state (table only)
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Pagination state
  const PAGE_SIZE = 20;
  const [vacancyPage, setVacancyPage] = useState(1);
  const [candidatePage, setCandidatePage] = useState(1);

  // Candidate aggregation cache
  const [aggregationById, setAggregationById] = useState<Record<string, CandidateAggregation | undefined>>({});

  useEffect(() => {
    loadVacancies();
    loadCandidates();
    loadPositions();
  }, [loadVacancies, loadCandidates, loadPositions]);

  // Build aggregations for all candidates once loaded
  useEffect(() => {
    if (candidates.length === 0) return;
    let cancelled = false;
    (async () => {
      const allEntries = await db.workEntries.toArray();
      const byCandidate = new Map<string, WorkEntry[]>();
      for (const e of allEntries) {
        const arr = byCandidate.get(e.candidateId) ?? [];
        arr.push(e);
        byCandidate.set(e.candidateId, arr);
      }
      const map: Record<string, CandidateAggregation> = {};
      for (const c of candidates) {
        map[c.id] = aggregateCandidate(c, byCandidate.get(c.id) ?? []);
      }
      if (!cancelled) setAggregationById(map);
    })();
    return () => { cancelled = true; };
  }, [candidates]);

  // Reset pages when primary filters change (React 19 prev-state pattern).
  const filterKey = JSON.stringify([
    positionCategory, positionSubcategory,
    companyFilter, positionIdFilter, cityFilter, statusFilter,
    gradeFilter, salaryMin, salaryMax, workFormatFilter,
  ]);
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setVacancyPage(1);
    setCandidatePage(1);
  }

  // ── Position lookup ─────────────────────────────────────────
  const positionMap = useMemo(() => {
    const m = new Map<string, Position>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  // ── Common filter application ───────────────────────────────
  const filteredVacancies = useMemo(() => {
    let list: Vacancy[] = vacancies;

    if (positionCategory) {
      list = list.filter((v) => positionMap.get(v.positionId)?.category === positionCategory);
    }
    if (positionSubcategory) {
      list = list.filter((v) => positionMap.get(v.positionId)?.subcategory === positionSubcategory);
    }
    if (companyFilter.trim()) {
      const q = companyFilter.toLowerCase();
      list = list.filter((v) => v.companyName.toLowerCase().includes(q));
    }
    if (positionIdFilter) {
      list = list.filter((v) => v.positionId === positionIdFilter);
    }
    if (cityFilter.trim()) {
      const q = cityFilter.toLowerCase();
      list = list.filter((v) => (v.location ?? '').toLowerCase().includes(q));
    }
    if (statusFilter) {
      list = list.filter((v) => v.status === statusFilter);
    }
    if (gradeFilter.length > 0) {
      list = list.filter((v) => gradeFilter.includes(v.grade));
    }
    if (workFormatFilter.length > 0) {
      list = list.filter((v) => workFormatFilter.includes(v.workFormat));
    }
    if (salaryMin != null || salaryMax != null) {
      list = list.filter((v) => {
        const sal = v.salaryFrom ?? v.salaryTo ?? 0;
        if (sal === 0) return true;
        if (salaryMin != null && sal < salaryMin) return false;
        if (salaryMax != null && sal > salaryMax) return false;
        return true;
      });
    }
    return list;
  }, [
    vacancies, positionMap,
    positionCategory, positionSubcategory,
    companyFilter, positionIdFilter, cityFilter, statusFilter,
    gradeFilter, workFormatFilter, salaryMin, salaryMax,
  ]);

  const filteredCandidates = useMemo(() => {
    let list: Candidate[] = candidates;

    if (positionIdFilter) {
      list = list.filter((c) => c.positionId === positionIdFilter);
    }
    if (positionCategory) {
      list = list.filter((c) => {
        if (!c.positionId) return false;
        return positionMap.get(c.positionId)?.category === positionCategory;
      });
    }
    if (positionSubcategory) {
      list = list.filter((c) => {
        if (!c.positionId) return false;
        return positionMap.get(c.positionId)?.subcategory === positionSubcategory;
      });
    }
    if (cityFilter.trim()) {
      const q = cityFilter.toLowerCase();
      list = list.filter((c) => (c.city ?? '').toLowerCase().includes(q));
    }
    if (gradeFilter.length > 0) {
      list = list.filter((c) => {
        const agg = aggregationById[c.id];
        return agg ? gradeFilter.includes(agg.topGrade) : false;
      });
    }
    if (workFormatFilter.length > 0) {
      list = list.filter((c) => c.workFormat !== 'any' && workFormatFilter.includes(c.workFormat));
    }
    if (salaryMin != null || salaryMax != null) {
      list = list.filter((c) => {
        const sal = c.salaryExpected ?? 0;
        if (sal === 0) return true;
        if (salaryMin != null && sal < salaryMin) return false;
        if (salaryMax != null && sal > salaryMax) return false;
        return true;
      });
    }
    return list;
  }, [
    candidates, positionMap, aggregationById,
    positionCategory, positionSubcategory,
    positionIdFilter, cityFilter,
    gradeFilter, workFormatFilter, salaryMin, salaryMax,
  ]);

  // ── Sort for table view ─────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setVacancyPage(1);
    setCandidatePage(1);
  };

  const tableVacancies = useMemo(() => {
    const list = [...filteredVacancies];
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        let va = '', vb = '';
        switch (sortCol) {
          case 'company':  va = a.companyName; vb = b.companyName; break;
          case 'position': va = positionMap.get(a.positionId)?.name ?? ''; vb = positionMap.get(b.positionId)?.name ?? ''; break;
          case 'grade':    return dir * (GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
          case 'salary':   return dir * ((a.salaryFrom ?? 0) - (b.salaryFrom ?? 0));
          case 'city':     va = a.location ?? ''; vb = b.location ?? ''; break;
          case 'format':   va = a.workFormat; vb = b.workFormat; break;
          case 'status':   va = a.status; vb = b.status; break;
        }
        return dir * va.localeCompare(vb, 'ru');
      });
    }
    return list;
  }, [filteredVacancies, sortCol, sortDir, positionMap]);

  const tableCandidates = useMemo(() => {
    const list = [...filteredCandidates];
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        let va = '', vb = '';
        switch (sortCol) {
          case 'name':    va = `${a.lastName} ${a.firstName}`; vb = `${b.lastName} ${b.firstName}`; break;
          case 'city':    va = a.city ?? ''; vb = b.city ?? ''; break;
          case 'cformat': va = a.workFormat; vb = b.workFormat; break;
          case 'salary':  return dir * ((a.salaryExpected ?? 0) - (b.salaryExpected ?? 0));
          default: return 0;
        }
        return dir * va.localeCompare(vb, 'ru');
      });
    }
    return list;
  }, [filteredCandidates, sortCol, sortDir]);

  // ── Paged slices ────────────────────────────────────────────
  const pagedVacancies = useMemo(() => {
    const source = viewMode === 'table' ? tableVacancies : filteredVacancies;
    const start = (vacancyPage - 1) * PAGE_SIZE;
    return source.slice(start, start + PAGE_SIZE);
  }, [viewMode, tableVacancies, filteredVacancies, vacancyPage]);

  const pagedCandidates = useMemo(() => {
    const source = viewMode === 'table' ? tableCandidates : filteredCandidates;
    const start = (candidatePage - 1) * PAGE_SIZE;
    return source.slice(start, start + PAGE_SIZE);
  }, [viewMode, tableCandidates, filteredCandidates, candidatePage]);

  const vacancyTotal = filteredVacancies.length;
  const candidateTotal = filteredCandidates.length;

  const handleNavigateVacancy = useCallback((id: string) => navigate(`/vacancies/${id}`), [navigate]);
  const handleNavigateCandidate = useCallback((id: string) => navigate(`/candidates/${id}`), [navigate]);

  const loading = recordType === 'vacancies' ? vLoading : cLoading;
  const effectiveRecordType = isCandidateRole ? 'vacancies' : recordType;

  // ── Roadmap data for analytics ─────────────────────────────
  const [roadmapMode, setRoadmapMode] = useState<'general' | 'detailed'>('general');
  const [roadmapGrade, setRoadmapGrade] = useState<Grade>('middle');

  const roadmapPositionId = useMemo(() => {
    if (positionCategory && positionSubcategory) {
      const pos = positions.find((p) => p.category === positionCategory && p.subcategory === positionSubcategory);
      return pos?.id ?? null;
    }
    if (positionCategory) {
      const pos = positions.find((p) => p.category === positionCategory);
      return pos?.id ?? null;
    }
    return positions[0]?.id ?? null;
  }, [positions, positionCategory, positionSubcategory]);

  const roadmapData = useMemo(() => {
    if (!roadmapPositionId) return null;
    const pos = positions.find((p) => p.id === roadmapPositionId);
    if (!pos) return null;
    const posIds = positions
      .filter((p) => p.category === pos.category && (positionSubcategory ? p.subcategory === pos.subcategory : true))
      .map((p) => p.id);
    const posVacancies = vacancies.filter((v) => posIds.includes(v.positionId));
    const subMap = getToolSubcategoryMap();
    return computeRoadmap(roadmapPositionId, posVacancies, subMap);
  }, [roadmapPositionId, vacancies, positions, positionSubcategory]);

  const roadmapPosition = roadmapPositionId ? positions.find((p) => p.id === roadmapPositionId) : null;

  const detailedToolIds = useMemo(() => {
    if (!roadmapData) return [];
    const ids: string[] = [];
    for (const [, gradeMap] of Object.entries(roadmapData.matrix)) {
      const cell = gradeMap[roadmapGrade];
      if (cell) ids.push(...cell.toolIds);
    }
    return ids;
  }, [roadmapData, roadmapGrade]);

  const detailedFilteredSubIds = useMemo(() => {
    if (!roadmapData) return [];
    return Object.keys(roadmapData.matrix);
  }, [roadmapData]);

  // ── Table column header ─────────────────────────────────────
  const renderSortBtn = (col: string, label: string) => (
    <button className={styles.sortBtn} onClick={() => toggleSort(col)}>
      {label} <SortIcon active={sortCol === col} dir={sortDir} />
    </button>
  );

  // ── Spine popover (for both gallery and table) ──────────────
  type PopoverState = { kind: 'vacancy' | 'candidate'; id: string; anchor: DOMRect };
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const handleSpineClick = (kind: 'vacancy' | 'candidate', id: string, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPopover((prev) => (prev && prev.id === id ? null : { kind, id, anchor: rect }));
  };

  const popoverVac = popover?.kind === 'vacancy'
    ? vacancies.find((v) => v.id === popover.id)
    : null;
  const popoverCand = popover?.kind === 'candidate'
    ? candidates.find((c) => c.id === popover.id)
    : null;

  const spineRefs = useRef<Record<string, HTMLElement | null>>({});
  const setSpineRef = (id: string) => (el: HTMLElement | null) => {
    spineRefs.current[id] = el;
  };

  // Recompute anchor on scroll/resize so popover follows
  useEffect(() => {
    if (!popover) return;
    const recompute = () => {
      const el = spineRefs.current[popover.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPopover((p) => (p ? { ...p, anchor: rect } : p));
    };
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [popover?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatOptions = Object.entries(WORK_FORMAT_LABELS)
    .filter(([k]) => k !== 'any')
    .map(([v, l]) => ({ value: v, label: l }));
  const statusOptions = Object.entries(VACANCY_STATUS_LABELS)
    .map(([v, l]) => ({ value: v, label: l }));

  // ── Analytics section ──────────────────────────────────────
  if (section === 'analytics') {
    return (
      <>
        <div className={styles.page}>
          <div className={styles.header}>
            <div className={styles.counters}>
              <div className={styles.counter}>
                <span className={styles.counterValue}>{vacancies.length}</span>
                <span className={styles.counterLabel}>Вакансий</span>
              </div>
              <div className={styles.counter}>
                <span className={styles.counterValue}>{candidates.length}</span>
                <span className={styles.counterLabel}>Кандидатов</span>
              </div>
            </div>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${roadmapMode === 'general' ? styles.viewBtnActive : ''}`}
                onClick={() => setRoadmapMode('general')}
              >
                Общий
              </button>
              <button
                className={`${styles.viewBtn} ${roadmapMode === 'detailed' ? styles.viewBtnActive : ''}`}
                onClick={() => setRoadmapMode('detailed')}
              >
                Детальный
              </button>
            </div>
          </div>

          {!roadmapData || !roadmapPosition ? (
            <EmptyState
              title="Нет данных для аналитики"
              description="Выберите категорию и направление в верхнем меню"
            />
          ) : roadmapMode === 'general' ? (
            <div className={styles.analyticsSection}>
              <h2 className={styles.analyticsTitle}>{roadmapPosition.name}</h2>
              <p className={styles.analyticsDesc}>{roadmapPosition.description}</p>
              <RoadMap data={roadmapData} />
            </div>
          ) : (
            <div className={styles.analyticsSection}>
              <div className={styles.gradeSelector}>
                <span className={styles.analyticsSub}>Детальный roadmap для грейда:</span>
                <div className={styles.viewToggle}>
                  {GRADE_ORDER.filter((g) => roadmapPosition.grades.includes(g)).map((g) => (
                    <button
                      key={g}
                      className={`${styles.viewBtn} ${roadmapGrade === g ? styles.viewBtnActive : ''}`}
                      onClick={() => setRoadmapGrade(g)}
                    >
                      {GRADE_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.detailedPickerWrap}>
                <TreePicker
                  mode="candidate-agg"
                  selected={detailedToolIds}
                  yearsMap={{}}
                  filteredSubIds={detailedFilteredSubIds}
                />
              </div>

              <h3 className={styles.analyticsSub} style={{ marginTop: 16 }}>
                Зарплатная вилка — {GRADE_LABELS[roadmapGrade]}
              </h3>
              {(() => {
                const sal = roadmapData.salaryByGrade[roadmapGrade];
                const symbol = CURRENCY_SYMBOLS['RUB'];
                return sal && sal.count > 0 ? (
                  <div className={styles.salaryBar}>
                    <span className={styles.salaryValue}>{(sal.min / 1000).toFixed(0)}k {symbol}</span>
                    <div className={styles.salaryBarTrack}>
                      <div className={styles.salaryBarFill} />
                      <div className={styles.salaryBarMedian} style={{ left: `${sal.max > 0 ? ((sal.median - sal.min) / (sal.max - sal.min)) * 100 : 50}%` }}>
                        <span className={styles.salaryMedianLabel}>{(sal.median / 1000).toFixed(0)}k</span>
                      </div>
                    </div>
                    <span className={styles.salaryValue}>{(sal.max / 1000).toFixed(0)}k {symbol}</span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Нет данных о зарплатах</div>
                );
              })()}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── List section ───────────────────────────────────────────
  return (
    <>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.counters}>
            <div className={styles.counter}>
              <span className={styles.counterValue}>{vacancyTotal}</span>
              <span className={styles.counterLabel}>Вакансий</span>
            </div>
            {!isCandidateRole && (
              <div className={styles.counter}>
                <span className={styles.counterValue}>{candidateTotal}</span>
                <span className={styles.counterLabel}>Кандидатов</span>
              </div>
            )}
          </div>
          <div className={styles.viewToggle}>
            {!isCandidateRole && (
              <button
                className={styles.viewBtn}
                onClick={() => navigate(effectiveRecordType === 'vacancies' ? '/vacancies/import' : '/candidates/import')}
                title={effectiveRecordType === 'vacancies' ? 'Импорт вакансий' : 'Импорт резюме'}
              >
                <Upload size={14} />
              </button>
            )}
            <button
              className={`${styles.viewBtn} ${viewMode === 'gallery' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('gallery')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>Загрузка...</div>}

        {/* ── Vacancies ── */}
        {!loading && effectiveRecordType === 'vacancies' && vacancyTotal === 0 && (
          <EmptyState
            title="Нет вакансий"
            description={positionCategory ? 'Нет вакансий для выбранного направления' : 'Создайте первую вакансию для начала работы'}
            action={!isCandidateRole ? <Button onClick={() => navigate('/vacancies/new')}>Добавить вакансию</Button> : undefined}
          />
        )}

        {!loading && effectiveRecordType === 'vacancies' && vacancyTotal > 0 && (
          viewMode === 'gallery' ? (
            <>
              <div className={styles.cardGrid}>
                {pagedVacancies.map((v) => (
                  <VacancyCard
                    key={v.id}
                    vacancy={v}
                    onClick={() => handleNavigateVacancy(v.id)}
                  />
                ))}
              </div>
              <Pagination totalItems={vacancyTotal} pageSize={PAGE_SIZE} currentPage={vacancyPage} onPageChange={setVacancyPage} />
            </>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.spineCol}>
                        {renderSortBtn('company', 'Вакансия')}
                      </th>
                      <th>{renderSortBtn('salary', 'Зарплата')}</th>
                      <th>{renderSortBtn('city', 'Город')}</th>
                      <th>{renderSortBtn('format', 'Формат')}</th>
                      <th>{renderSortBtn('status', 'Статус')}</th>
                    </tr>
                    <tr className={styles.filterRow}>
                      <th className={styles.spineCol}>
                        <input
                          className={styles.filterInput}
                          placeholder="Фильтр по компании…"
                          value={companyFilter}
                          onChange={(e) => setCompanyFilter(e.target.value)}
                        />
                      </th>
                      <th>
                        <div className={styles.filterRange}>
                          <input
                            className={styles.filterInputSmall}
                            type="number"
                            placeholder="от"
                            value={salaryMin != null ? Math.round(salaryMin / 1000) : ''}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setSalaryRange(Number.isFinite(n) && n > 0 ? n * 1000 : undefined, salaryMax);
                            }}
                          />
                          <span className={styles.rangeSep}>–</span>
                          <input
                            className={styles.filterInputSmall}
                            type="number"
                            placeholder="до"
                            value={salaryMax != null ? Math.round(salaryMax / 1000) : ''}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setSalaryRange(salaryMin, Number.isFinite(n) && n > 0 ? n * 1000 : undefined);
                            }}
                          />
                        </div>
                      </th>
                      <th>
                        <input
                          className={styles.filterInput}
                          placeholder="Город…"
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                        />
                      </th>
                      <th>
                        <select
                          className={styles.filterSelect}
                          value={workFormatFilter[0] ?? ''}
                          onChange={(e) =>
                            setWorkFormatFilter(e.target.value ? [e.target.value as WorkFormat] : [])
                          }
                        >
                          <option value="">Все</option>
                          {formatOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </th>
                      <th>
                        <select
                          className={styles.filterSelect}
                          value={statusFilter ?? ''}
                          onChange={(e) => setStatusFilter((e.target.value || null) as VacancyStatus | null)}
                        >
                          <option value="">Все</option>
                          {statusOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedVacancies.map((v) => {
                      const pos = positionMap.get(v.positionId) ?? null;
                      return (
                        <tr key={v.id} className={styles.clickableRow} onClick={() => handleNavigateVacancy(v.id)}>
                          <td className={styles.spineCol} style={{ padding: 4 }}>
                            <div
                              ref={setSpineRef(v.id)}
                              className={styles.spineWrap}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSpineClick('vacancy', v.id, e.currentTarget);
                              }}
                            >
                              <Spine
                                kind="vacancy"
                                vacancy={v}
                                position={pos}
                                compact
                                active={popover?.id === v.id}
                              />
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {v.salaryFrom ? `${(v.salaryFrom / 1000).toFixed(0)}k` : '—'}
                            {v.salaryTo ? `–${(v.salaryTo / 1000).toFixed(0)}k` : ''}
                            {' '}{CURRENCY_SYMBOLS[v.currency] ?? ''}
                          </td>
                          <td>{v.location ?? '—'}</td>
                          <td>{WORK_FORMAT_LABELS[v.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? v.workFormat}</td>
                          <td>{VACANCY_STATUS_LABELS[v.status]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination totalItems={vacancyTotal} pageSize={PAGE_SIZE} currentPage={vacancyPage} onPageChange={setVacancyPage} />
            </>
          )
        )}

        {/* ── Candidates ── */}
        {!loading && effectiveRecordType === 'candidates' && !isCandidateRole && candidateTotal === 0 && (
          <EmptyState
            title="Нет кандидатов"
            description="Добавьте кандидата для начала работы"
            action={<Button onClick={() => navigate('/candidates/new')}>Добавить кандидата</Button>}
          />
        )}

        {!loading && effectiveRecordType === 'candidates' && !isCandidateRole && candidateTotal > 0 && (
          viewMode === 'gallery' ? (
            <>
              <div className={styles.cardGrid}>
                {pagedCandidates.map((c) => {
                  const agg = aggregationById[c.id];
                  return (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      aggregation={agg}
                      onClick={() => handleNavigateCandidate(c.id)}
                    />
                  );
                })}
              </div>
              <Pagination totalItems={candidateTotal} pageSize={PAGE_SIZE} currentPage={candidatePage} onPageChange={setCandidatePage} />
            </>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.spineCol}>
                        {renderSortBtn('name', 'Кандидат')}
                      </th>
                      <th>{renderSortBtn('city', 'Город')}</th>
                      <th>{renderSortBtn('cformat', 'Формат')}</th>
                      <th>{renderSortBtn('salary', 'Ожидание')}</th>
                    </tr>
                    <tr className={styles.filterRow}>
                      <th className={styles.spineCol} />
                      <th>
                        <input
                          className={styles.filterInput}
                          placeholder="Город…"
                          value={cityFilter}
                          onChange={(e) => setCityFilter(e.target.value)}
                        />
                      </th>
                      <th>
                        <select
                          className={styles.filterSelect}
                          value={workFormatFilter[0] ?? ''}
                          onChange={(e) =>
                            setWorkFormatFilter(e.target.value ? [e.target.value as WorkFormat] : [])
                          }
                        >
                          <option value="">Все</option>
                          {formatOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </th>
                      <th>
                        <div className={styles.filterRange}>
                          <input
                            className={styles.filterInputSmall}
                            type="number"
                            placeholder="от"
                            value={salaryMin != null ? Math.round(salaryMin / 1000) : ''}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setSalaryRange(Number.isFinite(n) && n > 0 ? n * 1000 : undefined, salaryMax);
                            }}
                          />
                          <span className={styles.rangeSep}>–</span>
                          <input
                            className={styles.filterInputSmall}
                            type="number"
                            placeholder="до"
                            value={salaryMax != null ? Math.round(salaryMax / 1000) : ''}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setSalaryRange(salaryMin, Number.isFinite(n) && n > 0 ? n * 1000 : undefined);
                            }}
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCandidates.map((c) => {
                      const agg = aggregationById[c.id] ?? null;
                      const pos = c.positionId ? positionMap.get(c.positionId) ?? null : null;
                      return (
                        <tr key={c.id} className={styles.clickableRow} onClick={() => handleNavigateCandidate(c.id)}>
                          <td className={styles.spineCol} style={{ padding: 4 }}>
                            <div
                              ref={setSpineRef(c.id)}
                              className={styles.spineWrap}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSpineClick('candidate', c.id, e.currentTarget);
                              }}
                            >
                              <Spine
                                kind="candidate"
                                candidate={c}
                                aggregation={agg}
                                position={pos}
                                compact
                                active={popover?.id === c.id}
                              />
                            </div>
                          </td>
                          <td>{c.city ?? '—'}</td>
                          <td>{WORK_FORMAT_LABELS[c.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? c.workFormat}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {c.salaryExpected ? `${(c.salaryExpected / 1000).toFixed(0)}k ${CURRENCY_SYMBOLS[c.currency] ?? ''}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination totalItems={candidateTotal} pageSize={PAGE_SIZE} currentPage={candidatePage} onPageChange={setCandidatePage} />
            </>
          )
        )}

        {popover && popoverVac && (
          <SpinePopover
            kind="vacancy"
            vacancy={popoverVac}
            position={positionMap.get(popoverVac.positionId) ?? null}
            anchor={popover.anchor}
            onClose={() => setPopover(null)}
            onOpenFull={() => {
              setPopover(null);
              handleNavigateVacancy(popoverVac.id);
            }}
          />
        )}
        {popover && popoverCand && (
          <SpinePopover
            kind="candidate"
            candidate={popoverCand}
            aggregation={aggregationById[popoverCand.id] ?? null}
            position={popoverCand.positionId ? positionMap.get(popoverCand.positionId) ?? null : null}
            anchor={popover.anchor}
            onClose={() => setPopover(null)}
            onOpenFull={() => {
              setPopover(null);
              handleNavigateCandidate(popoverCand.id);
            }}
          />
        )}
      </div>
    </>
  );
}
