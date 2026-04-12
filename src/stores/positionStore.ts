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
    // Cascade: delete all vacancies for this position (with their cascades)
    const vacancies = await db.vacancies.where('positionId').equals(id).toArray();
    for (const v of vacancies) {
      const pipeline = await db.pipelines.where('vacancyId').equals(v.id).first();
      if (pipeline) {
        await db.pipelineCards.where('pipelineId').equals(pipeline.id).delete();
        await db.pipelineStages.where('pipelineId').equals(pipeline.id).delete();
        await db.pipelines.delete(pipeline.id);
      }
      await db.responseEvents.where('vacancyId').equals(v.id).delete();
      await db.recruitmentTasks.where('vacancyId').equals(v.id).delete();
    }
    await db.vacancies.where('positionId').equals(id).delete();
    // Cascade: delete workEntries referencing this position
    await db.workEntries.where('positionId').equals(id).delete();
    await db.positions.delete(id);
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id) }));
  },

  getByCategory: (cat) => get().positions.filter((p) => p.category === cat),

  getById: (id) => get().positions.find((p) => p.id === id),
}));
