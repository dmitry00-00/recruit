import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useToolTreeStore } from '@/stores';
import type { Position, PositionCategory, Tool } from '@/entities';
import styles from './PositionSpecPicker.module.css';

export type SpecToolIds = [string, string];

export interface PositionSpec {
  positionId: string;
  specToolIds: SpecToolIds;
}

interface Props {
  positions: Position[];
  value: PositionSpec;
  onChange: (next: PositionSpec) => void;
  /** Called for each spec tool transition so caller can sync TreePicker selection. */
  onSpecDiff?: (added: string[], removed: string[]) => void;
}

const CATEGORY_LABELS: Partial<Record<PositionCategory, string>> = {
  developer: 'Разработка',
  qa:        'QA',
  analyst:   'Аналитика',
  data:      'Data',
  devops:    'DevOps',
  designer:  'Дизайн',
  manager:   'Управление',
};

const CATEGORY_ORDER: PositionCategory[] = [
  'developer', 'qa', 'analyst', 'data', 'devops', 'designer', 'manager',
];

interface DropdownOption {
  id: string;
  name: string;
  logoUrl?: string | null;
}

interface DropdownGroup {
  label: string;
  items: DropdownOption[];
}

interface DropdownBtnProps {
  placeholder: string;
  value: string;
  options: DropdownOption[];
  groups?: DropdownGroup[];
  onSelect: (id: string) => void;
  onClear?: () => void;
  minWidth?: number;
  panelMaxHeight?: number;
}

function DropdownBtn({
  placeholder, value, options, groups,
  onSelect, onClear, minWidth, panelMaxHeight = 320,
}: DropdownBtnProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = options.find((o) => o.id === value);

  const renderOpt = (opt: DropdownOption) => (
    <button
      key={opt.id}
      type="button"
      className={`${styles.optBtn} ${opt.id === value ? styles.optBtnActive : ''}`}
      onClick={() => { onSelect(opt.id); setOpen(false); }}
    >
      {opt.logoUrl ? (
        <img src={opt.logoUrl} className={styles.optLogo} alt="" loading="lazy" />
      ) : (
        <span className={styles.optLogoStub}>{opt.name.slice(0, 2)}</span>
      )}
      <span className={styles.optName}>{opt.name}</span>
    </button>
  );

  return (
    <div className={styles.wrap} ref={ref} style={minWidth ? { minWidth } : undefined}>
      <button
        type="button"
        className={`${styles.trigger} ${value ? styles.triggerActive : ''} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selected?.logoUrl && (
          <img src={selected.logoUrl} className={styles.triggerLogo} alt="" loading="lazy" />
        )}
        <span className={styles.triggerLabel}>{selected?.name ?? placeholder}</span>
        {value && onClear && (
          <span
            className={styles.clearBtn}
            role="button"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
            title="Сбросить"
          >
            <X size={11} />
          </span>
        )}
        <ChevronDown size={12} className={styles.triggerChevron} />
      </button>

      {open && (
        <div className={styles.panel} style={{ maxHeight: panelMaxHeight }}>
          {groups
            ? groups.map((g) => (
                <div key={g.label} className={styles.group}>
                  <div className={styles.groupLabel}>{g.label}</div>
                  {g.items.map(renderOpt)}
                </div>
              ))
            : options.map(renderOpt)}
          {options.length === 0 && (
            <div className={styles.empty}>Нет вариантов</div>
          )}
        </div>
      )}
    </div>
  );
}

export function PositionSpecPicker({ positions, value, onChange, onSpecDiff }: Props) {
  const tree = useToolTreeStore((s) => s.tree);

  // Position groups by category
  const positionGroups: DropdownGroup[] = useMemo(() => {
    const byCat = new Map<PositionCategory, Position[]>();
    for (const p of positions) {
      const list = byCat.get(p.category) ?? [];
      list.push(p);
      byCat.set(p.category, list);
    }
    return CATEGORY_ORDER
      .filter((c) => byCat.has(c))
      .map((c) => ({
        label: CATEGORY_LABELS[c] ?? c,
        items: (byCat.get(c) ?? []).map((p) => ({ id: p.id, name: p.name, logoUrl: null })),
      }));
  }, [positions]);

  const positionOptions: DropdownOption[] = useMemo(
    () => positions.map((p) => ({ id: p.id, name: p.name, logoUrl: null })),
    [positions],
  );

  const selectedPosition = positions.find((p) => p.id === value.positionId);
  const isDeveloper = selectedPosition?.category === 'developer';

  // Top-level languages from sub_languages
  const langOptions: DropdownOption[] = useMemo(() => {
    const subLangs = tree.flatMap((c) => c.subcategories).find((s) => s.id === 'sub_languages');
    if (!subLangs) return [];
    return subLangs.tools.map((t) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl }));
  }, [tree]);

  const langTool: Tool | undefined = useMemo(() => {
    const subLangs = tree.flatMap((c) => c.subcategories).find((s) => s.id === 'sub_languages');
    return subLangs?.tools.find((t) => t.id === value.specToolIds[0]);
  }, [tree, value.specToolIds]);

  const frameworkOptions: DropdownOption[] = useMemo(
    () => (langTool?.children ?? []).map((t) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl })),
    [langTool],
  );

  const updateSpec = (next: SpecToolIds) => {
    const prev = value.specToolIds;
    const removed = prev.filter((id) => id && !next.includes(id));
    const added = next.filter((id) => id && !prev.includes(id));
    if (onSpecDiff && (removed.length || added.length)) onSpecDiff(added, removed);
    onChange({ ...value, specToolIds: next });
  };

  const handlePositionChange = (id: string) => {
    // If switching away from developer, clear specs
    const newPos = positions.find((p) => p.id === id);
    const wasDeveloper = isDeveloper;
    const willBeDeveloper = newPos?.category === 'developer';
    if (wasDeveloper && !willBeDeveloper) {
      updateSpec(['', '']);
      onChange({ positionId: id, specToolIds: ['', ''] });
    } else {
      onChange({ ...value, positionId: id });
    }
  };

  const handleLangSelect = (id: string) => {
    // Switching language → drop framework slot (it belonged to previous lang)
    updateSpec([id, '']);
  };

  const handleFrameworkSelect = (id: string) => {
    updateSpec([value.specToolIds[0], id]);
  };

  return (
    <div className={styles.bar}>
      <DropdownBtn
        placeholder="Выберите должность"
        value={value.positionId}
        options={positionOptions}
        groups={positionGroups}
        onSelect={handlePositionChange}
        onClear={() => {
          updateSpec(['', '']);
          onChange({ positionId: '', specToolIds: ['', ''] });
        }}
        minWidth={220}
      />

      {isDeveloper && (
        <>
          <DropdownBtn
            placeholder="Язык / платформа"
            value={value.specToolIds[0]}
            options={langOptions}
            onSelect={handleLangSelect}
            onClear={() => updateSpec(['', ''])}
            minWidth={170}
          />
          {value.specToolIds[0] && frameworkOptions.length > 0 && (
            <DropdownBtn
              placeholder="Фреймворк"
              value={value.specToolIds[1]}
              options={frameworkOptions}
              onSelect={handleFrameworkSelect}
              onClear={() => updateSpec([value.specToolIds[0], ''])}
              minWidth={160}
            />
          )}
        </>
      )}
    </div>
  );
}
