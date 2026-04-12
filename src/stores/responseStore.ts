import { create } from 'zustand';
import type { ResponseEvent, ResponseEventType } from '@/entities';
import { db } from '@/db';

interface ResponseState {
  events: ResponseEvent[];
  loading: boolean;
  loadForPair: (vacancyId: string, candidateId: string) => Promise<void>;
  loadForVacancy: (vacancyId: string) => Promise<void>;
  loadForCandidate: (candidateId: string) => Promise<void>;
  addEvent: (data: Omit<ResponseEvent, 'id' | 'createdAt'>) => Promise<string>;
  removeEvent: (id: string) => Promise<void>;
}

export const useResponseStore = create<ResponseState>((set) => ({
  events: [],
  loading: false,

  loadForPair: async (vacancyId, candidateId) => {
    set({ loading: true });
    const events = await db.responseEvents
      .where('[vacancyId+candidateId]')
      .equals([vacancyId, candidateId])
      .sortBy('createdAt');
    set({ events, loading: false });
  },

  loadForVacancy: async (vacancyId) => {
    set({ loading: true });
    const events = await db.responseEvents
      .where('vacancyId')
      .equals(vacancyId)
      .sortBy('createdAt');
    set({ events, loading: false });
  },

  loadForCandidate: async (candidateId) => {
    set({ loading: true });
    const events = await db.responseEvents
      .where('candidateId')
      .equals(candidateId)
      .sortBy('createdAt');
    set({ events, loading: false });
  },

  addEvent: async (data) => {
    const id = crypto.randomUUID();
    const event: ResponseEvent = { ...data, id, createdAt: new Date() };
    await db.responseEvents.add(event);
    set((s) => ({ events: [...s.events, event] }));
    return id;
  },

  removeEvent: async (id) => {
    await db.responseEvents.delete(id);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  },
}));
