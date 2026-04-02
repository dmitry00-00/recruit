import { useState, useMemo, type ReactNode } from 'react';
import { getToolTree, searchTools } from '@/utils';
import type { ToolCategory, ToolSubcategory, Tool, MatchResult } from '@/entities';
import styles from './TreePicker.module.css';

export type PickerMode =
  | 'vacancy-min'    // legacy step form (VacancyForm step 3)
  | 'vacancy-max'    // legacy step form (VacancyForm step 4)
  | 'candidate'      // checkbox + years for one work entry
  | 'vacancy'        // click cycles: none → min → max → none
  | 'candidate-agg'  // readonly: aggregated years bars
  | 'compare';       // readonly: diff highlighting

export type VacancyToolState = 'none' | 'min' | 'max';

interface TreePickerProps {
  mode: PickerMode;

  // ── Legacy modes (vacancy-min, vacancy-max, candidate) ──
  selected?: string[];
  locked?: string[];
  onChange?: (ids: string[]) => void;
  withYears?: boolean;
  yearsMap?: Record<string, number>;
  onYearsChange?: (toolId: string, years: number) => void;

  // ── Vacancy combined mode ──
  minIds?: string[];
  maxIds?: string[];
  minYearsMap?: Record<string, number>;
  maxYearsMap?: Record<string, number>;
  /** Parent should cycle: none→min→max→none */
  onVacancyClick?: (toolId: string, currentState: VacancyToolState) => void;
  onVacancyYears?: (toolId: string, level: 'min' | 'max', years: number) => void;

  // ── Compare mode ──
  matchResult?: MatchResult;
  candidateYearsMap?: Record<string, number>;
  requirementsYearsMap?: Record<string, number>;

  // ── Layout ──
  sidebarFooter?: ReactNode;
  fullHeight?: boolean;
}

export function TreePicker({
  mode,
  // legacy
  selected = [],
  locked = [],
  onChange,
  withYears = false,
  yearsMap = {},
  onYearsChange,
  // vacancy combined
  minIds = [],
  maxIds = [],
  minYearsMap = {},
  maxYearsMap = {},
  onVacancyClick,
  onVacancyYears,
  // compare
  matchResult,
  candidateYearsMap = {},
  requirementsYearsMap = {},
  // layout
  sidebarFooter,
  fullHeight = false,
}: TreePickerProps) {
  const tree = useMemo(() => getToolTree(), []);
  const [expandedCat, setExpandedCat] = useState<string | null>(tree[0]?.id ?? null);
  const [activeSub, setActiveSub] = useState<string | null>(
    tree[0]?.subcategories[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');

  const lockedSet  = useMemo(() => new Set(locked), [locked]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const minSet     = useMemo(() => new Set(minIds), [minIds]);
  const maxSet     = useMemo(() => new Set(maxIds), [maxIds]);

  // compare sets
  const matchedSet = useMemo(() => new Set(matchResult?.matched.map((m) => m.toolId) ?? []), [matchResult]);
  const gapSet     = useMemo(() => new Set(matchResult?.gaps.map((g) => g.toolId) ?? []), [matchResult]);
  const extraSet   = useMemo(() => new Set(matchResult?.extras.map((e) => e.toolId) ?? []), [matchResult]);
  const compareAll = useMemo(() => new Set([...matchedSet, ...gapSet, ...extraSet]), [matchedSet, gapSet, extraSet]);

  const getVacState = (id: string): VacancyToolState => {
    if (minSet.has(id)) return 'min';
    if (maxSet.has(id)) return 'max';
    return 'none';
  };

  // ── Category / subcategory counts ──────────────────────────
  const countCat = (cat: ToolCategory) => {
    switch (mode) {
      case 'vacancy':
        return cat.subcategories.reduce((a, s) => a + s.tools.filter((t) => minSet.has(t.id) || maxSet.has(t.id)).length, 0);
      case 'compare':
        return cat.subcategories.reduce((a, s) => a + s.tools.filter((t) => compareAll.has(t.id)).length, 0);
      default:
        return cat.subcategories.reduce((a, s) => a + s.tools.filter((t) => selectedSet.has(t.id)).length, 0);
    }
  };

  const countSub = (sub: ToolSubcategory) => {
    switch (mode) {
      case 'vacancy':      return sub.tools.filter((t) => minSet.has(t.id) || maxSet.has(t.id)).length;
      case 'compare':      return sub.tools.filter((t) => compareAll.has(t.id)).length;
      case 'candidate-agg': return sub.tools.filter((t) => yearsMap[t.id] != null).length;
      default:              return sub.tools.filter((t) => selectedSet.has(t.id)).length;
    }
  };

  const displayTools: Tool[] = useMemo(() => {
    if (search.trim()) return searchTools(search);
    if (!activeSub) return [];
    for (const cat of tree) {
      const sub = cat.subcategories.find((s) => s.id === activeSub);
      if (sub) return sub.tools;
    }
    return [];
  }, [search, activeSub, tree]);

  // ── Agg bars: find max years for scaling ──────────────────
  const aggMax = useMemo(
    () => Math.max(1, ...Object.values(yearsMap).map(Number)),
    [yearsMap],
  );

  const isReadonly = mode === 'candidate-agg' || mode === 'compare';

  return (
    <div className={`${styles.wrapper} ${fullHeight ? styles.wrapperFull : ''}`}>
      {/* ── Left: category sidebar ───────────────────────── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarScroll}>
          {tree.map((cat) => {
            const count = countCat(cat);
            const isExpanded = expandedCat === cat.id;
            return (
              <div key={cat.id}>
                <button
                  className={`${styles.catItem} ${isExpanded ? styles.catItemActive : ''}`}
                  onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                >
                  {cat.name}
                  {count > 0 && (
                    <span className={`${styles.catCount} ${isExpanded ? styles.catCountActive : ''}`}>
                      {count}
                    </span>
                  )}
                </button>
                {isExpanded &&
                  cat.subcategories.map((sub) => {
                    const sc = countSub(sub);
                    return (
                      <button
                        key={sub.id}
                        className={`${styles.subItem} ${activeSub === sub.id ? styles.subItemActive : ''}`}
                        onClick={() => setActiveSub(sub.id)}
                      >
                        {sub.name}
                        {sc > 0 && <span className={styles.catCount}>{sc}</span>}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>

        {sidebarFooter && (
          <div className={styles.sidebarFooter}>{sidebarFooter}</div>
        )}
      </div>

      {/* ── Right: tools list ─────────────────────────────── */}
      <div className={styles.content}>
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            placeholder={
              mode === 'vacancy'
                ? '1 клик — MIN   |   2 клика — MAX'
                : mode === 'compare'
                ? 'Поиск...'
                : 'Поиск инструментов...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.toolsList}>
          {displayTools.length === 0 ? (
            <div className={styles.emptyTools}>
              {search ? 'Ничего не найдено' : 'Выберите подкатегорию'}
            </div>
          ) : (
            displayTools.map((tool) => {
              const isLocked   = lockedSet.has(tool.id);
              const isSelected = selectedSet.has(tool.id);
              const vacState   = getVacState(tool.id);

              const isMatched = matchedSet.has(tool.id);
              const isGap     = gapSet.has(tool.id);
              const isExtra   = extraSet.has(tool.id);

              // Row class
              let rowClass = styles.toolRow;
              if (mode === 'vacancy') {
                if (vacState === 'min') rowClass += ` ${styles.toolRowMin}`;
                else if (vacState === 'max') rowClass += ` ${styles.toolRowMax}`;
              } else if (mode === 'compare') {
                if (isMatched) rowClass += ` ${styles.toolRowMatched}`;
                else if (isGap) rowClass += ` ${styles.toolRowGap}`;
                else if (isExtra) rowClass += ` ${styles.toolRowExtra}`;
              } else if (isLocked) {
                rowClass += ` ${styles.toolLocked}`;
              }

              const clickable =
                !isReadonly && !isLocked && mode !== 'candidate-agg';

              return (
                <div
                  key={tool.id}
                  className={rowClass}
                  onClick={
                    clickable
                      ? () => {
                          if (mode === 'vacancy') {
                            onVacancyClick?.(tool.id, vacState);
                          } else {
                            if (!onChange) return;
                            if (isSelected) onChange(selected.filter((id) => id !== tool.id));
                            else onChange([...selected, tool.id]);
                          }
                        }
                      : undefined
                  }
                  style={clickable ? { cursor: 'pointer' } : undefined}
                >
                  {/* Checkbox — legacy modes */}
                  {(mode === 'vacancy-min' || mode === 'vacancy-max' || mode === 'candidate') && (
                    <input
                      type="checkbox"
                      className={styles.toolCheckbox}
                      checked={isSelected}
                      disabled={isLocked}
                      readOnly
                    />
                  )}

                  {/* Indicator dot — vacancy mode */}
                  {mode === 'vacancy' && (
                    <span
                      className={`${styles.vacancyDot} ${
                        vacState === 'min'
                          ? styles.vacancyDotMin
                          : vacState === 'max'
                          ? styles.vacancyDotMax
                          : styles.vacancyDotNone
                      }`}
                    />
                  )}

                  {/* Indicator — compare mode */}
                  {mode === 'compare' && (
                    <span
                      className={`${styles.cmpIcon} ${
                        isMatched ? styles.cmpMatched
                        : isGap    ? styles.cmpGap
                        : isExtra  ? styles.cmpExtra
                                   : styles.cmpNeutral
                      }`}
                    >
                      {isMatched ? '✓' : isGap ? '✗' : isExtra ? '~' : ''}
                    </span>
                  )}

                  {/* Logo */}
                  {tool.logoUrl && (
                    <img src={tool.logoUrl} alt="" className={styles.toolLogo} loading="lazy" />
                  )}

                  {/* Name */}
                  <span className={styles.toolName}>{tool.name}</span>

                  {/* Locked badge (legacy) */}
                  {(mode === 'vacancy-min' || mode === 'vacancy-max') && isLocked && (
                    <span className={styles.toolLockedBadge}>MIN</span>
                  )}

                  {/* Vacancy badge */}
                  {mode === 'vacancy' && vacState !== 'none' && (
                    <span
                      className={`${styles.vacancyBadge} ${
                        vacState === 'min' ? styles.vacancyBadgeMin : styles.vacancyBadgeMax
                      }`}
                    >
                      {vacState === 'min' ? 'MIN' : 'MAX'}
                    </span>
                  )}

                  {/* Vacancy years input */}
                  {mode === 'vacancy' && vacState !== 'none' && (
                    <input
                      type="number"
                      className={styles.yearsInput}
                      min={0}
                      max={15}
                      step={0.5}
                      value={vacState === 'min' ? (minYearsMap[tool.id] ?? 0) : (maxYearsMap[tool.id] ?? 0)}
                      placeholder="лет"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onVacancyYears?.(tool.id, vacState, parseFloat(e.target.value) || 0)
                      }
                    />
                  )}

                  {/* Legacy vacancy-min/max years */}
                  {(mode === 'vacancy-min' || mode === 'vacancy-max') && isSelected && !isLocked && (
                    <input
                      type="number"
                      className={styles.yearsInput}
                      min={0}
                      max={15}
                      step={0.5}
                      value={yearsMap[tool.id] ?? 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onYearsChange?.(tool.id, parseFloat(e.target.value) || 0)}
                      placeholder="лет"
                    />
                  )}

                  {/* Candidate years input */}
                  {mode === 'candidate' && isSelected && (
                    <input
                      type="number"
                      className={styles.yearsInput}
                      min={0}
                      max={30}
                      step={0.5}
                      value={yearsMap[tool.id] ?? 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onYearsChange?.(tool.id, parseFloat(e.target.value) || 0)}
                      placeholder="лет"
                    />
                  )}

                  {/* Candidate-agg bars */}
                  {mode === 'candidate-agg' && yearsMap[tool.id] != null && (
                    <div className={styles.aggBarWrapper}>
                      <div
                        className={styles.aggBar}
                        style={{ width: `${Math.min(100, ((yearsMap[tool.id] ?? 0) / aggMax) * 100)}%` }}
                      />
                      <span className={styles.aggBarLabel}>{yearsMap[tool.id]}г</span>
                    </div>
                  )}

                  {/* Compare years */}
                  {mode === 'compare' && (isMatched || isGap || isExtra) && (
                    <div className={styles.cmpYears}>
                      <span className={styles.cmpReqYears}>
                        {requirementsYearsMap[tool.id] ? `${requirementsYearsMap[tool.id]}г` : '—'}
                      </span>
                      <span className={styles.cmpSlash}>/</span>
                      <span className={styles.cmpCandYears}>
                        {candidateYearsMap[tool.id] ? `${candidateYearsMap[tool.id]}г` : '—'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
