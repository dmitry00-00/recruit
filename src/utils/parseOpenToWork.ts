/**
 * Parse "open to work" status strings from candidate profiles.
 *
 *   "Не ищу работу"               → 'not_looking'
 *   "Ищу работу"                  → 'looking'
 *   "Рассмотрю предложения"       → 'considering'
 *   "От 50 000 ₽ - Не ищу работу" → 'not_looking'   (works on combined Habr salary strings)
 *   "Open to work"                → 'looking'
 *   "Not looking for work"        → 'not_looking'
 *   "#OpenToWork"                 → 'looking'
 */

import type { OpenToWorkStatus } from '@/entities';

export function parseOpenToWorkString(input: string | null | undefined): OpenToWorkStatus | undefined {
  if (!input) return undefined;
  const s = String(input).toLowerCase();
  if (!s.trim()) return undefined;

  // Order matters: match the most specific phrase first. "Не ищу" must be
  // checked before "ищу", otherwise the latter wins.
  if (/не\s*ищу|not\s*looking|not\s*open\s*to|closed\s+to\s+offers/.test(s)) {
    return 'not_looking';
  }
  if (/рассмотрю\s+предложен|open\s+to\s+offers|considering|passively/.test(s)) {
    return 'considering';
  }
  if (/ищу\s+работ|actively\s+looking|looking\s+for\s+work|#?open[-\s]?to[-\s]?work/.test(s)) {
    return 'looking';
  }
  return undefined;
}
