import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useFilterStore, useVacancyStore, useCandidateStore, usePositionStore, useAuthStore } from '@/stores';
import { VacancyCard } from '@/components/VacancyCard';
import { CandidateCard } from '@/components/CandidateCard';
import { RoadMap } from '@/components/RoadMap';
import { EmptyState, Button } from '@/components/ui';
import { VACANCY_STATUS_LABELS, CURRENCY_SYMBOLS, WORK_FORMAT_LABELS } from '@/config';
import { GRADE_LABELS, GRADE_ORDER } from '@/entities';
import { computeRoadmap, getToolSubcategoryMap, getSubcategoryById, getToolById } from '@/utils';
import type { ViewMode, Vacancy, Candidate, Grade } from '@/entities';
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

  const { recordType, positionCategory, positionSubcategory, section } = useFilterStore();
  const { vacancies, loading: vLoading, load: loadVacancies } = useVacancyStore();
  const { candidates, loading: cLoading, load: loadCandidates } = useCandidateStore();
  const { positions, load: loadPositions } = usePositionStore();
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Sort state
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Table filter state
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    loadVacancies();
    loadCandidates();
    loadPositions();
  }, [loadVacancies, loadCandidates, loadPositions]);

  // ── Build position lookup map ──────────────────────────────
  const posMap = useMemo(() => {
    const m = new Map<string, { category: string; subcategory: string; name: string }>();
    for (const p of positions) m.set(p.id, { category: p.category, subcategory: p.subcategory, name: p.name });
    return m;
  }, [positions]);

  // ── Filter vacancies by position category + subcategory ───
  const filteredVacancies = useMemo(() => {
    let list = vacancies;
    if (positionCategory) {
      list = list.filter((v) => {
        const pos = posMap.get(v.positionId);
        return pos?.category === positionCategory;
      });
    }
    if (positionSubcategory) {
      list = list.filter((v) => {
        const pos = posMap.get(v.positionId);
        return pos?.subcategory === positionSubcategory;
      });
    }
    return list;
  }, [vacancies, posMap, positionCategory, positionSubcategory]);

  // ── Filter candidates (simple text filters from table) ────
  const filteredCandidates = useMemo(() => candidates, [candidates]);

  // ── Sort helper ────────────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const setFilter = (col: string, val: string) => {
    setFilters((prev) => ({ ...prev, [col]: val }));
  };

  // ── Sorted + filtered vacancies for table ──────────────────
  const tableVacancies = useMemo(() => {
    let list = [...filteredVacancies];

    // Apply column filters
    for (const [col, val] of Object.entries(filters)) {
      if (!val) continue;
      const q = val.toLowerCase();
      list = list.filter((v) => {
        switch (col) {
          case 'company': return v.companyName.toLowerCase().includes(q);
          case 'position': return (posMap.get(v.positionId)?.name ?? v.positionId).toLowerCase().includes(q);
          case 'grade': return GRADE_LABELS[v.grade].toLowerCase().includes(q);
          case 'city': return (v.location ?? '').toLowerCase().includes(q);
          case 'format': return (WORK_FORMAT_LABELS[v.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? v.workFormat).toLowerCase().includes(q);
          case 'status': return (VACANCY_STATUS_LABELS[v.status] ?? '').toLowerCase().includes(q);
          default: return true;
        }
      });
    }

    // Sort
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        let va = '', vb = '';
        switch (sortCol) {
          case 'company': va = a.companyName; vb = b.companyName; break;
          case 'position': va = posMap.get(a.positionId)?.name ?? ''; vb = posMap.get(b.positionId)?.name ?? ''; break;
          case 'grade': return dir * (GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
          case 'salary': return dir * ((a.salaryFrom ?? 0) - (b.salaryFrom ?? 0));
          case 'city': va = a.location ?? ''; vb = b.location ?? ''; break;
          case 'format': va = a.workFormat; vb = b.workFormat; break;
          case 'status': va = a.status; vb = b.status; break;
        }
        return dir * va.localeCompare(vb, 'ru');
      });
    }
    return list;
  }, [filteredVacancies, filters, sortCol, sortDir, posMap]);

  // ── Sorted + filtered candidates for table ─────────────────
  const tableCandidates = useMemo(() => {
    let list = [...filteredCandidates];

    for (const [col, val] of Object.entries(filters)) {
      if (!val) continue;
      const q = val.toLowerCase();
      list = list.filter((c) => {
        switch (col) {
          case 'name': return `${c.lastName} ${c.firstName}`.toLowerCase().includes(q);
          case 'city': return (c.city ?? '').toLowerCase().includes(q);
          case 'format': return (WORK_FORMAT_LABELS[c.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? c.workFormat).toLowerCase().includes(q);
          case 'salary': return String(c.salaryExpected ?? '').includes(q);
          default: return true;
        }
      });
    }

    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        let va = '', vb = '';
        switch (sortCol) {
          case 'name': va = `${a.lastName} ${a.firstName}`; vb = `${b.lastName} ${b.firstName}`; break;
          case 'city': va = a.city ?? ''; vb = b.city ?? ''; break;
          case 'format': va = a.workFormat; vb = b.workFormat; break;
          case 'salary': return dir * ((a.salaryExpected ?? 0) - (b.salaryExpected ?? 0));
          default: return 0;
        }
        return dir * va.localeCompare(vb, 'ru');
      });
    }
    return list;
  }, [filteredCandidates, filters, sortCol, sortDir]);

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
    // Get all vacancies for same category/subcategory
    const posIds = positions
      .filter((p) => p.category === pos.category && (positionSubcategory ? p.subcategory === pos.subcategory : true))
      .map((p) => p.id);
    const posVacancies = vacancies.filter((v) => posIds.includes(v.positionId));
    const subMap = getToolSubcategoryMap();
    return computeRoadmap(roadmapPositionId, posVacancies, subMap);
  }, [roadmapPositionId, vacancies, positions, positionSubcategory]);

  const roadmapPosition = roadmapPositionId ? positions.find((p) => p.id === roadmapPositionId) : null;

  // ── Render helper: column header ───────────────────────────
  const Th = ({ col, label }: { col: string; label: string }) => (
    <th>
      <button className={styles.sortBtn} onClick={() => toggleSort(col)}>
        {label} <SortIcon active={sortCol === col} dir={sortDir} />
      </button>
      <input
        className={styles.filterInput}
        placeholder="..."
        value={filters[col] ?? ''}
        onChange={(e) => setFilter(col, e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );

  // ── Analytics section ──────────────────────────────────────
  if (section === 'analytics') {
    return (
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
          /* ── General roadmap: overview by position ── */
          <div className={styles.analyticsSection}>
            <h2 className={styles.analyticsTitle}>{roadmapPosition.name}</h2>
            <p className={styles.analyticsDesc}>{roadmapPosition.description}</p>

            <div className={styles.gradeCards}>
              {GRADE_ORDER.filter((g) => roadmapPosition.grades.includes(g)).map((grade) => {
                const sal = roadmapData.salaryByGrade[grade];
                const symbol = CURRENCY_SYMBOLS['RUB'];
                const subcats = Object.keys(roadmapData.matrix).filter(
                  (subId) => (roadmapData.matrix[subId]?.[grade]?.toolIds.length ?? 0) > 0,
                );
                return (
                  <div key={grade} className={styles.gradeCard}>
                    <div className={styles.gradeCardHeader}>{GRADE_LABELS[grade]}</div>
                    <div className={styles.gradeCardSalary}>
                      {sal && sal.count > 0
                        ? `${(sal.min / 1000).toFixed(0)}k – ${(sal.max / 1000).toFixed(0)}k ${symbol}`
                        : '—'}
                    </div>
                    <div className={styles.gradeCardMeta}>
                      {subcats.length} категорий инструментов
                    </div>
                    <div className={styles.gradeCardMeta}>
                      {sal?.count ?? 0} вакансий
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className={styles.analyticsSub}>Матрица инструментов</h3>
            <RoadMap data={roadmapData} />
          </div>
        ) : (
          /* ── Detailed roadmap: by specific grade ── */
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

            <div className={styles.detailedGrid}>
              {Object.entries(roadmapData.matrix).map(([subId, gradeMap]) => {
                const cell = gradeMap[roadmapGrade];
                if (!cell || cell.toolIds.length === 0) return null;
                const sub = getSubcategoryById(subId);
                return (
                  <div key={subId} className={styles.detailedCard}>
                    <div className={styles.detailedCardTitle}>{sub?.name ?? subId}</div>
                    <div className={styles.detailedToolList}>
                      {cell.toolIds.map((toolId: string) => {
                        const tool = getToolById(toolId);
                        return (
                          <div key={toolId} className={styles.detailedToolItem}>
                            {tool?.logoUrl && (
                              <img src={tool.logoUrl} alt="" className={styles.detailedToolLogo} />
                            )}
                            <span>{tool?.name ?? toolId}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className={styles.analyticsSub} style={{ marginTop: 24 }}>Зарплатная вилка — {GRADE_LABELS[roadmapGrade]}</h3>
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
    );
  }

  // ── List section ───────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.counters}>
          <div className={styles.counter}>
            <span className={styles.counterValue}>{filteredVacancies.length}</span>
            <span className={styles.counterLabel}>Вакансий</span>
          </div>
          {!isCandidateRole && (
            <div className={styles.counter}>
              <span className={styles.counterValue}>{candidates.length}</span>
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
      {!loading && effectiveRecordType === 'vacancies' && filteredVacancies.length === 0 && (
        <EmptyState
          title="Нет вакансий"
          description={positionCategory ? 'Нет вакансий для выбранного направления' : 'Создайте первую вакансию для начала работы'}
          action={!isCandidateRole ? <Button onClick={() => navigate('/vacancies/new')}>Добавить вакансию</Button> : undefined}
        />
      )}

      {!loading && effectiveRecordType === 'vacancies' && filteredVacancies.length > 0 && (
        viewMode === 'gallery' ? (
          <div className={styles.grid}>
            {filteredVacancies.map((v) => (
              <VacancyCard key={v.id} vacancy={v} onClick={() => handleNavigateVacancy(v.id)} />
            ))}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <Th col="company" label="Компания" />
                  <Th col="position" label="Должность" />
                  <Th col="grade" label="Грейд" />
                  <Th col="salary" label="Зарплата" />
                  <Th col="city" label="Город" />
                  <Th col="format" label="Формат" />
                  <Th col="status" label="Статус" />
                </tr>
              </thead>
              <tbody>
                {tableVacancies.map((v) => (
                  <tr key={v.id} className={styles.clickableRow} onClick={() => handleNavigateVacancy(v.id)}>
                    <td>{v.companyName}</td>
                    <td>{posMap.get(v.positionId)?.name ?? v.positionId}</td>
                    <td>{GRADE_LABELS[v.grade]}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {v.salaryFrom ? `${(v.salaryFrom / 1000).toFixed(0)}k` : '—'}
                      {v.salaryTo ? `–${(v.salaryTo / 1000).toFixed(0)}k` : ''}
                      {' '}{CURRENCY_SYMBOLS[v.currency] ?? ''}
                    </td>
                    <td>{v.location ?? '—'}</td>
                    <td>{WORK_FORMAT_LABELS[v.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? v.workFormat}</td>
                    <td>{VACANCY_STATUS_LABELS[v.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Candidates ── */}
      {!loading && effectiveRecordType === 'candidates' && !isCandidateRole && candidates.length === 0 && (
        <EmptyState
          title="Нет кандидатов"
          description="Добавьте кандидата для начала работы"
          action={<Button onClick={() => navigate('/candidates/new')}>Добавить кандидата</Button>}
        />
      )}

      {!loading && effectiveRecordType === 'candidates' && !isCandidateRole && candidates.length > 0 && (
        viewMode === 'gallery' ? (
          <div className={styles.grid}>
            {candidates.map((c) => (
              <CandidateCard key={c.id} candidate={c} onClick={() => handleNavigateCandidate(c.id)} />
            ))}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <Th col="name" label="Имя" />
                  <Th col="city" label="Город" />
                  <Th col="format" label="Формат" />
                  <Th col="salary" label="Ожидание" />
                </tr>
              </thead>
              <tbody>
                {tableCandidates.map((c) => (
                  <tr key={c.id} className={styles.clickableRow} onClick={() => handleNavigateCandidate(c.id)}>
                    <td>{c.lastName} {c.firstName}</td>
                    <td>{c.city ?? '—'}</td>
                    <td>{WORK_FORMAT_LABELS[c.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? c.workFormat}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.salaryExpected ? `${(c.salaryExpected / 1000).toFixed(0)}k ${CURRENCY_SYMBOLS[c.currency] ?? ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
