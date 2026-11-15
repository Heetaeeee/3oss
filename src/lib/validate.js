// 통과하면 { ok: true, value } — value 는 허용된 필드만 담은 깨끗한 객체
// 어긋나면 { ok: false, error } — error 는 화면에 그대로 띄울 한국어 문장

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const text = (max) => (v) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= max;

function isRealDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// 필드마다 [검사, 안내 문장, 필수 여부]. 문자열은 앞뒤 공백을 떼고 담는다.
function check(body, rules, partial) {
  if (body === null || typeof body !== 'object') return { ok: false, error: '요청 내용을 읽을 수 없습니다.' };
  const value = {};
  for (const [field, [isValid, error, required]] of Object.entries(rules)) {
    if (!(field in body) && (partial || !required)) continue;
    const v = body[field];
    if (!isValid(v)) return { ok: false, error };
    value[field] = typeof v === 'string' ? v.trim() : v;
  }
  return { ok: true, value };
}

export function validateMember(body, { partial = false } = {}) {
  return check(body, {
    name: [text(20), '이름은 1~20자로 입력해 주세요.', true],
    availableHours: [(v) => isNum(v) && v >= 0 && v <= 1000, '가능한 시간은 0 이상의 숫자로 입력해 주세요.', true],
  }, partial);
}

export function validateTask(body, { partial = false, memberIds = [], taskIds = [] } = {}) {
  return check(body, {
    title: [text(100), '작업 제목은 1~100자로 입력해 주세요.', true],
    status: [(v) => ['TODO', 'DOING', 'DONE'].includes(v), '상태를 다시 골라 주세요.'],
    assigneeId: [(v) => v === null || memberIds.includes(v), '담당자를 다시 골라 주세요.'],
    parentId: [(v) => v === null || taskIds.includes(v), '상위 작업을 찾을 수 없습니다.'],
    dueDate: [(v) => v === null || isRealDate(v), '마감일은 YYYY-MM-DD 형식으로 입력해 주세요.'],
    hours: [(v) => v === null || (isNum(v) && v > 0 && v <= 1000), '작업 크기는 0보다 큰 숫자로 입력해 주세요.'],
  }, partial);
}
