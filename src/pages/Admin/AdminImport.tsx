import { useState, useMemo, useRef, useCallback, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clipboard, Sparkles, Save, Trash2, FileText, Briefcase, Users,
  Loader2, Upload, X, CheckCircle2, AlertCircle, File,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useVacancyStore, useCandidateStore } from '@/stores';
import { readFileContent } from '@/services';
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
type InputTab = 'text' | 'files';
type FileStatus = 'queued' | 'reading' | 'extracting' | 'done' | 'error';

interface FileItem {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
}

const ALLOWED_EXTS = ['txt', 'md', 'html', 'htm', 'pdf', 'doc', 'docx', 'rtf', 'json', 'csv'];

function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isAllowed(f: File) {
  return ALLOWED_EXTS.includes(fileExt(f.name));
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AdminImport() {
  const navigate = useNavigate();
  const addVacancy = useVacancyStore((s) => s.add);
  const addCandidate = useCandidateStore((s) => s.add);

  const [mode, setMode] = useState<Mode>('vacancy');
  const [inputTab, setInputTab] = useState<InputTab>('text');

  // ── Text input state ────────────────────────────────────────────────────────
  const [text, setText] = useState('');
  const [pasteFlash, setPasteFlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── File input state ────────────────────────────────────────────────────────
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processingFiles, setProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Results state ───────────────────────────────────────────────────────────
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [vacancies, setVacancies] = useState<NormalizedVacancy[]>([]);
  const [candidates, setCandidates] = useState<NormalizedCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  const results = mode === 'vacancy' ? vacancies : candidates;
  const allSelected = results.length > 0 && selected.size === results.length;

  const totalWarnings = useMemo(() => {
    if (mode === 'vacancy') return vacancies.reduce((s, v) => s + v._warnings.length, 0);
    return candidates.reduce((s, c) => s + c._warnings.length + c.workEntries.reduce((ss, e) => ss + e._warnings.length, 0), 0);
  }, [mode, vacancies, candidates]);

  // ── Text actions ────────────────────────────────────────────────────────────

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText((prev) => prev ? `${prev}\n\n---\n\n${clip}` : clip);
      setPasteFlash(true);
      setTimeout(() => setPasteFlash(false), 800);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch {
      alert('Не удалось прочитать буфер обмена. Вставьте текст вручную.');
    }
  };

  // ── File actions ────────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(isAllowed);
    setFileItems((prev) => {
      const existingNames = new Set(prev.map((f) => f.file.name));
      const fresh = arr
        .filter((f) => !existingNames.has(f.name))
        .map((f) => ({ id: `${f.name}-${f.size}`, file: f, status: 'queued' as FileStatus }));
      return [...prev, ...fresh];
    });
  }, []);

  const removeFile = (id: string) =>
    setFileItems((prev) => prev.filter((f) => f.id !== id));

  const clearDoneFiles = () =>
    setFileItems((prev) => prev.filter((f) => f.status !== 'done'));

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const updateFileStatus = (id: string, patch: Partial<FileItem>) =>
    setFileItems((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));

  const handleProcessFiles = async () => {
    const queued = fileItems.filter((f) => f.status === 'queued');
    if (!queued.length) return;

    setProcessingFiles(true);
    setError('');

    const newVacancies: NormalizedVacancy[] = [];
    const newCandidates: NormalizedCandidate[] = [];

    for (const item of queued) {
      updateFileStatus(item.id, { status: 'reading' });
      let content: string;
      try {
        content = await readFileContent(item.file);
      } catch {
        updateFileStatus(item.id, { status: 'error', error: 'Не удалось прочитать файл' });
        continue;
      }

      updateFileStatus(item.id, { status: 'extracting' });
      try {
        if (mode === 'vacancy') {
          const raw = await extractVacancyFromText(content);
          newVacancies.push(normalizeVacancy(raw));
        } else {
          // For resumes, one file = one candidate
          const raw = await extractCandidateFromText(content);
          newCandidates.push(normalizeCandidate(raw));
        }
        updateFileStatus(item.id, { status: 'done' });
      } catch (e) {
        updateFileStatus(item.id, {
          status: 'error',
          error: e instanceof Error ? e.message : 'Ошибка LLM',
        });
      }
    }

    if (mode === 'vacancy') {
      setVacancies((prev) => {
        const next = [...prev, ...newVacancies];
        setSelected(new Set(newVacancies.map((_, i) => prev.length + i)));
        return next;
      });
    } else {
      setCandidates((prev) => {
        const next = [...prev, ...newCandidates];
        setSelected(new Set(newCandidates.map((_, i) => prev.length + i)));
        return next;
      });
    }

    setProcessingFiles(false);
  };

  // ── Text extract ────────────────────────────────────────────────────────────

  const handleExtract = async () => {
    setError('');
    setExtracting(true);
    setSelected(new Set());
    try {
      const chunks = text.split(/\n\s*-{3,}\s*\n/g).map((s) => s.trim()).filter((s) => s.length > 30);
      const inputs = chunks.length > 0 ? chunks : [text];

      if (mode === 'vacancy') {
        const items: NormalizedVacancy[] = [];
        for (const chunk of inputs) items.push(normalizeVacancy(await extractVacancyFromText(chunk)));
        setVacancies((prev) => { setSelected(new Set(items.map((_, i) => prev.length + i))); return [...prev, ...items]; });
      } else {
        const items: NormalizedCandidate[] = [];
        for (const chunk of inputs) items.push(normalizeCandidate(await extractCandidateFromText(chunk)));
        setCandidates((prev) => { setSelected(new Set(items.map((_, i) => prev.length + i))); return [...prev, ...items]; });
      }
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка извлечения');
    } finally {
      setExtracting(false);
    }
  };

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(results.map((_, i) => i)));
  const toggleOne = (i: number) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  });

  const removeOne = (i: number) => {
    if (mode === 'vacancy') setVacancies((prev) => prev.filter((_, idx) => idx !== i));
    else setCandidates((prev) => prev.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      const n = new Set<number>();
      for (const idx of prev) { if (idx !== i) n.add(idx > i ? idx - 1 : idx); }
      return n;
    });
  };

  const updateVacancy = (i: number, next: NormalizedVacancy) =>
    setVacancies((prev) => prev.map((v, idx) => idx === i ? next : v));
  const updateCandidate = (i: number, next: NormalizedCandidate) =>
    setCandidates((prev) => prev.map((c, idx) => idx === i ? next : c));

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setError('');
    let saved = 0;
    try {
      if (mode === 'vacancy') {
        for (const v of vacancies.filter((_, i) => selected.has(i))) {
          await addVacancy({
            positionId: v.positionId || 'custom',
            companyName: v.companyName ?? 'Без названия',
            grade: (v.grade ?? 'middle') as Grade,
            salaryFrom: v.salaryFrom, salaryTo: v.salaryTo,
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
        for (const c of candidates.filter((_, i) => selected.has(i))) {
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
          await addCandidate({
            firstName: c.firstName ?? '', lastName: c.lastName ?? '',
            middleName: c.middleName, email: c.email, phone: c.phone,
            telegramHandle: c.telegramHandle, linkedinUrl: c.linkedinUrl,
            city: c.city, country: c.country, positionId: c.positionId,
            workFormat: c.workFormat ?? 'any', relocate: c.relocate ?? false,
            salaryExpected: c.salaryExpected,
            currency: (c.currency ?? 'RUB') as Currency, notes: c.notes,
          }, workEntries);
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

  // ── File status helpers ─────────────────────────────────────────────────────

  const queuedCount = fileItems.filter((f) => f.status === 'queued').length;
  const busyCount = fileItems.filter((f) => f.status === 'reading' || f.status === 'extracting').length;
  const doneCount = fileItems.filter((f) => f.status === 'done').length;
  const errCount = fileItems.filter((f) => f.status === 'error').length;

  const FILE_STATUS_ICON: Record<FileStatus, React.ReactNode> = {
    queued:     <File size={13} className={styles.iconMuted} />,
    reading:    <Loader2 size={13} className={styles.spin} />,
    extracting: <Sparkles size={13} className={styles.iconAmber} />,
    done:       <CheckCircle2 size={13} className={styles.iconGreen} />,
    error:      <AlertCircle size={13} className={styles.iconRed} />,
  };

  const FILE_STATUS_LABEL: Record<FileStatus, string> = {
    queued: 'в очереди', reading: 'чтение…', extracting: 'LLM…', done: 'готово', error: 'ошибка',
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Импорт через LLM</h1>
        <p className={styles.subtitle}>
          Вставьте текст или загрузите файлы — LLM извлечёт данные, вы проверите и сохраните.
        </p>
      </div>

      <LLMSettingsPanel />

      {/* Mode tabs */}
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

      {/* Input block */}
      <div className={styles.inputBlock}>
        {/* Input sub-tabs */}
        <div className={styles.inputTabs}>
          <button
            className={`${styles.inputTab} ${inputTab === 'text' ? styles.inputTabActive : ''}`}
            onClick={() => setInputTab('text')}
            type="button"
          >
            <FileText size={13} /> Текст
          </button>
          <button
            className={`${styles.inputTab} ${inputTab === 'files' ? styles.inputTabActive : ''}`}
            onClick={() => setInputTab('files')}
            type="button"
          >
            <Upload size={13} /> Файлы
            {fileItems.length > 0 && <span className={styles.badgeSm}>{fileItems.length}</span>}
          </button>
        </div>

        {/* ── Text pane ── */}
        {inputTab === 'text' && (
          <>
            <div className={styles.inputHeader}>
              <span className={styles.inputLabel}>
                {mode === 'vacancy' ? 'Текст вакансии' : 'Текст резюме'}
                <span className={styles.inputHint}>(несколько — разделите <code>---</code>)</span>
              </span>
              <div className={styles.inputActions}>
                <button className={`${styles.toolBtn} ${pasteFlash ? styles.flash : ''}`} onClick={handlePaste} type="button">
                  <Clipboard size={13} /> Вставить
                </button>
                <button className={styles.toolBtn} onClick={() => { setText(''); setError(''); }} type="button" disabled={!text}>
                  <Trash2 size={13} /> Очистить
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === 'vacancy'
                ? 'Senior Python Developer\nКомпания: Тинькофф\nЗарплата: 400 000 – 600 000 ₽\nГибрид, Москва\n\nТребования:\n— Python 4+ лет\n— FastAPI / Django\n— PostgreSQL, Redis, Kafka\n— Docker, Kubernetes'
                : 'Иванов Иван Иванович\nivan@example.com · +7 916 ...\nМосква, удалённая работа\n\n2021–н.в.  Яндекс, Senior Python Developer\nPython, FastAPI, PostgreSQL, Redis, Kafka, Docker\n\n2019–2021  Ozon, Middle Python Developer\nPython, Django, PostgreSQL, Redis'
              }
            />
            <div className={styles.extractRow}>
              <span className={styles.charCount}>{text.length} символов</span>
              <Button onClick={handleExtract} disabled={!text.trim() || text.length < 30 || extracting}>
                {extracting
                  ? <><Loader2 size={14} className={styles.spin} /> Извлечение…</>
                  : <><Sparkles size={14} /> Распознать через LLM</>}
              </Button>
            </div>
          </>
        )}

        {/* ── Files pane ── */}
        {inputTab === 'files' && (
          <>
            {/* Drop zone */}
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            >
              <Upload size={28} className={styles.dropIcon} />
              <div className={styles.dropTitle}>
                {isDragging ? 'Отпустите файлы' : 'Перетащите или нажмите для выбора'}
              </div>
              <div className={styles.dropHint}>
                TXT · MD · HTML · PDF · DOC · DOCX · RTF · JSON — любое количество
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_EXTS.map((e) => `.${e}`).join(',')}
              className={styles.hiddenInput}
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            {/* File list */}
            {fileItems.length > 0 && (
              <div className={styles.fileList}>
                {fileItems.map((item) => (
                  <div key={item.id} className={`${styles.fileRow} ${styles[`fileRow_${item.status}`]}`}>
                    <span className={styles.fileIcon}>{FILE_STATUS_ICON[item.status]}</span>
                    <span className={styles.fileName} title={item.file.name}>{item.file.name}</span>
                    <span className={styles.fileSize}>{formatBytes(item.file.size)}</span>
                    <span className={styles.fileStatus}>{FILE_STATUS_LABEL[item.status]}</span>
                    {item.error && <span className={styles.fileError} title={item.error}>!</span>}
                    {(item.status === 'queued' || item.status === 'error') && (
                      <button className={styles.fileRemove} onClick={() => removeFile(item.id)} type="button">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* File actions */}
            <div className={styles.extractRow}>
              <div className={styles.fileSummary}>
                {queuedCount > 0 && <span>{queuedCount} в очереди</span>}
                {doneCount > 0 && <span className={styles.iconGreen}>{doneCount} готово</span>}
                {errCount > 0 && <span className={styles.iconRed}>{errCount} ошибок</span>}
                {busyCount > 0 && <span className={styles.iconAmber}>{busyCount} обрабатывается</span>}
                {doneCount > 0 && (
                  <button className={styles.toolBtnSm} onClick={clearDoneFiles} type="button">
                    Убрать готовые
                  </button>
                )}
              </div>
              <Button onClick={handleProcessFiles} disabled={queuedCount === 0 || processingFiles}>
                {processingFiles
                  ? <><Loader2 size={14} className={styles.spin} /> Обработка…</>
                  : <><Sparkles size={14} /> Распознать файлы ({queuedCount})</>}
              </Button>
            </div>
          </>
        )}
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
              {totalWarnings > 0 && <> · <span className={styles.warnText}>{totalWarnings} замечаний</span></>}
            </span>
            <div className={styles.spacer} />
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>На главную</Button>
            <Button onClick={handleSave} disabled={selected.size === 0}>
              <Save size={14} /> Сохранить ({selected.size})
            </Button>
          </div>
          <div className={styles.cards}>
            {mode === 'vacancy'
              ? vacancies.map((v, i) => (
                  <VacancyPreviewCard key={i} vacancy={v}
                    onChange={(next) => updateVacancy(i, next)}
                    onRemove={() => removeOne(i)}
                    selected={selected.has(i)} onToggleSelect={() => toggleOne(i)} />
                ))
              : candidates.map((c, i) => (
                  <CandidatePreviewCard key={i} candidate={c}
                    onChange={(next) => updateCandidate(i, next)}
                    onRemove={() => removeOne(i)}
                    selected={selected.has(i)} onToggleSelect={() => toggleOne(i)} />
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
