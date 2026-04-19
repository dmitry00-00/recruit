import type {
  Vacancy,
  CandidateAggregation,
  Grade,
} from '@/entities';
import { GRADE_ORDER } from '@/entities';
import { computeMatchScore } from './matchScore';

/** Result of simulating removal of a single requirement */
export interface RequirementImpact {
  toolId: string;
  /** Current number of candidates matching above threshold */
  currentMatches: number;
  /** Number of candidates matching after removing this requirement */
  afterMatches: number;
  /** Delta: how many more candidates become available */
  delta: number;
  /** Percentage improvement */
  deltaPercent: number;
}

/** Result of simulating grade relaxation */
export interface GradeImpact {
  originalGrade: Grade;
  relaxedGrade: Grade;
  currentMatches: number;
  afterMatches: number;
  delta: number;
}

/** Result of simulating salary increase */
export interface SalaryImpact {
  salaryIncrease: number;
  /** How many candidates have expected salary within the new range */
  candidatesInRange: number;
  /** Total candidates compared */
  totalCandidates: number;
}

export interface VacancyOptimization {
  vacancyId: string;
  /** Total candidates evaluated */
  totalCandidates: number;
  /** Candidates currently matching above threshold */
  currentMatchCount: number;
  /** Match threshold used (scoreMin) */
  threshold: number;
  /** Impact of removing each individual min requirement */
  requirementImpacts: RequirementImpact[];
  /** Impact of relaxing grade by one level down */
  gradeImpact: GradeImpact | null;
  /** Impact of raising salary by 10%, 20%, 30% */
  salaryImpacts: SalaryImpact[];
}

const MATCH_THRESHOLD = 50;

/**
 * Compute vacancy optimization recommendations.
 *
 * For each minRequirement, simulates removing it and shows how many
 * additional candidates would match above threshold.
 * Also simulates grade relaxation and salary increases.
 */
export function computeVacancyOptimization(
  vacancy: Vacancy,
  aggregations: CandidateAggregation[],
): VacancyOptimization {
  // Current match count
  const currentScores = aggregations.map((agg) => computeMatchScore(vacancy, agg));
  const currentMatchCount = currentScores.filter((m) => m.scoreMin >= MATCH_THRESHOLD).length;

  // ── Requirement impact analysis ──────────────────────────────
  const requirementImpacts: RequirementImpact[] = [];

  for (const req of vacancy.minRequirements) {
    // Create a modified vacancy without this requirement
    const modVacancy: Vacancy = {
      ...vacancy,
      minRequirements: vacancy.minRequirements.filter((r) => r.toolId !== req.toolId),
    };

    const modScores = aggregations.map((agg) => computeMatchScore(modVacancy, agg));
    const afterMatches = modScores.filter((m) => m.scoreMin >= MATCH_THRESHOLD).length;
    const delta = afterMatches - currentMatchCount;

    if (delta > 0) {
      requirementImpacts.push({
        toolId: req.toolId,
        currentMatches: currentMatchCount,
        afterMatches,
        delta,
        deltaPercent: currentMatchCount > 0
          ? Math.round((delta / currentMatchCount) * 100)
          : delta > 0 ? 100 : 0,
      });
    }
  }

  // Sort by impact descending
  requirementImpacts.sort((a, b) => b.delta - a.delta);

  // ── Grade relaxation ──────────────────────────────────────────
  let gradeImpact: GradeImpact | null = null;
  const gradeIdx = GRADE_ORDER.indexOf(vacancy.grade);
  if (gradeIdx > 0) {
    const relaxedGrade = GRADE_ORDER[gradeIdx - 1];
    const modVacancy: Vacancy = { ...vacancy, grade: relaxedGrade };
    const modScores = aggregations.map((agg) => computeMatchScore(modVacancy, agg));
    const afterMatches = modScores.filter((m) => m.scoreMin >= MATCH_THRESHOLD).length;
    const delta = afterMatches - currentMatchCount;

    if (delta > 0) {
      gradeImpact = {
        originalGrade: vacancy.grade,
        relaxedGrade,
        currentMatches: currentMatchCount,
        afterMatches,
        delta,
      };
    }
  }

  // ── Salary impact ─────────────────────────────────────────────
  const salaryImpacts: SalaryImpact[] = [];
  const baseSalary = vacancy.salaryTo ?? vacancy.salaryFrom ?? 0;

  if (baseSalary > 0) {
    for (const pct of [10, 20, 30]) {
      const newSalary = Math.round(baseSalary * (1 + pct / 100));
      const candidatesInRange = aggregations.filter((agg) => {
        const expected = agg.currentSalary ?? agg.averageSalary;
        return expected > 0 && expected <= newSalary;
      }).length;

      salaryImpacts.push({
        salaryIncrease: pct,
        candidatesInRange,
        totalCandidates: aggregations.length,
      });
    }
  }

  return {
    vacancyId: vacancy.id,
    totalCandidates: aggregations.length,
    currentMatchCount,
    threshold: MATCH_THRESHOLD,
    requirementImpacts,
    gradeImpact,
    salaryImpacts,
  };
}
