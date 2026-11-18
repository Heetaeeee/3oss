const MAX_COUNT = 7;
const MAX_LENGTH = 40;
// 앞의 번호(1. 1)) · 글머리표(- • *)
const BULLET = /^\s*(?:\d+[.)]|[-•*])\s*/;
// 제목에 끼어든 시간 표기 (3시간) · 2h · 30분 — 크기는 팀이 추정하므로 AI 의 숫자를 남기지 않는다
const DURATION = /\s*[([]?\s*\d+(?:\.\d+)?\s*(?:시간|분|hours?|hrs?|h(?![a-z]))\s*[)\]]?/gi;

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
    const title = item.replace(BULLET, '').replace(DURATION, '').trim();
    if (!title || title.length > MAX_LENGTH || seen.has(title)) continue;
    seen.add(title);
    titles.push(title);
    if (titles.length === MAX_COUNT) break;
  }
  return titles;
}
