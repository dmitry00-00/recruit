import type {
  CandidateAggregation,
  RoadMapData,
  Grade,
} from '@/entities';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';

/** A single skill the candidate should acquire or deepen */
export interface SkillRecommendation {
  toolId: string;
  /** How many vacancies at the target grade mention this tool */
  demandCount: number;
  /** Candidate's current experience (years), 0 if absent */
  currentYears: number;
  /** Subcategory where this tool lives */
  subcategoryId: string;
  /** 'missing' = candidate has 0 experience, 'deepen' = has some but below market average */
  type: 'missing' | 'deepen';
}

export interface CareerRecommendation {
  currentGrade: Grade;
  targetGrade: Grade;
  currentGradeLabel: string;
  targetGradeLabel: string;
  /** Skills sorted by demand (most demanded first) */
  skills: SkillRecommendation[];
  /** Salary info for current and target grades */
  salaryNow: { min: number; max: number; median: number; count: number };
  salaryTarget: { min: number; max: number; median: number; count: number };
  /** Estimated median salary increase (absolute) */
  salaryIncrease: number;
  /** Estimated median salary increase (percent) */
  salaryIncreasePercent: number;
  /** Total skills needed */
  totalSkillsNeeded: number;
  /** How many the candidate already has */
  alreadyHas: number;
}

/**
 * Compute career growth recommendations for a candidate.
 *
 * Compares the candidate's current tool experience against the roadmap
 * requirements for the next grade level, producing a prioritized list
 * of skills to acquire.
 */
export function computeCareerRecommendations(
  aggregation: CandidateAggregation,
  roadmapData: RoadMapData,
): CareerRecommendation | null {
  const currentGrade = aggregation.topGrade;
  const currentIdx = GRADE_ORDER.indexOf(currentGrade);

  // No next grade available
  if (currentIdx === -1 || currentIdx >= GRADE_ORDER.length - 1) return null;

  const targetGrade = GRADE_ORDER[currentIdx + 1];

  // Build candidate's tool map: toolId → years
  const candidateTools = new Map<string, number>(
    aggregation.toolsExperience.map((t) => [t.toolId, t.years]),
  );

  // Collect all tools required at the target grade from the roadmap matrix
  const targetToolDemand = new Map<string, { count: number; subcategoryId: string }>();

  for (const [subcategoryId, gradeMap] of Object.entries(roadmapData.matrix)) {
    const cell = gradeMap[targetGrade];
    if (!cell || cell.toolIds.length === 0) continue;

    for (const toolId of cell.toolIds) {
      const existing = targetToolDemand.get(toolId);
      if (existing) {
        existing.count += cell.count;
      } else {
        targetToolDemand.set(toolId, { count: cell.count, subcategoryId });
      }
    }
  }

  if (targetToolDemand.size === 0) return null;

  const skills: SkillRecommendation[] = [];
  let alreadyHas = 0;

  for (const [toolId, { count, subcategoryId }] of targetToolDemand) {
    const currentYears = candidateTools.get(toolId) ?? 0;

    if (currentYears > 0) {
      alreadyHas++;
      // Still recommend deepening if experience is low relative to demand
      if (currentYears < 2) {
        skills.push({
          toolId,
          demandCount: count,
          currentYears,
          subcategoryId,
          type: 'deepen',
        });
      }
    } else {
      skills.push({
        toolId,
        demandCount: count,
        currentYears: 0,
        subcategoryId,
        type: 'missing',
      });
    }
  }

  // Sort: missing first, then by demand count descending
  skills.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'missing' ? -1 : 1;
    return b.demandCount - a.demandCount;
  });

  const salaryNow = roadmapData.salaryByGrade[currentGrade] ?? { min: 0, max: 0, median: 0, count: 0 };
  const salaryTarget = roadmapData.salaryByGrade[targetGrade] ?? { min: 0, max: 0, median: 0, count: 0 };

  const salaryIncrease = salaryTarget.median - salaryNow.median;
  const salaryIncreasePercent =
    salaryNow.median > 0 ? Math.round((salaryIncrease / salaryNow.median) * 100) : 0;

  return {
    currentGrade,
    targetGrade,
    currentGradeLabel: GRADE_LABELS[currentGrade],
    targetGradeLabel: GRADE_LABELS[targetGrade],
    skills,
    salaryNow,
    salaryTarget,
    salaryIncrease,
    salaryIncreasePercent,
    totalSkillsNeeded: targetToolDemand.size,
    alreadyHas,
  };
}
