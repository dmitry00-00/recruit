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

  useEffect(() => {
    if (!vacancyId || !candidateId) {
      setResult(null);
      return;
    }

    const vacancy = getVacancy(vacancyId);
    const candidate = getCandidate(candidateId);
    if (!vacancy || !candidate) {
      setResult(null);
      return;
    }

    getWorkEntries(candidateId).then((entries) => {
      const aggregation = aggregateCandidate(candidate, entries);
      const match = computeMatchScore(vacancy, aggregation);
      setResult(match);
    });
  }, [vacancyId, candidateId, getVacancy, getCandidate, getWorkEntries]);

  return result;
}
