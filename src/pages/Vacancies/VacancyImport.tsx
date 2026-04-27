import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { usePositionStore, useVacancyStore } from '@/stores';
import {
  checkConnection as checkLLMConnection,
  listModels,
  configureLLM,
  getLLMConfig,
  parseVacanciesFromUrl,
  parseVacanciesFromText,
} from '@/services';
import type { ParsedVacancy, ParseProgress, LLMProvider } from '@/services';
import type { Grade, Currency, WorkFormat, EmploymentType, VacancyStatus } from '@/entities';
import styles from './VacancyImport.module.css';

type InputMode = 'url' | 'text';

export function VacancyImport() {
  const navigate = useNavigate();
  const { positions, load: loadPositions } = usePositionStore();
  const addVacancy = useVacancyStore((s) => s.add);

  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

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
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [llmStream, setLlmStream] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<ParsedVacancy[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState(false);

  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadPositions(); }, [loadPositions]);

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

  // Resolve position ID from parsed title
  const guessPositionId = (title: string): string => {
    const t = title.toLowerCase();
    if (t.includes('android')) return 'pos_android';
    if (t.includes('ios')) return 'pos_ios';
    if (t.includes('flutter') || t.includes('react native') || t.includes('кроссплатформ')) return 'pos_mobile_cross';
    if (t.includes('fullstack') || t.includes('full-stack') || t.includes('фулстек')) return 'pos_fullstack';
    if (t.includes('frontend') || t.includes('фронтенд') || t.includes('front-end')) return 'pos_frontend';
    if (t.includes('backend') || t.includes('бэкенд') || t.includes('back-end')) return 'pos_backend';
    if (t.includes('devops') || t.includes('sre')) return 'pos_devops';
    if (t.includes('qa') || t.includes('тестировщик') || t.includes('test')) return 'pos_qa_auto';
    if (t.includes('data engineer')) return 'pos_data_engineer';
    if (t.includes('data analyst') || t.includes('аналитик данных')) return 'pos_analyst_data';
    if (t.includes('analyst') || t.includes('аналитик')) return 'pos_analyst_sys';
    if (t.includes('ml') || t.includes('machine learning')) return 'pos_ml_engineer';
    if (t.includes('designer') || t.includes('дизайнер')) return 'pos_designer';
    if (t.includes('product manager') || t.includes('продакт')) return 'pos_pm';
    if (t.includes('1с') || t.includes('1c')) return 'pos_1c_dev';
    // Default to backend for dev roles
    if (t.includes('developer') || t.includes('разработчик') || t.includes('инженер')) return 'pos_backend';
    return positions.length > 0 ? positions[0].id : 'pos_backend';
  };

  const handleParse = async () => {
    setError('');
    setResults([]);
    setSelected(new Set());
    setSaved(false);
    setLlmStream('');
    setLoading(true);

    try {
      const onProgress = (p: ParseProgress) => {
        setProgress(p);
      };

      const streamCallbacks = {
        onToken: (token: string) => {
          setLlmStream((prev) => {
            const next = prev + token;
            // Auto-scroll
            setTimeout(() => {
              if (streamRef.current) {
                streamRef.current.scrollTop = streamRef.current.scrollHeight;
              }
            }, 0);
            return next;
          });
        },
      };

      let vacancies: ParsedVacancy[];
      if (mode === 'url') {
        vacancies = await parseVacanciesFromUrl(url, onProgress, streamCallbacks);
      } else {
        vacancies = await parseVacanciesFromText(text, undefined, onProgress, streamCallbacks);
      }

      setResults(vacancies);
      // Select all by default
      setSelected(new Set(vacancies.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setProgress({ stage: 'error', message: 'Ошибка' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  };

  const handleSave = async () => {
    const toSave = results.filter((_, i) => selected.has(i));
    let savedCount = 0;

    for (const parsed of toSave) {
      const minReqs = parsed.requirements
        .filter((r) => r.isRequired && r.toolId)
        .map((r) => ({ toolId: r.toolId!, minYears: r.minYears }));

      const maxReqs = parsed.requirements
        .filter((r) => r.toolId)
        .map((r) => ({
          toolId: r.toolId!,
          minYears: r.minYears,
          isLocked: r.isRequired,
        }));

      await addVacancy({
        positionId: guessPositionId(parsed.title),
        companyName: parsed.companyName,
        grade: (parsed.grade || 'middle') as Grade,
        salaryFrom: parsed.salaryFrom,
        salaryTo: parsed.salaryTo,
        currency: (parsed.currency || 'RUB') as Currency,
        publishedAt: new Date(),
        status: 'open' as VacancyStatus,
        sourceUrl: parsed.sourceUrl,
        minRequirements: minReqs,
        maxRequirements: maxReqs,
        location: parsed.location,
        workFormat: (parsed.workFormat || 'office') as WorkFormat,
        employmentType: (parsed.employmentType || 'full') as EmploymentType,
        notes: parsed.description,
      });
      savedCount++;
    }

    setSaved(true);
    setTimeout(() => {
      if (savedCount === 1) {
        navigate('/');
      } else {
        navigate('/');
      }
    }, 1500);
  };

  const canParse = mode === 'url' ? url.trim().length > 5 : text.trim().length > 20;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Импорт вакансий</h1>
      <p className={styles.subtitle}>
        Вставьте ссылку на страницу с вакансиями или текст вакансии — LLM извлечёт данные автоматически
      </p>

      {/* Mode tabs */}
      <div className={styles.modeTabs}>
        <button
          className={`${styles.modeTab} ${mode === 'url' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('url')}
        >
          По ссылке
        </button>
        <button
          className={`${styles.modeTab} ${mode === 'text' ? styles.modeTabActive : ''}`}
          onClick={() => setMode('text')}
        >
          Текст вакансии
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

      {/* Input */}
      {mode === 'url' ? (
        <>
          <div className={styles.urlRow}>
            <input
              className={styles.urlInput}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hh.ru/vacancy/12345 или https://t.me/s/channel_name"
              onKeyDown={(e) => e.key === 'Enter' && canParse && !loading && handleParse()}
            />
            <Button onClick={handleParse} disabled={!canParse || loading || !connected}>
              {loading ? 'Парсинг...' : 'Парсить'}
            </Button>
          </div>
          <div className={styles.hints}>
            <span className={styles.hint}>hh.ru</span>
            <span className={styles.hint}>career.habr.com</span>
            <span className={styles.hint}>t.me/channel</span>
          </div>
        </>
      ) : (
        <>
          <textarea
            className={styles.textArea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Вставьте текст вакансии...\n\nНапример:\nSenior Python Developer\nКомпания: Тинькофф\nЗарплата: от 400 000 до 600 000 ₽\nФормат: гибрид, Москва\n\nТребования:\n- Python 4+ лет\n- FastAPI / Django\n- PostgreSQL, Redis\n- Docker, Kubernetes\n- Микросервисная архитектура'}
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
          {llmStream && (
            <div className={styles.llmStream} ref={streamRef}>
              {llmStream}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsTitle}>
            Найдено: {results.length} {results.length === 1 ? 'вакансия' : results.length < 5 ? 'вакансии' : 'вакансий'}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selected.size === results.length ? 'Снять выделение' : 'Выбрать все'}
            </Button>
          </div>

          {results.map((v, i) => (
            <div key={i} className={styles.vacancyCard}>
              <div className={styles.vacancyHeader}>
                <div>
                  <div className={styles.vacancyTitle}>{v.title || 'Без названия'}</div>
                  <div className={styles.vacancyCompany}>{v.companyName}</div>
                </div>
                <div className={styles.vacancyCheck}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(i)}
                    onChange={() => toggleSelection(i)}
                  />
                </div>
              </div>

              <div className={styles.vacancyMeta}>
                <span className={styles.metaBadge}>{v.grade}</span>
                {v.salaryFrom && (
                  <span className={styles.metaBadge}>
                    {v.salaryFrom?.toLocaleString()}{v.salaryTo ? ` – ${v.salaryTo.toLocaleString()}` : '+'} {v.currency}
                  </span>
                )}
                {v.location && <span className={styles.metaBadge}>{v.location}</span>}
                <span className={styles.metaBadge}>{v.workFormat}</span>
                <span className={styles.metaBadge}>{v.employmentType}</span>
              </div>

              {v.description && (
                <p style={{ fontSize: '0.8rem', color: 'var(--tx-secondary)', marginBottom: '8px' }}>
                  {v.description}
                </p>
              )}

              {v.requirements.length > 0 && (
                <>
                  <div className={styles.reqSection}>
                    <div className={styles.reqLabel}>Обязательные</div>
                    <div className={styles.reqChips}>
                      {v.requirements.filter((r) => r.isRequired).map((r, j) => (
                        <span
                          key={j}
                          className={`${styles.reqChip} ${r.toolId ? styles.reqChipResolved : styles.reqChipUnresolved}`}
                          title={r.toolId ? `ID: ${r.toolId}` : 'Не найден в базе инструментов'}
                        >
                          {r.toolName}{r.minYears ? ` ${r.minYears}y` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  {v.requirements.some((r) => !r.isRequired) && (
                    <div className={styles.reqSection}>
                      <div className={styles.reqLabel}>Желательные</div>
                      <div className={styles.reqChips}>
                        {v.requirements.filter((r) => !r.isRequired).map((r, j) => (
                          <span
                            key={j}
                            className={`${styles.reqChip} ${r.toolId ? styles.reqChipResolved : styles.reqChipUnresolved}`}
                            title={r.toolId ? `ID: ${r.toolId}` : 'Не найден в базе инструментов'}
                          >
                            {r.toolName}{r.minYears ? ` ${r.minYears}y` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={selected.size === 0 || saved}>
              Сохранить {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>

          {saved && (
            <div className={styles.savedMessage}>
              Вакансии сохранены! Перенаправление...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
