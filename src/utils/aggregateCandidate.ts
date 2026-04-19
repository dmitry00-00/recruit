import type {
  Candidate,
  WorkEntry,
  CandidateAggregation,
  ToolExperience,
  Grade,
} from '@/entities';
import { GRADE_ORDER } from '@/entities';

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

  const toolMap = new Map<string, number>();
  for (const entry of workEntries) {
    for (const t of entry.tools) {
      const existing = toolMap.get(t.toolId) ?? 0;
      toolMap.set(t.toolId, existing + Math.round(t.years * 12));
    }
  }

  const toolsExperience: ToolExperience[] = Array.from(toolMap.entries())
    .map(([toolId, months]) => ({
      toolId,
      months,
      years: Math.round((months / 12) * 2) / 2,
    }))
    .sort((a, b) => b.months - a.months);

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

  const grades: Grade[] = [...new Set(workEntries.map((e) => e.grade))];
  const topGrade = grades.reduce<Grade>(
    (top, g) =>
      GRADE_ORDER.indexOf(g) > GRADE_ORDER.indexOf(top) ? g : top,
    'intern'
  );

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
