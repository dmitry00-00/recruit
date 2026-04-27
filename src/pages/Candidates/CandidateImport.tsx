import { useState, useEffect, useRef, useCallback, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCandidateStore } from '@/stores';
import {
  checkConnection as checkLLMConnection,
  listModels,
  configureLLM,
  getLLMConfig,
  parseResumesFromText,
  parseResumesFromFiles,
  parsedCandidateToStoreFormat,
} from '@/services';
import type { ParsedCandidate, ResumeParseProgress, LLMProvider } from '@/services';
import styles from './CandidateImport.module.css';

type InputMode = 'files' | 'text';

export function CandidateImport() {
  const navigate = useNavigate();
  const addCandidate = useCandidateStore((s) => s.add);

  const [mode, setMode] = useState<InputMode>('files');
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // LLM settings
  const cfg = getLLMConfig();
  const [provider, setProvider] = useState<LLMProvider>(cfg.provider);
  const [ollamaUrl, setOllamaUrl] = useState(cfg.baseUrl);
  const [model, setModel] = useState(cfg.model);
  const [deepseekKey, setDeepseekKey] = useState(cfg.deepseekApiKey);
  const [deepseekModel, setDeepseekModel] = useState(cfg.deepseekModel);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Parsing state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ResumeParseProgress | null>(null);
  const [llmStream, setLlmStream] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<ParsedCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const checkConnection = useCallback(async () => {
    setCheckingConnection(true);
    const ok = await checkLLMConnection();
    setConnected(ok);
    if (ok) {
      const models = await listModels();
      setAvailableModels(models);
    }
    setCheckingConnection(false);
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const handleProviderChange = (p: LLMProvider) => {
    setProvider(p);
    configureLLM({ provider: p });
    setConnected(false);
    checkConnection();
  };

  const handleModelChange = (m: string) => {
    setModel(m);
    configureLLM({ model: m });
  };

  const handleDeepseekModelChange = (m: string) => {
    setDeepseekModel(m);
    configureLLM({ deepseekModel: m });
  };

  const handleOllamaUrlChange = (newUrl: string) => {
    setOllamaUrl(newUrl);
    configureLLM({ baseUrl: newUrl });
  };

  const handleDeepseekKeyChange = (key: string) => {
    setDeepseekKey(key);
    configureLLM({ deepseekApiKey: key });
  };

  // ── File handling ──

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const allowed = arr.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['txt', 'md', 'html', 'htm', 'pdf', 'doc', 'docx', 'rtf', 'json'].includes(ext || '');
    });
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !existing.has(f.name))];
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ── Parse ──

  const handleParse = async () => {
    setError('');
    setResults([]);
    setSelected(new Set());
    setSaved(false);
    setLlmStream('');
    setLoading(true);

    const streamCallbacks = {
      onToken: (token: string) => {
        setLlmStream((prev) => {
          const next = prev + token;
          setTimeout(() => {
            if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
          }, 0);
          return next;
        });
      },
    };

    try {
      let candidates: ParsedCandidate[];

      if (mode === 'files') {
        candidates = await parseResumesFromFiles(files, setProgress, streamCallbacks);
      } else {
        setProgress({ stage: 'parsing', message: 'Отправка в LLM...' });
        candidates = await parseResumesFromText(text, setProgress, streamCallbacks);
      }

      setResults(candidates);
      setSelected(new Set(candidates.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setProgress({ stage: 'error', message: 'Ошибка' });
    } finally {
      setLoading(false);
    }
  };

  // ── Select / Save ──

  const toggleSelection = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === results.length ? new Set() : new Set(results.map((_, i) => i)));
  };

  const handleSave = async () => {
    const toSave = results.filter((_, i) => selected.has(i));
    for (const parsed of toSave) {
      const { candidateData, workEntries } = parsedCandidateToStoreFormat(parsed);
      await addCandidate(candidateData, workEntries);
    }
    setSaved(true);
    setTimeout(() => navigate('/'), 1500);
  };

  const canParse = mode === 'files' ? files.length > 0 : text.trim().length > 20;
  const progressPct = progress?.total ? Math.round(((progress.current || 0) / progress.total) * 100) : 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Импорт резюме</h1>
      <p className={styles.subtitle}>
        Загрузите файлы резюме или вставьте текст — LLM извлечёт данные кандидатов автоматически
      </p>

      {/* Mode tabs */}
      <div className={styles.modeTabs}>
        <button
          className={`${styles.modeTab} ${mode === 'files' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('files')}
        >
          Файлы резюме
        </button>
        <button
          className={`${styles.modeTab} ${mode === 'text' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('text')}
        >
          Вставить текст
        </button>
      </div>

      {/* LLM Settings */}
      <div className={styles.settingsRow}>
        <div
          className={`${styles.connectionDot} ${connected ? styles.connected : styles.disconnected}`}
          title={connected ? 'Подключено' : 'Нет соединения'}
        />
        <span className={styles.settingsLabel}>LLM:</span>
        <select
          className={styles.settingsSelect}
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
          style={{ width: 110 }}
        >
          <option value="ollama">Ollama</option>
          <option value="deepseek">Deepseek</option>
        </select>

        {provider === 'ollama' ? (
          <>
            <input
              className={styles.settingsInput}
              value={ollamaUrl}
              onChange={(e) => handleOllamaUrlChange(e.target.value)}
              placeholder="http://localhost:11434"
            />
            <span className={styles.settingsLabel}>Модель:</span>
            {availableModels.length > 0 ? (
              <select className={styles.settingsSelect} value={model} onChange={(e) => handleModelChange(e.target.value)}>
                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className={styles.settingsInput} value={model} onChange={(e) => handleModelChange(e.target.value)} placeholder="qwen2.5:14b" style={{ width: 140 }} />
            )}
          </>
        ) : (
          <>
            <input
              className={styles.settingsInput}
              type="password"
              value={deepseekKey}
              onChange={(e) => handleDeepseekKeyChange(e.target.value)}
              placeholder="API ключ Deepseek"
              style={{ flex: 1 }}
            />
            <span className={styles.settingsLabel}>Модель:</span>
            <select className={styles.settingsSelect} value={deepseekModel} onChange={(e) => handleDeepseekModelChange(e.target.value)} style={{ width: 160 }}>
              <option value="deepseek-chat">deepseek-chat (v4-flash)</option>
              <option value="deepseek-reasoner">deepseek-reasoner</option>
            </select>
          </>
        )}
        {checkingConnection && <div className={styles.spinner} />}
      </div>

      {/* File mode */}
      {mode === 'files' && (
        <>
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={styles.dropIcon}><Upload size={32} /></div>
            <div className={styles.dropTitle}>
              {isDragging ? 'Отпустите файлы' : 'Перетащите файлы или нажмите'}
            </div>
            <div className={styles.dropHint}>
              TXT, MD, HTML, PDF, DOC, DOCX, RTF — любое количество файлов
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.html,.htm,.pdf,.doc,.docx,.rtf,.json"
            className={styles.hiddenInput}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {files.length > 0 && (
            <div className={styles.fileList}>
              {files.map((f, i) => (
                <div key={i} className={styles.fileItem}>
                  <FileText size={14} style={{ color: 'var(--tx-muted)', flexShrink: 0 }} />
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</span>
                  <button className={styles.fileRemove} onClick={() => removeFile(i)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleParse} disabled={!canParse || loading || !connected}>
            {loading ? `Обработка... (${progressPct}%)` : `Обработать${files.length > 0 ? ` (${files.length})` : ''}`}
          </Button>
        </>
      )}

      {/* Text mode */}
      {mode === 'text' && (
        <>
          <textarea
            className={styles.textArea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Вставьте текст резюме...\n\nМожно вставить несколько резюме подряд — LLM распознает каждого кандидата отдельно.\n\nПример:\nИванов Иван Иванович\nEmail: ivan@example.com\nТелефон: +7 916 123-45-67\nМосква, готов к удалённой работе\n\nОпыт работы:\n2021–н.в. Яндекс, Senior Python Developer\n- Python, FastAPI, PostgreSQL, Redis, Kafka, Docker\n\n2019–2021 Ozon, Middle Python Developer\n- Python, Django, PostgreSQL, Redis'}
          />
          <Button onClick={handleParse} disabled={!canParse || loading || !connected}>
            {loading ? 'Анализ...' : 'Анализировать'}
          </Button>
        </>
      )}

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Progress */}
      {loading && progress && (
        <div className={styles.progress}>
          <div className={styles.progressStage}>
            <div className={styles.spinner} />
            <span>{progress.message}</span>
          </div>
          {progress.total && progress.total > 1 && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
          )}
          {llmStream && (
            <div className={styles.llmStream} ref={streamRef}>{llmStream}</div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsTitle}>
            Найдено кандидатов: {results.length}
          </div>

          <div style={{ marginBottom: 12 }}>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selected.size === results.length ? 'Снять выделение' : 'Выбрать всех'}
            </Button>
          </div>

          {results.map((c, i) => {
            const fullName = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ');
            const contacts = [c.email, c.phone, c.telegramHandle].filter(Boolean).join(' · ');
            const resolvedTools = c.workEntries.flatMap((we) => we.tools).filter((t) => t.toolId).length;
            const totalTools = c.workEntries.flatMap((we) => we.tools).length;

            return (
              <div key={i} className={styles.candidateCard}>
                <div className={styles.candidateHeader}>
                  <div>
                    <div className={styles.candidateName}>{fullName || 'Без имени'}</div>
                    {contacts && <div className={styles.candidateContact}>{contacts}</div>}
                  </div>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(i)}
                    onChange={() => toggleSelection(i)}
                  />
                </div>

                <div className={styles.candidateMeta}>
                  {c.city && <span className={styles.metaBadge}>{c.city}</span>}
                  <span className={styles.metaBadge}>{c.workFormat}</span>
                  {c.relocate && <span className={styles.metaBadge}>релокация</span>}
                  {c.salaryExpected && (
                    <span className={styles.metaBadge}>
                      {c.salaryExpected.toLocaleString()} {c.currency}
                    </span>
                  )}
                  <span className={styles.metaBadge} title="Распознано инструментов">
                    🔧 {resolvedTools}/{totalTools}
                  </span>
                </div>

                {c.notes && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--tx-secondary)', marginBottom: 8 }}>
                    {c.notes}
                  </p>
                )}

                {c.workEntries.map((we, j) => (
                  <div key={j} className={styles.workEntryItem}>
                    <div className={styles.weHeader}>
                      <span className={styles.weCompany}>{we.companyName} · {we.grade}</span>
                      <span className={styles.weDates}>
                        {we.startDate?.slice(0, 7) ?? '?'} – {we.isCurrent ? 'н.в.' : (we.endDate?.slice(0, 7) ?? '?')}
                      </span>
                    </div>
                    <div className={styles.toolChips}>
                      {we.tools.map((t, k) => (
                        <span
                          key={k}
                          className={`${styles.toolChip} ${t.toolId ? styles.toolResolved : styles.toolUnresolved}`}
                          title={t.toolId ? `ID: ${t.toolId}` : 'Не найден в базе'}
                        >
                          {t.toolName}{t.years > 0 ? ` ${t.years}y` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate(-1)}>Отмена</Button>
            <Button onClick={handleSave} disabled={selected.size === 0 || saved}>
              Сохранить {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>

          {saved && (
            <div className={styles.savedMessage}>
              Кандидаты сохранены! Перенаправление...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
