// ── LLM Service — Communication with local Ollama API ──────

export interface LLMConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:14b',
  temperature: 0.1,
  maxTokens: 4096,
};

let currentConfig: LLMConfig = { ...DEFAULT_CONFIG };

export function configureLLM(config: Partial<LLMConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

export function getLLMConfig(): LLMConfig {
  return { ...currentConfig };
}

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

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${currentConfig.baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

export interface LLMStreamCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export async function generateCompletion(
  prompt: string,
  systemPrompt?: string,
  callbacks?: LLMStreamCallbacks,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: currentConfig.model,
    prompt,
    stream: true,
    options: {
      temperature: currentConfig.temperature,
      num_predict: currentConfig.maxTokens,
    },
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch(`${currentConfig.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama error ${res.status}: ${errText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            fullText += parsed.response;
            callbacks?.onToken?.(parsed.response);
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callbacks?.onComplete?.(fullText);
  return fullText;
}

export function extractJSON(text: string): string {
  // Try to find JSON between ```json ... ``` blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try to find JSON array or object
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();

  return text.trim();
}
