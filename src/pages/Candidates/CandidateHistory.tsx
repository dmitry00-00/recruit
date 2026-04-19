import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCandidateStore, useVacancyStore, useResponseStore } from '@/stores';
import { GradeBadge } from '@/components/ui';
import { ResponseTimeline } from '@/components/ResponseTimeline';
import type { ResponseEvent } from '@/entities';
import styles from './CandidateHistory.module.css';

export function CandidateHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { candidates, load: loadCandidates } = useCandidateStore();
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const { events, loading, loadForCandidate } = useResponseStore();

  useEffect(() => { loadCandidates(); loadVacancies(); }, [loadCandidates, loadVacancies]);
  useEffect(() => { if (id) loadForCandidate(id); }, [id, loadForCandidate]);

  const candidate = useMemo(() => candidates.find((c) => c.id === id), [candidates, id]);
  const vacancyMap = useMemo(() => new Map(vacancies.map((v) => [v.id, v])), [vacancies]);

  // Group events by vacancyId
  const grouped = useMemo(() => {
    const map = new Map<string, ResponseEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.vacancyId) ?? [];
      arr.push(ev);
      map.set(ev.vacancyId, arr);
    }
    return map;
  }, [events]);

  if (!candidate) return <div style={{ padding: 24 }}>Кандидат не найден</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(`/candidates/${candidate.id}`)}>
          <ArrowLeft size={14} /> К кандидату
        </button>
        <span className={styles.title}>{candidate.lastName} {candidate.firstName}</span>
        <span className={styles.subtitle}>Хроника откликов</span>
      </div>

      {loading && <div className={styles.loading}>Загрузка...</div>}

      {!loading && grouped.size === 0 && (
        <div className={styles.empty}>
          Нет истории откликов для этого кандидата.
          Добавьте отклик со страницы сравнения вакансии с кандидатом.
        </div>
      )}

      {!loading && grouped.size > 0 && (
        <div className={styles.list}>
          {[...grouped.entries()].map(([vacId, evts]) => {
            const vac = vacancyMap.get(vacId);
            return (
              <div key={vacId} className={styles.card}>
                <div className={styles.cardHeader}>
                  <button className={styles.vacLink} onClick={() => navigate(`/vacancies/${vacId}`)}>
                    {vac ? `${vac.companyName}` : vacId}
                  </button>
                  {vac && <GradeBadge grade={vac.grade} size="sm" />}
                  <button
                    className={styles.compareLink}
                    onClick={() => navigate(`/compare/${vacId}/${candidate.id}`)}
                  >
                    Сравнение
                  </button>
                </div>
                <ResponseTimeline
                  vacancyId={vacId}
                  candidateId={candidate.id}
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
