import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useVacancyStore } from '@/stores';
import { TreePicker, type VacancyToolState } from '@/components/TreePicker';
import { GradeBadge, Modal, Button } from '@/components/ui';
import {
  VACANCY_STATUS_LABELS,
  WORK_FORMAT_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  CURRENCY_SYMBOLS,
} from '@/config';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import type {
  Grade,
  Currency,
  WorkFormat,
  EmploymentType,
  VacancyStatus,
  VacancyRequirement,
} from '@/entities';
import styles from './VacancyDetail.module.css';

export function VacancyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vacancies, load, update } = useVacancyStore();

  useEffect(() => { load(); }, [load]);

  const vacancy = vacancies.find((v) => v.id === id);

  // ── Local requirements state ─────────────────────────────
  const [minIds, setMinIds]         = useState<string[]>([]);
  const [maxIds, setMaxIds]         = useState<string[]>([]);
  const [minYearsMap, setMinYearsMap] = useState<Record<string, number>>({});
  const [maxYearsMap, setMaxYearsMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!vacancy) return;
    setMinIds(vacancy.minRequirements.map((r) => r.toolId));
    setMaxIds(vacancy.maxRequirements.map((r) => r.toolId));
    const minY: Record<string, number> = {};
    for (const r of vacancy.minRequirements) if (r.minYears) minY[r.toolId] = r.minYears;
    setMinYearsMap(minY);
    const maxY: Record<string, number> = {};
    for (const r of vacancy.maxRequirements) if (r.minYears) maxY[r.toolId] = r.minYears;
    setMaxYearsMap(maxY);
  }, [vacancy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Info modal state ─────────────────────────────────────
  const [infoOpen, setInfoOpen] = useState(false);
  const [companyName,     setCompanyName]     = useState('');
  const [companyLogoUrl,  setCompanyLogoUrl]  = useState('');
  const [grade,           setGrade]           = useState<Grade>('middle');
  const [salaryFrom,      setSalaryFrom]      = useState('');
  const [salaryTo,        setSalaryTo]        = useState('');
  const [currency,        setCurrency]        = useState<Currency>('RUB');
  const [workFormat,      setWorkFormat]      = useState<WorkFormat>('remote');
  const [employmentType,  setEmploymentType]  = useState<EmploymentType>('full');
  const [vacancyStatus,   setVacancyStatus]   = useState<VacancyStatus>('open');
  const [location,        setLocation]        = useState('');
  const [sourceUrl,       setSourceUrl]       = useState('');
  const [notes,           setNotes]           = useState('');

  const openInfoModal = () => {
    if (!vacancy) return;
    setCompanyName(vacancy.companyName);
    setCompanyLogoUrl(vacancy.companyLogoUrl ?? '');
    setGrade(vacancy.grade);
    setSalaryFrom(vacancy.salaryFrom ? String(vacancy.salaryFrom) : '');
    setSalaryTo(vacancy.salaryTo ? String(vacancy.salaryTo) : '');
    setCurrency(vacancy.currency);
    setWorkFormat(vacancy.workFormat);
    setEmploymentType(vacancy.employmentType);
    setVacancyStatus(vacancy.status);
    setLocation(vacancy.location ?? '');
    setSourceUrl(vacancy.sourceUrl ?? '');
    setNotes(vacancy.notes ?? '');
    setInfoOpen(true);
  };

  const saveInfo = async () => {
    if (!vacancy) return;
    await update(vacancy.id, {
      companyName,
      companyLogoUrl: companyLogoUrl || undefined,
      grade,
      salaryFrom: salaryFrom ? parseInt(salaryFrom) : undefined,
      salaryTo: salaryTo ? parseInt(salaryTo) : undefined,
      currency,
      workFormat,
      employmentType,
      status: vacancyStatus,
      location: location || undefined,
      sourceUrl: sourceUrl || undefined,
      notes: notes || undefined,
    });
    setInfoOpen(false);
  };

  // ── TreePicker handlers (auto-save) ──────────────────────
  const saveRequirements = (
    nextMinIds: string[],
    nextMaxIds: string[],
    nextMinYears: Record<string, number>,
    nextMaxYears: Record<string, number>,
  ) => {
    if (!vacancy) return;
    const minReqs: VacancyRequirement[] = nextMinIds.map((toolId) => ({
      toolId,
      minYears: nextMinYears[toolId] || undefined,
    }));
    const maxReqs: VacancyRequirement[] = nextMaxIds.map((toolId) => ({
      toolId,
      minYears: nextMaxYears[toolId] || undefined,
      isLocked: nextMinIds.includes(toolId),
    }));
    update(vacancy.id, { minRequirements: minReqs, maxRequirements: maxReqs });
  };

  const handleVacancyClick = (toolId: string, state: VacancyToolState) => {
    let nextMin = [...minIds];
    let nextMax = [...maxIds];

    if (state === 'none') {
      // none → min
      nextMin = [...nextMin, toolId];
      if (!nextMax.includes(toolId)) nextMax = [...nextMax, toolId];
    } else if (state === 'min') {
      // min → max (remove from min only)
      nextMin = nextMin.filter((id) => id !== toolId);
    } else {
      // max → none
      nextMin = nextMin.filter((id) => id !== toolId);
      nextMax = nextMax.filter((id) => id !== toolId);
    }

    setMinIds(nextMin);
    setMaxIds(nextMax);
    saveRequirements(nextMin, nextMax, minYearsMap, maxYearsMap);
  };

  const handleVacancyYears = (toolId: string, level: 'min' | 'max', years: number) => {
    if (level === 'min') {
      const next = { ...minYearsMap, [toolId]: years };
      setMinYearsMap(next);
      saveRequirements(minIds, maxIds, next, maxYearsMap);
    } else {
      const next = { ...maxYearsMap, [toolId]: years };
      setMaxYearsMap(next);
      saveRequirements(minIds, maxIds, minYearsMap, next);
    }
  };

  if (!vacancy) return <div style={{ padding: 24 }}>Вакансия не найдена</div>;

  const symbol = CURRENCY_SYMBOLS[vacancy.currency] ?? '₽';
  const initials = vacancy.companyName.slice(0, 2).toUpperCase();

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Назад
        </button>

        <div className={styles.headerSep} />

        {/* Company button → opens info modal */}
        <button className={styles.companyBtn} onClick={openInfoModal} title="Редактировать информацию">
          {vacancy.companyLogoUrl ? (
            <img src={vacancy.companyLogoUrl} alt="" className={styles.companyLogo} />
          ) : (
            <span className={styles.companyLogoPlaceholder}>{initials}</span>
          )}
          {vacancy.companyName}
        </button>

        <GradeBadge grade={vacancy.grade} />

        <span className={styles.statusBadge}>
          {VACANCY_STATUS_LABELS[vacancy.status]}
        </span>

        {vacancy.sourceUrl && (
          <a
            href={vacancy.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.sourceLink}
            title="Источник"
          >
            <ExternalLink size={14} />
          </a>
        )}

        <div className={styles.headerSpacer} />

        <Button size="sm" variant="secondary" onClick={() => navigate(`/pipeline/${vacancy.id}`)}>
          Воронка
        </Button>
      </div>

      {/* ── TreePicker ──────────────────────────────────── */}
      <div className={styles.pickerContainer}>
        <TreePicker
          mode="vacancy"
          fullHeight
          minIds={minIds}
          maxIds={maxIds}
          minYearsMap={minYearsMap}
          maxYearsMap={maxYearsMap}
          onVacancyClick={handleVacancyClick}
          onVacancyYears={handleVacancyYears}
        />
      </div>

      {/* ── Vacancy Info Modal ──────────────────────────── */}
      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Информация о вакансии"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setInfoOpen(false)}>Отмена</Button>
            <Button onClick={saveInfo}>Сохранить</Button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Компания</label>
              <input className={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Логотип (URL)</label>
              <input className={styles.input} value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Грейд</label>
              <select className={styles.select} value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
                {GRADE_ORDER.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Статус</label>
              <select className={styles.select} value={vacancyStatus} onChange={(e) => setVacancyStatus(e.target.value as VacancyStatus)}>
                {(Object.entries(VACANCY_STATUS_LABELS) as [VacancyStatus, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Зарплата от ({symbol})</label>
              <input className={styles.input} type="number" value={salaryFrom} onChange={(e) => setSalaryFrom(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Зарплата до ({symbol})</label>
              <input className={styles.input} type="number" value={salaryTo} onChange={(e) => setSalaryTo(e.target.value)} />
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
              <label className={styles.label}>Формат</label>
              <select className={styles.select} value={workFormat} onChange={(e) => setWorkFormat(e.target.value as WorkFormat)}>
                {(Object.entries(WORK_FORMAT_LABELS) as [WorkFormat, string][])
                  .filter(([k]) => k !== 'any')
                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Занятость</label>
              <select className={styles.select} value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
                {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Город</label>
              <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Москва" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ссылка (источник)</label>
              <input className={styles.input} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://hh.ru/..." />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Заметки</label>
            <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
