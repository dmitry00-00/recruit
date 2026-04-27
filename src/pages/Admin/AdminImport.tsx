import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clipboard, Sparkles, Save, Trash2, FileText, Briefcase, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useVacancyStore, useCandidateStore } from '@/stores';
import {
  extractVacancyFromText,
  extractCandidateFromText,
  normalizeVacancy,
  normalizeCandidate,
} from '@/utils';
import type { NormalizedVacancy, NormalizedCandidate } from '@/utils';
import type { Currency, Grade, WorkFormat, EmploymentType, VacancyStatus, WorkEntry } from '@/entities';
import { LLMSettingsPanel } from './LLMSettingsPanel';
import { VacancyPreviewCard, CandidatePreviewCard } from './PreviewCards';
import styles from './AdminImport.module.css';

type Mode = 'vacancy' | 'candidate';

export function AdminImport() {
  const navigate = useNavigate();
  const addVacancy = useVacancyStore((s) => s.add);
  const addCandidate = useCandidateStore((s) => s.add);

  const [mode, setMode] = useState<Mode>('vacancy');
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [pasteFlash, setPasteFlash] = useState(false);

  const [vacancies, setVacancies] = useState<NormalizedVacancy[]>([]);
  const [candidates, setCandidates] = useState<NormalizedCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const results = mode === 'vacancy' ? vacancies : candidates;
  const allSelected = results.length > 0 && selected.size === results.length;
  const totalWarnings = useMemo(() => {
    if (mode === 'vacancy') {
      return vacancies.reduce((sum, v) => sum + v._warnings.length, 0);
    }
    return candidates.reduce((sum, c) => sum + c._warnings.length + c.workEntries.reduce((s, e) => s + e._warnings.length, 0), 0);
  }, [mode, vacancies, candidates]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText((prev) => prev ? prev + '\n\n---\n\n' + clip : clip);
      setPasteFlash(true);
      setTimeout(() => setPasteFlash(false), 800);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch {
      alert('Не удалось прочитать буфер обмена. Вставьте текст вручную.');
    }
  };

  const handleClear = () => {
    setText('');
    setError('');
  };

  const handleExtract = async () => {
    setError('');
    setExtracting(true);
    setSelected(new Set());

    try {
      // Split on horizontal-rule separators if user pasted multiple records
      const chunks = text.split(/\n\s*-{3,}\s*\n/g).map((s) => s.trim()).filter((s) => s.length > 30);
      const inputs = chunks.length > 0 ? chunks : [text];

      if (mode === 'vacancy') {
        const items: NormalizedVacancy[] = [];
        for (const chunk of inputs) {
          const raw = await extractVacancyFromText(chunk);
          items.push(normalizeVacancy(raw));
        }
        setVacancies((prev) => [...prev, ...items]);
        setSelected(new Set(items.map((_, i) => vacancies.length + i)));
      } else {
        const items: NormalizedCandidate[] = [];
        for (const chunk of inputs) {
          const raw = await extractCandidateFromText(chunk);
          items.push(normalizeCandidate(raw));
        }
        setCandidates((prev) => [...prev, ...items]);
        setSelected(new Set(items.map((_, i) => candidates.length + i)));
      }

      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка извлечения');
    } finally {
      setExtracting(false);
    }
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(results.map((_, i) => i)));
  };

  const toggleOne = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const removeOne = (i: number) => {
    if (mode === 'vacancy') setVacancies((prev) => prev.filter((_, idx) => idx !== i));
    else setCandidates((prev) => prev.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx === i) continue;
        next.add(idx > i ? idx - 1 : idx);
      }
      return next;
    });
  };

  const updateVacancy = (i: number, next: NormalizedVacancy) =>
    setVacancies((prev) => prev.map((v, idx) => idx === i ? next : v));
  const updateCandidate = (i: number, next: NormalizedCandidate) =>
    setCandidates((prev) => prev.map((c, idx) => idx === i ? next : c));

  const handleSave = async () => {
    setError('');
    let saved = 0;

    try {
      if (mode === 'vacancy') {
        const toSave = vacancies.filter((_, i) => selected.has(i));
        for (const v of toSave) {
          await addVacancy({
            positionId: v.positionId || 'custom',
            companyName: v.companyName ?? 'Без названия',
            grade: (v.grade ?? 'middle') as Grade,
            salaryFrom: v.salaryFrom,
            salaryTo: v.salaryTo,
            currency: (v.currency ?? 'RUB') as Currency,
            publishedAt: v.publishedAt ? new Date(v.publishedAt) : new Date(),
            status: (v.status ?? 'open') as VacancyStatus,
            sourceUrl: v.sourceUrl,
            minRequirements: v.minRequirements.map((r) => ({ toolId: r.toolId, minYears: r.minYears })),
            maxRequirements: v.maxRequirements.map((r) => ({ toolId: r.toolId, minYears: r.minYears })),
            location: v.location,
            workFormat: (v.workFormat ?? 'remote') as WorkFormat,
            employmentType: (v.employmentType ?? 'full') as EmploymentType,
            notes: v.notes,
          });
          saved++;
        }
        setVacancies((prev) => prev.filter((_, i) => !selected.has(i)));
      } else {
        const toSave = candidates.filter((_, i) => selected.has(i));
        for (const c of toSave) {
          const workEntries: Omit<WorkEntry, 'id' | 'candidateId'>[] = c.workEntries.map((e) => ({
            companyName: e.companyName,
            positionId: e.positionId || 'custom',
            grade: (e.grade ?? 'middle') as Grade,
            startDate: e.startDate ? new Date(e.startDate) : new Date(),
            endDate: e.endDate ? new Date(e.endDate) : undefined,
            isCurrent: e.isCurrent,
            tools: e.tools.map((t) => ({ toolId: t.toolId, years: t.years })),
            salary: e.salary,
            currency: (e.currency ?? 'RUB') as Currency,
            responsibilities: e.responsibilities,
          }));

          await addCandidate(
            {
              firstName: c.firstName ?? '',
              lastName: c.lastName ?? '',
              middleName: c.middleName,
              email: c.email,
              phone: c.phone,
              telegramHandle: c.telegramHandle,
              linkedinUrl: c.linkedinUrl,
              city: c.city,
              country: c.country,
              positionId: c.positionId,
              workFormat: c.workFormat ?? 'any',
              relocate: c.relocate ?? false,
              salaryExpected: c.salaryExpected,
              currency: (c.currency ?? 'RUB') as Currency,
              notes: c.notes,
            },
            workEntries,
          );
          saved++;
        }
        setCandidates((prev) => prev.filter((_, i) => !selected.has(i)));
      }

      setSelected(new Set());
      setSavedCount(saved);
      setTimeout(() => setSavedCount(0), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Админка импорта</h1>
        <p className={styles.subtitle}>
          Вставьте текст вакансии или резюме — LLM извлечёт структурированные данные. Отредактируйте перед сохранением.
        </p>
      </div>

      <LLMSettingsPanel />

      <div className={styles.modeTabs}>
        <button
          className={`${styles.modeTab} ${mode === 'vacancy' ? styles.modeTabActive : ''}`}
          onClick={() => { setMode('vacancy'); setSelected(new Set()); }}
        >
          <Briefcase size={14} /> Вакансии
          {vacancies.length > 0 && <span className={styles.badge}>{vacancies.length}</span>}
        </button>
        <button
          className={`${styles.modeTab} ${mode === 'candidate' ? styles.modeTabActive : ''}`}
          onClick={() => { setMode('candidate'); setSelected(new Set()); }}
        >
          <Users size={14} /> Кандидаты
          {candidates.length > 0 && <span className={styles.badge}>{candidates.length}</span>}
        </button>
      </div>

      {/* Input area */}
      <div className={styles.inputBlock}>
        <div className={styles.inputHeader}>
          <span className={styles.inputLabel}>
            <FileText size={14} />
            Вставьте текст {mode === 'vacancy' ? 'вакансии' : 'резюме'} (несколько — разделите строкой <code>---</code>)
          </span>
          <div className={styles.inputActions}>
            <button className={`${styles.toolBtn} ${pasteFlash ? styles.flash : ''}`} onClick={handlePaste} type="button">
              <Clipboard size={14} /> Вставить
            </button>
            <button className={styles.toolBtn} onClick={handleClear} type="button" disabled={!text}>
              <Trash2 size={14} /> Очистить
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === 'vacancy'
            ? 'Senior Python Developer\nКомпания: Тинькофф\nЗарплата: 400 000 – 600 000 ₽\nГибрид, Москва\n\nТребования:\n— Python 4+ лет\n— FastAPI / Django\n— PostgreSQL, Redis\n— Docker, Kubernetes'
            : 'Иванов Иван Иванович\nivan@example.com\n+7 916 ...\nМосква, удалёнка\n\nОпыт:\n2021–н.в. Яндекс, Senior Python Developer\nPython, FastAPI, PostgreSQL, Redis, Kafka, Docker'
          }
        />
        <div className={styles.extractRow}>
          <span className={styles.charCount}>{text.length} символов</span>
          <Button
            onClick={handleExtract}
            disabled={!text.trim() || text.length < 30 || extracting}
          >
            {extracting ? <><Loader2 size={14} className={styles.spin} /> Извлечение…</>
                       : <><Sparkles size={14} /> Распознать через LLM</>}
          </Button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {savedCount > 0 && (
        <div className={styles.success}>
          Сохранено: {savedCount} {mode === 'vacancy' ? 'вакансий' : 'кандидатов'}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsBar}>
            <button className={styles.toolBtn} onClick={toggleAll} type="button">
              {allSelected ? 'Снять выделение' : 'Выбрать все'}
            </button>
            <span className={styles.resultsMeta}>
              Выбрано: <strong>{selected.size}</strong> / {results.length}
              {totalWarnings > 0 && (
                <> · <span className={styles.warnText}>{totalWarnings} замечаний</span></>
              )}
            </span>
            <div className={styles.spacer} />
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
              На главную
            </Button>
            <Button onClick={handleSave} disabled={selected.size === 0}>
              <Save size={14} /> Сохранить ({selected.size})
            </Button>
          </div>

          <div className={styles.cards}>
            {mode === 'vacancy'
              ? vacancies.map((v, i) => (
                  <VacancyPreviewCard
                    key={i}
                    vacancy={v}
                    onChange={(next) => updateVacancy(i, next)}
                    onRemove={() => removeOne(i)}
                    selected={selected.has(i)}
                    onToggleSelect={() => toggleOne(i)}
                  />
                ))
              : candidates.map((c, i) => (
                  <CandidatePreviewCard
                    key={i}
                    candidate={c}
                    onChange={(next) => updateCandidate(i, next)}
                    onRemove={() => removeOne(i)}
                    selected={selected.has(i)}
                    onToggleSelect={() => toggleOne(i)}
                  />
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
