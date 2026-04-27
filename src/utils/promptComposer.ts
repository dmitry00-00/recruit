/**
 * Domain-aware system prompt composer.
 *
 * Final prompt structure:
 *   §1  Extraction rules (from DEFAULT_*_PROMPT — concise, rules-only)
 *   §2  Output schema   (from *.template.json — single source of truth)
 *   §3  Domain context  (positionId allow-list + position masks filtered by domain)
 *
 * This avoids duplicating the JSON shape in both the base rules and the template.
 */

import type { PositionCategory } from '@/entities';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import defaultPositionsData from '@/data/defaultPositions.json';
import vacancyTemplate from '@/data/schemas/vacancy.template.json';
import candidateTemplate from '@/data/schemas/candidate.template.json';
import { DEFAULT_VACANCY_PROMPT, DEFAULT_CANDIDATE_PROMPT } from './llmExtractor';

// ── Domain types ──────────────────────────────────────────────────────────────

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

// ── Position masks ────────────────────────────────────────────────────────────

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

// ── Template helpers ──────────────────────────────────────────────────────────

/** Remove _comment / _fieldGuide / _version keys before handing to the model. */
function stripMetaKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripMetaKeys);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k.startsWith('_')) continue;
      out[k] = stripMetaKeys(v);
    }
    return out;
  }
  return obj;
}

function positionsBlock(positions: PositionMask[]): string {
  if (positions.length === 0) return '(no positions for this domain)';
  return positions
    .map((p) => {
      const subs = p.requiredCategories.flatMap((rc) => rc.subcategoryIds).join(', ');
      return `  ${p.id} — "${p.name}" (${p.subcategory}); required tool subcategories: [${subs || '—'}]`;
    })
    .join('\n');
}

// ── Composers ────────────────────────────────────────────────────────────────

export function composeVacancyPrompt(domain: PromptDomain): string {
  const positions = getPositionsForDomain(domain);
  const allowedIds = positions.map((p) => p.id).join(' | ');
  const schema = JSON.stringify(stripMetaKeys(vacancyTemplate), null, 2);

  return `${DEFAULT_VACANCY_PROMPT}

## OUTPUT SCHEMA
Return a JSON object with exactly this shape (values shown are examples):
\`\`\`json
${schema}
\`\`\`

## DOMAIN: ${PROMPT_DOMAIN_LABELS[domain]}
positionId MUST be one of: ${allowedIds || '(any)'}

Allowed positions and their required tool subcategory groups:
${positionsBlock(positions)}`;
}

export function composeCandidatePrompt(domain: PromptDomain): string {
  const positions = getPositionsForDomain(domain);
  const allowedIds = positions.map((p) => p.id).join(' | ');
  const schema = JSON.stringify(stripMetaKeys(candidateTemplate), null, 2);

  return `${DEFAULT_CANDIDATE_PROMPT}

## OUTPUT SCHEMA
Return a JSON object with exactly this shape (values shown are examples):
\`\`\`json
${schema}
\`\`\`

## DOMAIN: ${PROMPT_DOMAIN_LABELS[domain]}
positionId (candidate level and each workEntries entry) MUST be one of: ${allowedIds || '(any)'}

Allowed positions and their required tool subcategory groups:
${positionsBlock(positions)}`;
}

export function composePrompt(type: 'vacancy' | 'candidate', domain: PromptDomain): string {
  return type === 'vacancy' ? composeVacancyPrompt(domain) : composeCandidatePrompt(domain);
}
