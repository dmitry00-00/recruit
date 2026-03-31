import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVacancyStore, usePipelineStore } from '@/stores';
import { KanbanBoard } from '@/components/KanbanBoard';
import { GradeBadge, Button, Spinner } from '@/components/ui';
import styles from '../Vacancies/VacancyForm.module.css';

export function PipelinePage() {
  const { vacancyId } = useParams<{ vacancyId: string }>();
  const navigate = useNavigate();
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const { stages, cards, loading, loadForVacancy, moveCard } = usePipelineStore();

  useEffect(() => { loadVacancies(); }, [loadVacancies]);

  useEffect(() => {
    if (vacancyId) loadForVacancy(vacancyId);
  }, [vacancyId, loadForVacancy]);

  const vacancy = vacancies.find((v) => v.id === vacancyId);

  if (loading) return <Spinner center />;

  return (
    <div className={styles.page} style={{ maxWidth: 'unset' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Назад</Button>
        <h1 className={styles.title} style={{ margin: 0 }}>
          Воронка: {vacancy?.companyName ?? vacancyId}
        </h1>
        {vacancy && <GradeBadge grade={vacancy.grade} size="sm" />}
      </div>

      <KanbanBoard
        stages={stages}
        cards={cards}
        onMoveCard={moveCard}
      />
    </div>
  );
}
