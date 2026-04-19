import type { Vacancy, RoadMapData, RoadMapMatrix, Grade } from '@/entities';
import { GRADE_ORDER } from '@/entities';

interface SalaryAccumulator {
  min: number;
  max: number;
  median: number;
  count: number;
  _salaries: number[];
}

export function computeRoadmap(
  positionId: string,
  vacancies: Vacancy[],
  toolSubcategoryMap: Map<string, string>,
): RoadMapData {
  const matrix: RoadMapMatrix = {};
  const salaryAcc: Partial<Record<Grade, SalaryAccumulator>> = {};

  for (const vacancy of vacancies) {
    const grade = vacancy.grade;

    if (!salaryAcc[grade]) {
      salaryAcc[grade] = { min: Infinity, max: 0, median: 0, count: 0, _salaries: [] };
    }
    if (vacancy.salaryFrom) {
      const s = salaryAcc[grade]!;
      s._salaries.push(vacancy.salaryFrom);
      s.min = Math.min(s.min, vacancy.salaryFrom);
      s.max = Math.max(s.max, vacancy.salaryFrom);
      s.count++;
    }

    for (const req of vacancy.minRequirements) {
      const subcategoryId = toolSubcategoryMap.get(req.toolId);
      if (!subcategoryId) continue;

      if (!matrix[subcategoryId]) {
        matrix[subcategoryId] = {} as Record<Grade, { toolIds: string[]; count: number }>;
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

  const salaryByGrade = {} as RoadMapData['salaryByGrade'];
  for (const grade of GRADE_ORDER) {
    const entry = salaryAcc[grade];
    if (!entry) {
      salaryByGrade[grade] = { min: 0, max: 0, median: 0, count: 0 };
      continue;
    }
    const salaries = entry._salaries.sort((a, b) => a - b);
    const mid = Math.floor(salaries.length / 2);
    const median =
      salaries.length === 0
        ? 0
        : salaries.length % 2 === 0
        ? (salaries[mid - 1] + salaries[mid]) / 2
        : salaries[mid];
    salaryByGrade[grade] = {
      min: entry.min === Infinity ? 0 : entry.min,
      max: entry.max,
      median,
      count: entry.count,
    };
  }

  return {
    positionId,
    generatedAt: new Date(),
    vacanciesCount: vacancies.length,
    matrix,
    salaryByGrade,
  };
}
