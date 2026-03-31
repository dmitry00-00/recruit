import { useMemo } from 'react';
import type { RoadMapData, Grade } from '@/entities';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import { getToolById, getSubcategoryById } from '@/utils';
import { CURRENCY_SYMBOLS } from '@/config';
import styles from './RoadMap.module.css';

interface RoadMapProps {
  data: RoadMapData;
  currency?: string;
}

export function RoadMap({ data, currency = 'RUB' }: RoadMapProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '₽';
  const grades = useMemo(() => GRADE_ORDER.filter((g) => g !== 'staff' && g !== 'principal'), []);
  const subcategoryIds = Object.keys(data.matrix);

  if (subcategoryIds.length === 0) {
    return <div className={styles.empty}>Нет данных для RoadMap. Добавьте вакансии.</div>;
  }

  const formatSalary = (v: number) => v > 0 ? `${(v / 1000).toFixed(0)}k` : '—';

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Подкатегория</th>
            {grades.map((g) => (
              <th key={g}>{GRADE_LABELS[g]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subcategoryIds.map((subId) => {
            const sub = getSubcategoryById(subId);
            return (
              <tr key={subId}>
                <td className={styles.subName}>{sub?.name ?? subId}</td>
                {grades.map((grade: Grade) => {
                  const cell = data.matrix[subId]?.[grade];
                  if (!cell || cell.toolIds.length === 0) {
                    return <td key={grade}>—</td>;
                  }
                  return (
                    <td key={grade}>
                      <div className={styles.toolChips}>
                        {cell.toolIds.map((toolId) => {
                          const tool = getToolById(toolId);
                          return (
                            <span key={toolId} className={styles.toolChip} title={tool?.name}>
                              {tool?.logoUrl && (
                                <img src={tool.logoUrl} alt="" className={styles.toolChipIcon} />
                              )}
                              {tool?.name ?? toolId}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className={styles.salaryRow}>
            <th>Зарплата ({symbol})</th>
            {grades.map((grade) => {
              const s = data.salaryByGrade[grade];
              return (
                <td key={grade} className={styles.salaryCell}>
                  {s && s.count > 0
                    ? `${formatSalary(s.min)}–${formatSalary(s.max)}`
                    : '—'}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
