import { create } from 'zustand';
import type { Pipeline, PipelineStage, PipelineCard } from '@/entities';
import { db } from '@/db';
import { getOrCreatePipeline } from '@/db';

interface PipelineState {
  pipeline: Pipeline | null;
  stages: PipelineStage[];
  cards: PipelineCard[];
  loading: boolean;
  loadForVacancy: (vacancyId: string) => Promise<void>;
  addCard: (card: Omit<PipelineCard, 'id' | 'addedAt' | 'movedAt'>) => Promise<string>;
  moveCard: (cardId: string, newStageId: string) => Promise<void>;
  removeCard: (cardId: string) => Promise<void>;
  updateCardNotes: (cardId: string, notes: string) => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  pipeline: null,
  stages: [],
  cards: [],
  loading: false,

  loadForVacancy: async (vacancyId) => {
    set({ loading: true });
    const pipeline = await getOrCreatePipeline(vacancyId);
    const stages = await db.pipelineStages
      .where('pipelineId')
      .equals(pipeline.id)
      .sortBy('order');
    const cards = await db.pipelineCards
      .where('pipelineId')
      .equals(pipeline.id)
      .toArray();
    set({ pipeline, stages, cards, loading: false });
  },

  addCard: async (data) => {
    const now = new Date();
    const id = crypto.randomUUID();
    const card: PipelineCard = {
      ...data,
      id,
      addedAt: now,
      movedAt: now,
    };
    await db.pipelineCards.add(card);
    set((s) => ({ cards: [...s.cards, card] }));
    return id;
  },

  moveCard: async (cardId, newStageId) => {
    const movedAt = new Date();
    await db.pipelineCards.update(cardId, { stageId: newStageId, movedAt });
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === cardId ? { ...c, stageId: newStageId, movedAt } : c
      ),
    }));
  },

  removeCard: async (cardId) => {
    await db.pipelineCards.delete(cardId);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) }));
  },

  updateCardNotes: async (cardId, notes) => {
    await db.pipelineCards.update(cardId, { notes });
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === cardId ? { ...c, notes } : c
      ),
    }));
  },
}));
