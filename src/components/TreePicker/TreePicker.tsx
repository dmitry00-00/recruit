import { useState, useMemo, useEffect, type ReactNode } from 'react';
import {
  Code2, Palette, BarChart2, Bug, Shield, GitBranch, LayoutGrid,
  ChevronRight, ChevronDown, Plus, Trash2, Pencil, Check, X,
} from 'lucide-react';
import {
  getToolTree, searchTools, DOMAIN_SUB_MAP,
  PRIMARY_DOMAINS, DOMAIN_LABELS, setSubcategoryDomain,
  type ToolDomain,
} from '@/utils';
import { useToolTreeStore } from '@/stores';
import type { ToolCategory, ToolSubcategory, Tool, MatchResult } from '@/entities';
import styles from './TreePicker.module.css';

export type PickerMode =
  | 'vacancy-min'
  | 'vacancy-max'
  | 'candidate'
  | 'vacancy'
  | 'candidate-agg'
  | 'compare'
  | 'position'
  | 'edit';

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
  // Subscribe to the store so tree edits propagate into render.
  const storeTree = useToolTreeStore((s) => s.tree);
  const addSubcategory = useToolTreeStore((s) => s.addSubcategory);
  const updateSubcategory = useToolTreeStore((s) => s.updateSubcategory);
  const removeSubcategory = useToolTreeStore((s) => s.removeSubcategory);
  const addTool = useToolTreeStore((s) => s.addTool);
  const updateTool = useToolTreeStore((s) => s.updateTool);
  const removeTool = useToolTreeStore((s) => s.removeTool);

  const tree = storeTree.length ? storeTree : getToolTree();
  const isEdit = mode === 'edit';

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
      case 'position':      return selectedSet.has(sub.id) ? 1 : 0;
      case 'edit':          return sub.tools.length;
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

  // ── Edit-mode local UI state ──────────────────────────────
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState('');
  const [newSubDraft, setNewSubDraft] = useState<Record<string, string>>({});
  const [newToolDraft, setNewToolDraft] = useState<Record<string, string>>({});
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingToolName, setEditingToolName] = useState('');

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

    const clickable = !isReadonly && !isLocked && !isEdit;
    const isToolEditing = editingToolId === tool.id;

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

        {isEdit && isToolEditing ? (
          <input
            className={styles.inlineAddInput}
            value={editingToolName}
            autoFocus
            onChange={(e) => setEditingToolName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editingToolName.trim()) {
                updateTool(tool.id, { name: editingToolName.trim() });
                setEditingToolId(null);
              } else if (e.key === 'Escape') {
                setEditingToolId(null);
              }
            }}
          />
        ) : (
          <span className={styles.toolName}>{tool.name}</span>
        )}

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

        {isEdit && (
          <span className={styles.subActionRow}>
            {isToolEditing ? (
              <>
                <button
                  className={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingToolName.trim()) {
                      updateTool(tool.id, { name: editingToolName.trim() });
                      setEditingToolId(null);
                    }
                  }}
                  title="Сохранить"
                >
                  <Check size={12} />
                </button>
                <button
                  className={styles.editBtn}
                  onClick={(e) => { e.stopPropagation(); setEditingToolId(null); }}
                  title="Отмена"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.editBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingToolId(tool.id);
                    setEditingToolName(tool.name);
                  }}
                  title="Переименовать"
                >
                  <Pencil size={11} />
                </button>
                <button
                  className={`${styles.editBtn} ${styles.editBtnDanger}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Удалить инструмент "${tool.name}"?`)) removeTool(tool.id);
                  }}
                  title="Удалить"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </span>
        )}
      </div>
    );
  };

  // ── Inline "add tool" row ─────────────────────────────────
  const renderAddToolRow = (subId: string) => {
    const value = newToolDraft[subId] ?? '';
    const submit = () => {
      const name = value.trim();
      if (!name) return;
      addTool(subId, name);
      setNewToolDraft((d) => ({ ...d, [subId]: '' }));
    };
    return (
      <div className={styles.inlineAddRow}>
        <Plus size={12} />
        <input
          className={styles.inlineAddInput}
          placeholder="Новый инструмент…"
          value={value}
          onChange={(e) => setNewToolDraft((d) => ({ ...d, [subId]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button
          className={styles.inlineAddBtn}
          onClick={submit}
          disabled={!value.trim()}
        >
          Добавить
        </button>
      </div>
    );
  };

  // ── Group header + inline rename ──────────────────────────
  const renderGroupHead = (groupName: string, count: number, isFirst: boolean) => (
    <div className={`${styles.groupHead} ${isFirst ? styles.groupHeadFirst : ''}`}>
      <span className={styles.groupLabel}>{groupName}</span>
      {count > 0 && <span className={styles.groupCount}>{count}</span>}
    </div>
  );

  // ── Subcategory toggle ────────────────────────────────────
  const renderSubToggle = (sub: ToolSubcategory, domain: ToolDomain) => {
    const sc = countSub(sub);
    const isOpen = (expanded[domain] ?? null) === sub.id;
    const isSubSelected = mode === 'position' && selectedSet.has(sub.id);
    const isSubEditing = editingSubId === sub.id;

    const toggleSubSelect = () => {
      if (!onChange) return;
      if (selectedSet.has(sub.id)) {
        onChange(selected.filter((id) => id !== sub.id));
      } else {
        onChange([...selected, sub.id]);
      }
    };

    return (
      <div key={sub.id}>
        <div
          className={`${styles.subToggle} ${isOpen ? styles.subToggleOpen : ''} ${isSubSelected ? styles.subToggleSelected : ''}`}
          onClick={() => {
            if (isSubEditing) return;
            if (mode === 'position') toggleSubSelect();
            else toggleSub(domain, sub.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          {mode === 'position' && (
            <input
              type="checkbox"
              className={styles.toolCb}
              checked={isSubSelected}
              onChange={toggleSubSelect}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {mode !== 'position' && (isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}

          {isEdit && isSubEditing ? (
            <input
              className={styles.inlineAddInput}
              value={editingSubName}
              autoFocus
              onChange={(e) => setEditingSubName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editingSubName.trim()) {
                  updateSubcategory(sub.id, { name: editingSubName.trim() });
                  setEditingSubId(null);
                } else if (e.key === 'Escape') {
                  setEditingSubId(null);
                }
              }}
            />
          ) : (
            <span className={styles.subToggleName}>{sub.name}</span>
          )}

          {sc > 0 && <span className={styles.subToggleCount}>{sc}</span>}

          {isEdit && (
            <span className={styles.subActionRow}>
              {isSubEditing ? (
                <>
                  <button
                    className={styles.editBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingSubName.trim()) {
                        updateSubcategory(sub.id, { name: editingSubName.trim() });
                        setEditingSubId(null);
                      }
                    }}
                    title="Сохранить"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    className={styles.editBtn}
                    onClick={(e) => { e.stopPropagation(); setEditingSubId(null); }}
                    title="Отмена"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.editBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSubId(sub.id);
                      setEditingSubName(sub.name);
                    }}
                    title="Переименовать категорию"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className={`${styles.editBtn} ${styles.editBtnDanger}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить категорию "${sub.name}" со всеми инструментами (${sub.tools.length})?`)) {
                        removeSubcategory(sub.id);
                      }
                    }}
                    title="Удалить категорию"
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </span>
          )}
        </div>

        {(isOpen || isEdit) && mode !== 'position' && (
          <div className={styles.toolsPanel}>
            {sub.tools.map(renderTool)}
            {isEdit && renderAddToolRow(sub.id)}
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

    // Group subcategories by sub.group (ungrouped ones come first under '')
    const groupOrder: string[] = [];
    const grouped = new Map<string, ToolSubcategory[]>();
    for (const sub of subs) {
      const g = sub.group ?? '';
      if (!grouped.has(g)) { grouped.set(g, []); groupOrder.push(g); }
      grouped.get(g)!.push(sub);
    }

    const newSubValue = newSubDraft[domain] ?? '';
    const submitNewSub = () => {
      const name = newSubValue.trim();
      if (!name || !activeCat) return;
      const id = addSubcategory(activeCat.id, name);
      setSubcategoryDomain(id, domain);
      setNewSubDraft((d) => ({ ...d, [domain]: '' }));
    };

    return (
      <div
        key={domain}
        className={`${styles.cell} ${isMisc ? styles.cellMisc : ''} ${subs.length === 0 && !isEdit ? styles.cellEmpty : ''}`}
      >
        <div className={styles.cellHead}>
          <Icon size={13} />
          <span className={styles.cellTitle}>{DOMAIN_LABELS[domain]}</span>
          {cnt > 0 && <span className={styles.cellCount}>{cnt}</span>}
        </div>
        <div className={styles.cellBody}>
          {groupOrder.map((g, gi) => {
            const list = grouped.get(g)!;
            const groupCount = list.reduce((a, s) => a + countSub(s), 0);
            return (
              <div key={g || `__ungrouped_${gi}`}>
                {g && renderGroupHead(g, groupCount, gi === 0)}
                {list.map((sub) => renderSubToggle(sub, domain))}
              </div>
            );
          })}
          {isEdit && activeCat && (
            <div className={styles.inlineAdd}>
              <Plus size={12} />
              <input
                className={styles.inlineAddInput}
                placeholder="Новая категория требований…"
                value={newSubValue}
                onChange={(e) => setNewSubDraft((d) => ({ ...d, [domain]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') submitNewSub(); }}
              />
              <button
                className={styles.inlineAddBtn}
                onClick={submitNewSub}
                disabled={!newSubValue.trim()}
              >
                Добавить
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Search ────────────────────────────────────────────────
  const searchResults = useMemo(
    () => (search.trim() && mode !== 'position' ? searchTools(search) : []),
    [search, mode],
  );

  const searchPlaceholder =
    mode === 'vacancy'   ? '1 клик — MIN   |   2 клика — MAX'
    : mode === 'position' ? 'Отметьте подкатегории, входящие в должность'
    : mode === 'edit'    ? 'Поиск инструмента в дереве…'
    : 'Поиск инструментов...';

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={`${styles.wrapper} ${fullHeight ? styles.wrapperFull : ''}`}>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={mode === 'position'}
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
            {(DOMAIN_SUB_MAP['misc'].length > 0 || isEdit) && renderCell('misc')}
          </div>
        )}
      </div>
    </div>
  );
}
