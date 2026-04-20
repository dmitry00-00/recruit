import { useMemo } from 'react';
import { Code2, Palette, BarChart2, Bug, Shield, GitBranch, LayoutGrid } from 'lucide-react';
import {
  getToolById,
  getToolSubcategoryMap,
  getSubcategoryDomain,
  DOMAIN_LABELS,
  PRIMARY_DOMAINS,
  type ToolDomain,
} from '@/utils';
import styles from './DomainToolStack.module.css';

const DOMAIN_ICON: Record<ToolDomain, React.ComponentType<{ size?: number }>> = {
  dev: Code2,
  design: Palette,
  analysis: BarChart2,
  qa: Bug,
  infosec: Shield,
  devops: GitBranch,
  misc: LayoutGrid,
};

interface Props {
  toolIds: string[];
  max?: number;
}

export function DomainToolStack({ toolIds, max = 8 }: Props) {
  const groups = useMemo(() => {
    const subMap = getToolSubcategoryMap();
    const byDomain = new Map<ToolDomain, string[]>();
    for (const id of toolIds) {
      const subId = subMap.get(id);
      const domain = subId ? getSubcategoryDomain(subId) : 'misc';
      const arr = byDomain.get(domain) ?? [];
      arr.push(id);
      byDomain.set(domain, arr);
    }
    const ordered: { domain: ToolDomain; ids: string[] }[] = [];
    for (const d of PRIMARY_DOMAINS) {
      const ids = byDomain.get(d);
      if (ids && ids.length) ordered.push({ domain: d, ids });
    }
    const miscIds = byDomain.get('misc');
    if (miscIds && miscIds.length) ordered.push({ domain: 'misc', ids: miscIds });
    return ordered;
  }, [toolIds]);

  if (groups.length === 0) {
    return <div className={styles.empty}>—</div>;
  }

  return (
    <div className={styles.stack}>
      {groups.map(({ domain, ids }) => {
        const Icon = DOMAIN_ICON[domain];
        const visible = ids.slice(0, max);
        const extra = ids.length - visible.length;
        return (
          <div key={domain} className={styles.group}>
            <div className={styles.header}>
              <Icon size={11} />
              <span className={styles.label}>{DOMAIN_LABELS[domain]}</span>
            </div>
            <div className={styles.chips}>
              {visible.map((id) => {
                const tool = getToolById(id);
                if (!tool) return null;
                return (
                  <span key={id} className={styles.chip} title={tool.name}>
                    {tool.logoUrl ? (
                      <img src={tool.logoUrl} alt="" className={styles.logo} />
                    ) : (
                      <span className={styles.initial}>{tool.name.slice(0, 2)}</span>
                    )}
                  </span>
                );
              })}
              {extra > 0 && <span className={styles.extra}>+{extra}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
