import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';
import type { Tool, WorkEntry } from '@/entities';
import {
  useVacancyStore, useCandidateStore, usePositionStore, useToolTreeStore,
} from '@/stores';
import {
  getSubcategoryById, getCategoryById, getSubcategoryDomain,
  DOMAIN_LABELS, type ToolDomain,
} from '@/utils/toolTreeHelpers';
import { getSubcategoryComparison, type SubcategoryComparisonRow } from '@/utils/toolStats';
import { formatSalary } from '@/utils/salaryStats';
import { db } from '@/db';
import styles from './SubcategoryDetail.module.css';

type SortKey = keyof Pick<
  SubcategoryComparisonRow,
  'toolName' | 'positionsCount' | 'vacanciesCount' | 'candidatesCount'
  | 'avgMinYears' | 'medianYears' | 'avgSalaryMid' | 'scarcity'
>;

interface ColumnDef {
  key: SortKey;
  label: string;
  numeric?: boolean;
  hint?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'toolName',        label: 'Инструмент' },
  { key: 'positionsCount',  label: 'Должности', numeric: true, hint: 'кол-во должностей с этой подкатегорией' },
  { key: 'vacanciesCount',  label: 'Вакансии',  numeric: true, hint: 'кол-во вакансий, требующих инструмент' },
  { key: 'candidatesCount', label: 'Кандидаты', numeric: true, hint: 'кол-во кандидатов с опытом' },
  { key: 'scarcity',        label: 'Дефицит',   numeric: true, hint: 'спрос/предложение, >1 = дефицит' },
  { key: 'avgMinYears',     label: 'Лет (запрос)',  numeric: true, hint: 'средний minYears в вакансиях' },
  { key: 'medianYears',     label: 'Лет (факт)',    numeric: true, hint: 'медиана опыта у кандидатов' },
  { key: 'avgSalaryMid',    label: 'Зарплата',  numeric: true, hint: 'средний midpoint вакансий' },
];

/**
 * Default sort metric per domain — what matters most at a glance for that
 * kind of subcategory. The header for that column is highlighted to hint
 * that it's the "main" signal.
 */
const DOMAIN_PRIMARY: Record<ToolDomain, SortKey> = {
  dev:      'vacanciesCount',
  design:   'candidatesCount',
  analysis: 'avgSalaryMid',
  qa:       'vacanciesCount',
  infosec:  'scarcity',
  devops:   'avgSalaryMid',
  misc:     'vacanciesCount',
};

const DOMAIN_HINT: Record<ToolDomain, string> = {
  dev:      'Сравнение по спросу — какие инструменты чаще всего требуются в вакансиях',
  design:   'Сравнение по предложению — у кого из кандидатов уже есть нужные инструменты',
  analysis: 'Сравнение по зарплате — какие инструменты дороже всего оплачиваются',
  qa:       'Сравнение по спросу — какие тестовые инструменты востребованы',
  infosec:  'Сравнение по дефициту — насколько редкий навык',
  devops:   'Сравнение по зарплате — какие инструменты дают самую высокую оплату',
  misc:     'Сравнение по основным метрикам',
};

function flattenTools(tools: Tool[]): { id: string; name: string; logoUrl?: string | null }[] {
  const out: { id: string; name: string; logoUrl?: string | null }[] = [];
  const walk = (ts: Tool[]) => {
    for (const t of ts) {
      out.push({ id: t.id, name: t.name, logoUrl: t.logoUrl });
      if (t.children) walk(t.children);
    }
  };
  walk(tools);
  return out;
}

export function SubcategoryDetail() {
  const { subId } = useParams<{ subId: string }>();
  const navigate = useNavigate();

  // re-read on tree changes
  useToolTreeStore((s) => s.tree);

  const vacancies = useVacancyStore((s) => s.vacancies);
  const candidates = useCandidateStore((s) => s.candidates);
  const positions = usePositionStore((s) => s.positions);

  const loadVacancies = useVacancyStore((s) => s.load);
  const loadCandidates = useCandidateStore((s) => s.load);
  const loadPositions = usePositionStore((s) => s.load);

  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);

  useEffect(() => {
    if (vacancies.length === 0) loadVacancies();
    if (candidates.length === 0) loadCandidates();
    if (positions.length === 0) loadPositions();
  }, [vacancies.length, candidates.length, positions.length, loadVacancies, loadCandidates, loadPositions]);

  useEffect(() => {
    db.workEntries.toArray().then(setWorkEntries);
  }, []);

  const sub = subId ? getSubcategoryById(subId) : undefined;
  const cat = sub ? getCategoryById(sub.categoryId) : undefined;
  const domain: ToolDomain = sub ? getSubcategoryDomain(sub.id) : 'misc';

  const toolList = useMemo(() => sub ? flattenTools(sub.tools) : [], [sub]);

  const rows = useMemo(() => {
    if (!sub) return [];
    return getSubcategoryComparison(
      sub.id,
      vacancies,
      candidates,
      workEntries,
      positions,
      toolList,
    );
  }, [sub, vacancies, candidates, workEntries, positions, toolList]);

  const [sortKey, setSortKey] = useState<SortKey>(DOMAIN_PRIMARY[domain]);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Re-pick default sort when the domain changes
  useEffect(() => { setSortKey(DOMAIN_PRIMARY[domain]); }, [domain]);

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  if (!sub || !subId) {
    return (
      <div className={styles.page}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Назад
        </button>
        <p className={styles.empty} style={{ marginTop: 20 }}>Подкатегория не найдена</p>
      </div>
    );
  }

  const handleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'toolName' ? 'asc' : 'desc');
    }
  };

  // Aggregates over all rows
  const aggDemand = rows.reduce((a, r) => a + r.vacanciesCount, 0);
  const aggSupply = rows.reduce((a, r) => a + r.candidatesCount, 0);
  const aggSalary = rows.filter((r) => r.avgSalaryMid > 0);
  const avgSalary = aggSalary.length
    ? aggSalary.reduce((a, r) => a + r.avgSalaryMid, 0) / aggSalary.length
    : 0;

  // Heat colour for popularity by quartile
  const popValues = rows.map((r) => r.vacanciesCount);
  const popMax = Math.max(1, ...popValues);
  const heatClass = (n: number): string => {
    if (n === 0) return styles.heat0;
    const q = n / popMax;
    if (q < 0.25) return styles.heat1;
    if (q < 0.5)  return styles.heat2;
    if (q < 0.75) return styles.heat3;
    return styles.heat4;
  };
  const scarcityClass = (s: number): string => {
    if (s < 0.5) return styles.scLow;
    if (s < 1.5) return styles.scMid;
    return styles.scHigh;
  };

  const primary = DOMAIN_PRIMARY[domain];

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Назад
        </button>
      </div>

      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            {sub.name}
            <span className={styles.domainPill}>{DOMAIN_LABELS[domain]}</span>
          </h1>
          <div className={styles.breadcrumb}>
            {cat && <span>{cat.name}</span>}
            <span>·</span>
            <span>{toolList.length} {toolList.length === 1 ? 'инструмент' : 'инструментов'}</span>
            {sub.group && (<><span>·</span><span>{sub.group}</span></>)}
          </div>
        </div>
      </header>

      <p className={styles.subtitle}>{DOMAIN_HINT[domain]}</p>

      <div className={styles.aggStrip}>
        <div className={styles.aggItem}>
          <span className={styles.aggLabel}>Спрос (вакансии)</span>
          <span className={styles.aggValue}>{aggDemand}</span>
        </div>
        <div className={styles.aggItem}>
          <span className={styles.aggLabel}>Предложение (кандидаты)</span>
          <span className={styles.aggValue}>{aggSupply}</span>
        </div>
        <div className={styles.aggItem}>
          <span className={styles.aggLabel}>Средняя ЗП по подкатегории</span>
          <span className={styles.aggValue}>
            {avgSalary > 0 ? formatSalary(avgSalary, '₽') : '—'}
          </span>
        </div>
        <div className={styles.aggItem}>
          <span className={styles.aggLabel}>Дефицит (общий)</span>
          <span className={`${styles.aggValue} ${scarcityClass(aggDemand / Math.max(1, aggSupply))}`}>
            {(aggDemand / Math.max(1, aggSupply)).toFixed(2)}
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>В этой подкатегории нет инструментов</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.key === primary ? styles.thActive : ''}
                    style={c.numeric ? { textAlign: 'right' } : undefined}
                    title={c.hint}
                    onClick={() => handleSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key && (
                      <span className={styles.thIcon}>
                        {sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const tool = toolList.find((t) => t.id === row.toolId);
                return (
                  <tr key={row.toolId} className={styles.row}>
                    <td>
                      <span
                        className={styles.toolCell}
                        onClick={() => navigate(`/tools/tool/${row.toolId}`)}
                      >
                        <span className={styles.toolLogo}>
                          {tool?.logoUrl
                            ? <img src={tool.logoUrl} alt="" />
                            : row.toolName.charAt(0).toUpperCase()}
                        </span>
                        {row.toolName}
                      </span>
                    </td>
                    <td className={`${styles.tdNumeric} ${row.positionsCount === 0 ? styles.muted : ''}`}>
                      {row.positionsCount || '—'}
                    </td>
                    <td className={`${styles.tdNumeric} ${heatClass(row.vacanciesCount)}`}>
                      {row.vacanciesCount || '—'}
                    </td>
                    <td className={`${styles.tdNumeric} ${row.candidatesCount === 0 ? styles.muted : ''}`}>
                      {row.candidatesCount || '—'}
                    </td>
                    <td className={`${styles.tdNumeric} ${row.vacanciesCount === 0 ? styles.muted : scarcityClass(row.scarcity)}`}>
                      {row.vacanciesCount === 0 ? '—' : row.scarcity.toFixed(2)}
                    </td>
                    <td className={`${styles.tdNumeric} ${row.avgMinYears === 0 ? styles.muted : ''}`}>
                      {row.avgMinYears ? row.avgMinYears.toFixed(1) : '—'}
                    </td>
                    <td className={`${styles.tdNumeric} ${row.medianYears === 0 ? styles.muted : ''}`}>
                      {row.medianYears ? row.medianYears.toFixed(1) : '—'}
                    </td>
                    <td className={`${styles.tdNumeric} ${row.avgSalaryMid === 0 ? styles.muted : ''}`}>
                      {row.avgSalaryMid > 0 ? formatSalary(row.avgSalaryMid, '₽') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
