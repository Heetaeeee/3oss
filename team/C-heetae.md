# C — 관리하기: 팀원 · 작업 · 진행률 (우희태)

[team/README.md](README.md)의 공용 데이터 형태와 API 형식을 먼저 읽어주세요. 이 문서는 그 위에서 C가 맡을 것만 다룹니다.

| | 맡는 것 |
|---|---|
| **화면** | 팀원 등록, 작업 보드, 진행률 · D-day · 완료 작업 비중 — `public/js/board.js` |
| **계산 규칙** | 입력값 검사(`validate`), 진행률 · D-day · 완료 작업 비중(`progress`) |
| **서버 API** | `GET · POST · PATCH /api/members`, `GET · POST · PATCH /api/tasks` |
| **공용** | `public/index.html` · `style.css` · `public/js/api.js` |

**안 맡는 것:** 저장소 · 부담률 · 추천(박지호), AI 세분화 · 추정 · 추천 근거 문장(김권섭)

---

## 이 역할의 핵심 문장

**모든 데이터가 들어오는 문이고, 모든 화면이 올라가는 바닥입니다.**

팀원과 작업은 전부 C의 API로 들어옵니다. 여기서 잘못된 값(음수 시간, 빈 제목, 없는 담당자)을 막지 못하면 B의 부담률과 A의 추정이 전부 틀린 숫자를 냅니다. 그리고 A와 B의 화면은 C가 만든 작업 카드 안의 자리에 들어갑니다.

**`index.html` 뼈대와 `api.js` 가 B의 스캐폴드와 함께 0순위입니다.** 반나절 안에 올려주세요.

---

## 개발 순서

| 순서 | 할 일 | 기다리는 것 | 완료 기준 |
|---|---|---|---|
| C-0 | `index.html` 뼈대 + `style.css` + `api.js` | 없음 | 빈 구역과 자리(`data-slot`)가 있고 `refresh()` 가 `'data'` 이벤트를 냄 |
| C-1 | `validate.js` + 테스트 | 없음 | 아래 테스트 통과 |
| C-2 | `progress.js` + 테스트 | 없음 | 아래 테스트 통과 → B에게 연결 요청 |
| C-3 | `routes/members.js` · `tasks.js` | B의 스캐폴드 · store | 형식이 [team/README.md](README.md)와 일치 |
| C-4 | 팀원 등록 · 작업 보드 화면 | C-3 | 새로고침해도 입력한 값이 남음 → A · B에게 알림 |
| C-5 | 진행률 · D-day · 완료 작업 비중 표시 | B의 summary API | 작업을 완료로 바꾸면 숫자가 바뀜 |
| C-6 | 다듬기, 접근성 점검 | 전체 | 아래 점검표 |

**커밋은 표의 한 줄이 한 커밋 이상입니다.** 예: `Feat: 화면 뼈대와 공용 API 호출 함수 추가` → `Test: 입력값 검사 케이스 추가` → `Feat: 팀원 · 작업 입력값 검사 추가` → `Feat: 팀원 등록 API 추가` → `Feat: 작업 등록 · 수정 API 추가` → `Feat: 작업 보드 화면` → `Style: 지난 작업을 색과 글자로 함께 표시`.

---

## C-0. 뼈대 — `index.html` · `api.js`

페이지는 하나입니다. **프레임워크 · 빌드 도구를 쓰지 않습니다.**

```html
<main>
  <section id="members">   <!-- C: 팀원 등록 · 목록 -->
  <section id="load">      <!-- B: 부담률 막대 -->
  <section id="tasks">     <!-- C: 작업 등록 폼 + 보드 -->
    <div id="breakdown">   <!-- A: AI 세분화 -->
  <section id="progress">  <!-- C: 진행률 · 완료 작업 비중 -->
</main>
<script type="module" src="js/board.js"></script>
<script type="module" src="js/load.js"></script>
<script type="module" src="js/sizing.js"></script>
```

작업 카드 하나를 그릴 때 **A와 B의 자리를 비워 둡니다.**

```html
<article class="task" data-task-id="t1">
  <!-- C: 제목 · 상태 · 담당자 · 크기 · D-day -->
  <div data-slot="sizing"></div>      <!-- A: 블라인드 추정 -->
  <div data-slot="recommend"></div>   <!-- B: 담당자 추천 -->
</article>
```

A와 B는 `'data'` 이벤트를 받을 때마다 자기 자리를 다시 채웁니다. 그러니 **C는 카드를 먼저 그린 뒤 이벤트가 나가게** 순서를 지킵니다 — `board.js` 를 `index.html` 에서 가장 먼저 불러오면 됩니다.

### `public/js/api.js`

```js
export async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? '요청을 처리하지 못했습니다.');
  return data;
}

export async function refresh() {
  const [members, tasks, summary] = await Promise.all([
    api('/api/members'), api('/api/tasks'), api('/api/summary'),
  ]);
  document.dispatchEvent(new CustomEvent('data', { detail: { members, tasks, summary } }));
}
```

- 데이터를 바꾸는 모든 동작 뒤에 `refresh()` 를 부릅니다. 부분 갱신을 따로 만들지 않습니다 — 수십 건이라 통째로 다시 그려도 충분합니다.
- 서버 오류 문장은 `alert` 대신 폼 아래 `role="alert"` 영역에 그대로 띄웁니다.
- WebSocket 같은 실시간 통신은 쓰지 않습니다.

### 서버에서 온 글자는 반드시 `textContent` 로

이름과 작업 제목은 사용자가 입력한 값이고, AI가 제안한 제목도 섞입니다. **`innerHTML` 에 넣지 않습니다.** 이름에 `<script>` 를 넣어도 글자로만 보여야 합니다.

---

## C-1. `src/lib/validate.js` — 입력값 검사

**파일:** `src/lib/validate.js`, `test/validate.test.js`

브라우저에서 오는 값은 전부 믿지 않습니다. 검사를 순수 함수로 빼 두면 화면 없이 테스트할 수 있고, 라우트는 얇아집니다.

```js
// 통과하면 { ok: true, value }  — value 는 허용된 필드만 담은 깨끗한 객체
// 어긋나면 { ok: false, error } — error 는 화면에 그대로 띄울 한국어 문장
export function validateMember(body, { partial = false } = {})
export function validateTask(body, { partial = false, memberIds = [], taskIds = [] } = {})
```

| 필드 | 규칙 | 안내 문장 |
|---|---|---|
| `name` | 문자열, 공백 제거 후 1~20자 | `이름은 1~20자로 입력해 주세요.` |
| `title` | 문자열, 공백 제거 후 1~100자 | `작업 제목은 1~100자로 입력해 주세요.` |
| `availableHours` | 유한한 숫자, 0 이상 1000 이하 | `가능한 시간은 0 이상의 숫자로 입력해 주세요.` |
| `hours` | `null` 이거나 유한한 숫자, 0 초과 1000 이하 | `작업 크기는 0보다 큰 숫자로 입력해 주세요.` |
| `status` | `'TODO'` · `'DOING'` · `'DONE'` | `상태를 다시 골라 주세요.` |
| `assigneeId` | `null` 이거나 `memberIds` 안의 값 | `담당자를 다시 골라 주세요.` |
| `parentId` | `null` 이거나 `taskIds` 안의 값 | `상위 작업을 찾을 수 없습니다.` |
| `dueDate` | `null` 이거나 `YYYY-MM-DD` 형식의 **실제 날짜** | `마감일은 YYYY-MM-DD 형식으로 입력해 주세요.` |
| 표에 없는 필드 | `value` 에 담지 않는다 (`id` · `createdAt` · `estimates` 를 덮어쓰지 못하게) | |
| `partial: true` | 없는 필드는 검사하지 않는다 (PATCH 용) | |

**먼저 쓸 테스트 — 이게 스펙입니다.**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMember, validateTask } from '../src/lib/validate.js';

test('이름의 앞뒤 공백을 떼고 통과시킨다', () => {
  assert.deepEqual(validateMember({ name: ' 김권섭 ', availableHours: 10 }),
    { ok: true, value: { name: '김권섭', availableHours: 10 } });
});
test('빈 이름은 거절한다', () => {
  assert.equal(validateMember({ name: '  ', availableHours: 10 }).ok, false);
});
test('가능한 시간 0은 허용한다', () => {
  assert.equal(validateMember({ name: '김권섭', availableHours: 0 }).ok, true);
});
test('음수 · 문자열 · NaN 시간은 거절한다', () => {
  for (const v of [-1, '10', NaN, Infinity, null]) {
    assert.equal(validateMember({ name: '김권섭', availableHours: v }).ok, false, String(v));
  }
});
test('거절할 때는 고칠 점을 문장으로 알려준다', () => {
  assert.match(validateMember({ name: '김권섭', availableHours: -1 }).error, /가능한 시간/);
});
test('PATCH 는 보낸 필드만 검사한다', () => {
  assert.deepEqual(validateMember({ availableHours: 5 }, { partial: true }),
    { ok: true, value: { availableHours: 5 } });
});
test('허용하지 않은 필드는 버린다', () => {
  const r = validateTask({ title: '발표', id: 'hack', estimates: { m1: 1 } });
  assert.deepEqual(r.value, { title: '발표' });
});
test('없는 담당자는 거절한다', () => {
  const r = validateTask({ assigneeId: 'nope' }, { partial: true, memberIds: ['m1'] });
  assert.equal(r.ok, false);
});
test('담당자 해제(null)는 허용한다', () => {
  assert.equal(validateTask({ assigneeId: null }, { partial: true, memberIds: ['m1'] }).ok, true);
});
test('모르는 상태 값은 거절한다', () => {
  assert.equal(validateTask({ status: 'DELETED' }, { partial: true }).ok, false);
});
test('작업 크기 0과 음수는 거절하고 null 은 허용한다', () => {
  assert.equal(validateTask({ hours: 0 }, { partial: true }).ok, false);
  assert.equal(validateTask({ hours: -2 }, { partial: true }).ok, false);
  assert.equal(validateTask({ hours: null }, { partial: true }).ok, true);
});
test('실제로 없는 날짜는 거절한다', () => {
  assert.equal(validateTask({ dueDate: '2026-02-30' }, { partial: true }).ok, false);
  assert.equal(validateTask({ dueDate: '12/01' }, { partial: true }).ok, false);
  assert.equal(validateTask({ dueDate: '2026-12-01' }, { partial: true }).ok, true);
});
```

---

## C-2. `src/lib/progress.js` — 진행률 · D-day · 완료 작업 비중

**파일:** `src/lib/progress.js`, `test/progress.test.js`

전부 **순수 함수**입니다. 오늘 날짜도 인자로 받습니다.

```js
export function progressPercent(tasks)                  // 작업이 0개면 0
export function daysLeft(dueDate, today)                // dueDate 가 null 이면 null. 지났으면 음수
export function doneShare(memberId, tasks)              // → { percent, hours, totalHours }
```

| 함수 | 규칙 |
|---|---|
| `progressPercent` | `DONE` 수 ÷ 전체 수 × 100 반올림. 전체가 0이면 0 |
| `daysLeft` | 두 값 모두 `'YYYY-MM-DD'` 문자열로 받아 날짜 단위로 뺀다. 시 · 분 · 시간대가 끼어들지 않게 `Date.UTC` 로 계산 |
| `doneShare` | `hours` = 내 `DONE` 작업의 `hours` 합, `totalHours` = 전체 `DONE` 작업의 `hours` 합, `percent` = 둘의 비율 × 100 반올림. `totalHours` 가 0이면 `percent` 는 0. `hours` 가 `null` 인 작업은 세지 않는다 |

> **이름이 "완료 작업 비중"가 아닌 이유.** 이 값은 팀이 확정한 **예상 시간**으로 계산합니다. 실제로 걸린 시간이나 결과물의 질은 담지 못하므로 "완료 작업 비중"라고 부르면 숫자가 말하는 것보다 큰 뜻으로 읽힙니다. 화면과 코드 모두 **완료 작업 비중**으로 부릅니다.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressPercent, daysLeft, doneShare } from '../src/lib/progress.js';

const t = (o) => ({ id: 'x', status: 'TODO', assigneeId: null, hours: null, dueDate: null, ...o });

test('진행률은 (완료 수 ÷ 전체 수) × 100', () => {
  assert.equal(progressPercent([t({ status: 'DONE' }), t({}), t({ status: 'DOING' })]), 33);
});
test('작업이 0개면 진행률은 0', () => {
  assert.equal(progressPercent([]), 0);
});
test('전부 완료면 100', () => {
  assert.equal(progressPercent([t({ status: 'DONE' })]), 100);
});

test('D-day 는 날짜 단위로 센다', () => {
  assert.equal(daysLeft('2026-11-13', '2026-11-10'), 3);
  assert.equal(daysLeft('2026-11-10', '2026-11-10'), 0);
  assert.equal(daysLeft('2026-11-08', '2026-11-10'), -2);
});
test('달과 해가 바뀌어도 맞게 센다', () => {
  assert.equal(daysLeft('2026-12-01', '2026-11-30'), 1);
  assert.equal(daysLeft('2027-01-01', '2026-12-31'), 1);
});
test('마감일이 없으면 null', () => {
  assert.equal(daysLeft(null, '2026-11-10'), null);
});

test("완료 작업 비중은 완료한 예상 시간의 비율과 시간을 함께 돌려준다", () => {
  const tasks = [
    t({ assigneeId: 'm1', hours: 6, status: 'DONE' }),
    t({ assigneeId: 'm2', hours: 2, status: 'DONE' }),
    t({ assigneeId: 'm2', hours: 9 }),
  ];
  assert.deepEqual(doneShare("m1", tasks), { percent: 75, hours: 6, totalHours: 8 });
  assert.deepEqual(doneShare("m2", tasks), { percent: 25, hours: 2, totalHours: 8 });
});
test("완료된 작업이 없으면 비중은 0", () => {
  assert.deepEqual(doneShare("m1", []), { percent: 0, hours: 0, totalHours: 0 });
});
test('크기가 정해지지 않은 완료 작업은 세지 않는다', () => {
  const tasks = [t({ assigneeId: 'm1', hours: null, status: 'DONE' })];
  assert.deepEqual(doneShare("m1", tasks), { percent: 0, hours: 0, totalHours: 0 });
});
```

완성되면 **B에게 알려** `routes/summary.js` 의 임시 값 `0` 을 이 함수로 바꾸게 합니다.

---

## C-3. `routes/members.js` · `routes/tasks.js`

형식은 [team/README.md](README.md)의 표 그대로입니다. 라우트는 얇게 — **검사는 `validate.js`, 저장은 B의 `store.js`.**

```js
router.post('/', (req, res) => {
  const v = validateMember(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const db = load();
  const member = { id: newId(), ...v.value };
  db.members.push(member);
  save(db);
  res.status(201).json(member);
});
```

- 없는 id 로 PATCH → 404 `{ error: '팀원을 찾을 수 없습니다.' }`
- 새 작업의 기본값: `status: 'TODO'`, `assigneeId: null`, `hours: null`, `estimates: {}`, `createdAt`
- **`GET /api/tasks` 와 작업을 돌려주는 모든 응답에서 `estimates` 를 빼고 `estimate` 요약을 넣습니다.** A의 `estimateSummary(task.estimates, memberIds)` 를 부릅니다. A의 함수가 생기기 전에는 `{ revealed: false, submittedIds: [] }` 로 둡니다. 원본 `estimates` 가 응답에 새면 블라인드 추정이 성립하지 않습니다.
- 삭제 API는 1차 범위에 넣지 않습니다. 필요해지면 그때 추가합니다.

---

## C-4. 팀원 등록 · 작업 보드 — `public/js/board.js`

**팀원 구역 (`#members`)**

- **이름**, **이번 주 가능한 시간(시간)** (`type="number" min="0" step="0.5"`) → `POST /api/members`
- 입력 칸 아래 안내: **"이름과 가능한 시간만 받습니다. 학번 · 연락처는 적지 마세요. 이 페이지는 공개됩니다."** (과제 제한 사항 — 실제 개인정보 수집 금지)
- 목록에서 가능한 시간 수정 → `PATCH /api/members/:id`
- 가능한 시간의 단위와 기준을 라벨에 적습니다. 사람마다 다르게 이해하면 부담률이 의미를 잃습니다.

**작업 구역 (`#tasks`)**

- 제목, 마감일(`<input type="date">`) → `POST /api/tasks`
- 작업 카드: 제목 · 상태 · 담당자 · 크기 · D-day, 그리고 A · B의 빈 자리
- 상태는 `<select>` 할 일 / 진행 중 / 완료 → `PATCH /api/tasks/:id`
- 담당자도 `<select>` (팀원 목록 + "미정")
- 크기(`hours`)는 숫자 입력 → `PATCH /api/tasks/:id { hours }`. A의 추정 화면이 붙기 전에도 1차 목표 장면이 돌아가게 하는 입력입니다
- 세분화로 만든 작업(`parentId` 있음)은 상위 작업 아래에 들여 씁니다

---

## C-5. 진행률 · D-day · 완료 작업 비중

| 항목 | 그리는 법 |
|---|---|
| 전체 진행률 | `<progress max="100" value="40">` + "40%" 글자. 값은 `summary.progress` |
| D-day | `D-3` · `D-day` · `2일 지남`. 지난 작업은 색과 **글자 둘 다**로 구분 |
| 완료 작업 비중 | 팀원마다 한 줄 — **이름 · 막대 · `75%` · `6시간 / 8시간`**. 값은 `doneShare` · `doneHours` · `summary.doneHoursTotal`. `doneHoursTotal` 이 0이면 "아직 완료된 작업이 없습니다" |

- D-day 는 화면에서 오늘 날짜가 필요합니다. `progress.js` 의 `daysLeft` 와 **같은 방식(날짜 단위)** 으로 계산해 자정 근처에 하루씩 어긋나지 않게 합니다.

**완료 작업 비중은 이렇게 보입니다.**

| 팀원 | 비중 | 완료한 예상 시간 / 전체 |
|---|---|---|
| 김권섭 | ▓▓▓▓▓▓░░ 75% | 6시간 / 8시간 |
| 박지호 | ▓▓░░░░░░ 25% | 2시간 / 8시간 |
| 우희태 | ░░░░░░░░ 0% | 0시간 / 8시간 |

- 제목은 **"완료 작업 비중"**, 바로 아래 한 줄: "완료한 작업의 확정 예상 시간 기준입니다. 실제 걸린 시간과 다를 수 있습니다."
- 퍼센트만 두지 않고 **시간을 항상 함께** 보여줍니다. 75%가 6시간 중인지 60시간 중인지에 따라 뜻이 달라집니다.
- 열 머리글에 단위와 뜻을 적고, 줄마다 같은 문구를 반복하지 않습니다. 휴대폰 폭에서는 막대를 이름 아래 줄로 내립니다.

---

## 접근성 · 기본기

- 모든 입력에 `<label>`. placeholder 를 라벨 대신 쓰지 않습니다
- 버튼은 `<button>`. `div` 에 클릭을 달지 않습니다
- 색만으로 구분하지 않습니다 — 지남 · 완료는 글자나 기호가 함께
- 터치 영역 44px 이상, 본문 16px 이상, 휴대폰 폭(375px)에서 가로 스크롤 없음
- 키보드만으로 등록 → 상태 변경까지 갈 수 있어야 합니다
- 요청이 진행 중인 버튼은 `disabled` — 두 번 눌려 작업이 두 개 생기지 않게

---

## C-6. 마무리 점검표

- [ ] `npm test` 에서 C의 테스트 21개가 통과한다
- [ ] 팀원 3명 · 작업 5개를 넣고 새로고침해도 그대로다
- [ ] 작업을 완료로 바꾸면 **새로고침 없이** 진행률 · 완료 작업 비중가 바뀐다
- [ ] 가능한 시간에 음수 · 빈칸을 넣으면 서버의 안내 문장이 폼 아래에 뜬다
- [ ] 이름에 `<b>굵게</b>` 를 넣으면 글자 그대로 보인다
- [ ] `GET /api/tasks` 응답에 `estimates` 원본이 없다
- [ ] 본문에 `id` · `estimates` 를 넣어 PATCH 해도 바뀌지 않는다
- [ ] A · B의 자리(`data-slot`)가 다시 그릴 때마다 살아 있다
- [ ] 휴대폰 폭에서 깨지지 않는다

## 발표에서 시연할 것

팀원 3명과 작업을 등록 → 가능한 시간에 음수를 넣어 안내 문장 확인 → 작업 하나를 완료로 바꿔 진행률 · 완료 작업 비중가 바뀌는 것 → 마감이 지난 작업의 표시.

**받을 질문** — "잘못된 값을 넣으면요?" → 시연과 `validate` 테스트 / "개인정보는요?" → 이름과 가능한 시간만 받고 로그인이 없다 / "작업이 0개면요?" → 진행률 0%.
