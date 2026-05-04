import { useState, useEffect, useCallback } from 'react';
import { Clipboard, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import {
  configureLLM,
  getLLMConfig,
  checkConnection as checkLLMConnection,
  listModels,
} from '@/services';
import type { LLMProvider } from '@/services';
import {
  getPrompt,
  setPrompt,
  resetPrompt,
  isPromptCustomised,
  getPromptDomain,
  setPromptDomain,
  getDefaultPrompt,
  type PromptType,
} from '@/utils/llmExtractor';
import {
  PROMPT_DOMAINS,
  PROMPT_DOMAIN_LABELS,
  getPositionsForDomain,
  type PromptDomain,
} from '@/utils/promptComposer';
import styles from './LLMSettingsPanel.module.css';

export function LLMSettingsPanel() {
  const cfg = getLLMConfig();
  const [provider, setProvider] = useState<LLMProvider>(cfg.provider);
  const [ollamaUrl, setOllamaUrl] = useState(cfg.baseUrl);
  const [ollamaModel, setOllamaModel] = useState(cfg.model);
  const [deepseekKey, setDeepseekKey] = useState(cfg.deepseekApiKey);
  const [deepseekModel, setDeepseekModel] = useState(cfg.deepseekModel);
  const [showKey, setShowKey] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);

  // ── Prompts ────────────────────────────────────────────────────────────────
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState<PromptType>('vacancy');
  const [vacancyPrompt, setVacancyPromptState] = useState(() => getPrompt('vacancy'));
  const [candidatePrompt, setCandidatePromptState] = useState(() => getPrompt('candidate'));
  const [vacancyCustom, setVacancyCustom] = useState(() => isPromptCustomised('vacancy'));
  const [candidateCustom, setCandidateCustom] = useState(() => isPromptCustomised('candidate'));
  const [vacancyDomain, setVacancyDomainState] = useState<PromptDomain>(() => getPromptDomain('vacancy'));
  const [candidateDomain, setCandidateDomainState] = useState<PromptDomain>(() => getPromptDomain('candidate'));

  const currentPrompt = activePromptTab === 'vacancy' ? vacancyPrompt : candidatePrompt;
  const currentCustom = activePromptTab === 'vacancy' ? vacancyCustom : candidateCustom;
  const currentDomain = activePromptTab === 'vacancy' ? vacancyDomain : candidateDomain;
  const defaultPrompt = getDefaultPrompt(activePromptTab);
  const domainPositions = getPositionsForDomain(currentDomain);

  const handlePromptChange = (value: string) => {
    if (activePromptTab === 'vacancy') {
      setVacancyPromptState(value);
      setPrompt('vacancy', value);
      setVacancyCustom(isPromptCustomised('vacancy'));
    } else {
      setCandidatePromptState(value);
      setPrompt('candidate', value);
      setCandidateCustom(isPromptCustomised('candidate'));
    }
  };

  const handleDomainChange = (domain: PromptDomain) => {
    setPromptDomain(activePromptTab, domain);
    if (activePromptTab === 'vacancy') {
      setVacancyDomainState(domain);
      // If user has no override, reload composed prompt to reflect the new domain
      if (!isPromptCustomised('vacancy')) setVacancyPromptState(getPrompt('vacancy'));
    } else {
      setCandidateDomainState(domain);
      if (!isPromptCustomised('candidate')) setCandidatePromptState(getPrompt('candidate'));
    }
  };

  const handleReset = () => {
    resetPrompt(activePromptTab);
    const fresh = getPrompt(activePromptTab);
    if (activePromptTab === 'vacancy') {
      setVacancyPromptState(fresh);
      setVacancyCustom(false);
    } else {
      setCandidatePromptState(fresh);
      setCandidateCustom(false);
    }
  };

  // ── Connection ─────────────────────────────────────────────────────────────

  const runCheck = useCallback(async () => {
    setChecking(true);
    const ok = await checkLLMConnection();
    setConnected(ok);
    if (ok) setAvailableModels(await listModels());
    setChecking(false);
  }, []);

  // Fetch-on-mount: connection probe runs once when LLM provider settings load.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void runCheck(); }, [runCheck]);

  const handleProvider = (p: LLMProvider) => {
    setProvider(p);
    configureLLM({ provider: p });
    setConnected(false);
    runCheck();
  };

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setDeepseekKey(text);
        configureLLM({ deepseekApiKey: text });
        setPasteFlash(true);
        setTimeout(() => setPasteFlash(false), 800);
        runCheck();
      }
    } catch {
      alert('Не удалось прочитать буфер обмена. Вставьте ключ вручную.');
    }
  };

  const StatusIcon = checking
    ? <Loader2 size={14} className={styles.spin} />
    : connected
    ? <CheckCircle2 size={14} className={styles.ok} />
    : <XCircle size={14} className={styles.bad} />;

  return (
    <div className={styles.panel}>
      {/* ── Connection row ── */}
      <div className={styles.header}>
        <span className={styles.title}>LLM-провайдер</span>
        <span className={styles.status}>
          {StatusIcon}
          <span>{checking ? 'Проверка…' : connected ? 'Подключено' : 'Нет соединения'}</span>
        </span>
      </div>

      <div className={styles.providerRow}>
        <button
          className={`${styles.providerBtn} ${provider === 'deepseek' ? styles.providerActive : ''}`}
          onClick={() => handleProvider('deepseek')}
        >
          Deepseek <span className={styles.providerHint}>облако</span>
        </button>
        <button
          className={`${styles.providerBtn} ${provider === 'ollama' ? styles.providerActive : ''}`}
          onClick={() => handleProvider('ollama')}
        >
          Ollama <span className={styles.providerHint}>локально</span>
        </button>
      </div>

      {provider === 'deepseek' ? (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>API ключ</label>
            <div className={styles.keyRow}>
              <input
                className={`${styles.input} ${pasteFlash ? styles.flash : ''}`}
                type={showKey ? 'text' : 'password'}
                value={deepseekKey}
                onChange={(e) => { setDeepseekKey(e.target.value); configureLLM({ deepseekApiKey: e.target.value }); }}
                placeholder="sk-..."
              />
              <button className={styles.iconBtn} onClick={() => setShowKey((v) => !v)} title={showKey ? 'Скрыть' : 'Показать'} type="button">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button className={`${styles.pasteBtn} ${pasteFlash ? styles.flash : ''}`} onClick={handlePaste} title="Вставить из буфера" type="button">
                <Clipboard size={14} /> Вставить
              </button>
              <button className={styles.checkBtn} onClick={runCheck} type="button" disabled={!deepseekKey || checking}>
                Проверить
              </button>
            </div>
            <small className={styles.hint}>
              Хранится только в localStorage.&nbsp;
              <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">platform.deepseek.com/api_keys</a>
            </small>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Модель</label>
            <select className={styles.input} value={deepseekModel} onChange={(e) => { setDeepseekModel(e.target.value); configureLLM({ deepseekModel: e.target.value }); }}>
              <option value="deepseek-chat">deepseek-chat (v4-flash, быстрый)</option>
              <option value="deepseek-reasoner">deepseek-reasoner (медленнее, точнее)</option>
            </select>
          </div>
        </div>
      ) : (
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label}>URL Ollama</label>
            <div className={styles.keyRow}>
              <input className={styles.input} value={ollamaUrl} onChange={(e) => { setOllamaUrl(e.target.value); configureLLM({ baseUrl: e.target.value }); }} placeholder="http://localhost:11434" />
              <button className={styles.checkBtn} onClick={runCheck} type="button">Проверить</button>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Модель</label>
            {availableModels.length > 0 ? (
              <select className={styles.input} value={ollamaModel} onChange={(e) => { setOllamaModel(e.target.value); configureLLM({ model: e.target.value }); }}>
                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className={styles.input} value={ollamaModel} onChange={(e) => { setOllamaModel(e.target.value); configureLLM({ model: e.target.value }); }} placeholder="qwen2.5:14b" />
            )}
          </div>
        </div>
      )}

      {/* ── Prompts section ── */}
      <div className={styles.promptsSection}>
        <button
          className={styles.promptsToggle}
          onClick={() => setPromptsOpen((v) => !v)}
          type="button"
        >
          {promptsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Системные промпты</span>
          {(vacancyCustom || candidateCustom) && (
            <span className={styles.customBadge}>
              изменено: {[vacancyCustom && 'вакансии', candidateCustom && 'резюме'].filter(Boolean).join(', ')}
            </span>
          )}
        </button>

        {promptsOpen && (
          <div className={styles.promptsBody}>
            <p className={styles.promptsHint}>
              Системный промпт управляет тем, как LLM интерпретирует входной текст и что именно извлекает.
              Добавляйте правила, примеры, запреты — «не изобретать данные», «требовать явное указание лет», «приоритет русского языка» и т.д.
              Изменения сохраняются немедленно в localStorage и применяются к следующему запросу.
            </p>

            {/* Sub-tabs */}
            <div className={styles.promptTabs}>
              <button
                className={`${styles.promptTab} ${activePromptTab === 'vacancy' ? styles.promptTabActive : ''}`}
                onClick={() => setActivePromptTab('vacancy')}
                type="button"
              >
                Вакансия {vacancyCustom && <span className={styles.dot} />}
              </button>
              <button
                className={`${styles.promptTab} ${activePromptTab === 'candidate' ? styles.promptTabActive : ''}`}
                onClick={() => setActivePromptTab('candidate')}
                type="button"
              >
                Резюме {candidateCustom && <span className={styles.dot} />}
              </button>
            </div>

            {/* Domain selector */}
            <div className={styles.domainRow}>
              <label className={styles.label}>Домен</label>
              <select
                className={styles.input}
                value={currentDomain}
                onChange={(e) => handleDomainChange(e.target.value as PromptDomain)}
                disabled={currentCustom}
                title={currentCustom ? 'Сначала сбросьте кастомный промпт, чтобы переключить домен' : 'Подмешать в промпт шаблоны должностей этого домена'}
              >
                {PROMPT_DOMAINS.map((d) => (
                  <option key={d} value={d}>{PROMPT_DOMAIN_LABELS[d]}</option>
                ))}
              </select>
              <span className={styles.domainCount}>
                {domainPositions.length} {domainPositions.length === 1 ? 'должность' : 'должностей'}
              </span>
            </div>
            {!currentCustom && domainPositions.length > 0 && (
              <div className={styles.domainPositions}>
                {domainPositions.map((p) => (
                  <span key={p.id} className={styles.domainChip} title={p.description ?? p.name}>
                    {p.id}
                  </span>
                ))}
              </div>
            )}

            {/* Editor */}
            <textarea
              className={styles.promptTextarea}
              value={currentPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              spellCheck={false}
            />

            <div className={styles.promptFooter}>
              <span className={styles.promptMeta}>
                {currentPrompt.length} символов
                {currentCustom && <span className={styles.customLabel}> · изменён</span>}
              </span>
              <div className={styles.promptActions}>
                {currentCustom && (
                  <button className={styles.resetBtn} onClick={handleReset} type="button" title="Сбросить к дефолтному промпту">
                    <RotateCcw size={12} /> Сбросить к дефолту
                  </button>
                )}
                <button
                  className={styles.diffBtn}
                  onClick={() => {
                    const changed = currentPrompt.trim() !== defaultPrompt.trim();
                    if (!changed) { alert('Промпт совпадает с дефолтным.'); return; }
                    const win = window.open('', '_blank');
                    win?.document.write(`<pre style="font-size:12px;white-space:pre-wrap">${currentPrompt}</pre>`);
                  }}
                  type="button"
                  title="Просмотреть текущий промпт в новой вкладке"
                >
                  Предпросмотр
                </button>
              </div>
            </div>

            {/* Quick-insert tips */}
            <div className={styles.tipsBlock}>
              <div className={styles.tipsLabel}>Быстрая вставка правил:</div>
              <div className={styles.tips}>
                {PROMPT_TIPS[activePromptTab].map((tip) => (
                  <button
                    key={tip.label}
                    className={styles.tipBtn}
                    onClick={() => handlePromptChange(currentPrompt + '\n' + tip.text)}
                    type="button"
                    title={tip.text}
                  >
                    + {tip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quick-insert tips ─────────────────────────────────────────────────────────

const PROMPT_TIPS: Record<PromptType, { label: string; text: string }[]> = {
  vacancy: [
    { label: 'Не выдумывать',       text: '- NEVER invent or guess data. If a field is not present in the source text, omit it entirely.' },
    { label: 'Только явные годы',    text: '- Include minYears only when the number of years is explicitly stated in the text (e.g. "3+ years", "от 3 лет"). Do not estimate.' },
    { label: 'Разделять MIN/MAX',    text: '- Mark requirements as required=true only if marked as mandatory/обязательно. Mark as required=false if marked as желательно/плюсом/nice-to-have.' },
    { label: 'Исходный язык',        text: '- Preserve tool and technology names exactly as written in the source. Do not translate or normalise.' },
    { label: 'Без дублей',           text: '- Do not add the same tool/skill to requirements more than once, even if mentioned multiple times.' },
  ],
  candidate: [
    { label: 'Не выдумывать',       text: '- NEVER invent or guess data. If a field is not present in the resume, omit it entirely.' },
    { label: 'Все технологии',       text: '- Extract ALL technologies, tools, frameworks and platforms mentioned anywhere in the resume — including summaries, project descriptions, and skill lists.' },
    { label: 'Оценка лет по датам',  text: '- If years per tool are not stated, estimate from the employment dates: if the candidate worked somewhere for 2 years, each tool listed gets years=2.' },
    { label: 'Без дублей',           text: '- Do not add the same tool more than once per work entry, even if mentioned multiple times.' },
    { label: 'Рус. формат имён',     text: '- For Russian names in "Фамилия Имя Отчество" format: map first token → lastName, second → firstName, third → middleName.' },
    { label: 'Текущее место',        text: '- Set isCurrent=true if the end date is "н.в.", "по настоящее время", "present", "current", "сейчас" or is absent for the latest entry.' },
  ],
};
