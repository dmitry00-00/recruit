import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { usePositionStore } from '@/stores';
import { GradeBadge, Button, EmptyState } from '@/components/ui';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import styles from '../Vacancies/VacancyForm.module.css';

export function PositionList() {
  const navigate = useNavigate();
  const { positions, loading, load } = usePositionStore();

  useEffect(() => { load(); }, [load]);

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className={styles.title} style={{ margin: 0 }}>Должности</h1>
        <Button size="sm" onClick={() => navigate('/positions/new')}>
          <Plus size={14} /> Добавить
        </Button>
      </div>

      {loading && <p style={{ color: 'var(--text-tertiary)' }}>Загрузка...</p>}

      {!loading && positions.length === 0 && (
        <EmptyState
          title="Нет должностей"
          description="Должности будут загружены из seed-данных при первом запуске"
          action={<Button onClick={() => navigate('/positions/new')}>Создать должность</Button>}
        />
      )}

      {positions.map((p) => (
        <div
          key={p.id}
          onClick={() => navigate(`/positions/${p.id}`)}
          style={{
            padding: 12,
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {POSITION_CATEGORY_LABELS[p.category]} / {p.subcategory}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {p.grades.slice(0, 4).map((g) => <GradeBadge key={g} grade={g} size="sm" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
