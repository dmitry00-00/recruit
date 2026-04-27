// ── LLM Service — Ollama (local) and Deepseek (cloud) ──────────

export type LLMProvider = 'ollama' | 'deepseek';

export interface LLMConfig {
  provider: LLMProvider;
  // Ollama
  baseUrl: string;
  model: string;
  // Deepseek
  deepseekApiKey: string;
  deepseekModel: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: (localStorage.getItem('llm_provider') as LLMProvider) || 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:14b',
  deepseekApiKey: localStorage.getItem('deepseek_api_key') || '',
  deepseekModel: 'deepseek-chat',
  temperature: 0.1,
  maxTokens: 4096,
};

let currentConfig: LLMConfig = { ...DEFAULT_CONFIG };

export function configureLLM(config: Partial<LLMConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  if (config.provider) localStorage.setItem('llm_provider', config.provider);
  if (config.deepseekApiKey !== undefined) localStorage.setItem('deepseek_api_key', config.deepseekApiKey);
}

export function getLLMConfig(): LLMConfig {
  return { ...currentConfig };
}

// ── Connection checks ────────────────────────────────────────────

export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${currentConfig.baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkDeepseekConnection(): Promise<boolean> {
  if (!currentConfig.deepseekApiKey) return false;
  try {
    const res = await fetch('https://api.deepseek.com/models', {
      headers: { Authorization: `Bearer ${currentConfig.deepseekApiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkConnection(): Promise<boolean> {
  if (currentConfig.provider === 'deepseek') return checkDeepseekConnection();
  return checkOllamaConnection();
}

export async function listModels(): Promise<string[]> {
  if (currentConfig.provider === 'deepseek') {
    return ['deepseek-chat', 'deepseek-reasoner'];
  }
  try {
    const res = await fetch(`${currentConfig.baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

// ── Generation ───────────────────────────────────────────────────

export interface LLMStreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

async function generateOllama(
  prompt: string,
  systemPrompt: string | undefined,
  callbacks?: LLMStreamCallbacks,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: currentConfig.model,
    prompt,
    stream: true,
    options: { temperature: currentConfig.temperature, num_predict: currentConfig.maxTokens },
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(`${currentConfig.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter(Boolean)) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            fullText += parsed.response;
            callbacks?.onToken?.(parsed.response);
          }
        } catch { /* skip malformed lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callbacks?.onComplete?.(fullText);
  return fullText;
}

async function generateDeepseek(
  prompt: string,
  systemPrompt: string | undefined,
  callbacks?: LLMStreamCallbacks,
): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentConfig.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: currentConfig.deepseekModel,
      messages,
      stream: true,
      temperature: currentConfig.temperature,
      max_tokens: currentConfig.maxTokens,
    }),
  });

  if (!res.ok) throw new Error(`Deepseek error ${res.status}: ${await res.text()}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const token: string = parsed.choices?.[0]?.delta?.content ?? '';
          if (token) {
            fullText += token;
            callbacks?.onToken?.(token);
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callbacks?.onComplete?.(fullText);
  return fullText;
}

export async function generateCompletion(
  prompt: string,
  systemPrompt?: string,
  callbacks?: LLMStreamCallbacks,
): Promise<string> {
  if (currentConfig.provider === 'deepseek') {
    return generateDeepseek(prompt, systemPrompt, callbacks);
  }
  return generateOllama(prompt, systemPrompt, callbacks);
}

export function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();

  return text.trim();
}
