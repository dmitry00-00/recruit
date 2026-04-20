import type { ToolCategory, Tool, ToolSubcategory, PositionRequiredCategory } from '@/entities';
import toolTreeData from '@/data/toolTree.json';

const data = toolTreeData as { categories: ToolCategory[] };

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

/** Subcategory id → domain mapping */
export const DOMAIN_SUB_MAP: Record<ToolDomain, string[]> = {
  dev: [
    // Languages (in cat_languages, domain stays dev)
    'sub_javascript', 'sub_python', 'sub_java', 'sub_csharp', 'sub_golang',
    'sub_kotlin', 'sub_swift', 'sub_objc', 'sub_php', 'sub_cpp', 'sub_dart',
    'sub_ruby', 'sub_scala', 'sub_1c', 'sub_html_css',
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

/** All 6 primary domains in grid order (misc is always last / full-width) */
export const PRIMARY_DOMAINS: ToolDomain[] = ['dev', 'design', 'analysis', 'qa', 'infosec', 'devops'];

export function getSubcategoryDomain(subId: string): ToolDomain {
  for (const [domain, subs] of Object.entries(DOMAIN_SUB_MAP) as [ToolDomain, string[]][]) {
    if (subs.includes(subId)) return domain;
  }
  return 'misc';
}

/** Returns subcategories for a domain, preserving original category grouping */
export function getSubsByDomain(domain: ToolDomain): { catName: string; catId: string; sub: ToolSubcategory }[] {
  const subIds = new Set(DOMAIN_SUB_MAP[domain] ?? []);
  const result: { catName: string; catId: string; sub: ToolSubcategory }[] = [];
  for (const cat of data.categories) {
    for (const sub of cat.subcategories) {
      if (subIds.has(sub.id)) {
        result.push({ catName: cat.name, catId: cat.id, sub });
      }
    }
  }
  return result;
}

// ── Core helpers ───────────────────────────────────────────────

export function getToolTree(): ToolCategory[] {
  return data.categories;
}

export function getAllTools(): Tool[] {
  return data.categories.flatMap((cat) =>
    cat.subcategories.flatMap((sub) => sub.tools)
  );
}

export function getToolById(toolId: string): Tool | undefined {
  for (const cat of data.categories) {
    for (const sub of cat.subcategories) {
      const tool = sub.tools.find((t) => t.id === toolId);
      if (tool) return tool;
    }
  }
  return undefined;
}

export function getToolName(toolId: string): string {
  return getToolById(toolId)?.name ?? toolId;
}

export function getToolSubcategoryMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of data.categories) {
    for (const sub of cat.subcategories) {
      for (const tool of sub.tools) {
        map.set(tool.id, sub.id);
      }
    }
  }
  return map;
}

export function getSubcategoryById(subcategoryId: string): ToolSubcategory | undefined {
  for (const cat of data.categories) {
    const sub = cat.subcategories.find((s) => s.id === subcategoryId);
    if (sub) return sub;
  }
  return undefined;
}

export function getCategoryById(categoryId: string): ToolCategory | undefined {
  return data.categories.find((c) => c.id === categoryId);
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
