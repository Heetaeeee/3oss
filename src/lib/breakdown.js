const MAX_COUNT = 7;
const MAX_LENGTH = 40;
// 앞의 번호(1. 1)) · 글머리표(- • *)
const BULLET = /^\s*(?:\d+[.)]|[-•*])\s*/;

// LLM이 돌려준 원문 문자열 → 제목 배열. 못 읽으면 빈 배열.
export function parseSubtasks(raw, parentTitle) {
  if (typeof raw !== 'string') return [];
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end < start) return [];

  let items;
  try {
    items = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];

  const seen = new Set([String(parentTitle ?? '').trim()]);
  const titles = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const title = item.replace(BULLET, '').trim();
    if (!title || title.length > MAX_LENGTH || seen.has(title)) continue;
    seen.add(title);
    titles.push(title);
    if (titles.length === MAX_COUNT) break;
  }
  return titles;
}
