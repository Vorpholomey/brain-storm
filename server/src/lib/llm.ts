import { createLogger } from '@/lib/logger';
import { AppError } from '@/middleware/errorHandler';

const logger = createLogger({ module: 'llm' });

const LLM_TIMEOUT_MS = 5_000;

interface LLMResponse {
  title: string;
  content: string;
}

function getLLMConfig() {
  const baseUrl = process.env.LLAMA_BASE_URL ?? process.env.OPENAI_BASE_URL;
  const apiKey = process.env.LLAMA_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = process.env.LLAMA_MODEL ?? process.env.OPENAI_MODEL ?? 'qwen';

  if (!baseUrl) {
    throw new AppError(
      'LLM API base URL is not configured (set LLAMA_BASE_URL or OPENAI_BASE_URL)',
      'LLM_CONFIG_ERROR',
      500
    );
  }
  if (!apiKey) {
    throw new AppError(
      'LLM API key is not configured (set LLAMA_API_KEY or OPENAI_API_KEY)',
      'LLM_CONFIG_ERROR',
      500
    );
  }

  return { baseUrl, apiKey, model };
}

function buildStructurePrompt(chatText: string): string {
  return `Анализируй следующий текст из чата и извлеки из него основную идею в формате JSON:

Текст: ${chatText}

Верни JSON в формате: {"title": "краткое название идеи (до 200 символов)", "content": "развернутое описание идеи (до 5000 символов)"}

Важно: верни ТОЛЬКО валидный JSON без дополнительных текста, без markdown-разметки, без объяснений.`;
}

function parseLLMResponse(raw: string): LLMResponse {
  // Пытаемся найти JSON в ответе (в случае если модель добавила markdown или текст)
  let jsonStr = raw.trim();

  // Пытаемся извлечь JSON из markdown-блока ```json ... ```
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Пытаемся найти первый { и последний }
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.title || typeof parsed.title !== 'string') {
    throw new Error('Missing or invalid "title" in LLM response');
  }
  if (!parsed.content || typeof parsed.content !== 'string') {
    throw new Error('Missing or invalid "content" in LLM response');
  }

  return { title: parsed.title, content: parsed.content };
}

export async function structureIdeaFromChat(chatText: string): Promise<LLMResponse> {
  const { baseUrl, apiKey, model } = getLLMConfig();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    logger.info({ model, chatTextLength: chatText.length }, 'Calling LLM to structure idea');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Ты — ассистент для структурирования идей. Всегда отвечай валидным JSON с полями title и content.',
          },
          {
            role: 'user',
            content: buildStructurePrompt(chatText),
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        { status: response.status, errorBody, model },
        'LLM API returned non-OK status'
      );
      throw new AppError(
        `LLM API error: ${response.status} ${response.statusText}`,
        'LLM_API_ERROR',
        502
      );
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content;

    if (!message || typeof message !== 'string') {
      throw new Error('Unexpected LLM response format: no message content');
    }

    const result = parseLLMResponse(message);

    // Валидация длин
    if (result.title.length < 1 || result.title.length > 200) {
      result.title = result.title.slice(0, 200);
      logger.warn('LLM title truncated to 200 characters');
    }
    if (result.content.length < 1 || result.content.length > 5000) {
      result.content = result.content.slice(0, 5000);
      logger.warn('LLM content truncated to 5000 characters');
    }

    logger.info({ titleLength: result.title.length, contentLength: result.content.length }, 'LLM structured idea successfully');

    return result;
  } catch (error: any) {
    if (error.name === 'AbortError' || error?.code === 'ABORT_ERR') {
      logger.warn({ chatTextLength: chatText.length }, 'LLM request timed out');
      throw new AppError(
        'LLM processing timed out. Please try again or publish the idea manually.',
        'LLM_TIMEOUT',
        504
      );
    }
    if (error instanceof AppError) {
      throw error;
    }
    logger.error({ err: error }, 'LLM request failed');
    throw new AppError(
      'Failed to structure idea from chat. Please try again.',
      'LLM_ERROR',
      504
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
