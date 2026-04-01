import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Upload } from 'lucide-react';
import { useFilterStore, useVacancyStore, useCandidateStore } from '@/stores';
import { VacancyCard } from '@/components/VacancyCard';
import { CandidateCard } from '@/components/CandidateCard';
import { EmptyState, Button } from '@/components/ui';
import { VACANCY_STATUS_LABELS, CURRENCY_SYMBOLS } from '@/config';
import { GRADE_LABELS } from '@/entities';
import type { ViewMode } from '@/entities';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();
  const { recordType, positionCategory } = useFilterStore();
  const { vacancies, loading: vLoading, load: loadVacancies } = useVacancyStore();
  const { candidates, loading: cLoading, load: loadCandidates } = useCandidateStore();
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');

  useEffect(() => {
    loadVacancies();
    loadCandidates();
  }, [loadVacancies, loadCandidates]);

  const filteredVacancies = useMemo(
    () =>
      positionCategory
        ? vacancies.filter((v) => v.positionId.includes(positionCategory))
        : vacancies,
    [vacancies, positionCategory],
  );

  const handleNavigateVacancy = useCallback(
    (id: string) => navigate(`/vacancies/${id}`),
    [navigate],
  );

  const handleNavigateCandidate = useCallback(
    (id: string) => navigate(`/candidates/${id}`),
    [navigate],
  );

  const loading = recordType === 'vacancies' ? vLoading : cLoading;

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
            className={styles.viewBtn}
            onClick={() => navigate('/vacancies/import')}
            title="Импорт вакансий"
          >
            <Upload size={14} />
          </button>
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

      {!loading && recordType === 'vacancies' && filteredVacancies.length === 0 && (
        <EmptyState
          title="Нет вакансий"
          description="Создайте первую вакансию для начала работы"
          action={<Button onClick={() => navigate('/vacancies/new')}>Добавить вакансию</Button>}
        />
      )}

      {!loading && recordType === 'candidates' && candidates.length === 0 && (
        <EmptyState
          title="Нет кандидатов"
          description="Добавьте кандидата для начала работы"
          action={<Button onClick={() => navigate('/candidates/new')}>Добавить кандидата</Button>}
        />
      )}

      {!loading && recordType === 'vacancies' && filteredVacancies.length > 0 && (
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
                  <th>Компания</th>
                  <th>Должность</th>
                  <th>Грейд</th>
                  <th>Зарплата</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredVacancies.map((v) => (
                  <tr key={v.id} className={styles.clickableRow} onClick={() => handleNavigateVacancy(v.id)}>
                    <td>{v.companyName}</td>
                    <td>{v.positionId}</td>
                    <td>{GRADE_LABELS[v.grade]}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {v.salaryFrom ? `${(v.salaryFrom / 1000).toFixed(0)}k` : '—'}
                      {v.salaryTo ? `–${(v.salaryTo / 1000).toFixed(0)}k` : ''}
                      {' '}{CURRENCY_SYMBOLS[v.currency] ?? ''}
                    </td>
                    <td>{VACANCY_STATUS_LABELS[v.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && recordType === 'candidates' && candidates.length > 0 && (
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
                  <th>Имя</th>
                  <th>Город</th>
                  <th>Формат</th>
                  <th>Ожидание</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className={styles.clickableRow} onClick={() => handleNavigateCandidate(c.id)}>
                    <td>{c.lastName} {c.firstName}</td>
                    <td>{c.city ?? '—'}</td>
                    <td>{c.workFormat}</td>
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
