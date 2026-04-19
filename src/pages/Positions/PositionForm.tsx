import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePositionStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { Button } from '@/components/ui';
import { GRADE_ORDER, GRADE_LABELS, POSITION_CATEGORY_LABELS } from '@/entities';
import type { Grade, PositionCategory } from '@/entities';
import { SUBCATEGORY_BY_CATEGORY } from '@/config';
import { groupSubIdsByCategory } from '@/utils';
import styles from '../Vacancies/VacancyForm.module.css';

const TOTAL_STEPS = 3;

export function PositionForm() {
  const navigate = useNavigate();
  const addPosition = usePositionStore((s) => s.add);
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PositionCategory>('developer');
  const [subcategory, setSubcategory] = useState('Frontend');
  const [description, setDescription] = useState('');
  const [grades, setGrades] = useState<Grade[]>(['junior', 'middle', 'senior']);
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  const toggleGrade = (g: Grade) => {
    setGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleSubmit = async () => {
    const id = await addPosition({
      name,
      category,
      subcategory,
      grades,
      description: description || undefined,
      requiredCategories: groupSubIdsByCategory(selectedSubIds),
    });
    navigate(`/positions/${id}`);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Новая должность</h1>

      <div className={styles.steps}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`${styles.step} ${i + 1 === step ? styles.stepActive : ''} ${i + 1 < step ? styles.stepDone : ''}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className={styles.formSection}>
          <div className={styles.field}>
            <label className={styles.label}>Название *</label>
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Frontend Developer" />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Категория</label>
              <select className={styles.select} value={category} onChange={(e) => { setCategory(e.target.value as PositionCategory); setSubcategory(SUBCATEGORY_BY_CATEGORY[e.target.value as PositionCategory]?.[0] ?? ''); }}>
                {Object.entries(POSITION_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Подкатегория</label>
              <select className={styles.select} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                {(SUBCATEGORY_BY_CATEGORY[category] ?? []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Грейды</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GRADE_ORDER.map((g) => (
                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={grades.includes(g)} onChange={() => toggleGrade(g)} />
                  {GRADE_LABELS[g]}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.formSection}>
          <label className={styles.label}>
            Категории требований должности
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              выбрано: {selectedSubIds.length}
            </span>
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px' }}>
            Отметьте подкатегории реестра, которые относятся к этой должности. При создании вакансии или места работы кандидата
            список инструментов будет ограничен этими подкатегориями.
          </p>
          <TreePicker
            mode="position"
            selected={selectedSubIds}
            onChange={setSelectedSubIds}
          />
        </div>
      )}

      {step === 3 && (
        <div className={styles.formSection}>
          <h3>Подтверждение</h3>
          <p><strong>Название:</strong> {name}</p>
          <p><strong>Категория:</strong> {POSITION_CATEGORY_LABELS[category]} / {subcategory}</p>
          <p><strong>Грейды:</strong> {grades.map((g) => GRADE_LABELS[g]).join(', ') || '—'}</p>
          <p><strong>Подкатегорий требований:</strong> {selectedSubIds.length}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          {step > 1 ? 'Назад' : 'Отмена'}
        </Button>
        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !name}>
            Далее
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!name}>Создать</Button>
        )}
      </div>
    </div>
  );
}
