import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useVacancyStore, useCandidateStore } from '@/stores';
import { Tabs, GradeBadge, Button } from '@/components/ui';
import { SalaryChart } from '@/components/SalaryChart';
import { VACANCY_STATUS_LABELS, WORK_FORMAT_LABELS, EMPLOYMENT_TYPE_LABELS, CURRENCY_SYMBOLS } from '@/config';
import { getToolName } from '@/utils';
import styles from './VacancyForm.module.css';

export function VacancyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vacancies, load } = useVacancyStore();
  const { candidates, load: loadCandidates } = useCandidateStore();

  useEffect(() => { load(); loadCandidates(); }, [load, loadCandidates]);

  const vacancy = vacancies.find((v) => v.id === id);
  if (!vacancy) return <div className={styles.page}>Вакансия не найдена</div>;

  const symbol = CURRENCY_SYMBOLS[vacancy.currency] ?? '₽';

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 className={styles.title} style={{ margin: 0 }}>
          {vacancy.companyName}
        </h1>
        <GradeBadge grade={vacancy.grade} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {VACANCY_STATUS_LABELS[vacancy.status]}
        </span>
        {vacancy.sourceUrl && (
          <a href={vacancy.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--amber)' }}>
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      <Tabs tabs={[
        {
          id: 'overview',
          label: 'Обзор',
          content: (
            <div className={styles.formSection}>
              <p><strong>Должность:</strong> {vacancy.positionId}</p>
              <p><strong>Формат:</strong> {WORK_FORMAT_LABELS[vacancy.workFormat]}</p>
              <p><strong>Тип:</strong> {EMPLOYMENT_TYPE_LABELS[vacancy.employmentType]}</p>
              {vacancy.location && <p><strong>Город:</strong> {vacancy.location}</p>}
              <p>
                <strong>Зарплата:</strong>{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {vacancy.salaryFrom ? `${(vacancy.salaryFrom / 1000).toFixed(0)}k` : '—'}
                  {vacancy.salaryTo ? ` – ${(vacancy.salaryTo / 1000).toFixed(0)}k` : ''}
                  {' '}{symbol}
                </span>
              </p>
              {vacancy.notes && <p><strong>Заметки:</strong> {vacancy.notes}</p>}
            </div>
          ),
        },
        {
          id: 'min',
          label: `MIN (${vacancy.minRequirements.length})`,
          content: (
            <div className={styles.formSection}>
              {vacancy.minRequirements.map((r) => (
                <div key={r.toolId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{getToolName(r.toolId)}</span>
                  {r.minYears && <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{r.minYears} лет</span>}
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'max',
          label: `MAX (${vacancy.maxRequirements.length})`,
          content: (
            <div className={styles.formSection}>
              {vacancy.maxRequirements.map((r) => (
                <div key={r.toolId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{getToolName(r.toolId)}</span>
                  {r.minYears && <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{r.minYears} лет</span>}
                  {r.isLocked && <span style={{ fontSize: 10, color: 'var(--amber)' }}>MIN</span>}
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'candidates',
          label: `Кандидаты (${candidates.length})`,
          content: (
            <div className={styles.formSection}>
              {candidates.length === 0
                ? <p style={{ color: 'var(--text-tertiary)' }}>Нет кандидатов</p>
                : candidates.map((c) => (
                    <div
                      key={c.id}
                      style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}
                      onClick={() => navigate(`/compare/${vacancy.id}/${c.id}`)}
                    >
                      <span style={{ fontWeight: 600 }}>{c.lastName} {c.firstName}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>→ сравнить</span>
                    </div>
                  ))
              }
            </div>
          ),
        },
        {
          id: 'salary',
          label: 'Зарплата',
          content: <SalaryChart vacancies={[vacancy]} currency={vacancy.currency} />,
        },
      ]} />

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={() => navigate(-1)}>Назад</Button>
        <Button onClick={() => navigate(`/pipeline/${vacancy.id}`)}>Воронка</Button>
      </div>
    </div>
  );
}
