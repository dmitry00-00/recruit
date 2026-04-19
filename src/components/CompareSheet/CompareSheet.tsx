import { useMemo } from 'react';
import type { MatchResult } from '@/entities';
import { getToolById, getToolSubcategoryMap, getSubcategoryById } from '@/utils';
import styles from './CompareSheet.module.css';

interface CompareSheetProps {
  matchResult: MatchResult;
  showDiff?: boolean;
}

export function CompareSheet({ matchResult, showDiff = false }: CompareSheetProps) {
  const subcatMap = useMemo(() => getToolSubcategoryMap(), []);

  const grouped = useMemo(() => {
    const groups = new Map<string, {
      type: 'matched' | 'gap' | 'extra';
      toolId: string;
      required: number;
      actual: number;
    }[]>();

    const addItem = (toolId: string, type: 'matched' | 'gap' | 'extra', required: number, actual: number) => {
      const subId = subcatMap.get(toolId) ?? 'unknown';
      if (!groups.has(subId)) groups.set(subId, []);
      groups.get(subId)!.push({ type, toolId, required, actual });
    };

    for (const m of matchResult.matched) addItem(m.toolId, 'matched', m.required, m.actual);
    for (const g of matchResult.gaps) addItem(g.toolId, 'gap', g.required, g.actual);
    for (const e of matchResult.extras) addItem(e.toolId, 'extra', 0, e.actual);

    return groups;
  }, [matchResult, subcatMap]);

  return (
    <div className={styles.sheet}>
      <div className={styles.headerRow}>
        <div className={styles.headerVacancy}>Вакансия</div>
        <div className={styles.headerCandidate}>Кандидат</div>
      </div>

      {Array.from(grouped.entries()).map(([subId, items]) => {
        const sub = getSubcategoryById(subId);
        return (
          <div key={subId}>
            <div className={styles.categoryHeader}>{sub?.name ?? subId}</div>
            {items.map((item) => {
              const tool = getToolById(item.toolId);
              const rowClass = showDiff
                ? item.type === 'matched'
                  ? styles.diffMatchedRow
                  : item.type === 'gap'
                  ? styles.diffGapRow
                  : styles.diffExtraRow
                : '';

              return (
                <div key={item.toolId} className={`${styles.toolRow} ${rowClass}`}>
                  <div className={styles.toolLeft}>
                    {item.type !== 'extra' && (
                      <>
                        <span className={styles.toolName}>{tool?.name}</span>
                        {item.required > 0 && (
                          <span className={styles.years}>{item.required}г</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className={`${styles.indicator} ${styles[item.type]}`}>
                    {item.type === 'matched' ? '✓' : item.type === 'gap' ? '✗' : '~'}
                  </div>
                  <div className={styles.toolRight}>
                    {item.type !== 'gap' || item.actual > 0 ? (
                      <>
                        <span className={styles.toolName}>{tool?.name}</span>
                        {item.actual > 0 && (
                          <span className={styles.years}>{item.actual}г</span>
                        )}
                      </>
                    ) : (
                      <span className={styles.years}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className={styles.scoreBar}>
        <span className={styles.scoreLabel}>MIN:</span>
        <span className={styles.scoreValue} style={{ color: 'var(--match)' }}>
          {matchResult.scoreMin}%
        </span>
        <span className={styles.scoreLabel}>MAX:</span>
        <span className={styles.scoreValue} style={{ color: 'var(--cand-color)' }}>
          {matchResult.scoreMax}%
        </span>
      </div>
    </div>
  );
}
