import { create } from 'zustand';
import type { Vacancy } from '@/entities';
import { db } from '@/db';

interface VacancyState {
  vacancies: Vacancy[];
  loading: boolean;
  load: () => Promise<void>;
  add: (vacancy: Omit<Vacancy, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  update: (id: string, data: Partial<Vacancy>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getById: (id: string) => Vacancy | undefined;
  getByPosition: (positionId: string) => Vacancy[];
}

export const useVacancyStore = create<VacancyState>((set, get) => ({
  vacancies: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const vacancies = await db.vacancies.toArray();
    set({ vacancies, loading: false });
  },

  add: async (data) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const vacancy: Vacancy = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await db.vacancies.add(vacancy);
    set((s) => ({ vacancies: [...s.vacancies, vacancy] }));
    return id;
  },

  update: async (id, data) => {
    const updatedAt = new Date();
    await db.vacancies.update(id, { ...data, updatedAt });
    set((s) => ({
      vacancies: s.vacancies.map((v) =>
        v.id === id ? { ...v, ...data, updatedAt } : v
      ),
    }));
  },

  remove: async (id) => {
    await db.vacancies.delete(id);
    set((s) => ({ vacancies: s.vacancies.filter((v) => v.id !== id) }));
  },

  getById: (id) => get().vacancies.find((v) => v.id === id),

  getByPosition: (positionId) =>
    get().vacancies.filter((v) => v.positionId === positionId),
}));
