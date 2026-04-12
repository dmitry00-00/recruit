import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Check, History } from 'lucide-react';
import { useVacancyStore, useCandidateStore, useFilterStore, usePositionStore, usePipelineStore, useResponseStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { MatchBadge } from '@/components/MatchBadge';
import { ResponseTimeline } from '@/components/ResponseTimeline';
import { GradeBadge, Button } from '@/components/ui';
import { computeMatchScore, aggregateCandidate } from '@/utils';
import { db, getOrCreatePipeline } from '@/db';
import type { MatchResult, CandidateAggregation } from '@/entities';
import styles from './ComparePage.module.css';

export function ComparePage() {
  const { vacancyId, candidateId } = useParams<{ vacancyId: string; candidateId: string }>();
  const navigate  = useNavigate();
  const { vacancies, load: loadVacancies }   = useVacancyStore();
  const { candidates, load: loadCandidates, getWorkEntries } = useCandidateStore();
  const { positions, load: loadPositions } = usePositionStore();
  const { requirementLevel } = useFilterStore();
  const pipelineStore = usePipelineStore();
  const { events, loadForPair } = useResponseStore();

  const [matchResult,  setMatchResult]  = useState<MatchResult | null>(null);
  const [aggregation,  setAggregation]  = useState<CandidateAggregation | null>(null);
  const [addedToPipeline, setAddedToPipeline] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => { loadVacancies(); loadCandidates(); loadPositions(); }, [loadVacancies, loadCandidates, loadPositions]);

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

  // Load history + pipeline state
  useEffect(() => {
    if (vacancyId && candidateId) {
      loadForPair(vacancyId, candidateId);
    }
  }, [vacancyId, candidateId, loadForPair]);

  useEffect(() => {
    if (vacancyId) {
      pipelineStore.loadForVacancy(vacancyId);
    }
  }, [vacancyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if already in pipeline
  const isInPipeline = useMemo(() => {
    if (!candidateId) return false;
    return pipelineStore.cards.some((c) => c.candidateId === candidateId) || addedToPipeline;
  }, [pipelineStore.cards, candidateId, addedToPipeline]);

  const handleAddToPipeline = useCallback(async () => {
    if (!vacancyId || !candidateId || isInPipeline) return;
    const pipeline = await getOrCreatePipeline(vacancyId);
    const stages = pipelineStore.stages.length > 0
      ? pipelineStore.stages
      : (await db.pipelineStages.where('pipelineId').equals(pipeline.id).sortBy('order'));
    const firstStage = stages[0];
    if (!firstStage) return;
    await pipelineStore.addCard({
      pipelineId: pipeline.id,
      stageId: firstStage.id,
      candidateId,
      matchScore: matchResult?.scoreMin,
    });
    setAddedToPipeline(true);
  }, [vacancyId, candidateId, isInPipeline, matchResult, pipelineStore]);

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

  const filteredSubIds = useMemo(() => {
    if (!vacancy) return [];
    const pos = positions.find((p) => p.id === vacancy.positionId);
    if (!pos?.requiredCategories?.length) return [];
    return pos.requiredCategories.flatMap((rc) => rc.subcategoryIds);
  }, [vacancy, positions]);

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

        <Button
          size="sm"
          variant={historyOpen ? 'primary' : 'secondary'}
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <History size={13} /> Хроника
        </Button>

        <Button
          size="sm"
          variant={isInPipeline ? 'secondary' : 'primary'}
          onClick={handleAddToPipeline}
          disabled={isInPipeline}
        >
          {isInPipeline ? <><Check size={13} /> В воронке</> : <><Plus size={13} /> В воронку</>}
        </Button>
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

      {/* ── Body: TreePicker + optional History panel ───── */}
      <div className={styles.body}>
        <div className={styles.pickerContainer}>
          {matchResult ? (
            <TreePicker
              mode="compare"
              filteredSubIds={filteredSubIds}
              fullHeight
              matchResult={matchResult}
              requirementsYearsMap={requirementsYearsMap}
              candidateYearsMap={candidateYearsMap}
            />
          ) : (
            <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Вычисление результата...</div>
          )}
        </div>

        {historyOpen && (
          <div className={styles.historyPanel}>
            <ResponseTimeline
              vacancyId={vacancy.id}
              candidateId={candidate.id}
              events={events}
            />
          </div>
        )}
      </div>
    </div>
  );
}
