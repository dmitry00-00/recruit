import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useFilterStore, usePositionStore } from '@/stores';
import type { Grade, WorkFormat, VacancyStatus } from '@/entities';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import { VACANCY_STATUS_LABELS, WORK_FORMAT_LABELS } from '@/config';
import styles from './FilterBar.module.css';

function parseIntOrUndef(v: string): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n * 1000 : undefined;
}

function formatThousands(n?: number): string {
  if (!n) return '';
  return String(Math.round(n / 1000));
}

export function FilterBar() {
  const {
    recordType,
    companyFilter,
    positionIdFilter,
    cityFilter,
    statusFilter,
    gradeFilter,
    salaryMin,
    salaryMax,
    workFormatFilter,
    setCompanyFilter,
    setPositionIdFilter,
    setCityFilter,
    setStatusFilter,
    setGradeFilter,
    setSalaryRange,
    setWorkFormatFilter,
    clearNonRequirementFilters,
  } = useFilterStore();

  const positions = usePositionStore((s) => s.positions);

  const showCompany = recordType === 'vacancies';
  const showStatus = recordType === 'vacancies';

  const positionOptions = useMemo(() => {
    const sorted = [...positions].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return sorted;
  }, [positions]);

  const activeCount =
    (companyFilter ? 1 : 0) +
    (positionIdFilter ? 1 : 0) +
    (cityFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (gradeFilter.length > 0 ? 1 : 0) +
    (salaryMin || salaryMax ? 1 : 0) +
    (workFormatFilter.length > 0 ? 1 : 0);

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        {showCompany && (
          <label className={styles.field}>
            <span className={styles.label}>Компания</span>
            <input
              className={styles.input}
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              placeholder="…"
            />
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Должность</span>
          <select
            className={styles.select}
            value={positionIdFilter ?? ''}
            onChange={(e) => setPositionIdFilter(e.target.value || null)}
          >
            <option value="">Все</option>
            {positionOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Грейд</span>
          <select
            className={styles.select}
            value={gradeFilter[0] ?? ''}
            onChange={(e) => setGradeFilter(e.target.value ? [e.target.value as Grade] : [])}
          >
            <option value="">Все</option>
            {GRADE_ORDER.map((g) => (
              <option key={g} value={g}>{GRADE_LABELS[g]}</option>
            ))}
          </select>
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Зарплата, тыс</span>
          <div className={styles.inputRange}>
            <input
              className={styles.inputSmall}
              type="number"
              min={0}
              value={formatThousands(salaryMin)}
              onChange={(e) => setSalaryRange(parseIntOrUndef(e.target.value), salaryMax)}
              placeholder="от"
            />
            <span className={styles.rangeSep}>–</span>
            <input
              className={styles.inputSmall}
              type="number"
              min={0}
              value={formatThousands(salaryMax)}
              onChange={(e) => setSalaryRange(salaryMin, parseIntOrUndef(e.target.value))}
              placeholder="до"
            />
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Город</span>
          <input
            className={styles.input}
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="…"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Формат</span>
          <select
            className={styles.select}
            value={workFormatFilter[0] ?? ''}
            onChange={(e) => setWorkFormatFilter(e.target.value ? [e.target.value as WorkFormat] : [])}
          >
            <option value="">Любой</option>
            {Object.entries(WORK_FORMAT_LABELS)
              .filter(([k]) => k !== 'any')
              .map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
          </select>
        </label>

        {showStatus && (
          <label className={styles.field}>
            <span className={styles.label}>Статус</span>
            <select
              className={styles.select}
              value={statusFilter ?? ''}
              onChange={(e) => setStatusFilter((e.target.value || null) as VacancyStatus | null)}
            >
              <option value="">Все</option>
              {Object.entries(VACANCY_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        )}

        {activeCount > 0 && (
          <button
            className={styles.clearBtn}
            onClick={clearNonRequirementFilters}
            title="Сбросить фильтры"
          >
            <X size={12} /> Сброс
          </button>
        )}
      </div>
    </div>
  );
}
