export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function formatSalary(value: number, symbol: string): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ${symbol}`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k ${symbol}`;
  }
  return `${value} ${symbol}`;
}
