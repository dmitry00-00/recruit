import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import type { Vacancy, WorkEntry } from '@/entities';
import { CURRENCY_SYMBOLS } from '@/config';
import styles from './SalaryChart.module.css';

interface SalaryChartProps {
  vacancies?: Vacancy[];
  workHistory?: WorkEntry[];
  currentSalary?: number;
  currency?: string;
}

interface DataPoint {
  date: number;
  vacancySalary?: number;
  candidateSalary?: number;
}

export function SalaryChart({ vacancies, workHistory, currentSalary, currency = 'RUB' }: SalaryChartProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '₽';

  const data: DataPoint[] = [];

  if (vacancies) {
    for (const v of vacancies) {
      if (v.salaryFrom) {
        data.push({ date: new Date(v.publishedAt).getTime(), vacancySalary: v.salaryFrom });
      }
    }
  }

  if (workHistory) {
    for (const w of workHistory) {
      if (w.salary) {
        data.push({ date: new Date(w.startDate).getTime(), candidateSalary: w.salary });
      }
    }
  }

  data.sort((a, b) => a.date - b.date);

  if (data.length === 0) {
    return <div className={styles.empty}>Недостаточно данных для графика</div>;
  }

  const formatDate = (val: number) => {
    const d = new Date(val);
    return `${d.getFullYear()}`;
  };

  const formatSalary = (val: number) => `${(val / 1000).toFixed(0)}k`;

  return (
    <div className={styles.wrapper}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--text-tertiary)" fontSize={11} />
          <YAxis tickFormatter={formatSalary} stroke="var(--text-tertiary)" fontSize={11} />
          <Tooltip
            labelFormatter={(v) => new Date(v as number).toLocaleDateString('ru-RU')}
            formatter={(v: number) => [`${(v / 1000).toFixed(0)}k ${symbol}`, '']}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="vacancySalary"
            name="Вакансии"
            stroke="var(--amber)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="candidateSalary"
            name="Кандидат"
            stroke="var(--cand-color)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          {currentSalary && (
            <ReferenceLine
              y={currentSalary}
              stroke="var(--text-tertiary)"
              strokeDasharray="4 4"
              label={{ value: `${(currentSalary / 1000).toFixed(0)}k`, fill: 'var(--text-tertiary)', fontSize: 11 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
