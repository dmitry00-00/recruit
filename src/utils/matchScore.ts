import type {
  Vacancy,
  CandidateAggregation,
  MatchResult,
  MatchedTool,
  GapTool,
  ExtraTool,
} from '@/entities';
import { GRADE_ORDER } from '@/entities';

/**
 * Grade compatibility multiplier.
 * Penalizes large grade mismatches so a senior doesn't rank #1 for a junior vacancy.
 *
 * Distance 0  → 1.00 (exact match)
 * Distance 1  → 0.90 (adjacent grade, still good)
 * Distance 2  → 0.70 (moderate mismatch)
 * Distance 3+ → 0.40 (major overqualification/underqualification)
 */
function gradeMultiplier(vacancyGrade: string, candidateTopGrade: string): number {
  const vi = GRADE_ORDER.indexOf(vacancyGrade as typeof GRADE_ORDER[number]);
  const ci = GRADE_ORDER.indexOf(candidateTopGrade as typeof GRADE_ORDER[number]);
  if (vi === -1 || ci === -1) return 1;
  const dist = Math.abs(vi - ci);
  if (dist === 0) return 1.0;
  if (dist === 1) return 0.9;
  if (dist === 2) return 0.7;
  return 0.4;
}

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

    const rawScore =
      requirements.length === 0
        ? 100
        : Math.round((matched.length / requirements.length) * 100);

    return { matched, gaps, score: rawScore };
  }

  const minAnalysis = analyzeRequirements(vacancy.minRequirements);
  const maxAnalysis = analyzeRequirements(vacancy.maxRequirements);

  // Apply grade compatibility penalty
  const gm = gradeMultiplier(vacancy.grade, aggregation.topGrade);

  const allVacancyToolIds = new Set(
    vacancy.maxRequirements.map((r) => r.toolId)
  );
  const extras: ExtraTool[] = aggregation.toolsExperience
    .filter((t) => !allVacancyToolIds.has(t.toolId))
    .map((t) => ({ toolId: t.toolId, actual: t.years }));

  return {
    vacancyId:  vacancy.id,
    candidateId: aggregation.candidateId,
    scoreMin:   Math.round(minAnalysis.score * gm),
    scoreMax:   Math.round(maxAnalysis.score * gm),
    matched:    minAnalysis.matched,
    gaps:       minAnalysis.gaps,
    extras,
  };
}
