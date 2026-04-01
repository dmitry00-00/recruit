// ── Scraper Service — Fetch and clean web content ──────────

export type SourceType = 'hh' | 'habr_career' | 'telegram' | 'unknown';

export function detectSourceType(url: string): SourceType {
  const u = url.toLowerCase();
  if (u.includes('hh.ru')) return 'hh';
  if (u.includes('career.habr.com')) return 'habr_career';
  if (u.includes('t.me/') || u.includes('telegram.me/')) return 'telegram';
  return 'unknown';
}

export function normalizeTelegramUrl(url: string): string {
  // Convert t.me/channel to t.me/s/channel (public web view)
  const match = url.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]+)/);
  if (match) {
    return `https://t.me/s/${match[1]}`;
  }
  return url;
}

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

export async function fetchPageContent(url: string): Promise<string> {
  // Try direct fetch first (works for some APIs and Telegram)
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return await res.text();
  } catch {
    // CORS blocked, try proxies
  }

  // Try CORS proxies
  for (const makeProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxyUrl(url);
      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return await res.text();
    } catch {
      continue;
    }
  }

  throw new Error(`Не удалось загрузить страницу: ${url}. Попробуйте вставить текст вручную.`);
}

export function extractTextFromHTML(html: string, sourceType: SourceType): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts, styles, nav, footer, etc.
  const removeSelectors = ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe'];
  removeSelectors.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  switch (sourceType) {
    case 'hh':
      return extractHH(doc);
    case 'habr_career':
      return extractHabrCareer(doc);
    case 'telegram':
      return extractTelegram(doc);
    default:
      return extractGeneric(doc);
  }
}

function extractHH(doc: Document): string {
  // HH.ru vacancy page — main content blocks
  const selectors = [
    '[data-qa="vacancy-title"]',
    '[data-qa="vacancy-salary"]',
    '[data-qa="vacancy-company"]',
    '[data-qa="vacancy-view-location"]',
    '[data-qa="vacancy-view-employment-mode"]',
    '[data-qa="vacancy-description"]',
    '.vacancy-branded-user-content',
    '.bloko-tag-list',
  ];

  const parts: string[] = [];
  for (const sel of selectors) {
    const els = doc.querySelectorAll(sel);
    els.forEach((el) => {
      const text = (el as HTMLElement).innerText || el.textContent || '';
      if (text.trim()) parts.push(text.trim());
    });
  }

  if (parts.length > 0) return parts.join('\n\n');

  // Fallback: get everything from main content area
  const main = doc.querySelector('.vacancy-section, [itemtype*="JobPosting"], main, .content');
  if (main) return (main as HTMLElement).innerText || main.textContent || '';

  return extractGeneric(doc);
}

function extractHabrCareer(doc: Document): string {
  // Habr Career vacancy page
  const selectors = [
    '.page-title__title',
    '.vacancy-card__salary',
    '.vacancy-card__company-title',
    '.vacancy-card__meta',
    '.vacancy-card__text',
    '.content-section',
    '.vacancy-skill',
  ];

  const parts: string[] = [];
  for (const sel of selectors) {
    const els = doc.querySelectorAll(sel);
    els.forEach((el) => {
      const text = (el as HTMLElement).innerText || el.textContent || '';
      if (text.trim()) parts.push(text.trim());
    });
  }

  if (parts.length > 0) return parts.join('\n\n');

  // For listing pages with multiple vacancies
  const cards = doc.querySelectorAll('.vacancy-card, .job_show');
  if (cards.length > 0) {
    const texts: string[] = [];
    cards.forEach((card) => {
      texts.push((card as HTMLElement).innerText || card.textContent || '');
    });
    return texts.join('\n\n---VACANCY_SEPARATOR---\n\n');
  }

  return extractGeneric(doc);
}

function extractTelegram(doc: Document): string {
  // Telegram web view — messages
  const messages = doc.querySelectorAll('.tgme_widget_message_text, .js-message_text');

  if (messages.length > 0) {
    const texts: string[] = [];
    messages.forEach((msg) => {
      const text = (msg as HTMLElement).innerText || msg.textContent || '';
      if (text.trim().length > 50) { // Filter out short non-vacancy messages
        texts.push(text.trim());
      }
    });
    return texts.join('\n\n---VACANCY_SEPARATOR---\n\n');
  }

  return extractGeneric(doc);
}

function extractGeneric(doc: Document): string {
  const body = doc.body;
  if (!body) return '';
  return body.innerText || body.textContent || '';
}

export function truncateText(text: string, maxChars: number = 12000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[...текст обрезан...]';
}
