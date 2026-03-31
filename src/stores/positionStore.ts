import { create } from 'zustand';
import type { Position, PositionCategory } from '@/entities';
import { db } from '@/db';

interface PositionState {
  positions: Position[];
  loading: boolean;
  load: () => Promise<void>;
  add: (position: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  update: (id: string, data: Partial<Position>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getByCategory: (cat: PositionCategory) => Position[];
  getById: (id: string) => Position | undefined;
}

export const usePositionStore = create<PositionState>((set, get) => ({
  positions: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const positions = await db.positions.toArray();
    set({ positions, loading: false });
  },

  add: async (data) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const position: Position = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await db.positions.add(position);
    set((s) => ({ positions: [...s.positions, position] }));
    return id;
  },

  update: async (id, data) => {
    const updatedAt = new Date();
    await db.positions.update(id, { ...data, updatedAt });
    set((s) => ({
      positions: s.positions.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt } : p
      ),
    }));
  },

  remove: async (id) => {
    await db.positions.delete(id);
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id) }));
  },

  getByCategory: (cat) => get().positions.filter((p) => p.category === cat),

  getById: (id) => get().positions.find((p) => p.id === id),
}));
