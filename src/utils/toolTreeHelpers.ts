import type { ToolCategory, Tool, ToolSubcategory, PositionRequiredCategory } from '@/entities';
import { useToolTreeStore } from '@/stores/toolTreeStore';

// ── Domain taxonomy ────────────────────────────────────────────

export type ToolDomain = 'dev' | 'design' | 'analysis' | 'qa' | 'infosec' | 'devops' | 'misc';

export const DOMAIN_LABELS: Record<ToolDomain, string> = {
  dev:      'Dev',
  design:   'Design',
  analysis: 'Analysis',
  qa:       'QA',
  infosec:  'Infosec',
  devops:   'DevOps',
  misc:     'Разное',
};

export const DOMAIN_ICONS: Record<ToolDomain, string> = {
  dev:      'Code2',
  design:   'Palette',
  analysis: 'BarChart2',
  qa:       'Bug',
  infosec:  'Shield',
  devops:   'GitBranch',
  misc:     'LayoutGrid',
};

/**
 * Seed mapping: subcategory id → domain. Acts as the default for bundled
 * subcategories. User-created subcategories fall back to `misc` until the
 * app learns their domain (extendable via `setSubcategoryDomain`).
 */
const SEED_DOMAIN_SUB_MAP: Record<ToolDomain, string[]> = {
  dev: [
    // Languages — single subcategory with parent languages and child frameworks
    'sub_languages',
    // Tools: data stores, messaging, vcs, mobile SDKs
    'sub_db_sql', 'sub_db_nosql', 'sub_messaging', 'sub_vcs',
    'sub_mobile_ios', 'sub_mobile_android',
    // Skills
    'sub_arch', 'sub_algo', 'sub_mobile_skills',
    // Standards
    'sub_api_standards', 'sub_code_standards', 'sub_db_standards',
  ],
  design: [
    'sub_design_tools',
  ],
  analysis: [
    'sub_bigdata', 'sub_ml', 'sub_project_mgmt',
    'sub_domain', 'sub_company_type', 'sub_team_scale',
    'sub_meta_ecosystems',
  ],
  qa: [
    'sub_testing',
  ],
  infosec: [
    'sub_security',
  ],
  devops: [
    'sub_devops', 'sub_cloud',
  ],
  misc: [],
};

/**
 * Runtime domain map — starts from seed and is mutated when new subcategories
 * are added. We expose it as read-only via a getter but keep the variable
 * mutable internally.
 */
const _domainSubMap: Record<ToolDomain, string[]> = (() => {
  const copy = {} as Record<ToolDomain, string[]>;
  for (const k of Object.keys(SEED_DOMAIN_SUB_MAP) as ToolDomain[]) {
    copy[k] = [...SEED_DOMAIN_SUB_MAP[k]];
  }
  return copy;
})();

export const DOMAIN_SUB_MAP: Record<ToolDomain, string[]> = _domainSubMap;

/** Register a user-created subcategory under a domain (default: misc). */
export function setSubcategoryDomain(subId: string, domain: ToolDomain): void {
  for (const d of Object.keys(_domainSubMap) as ToolDomain[]) {
    _domainSubMap[d] = _domainSubMap[d].filter((id) => id !== subId);
  }
  if (!_domainSubMap[domain].includes(subId)) _domainSubMap[domain].push(subId);
}

/** All 6 primary domains in grid order (misc is always last / full-width) */
export const PRIMARY_DOMAINS: ToolDomain[] = ['dev', 'design', 'analysis', 'qa', 'infosec', 'devops'];

export function getSubcategoryDomain(subId: string): ToolDomain {
  for (const [domain, subs] of Object.entries(_domainSubMap) as [ToolDomain, string[]][]) {
    if (subs.includes(subId)) return domain;
  }
  return 'misc';
}

// ── Core helpers (read from store) ─────────────────────────────

function currentCategories(): ToolCategory[] {
  return useToolTreeStore.getState().tree;
}

export function getToolTree(): ToolCategory[] {
  return currentCategories();
}

/** Recursively collect a tool and all its descendants. */
function flattenTool(tool: Tool): Tool[] {
  const out: Tool[] = [tool];
  if (tool.children) for (const c of tool.children) out.push(...flattenTool(c));
  return out;
}

/** Recursively find a tool by id within a tool subtree. */
function findToolInTree(tools: Tool[], toolId: string): Tool | undefined {
  for (const t of tools) {
    if (t.id === toolId) return t;
    if (t.children) {
      const found = findToolInTree(t.children, toolId);
      if (found) return found;
    }
  }
  return undefined;
}

export function getAllTools(): Tool[] {
  return currentCategories().flatMap((cat) =>
    cat.subcategories.flatMap((sub) => sub.tools.flatMap(flattenTool))
  );
}

export function getToolById(toolId: string): Tool | undefined {
  for (const cat of currentCategories()) {
    for (const sub of cat.subcategories) {
      const found = findToolInTree(sub.tools, toolId);
      if (found) return found;
    }
  }
  return undefined;
}

export function getToolName(toolId: string): string {
  return getToolById(toolId)?.name ?? toolId;
}

export function getToolSubcategoryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of currentCategories()) {
    for (const sub of cat.subcategories) {
      for (const tool of sub.tools) {
        for (const t of flattenTool(tool)) map.set(t.id, sub.id);
      }
    }
  }
  return map;
}

export function getSubcategoryById(subcategoryId: string): ToolSubcategory | undefined {
  for (const cat of currentCategories()) {
    const sub = cat.subcategories.find((s) => s.id === subcategoryId);
    if (sub) return sub;
  }
  return undefined;
}

export function getCategoryById(categoryId: string): ToolCategory | undefined {
  return currentCategories().find((c) => c.id === categoryId);
}

/** Returns subcategories for a domain, preserving original category grouping */
export function getSubsByDomain(domain: ToolDomain): { catName: string; catId: string; sub: ToolSubcategory }[] {
  const subIds = new Set(_domainSubMap[domain] ?? []);
  const result: { catName: string; catId: string; sub: ToolSubcategory }[] = [];
  for (const cat of currentCategories()) {
    for (const sub of cat.subcategories) {
      if (subIds.has(sub.id)) {
        result.push({ catName: cat.name, catId: cat.id, sub });
      }
    }
  }
  return result;
}

/** Flatten requiredCategories into a plain list of subcategoryIds */
export function flattenRequiredSubIds(
  requiredCategories: PositionRequiredCategory[] | undefined,
): string[] {
  if (!requiredCategories?.length) return [];
  return requiredCategories.flatMap((rc) => rc.subcategoryIds);
}

/** Group a flat list of subcategoryIds back into PositionRequiredCategory[] */
export function groupSubIdsByCategory(subIds: string[]): PositionRequiredCategory[] {
  const byCat = new Map<string, string[]>();
  for (const subId of subIds) {
    const sub = getSubcategoryById(subId);
    if (!sub) continue;
    const list = byCat.get(sub.categoryId) ?? [];
    list.push(subId);
    byCat.set(sub.categoryId, list);
  }
  return Array.from(byCat.entries()).map(([categoryId, subcategoryIds]) => ({
    categoryId,
    subcategoryIds,
  }));
}

export function searchTools(query: string): Tool[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return getAllTools().filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.aliases?.some((a) => a.toLowerCase().includes(q))
  );
}
