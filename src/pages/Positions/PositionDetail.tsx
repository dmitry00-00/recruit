import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePositionStore, useVacancyStore } from '@/stores';
import { Tabs, GradeBadge, Button } from '@/components/ui';
import { RoadMap } from '@/components/RoadMap';
import { SalaryChart } from '@/components/SalaryChart';
import { TreePicker } from '@/components/TreePicker';
import {
  computeRoadmap,
  getToolSubcategoryMap,
  flattenRequiredSubIds,
  groupSubIdsByCategory,
  getSubcategoryById,
  getCategoryById,
} from '@/utils';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import styles from '../Vacancies/VacancyForm.module.css';

export function PositionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { positions, load, update } = usePositionStore();
  const { vacancies, load: loadVacancies } = useVacancyStore();

  useEffect(() => { load(); loadVacancies(); }, [load, loadVacancies]);

  const position = positions.find((p) => p.id === id);
  const positionVacancies = useMemo(
    () => vacancies.filter((v) => v.positionId === id),
    [vacancies, id],
  );

  const initialSubIds = useMemo(
    () => flattenRequiredSubIds(position?.requiredCategories),
    [position],
  );

  const [editing, setEditing] = useState(false);
  const [draftSubIds, setDraftSubIds] = useState<string[]>(initialSubIds);

  useEffect(() => { setDraftSubIds(initialSubIds); }, [initialSubIds]);

  const roadmapData = useMemo(() => {
    if (!id || positionVacancies.length === 0) return null;
    return computeRoadmap(id, positionVacancies, getToolSubcategoryMap());
  }, [id, positionVacancies]);

  if (!position) return <div className={styles.page}>Должность не найдена</div>;

  const handleSaveRequirements = async () => {
    await update(position.id, {
      requiredCategories: groupSubIdsByCategory(draftSubIds),
    });
    setEditing(false);
  };

  const handleCancelRequirements = () => {
    setDraftSubIds(initialSubIds);
    setEditing(false);
  };

  const requirementsView = (
    <div className={styles.formSection}>
      {!editing && (
        <>
          {position.requiredCategories.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)' }}>
              Требования не заданы. Добавьте подкатегории, которыми должен оперировать этот шаблон должности.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {position.requiredCategories.map((rc) => {
                const cat = getCategoryById(rc.categoryId);
                return (
                  <div key={rc.categoryId} style={{
                    padding: 10,
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                      {cat?.name ?? rc.categoryId}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {rc.subcategoryIds.map((subId) => {
                        const sub = getSubcategoryById(subId);
                        return (
                          <span
                            key={subId}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              background: 'var(--amber-bg)',
                              color: 'var(--amber)',
                              borderRadius: 'var(--radius-pill)',
                            }}
                          >
                            {sub?.name ?? subId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Button size="sm" onClick={() => setEditing(true)}>Редактировать требования</Button>
          </div>
        </>
      )}

      {editing && (
        <>
          <label className={styles.label}>
            Категории требований должности
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              выбрано: {draftSubIds.length}
            </span>
          </label>
          <TreePicker
            mode="position"
            selected={draftSubIds}
            onChange={setDraftSubIds}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button size="sm" onClick={handleSaveRequirements}>Сохранить</Button>
            <Button size="sm" variant="secondary" onClick={handleCancelRequirements}>Отмена</Button>
          </div>
        </>
      )}
    </div>
  );

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
              <p><strong>Подкатегорий требований:</strong> {initialSubIds.length}</p>
            </div>
          ),
        },
        {
          id: 'requirements',
          label: 'Требования',
          content: requirementsView,
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
