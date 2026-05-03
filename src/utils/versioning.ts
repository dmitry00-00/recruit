/**
 * Versioning of canonical schema (tool tree + position masks).
 *
 * Every imported record carries an `extractionMeta` block recording the
 * versions it was extracted under. This file maintains those versions in
 * `localStorage` so they bump in lockstep with mutations of the canon.
 *
 * Format: `<entity>@<major>.<patch>`, e.g. `tooltree@2.1`, `pos_backend@1.3`.
 *   • major — bump on destructive change (delete / rename of a tool, subcategory, position)
 *   • patch — bump on additive change (new tool, new subcategory, expanded mask)
 *
 * Usage:
 *   getOntologyVersion()                 → 'tooltree@1.0'
 *   bumpOntologyVersion('patch')         → 'tooltree@1.1'
 *   getMaskVersion('pos_backend')        → 'pos_backend@1.0'
 *   bumpMaskVersion('pos_backend','major') → 'pos_backend@2.0'
 */

interface SemVer { major: number; patch: number }

const ONTOLOGY_KEY = 'recruit:ontology_version';
const MASK_KEY_PREFIX = 'recruit:mask_version:';
const DEFAULT_VERSION: SemVer = { major: 1, patch: 0 };

function parseSemVer(s: string): SemVer {
  const m = s.match(/^(\d+)\.(\d+)$/);
  if (!m) return { ...DEFAULT_VERSION };
  return { major: Number(m[1]), patch: Number(m[2]) };
}

function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.patch}`;
}

function readSemVer(key: string): SemVer {
  try {
    const stored = localStorage.getItem(key);
    return stored ? parseSemVer(stored) : { ...DEFAULT_VERSION };
  } catch {
    return { ...DEFAULT_VERSION };
  }
}

function writeSemVer(key: string, v: SemVer): void {
  try { localStorage.setItem(key, formatSemVer(v)); } catch { /* ignore quota errors */ }
}

function bump(v: SemVer, level: 'major' | 'patch'): SemVer {
  return level === 'major'
    ? { major: v.major + 1, patch: 0 }
    : { major: v.major, patch: v.patch + 1 };
}

// ── Ontology (tool tree) ───────────────────────────────────────

export function getOntologyVersion(): string {
  return `tooltree@${formatSemVer(readSemVer(ONTOLOGY_KEY))}`;
}

export function bumpOntologyVersion(level: 'major' | 'patch'): string {
  const next = bump(readSemVer(ONTOLOGY_KEY), level);
  writeSemVer(ONTOLOGY_KEY, next);
  return `tooltree@${formatSemVer(next)}`;
}

// ── Position mask ──────────────────────────────────────────────

export function getMaskVersion(positionId: string): string {
  return `${positionId}@${formatSemVer(readSemVer(MASK_KEY_PREFIX + positionId))}`;
}

export function bumpMaskVersion(positionId: string, level: 'major' | 'patch'): string {
  const next = bump(readSemVer(MASK_KEY_PREFIX + positionId), level);
  writeSemVer(MASK_KEY_PREFIX + positionId, next);
  return `${positionId}@${formatSemVer(next)}`;
}

/**
 * Returns the version string for the legacy/manual records that pre-date
 * versioning. Used as the backfill value in the IndexedDB migration.
 */
export function getLegacyOntologyVersion(): string {
  return 'tooltree@legacy';
}

export function getLegacyMaskVersion(positionId: string): string {
  return `${positionId}@legacy`;
}
