export { computeMatchScore } from './matchScore';
export {
  resolveToolId as resolveToolIdFromAliases,
  resolvePositionId,
  normalizeVacancy,
  normalizeCandidate,
  coerceGrade,
  coerceCurrency,
  coerceWorkFormat,
  coerceEmploymentType,
} from './importNormalizer';
export type { NormalizedVacancy, NormalizedCandidate, NormalizedWorkEntry, NormalizedTool, NormalizedRequirement } from './importNormalizer';
export { extractVacancyFromText, extractCandidateFromText, setDeepseekApiKey, getDeepseekApiKey } from './llmExtractor';
export { aggregateCandidate } from './aggregateCandidate';
export { computeRoadmap } from './computeRoadmap';
export { computeCareerRecommendations } from './computeCareerRecommendations';
export type { SkillRecommendation, CareerRecommendation } from './computeCareerRecommendations';
export { computeVacancyOptimization } from './computeVacancyOptimization';
export type { RequirementImpact, GradeImpact, SalaryImpact, VacancyOptimization } from './computeVacancyOptimization';
export { median, percentile, formatSalary } from './salaryStats';
export {
  getToolTree,
  getAllTools,
  getToolById,
  getToolName,
  getToolSubcategoryMap,
  getSubcategoryById,
  getCategoryById,
  searchTools,
  getSubsByDomain,
  getSubcategoryDomain,
  setSubcategoryDomain,
  flattenRequiredSubIds,
  groupSubIdsByCategory,
  DOMAIN_LABELS,
  DOMAIN_ICONS,
  DOMAIN_SUB_MAP,
  PRIMARY_DOMAINS,
} from './toolTreeHelpers';
export type { ToolDomain } from './toolTreeHelpers';
