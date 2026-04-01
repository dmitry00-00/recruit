import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Dashboard } from '@/pages/Dashboard';
import { PositionList, PositionForm, PositionDetail } from '@/pages/Positions';
import { VacancyForm, VacancyDetail, VacancyImport } from '@/pages/Vacancies';
import { CandidateForm, CandidateDetail, CandidateImport } from '@/pages/Candidates';
import { ComparePage } from '@/pages/Compare';
import { PipelinePage } from '@/pages/Pipeline';
import { LoginPage, RegisterPage, ProfilePage } from '@/pages/Auth';
import { seedIfEmpty } from '@/db';
import { usePositionStore, useAuthStore } from '@/stores';

export function App() {
  const currentUser = useAuthStore((s) => s.currentUser);

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
      {currentUser && <TopNav />}
      <main>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/positions" element={<ProtectedRoute><PositionList /></ProtectedRoute>} />
          <Route path="/positions/new" element={<ProtectedRoute roles={['admin', 'recruiter']}><PositionForm /></ProtectedRoute>} />
          <Route path="/positions/:id" element={<ProtectedRoute><PositionDetail /></ProtectedRoute>} />
          <Route path="/vacancies/new" element={<ProtectedRoute roles={['admin', 'recruiter', 'hiring_manager']}><VacancyForm /></ProtectedRoute>} />
          <Route path="/vacancies/import" element={<ProtectedRoute roles={['admin', 'recruiter']}><VacancyImport /></ProtectedRoute>} />
          <Route path="/vacancies/:id" element={<ProtectedRoute><VacancyDetail /></ProtectedRoute>} />
          <Route path="/candidates/new" element={<ProtectedRoute roles={['admin', 'recruiter']}><CandidateForm /></ProtectedRoute>} />
          <Route path="/candidates/import" element={<ProtectedRoute roles={['admin', 'recruiter']}><CandidateImport /></ProtectedRoute>} />
          <Route path="/candidates/:id" element={<ProtectedRoute><CandidateDetail /></ProtectedRoute>} />
          <Route path="/compare/:vacancyId/:candidateId" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
          <Route path="/pipeline/:vacancyId" element={<ProtectedRoute><PipelinePage /></ProtectedRoute>} />
          <Route path="/roadmap/:positionId" element={<ProtectedRoute><PositionDetail /></ProtectedRoute>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
