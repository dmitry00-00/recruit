import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useVacancyStore, useCandidateStore, useResponseStore } from '@/stores';
import { GradeBadge } from '@/components/ui';
import { ResponseTimeline } from '@/components/ResponseTimeline';
import { VACANCY_STATUS_LABELS } from '@/config';
import type { ResponseEvent } from '@/entities';
import styles from './VacancyHistory.module.css';

export function VacancyHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const { candidates, load: loadCandidates } = useCandidateStore();
  const { events, loading, loadForVacancy } = useResponseStore();

  useEffect(() => { loadVacancies(); loadCandidates(); }, [loadVacancies, loadCandidates]);
  useEffect(() => { if (id) loadForVacancy(id); }, [id, loadForVacancy]);

  const vacancy = useMemo(() => vacancies.find((v) => v.id === id), [vacancies, id]);
  const candidateMap = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  // Group events by candidateId
  const grouped = useMemo(() => {
    const map = new Map<string, ResponseEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.candidateId) ?? [];
      arr.push(ev);
      map.set(ev.candidateId, arr);
    }
    return map;
  }, [events]);

  if (!vacancy) return <div style={{ padding: 24 }}>Вакансия не найдена</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(`/vacancies/${vacancy.id}`)}>
          <ArrowLeft size={14} /> К вакансии
        </button>
        <span className={styles.title}>{vacancy.companyName}</span>
        <GradeBadge grade={vacancy.grade} size="sm" />
        <span className={styles.statusBadge}>{VACANCY_STATUS_LABELS[vacancy.status]}</span>
        <span className={styles.subtitle}>Хроника откликов</span>
      </div>

      {loading && <div className={styles.loading}>Загрузка...</div>}

      {!loading && grouped.size === 0 && (
        <div className={styles.empty}>
          Нет истории откликов по этой вакансии.
          Добавьте отклик со страницы сравнения кандидата с вакансией.
        </div>
      )}

      {!loading && grouped.size > 0 && (
        <div className={styles.list}>
          {[...grouped.entries()].map(([candId, evts]) => {
            const cand = candidateMap.get(candId);
            return (
              <div key={candId} className={styles.card}>
                <div className={styles.cardHeader}>
                  <button className={styles.candLink} onClick={() => navigate(`/candidates/${candId}`)}>
                    {cand ? `${cand.lastName} ${cand.firstName}` : candId}
                  </button>
                  <button
                    className={styles.compareLink}
                    onClick={() => navigate(`/compare/${vacancy.id}/${candId}`)}
                  >
                    Сравнение
                  </button>
                </div>
                <ResponseTimeline
                  vacancyId={vacancy.id}
                  candidateId={candId}
                  events={evts}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
