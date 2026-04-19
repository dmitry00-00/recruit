import { create } from 'zustand';

type ModalType = 'vacancy' | 'candidate' | 'position' | null;

interface UiState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  activeModal: ModalType;
  modalEntityId: string | null;
  openModal: (type: ModalType, entityId: string) => void;
  closeModal: () => void;

  contextVacancyId: string | null;
  contextCandidateId: string | null;
  setContextVacancy: (id: string | null) => void;
  setContextCandidate: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark')
    ? 'dark'
    : 'light',

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      return { theme: next };
    }),

  activeModal: null,
  modalEntityId: null,
  openModal: (type, entityId) => set({ activeModal: type, modalEntityId: entityId }),
  closeModal: () => set({ activeModal: null, modalEntityId: null }),

  contextVacancyId: null,
  contextCandidateId: null,
  setContextVacancy: (id) => set({ contextVacancyId: id }),
  setContextCandidate: (id) => set({ contextCandidateId: id }),
}));
