/**
 * Aggregation of "where is this tool actually used" — across positions,
 * vacancies and candidate work history. Drives the Tool detail page and the
 * Subcategory comparison table.
 */

import type { Vacancy, Candidate, WorkEntry, Position } from '@/entities';
import { getToolSubcategoryMap } from './toolTreeHelpers';
import { median } from './salaryStats';

export interface ToolUsageStats {
  toolId: string;

  // Positions whose required subcategoryIds include this tool's subcategory.
  positionIds: string[];

  // Vacancies grouped by where this tool appears (min — required, max — desired).
  vacanciesMin: Vacancy[];
  vacanciesMax: Vacancy[];
  vacanciesAll: Vacancy[]; // union of min and max

  // Candidates with at least one workEntry mentioning this tool.
  candidates: Array<{
    candidate: Candidate;
    totalYears: number;          // summed across all workEntries that have this tool
    entries: WorkEntry[];        // entries that mention this tool
  }>;

  // Aggregates
  avgMinYearsRequested: number;  // mean of minYears across vacanciesMin
  medianYearsExperienced: number;// median totalYears among candidates
  avgSalaryFrom: number;         // mean of vacanciesAll.salaryFrom (vacanciesMin only)
  avgSalaryTo: number;           // mean of vacanciesAll.salaryTo

  demand: number;                // = vacanciesAll.length
  supply: number;                // = candidates.length
  scarcity: number;              // = demand / max(1, supply)
}

export function getToolUsageStats(
  toolId: string,
  vacancies: Vacancy[],
  candidates: Candidate[],
  workEntries: WorkEntry[],
  positions: Position[],
): ToolUsageStats {
  const subMap = getToolSubcategoryMap();
  const subId = subMap.get(toolId);

  // ── Positions ──────────────────────────────────────────────────────────
  const positionIds = subId
    ? positions
        .filter((p) =>
          p.requiredCategories.some((rc) => rc.subcategoryIds.includes(subId)),
        )
        .map((p) => p.id)
    : [];

  // ── Vacancies ──────────────────────────────────────────────────────────
  const vacanciesMin: Vacancy[] = [];
  const vacanciesMax: Vacancy[] = [];
  const minYearsRequested: number[] = [];

  for (const v of vacancies) {
    if (v.minRequirements.some((r) => r.toolId === toolId)) {
      vacanciesMin.push(v);
      const m = v.minRequirements.find((r) => r.toolId === toolId);
      if (m?.minYears != null) minYearsRequested.push(m.minYears);
    }
    if (v.maxRequirements.some((r) => r.toolId === toolId)) {
      vacanciesMax.push(v);
    }
  }
  const vacanciesAll = Array.from(
    new Map([...vacanciesMin, ...vacanciesMax].map((v) => [v.id, v])).values(),
  );

  // ── Candidates ────────────────────────────────────────────────────────
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));
  const perCandidate = new Map<string, { totalYears: number; entries: WorkEntry[] }>();

  for (const e of workEntries) {
    const used = e.tools.find((t) => t.toolId === toolId);
    if (!used) continue;
    const acc = perCandidate.get(e.candidateId) ?? { totalYears: 0, entries: [] };
    acc.totalYears += used.years || 0;
    acc.entries.push(e);
    perCandidate.set(e.candidateId, acc);
  }

  const candidatesOut: ToolUsageStats['candidates'] = [];
  for (const [cid, agg] of perCandidate) {
    const candidate = candidateMap.get(cid);
    if (!candidate) continue;
    candidatesOut.push({ candidate, totalYears: agg.totalYears, entries: agg.entries });
  }
  candidatesOut.sort((a, b) => b.totalYears - a.totalYears);

  // ── Aggregates ────────────────────────────────────────────────────────
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const sf = vacanciesAll.map((v) => v.salaryFrom).filter((x): x is number => !!x);
  const st = vacanciesAll.map((v) => v.salaryTo).filter((x): x is number => !!x);

  return {
    toolId,
    positionIds,
    vacanciesMin,
    vacanciesMax,
    vacanciesAll,
    candidates: candidatesOut,
    avgMinYearsRequested: mean(minYearsRequested),
    medianYearsExperienced: median(candidatesOut.map((c) => c.totalYears)),
    avgSalaryFrom: mean(sf),
    avgSalaryTo: mean(st),
    demand: vacanciesAll.length,
    supply: candidatesOut.length,
    scarcity: vacanciesAll.length / Math.max(1, candidatesOut.length),
  };
}

// ── Subcategory comparison ────────────────────────────────────────────────────

export interface SubcategoryComparisonRow {
  toolId: string;
  toolName: string;
  positionsCount: number;
  vacanciesCount: number;
  candidatesCount: number;
  avgMinYears: number;
  medianYears: number;
  avgSalaryMid: number;     // = (avgSalaryFrom + avgSalaryTo) / 2
  scarcity: number;
}

/**
 * Build a comparison table for all tools inside a subcategory.
 * Walks each tool (including children) and computes the universal stats,
 * so the page can render a sortable matrix.
 */
export function getSubcategoryComparison(
  subId: string,
  vacancies: Vacancy[],
  candidates: Candidate[],
  workEntries: WorkEntry[],
  positions: Position[],
  toolList: { id: string; name: string }[],
): SubcategoryComparisonRow[] {
  void subId; // we accept tools as flat list; subId is informational
  return toolList.map(({ id: toolId, name }) => {
    const s = getToolUsageStats(toolId, vacancies, candidates, workEntries, positions);
    return {
      toolId,
      toolName: name,
      positionsCount: s.positionIds.length,
      vacanciesCount: s.vacanciesAll.length,
      candidatesCount: s.candidates.length,
      avgMinYears: s.avgMinYearsRequested,
      medianYears: s.medianYearsExperienced,
      avgSalaryMid: (s.avgSalaryFrom + s.avgSalaryTo) / 2,
      scarcity: s.scarcity,
    };
  });
}
