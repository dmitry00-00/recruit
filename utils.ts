// ============================================================
// matchScore.ts — алгоритм матчинга вакансии и кандидата
// ============================================================

import type {
  Vacancy,
  CandidateAggregation,
  MatchResult,
  MatchedTool,
  GapTool,
  ExtraTool,
} from '../entities';

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

  // Extras — инструменты у кандидата, которых нет в MAX требованиях
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

// ============================================================
// aggregateCandidate.ts — агрегация опыта кандидата
// ============================================================

import type {
  Candidate,
  WorkEntry,
  CandidateAggregation,
  ToolExperience,
  Grade,
} from '../entities';
import { GRADE_ORDER } from '../entities';

export function aggregateCandidate(
  candidate: Candidate,
  workEntries: WorkEntry[],
): CandidateAggregation {
  if (workEntries.length === 0) {
    return {
      candidateId:      candidate.id,
      totalMonths:      0,
      totalYears:       0,
      toolsExperience:  [],
      currentSalary:    candidate.salaryExpected,
      averageSalary:    candidate.salaryExpected ?? 0,
      primaryPositionId: undefined,
      grades:           [],
      topGrade:         'intern',
    };
  }

  // Суммарный стаж
  const now = new Date();
  let totalMonths = 0;

  for (const entry of workEntries) {
    const end = entry.isCurrent ? now : (entry.endDate ?? now);
    const start = entry.startDate;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    totalMonths += Math.max(0, months);
  }

  // Агрегация инструментов
  const toolMap = new Map<string, number>(); // toolId → months
  for (const entry of workEntries) {
    for (const t of entry.tools) {
      const existing = toolMap.get(t.toolId) ?? 0;
      // years уже вычислены, конвертируем в месяцы для агрегации
      toolMap.set(t.toolId, existing + Math.round(t.years * 12));
    }
  }

  const toolsExperience: ToolExperience[] = Array.from(toolMap.entries())
    .map(([toolId, months]) => ({
      toolId,
      months,
      years: Math.round((months / 12) * 2) / 2, // округление до 0.5
    }))
    .sort((a, b) => b.months - a.months);

  // Зарплаты
  const sortedByDate = [...workEntries].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime()
  );
  const currentEntry = sortedByDate.find((e) => e.isCurrent) ?? sortedByDate[0];
  const currentSalary = currentEntry?.salary ?? candidate.salaryExpected;

  const salaries = workEntries
    .filter((e) => e.salary != null)
    .map((e) => e.salary as number);
  const averageSalary =
    salaries.length > 0
      ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)
      : (candidate.salaryExpected ?? 0);

  // Грейды
  const grades: Grade[] = [...new Set(workEntries.map((e) => e.grade))];
  const topGrade = grades.reduce<Grade>(
    (top, g) =>
      GRADE_ORDER.indexOf(g) > GRADE_ORDER.indexOf(top) ? g : top,
    'intern'
  );

  // Основная должность (с наибольшим суммарным стажем)
  const positionMonths = new Map<string, number>();
  for (const entry of workEntries) {
    const end = entry.isCurrent ? now : (entry.endDate ?? now);
    const months =
      (end.getFullYear() - entry.startDate.getFullYear()) * 12 +
      (end.getMonth() - entry.startDate.getMonth());
    const current = positionMonths.get(entry.positionId) ?? 0;
    positionMonths.set(entry.positionId, current + Math.max(0, months));
  }
  const primaryPositionId =
    positionMonths.size > 0
      ? [...positionMonths.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : undefined;

  return {
    candidateId:      candidate.id,
    totalMonths,
    totalYears:       Math.round((totalMonths / 12) * 10) / 10,
    toolsExperience,
    currentSalary,
    averageSalary,
    primaryPositionId,
    grades,
    topGrade,
  };
}

// ============================================================
// computeRoadmap.ts — генерация RoadMap из накопленных вакансий
// ============================================================

import type { Vacancy, RoadMapData, RoadMapMatrix, Grade } from '../entities';
import { GRADE_ORDER } from '../entities';

export function computeRoadmap(
  positionId: string,
  vacancies: Vacancy[],
  toolSubcategoryMap: Map<string, string>, // toolId → subcategoryId
): RoadMapData {
  const matrix: RoadMapMatrix = {};
  const salaryByGrade: RoadMapData['salaryByGrade'] = {} as RoadMapData['salaryByGrade'];

  for (const vacancy of vacancies) {
    const grade = vacancy.grade;

    // Salary stats
    if (!salaryByGrade[grade]) {
      salaryByGrade[grade] = { min: Infinity, max: 0, median: 0, count: 0, _salaries: [] } as any;
    }
    if (vacancy.salaryFrom) {
      const s = salaryByGrade[grade] as any;
      s._salaries.push(vacancy.salaryFrom);
      s.min = Math.min(s.min, vacancy.salaryFrom);
      s.max = Math.max(s.max, vacancy.salaryFrom);
      s.count++;
    }

    // Matrix
    for (const req of vacancy.minRequirements) {
      const subcategoryId = toolSubcategoryMap.get(req.toolId);
      if (!subcategoryId) continue;

      if (!matrix[subcategoryId]) {
        matrix[subcategoryId] = {} as Record<Grade, any>;
        for (const g of GRADE_ORDER) {
          matrix[subcategoryId][g] = { toolIds: [], count: 0 };
        }
      }

      const cell = matrix[subcategoryId][grade];
      if (!cell.toolIds.includes(req.toolId)) {
        cell.toolIds.push(req.toolId);
      }
      cell.count++;
    }
  }

  // Finalize salary medians
  for (const grade of GRADE_ORDER) {
    const entry = salaryByGrade[grade] as any;
    if (!entry) {
      salaryByGrade[grade] = { min: 0, max: 0, median: 0, count: 0 };
      continue;
    }
    const salaries: number[] = (entry._salaries ?? []).sort((a: number, b: number) => a - b);
    const mid = Math.floor(salaries.length / 2);
    entry.median =
      salaries.length === 0
        ? 0
        : salaries.length % 2 === 0
        ? (salaries[mid - 1] + salaries[mid]) / 2
        : salaries[mid];
    entry.min = entry.min === Infinity ? 0 : entry.min;
    delete entry._salaries;
  }

  return {
    positionId,
    generatedAt: new Date(),
    vacanciesCount: vacancies.length,
    matrix,
    salaryByGrade,
  };
}
