/**
 * Parse language strings from candidate profiles.
 *
 *   "Английский C1"            → { code:'en', level:'C1' }
 *   "Русский — родной"         → { code:'ru', level:'native' }
 *   "Немецкий B2"              → { code:'de', level:'B2' }
 *   "English – Fluent"         → { code:'en', level:'C1' }
 *   "Spanish (basic)"          → { code:'es', level:'A2' }
 *
 * Plus `parseEducationLevel` for LinkedIn-style education strings:
 *   "Bachelor's degree"        → 'bachelor'
 *   "Магистр прикладной мат."  → 'master'
 */

import type { Language, LanguageLevel, EducationLevel } from '@/entities';

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  // Russian
  'русский':      'ru', 'russian':    'ru',
  'английский':   'en', 'english':    'en',
  'немецкий':     'de', 'german':     'de', 'deutsch': 'de',
  'французский':  'fr', 'french':     'fr',
  'испанский':    'es', 'spanish':    'es',
  'итальянский':  'it', 'italian':    'it',
  'португальский':'pt', 'portuguese': 'pt',
  'китайский':    'zh', 'chinese':    'zh', 'mandarin': 'zh',
  'японский':     'ja', 'japanese':   'ja',
  'корейский':    'ko', 'korean':     'ko',
  'польский':     'pl', 'polish':     'pl',
  'украинский':   'uk', 'ukrainian':  'uk',
  'белорусский':  'be', 'belarusian': 'be',
  'казахский':    'kk', 'kazakh':     'kk',
  'турецкий':     'tr', 'turkish':    'tr',
  'арабский':     'ar', 'arabic':     'ar',
  'иврит':        'he', 'hebrew':     'he',
  'голландский':  'nl', 'dutch':      'nl',
  'чешский':      'cs', 'czech':      'cs',
  'шведский':     'sv', 'swedish':    'sv',
  'финский':      'fi', 'finnish':    'fi',
};

const CEFR_RE = /\b(A1|A2|B1|B2|C1|C2)\b/i;
const NATIVE_RE       = /\b(native|родной|свободно\s+\(родной\))\b/i;
const FLUENT_RE       = /\b(fluent|advanced|proficient|свободн|профессиональн)\b/i;
const INTERMEDIATE_RE = /\b(intermediate|средний|разговорный|conversational)\b/i;
const BASIC_RE        = /\b(basic|начальный|базовый|elementary|чтение)\b/i;

export function parseLanguageString(input: string | null | undefined): Language | undefined {
  if (!input) return undefined;
  const raw = String(input).trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();

  let code: string | undefined;
  for (const [name, c] of Object.entries(LANGUAGE_NAME_TO_CODE)) {
    if (lower.includes(name)) { code = c; break; }
  }
  if (!code) return undefined;

  const cefr = raw.match(CEFR_RE);
  let level: LanguageLevel;
  if (cefr) {
    level = cefr[1].toUpperCase() as LanguageLevel;
  } else if (NATIVE_RE.test(raw)) {
    level = 'native';
  } else if (FLUENT_RE.test(raw)) {
    level = 'C1';
  } else if (INTERMEDIATE_RE.test(raw)) {
    level = 'B1';
  } else if (BASIC_RE.test(raw)) {
    level = 'A2';
  } else {
    // Language identified but level missing — default conservative B1.
    level = 'B1';
  }

  return { code, level };
}

const EDU_LEVEL_PATTERNS: Array<[RegExp, EducationLevel]> = [
  [/\bphd\b|кандидат\s+наук|доктор\s+наук|doctoral|аспирантура/i, 'phd'],
  [/master|магистр|магистрат/i,                                    'master'],
  [/bachelor|бакалавр|высшее\s+обр|высшее\s+проф/i,                'bachelor'],
  [/среднее\s+специальн|спо\b|колледж|техникум|vocational/i,       'vocational'],
  [/среднее\s+общее|школа|secondary|11\s+класс/i,                  'secondary'],
  [/самообр|self[-\s]?taught|самостоятельно/i,                     'self_taught'],
];

export function parseEducationLevel(input: string | null | undefined): EducationLevel | undefined {
  if (!input) return undefined;
  for (const [re, level] of EDU_LEVEL_PATTERNS) {
    if (re.test(input)) return level;
  }
  return undefined;
}
