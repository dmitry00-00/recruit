import { create } from 'zustand';
import type { ToolCategory, ToolSubcategory, Tool } from '@/entities';
import seed from '@/data/toolTree.json';

const STORAGE_KEY = 'toolTree.v2';

function loadTree(): ToolCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ToolCategory[];
  } catch {
    // fall through to seed
  }
  return (seed as { categories: ToolCategory[] }).categories;
}

function persist(tree: ToolCategory[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch {
    // ignore quota errors
  }
}

const rand = () => Math.random().toString(36).slice(2, 9);

interface ToolTreeState {
  tree: ToolCategory[];

  /** Replace the entire tree (used on rare resets) */
  setTree: (tree: ToolCategory[]) => void;

  /** Reset to bundled seed */
  reset: () => void;

  // ── Subcategory CRUD ───────────────────────────────────────
  addSubcategory: (
    categoryId: string,
    name: string,
    opts?: { group?: string },
  ) => string;
  updateSubcategory: (
    subId: string,
    patch: Partial<Pick<ToolSubcategory, 'name' | 'group'>>,
  ) => void;
  removeSubcategory: (subId: string) => void;

  // ── Tool CRUD ──────────────────────────────────────────────
  addTool: (
    subId: string,
    name: string,
    opts?: { logoUrl?: string | null; aliases?: string[]; parentToolId?: string },
  ) => string;
  updateTool: (
    toolId: string,
    patch: Partial<Pick<Tool, 'name' | 'logoUrl' | 'aliases'>>,
  ) => void;
  removeTool: (toolId: string) => void;
}

/** Recursively map a tool, applying `fn` to the matching id (including nested children). */
function mapToolDeep(tools: Tool[], toolId: string, fn: (t: Tool) => Tool): Tool[] {
  return tools.map((t) => {
    if (t.id === toolId) return fn(t);
    if (t.children) return { ...t, children: mapToolDeep(t.children, toolId, fn) };
    return t;
  });
}

/** Recursively remove a tool by id from a tools tree. */
function removeToolDeep(tools: Tool[], toolId: string): Tool[] {
  const out: Tool[] = [];
  for (const t of tools) {
    if (t.id === toolId) continue;
    out.push(t.children ? { ...t, children: removeToolDeep(t.children, toolId) } : t);
  }
  return out;
}

export const useToolTreeStore = create<ToolTreeState>((set, get) => ({
  tree: loadTree(),

  setTree: (tree) => {
    persist(tree);
    set({ tree });
  },

  reset: () => {
    const fresh = (seed as { categories: ToolCategory[] }).categories;
    persist(fresh);
    set({ tree: fresh });
  },

  addSubcategory: (categoryId, name, opts) => {
    const id = `sub_${rand()}`;
    const newSub: ToolSubcategory = {
      id,
      categoryId,
      name,
      group: opts?.group,
      tools: [],
    };
    const tree = get().tree.map((c) =>
      c.id === categoryId
        ? { ...c, subcategories: [...c.subcategories, newSub] }
        : c,
    );
    persist(tree);
    set({ tree });
    return id;
  },

  updateSubcategory: (subId, patch) => {
    const tree = get().tree.map((c) => ({
      ...c,
      subcategories: c.subcategories.map((s) =>
        s.id === subId ? { ...s, ...patch } : s,
      ),
    }));
    persist(tree);
    set({ tree });
  },

  removeSubcategory: (subId) => {
    const tree = get().tree.map((c) => ({
      ...c,
      subcategories: c.subcategories.filter((s) => s.id !== subId),
    }));
    persist(tree);
    set({ tree });
  },

  addTool: (subId, name, opts) => {
    const id = `t_${rand()}`;
    const newTool: Tool = {
      id,
      subcategoryId: subId,
      name,
      logoUrl: opts?.logoUrl ?? null,
      aliases: opts?.aliases,
    };
    const parentId = opts?.parentToolId;
    const tree = get().tree.map((c) => ({
      ...c,
      subcategories: c.subcategories.map((s) => {
        if (s.id !== subId) return s;
        if (parentId) {
          return {
            ...s,
            tools: mapToolDeep(s.tools, parentId, (p) => ({
              ...p,
              children: [...(p.children ?? []), newTool],
            })),
          };
        }
        return { ...s, tools: [...s.tools, newTool] };
      }),
    }));
    persist(tree);
    set({ tree });
    return id;
  },

  updateTool: (toolId, patch) => {
    const tree = get().tree.map((c) => ({
      ...c,
      subcategories: c.subcategories.map((s) => ({
        ...s,
        tools: mapToolDeep(s.tools, toolId, (t) => ({ ...t, ...patch })),
      })),
    }));
    persist(tree);
    set({ tree });
  },

  removeTool: (toolId) => {
    const tree = get().tree.map((c) => ({
      ...c,
      subcategories: c.subcategories.map((s) => ({
        ...s,
        tools: removeToolDeep(s.tools, toolId),
      })),
    }));
    persist(tree);
    set({ tree });
  },
}));
