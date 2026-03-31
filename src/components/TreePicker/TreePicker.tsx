import { useState, useMemo } from 'react';
import { getToolTree, searchTools } from '@/utils';
import type { ToolCategory, ToolSubcategory, Tool } from '@/entities';
import styles from './TreePicker.module.css';

type PickerMode = 'vacancy-min' | 'vacancy-max' | 'candidate';

interface TreePickerProps {
  selected: string[];
  locked?: string[];
  onChange: (ids: string[]) => void;
  mode: PickerMode;
  withYears?: boolean;
  yearsMap?: Record<string, number>;
  onYearsChange?: (toolId: string, years: number) => void;
}

export function TreePicker({
  selected,
  locked = [],
  onChange,
  mode,
  withYears = false,
  yearsMap = {},
  onYearsChange,
}: TreePickerProps) {
  const tree = useMemo(() => getToolTree(), []);
  const [expandedCat, setExpandedCat] = useState<string | null>(tree[0]?.id ?? null);
  const [activeSub, setActiveSub] = useState<string | null>(
    tree[0]?.subcategories[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');

  const lockedSet = useMemo(() => new Set(locked), [locked]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const countForCategory = (cat: ToolCategory) =>
    cat.subcategories.reduce(
      (acc, sub) => acc + sub.tools.filter((t) => selectedSet.has(t.id)).length,
      0,
    );

  const countForSub = (sub: ToolSubcategory) =>
    sub.tools.filter((t) => selectedSet.has(t.id)).length;

  const displayTools: Tool[] = useMemo(() => {
    if (search.trim()) return searchTools(search);
    if (!activeSub) return [];
    for (const cat of tree) {
      const sub = cat.subcategories.find((s) => s.id === activeSub);
      if (sub) return sub.tools;
    }
    return [];
  }, [search, activeSub, tree]);

  const toggleTool = (toolId: string) => {
    if (lockedSet.has(toolId)) return;
    if (selectedSet.has(toolId)) {
      onChange(selected.filter((id) => id !== toolId));
    } else {
      onChange([...selected, toolId]);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Left: category tree */}
      <div className={styles.sidebar}>
        {tree.map((cat) => {
          const count = countForCategory(cat);
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
                  const subCount = countForSub(sub);
                  return (
                    <button
                      key={sub.id}
                      className={`${styles.subItem} ${activeSub === sub.id ? styles.subItemActive : ''}`}
                      onClick={() => setActiveSub(sub.id)}
                    >
                      {sub.name}
                      {subCount > 0 && (
                        <span className={styles.catCount}>{subCount}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Right: tools list */}
      <div className={styles.content}>
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            placeholder="Поиск инструментов..."
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
              const isLocked = lockedSet.has(tool.id);
              const isSelected = selectedSet.has(tool.id);
              return (
                <div
                  key={tool.id}
                  className={`${styles.toolRow} ${isLocked ? styles.toolLocked : ''}`}
                  onClick={() => toggleTool(tool.id)}
                >
                  <input
                    type="checkbox"
                    className={styles.toolCheckbox}
                    checked={isSelected}
                    disabled={isLocked}
                    readOnly
                  />
                  {tool.logoUrl && (
                    <img
                      src={tool.logoUrl}
                      alt=""
                      className={styles.toolLogo}
                      loading="lazy"
                    />
                  )}
                  <span className={styles.toolName}>{tool.name}</span>
                  {isLocked && (
                    <span className={styles.toolLockedBadge}>MIN</span>
                  )}
                  {withYears && isSelected && (
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
                  {!withYears && mode !== 'candidate' && isSelected && !isLocked && (
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
