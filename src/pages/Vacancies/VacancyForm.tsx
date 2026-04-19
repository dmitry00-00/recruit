import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePositionStore, useVacancyStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { Button } from '@/components/ui';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import type { Grade, Currency, WorkFormat, EmploymentType, VacancyRequirement, VacancyStatus } from '@/entities';
import { flattenRequiredSubIds } from '@/utils';
import styles from './VacancyForm.module.css';

const TOTAL_STEPS = 5;

export function VacancyForm() {
  const navigate = useNavigate();
  const { positions, load: loadPositions } = usePositionStore();
  const addVacancy = useVacancyStore((s) => s.add);
  const [step, setStep] = useState(1);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  // Step 1: Position
  const [positionId, setPositionId] = useState('');

  // Step 2: Company
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [grade, setGrade] = useState<Grade>('middle');
  const [salaryFrom, setSalaryFrom] = useState('');
  const [salaryTo, setSalaryTo] = useState('');
  const [currency, setCurrency] = useState<Currency>('RUB');
  const [workFormat, setWorkFormat] = useState<WorkFormat>('remote');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full');
  const [sourceUrl, setSourceUrl] = useState('');
  const [location, setLocation] = useState('');

  // Step 3: MIN requirements
  const [minTools, setMinTools] = useState<string[]>([]);
  const [minYearsMap, setMinYearsMap] = useState<Record<string, number>>({});

  // Step 4: MAX requirements
  const [maxTools, setMaxTools] = useState<string[]>([]);
  const [maxYearsMap, setMaxYearsMap] = useState<Record<string, number>>({});

  const handleMinYears = (toolId: string, years: number) => {
    setMinYearsMap((prev) => ({ ...prev, [toolId]: years }));
  };

  const handleMaxYears = (toolId: string, years: number) => {
    setMaxYearsMap((prev) => ({ ...prev, [toolId]: years }));
  };

  // Sync min to max
  const handleMinChange = (ids: string[]) => {
    setMinTools(ids);
    setMaxTools((prev) => [...new Set([...ids, ...prev])]);
  };

  const filteredSubIds = useMemo(() => {
    const position = positions.find((p) => p.id === positionId);
    return flattenRequiredSubIds(position?.requiredCategories);
  }, [positionId, positions]);

  const handleSubmit = async () => {
    const minReqs: VacancyRequirement[] = minTools.map((toolId) => ({
      toolId,
      minYears: minYearsMap[toolId] || undefined,
    }));
    const maxReqs: VacancyRequirement[] = maxTools.map((toolId) => ({
      toolId,
      minYears: maxYearsMap[toolId] || minYearsMap[toolId] || undefined,
      isLocked: minTools.includes(toolId),
    }));

    const id = await addVacancy({
      positionId: positionId || 'custom',
      companyName,
      companyLogoUrl: companyLogoUrl || undefined,
      grade,
      salaryFrom: salaryFrom ? parseInt(salaryFrom) : undefined,
      salaryTo: salaryTo ? parseInt(salaryTo) : undefined,
      currency,
      publishedAt: new Date(),
      status: 'open' as VacancyStatus,
      sourceUrl: sourceUrl || undefined,
      minRequirements: minReqs,
      maxRequirements: maxReqs,
      location: location || undefined,
      workFormat,
      employmentType,
    });
    navigate(`/vacancies/${id}`);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Новая вакансия</h1>

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
            <label className={styles.label}>Должность</label>
            <select className={styles.select} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="">Конструктор (свободный выбор)</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.formSection}>
          <div className={styles.field}>
            <label className={styles.label}>Компания *</label>
            <input className={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Название компании" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Логотип (URL)</label>
            <input className={styles.input} value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Грейд</label>
              <select className={styles.select} value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
                {GRADE_ORDER.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Валюта</label>
              <select className={styles.select} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="KZT">KZT</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Зарплата от</label>
              <input className={styles.input} type="number" value={salaryFrom} onChange={(e) => setSalaryFrom(e.target.value)} placeholder="100000" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Зарплата до</label>
              <input className={styles.input} type="number" value={salaryTo} onChange={(e) => setSalaryTo(e.target.value)} placeholder="200000" />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Формат</label>
              <select className={styles.select} value={workFormat} onChange={(e) => setWorkFormat(e.target.value as WorkFormat)}>
                <option value="remote">Удалённо</option>
                <option value="office">Офис</option>
                <option value="hybrid">Гибрид</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Тип занятости</label>
              <select className={styles.select} value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
                <option value="full">Полная</option>
                <option value="part">Частичная</option>
                <option value="contract">Контракт</option>
                <option value="freelance">Фриланс</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Город</label>
              <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Москва" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ссылка на источник</label>
              <input className={styles.input} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://hh.ru/..." />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.formSection}>
          <label className={styles.label}>Минимальные требования (обязательные)</label>
          {positionId && filteredSubIds.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              У выбранной должности не заданы категории требований — показываем всё дерево.
            </p>
          )}
          <TreePicker
            selected={minTools}
            onChange={handleMinChange}
            mode="vacancy-min"
            yearsMap={minYearsMap}
            onYearsChange={handleMinYears}
            filteredSubIds={filteredSubIds.length ? filteredSubIds : undefined}
          />
        </div>
      )}

      {step === 4 && (
        <div className={styles.formSection}>
          <label className={styles.label}>Максимальные требования (желательные)</label>
          <TreePicker
            selected={maxTools}
            locked={minTools}
            onChange={setMaxTools}
            mode="vacancy-max"
            yearsMap={maxYearsMap}
            onYearsChange={handleMaxYears}
            filteredSubIds={filteredSubIds.length ? filteredSubIds : undefined}
          />
        </div>
      )}

      {step === 5 && (
        <div className={styles.formSection}>
          <h3>Подтверждение</h3>
          <p><strong>Компания:</strong> {companyName}</p>
          <p><strong>Грейд:</strong> {GRADE_LABELS[grade]}</p>
          <p><strong>Зарплата:</strong> {salaryFrom || '—'} – {salaryTo || '—'} {currency}</p>
          <p><strong>MIN инструменты:</strong> {minTools.length}</p>
          <p><strong>MAX инструменты:</strong> {maxTools.length}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          {step > 1 ? 'Назад' : 'Отмена'}
        </Button>
        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 2 && !companyName}>
            Далее
          </Button>
        ) : (
          <Button onClick={handleSubmit}>Создать вакансию</Button>
        )}
      </div>
    </div>
  );
}
