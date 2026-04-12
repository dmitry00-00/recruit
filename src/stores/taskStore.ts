import { create } from 'zustand';
import type { RecruitmentTask, TaskStatus } from '@/entities';
import { db } from '@/db';

interface TaskState {
  tasks: RecruitmentTask[];
  loading: boolean;
  loadAll: () => Promise<void>;
  loadForVacancy: (vacancyId: string) => Promise<void>;
  loadForCandidate: (candidateId: string) => Promise<void>;
  addTask: (data: Omit<RecruitmentTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (id: string, updates: Partial<RecruitmentTask>) => Promise<void>;
  setStatus: (id: string, status: TaskStatus) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const tasks = await db.recruitmentTasks.orderBy('dueDate').toArray();
    set({ tasks, loading: false });
  },

  loadForVacancy: async (vacancyId) => {
    set({ loading: true });
    const tasks = await db.recruitmentTasks
      .where('vacancyId')
      .equals(vacancyId)
      .sortBy('dueDate');
    set({ tasks, loading: false });
  },

  loadForCandidate: async (candidateId) => {
    set({ loading: true });
    const tasks = await db.recruitmentTasks
      .where('candidateId')
      .equals(candidateId)
      .sortBy('dueDate');
    set({ tasks, loading: false });
  },

  addTask: async (data) => {
    const id = crypto.randomUUID();
    const now = new Date();
    const task: RecruitmentTask = { ...data, id, createdAt: now, updatedAt: now };
    await db.recruitmentTasks.add(task);
    set((s) => ({ tasks: [...s.tasks, task] }));
    return id;
  },

  updateTask: async (id, updates) => {
    const updatedAt = new Date();
    await db.recruitmentTasks.update(id, { ...updates, updatedAt });
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates, updatedAt } : t)),
    }));
  },

  setStatus: async (id, status) => {
    const updatedAt = new Date();
    await db.recruitmentTasks.update(id, { status, updatedAt });
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt } : t)),
    }));
  },

  removeTask: async (id) => {
    await db.recruitmentTasks.delete(id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },
}));
