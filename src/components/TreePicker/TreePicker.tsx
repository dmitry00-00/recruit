import { useState, useMemo, useEffect, type ReactNode } from 'react';
import {
  Code2, Palette, BarChart2, Bug, Shield, GitBranch, LayoutGrid,
} from 'lucide-react';
import {
  getToolTree, searchTools,
  getSubsByDomain, PRIMARY_DOMAINS, DOMAIN_LABELS,
  type ToolDomain,
} from '@/utils';
import type { ToolSubcategory, Tool, MatchResult } from '@/entities';
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
  onVacancyClick?: (toolId: string, currentState: VacancyToolState) => void;
  onVacancyYears?: (toolId: string, level: 'min' | 'max', years: number) => void;

  // ── Compare mode ──
  matchResult?: MatchResult;
  candidateYearsMap?: Record<string, number>;
  requirementsYearsMap?: Record<string, number>;

  // ── Layout ──
  sidebarFooter?: ReactNode;
  fullHeight?: boolean;

  /**
   * When set, sidebar shows a flat vertical list of only these subcategories
   * (grouped under category headers). Domain grid is hidden in this mode.
   * If empty array → show all subcategories flat.
   */
  filteredSubIds?: string[];
}

const DOMAIN_ICON_MAP: Record<ToolDomain | 'misc', React.ComponentType<{ size?: number }>> = {
  dev:      Code2,
  design:   Palette,
  analysis: BarChart2,
  qa:       Bug,
  infosec:  Shield,
  devops:   GitBranch,
  misc:     LayoutGrid,
};

export function TreePicker({
  mode,
  // legacy
  selected = [],
  locked = [],
  onChange,
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
  filteredSubIds,
}: TreePickerProps) {
  const tree = useMemo(() => getToolTree(), []);
  const useFlat = filteredSubIds !== undefined;

  // ── Flat mode (analytics / roadmap) ───────────────────────
  const flatSubs = useMemo(() => {
    if (!useFlat) return [];
    const filterSet = filteredSubIds!.length > 0 ? new Set(filteredSubIds) : null;
    const result: { catName: string; sub: ToolSubcategory }[] = [];
    for (const cat of tree) {
      for (const sub of cat.subcategories) {
        if (!filterSet || filterSet.has(sub.id)) {
          result.push({ catName: cat.name, sub });
        }
      }
    }
    return result;
  }, [tree, filteredSubIds, useFlat]);

  // ── Domain mode state ──────────────────────────────────────
  const [activeDomain, setActiveDomain] = useState<ToolDomain>('dev');

  const domainSubs = useMemo(
    () => getSubsByDomain(activeDomain),
    [activeDomain],
  );

  // Default active sub
  const defaultSubId = useFlat
    ? (flatSubs[0]?.sub.id ?? null)
    : (domainSubs[0]?.sub.id ?? null);

  const [activeSub, setActiveSub] = useState<string | null>(defaultSubId);
  const [search, setSearch] = useState('');

  // Sync activeSub when domain changes
  useEffect(() => {
    if (!useFlat) {
      setActiveSub(domainSubs[0]?.sub.id ?? null);
    }
  }, [activeDomain]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync activeSub when filteredSubIds changes
  useEffect(() => {
    if (useFlat && flatSubs.length > 0 && !flatSubs.some((f) => f.sub.id === activeSub)) {
      setActiveSub(flatSubs[0].sub.id);
    }
  }, [flatSubs, useFlat]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockedSet   = useMemo(() => new Set(locked), [locked]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const minSet      = useMemo(() => new Set(minIds), [minIds]);
  const maxSet      = useMemo(() => new Set(maxIds), [maxIds]);

  const matchedSet = useMemo(() => new Set(matchResult?.matched.map((m) => m.toolId) ?? []), [matchResult]);
  const gapSet     = useMemo(() => new Set(matchResult?.gaps.map((g) => g.toolId) ?? []), [matchResult]);
  const extraSet   = useMemo(() => new Set(matchResult?.extras.map((e) => e.toolId) ?? []), [matchResult]);
  const compareAll = useMemo(() => new Set([...matchedSet, ...gapSet, ...extraSet]), [matchedSet, gapSet, extraSet]);

  const getVacState = (id: string): VacancyToolState => {
    if (minSet.has(id)) return 'min';
    if (maxSet.has(id)) return 'max';
    return 'none';
  };

  // ── Count helpers ──────────────────────────────────────────
  const countSub = (sub: ToolSubcategory) => {
    switch (mode) {
      case 'vacancy':       return sub.tools.filter((t) => minSet.has(t.id) || maxSet.has(t.id)).length;
      case 'compare':       return sub.tools.filter((t) => compareAll.has(t.id)).length;
      case 'candidate-agg': return sub.tools.filter((t) => yearsMap[t.id] != null).length;
      default:              return sub.tools.filter((t) => selectedSet.has(t.id)).length;
    }
  };

  const countDomain = (domain: ToolDomain) => {
    const subs = getSubsByDomain(domain);
    return subs.reduce((acc, { sub }) => acc + countSub(sub), 0);
  };

  // ── Display tools ──────────────────────────────────────────
  const displayTools: Tool[] = useMemo(() => {
    if (search.trim()) return searchTools(search);
    if (!activeSub) return [];
    for (const cat of tree) {
      const sub = cat.subcategories.find((s) => s.id === activeSub);
      if (sub) return sub.tools;
    }
    return [];
  }, [search, activeSub, tree]);

  const aggMax = useMemo(
    () => Math.max(1, ...Object.values(yearsMap).map(Number)),
    [yearsMap],
  );

  const isReadonly    = mode === 'candidate-agg' || mode === 'compare';
  const useInlineRows = mode !== 'candidate-agg';

  // ── Subcategory list renderer ─────────────────────────────
  const renderSubcatList = () => {
    if (useFlat) {
      let lastCat = '';
      return flatSubs.map(({ catName, sub }) => {
        const showHeader = catName !== lastCat;
        lastCat = catName;
        const sc = countSub(sub);
        return (
          <div key={sub.id}>
            {showHeader && <div className={styles.catHeader}>{catName}</div>}
            <button
              className={`${styles.subItem} ${activeSub === sub.id ? styles.subItemActive : ''}`}
              onClick={() => setActiveSub(sub.id)}
            >
              {sub.name}
              {sc > 0 && <span className={styles.catCount}>{sc}</span>}
            </button>
          </div>
        );
      });
    }

    let lastCatId = '';
    return domainSubs.map(({ catName, catId, sub }) => {
      const showHeader = catId !== lastCatId;
      lastCatId = catId;
      const sc = countSub(sub);
      return (
        <div key={sub.id}>
          {showHeader && <div className={styles.catHeader}>{catName}</div>}
          <button
            className={`${styles.subItem} ${activeSub === sub.id ? styles.subItemActive : ''}`}
            onClick={() => setActiveSub(sub.id)}
          >
            {sub.name}
            {sc > 0 && <span className={styles.catCount}>{sc}</span>}
          </button>
        </div>
      );
    });
  };

  // ── Tool row renderer ─────────────────────────────────────
  const renderToolRow = (tool: Tool) => {
    const isLocked   = lockedSet.has(tool.id);
    const isSelected = selectedSet.has(tool.id);
    const vacState   = getVacState(tool.id);

    const isMatched = matchedSet.has(tool.id);
    const isGap     = gapSet.has(tool.id);
    const isExtra   = extraSet.has(tool.id);

    let rowClass = useInlineRows ? styles.toolRowInline : styles.toolRow;
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

    const clickable = !isReadonly && !isLocked;

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

        {/* Dot — vacancy mode */}
        {mode === 'vacancy' && (
          <span className={`${styles.vacancyDot} ${
            vacState === 'min' ? styles.vacancyDotMin
            : vacState === 'max' ? styles.vacancyDotMax
            : styles.vacancyDotNone
          }`} />
        )}

        {/* Indicator — compare mode */}
        {mode === 'compare' && (
          <span className={`${styles.cmpIcon} ${
            isMatched ? styles.cmpMatched
            : isGap   ? styles.cmpGap
            : isExtra ? styles.cmpExtra
                     : styles.cmpNeutral
          }`}>
            {isMatched ? '✓' : isGap ? '✗' : isExtra ? '~' : ''}
          </span>
        )}

        {/* Logo */}
        {tool.logoUrl ? (
          <img
            src={tool.logoUrl}
            alt={tool.name}
            title={tool.name}
            className={useInlineRows ? styles.toolLogoSmall : styles.toolLogo}
            loading="lazy"
          />
        ) : (
          <span
            className={useInlineRows ? styles.toolNoLogoSmall : styles.toolNoLogo}
            title={tool.name}
          >
            {tool.name.slice(0, 3)}
          </span>
        )}

        {/* Name */}
        <span className={useInlineRows ? styles.toolNameVisible : styles.toolName}>
          {tool.name}
        </span>

        {/* Locked badge */}
        {(mode === 'vacancy-min' || mode === 'vacancy-max') && isLocked && (
          <span className={styles.toolLockedBadge}>MIN</span>
        )}

        {/* Vacancy badge */}
        {mode === 'vacancy' && vacState !== 'none' && (
          <span className={`${styles.vacancyBadge} ${
            vacState === 'min' ? styles.vacancyBadgeMin : styles.vacancyBadgeMax
          }`}>
            {vacState === 'min' ? 'MIN' : 'MAX'}
          </span>
        )}

        {/* Vacancy years */}
        {mode === 'vacancy' && vacState !== 'none' && (
          <input
            type="number"
            className={styles.yearsInput}
            min={0} max={15} step={0.5}
            value={vacState === 'min' ? (minYearsMap[tool.id] ?? 0) : (maxYearsMap[tool.id] ?? 0)}
            placeholder="лет"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onVacancyYears?.(tool.id, vacState, parseFloat(e.target.value) || 0)}
          />
        )}

        {/* Legacy vacancy-min/max years */}
        {(mode === 'vacancy-min' || mode === 'vacancy-max') && isSelected && !isLocked && (
          <input
            type="number"
            className={styles.yearsInput}
            min={0} max={15} step={0.5}
            value={yearsMap[tool.id] ?? 0}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onYearsChange?.(tool.id, parseFloat(e.target.value) || 0)}
            placeholder="лет"
          />
        )}

        {/* Candidate years */}
        {mode === 'candidate' && isSelected && (
          <input
            type="number"
            className={styles.yearsInput}
            min={0} max={30} step={0.5}
            value={yearsMap[tool.id] ?? 0}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onYearsChange?.(tool.id, parseFloat(e.target.value) || 0)}
            placeholder="лет"
          />
        )}

        {/* Agg bars */}
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
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={`${styles.wrapper} ${fullHeight ? styles.wrapperFull : ''} ${!useFlat ? styles.wrapperDomain : ''}`}>

      {/* ── Domain grid — full width at the top ──────────── */}
      {!useFlat && (
        <div className={styles.domainGrid}>
          {PRIMARY_DOMAINS.map((domain) => {
            const Icon = DOMAIN_ICON_MAP[domain];
            const cnt = countDomain(domain);
            return (
              <button
                key={domain}
                className={`${styles.domainTile} ${activeDomain === domain ? styles.domainTileActive : ''}`}
                onClick={() => setActiveDomain(domain)}
                title={DOMAIN_LABELS[domain]}
              >
                <Icon size={16} />
                <span className={styles.domainTileLabel}>{DOMAIN_LABELS[domain]}</span>
                {cnt > 0 && <span className={styles.domainTileCount}>{cnt}</span>}
              </button>
            );
          })}
          {/* Разное — spans all 3 columns */}
          {(() => {
            const Icon = DOMAIN_ICON_MAP['misc'];
            const cnt = countDomain('misc');
            return (
              <button
                className={`${styles.domainTile} ${styles.domainTileMisc} ${activeDomain === 'misc' ? styles.domainTileActive : ''}`}
                onClick={() => setActiveDomain('misc')}
                title={DOMAIN_LABELS['misc']}
              >
                <Icon size={14} />
                <span className={styles.domainTileLabel}>{DOMAIN_LABELS['misc']}</span>
                {cnt > 0 && <span className={styles.domainTileCount}>{cnt}</span>}
              </button>
            );
          })()}
        </div>
      )}

      {/* ── Body: subcategories + tools side by side ─────── */}
      <div className={styles.body}>
        {/* Subcategory sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarScroll}>
            {renderSubcatList()}
          </div>
          {sidebarFooter && (
            <div className={styles.sidebarFooter}>{sidebarFooter}</div>
          )}
        </div>

        {/* Tools panel */}
        <div className={styles.content}>
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              placeholder={
                mode === 'vacancy'
                  ? '1 клик — MIN   |   2 клика — MAX'
                  : 'Поиск инструментов...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={useInlineRows ? styles.toolsListRows : styles.toolsList}>
            {displayTools.length === 0 ? (
              <div className={styles.emptyTools}>
                {search ? 'Ничего не найдено' : 'Выберите подкатегорию'}
              </div>
            ) : (
              displayTools.map(renderToolRow)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
