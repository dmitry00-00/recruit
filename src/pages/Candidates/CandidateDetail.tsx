import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCandidateStore, useVacancyStore } from '@/stores';
import { Tabs, GradeBadge, Button } from '@/components/ui';
import { SalaryChart } from '@/components/SalaryChart';
import { aggregateCandidate, getToolName } from '@/utils';
import { WORK_FORMAT_LABELS, CURRENCY_SYMBOLS } from '@/config';
import type { WorkEntry, CandidateAggregation } from '@/entities';
import styles from '../Vacancies/VacancyForm.module.css';

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { candidates, load, getWorkEntries } = useCandidateStore();
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [aggregation, setAggregation] = useState<CandidateAggregation | null>(null);

  useEffect(() => { load(); loadVacancies(); }, [load, loadVacancies]);

  const candidate = candidates.find((c) => c.id === id);

  useEffect(() => {
    if (!candidate) return;
    getWorkEntries(candidate.id).then((entries) => {
      setWorkEntries(entries);
      setAggregation(aggregateCandidate(candidate, entries));
    });
  }, [candidate, getWorkEntries]);

  if (!candidate) return <div className={styles.page}>Кандидат не найден</div>;

  const symbol = CURRENCY_SYMBOLS[candidate.currency] ?? '₽';

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 className={styles.title} style={{ margin: 0 }}>
          {candidate.lastName} {candidate.firstName}
        </h1>
        {aggregation?.topGrade && <GradeBadge grade={aggregation.topGrade} />}
        {aggregation && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {aggregation.totalYears} лет
          </span>
        )}
      </div>

      <Tabs tabs={[
        {
          id: 'profile',
          label: 'Профиль',
          content: (
            <div className={styles.formSection}>
              {candidate.email && <p><strong>Email:</strong> {candidate.email}</p>}
              {candidate.phone && <p><strong>Телефон:</strong> {candidate.phone}</p>}
              {candidate.telegramHandle && <p><strong>Telegram:</strong> {candidate.telegramHandle}</p>}
              {candidate.city && <p><strong>Город:</strong> {candidate.city}</p>}
              <p><strong>Формат:</strong> {WORK_FORMAT_LABELS[candidate.workFormat]}</p>
              <p><strong>Релокация:</strong> {candidate.relocate ? 'Да' : 'Нет'}</p>
              {candidate.salaryExpected && (
                <p>
                  <strong>Ожидание:</strong>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {(candidate.salaryExpected / 1000).toFixed(0)}k {symbol}
                  </span>
                </p>
              )}
            </div>
          ),
        },
        {
          id: 'experience',
          label: `Опыт (${workEntries.length})`,
          content: (
            <div className={styles.formSection}>
              {workEntries.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>Нет мест работы</p>}
              {workEntries.map((e) => (
                <div key={e.id} style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{e.companyName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {new Date(e.startDate).toLocaleDateString('ru-RU')} – {e.isCurrent ? 'н.в.' : e.endDate ? new Date(e.endDate).toLocaleDateString('ru-RU') : '—'}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {e.tools.map((t) => (
                      <span key={t.toolId} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--chip-bg)', borderRadius: 4 }}>
                        {getToolName(t.toolId)} {t.years > 0 ? `(${t.years}г)` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'stack',
          label: 'Стек',
          content: (
            <div className={styles.formSection}>
              {aggregation?.toolsExperience.map((t) => (
                <div key={t.toolId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 120, fontSize: 12, fontWeight: 600 }}>{getToolName(t.toolId)}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                    <div style={{ width: `${Math.min(100, (t.years / 10) * 100)}%`, height: '100%', background: 'var(--cand-color)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, width: 40, textAlign: 'right' }}>{t.years}г</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'vacancies',
          label: 'Вакансии',
          content: (
            <div className={styles.formSection}>
              {vacancies.length === 0
                ? <p style={{ color: 'var(--text-tertiary)' }}>Нет вакансий</p>
                : vacancies.map((v) => (
                    <div
                      key={v.id}
                      style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}
                      onClick={() => navigate(`/compare/${v.id}/${candidate.id}`)}
                    >
                      <span style={{ fontWeight: 600 }}>{v.companyName}</span>
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
          content: <SalaryChart workHistory={workEntries} currentSalary={candidate.salaryExpected} currency={candidate.currency} />,
        },
      ]} />

      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    </div>
  );
}
