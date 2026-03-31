import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePositionStore, useVacancyStore } from '@/stores';
import { Tabs, GradeBadge, Button } from '@/components/ui';
import { RoadMap } from '@/components/RoadMap';
import { SalaryChart } from '@/components/SalaryChart';
import { computeRoadmap, getToolSubcategoryMap } from '@/utils';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import styles from '../Vacancies/VacancyForm.module.css';

export function PositionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { positions, load } = usePositionStore();
  const { vacancies, load: loadVacancies } = useVacancyStore();

  useEffect(() => { load(); loadVacancies(); }, [load, loadVacancies]);

  const position = positions.find((p) => p.id === id);
  const positionVacancies = useMemo(
    () => vacancies.filter((v) => v.positionId === id),
    [vacancies, id],
  );

  const roadmapData = useMemo(() => {
    if (!id || positionVacancies.length === 0) return null;
    return computeRoadmap(id, positionVacancies, getToolSubcategoryMap());
  }, [id, positionVacancies]);

  if (!position) return <div className={styles.page}>Должность не найдена</div>;

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 className={styles.title} style={{ margin: 0 }}>{position.name}</h1>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {POSITION_CATEGORY_LABELS[position.category]}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {position.grades.map((g) => <GradeBadge key={g} grade={g} size="sm" />)}
      </div>

      <Tabs tabs={[
        {
          id: 'profile',
          label: 'Профиль',
          content: (
            <div className={styles.formSection}>
              {position.description && <p>{position.description}</p>}
              <p><strong>Вакансий:</strong> {positionVacancies.length}</p>
            </div>
          ),
        },
        {
          id: 'roadmap',
          label: 'RoadMap',
          content: roadmapData
            ? <RoadMap data={roadmapData} />
            : <p style={{ color: 'var(--text-tertiary)', padding: 16 }}>Нет данных. Добавьте вакансии для этой должности.</p>,
        },
        {
          id: 'salary',
          label: 'Зарплата',
          content: <SalaryChart vacancies={positionVacancies} />,
        },
      ]} />

      <div style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    </div>
  );
}
