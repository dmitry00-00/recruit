import { useState, useEffect } from 'react';
import type { MatchResult } from '@/entities';
import { useVacancyStore, useCandidateStore } from '@/stores';
import { computeMatchScore, aggregateCandidate } from '@/utils';

export function useMatchScore(
  vacancyId: string | null,
  candidateId: string | null,
): MatchResult | null {
  const [result, setResult] = useState<MatchResult | null>(null);
  const getVacancy = useVacancyStore((s) => s.getById);
  const getCandidate = useCandidateStore((s) => s.getById);
  const getWorkEntries = useCandidateStore((s) => s.getWorkEntries);

  // Drop stale result when inputs change (React 19 prev-state pattern).
  const key = vacancyId && candidateId ? `${vacancyId}:${candidateId}` : '';
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    if (result !== null) setResult(null);
  }

  useEffect(() => {
    if (!vacancyId || !candidateId) return;

    const vacancy = getVacancy(vacancyId);
    const candidate = getCandidate(candidateId);
    if (!vacancy || !candidate) return;

    let cancelled = false;
    void getWorkEntries(candidateId).then((entries) => {
      if (cancelled) return;
      const aggregation = aggregateCandidate(candidate, entries);
      const match = computeMatchScore(vacancy, aggregation);
      setResult(match);
    });
    return () => { cancelled = true; };
  }, [vacancyId, candidateId, getVacancy, getCandidate, getWorkEntries]);

  return result;
}
