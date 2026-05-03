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
export { hhToNormalizedVacancy } from './hhConverter';
export type { HHConvertOptions } from './hhConverter';
export {
  HH_CATEGORIES, HH_GROUP_LABELS,
  getHHCategoryById, groupHHCategories,
  getAliases, setAliases, resetAliases, isAliasesCustomised,
} from './hhCategories';
export type { HHCategory, HHGroupId } from './hhCategories';

// ── Schema audit steps 2 & 3: versioning + source parsers ───
export {
  getOntologyVersion, bumpOntologyVersion,
  getMaskVersion, bumpMaskVersion,
  getLegacyOntologyVersion, getLegacyMaskVersion,
} from './versioning';
export { parseSalaryString, hhSalaryToFields } from './parseSalary';
export type { ParsedSalary } from './parseSalary';
export { parseAddressString, hhAreaToAddress, addressToString } from './parseAddress';
export { parseExperienceMonths, monthsAgoToDate } from './parseExperience';
export { parseLanguageString, parseEducationLevel } from './parseLanguage';
export { parseOpenToWorkString } from './parseOpenToWork';
