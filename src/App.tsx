import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { Dashboard } from '@/pages/Dashboard';
import { PositionList, PositionForm, PositionDetail } from '@/pages/Positions';
import { VacancyForm, VacancyDetail } from '@/pages/Vacancies';
import { CandidateForm, CandidateDetail } from '@/pages/Candidates';
import { ComparePage } from '@/pages/Compare';
import { PipelinePage } from '@/pages/Pipeline';
import { seedIfEmpty } from '@/db';
import { usePositionStore } from '@/stores';

export function App() {
  useEffect(() => {
    // Apply saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Seed DB and load positions
    seedIfEmpty().then(() => {
      usePositionStore.getState().load();
    });
  }, []);

  return (
    <BrowserRouter>
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/positions" element={<PositionList />} />
          <Route path="/positions/new" element={<PositionForm />} />
          <Route path="/positions/:id" element={<PositionDetail />} />
          <Route path="/vacancies/new" element={<VacancyForm />} />
          <Route path="/vacancies/:id" element={<VacancyDetail />} />
          <Route path="/candidates/new" element={<CandidateForm />} />
          <Route path="/candidates/:id" element={<CandidateDetail />} />
          <Route path="/compare/:vacancyId/:candidateId" element={<ComparePage />} />
          <Route path="/pipeline/:vacancyId" element={<PipelinePage />} />
          <Route path="/roadmap/:positionId" element={<PositionDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
