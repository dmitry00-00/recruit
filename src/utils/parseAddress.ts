/**
 * Parse location strings into structured `Address` objects.
 *
 * Habr Career «Локация» format: "<country>, <city>[, <suffix>]"
 *   "Россия, Москва"                            → { country:'Россия', city:'Москва' }
 *   "Россия, Коченево, пгт"                     → { country:'Россия', city:'Коченево' }
 *   "Казахстан, Тараз (ранее Жамбыл, Джамбул)"  → { country:'Казахстан', city:'Тараз' }
 *   "США, Тампа"                                → { country:'США',     city:'Тампа' }
 *
 * HH.ru gives a structured `area: { id, name }` object — `name` is either a
 * country («Россия») or a city («Москва»). Use `hhAreaToAddress` for that.
 */

import type { Address } from '@/entities';

const KNOWN_COUNTRIES = new Set([
  'Россия', 'Беларусь', 'Казахстан', 'Украина', 'Узбекистан', 'Кыргызстан',
  'Армения', 'Грузия', 'Молдова', 'Таджикистан', 'Туркменистан', 'Азербайджан',
  'США', 'Канада', 'Германия', 'Великобритания', 'Польша', 'Чехия', 'Сербия',
  'Турция', 'Израиль', 'ОАЭ', 'Кипр', 'Нидерланды', 'Португалия', 'Испания',
  'Италия', 'Франция', 'Швеция', 'Финляндия', 'Эстония', 'Латвия', 'Литва',
  'Китай', 'Япония', 'Южная Корея', 'Индия', 'Таиланд', 'Вьетнам', 'Индонезия',
  'Австралия', 'Новая Зеландия', 'Бразилия', 'Аргентина', 'Мексика',
  // English variants
  'Russia', 'USA', 'United States', 'UK', 'United Kingdom', 'Germany', 'France',
  'Spain', 'Italy', 'Netherlands', 'Portugal', 'Israel', 'UAE', 'Cyprus',
]);

/** Strip parenthesised tail like "(ранее Жамбыл)" or "(ex. Bombay)". */
function stripParenTail(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function parseAddressString(input: string | null | undefined): Address | undefined {
  if (!input) return undefined;
  const raw = String(input).trim();
  if (!raw) return undefined;

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { raw };

  const result: Address = { raw };

  if (parts.length === 1) {
    const token = stripParenTail(parts[0]);
    if (KNOWN_COUNTRIES.has(token)) result.country = token;
    else result.city = token;
    return result;
  }

  // Two or more parts: first = country (if known), second = city.
  const first = stripParenTail(parts[0]);
  const second = stripParenTail(parts[1]);

  if (KNOWN_COUNTRIES.has(first)) {
    result.country = first;
    if (second) result.city = second;
  } else {
    // No recognised country prefix — treat first as city, second as region/country.
    result.city = first;
    if (KNOWN_COUNTRIES.has(second)) result.country = second;
  }

  return result;
}

/**
 * HH.ru `area` object → Address.
 * If `name` is a recognised country it goes to `country`, otherwise to `city`.
 * Country inference for Russian cities can be added later by querying
 * HH's `/areas` endpoint.
 */
export function hhAreaToAddress(
  area: { id?: string; name?: string } | null | undefined,
): Address | undefined {
  if (!area || !area.name) return undefined;
  const name = String(area.name).trim();
  if (!name) return undefined;
  if (KNOWN_COUNTRIES.has(name)) return { country: name };
  // Most HH areas are Russian cities — default country to «Россия» unless
  // the name explicitly looks foreign. Conservative: only set country when
  // we are confident.
  return { city: name };
}

/**
 * Compose a flat display string from an Address (for backward-compatible
 * `location: string` field in entities).
 */
export function addressToString(addr: Address | null | undefined): string | undefined {
  if (!addr) return undefined;
  const parts: string[] = [];
  if (addr.country) parts.push(addr.country);
  if (addr.city) parts.push(addr.city);
  if (addr.street) parts.push(addr.street);
  if (parts.length) return parts.join(', ');
  return addr.raw;
}
