import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVacancyStore, useCandidateStore, useFilterStore } from '@/stores';
import { CompareSheet } from '@/components/CompareSheet';
import { MatchBadge } from '@/components/MatchBadge';
import { GradeBadge, Button } from '@/components/ui';
import { computeMatchScore, aggregateCandidate } from '@/utils';
import type { MatchResult, CandidateAggregation } from '@/entities';
import styles from '../Vacancies/VacancyForm.module.css';

export function ComparePage() {
  const { vacancyId, candidateId } = useParams<{ vacancyId: string; candidateId: string }>();
  const navigate = useNavigate();
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const { candidates, load: loadCandidates, getWorkEntries } = useCandidateStore();
  const { showDiff, requirementLevel } = useFilterStore();

  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [aggregation, setAggregation] = useState<CandidateAggregation | null>(null);

  useEffect(() => { loadVacancies(); loadCandidates(); }, [loadVacancies, loadCandidates]);

  const vacancy = useMemo(() => vacancies.find((v) => v.id === vacancyId), [vacancies, vacancyId]);
  const candidate = useMemo(() => candidates.find((c) => c.id === candidateId), [candidates, candidateId]);

  useEffect(() => {
    if (!vacancy || !candidate) return;
    getWorkEntries(candidate.id).then((entries) => {
      const agg = aggregateCandidate(candidate, entries);
      setAggregation(agg);
      setMatchResult(computeMatchScore(vacancy, agg));
    });
  }, [vacancy, candidate, getWorkEntries]);

  if (!vacancy || !candidate) {
    return <div className={styles.page}>Загрузка...</div>;
  }

  return (
    <div className={styles.page} style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className={styles.title} style={{ margin: 0, fontSize: 16 }}>Сравнение</h1>
        {matchResult && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <MatchBadge score={requirementLevel === 'min' ? matchResult.scoreMin : matchResult.scoreMax} size="lg" />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* Vacancy mini card */}
        <div style={{ flex: 1, padding: 12, background: 'var(--vac-dim)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--vac-color)' }}>{vacancy.companyName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{vacancy.positionId}</div>
          <div style={{ marginTop: 6 }}><GradeBadge grade={vacancy.grade} size="sm" /></div>
        </div>
        {/* Candidate mini card */}
        <div style={{ flex: 1, padding: 12, background: 'var(--cand-dim)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cand-color)' }}>
            {candidate.lastName} {candidate.firstName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {aggregation ? `${aggregation.totalYears} лет опыта` : ''}
          </div>
          {aggregation?.topGrade && (
            <div style={{ marginTop: 6 }}><GradeBadge grade={aggregation.topGrade} size="sm" /></div>
          )}
        </div>
      </div>

      {matchResult && (
        <CompareSheet matchResult={matchResult} showDiff={showDiff} />
      )}

      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    </div>
  );
}
