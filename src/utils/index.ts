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
export {
  extractVacancyFromText,
  extractCandidateFromText,
  getPrompt, setPrompt, resetPrompt, isPromptCustomised,
  getDefaultPrompt, getPromptDomain, setPromptDomain,
  DEFAULT_VACANCY_PROMPT, DEFAULT_CANDIDATE_PROMPT,
  setDeepseekApiKey, getDeepseekApiKey,
} from './llmExtractor';
export type { PromptType } from './llmExtractor';
export {
  PROMPT_DOMAINS,
  PROMPT_DOMAIN_LABELS,
  getPositionsForDomain,
  composePrompt,
} from './promptComposer';
export type { PromptDomain } from './promptComposer';
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
