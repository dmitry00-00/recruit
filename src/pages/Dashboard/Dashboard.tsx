import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useFilterStore, useVacancyStore, useCandidateStore, usePositionStore, useAuthStore } from '@/stores';
import { VacancyCard } from '@/components/VacancyCard';
import { CandidateCard } from '@/components/CandidateCard';
import { RoadMap } from '@/components/RoadMap';
import { TreePicker } from '@/components/TreePicker';
import { EmptyState, Button } from '@/components/ui';
import { VACANCY_STATUS_LABELS, CURRENCY_SYMBOLS, WORK_FORMAT_LABELS } from '@/config';
import { GRADE_LABELS, GRADE_ORDER } from '@/entities';
import { computeRoadmap, getToolSubcategoryMap, getSubcategoryById, getToolById } from '@/utils';
import type { ViewMode, Grade } from '@/entities';
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
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, 1000]);

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

  // ── Salary range bounds ────────────────────────────────────
  const salaryBounds = useMemo(() => {
    let min = Infinity, max = 0;
    for (const v of vacancies) {
      if (v.salaryFrom) { min = Math.min(min, v.salaryFrom); max = Math.max(max, v.salaryFrom); }
      if (v.salaryTo) { max = Math.max(max, v.salaryTo); }
    }
    if (min === Infinity) min = 0;
    return { min: Math.floor(min / 1000) * 1000, max: Math.ceil(max / 1000) * 1000 || 1000 };
  }, [vacancies]);

  // Init salary range when bounds change
  useEffect(() => {
    setSalaryRange([salaryBounds.min, salaryBounds.max]);
  }, [salaryBounds.min, salaryBounds.max]);

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
      if (col === 'grade' || col === 'format' || col === 'status') {
        // Select-based: exact match
        list = list.filter((v) => {
          switch (col) {
            case 'grade': return v.grade === val;
            case 'format': return v.workFormat === val;
            case 'status': return v.status === val;
            default: return true;
          }
        });
      } else {
        // Text-based
        const q = val.toLowerCase();
        list = list.filter((v) => {
          switch (col) {
            case 'company': return v.companyName.toLowerCase().includes(q);
            case 'position': return (posMap.get(v.positionId)?.name ?? v.positionId).toLowerCase().includes(q);
            case 'city': return (v.location ?? '').toLowerCase().includes(q);
            default: return true;
          }
        });
      }
    }

    // Salary range filter
    list = list.filter((v) => {
      const sal = v.salaryFrom ?? v.salaryTo ?? 0;
      if (sal === 0) return true; // no salary info → show
      return sal >= salaryRange[0] && sal <= salaryRange[1];
    });

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
  }, [filteredVacancies, filters, salaryRange, sortCol, sortDir, posMap]);

  // ── Sorted + filtered candidates for table ─────────────────
  const tableCandidates = useMemo(() => {
    let list = [...filteredCandidates];

    for (const [col, val] of Object.entries(filters)) {
      if (!val) continue;
      if (col === 'cformat') {
        list = list.filter((c) => c.workFormat === val);
      } else if (col === 'crelocate') {
        list = list.filter((c) => (val === 'yes') === c.relocate);
      } else {
        const q = val.toLowerCase();
        list = list.filter((c) => {
          switch (col) {
            case 'name': return `${c.lastName} ${c.firstName}`.toLowerCase().includes(q);
            case 'city': return (c.city ?? '').toLowerCase().includes(q);
            default: return true;
          }
        });
      }
    }

    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        let va = '', vb = '';
        switch (sortCol) {
          case 'name': va = `${a.lastName} ${a.firstName}`; vb = `${b.lastName} ${b.firstName}`; break;
          case 'city': va = a.city ?? ''; vb = b.city ?? ''; break;
          case 'cformat': va = a.workFormat; vb = b.workFormat; break;
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
    const posIds = positions
      .filter((p) => p.category === pos.category && (positionSubcategory ? p.subcategory === pos.subcategory : true))
      .map((p) => p.id);
    const posVacancies = vacancies.filter((v) => posIds.includes(v.positionId));
    const subMap = getToolSubcategoryMap();
    return computeRoadmap(roadmapPositionId, posVacancies, subMap);
  }, [roadmapPositionId, vacancies, positions, positionSubcategory]);

  const roadmapPosition = roadmapPositionId ? positions.find((p) => p.id === roadmapPositionId) : null;

  // ── Detailed roadmap: build selected/yearsMap for TreePicker readonly ──
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

  // ── Render helper: typed column header ─────────────────────
  const ThText = ({ col, label }: { col: string; label: string }) => (
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

  const ThSelect = ({ col, label, options }: { col: string; label: string; options: { value: string; label: string }[] }) => (
    <th>
      <button className={styles.sortBtn} onClick={() => toggleSort(col)}>
        {label} <SortIcon active={sortCol === col} dir={sortDir} />
      </button>
      <select
        className={styles.filterSelect}
        value={filters[col] ?? ''}
        onChange={(e) => setFilter(col, e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">Все</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </th>
  );

  const ThSalary = ({ col, label }: { col: string; label: string }) => (
    <th>
      <button className={styles.sortBtn} onClick={() => toggleSort(col)}>
        {label} <SortIcon active={sortCol === col} dir={sortDir} />
      </button>
      <div className={styles.filterRange}>
        <input
          type="range"
          className={styles.rangeSlider}
          min={salaryBounds.min}
          max={salaryBounds.max}
          step={10000}
          value={salaryRange[0]}
          onChange={(e) => setSalaryRange([parseInt(e.target.value), salaryRange[1]])}
          onClick={(e) => e.stopPropagation()}
        />
        <span className={styles.rangeLabel}>
          {(salaryRange[0] / 1000).toFixed(0)}k–{(salaryRange[1] / 1000).toFixed(0)}k
        </span>
      </div>
    </th>
  );

  const gradeOptions = GRADE_ORDER.map((g) => ({ value: g, label: GRADE_LABELS[g] }));
  const formatOptions = Object.entries(WORK_FORMAT_LABELS)
    .filter(([k]) => k !== 'any')
    .map(([v, l]) => ({ value: v, label: l }));
  const statusOptions = Object.entries(VACANCY_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const relocateOptions = [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }];

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
          /* ── General roadmap: combined table with salary row ── */
          <div className={styles.analyticsSection}>
            <h2 className={styles.analyticsTitle}>{roadmapPosition.name}</h2>
            <p className={styles.analyticsDesc}>{roadmapPosition.description}</p>
            <RoadMap data={roadmapData} />
          </div>
        ) : (
          /* ── Detailed roadmap: TreePicker format ── */
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

            <h3 className={styles.analyticsSub} style={{ marginTop: 16 }}>Зарплатная вилка — {GRADE_LABELS[roadmapGrade]}</h3>
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
                  <ThText col="company" label="Компания" />
                  <ThText col="position" label="Должность" />
                  <ThSelect col="grade" label="Грейд" options={gradeOptions} />
                  <ThSalary col="salary" label="Зарплата" />
                  <ThText col="city" label="Город" />
                  <ThSelect col="format" label="Формат" options={formatOptions} />
                  <ThSelect col="status" label="Статус" options={statusOptions} />
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
                  <ThText col="name" label="Имя" />
                  <ThText col="city" label="Город" />
                  <ThSelect col="cformat" label="Формат" options={[...formatOptions, { value: 'any', label: 'Любой' }]} />
                  <ThSelect col="crelocate" label="Релокация" options={relocateOptions} />
                  <ThText col="salary" label="Ожидание" />
                </tr>
              </thead>
              <tbody>
                {tableCandidates.map((c) => (
                  <tr key={c.id} className={styles.clickableRow} onClick={() => handleNavigateCandidate(c.id)}>
                    <td>{c.lastName} {c.firstName}</td>
                    <td>{c.city ?? '—'}</td>
                    <td>{WORK_FORMAT_LABELS[c.workFormat as keyof typeof WORK_FORMAT_LABELS] ?? c.workFormat}</td>
                    <td>{c.relocate ? 'Да' : 'Нет'}</td>
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
