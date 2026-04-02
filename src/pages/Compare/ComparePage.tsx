import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useVacancyStore, useCandidateStore, useFilterStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { MatchBadge } from '@/components/MatchBadge';
import { GradeBadge, Button } from '@/components/ui';
import { computeMatchScore, aggregateCandidate } from '@/utils';
import type { MatchResult, CandidateAggregation } from '@/entities';
import styles from './ComparePage.module.css';

export function ComparePage() {
  const { vacancyId, candidateId } = useParams<{ vacancyId: string; candidateId: string }>();
  const navigate  = useNavigate();
  const { vacancies, load: loadVacancies }   = useVacancyStore();
  const { candidates, load: loadCandidates, getWorkEntries } = useCandidateStore();
  const { requirementLevel } = useFilterStore();

  const [matchResult,  setMatchResult]  = useState<MatchResult | null>(null);
  const [aggregation,  setAggregation]  = useState<CandidateAggregation | null>(null);

  useEffect(() => { loadVacancies(); loadCandidates(); }, [loadVacancies, loadCandidates]);

  const vacancy   = useMemo(() => vacancies.find((v) => v.id === vacancyId),   [vacancies,   vacancyId]);
  const candidate = useMemo(() => candidates.find((c) => c.id === candidateId), [candidates, candidateId]);

  useEffect(() => {
    if (!vacancy || !candidate) return;
    getWorkEntries(candidate.id).then((entries) => {
      const agg = aggregateCandidate(candidate, entries);
      setAggregation(agg);
      setMatchResult(computeMatchScore(vacancy, agg));
    });
  }, [vacancy, candidate, getWorkEntries]);

  // Build years maps for compare mode
  const requirementsYearsMap = useMemo<Record<string, number>>(() => {
    if (!vacancy) return {};
    const reqs = requirementLevel === 'min' ? vacancy.minRequirements : vacancy.maxRequirements;
    return Object.fromEntries(reqs.filter((r) => r.minYears).map((r) => [r.toolId, r.minYears!]));
  }, [vacancy, requirementLevel]);

  const candidateYearsMap = useMemo<Record<string, number>>(() => {
    if (!aggregation) return {};
    return Object.fromEntries(aggregation.toolsExperience.map((t) => [t.toolId, t.years]));
  }, [aggregation]);

  if (!vacancy || !candidate) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  return (
    <div className={styles.page}>
      {/* ── Header ───────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Назад
        </button>

        <div className={styles.headerSep} />

        {/* Vacancy side */}
        <div className={styles.headerCard} style={{ borderColor: 'var(--vac-color)' }}>
          <span className={styles.cardName} style={{ color: 'var(--vac-color)' }}>
            {vacancy.companyName}
          </span>
          <GradeBadge grade={vacancy.grade} size="sm" />
        </div>

        <span className={styles.vsLabel}>vs</span>

        {/* Candidate side */}
        <div className={styles.headerCard} style={{ borderColor: 'var(--cand-color)' }}>
          <span className={styles.cardName} style={{ color: 'var(--cand-color)' }}>
            {candidate.lastName} {candidate.firstName}
          </span>
          {aggregation?.topGrade && <GradeBadge grade={aggregation.topGrade} size="sm" />}
        </div>

        <div className={styles.headerSpacer} />

        {matchResult && (
          <MatchBadge
            score={requirementLevel === 'min' ? matchResult.scoreMin : matchResult.scoreMax}
            size="lg"
          />
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────── */}
      <div className={styles.legend}>
        <span className={styles.legendItem} style={{ color: '#22c55e' }}>✓ Соответствует</span>
        <span className={styles.legendItem} style={{ color: '#ef4444' }}>✗ Недостаёт</span>
        <span className={styles.legendItem} style={{ color: '#6366f1' }}>~ Дополнительно</span>
        <span className={styles.legendNote}>
          Левее «/» — требование вакансии,  правее «/» — опыт кандидата
        </span>
      </div>

      {/* ── TreePicker in compare mode ───────────────────── */}
      <div className={styles.pickerContainer}>
        {matchResult ? (
          <TreePicker
            mode="compare"
            fullHeight
            matchResult={matchResult}
            requirementsYearsMap={requirementsYearsMap}
            candidateYearsMap={candidateYearsMap}
          />
        ) : (
          <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Вычисление результата...</div>
        )}
      </div>
    </div>
  );
}
