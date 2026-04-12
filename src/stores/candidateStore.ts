import { create } from 'zustand';
import type { Candidate, WorkEntry } from '@/entities';
import { db } from '@/db';

interface CandidateState {
  candidates: Candidate[];
  loading: boolean;
  load: () => Promise<void>;
  add: (candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>, workEntries?: Omit<WorkEntry, 'id' | 'candidateId'>[]) => Promise<string>;
  update: (id: string, data: Partial<Candidate>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getById: (id: string) => Candidate | undefined;
  addWorkEntry: (entry: Omit<WorkEntry, 'id'>) => Promise<string>;
  updateWorkEntry: (id: string, data: Partial<WorkEntry>) => Promise<void>;
  removeWorkEntry: (id: string) => Promise<void>;
  getWorkEntries: (candidateId: string) => Promise<WorkEntry[]>;
}

export const useCandidateStore = create<CandidateState>((set, get) => ({
  candidates: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const candidates = await db.candidates.toArray();
    set({ candidates, loading: false });
  },

  add: async (data, workEntries) => {
    const now = new Date();
    const candidateId = crypto.randomUUID();
    const candidate: Candidate = {
      ...data,
      id: candidateId,
      createdAt: now,
      updatedAt: now,
    };
    await db.candidates.add(candidate);

    if (workEntries && workEntries.length > 0) {
      const entries: WorkEntry[] = workEntries.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        candidateId,
      }));
      await db.workEntries.bulkAdd(entries);
    }

    set((s) => ({ candidates: [...s.candidates, candidate] }));
    return candidateId;
  },

  update: async (id, data) => {
    const updatedAt = new Date();
    await db.candidates.update(id, { ...data, updatedAt });
    set((s) => ({
      candidates: s.candidates.map((c) =>
        c.id === id ? { ...c, ...data, updatedAt } : c
      ),
    }));
  },

  remove: async (id) => {
    await db.workEntries.where('candidateId').equals(id).delete();
    await db.pipelineCards.where('candidateId').equals(id).delete();
    await db.responseEvents.where('candidateId').equals(id).delete();
    await db.recruitmentTasks.where('candidateId').equals(id).delete();
    await db.candidates.delete(id);
    set((s) => ({ candidates: s.candidates.filter((c) => c.id !== id) }));
  },

  getById: (id) => get().candidates.find((c) => c.id === id),

  addWorkEntry: async (entry) => {
    const id = crypto.randomUUID();
    const workEntry: WorkEntry = { ...entry, id };
    await db.workEntries.add(workEntry);
    return id;
  },

  updateWorkEntry: async (id, data) => {
    await db.workEntries.update(id, data);
  },

  removeWorkEntry: async (id) => {
    await db.workEntries.delete(id);
  },

  getWorkEntries: async (candidateId) => {
    return db.workEntries
      .where('candidateId')
      .equals(candidateId)
      .sortBy('startDate');
  },
}));
