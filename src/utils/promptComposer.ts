/**
 * Domain-aware system prompt composer.
 * Builds an LLM system prompt by combining:
 *   1) base extraction rules (vacancy or candidate),
 *   2) the canonical *.template.json structure as the target shape,
 *   3) position masks from defaultPositions.json filtered by domain,
 *   4) the list of allowed positionIds for that domain.
 *
 * This lets the user pick a focused prompt variant (e.g. "developer" vs "qa")
 * instead of dumping every position template into a single mega-prompt.
 */

import type { PositionCategory } from '@/entities';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import defaultPositionsData from '@/data/defaultPositions.json';
import vacancyTemplate from '@/data/schemas/vacancy.template.json';
import candidateTemplate from '@/data/schemas/candidate.template.json';
import { DEFAULT_VACANCY_PROMPT, DEFAULT_CANDIDATE_PROMPT } from './llmExtractor';

export type PromptDomain = PositionCategory | 'any';

export const PROMPT_DOMAIN_LABELS: Record<PromptDomain, string> = {
  any: 'Любой (универсально)',
  ...POSITION_CATEGORY_LABELS,
};

export const PROMPT_DOMAINS: PromptDomain[] = [
  'any',
  'developer',
  'qa',
  'devops',
  'analyst',
  'data',
  'designer',
  'manager',
];

interface PositionMask {
  id: string;
  name: string;
  category: PositionCategory;
  subcategory: string;
  description?: string;
  grades: string[];
  requiredCategories: { categoryId: string; subcategoryIds: string[] }[];
}

const ALL_POSITIONS = (defaultPositionsData.positions ?? []) as PositionMask[];

export function getPositionsForDomain(domain: PromptDomain): PositionMask[] {
  if (domain === 'any') return ALL_POSITIONS;
  return ALL_POSITIONS.filter((p) => p.category === domain);
}

/**
 * Strip _comment / _fieldGuide / _version helper keys from a template object
 * before serialising it for the LLM — the model only needs the shape.
 */
function stripMetaKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripMetaKeys);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue;
      out[k] = stripMetaKeys(v);
    }
    return out;
  }
  return obj;
}

function formatPositionsBlock(positions: PositionMask[]): string {
  if (positions.length === 0) return '(нет шаблонов в этом домене)';
  return positions
    .map((p) => {
      const subs = p.requiredCategories
        .flatMap((rc) => rc.subcategoryIds)
        .join(', ');
      return `- ${p.id} ("${p.name}", ${p.subcategory}) — required subcategories: ${subs || '—'}`;
    })
    .join('\n');
}

export function composeVacancyPrompt(domain: PromptDomain): string {
  const positions = getPositionsForDomain(domain);
  const allowedIds = positions.map((p) => p.id).join(', ');
  const templateJson = JSON.stringify(stripMetaKeys(vacancyTemplate), null, 2);

  return `${DEFAULT_VACANCY_PROMPT}

# Domain: ${PROMPT_DOMAIN_LABELS[domain]}
You are extracting a vacancy in the "${PROMPT_DOMAIN_LABELS[domain]}" domain.
Restrict positionId to one of: ${allowedIds || '(any)'}.
If the input clearly belongs to a different domain, still return the closest match and add a note in "notes".

# Position masks (allowed positionIds and their required tool subcategories)
${formatPositionsBlock(positions)}

# Canonical JSON shape (filled example — match this structure exactly)
${templateJson}`;
}

export function composeCandidatePrompt(domain: PromptDomain): string {
  const positions = getPositionsForDomain(domain);
  const allowedIds = positions.map((p) => p.id).join(', ');
  const templateJson = JSON.stringify(stripMetaKeys(candidateTemplate), null, 2);

  return `${DEFAULT_CANDIDATE_PROMPT}

# Domain: ${PROMPT_DOMAIN_LABELS[domain]}
You are extracting a candidate's resume in the "${PROMPT_DOMAIN_LABELS[domain]}" domain.
Restrict candidate-level positionId and each workEntries[].positionId to one of: ${allowedIds || '(any)'}.
If a past job clearly belongs to a different domain, pick the closest match from the allowed list.

# Position masks (allowed positionIds and their required tool subcategories)
${formatPositionsBlock(positions)}

# Canonical JSON shape (filled example — match this structure exactly)
${templateJson}`;
}

export function composePrompt(type: 'vacancy' | 'candidate', domain: PromptDomain): string {
  return type === 'vacancy' ? composeVacancyPrompt(domain) : composeCandidatePrompt(domain);
}
