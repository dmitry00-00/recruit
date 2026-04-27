import { useState, useEffect, useCallback } from 'react';
import { Clipboard, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  configureLLM,
  getLLMConfig,
  checkConnection as checkLLMConnection,
  listModels,
} from '@/services';
import type { LLMProvider } from '@/services';
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

  const runCheck = useCallback(async () => {
    setChecking(true);
    const ok = await checkLLMConnection();
    setConnected(ok);
    if (ok) setAvailableModels(await listModels());
    setChecking(false);
  }, []);

  useEffect(() => { runCheck(); }, [runCheck]);

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
          Deepseek
          <span className={styles.providerHint}>облако</span>
        </button>
        <button
          className={`${styles.providerBtn} ${provider === 'ollama' ? styles.providerActive : ''}`}
          onClick={() => handleProvider('ollama')}
        >
          Ollama
          <span className={styles.providerHint}>локально</span>
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
                onChange={(e) => {
                  setDeepseekKey(e.target.value);
                  configureLLM({ deepseekApiKey: e.target.value });
                }}
                placeholder="sk-..."
              />
              <button
                className={styles.iconBtn}
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? 'Скрыть' : 'Показать'}
                type="button"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className={styles.pasteBtn}
                onClick={handlePaste}
                title="Вставить из буфера обмена"
                type="button"
              >
                <Clipboard size={14} /> Вставить
              </button>
              <button
                className={styles.checkBtn}
                onClick={runCheck}
                type="button"
                disabled={!deepseekKey || checking}
              >
                Проверить
              </button>
            </div>
            <small className={styles.hint}>
              Ключ хранится только в localStorage браузера. Получить:&nbsp;
              <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">
                platform.deepseek.com/api_keys
              </a>
            </small>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Модель</label>
            <select
              className={styles.input}
              value={deepseekModel}
              onChange={(e) => {
                setDeepseekModel(e.target.value);
                configureLLM({ deepseekModel: e.target.value });
              }}
            >
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
              <input
                className={styles.input}
                value={ollamaUrl}
                onChange={(e) => {
                  setOllamaUrl(e.target.value);
                  configureLLM({ baseUrl: e.target.value });
                }}
                placeholder="http://localhost:11434"
              />
              <button className={styles.checkBtn} onClick={runCheck} type="button">
                Проверить
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Модель</label>
            {availableModels.length > 0 ? (
              <select
                className={styles.input}
                value={ollamaModel}
                onChange={(e) => {
                  setOllamaModel(e.target.value);
                  configureLLM({ model: e.target.value });
                }}
              >
                {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input
                className={styles.input}
                value={ollamaModel}
                onChange={(e) => {
                  setOllamaModel(e.target.value);
                  configureLLM({ model: e.target.value });
                }}
                placeholder="qwen2.5:14b"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
