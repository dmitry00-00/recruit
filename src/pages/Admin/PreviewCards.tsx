import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, X, Plus } from 'lucide-react';
import { getToolName } from '@/utils/toolTreeHelpers';
import { resolveToolIdFromAliases } from '@/utils';
import type {
  NormalizedVacancy,
  NormalizedCandidate,
  NormalizedWorkEntry,
  NormalizedRequirement,
  NormalizedTool,
} from '@/utils';
import styles from './PreviewCards.module.css';

// ── Vacancy card ─────────────────────────────────────────────────────────────

interface VacancyCardProps {
  vacancy: NormalizedVacancy;
  onChange: (next: NormalizedVacancy) => void;
  onRemove: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}

export function VacancyPreviewCard({ vacancy, onChange, onRemove, selected, onToggleSelect }: VacancyCardProps) {
  const [open, setOpen] = useState(true);

  const set = <K extends keyof NormalizedVacancy>(key: K, value: NormalizedVacancy[K]) =>
    onChange({ ...vacancy, [key]: value });

  return (
    <div className={`${styles.card} ${selected ? styles.cardSelected : ''}`}>
      <div className={styles.cardHeader}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={selected}
          onChange={onToggleSelect}
        />
        <button className={styles.toggle} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          className={styles.titleInput}
          value={vacancy.companyName ?? ''}
          onChange={(e) => set('companyName', e.target.value)}
          placeholder="Компания"
        />
        <span className={styles.metaInline}>·</span>
        <input
          className={styles.titleInput}
          value={vacancy.positionId ?? ''}
          onChange={(e) => set('positionId', e.target.value)}
          placeholder="positionId"
        />
        <button className={styles.iconBtn} onClick={onRemove} title="Убрать">
          <X size={14} />
        </button>
      </div>

      {vacancy._warnings.length > 0 && (
        <div className={styles.warnings}>
          <AlertTriangle size={12} />
          {vacancy._warnings.length} замечаний
          <details>
            <summary>детали</summary>
            <ul>{vacancy._warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
        </div>
      )}

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <Field label="Грейд">
              <select className={styles.input} value={vacancy.grade ?? ''} onChange={(e) => set('grade', (e.target.value || undefined) as NormalizedVacancy['grade'])}>
                <option value="">—</option>
                <option value="intern">intern</option><option value="junior">junior</option>
                <option value="middle">middle</option><option value="senior">senior</option>
                <option value="lead">lead</option><option value="principal">principal</option>
                <option value="staff">staff</option>
              </select>
            </Field>
            <Field label="Город">
              <input className={styles.input} value={vacancy.location ?? ''} onChange={(e) => set('location', e.target.value)} />
            </Field>
            <Field label="Формат">
              <select className={styles.input} value={vacancy.workFormat ?? ''} onChange={(e) => set('workFormat', (e.target.value || undefined) as NormalizedVacancy['workFormat'])}>
                <option value="">—</option><option value="office">офис</option>
                <option value="remote">удалённо</option><option value="hybrid">гибрид</option>
              </select>
            </Field>
            <Field label="Тип">
              <select className={styles.input} value={vacancy.employmentType ?? ''} onChange={(e) => set('employmentType', (e.target.value || undefined) as NormalizedVacancy['employmentType'])}>
                <option value="">—</option><option value="full">full</option>
                <option value="part">part</option><option value="contract">contract</option>
                <option value="freelance">freelance</option>
              </select>
            </Field>
          </div>

          <div className={styles.row}>
            <Field label="Зарплата от">
              <input className={styles.input} type="number" value={vacancy.salaryFrom ?? ''} onChange={(e) => set('salaryFrom', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="до">
              <input className={styles.input} type="number" value={vacancy.salaryTo ?? ''} onChange={(e) => set('salaryTo', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Валюта">
              <select className={styles.input} value={vacancy.currency ?? 'RUB'} onChange={(e) => set('currency', e.target.value as NormalizedVacancy['currency'])}>
                <option value="RUB">RUB</option><option value="USD">USD</option>
                <option value="EUR">EUR</option><option value="KZT">KZT</option>
              </select>
            </Field>
            <Field label="URL источника">
              <input className={styles.input} value={vacancy.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.target.value)} />
            </Field>
          </div>

          <Field label="Заметки">
            <textarea
              className={styles.textarea}
              value={vacancy.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
            />
          </Field>

          <RequirementsEditor
            label="MIN (обязательные)"
            list={vacancy.minRequirements}
            onChange={(next) => set('minRequirements', next)}
          />
          <RequirementsEditor
            label="MAX (желательные)"
            list={vacancy.maxRequirements}
            onChange={(next) => set('maxRequirements', next)}
          />
        </div>
      )}
    </div>
  );
}

// ── Candidate card ───────────────────────────────────────────────────────────

interface CandidateCardProps {
  candidate: NormalizedCandidate;
  onChange: (next: NormalizedCandidate) => void;
  onRemove: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}

export function CandidatePreviewCard({ candidate, onChange, onRemove, selected, onToggleSelect }: CandidateCardProps) {
  const [open, setOpen] = useState(true);

  const set = <K extends keyof NormalizedCandidate>(key: K, value: NormalizedCandidate[K]) =>
    onChange({ ...candidate, [key]: value });

  const updateEntry = (idx: number, next: NormalizedWorkEntry) => {
    set('workEntries', candidate.workEntries.map((e, i) => i === idx ? next : e));
  };

  const removeEntry = (idx: number) => {
    set('workEntries', candidate.workEntries.filter((_, i) => i !== idx));
  };

  const fullName = [candidate.lastName, candidate.firstName, candidate.middleName].filter(Boolean).join(' ');
  const allWarnings = [
    ...candidate._warnings,
    ...candidate.workEntries.flatMap((e) => e._warnings),
  ];

  return (
    <div className={`${styles.card} ${selected ? styles.cardSelected : ''}`}>
      <div className={styles.cardHeader}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={selected}
          onChange={onToggleSelect}
        />
        <button className={styles.toggle} onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className={styles.title}>{fullName || 'Без имени'}</span>
        <span className={styles.metaInline}>·</span>
        <span className={styles.metaInline}>{candidate.workEntries.length} мест</span>
        <button className={styles.iconBtn} onClick={onRemove} title="Убрать">
          <X size={14} />
        </button>
      </div>

      {allWarnings.length > 0 && (
        <div className={styles.warnings}>
          <AlertTriangle size={12} />
          {allWarnings.length} замечаний
          <details>
            <summary>детали</summary>
            <ul>{allWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </details>
        </div>
      )}

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <Field label="Фамилия"><input className={styles.input} value={candidate.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} /></Field>
            <Field label="Имя"><input className={styles.input} value={candidate.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} /></Field>
            <Field label="Отчество"><input className={styles.input} value={candidate.middleName ?? ''} onChange={(e) => set('middleName', e.target.value)} /></Field>
          </div>
          <div className={styles.row}>
            <Field label="Email"><input className={styles.input} value={candidate.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Телефон"><input className={styles.input} value={candidate.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Telegram"><input className={styles.input} value={candidate.telegramHandle ?? ''} onChange={(e) => set('telegramHandle', e.target.value)} /></Field>
          </div>
          <div className={styles.row}>
            <Field label="Город"><input className={styles.input} value={candidate.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="Должность">
              <input className={styles.input} value={candidate.positionId ?? ''} onChange={(e) => set('positionId', e.target.value)} placeholder="positionId" />
            </Field>
            <Field label="Ожидание">
              <input className={styles.input} type="number" value={candidate.salaryExpected ?? ''} onChange={(e) => set('salaryExpected', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Валюта">
              <select className={styles.input} value={candidate.currency ?? 'RUB'} onChange={(e) => set('currency', e.target.value as NormalizedCandidate['currency'])}>
                <option value="RUB">RUB</option><option value="USD">USD</option>
                <option value="EUR">EUR</option><option value="KZT">KZT</option>
              </select>
            </Field>
          </div>

          <div className={styles.entries}>
            <div className={styles.entriesHeader}>Опыт работы</div>
            {candidate.workEntries.map((entry, i) => (
              <WorkEntryEditor
                key={i}
                entry={entry}
                onChange={(next) => updateEntry(i, next)}
                onRemove={() => removeEntry(i)}
              />
            ))}
            {candidate.workEntries.length === 0 && (
              <div className={styles.empty}>Нет записей опыта</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function RequirementsEditor({ label, list, onChange }: {
  label: string;
  list: NormalizedRequirement[];
  onChange: (next: NormalizedRequirement[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const removeAt = (idx: number) => onChange(list.filter((_, i) => i !== idx));

  const updateYears = (idx: number, years: string) => {
    onChange(list.map((r, i) => i === idx ? { ...r, minYears: years ? Number(years) : undefined } : r));
  };

  const addOne = () => {
    if (!draft.trim()) return;
    const { toolId, confidence } = resolveToolIdFromAliases(draft.trim());
    onChange([...list, { toolId, confidence, rawName: draft.trim() }]);
    setDraft('');
  };

  return (
    <div className={styles.reqBlock}>
      <div className={styles.reqLabel}>{label}</div>
      <div className={styles.chips}>
        {list.map((r, i) => (
          <span key={i} className={`${styles.chip} ${styles[`chip_${r.confidence}`]}`}>
            <span className={styles.chipName} title={r.rawName}>
              {getToolName(r.toolId)}
            </span>
            <input
              className={styles.yearsInput}
              type="number"
              min="0"
              step="0.5"
              value={r.minYears ?? ''}
              onChange={(e) => updateYears(i, e.target.value)}
              placeholder="лет"
            />
            <button className={styles.chipClose} onClick={() => removeAt(i)} type="button"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOne()}
          placeholder="Добавить инструмент…"
        />
        <button className={styles.addBtn} onClick={addOne} type="button"><Plus size={12} /> +</button>
      </div>
    </div>
  );
}

function WorkEntryEditor({ entry, onChange, onRemove }: {
  entry: NormalizedWorkEntry;
  onChange: (next: NormalizedWorkEntry) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState('');

  const set = <K extends keyof NormalizedWorkEntry>(key: K, value: NormalizedWorkEntry[K]) =>
    onChange({ ...entry, [key]: value });

  const updateTool = (idx: number, next: NormalizedTool) => {
    set('tools', entry.tools.map((t, i) => i === idx ? next : t));
  };
  const removeTool = (idx: number) => set('tools', entry.tools.filter((_, i) => i !== idx));

  const addTool = () => {
    if (!draft.trim()) return;
    const { toolId, confidence } = resolveToolIdFromAliases(draft.trim());
    set('tools', [...entry.tools, { toolId, years: 0, confidence, rawName: draft.trim() }]);
    setDraft('');
  };

  return (
    <div className={styles.entry}>
      <div className={styles.entryRow}>
        <input className={styles.input} value={entry.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Компания" />
        <input className={styles.input} value={entry.positionId ?? ''} onChange={(e) => set('positionId', e.target.value)} placeholder="positionId" style={{ maxWidth: 140 }} />
        <select className={styles.input} value={entry.grade ?? ''} onChange={(e) => set('grade', (e.target.value || undefined) as NormalizedWorkEntry['grade'])} style={{ maxWidth: 110 }}>
          <option value="">—</option><option value="intern">intern</option>
          <option value="junior">junior</option><option value="middle">middle</option>
          <option value="senior">senior</option><option value="lead">lead</option>
          <option value="principal">principal</option><option value="staff">staff</option>
        </select>
        <input className={styles.input} type="date" value={entry.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} style={{ maxWidth: 140 }} />
        <input className={styles.input} type="date" value={entry.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} style={{ maxWidth: 140 }} disabled={entry.isCurrent} />
        <label className={styles.currentLabel}>
          <input type="checkbox" checked={entry.isCurrent} onChange={(e) => set('isCurrent', e.target.checked)} />
          сейчас
        </label>
        <button className={styles.iconBtn} onClick={onRemove} title="Убрать"><X size={14} /></button>
      </div>

      <div className={styles.chips}>
        {entry.tools.map((t, i) => (
          <span key={i} className={`${styles.chip} ${styles[`chip_${t.confidence}`]}`}>
            <span className={styles.chipName} title={t.rawName}>{getToolName(t.toolId)}</span>
            <input
              className={styles.yearsInput}
              type="number"
              min="0"
              step="0.5"
              value={t.years || ''}
              onChange={(e) => updateTool(i, { ...t, years: Number(e.target.value) || 0 })}
              placeholder="лет"
            />
            <button className={styles.chipClose} onClick={() => removeTool(i)} type="button"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTool()}
          placeholder="Добавить инструмент…"
        />
        <button className={styles.addBtn} onClick={addTool} type="button"><Plus size={12} /> +</button>
      </div>
    </div>
  );
}
