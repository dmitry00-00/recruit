import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { usePositionStore, useCandidateStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { Button } from '@/components/ui';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import type { Grade, Currency, WorkFormat, WorkEntry } from '@/entities';
import styles from '../Vacancies/VacancyForm.module.css';

interface WorkEntryDraft {
  companyName: string;
  positionId: string;
  grade: Grade;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  salary: string;
  currency: Currency;
  tools: string[];
  yearsMap: Record<string, number>;
}

const emptyEntry = (): WorkEntryDraft => ({
  companyName: '',
  positionId: '',
  grade: 'middle',
  startDate: '',
  endDate: '',
  isCurrent: false,
  salary: '',
  currency: 'RUB',
  tools: [],
  yearsMap: {},
});

const TOTAL_STEPS = 3;

export function CandidateForm() {
  const navigate = useNavigate();
  const { positions, load: loadPositions } = usePositionStore();
  const addCandidate = useCandidateStore((s) => s.add);
  const [step, setStep] = useState(1);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  // Step 1: Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [city, setCity] = useState('');
  const [workFormat, setWorkFormat] = useState<WorkFormat | 'any'>('any');
  const [relocate, setRelocate] = useState(false);
  const [salaryExpected, setSalaryExpected] = useState('');
  const [currency, setCurrency] = useState<Currency>('RUB');

  // Step 2: Work history
  const [entries, setEntries] = useState<WorkEntryDraft[]>([emptyEntry()]);
  const [activeEntry, setActiveEntry] = useState(0);

  const updateEntry = (idx: number, data: Partial<WorkEntryDraft>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...data } : e)));
  };

  const handleSubmit = async () => {
    const workEntries: Omit<WorkEntry, 'id' | 'candidateId'>[] = entries
      .filter((e) => e.companyName)
      .map((e) => ({
        companyName: e.companyName,
        positionId: e.positionId || 'custom',
        grade: e.grade,
        startDate: new Date(e.startDate || Date.now()),
        endDate: e.endDate ? new Date(e.endDate) : undefined,
        isCurrent: e.isCurrent,
        tools: e.tools.map((toolId) => ({ toolId, years: e.yearsMap[toolId] || 0 })),
        salary: e.salary ? parseInt(e.salary) : undefined,
        currency: e.currency,
      }));

    const id = await addCandidate(
      {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        telegramHandle: telegramHandle || undefined,
        city: city || undefined,
        workFormat,
        relocate,
        salaryExpected: salaryExpected ? parseInt(salaryExpected) : undefined,
        currency,
      },
      workEntries,
    );
    navigate(`/candidates/${id}`);
  };

  const current = entries[activeEntry];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Новый кандидат</h1>

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
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Фамилия *</label>
              <input className={styles.input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Имя *</label>
              <input className={styles.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Телефон</label>
              <input className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Telegram</label>
              <input className={styles.input} value={telegramHandle} onChange={(e) => setTelegramHandle(e.target.value)} placeholder="@handle" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Город</label>
              <input className={styles.input} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Формат работы</label>
              <select className={styles.select} value={workFormat} onChange={(e) => setWorkFormat(e.target.value as WorkFormat | 'any')}>
                <option value="any">Любой</option>
                <option value="remote">Удалённо</option>
                <option value="office">Офис</option>
                <option value="hybrid">Гибрид</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Готовность к релокации</label>
              <select className={styles.select} value={relocate ? 'yes' : 'no'} onChange={(e) => setRelocate(e.target.value === 'yes')}>
                <option value="no">Нет</option>
                <option value="yes">Да</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Ожидаемый оклад</label>
              <input className={styles.input} type="number" value={salaryExpected} onChange={(e) => setSalaryExpected(e.target.value)} />
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
        </div>
      )}

      {step === 2 && current && (
        <div className={styles.formSection}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {entries.map((_, i) => (
              <Button
                key={i}
                variant={i === activeEntry ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveEntry(i)}
              >
                Место {i + 1}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => { setEntries([...entries, emptyEntry()]); setActiveEntry(entries.length); }}>
              <Plus size={14} /> Добавить
            </Button>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Компания *</label>
            <input className={styles.input} value={current.companyName} onChange={(e) => updateEntry(activeEntry, { companyName: e.target.value })} />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Должность</label>
              <select className={styles.select} value={current.positionId} onChange={(e) => updateEntry(activeEntry, { positionId: e.target.value })}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Грейд</label>
              <select className={styles.select} value={current.grade} onChange={(e) => updateEntry(activeEntry, { grade: e.target.value as Grade })}>
                {GRADE_ORDER.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Начало</label>
              <input className={styles.input} type="date" value={current.startDate} onChange={(e) => updateEntry(activeEntry, { startDate: e.target.value })} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Окончание</label>
              <input className={styles.input} type="date" value={current.endDate} onChange={(e) => updateEntry(activeEntry, { endDate: e.target.value })} disabled={current.isCurrent} />
            </div>
          </div>
          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={current.isCurrent} onChange={(e) => updateEntry(activeEntry, { isCurrent: e.target.checked, endDate: '' })} />
              По настоящее время
            </label>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Оклад</label>
            <input className={styles.input} type="number" value={current.salary} onChange={(e) => updateEntry(activeEntry, { salary: e.target.value })} />
          </div>

          <label className={styles.label}>Инструменты</label>
          <TreePicker
            selected={current.tools}
            onChange={(ids) => updateEntry(activeEntry, { tools: ids })}
            mode="candidate"
            withYears
            yearsMap={current.yearsMap}
            onYearsChange={(toolId, years) =>
              updateEntry(activeEntry, { yearsMap: { ...current.yearsMap, [toolId]: years } })
            }
          />

          {entries.length > 1 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setEntries(entries.filter((_, i) => i !== activeEntry));
                setActiveEntry(Math.max(0, activeEntry - 1));
              }}
            >
              <Trash2 size={14} /> Удалить место работы
            </Button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className={styles.formSection}>
          <h3>Подтверждение</h3>
          <p><strong>ФИО:</strong> {lastName} {firstName}</p>
          <p><strong>Город:</strong> {city || '—'}</p>
          <p><strong>Мест работы:</strong> {entries.filter((e) => e.companyName).length}</p>
          <p><strong>Ожидание:</strong> {salaryExpected || '—'} {currency}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          {step > 1 ? 'Назад' : 'Отмена'}
        </Button>
        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 1 && (!firstName || !lastName)}>
            Далее
          </Button>
        ) : (
          <Button onClick={handleSubmit}>Создать кандидата</Button>
        )}
      </div>
    </div>
  );
}
