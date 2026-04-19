import { useState, useMemo, useEffect, type ReactNode } from 'react';
import {
  Code2, Palette, BarChart2, Bug, Shield, GitBranch, LayoutGrid,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import {
  getToolTree, searchTools, DOMAIN_SUB_MAP,
  PRIMARY_DOMAINS, DOMAIN_LABELS,
  type ToolDomain,
} from '@/utils';
import type { ToolCategory, ToolSubcategory, Tool, MatchResult } from '@/entities';
import styles from './TreePicker.module.css';

export type PickerMode =
  | 'vacancy-min'
  | 'vacancy-max'
  | 'candidate'
  | 'vacancy'
  | 'candidate-agg'
  | 'compare';

export type VacancyToolState = 'none' | 'min' | 'max';

interface TreePickerProps {
  mode: PickerMode;
  selected?: string[];
  locked?: string[];
  onChange?: (ids: string[]) => void;
  withYears?: boolean;
  yearsMap?: Record<string, number>;
  onYearsChange?: (toolId: string, years: number) => void;
  minIds?: string[];
  maxIds?: string[];
  minYearsMap?: Record<string, number>;
  maxYearsMap?: Record<string, number>;
  onVacancyClick?: (toolId: string, currentState: VacancyToolState) => void;
  onVacancyYears?: (toolId: string, level: 'min' | 'max', years: number) => void;
  matchResult?: MatchResult;
  candidateYearsMap?: Record<string, number>;
  requirementsYearsMap?: Record<string, number>;
  sidebarFooter?: ReactNode;
  fullHeight?: boolean;
  filteredSubIds?: string[];
}

const ICON_MAP: Record<ToolDomain | 'misc', React.ComponentType<{ size?: number }>> = {
  dev: Code2, design: Palette, analysis: BarChart2,
  qa: Bug, infosec: Shield, devops: GitBranch, misc: LayoutGrid,
};

export function TreePicker({
  mode,
  selected = [], locked = [], onChange,
  yearsMap = {}, onYearsChange,
  minIds = [], maxIds = [],
  minYearsMap = {}, maxYearsMap = {},
  onVacancyClick, onVacancyYears,
  matchResult,
  candidateYearsMap = {}, requirementsYearsMap = {},
  sidebarFooter, fullHeight = false,
  filteredSubIds,
}: TreePickerProps) {
  const tree = useMemo(() => getToolTree(), []);

  const filterSet = useMemo(() => {
    if (filteredSubIds === undefined || filteredSubIds.length === 0) return null;
    return new Set(filteredSubIds);
  }, [filteredSubIds]);

  const [activeCatId, setActiveCatId] = useState(tree[0]?.id ?? '');
  const [expanded, setExpanded] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState('');

  // Reset expanded subcategories when category changes
  useEffect(() => { setExpanded({}); }, [activeCatId]);

  // Auto-select first category that has visible subs (when filter applied)
  useEffect(() => {
    if (!filterSet) return;
    const current = tree.find((c) => c.id === activeCatId);
    if (current && current.subcategories.some((s) => filterSet.has(s.id))) return;
    const first = tree.find((c) => c.subcategories.some((s) => filterSet.has(s.id)));
    if (first) setActiveCatId(first.id);
  }, [filterSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCat = tree.find((c) => c.id === activeCatId);

  // ── Sets ────────────────────────────────────────────────────
  const lockedSet   = useMemo(() => new Set(locked), [locked]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const minSet      = useMemo(() => new Set(minIds), [minIds]);
  const maxSet      = useMemo(() => new Set(maxIds), [maxIds]);

  const matchedSet = useMemo(() => new Set(matchResult?.matched.map((m) => m.toolId) ?? []), [matchResult]);
  const gapSet     = useMemo(() => new Set(matchResult?.gaps.map((g) => g.toolId) ?? []), [matchResult]);
  const extraSet   = useMemo(() => new Set(matchResult?.extras.map((e) => e.toolId) ?? []), [matchResult]);
  const compareAll = useMemo(() => new Set([...matchedSet, ...gapSet, ...extraSet]), [matchedSet, gapSet, extraSet]);

  const aggMax = useMemo(
    () => Math.max(1, ...Object.values(yearsMap).map(Number)),
    [yearsMap],
  );

  const isReadonly = mode === 'candidate-agg' || mode === 'compare';

  const getVacState = (id: string): VacancyToolState =>
    minSet.has(id) ? 'min' : maxSet.has(id) ? 'max' : 'none';

  // ── Count helpers ──────────────────────────────────────────
  const countSub = (sub: ToolSubcategory) => {
    switch (mode) {
      case 'vacancy':       return sub.tools.filter((t) => minSet.has(t.id) || maxSet.has(t.id)).length;
      case 'compare':       return sub.tools.filter((t) => compareAll.has(t.id)).length;
      case 'candidate-agg': return sub.tools.filter((t) => yearsMap[t.id] != null).length;
      default:              return sub.tools.filter((t) => selectedSet.has(t.id)).length;
    }
  };

  /** Get subcategories at the intersection of active category + domain + filter */
  const getCellSubs = (domain: ToolDomain): ToolSubcategory[] => {
    if (!activeCat) return [];
    const domainSubIds = new Set(DOMAIN_SUB_MAP[domain]);
    let subs = activeCat.subcategories.filter((s) => domainSubIds.has(s.id));
    if (filterSet) subs = subs.filter((s) => filterSet.has(s.id));
    return subs;
  };

  const countCell = (domain: ToolDomain) =>
    getCellSubs(domain).reduce((acc, sub) => acc + countSub(sub), 0);

  const countCat = (cat: ToolCategory) =>
    cat.subcategories
      .filter((s) => !filterSet || filterSet.has(s.id))
      .reduce((acc, sub) => acc + countSub(sub), 0);

  const catHasSubs = (cat: ToolCategory) =>
    !filterSet || cat.subcategories.some((s) => filterSet.has(s.id));

  const toggleSub = (domain: string, subId: string) =>
    setExpanded((p) => ({ ...p, [domain]: p[domain] === subId ? null : subId }));

  // ── Tool row renderer ─────────────────────────────────────
  const renderTool = (tool: Tool) => {
    const isLocked   = lockedSet.has(tool.id);
    const isSelected = selectedSet.has(tool.id);
    const vacState   = getVacState(tool.id);
    const isMatched  = matchedSet.has(tool.id);
    const isGap      = gapSet.has(tool.id);
    const isExtra    = extraSet.has(tool.id);

    let cls = styles.toolRow;
    if (mode === 'vacancy') {
      if (vacState === 'min') cls += ` ${styles.toolRowMin}`;
      else if (vacState === 'max') cls += ` ${styles.toolRowMax}`;
    } else if (mode === 'compare') {
      if (isMatched) cls += ` ${styles.toolRowMatched}`;
      else if (isGap) cls += ` ${styles.toolRowGap}`;
      else if (isExtra) cls += ` ${styles.toolRowExtra}`;
    } else if (isLocked) {
      cls += ` ${styles.toolLocked}`;
    }

    const clickable = !isReadonly && !isLocked;

    return (
      <div
        key={tool.id}
        className={cls}
        onClick={clickable ? () => {
          if (mode === 'vacancy') { onVacancyClick?.(tool.id, vacState); }
          else { if (!onChange) return; isSelected ? onChange(selected.filter((id) => id !== tool.id)) : onChange([...selected, tool.id]); }
        } : undefined}
        style={clickable ? { cursor: 'pointer' } : undefined}
      >
        {(mode === 'vacancy-min' || mode === 'vacancy-max' || mode === 'candidate') && (
          <input type="checkbox" className={styles.toolCb} checked={isSelected} disabled={isLocked} readOnly />
        )}

        {mode === 'vacancy' && (
          <span className={`${styles.dot} ${vacState === 'min' ? styles.dotMin : vacState === 'max' ? styles.dotMax : styles.dotNone}`} />
        )}

        {mode === 'compare' && (
          <span className={`${styles.cmpIcon} ${isMatched ? styles.cmpMatched : isGap ? styles.cmpGap : isExtra ? styles.cmpExtra : styles.cmpNeutral}`}>
            {isMatched ? '✓' : isGap ? '✗' : isExtra ? '~' : ''}
          </span>
        )}

        {tool.logoUrl ? (
          <img src={tool.logoUrl} alt={tool.name} title={tool.name} className={styles.toolLogo} loading="lazy" />
        ) : (
          <span className={styles.toolNoLogo} title={tool.name}>{tool.name.slice(0, 3)}</span>
        )}

        <span className={styles.toolName}>{tool.name}</span>

        {(mode === 'vacancy-min' || mode === 'vacancy-max') && isLocked && (
          <span className={styles.toolLockedBadge}>MIN</span>
        )}

        {mode === 'vacancy' && vacState !== 'none' && (
          <span className={`${styles.vacBadge} ${vacState === 'min' ? styles.vacBadgeMin : styles.vacBadgeMax}`}>
            {vacState === 'min' ? 'MIN' : 'MAX'}
          </span>
        )}

        {mode === 'vacancy' && vacState !== 'none' && (
          <input type="number" className={styles.yearsInput} min={0} max={15} step={0.5}
            value={vacState === 'min' ? (minYearsMap[tool.id] ?? 0) : (maxYearsMap[tool.id] ?? 0)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onVacancyYears?.(tool.id, vacState, parseFloat(e.target.value) || 0)} />
        )}

        {(mode === 'vacancy-min' || mode === 'vacancy-max') && isSelected && !isLocked && (
          <input type="number" className={styles.yearsInput} min={0} max={15} step={0.5}
            value={yearsMap[tool.id] ?? 0}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onYearsChange?.(tool.id, parseFloat(e.target.value) || 0)} />
        )}

        {mode === 'candidate' && isSelected && (
          <input type="number" className={styles.yearsInput} min={0} max={30} step={0.5}
            value={yearsMap[tool.id] ?? 0}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onYearsChange?.(tool.id, parseFloat(e.target.value) || 0)} />
        )}

        {mode === 'candidate-agg' && yearsMap[tool.id] != null && (
          <div className={styles.aggWrap}>
            <div className={styles.aggBar} style={{ width: `${Math.min(100, ((yearsMap[tool.id] ?? 0) / aggMax) * 100)}%` }} />
            <span className={styles.aggLabel}>{yearsMap[tool.id]}г</span>
          </div>
        )}

        {mode === 'compare' && (isMatched || isGap || isExtra) && (
          <div className={styles.cmpYears}>
            <span className={styles.cmpReq}>{requirementsYearsMap[tool.id] ? `${requirementsYearsMap[tool.id]}г` : '—'}</span>
            <span className={styles.cmpSlash}>/</span>
            <span className={styles.cmpCand}>{candidateYearsMap[tool.id] ? `${candidateYearsMap[tool.id]}г` : '—'}</span>
          </div>
        )}
      </div>
    );
  };

  // ── Domain cell renderer ──────────────────────────────────
  const renderCell = (domain: ToolDomain) => {
    const subs = getCellSubs(domain);
    const Icon = ICON_MAP[domain];
    const cnt = countCell(domain);
    const isMisc = domain === 'misc';
    const expandedSubId = expanded[domain] ?? null;

    return (
      <div
        key={domain}
        className={`${styles.cell} ${isMisc ? styles.cellMisc : ''} ${subs.length === 0 ? styles.cellEmpty : ''}`}
      >
        <div className={styles.cellHead}>
          <Icon size={13} />
          <span className={styles.cellTitle}>{DOMAIN_LABELS[domain]}</span>
          {cnt > 0 && <span className={styles.cellCount}>{cnt}</span>}
        </div>
        {subs.length > 0 && (
          <div className={styles.cellBody}>
            {subs.map((sub) => {
              const sc = countSub(sub);
              const isOpen = expandedSubId === sub.id;
              return (
                <div key={sub.id}>
                  <button
                    className={`${styles.subToggle} ${isOpen ? styles.subToggleOpen : ''}`}
                    onClick={() => toggleSub(domain, sub.id)}
                  >
                    {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    <span className={styles.subToggleName}>{sub.name}</span>
                    {sc > 0 && <span className={styles.subToggleCount}>{sc}</span>}
                  </button>
                  {isOpen && (
                    <div className={styles.toolsPanel}>
                      {sub.tools.map(renderTool)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Search ────────────────────────────────────────────────
  const searchResults = useMemo(() => (search.trim() ? searchTools(search) : []), [search]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={`${styles.wrapper} ${fullHeight ? styles.wrapperFull : ''}`}>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder={mode === 'vacancy' ? '1 клик — MIN   |   2 клика — MAX' : 'Поиск инструментов...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.main}>
        {/* ── Left: category sidebar ─────────────────────── */}
        <div className={styles.catSidebar}>
          <div className={styles.catList}>
            {tree.map((cat) => {
              const hasSubs = catHasSubs(cat);
              const cnt = countCat(cat);
              return (
                <button
                  key={cat.id}
                  className={`${styles.catItem} ${activeCatId === cat.id ? styles.catItemActive : ''} ${!hasSubs ? styles.catItemDisabled : ''}`}
                  onClick={() => hasSubs && setActiveCatId(cat.id)}
                >
                  <span className={styles.catItemName}>{cat.name}</span>
                  {cnt > 0 && <span className={styles.catItemCount}>{cnt}</span>}
                </button>
              );
            })}
          </div>
          {sidebarFooter && <div className={styles.catFooter}>{sidebarFooter}</div>}
        </div>

        {/* ── Right: domain grid or search results ───────── */}
        {search.trim() ? (
          <div className={styles.searchResults}>
            {searchResults.length === 0
              ? <div className={styles.emptyTools}>Ничего не найдено</div>
              : searchResults.map(renderTool)}
          </div>
        ) : (
          <div className={styles.grid}>
            {PRIMARY_DOMAINS.map((d) => renderCell(d))}
            {renderCell('misc')}
          </div>
        )}
      </div>
    </div>
  );
}
