import type {
  Vacancy,
  CandidateAggregation,
  MatchResult,
  MatchedTool,
  GapTool,
  ExtraTool,
} from '@/entities';

export function computeMatchScore(
  vacancy: Vacancy,
  aggregation: CandidateAggregation,
): MatchResult {
  const candidateMap = new Map<string, number>(
    aggregation.toolsExperience.map((t) => [t.toolId, t.years])
  );

  function analyzeRequirements(requirements: Vacancy['minRequirements']) {
    const matched: MatchedTool[] = [];
    const gaps: GapTool[] = [];

    for (const req of requirements) {
      const actual = candidateMap.get(req.toolId) ?? 0;
      const required = req.minYears ?? 0;

      if (actual > 0 && actual >= required) {
        matched.push({ toolId: req.toolId, required, actual });
      } else {
        gaps.push({ toolId: req.toolId, required, actual });
      }
    }

    const score =
      requirements.length === 0
        ? 100
        : Math.round((matched.length / requirements.length) * 100);

    return { matched, gaps, score };
  }

  const minAnalysis = analyzeRequirements(vacancy.minRequirements);
  const maxAnalysis = analyzeRequirements(vacancy.maxRequirements);

  const allVacancyToolIds = new Set(
    vacancy.maxRequirements.map((r) => r.toolId)
  );
  const extras: ExtraTool[] = aggregation.toolsExperience
    .filter((t) => !allVacancyToolIds.has(t.toolId))
    .map((t) => ({ toolId: t.toolId, actual: t.years }));

  return {
    vacancyId:  vacancy.id,
    candidateId: aggregation.candidateId,
    scoreMin:   minAnalysis.score,
    scoreMax:   maxAnalysis.score,
    matched:    minAnalysis.matched,
    gaps:       minAnalysis.gaps,
    extras,
  };
}
