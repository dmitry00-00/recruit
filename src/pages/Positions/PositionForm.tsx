import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePositionStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { Button } from '@/components/ui';
import { POSITION_CATEGORY_LABELS, GRADE_ORDER } from '@/entities';
import type { PositionCategory } from '@/entities';
import { groupSubIdsByCategory } from '@/utils';
import styles from '../Vacancies/VacancyForm.module.css';

const TOTAL_STEPS = 3;

export function PositionForm() {
  const navigate = useNavigate();
  const addPosition = usePositionStore((s) => s.add);
  const [step, setStep] = useState(1);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PositionCategory>('developer');
  const [description, setDescription] = useState('');
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  const handleSubmit = async () => {
    const id = await addPosition({
      name,
      category,
      subcategory: name,
      grades: [...GRADE_ORDER],
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
          <div className={styles.field}>
            <label className={styles.label}>Категория</label>
            <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value as PositionCategory)}>
              {Object.entries(POSITION_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
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
          <p><strong>Категория:</strong> {POSITION_CATEGORY_LABELS[category]}</p>
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
