import type { ToolCategory, Tool, ToolSubcategory } from '@/entities';
import toolTreeData from '@/data/toolTree.json';

const data = toolTreeData as { categories: ToolCategory[] };

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

export function searchTools(query: string): Tool[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return getAllTools().filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.aliases?.some((a) => a.toLowerCase().includes(q))
  );
}
