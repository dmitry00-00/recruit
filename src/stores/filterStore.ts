import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FilterState,
  PositionCategory,
  ViewMode,
  AppSection,
  RecordType,
  RequirementLevel,
  Grade,
  WorkFormat,
} from '@/entities';

interface FilterActions {
  setPositionCategory: (v: PositionCategory | null) => void;
  setPositionSubcategory: (v: string | null) => void;
  setLanguage1: (v: string | null) => void;
  setFramework1: (v: string | null) => void;
  setLanguage2: (v: string | null) => void;
  setFramework2: (v: string | null) => void;
  setViewMode: (v: ViewMode) => void;
  setSection: (v: AppSection) => void;
  setRecordType: (v: RecordType) => void;
  setRequirementLevel: (v: RequirementLevel) => void;
  toggleShowDiff: () => void;
  setGradeFilter: (grades: Grade[]) => void;
  setSalaryRange: (min?: number, max?: number) => void;
  setWorkFormatFilter: (formats: WorkFormat[]) => void;
  resetFilters: () => void;
}

const initialState: FilterState = {
  positionCategory: null,
  positionSubcategory: null,
  language1: null,
  framework1: null,
  language2: null,
  framework2: null,
  viewMode: 'gallery',
  section: 'list',
  recordType: 'vacancies',
  requirementLevel: 'min',
  showDiff: false,
  gradeFilter: [],
  salaryMin: undefined,
  salaryMax: undefined,
  workFormatFilter: [],
};

export const useFilterStore = create<FilterState & FilterActions>()(
  persist(
    (set) => ({
      ...initialState,
      setPositionCategory:    (v) => set({ positionCategory: v, positionSubcategory: null }),
      setPositionSubcategory: (v) => set({ positionSubcategory: v }),
      setLanguage1:           (v) => set({ language1: v, framework1: null }),
      setFramework1:          (v) => set({ framework1: v }),
      setLanguage2:           (v) => set({ language2: v, framework2: null }),
      setFramework2:          (v) => set({ framework2: v }),
      setViewMode:            (v) => set({ viewMode: v }),
      setSection:             (v) => set({ section: v }),
      setRecordType:          (v) => set({ recordType: v }),
      setRequirementLevel:    (v) => set({ requirementLevel: v }),
      toggleShowDiff:         ()  => set((s) => ({ showDiff: !s.showDiff })),
      setGradeFilter:         (grades) => set({ gradeFilter: grades }),
      setSalaryRange:         (min, max) => set({ salaryMin: min, salaryMax: max }),
      setWorkFormatFilter:    (formats) => set({ workFormatFilter: formats }),
      resetFilters:           ()  => set(initialState),
    }),
    { name: 'recruiting-filters' }
  )
);
