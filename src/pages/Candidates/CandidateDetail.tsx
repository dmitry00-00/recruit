import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useCandidateStore, usePositionStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { GradeBadge, Modal, Button } from '@/components/ui';
import { aggregateCandidate } from '@/utils';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import type { WorkEntry, Grade, Currency, CandidateAggregation } from '@/entities';
import styles from './CandidateDetail.module.css';

function formatDateRange(entry: WorkEntry): string {
  const start = new Date(entry.startDate).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
  const end = entry.isCurrent ? 'н.в.' : entry.endDate
    ? new Date(entry.endDate).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
    : '—';
  return `${start} — ${end}`;
}

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { candidates, load, getWorkEntries, addWorkEntry, updateWorkEntry } = useCandidateStore();
  const { positions, load: loadPositions } = usePositionStore();

  useEffect(() => { load(); loadPositions(); }, [load, loadPositions]);

  const candidate = candidates.find((c) => c.id === id);

  const [workEntries, setWorkEntries]     = useState<WorkEntry[]>([]);
  const [aggregation, setAggregation]     = useState<CandidateAggregation | null>(null);
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null);

  const refreshEntries = useCallback(async () => {
    if (!candidate) return;
    const entries = await getWorkEntries(candidate.id);
    setWorkEntries(entries);
    setAggregation(aggregateCandidate(candidate, entries));
  }, [candidate, getWorkEntries]);

  useEffect(() => { refreshEntries(); }, [refreshEntries]);

  // ── Active entry (for TreePicker edit mode) ───────────────
  const activeEntry = selectedIdx !== null ? workEntries[selectedIdx] : null;

  // Build TreePicker props
  const candidateToolIds = activeEntry
    ? activeEntry.tools.map((t) => t.toolId)
    : [];

  const candidateYearsMap: Record<string, number> = activeEntry
    ? Object.fromEntries(activeEntry.tools.map((t) => [t.toolId, t.years]))
    : (aggregation
        ? Object.fromEntries(aggregation.toolsExperience.map((t) => [t.toolId, t.years]))
        : {});

  // ── Tool toggle (auto-save for active entry) ──────────────
  const handleToggle = async (toolId: string) => {
    if (!activeEntry) return;
    const exists = activeEntry.tools.some((t) => t.toolId === toolId);
    const newTools = exists
      ? activeEntry.tools.filter((t) => t.toolId !== toolId)
      : [...activeEntry.tools, { toolId, years: 0 }];
    await updateWorkEntry(activeEntry.id, { tools: newTools });
    await refreshEntries();
  };

  const handleYearsChange = async (toolId: string, years: number) => {
    if (!activeEntry) return;
    const newTools = activeEntry.tools.map((t) =>
      t.toolId === toolId ? { ...t, years } : t,
    );
    await updateWorkEntry(activeEntry.id, { tools: newTools });
    await refreshEntries();
  };

  // ── Add new work entry ────────────────────────────────────
  const handleAddEntry = async () => {
    if (!candidate) return;
    const newId = await addWorkEntry({
      candidateId: candidate.id,
      companyName: 'Новое место работы',
      positionId: 'custom',
      grade: 'middle',
      startDate: new Date(),
      isCurrent: true,
      tools: [],
      currency: 'RUB',
    });
    await refreshEntries();
    const updated = await getWorkEntries(candidate.id);
    const newIdx = updated.findIndex((e) => e.id === newId);
    if (newIdx >= 0) {
      setSelectedIdx(newIdx);
      openEntryModal(updated[newIdx]);
    }
  };

  // ── Work entry meta modal ─────────────────────────────────
  const [entryModalOpen,  setEntryModalOpen]  = useState(false);
  const [editingEntry,    setEditingEntry]    = useState<WorkEntry | null>(null);
  const [eCompanyName,    setECompanyName]    = useState('');
  const [eCompanyLogo,    setECompanyLogo]    = useState('');
  const [ePositionId,     setEPositionId]     = useState('');
  const [eGrade,          setEGrade]          = useState<Grade>('middle');
  const [eStartDate,      setEStartDate]      = useState('');
  const [eEndDate,        setEEndDate]        = useState('');
  const [eIsCurrent,      setEIsCurrent]      = useState(false);
  const [eSalary,         setESalary]         = useState('');
  const [eCurrency,       setECurrency]       = useState<Currency>('RUB');
  const [eResponsib,      setEResponsib]      = useState('');

  const openEntryModal = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setECompanyName(entry.companyName);
    setECompanyLogo(entry.companyLogoUrl ?? '');
    setEPositionId(entry.positionId);
    setEGrade(entry.grade);
    setEStartDate(entry.startDate ? new Date(entry.startDate).toISOString().slice(0, 10) : '');
    setEEndDate(entry.endDate ? new Date(entry.endDate).toISOString().slice(0, 10) : '');
    setEIsCurrent(entry.isCurrent);
    setESalary(entry.salary ? String(entry.salary) : '');
    setECurrency(entry.currency);
    setEResponsib(entry.responsibilities ?? '');
    setEntryModalOpen(true);
  };

  const saveEntryMeta = async () => {
    if (!editingEntry) return;
    await updateWorkEntry(editingEntry.id, {
      companyName: eCompanyName,
      companyLogoUrl: eCompanyLogo || undefined,
      positionId: ePositionId || 'custom',
      grade: eGrade,
      startDate: eStartDate ? new Date(eStartDate) : editingEntry.startDate,
      endDate: !eIsCurrent && eEndDate ? new Date(eEndDate) : undefined,
      isCurrent: eIsCurrent,
      salary: eSalary ? parseInt(eSalary) : undefined,
      currency: eCurrency,
      responsibilities: eResponsib || undefined,
    });
    await refreshEntries();
    setEntryModalOpen(false);
  };

  // ── Compute filtered sub IDs from active entry's position ─
  const filteredSubIds = useMemo(() => {
    const posId = activeEntry?.positionId ?? workEntries[0]?.positionId;
    if (!posId) return [];
    const pos = positions.find((p) => p.id === posId);
    if (!pos?.requiredCategories?.length) return [];
    return pos.requiredCategories.flatMap((rc) => rc.subcategoryIds);
  }, [activeEntry, workEntries, positions]);

  if (!candidate) return <div style={{ padding: 24 }}>Кандидат не найден</div>;

  // ── Work entries sidebar panel ────────────────────────────
  const workPanel = (
    <div className={styles.workPanel}>
      {/* Tab numbers + add button */}
      <div className={styles.entryTabs}>
        {workEntries.map((_, i) => (
          <button
            key={i}
            className={`${styles.entryTab} ${selectedIdx === i ? styles.entryTabActive : ''}`}
            onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            title={`Место работы ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
        <button
          className={`${styles.entryTab} ${styles.entryTabAdd}`}
          onClick={handleAddEntry}
          title="Добавить место работы"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Active entry card or first entry in summary mode */}
      {(activeEntry ?? workEntries[0]) && (
        <div className={styles.entryCard}>
          <button
            className={styles.entryCardBtn}
            onClick={() => openEntryModal(activeEntry ?? workEntries[0])}
            title="Редактировать информацию о месте работы"
          >
            {(activeEntry ?? workEntries[0]).companyLogoUrl ? (
              <img
                src={(activeEntry ?? workEntries[0]).companyLogoUrl}
                alt=""
                className={styles.entryLogoImg}
              />
            ) : (
              <span className={styles.entryLogoPlaceholder}>
                {(activeEntry ?? workEntries[0]).companyName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <div className={styles.entryCompanyName}>
                {(activeEntry ?? workEntries[0]).companyName}
              </div>
              <div className={styles.entryDateRange}>
                {formatDateRange(activeEntry ?? workEntries[0])}
              </div>
            </div>
          </button>

          {/* × deselect button — only visible when an entry is selected */}
          {selectedIdx !== null && (
            <button
              className={styles.entryDeselectBtn}
              onClick={() => setSelectedIdx(null)}
              title="Показать суммарный опыт"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ── Header ───────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Назад
        </button>

        <div className={styles.headerSep} />

        <span className={styles.candidateName}>
          {candidate.lastName} {candidate.firstName}
        </span>

        {aggregation?.topGrade && <GradeBadge grade={aggregation.topGrade} />}

        {aggregation && (
          <span className={styles.totalExp}>{aggregation.totalYears} лет</span>
        )}

        <div className={styles.headerSpacer} />

        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/candidates/${candidate.id}/edit`)}
        >
          Профиль
        </Button>
      </div>

      {/* ── TreePicker ────────────────────────────────────── */}
      <div className={styles.pickerContainer}>
        <TreePicker
          mode={activeEntry ? 'candidate' : 'candidate-agg'}
          fullHeight
          filteredSubIds={filteredSubIds}
          selected={candidateToolIds}
          yearsMap={candidateYearsMap}
          onChange={activeEntry
            ? (ids) => {
                const cur = new Set(candidateToolIds);
                const nxt = new Set(ids);
                for (const tid of nxt) { if (!cur.has(tid)) { handleToggle(tid); return; } }
                for (const tid of cur) { if (!nxt.has(tid)) { handleToggle(tid); return; } }
              }
            : undefined}
          onYearsChange={activeEntry ? handleYearsChange : undefined}
          sidebarFooter={workPanel}
        />
      </div>

      {/* ── Work Entry Meta Modal ────────────────────────── */}
      <Modal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        title="Место работы"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEntryModalOpen(false)}>Отмена</Button>
            <Button onClick={saveEntryMeta}>Сохранить</Button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Компания</label>
              <input className={styles.input} value={eCompanyName} onChange={(e) => setECompanyName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Логотип (URL)</label>
              <input className={styles.input} value={eCompanyLogo} onChange={(e) => setECompanyLogo(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Должность</label>
              <select className={styles.select} value={ePositionId} onChange={(e) => setEPositionId(e.target.value)}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Грейд</label>
              <select className={styles.select} value={eGrade} onChange={(e) => setEGrade(e.target.value as Grade)}>
                {GRADE_ORDER.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Начало</label>
              <input className={styles.input} type="date" value={eStartDate} onChange={(e) => setEStartDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Окончание</label>
              <input className={styles.input} type="date" value={eEndDate} onChange={(e) => setEEndDate(e.target.value)} disabled={eIsCurrent} />
            </div>
          </div>

          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={eIsCurrent}
                onChange={(e) => {
                  setEIsCurrent(e.target.checked);
                  if (e.target.checked) setEEndDate('');
                }}
              />
              По настоящее время
            </label>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Оклад</label>
              <input className={styles.input} type="number" value={eSalary} onChange={(e) => setESalary(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Валюта</label>
              <select className={styles.select} value={eCurrency} onChange={(e) => setECurrency(e.target.value as Currency)}>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="KZT">KZT</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Обязанности</label>
            <textarea className={styles.textarea} value={eResponsib} onChange={(e) => setEResponsib(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
