# A — 작업 정의 기능: AI 세분화 · 블라인드 추정 (김권섭)

[team/README.md](README.md)의 공용 데이터 형태와 원칙을 먼저 읽어주세요. 이 문서는 그 위에서 A가 맡을 것만 다룹니다.

| | 맡는 것 |
|---|---|
| **화면** | AI 세분화 제안 패널, 블라인드 추정 패널 — `public/js/sizing.js` |
| **계산 규칙** | AI 응답 검사(`breakdown`), 추정 요약(`estimate`) |
| **서버 API** | `POST /api/breakdown` · `POST /api/tasks/:id/estimates` · `GET /api/estimates` |
| **공용** | LLM 호출 `src/lib/llm.js`, 공용 스타일 `public/style.css` · [디자인 가이드](DESIGN.md) |

**안 맡는 것:** 부담률 · 담당자 추천과 근거 문장(박지호), 팀원 · 작업 등록과 진행률(우희태)

---

## 이 역할의 핵심 문장

**작업이 "무엇이고 얼마나 큰지"를 정하는 단계를 맡습니다. AI는 제목만 제안하고, 크기는 팀이 정합니다.**

이슈 #4에서 받은 가장 아픈 지적이 "작업량을 누가 어떻게 정하는지가 가장 어렵다"였습니다. 그 답이 블라인드 추정이고 A의 몫입니다. 그리고 이 서비스가 ChatGPT와 다른 점은 "같은 조건이면 항상 같은 결과"이므로, LLM이 시간이나 담당자를 말하기 시작하면 그 차이가 사라집니다.

월계는 처음이라에서 배운 것을 그대로 가져옵니다 — AI가 쓴 문장에서 숫자를 걸러내는 방식은 실패했고, **애초에 숫자가 AI를 통과하지 않게 만드는 방식**이 성공했습니다.

---

## 개발 순서

| 순서 | 할 일 | 기다리는 것 | 완료 기준 |
|---|---|---|---|
| A-0 | `style.css` — 목업의 "공용 스타일" 블록을 옮김 | 없음 | C의 네 페이지(`index` · `board` · `sizing` · `load.html`)가 불러오면 목업과 같은 모양 |
| A-1 | `breakdown.js` + 테스트 | 없음 | 아래 테스트 통과 |
| A-2 | `estimate.js` + 테스트 | 없음 | 아래 테스트 통과 |
| A-3 | `routes/estimates.js` | B의 스캐폴드 · store | 전원 제출 전 응답에 값이 없음 |
| A-4 | 추정 화면 (`sizing.html` 의 `#sizing`) | C의 `sizing.html` 뼈대 · `PATCH /api/tasks/:id` | 제출 → 공개 → 고치기(수정 기록) → 확정까지 눌러짐 (#29 병합) |
| A-5 | `llm.js` + `routes/breakdown.js` | B의 스캐폴드 | 키를 비워도 200 + `fallback` |
| A-6 | 세분화 화면 (`sizing.html` 의 `#breakdown`) | C의 `POST /api/tasks` | AI가 꺼져도 직접 입력으로 등록 |
| A-7 | 실패 경로 점검, 프롬프트 다듬기 | 전체 | 아래 점검표 |

A-1 · A-2는 아무것도 기다리지 않습니다. `package.json` 이 없어도 `node --test` 로 돌아갑니다 (Node 22 이상에서는 `node --test test/` 처럼 폴더를 주면 실패합니다).

**커밋은 표의 한 줄이 한 커밋 이상입니다.** 규칙 · 테스트 · API · 화면을 한 커밋에 섞지 않습니다. 예: `Test: AI 응답 검사 케이스 추가` → `Feat: AI 응답에서 제목 배열만 추출` → `Feat: 세부 작업 제안 API 추가` → `Feat: 세분화 제안 체크박스 화면`.

---

## A-1. `src/lib/breakdown.js` — AI 응답 검사

**파일:** `src/lib/breakdown.js`, `test/breakdown.test.js`

LLM은 시킨 형식을 안 지킵니다. JSON 앞뒤에 말을 붙이고, 번호를 달고, 같은 항목을 두 번 쓰고, "3시간" 같은 숫자를 끼워 넣습니다. 서버가 걸러서 **깨끗한 제목 배열만** 내보냅니다.

```js
// LLM이 돌려준 원문 문자열 → 제목 배열. 못 읽으면 빈 배열.
export function parseSubtasks(raw, parentTitle)
```

| 상황 | 결과 |
|---|---|
| 원문 안에서 첫 `[` 부터 마지막 `]` 까지를 JSON으로 읽는다 | 앞뒤 설명 문장 · 코드 펜스는 무시 |
| JSON이 아니거나 배열이 아니다 | `[]` |
| 문자열이 아닌 원소 | 버린다 |
| 앞뒤 공백, 앞의 번호 · 글머리표 (`1.` `-` `•`) | 떼어낸다 |
| 제목에 섞인 시간 표기 (`(3시간)` · `2h` · `30분`) | 떼어낸다. 크기는 팀이 추정하므로 AI 의 숫자를 남기지 않는다. `10장` · `2주차` 같은 다른 숫자는 그대로. 단위 바로 뒤에 글자가 이어지면(`30분량` · `2시간표`) 단어의 일부라 지우지 않는다 |
| 빈 문자열, 40자 초과 | 버린다 |
| 상위 작업 제목과 같은 것, 서로 중복 | 한 번만 남기고 버린다 |
| 7개 초과 | 앞에서 7개만 |

**먼저 쓸 테스트 — 이게 스펙입니다.**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSubtasks } from '../src/lib/breakdown.js';

test('JSON 배열을 제목 배열로 읽는다', () => {
  assert.deepEqual(parseSubtasks('["발표 자료 제작","발표 대본 작성"]', '발표 준비'),
    ['발표 자료 제작', '발표 대본 작성']);
});
test('앞뒤 설명과 코드 펜스를 무시한다', () => {
  assert.deepEqual(parseSubtasks('네, 제안합니다.\n```json\n["자료 조사"]\n```', '보고서'),
    ['자료 조사']);
});
test('JSON이 아니면 빈 배열', () => {
  assert.deepEqual(parseSubtasks('죄송합니다', '보고서'), []);
});
test('배열이 아니면 빈 배열', () => {
  assert.deepEqual(parseSubtasks('{"a":1}', '보고서'), []);
});
test('문자열이 아닌 원소는 버린다', () => {
  assert.deepEqual(parseSubtasks('["자료 조사", 3, null]', '보고서'), ['자료 조사']);
});
test('번호와 공백을 떼어낸다', () => {
  assert.deepEqual(parseSubtasks('["1. 자료 조사 ", "- 초안 작성"]', '보고서'),
    ['자료 조사', '초안 작성']);
});
test('빈 문자열과 40자 초과는 버린다', () => {
  assert.deepEqual(parseSubtasks(JSON.stringify(['', '가'.repeat(41), '초안 작성']), '보고서'),
    ['초안 작성']);
});
test('중복과 상위 작업 제목은 버린다', () => {
  assert.deepEqual(parseSubtasks('["보고서","초안 작성","초안 작성"]', '보고서'), ['초안 작성']);
});
test('7개까지만 남긴다', () => {
  const raw = JSON.stringify(Array.from({ length: 10 }, (_, i) => `작업 ${i}`));
  assert.equal(parseSubtasks(raw, '보고서').length, 7);
});
test('제목에 섞인 시간 표기는 떼어낸다 — 숫자는 AI 를 거치지 않는다', () => {
  assert.deepEqual(parseSubtasks('["대본 작성 (3시간)","자료 조사 2h","발표 연습 30분","2차 리허설"]', '발표 준비'),
    ['대본 작성', '자료 조사', '발표 연습', '2차 리허설']);
});
test('시간 단위가 단어의 일부면 지우지 않는다', () => {
  assert.deepEqual(parseSubtasks('["30분량 자료 검토","2시간표 비교","3hours","10h작업"]', '보고서'),
    ['30분량 자료 검토', '2시간표 비교', '10h작업']);
});
```

---

## A-2. `src/lib/estimate.js` — 블라인드 추정 요약

**파일:** `src/lib/estimate.js`, `test/estimate.test.js`

```js
// estimates: { 팀원 id: { hours, reason } }
// 전원이 내기 전에는 values · reasons 를 담지 않는다
// wasRevealed: 작업의 estimatesRevealed. 이미 한 번 공개된 작업이면 true
export function estimateSummary(estimates, memberIds, wasRevealed = false)
// → { revealed: false, submittedIds }
// → { revealed: true, submittedIds, values, reasons, median, wideSpread }

// 공개된 뒤의 값을 버전으로 쌓는다. 공개 전(revealed: false)이거나 앞 버전과 값 · 근거가 같으면 history 를 그대로 돌려준다
// by: 이 버전을 만든 팀원 id. 처음 공개(전원 제출)면 null
export function addVersion(history, summary, by, at)
// → [...history, { version, by, at, values, reasons, median }]
```

| 규칙 | |
|---|---|
| 공개 조건 | 현재 팀원 **전원**이 제출했을 때만 `revealed: true`. 팀원이 0명이면 `false` |
| 공개 유지 | 한 번 공개된 작업(`wasRevealed`)은 팀원이 늘어도 `revealed: true` 를 유지한다. 새 팀원의 추정은 내는 즉시 `values` · `median` · `wideSpread` 에 반영 |
| 탈퇴한 팀원의 값 | `memberIds` 에 없는 id 의 추정은 무시 |
| 중앙값 | 짝수 개면 가운데 두 값의 평균 |
| 의견 차이 | 최댓값 ≥ 최솟값 × 2 이면 `wideSpread: true` |
| 근거 | 공개될 때 추정값과 함께 `reasons` 로 나간다. 근거를 적지 않은 사람은 `reasons` 에 넣지 않는다 |
| 수정 기록 (버전) | 처음 공개되는 순간 전원의 값을 **ver 1** 로 남긴다. 공개 뒤 누가 값을 고치면(새 팀원의 첫 제출 포함) 앞 버전은 그대로 두고 **고친 사람과 함께 다음 버전**을 쌓는다. 공개 전의 재제출은 블라인드라 기록하지 않는다 |

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateSummary, addVersion } from '../src/lib/estimate.js';

const e = (hours, reason = "") => ({ hours, reason });

test('전원이 내기 전에는 값을 공개하지 않는다', () => {
  const s = estimateSummary({ m1: e(3) }, ['m1', 'm2']);
  assert.equal(s.revealed, false);
  assert.deepEqual(s.submittedIds, ['m1']);
  assert.equal('values' in s, false);
  assert.equal('median' in s, false);
});
test('전원이 내면 값과 중앙값을 공개한다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(4), m3: e(8) }, ['m1', 'm2', 'm3']);
  assert.equal(s.revealed, true);
  assert.deepEqual(s.values, { m1: 3, m2: 4, m3: 8 });
  assert.equal(s.median, 4);
});
test('짝수 개면 가운데 두 값의 평균', () => {
  assert.equal(estimateSummary({ m1: e(3), m2: e(4) }, ['m1', 'm2']).median, 3.5);
});
test('최댓값이 최솟값의 2배 이상이면 의견 차이가 크다', () => {
  assert.equal(estimateSummary({ m1: e(3), m2: e(6) }, ['m1', 'm2']).wideSpread, true);
});
test('차이가 2배 미만이면 wideSpread 는 false', () => {
  assert.equal(estimateSummary({ m1: e(3), m2: e(4) }, ['m1', 'm2']).wideSpread, false);
});
test('팀원이 없으면 공개하지 않는다', () => {
  assert.equal(estimateSummary({}, []).revealed, false);
});
test('팀에 없는 사람의 추정은 무시한다', () => {
  const s = estimateSummary({ m1: e(3), gone: e(99) }, ['m1']);
  assert.deepEqual(s.values, { m1: 3 });
  assert.equal(s.median, 3);
});
test("공개되면 근거도 함께 나간다", () => {
  const s = estimateSummary({ m1: e(3, "슬라이드 10장 기준"), m2: e(8) }, ["m1", "m2"]);
  assert.deepEqual(s.reasons, { m1: "슬라이드 10장 기준" });
});
test("전원이 내기 전에는 근거도 공개하지 않는다", () => {
  const s = estimateSummary({ m1: e(3, "슬라이드 10장 기준") }, ["m1", "m2"]);
  assert.equal("reasons" in s, false);
});
test('한 번 공개된 뒤에는 새 팀원이 들어와도 공개를 유지한다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(4) }, ['m1', 'm2', 'm3'], true);
  assert.equal(s.revealed, true);
  assert.deepEqual(s.submittedIds, ['m1', 'm2']);
  assert.deepEqual(s.values, { m1: 3, m2: 4 });
  assert.equal(s.median, 3.5);
});
test('공개된 뒤 새 팀원이 내면 바로 반영한다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(4), m3: e(8, '디자인 포함') }, ['m1', 'm2', 'm3'], true);
  assert.deepEqual(s.values, { m1: 3, m2: 4, m3: 8 });
  assert.deepEqual(s.reasons, { m3: '디자인 포함' });
  assert.equal(s.median, 4);
  assert.equal(s.wideSpread, true);
});
test('공개되지 않았으면 버전을 남기지 않는다', () => {
  const s = estimateSummary({ m1: e(3) }, ['m1', 'm2']);
  assert.deepEqual(addVersion([], s, 'm1', 'T1'), []);
});
test('처음 공개되면 ver 1 로 전원의 처음 값을 남긴다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(8, '디자인 포함') }, ['m1', 'm2']);
  assert.deepEqual(addVersion([], s, null, 'T1'), [
    { version: 1, by: null, at: 'T1', values: { m1: 3, m2: 8 }, reasons: { m2: '디자인 포함' }, median: 5.5 },
  ]);
});
test('공개 뒤 수정하면 앞 버전을 두고 수정한 사람의 버전을 쌓는다', () => {
  const v1 = addVersion([], estimateSummary({ m1: e(3), m2: e(8) }, ['m1', 'm2']), null, 'T1');
  const v2 = addVersion(v1, estimateSummary({ m1: e(6), m2: e(8) }, ['m1', 'm2'], true), 'm1', 'T2');
  const v3 = addVersion(v2, estimateSummary({ m1: e(6), m2: e(6) }, ['m1', 'm2'], true), 'm2', 'T3');
  assert.deepEqual(v3.map((v) => [v.version, v.by, v.median]), [[1, null, 5.5], [2, 'm1', 7], [3, 'm2', 6]]);
  assert.deepEqual(v3[0].values, { m1: 3, m2: 8 });
});
```

---

## A-3. `src/routes/estimates.js` — 추정 제출 · 조회

```
POST /api/tasks/:id/estimates   { memberId, hours, reason? }
→ 200 { taskId, estimate }          estimate 는 estimateSummary 결과

GET  /api/estimates
→ 200 { t1: { revealed: false, submittedIds: ["m1"] }, t2: { revealed: true, …, history: [ver 1, ver 2, …] } }   작업 id → 요약
→ 404 { error: '작업을 찾을 수 없습니다.' }
→ 400 { error: '…' }
```

| 검사 | 위반 시 |
|---|---|
| `memberId` 가 실제 팀원 | 400 `누구로 입력하는지 골라 주세요.` |
| `hours` 가 유한한 숫자, 0 초과 1000 이하 | 400 `예상 시간은 0보다 큰 숫자로 입력해 주세요.` |
| `reason` 은 없어도 된다. 있으면 문자열, 공백 제거 후 100자 이하 | 400 `근거는 100자 이내로 적어 주세요.` |
| 작업의 `hours` 가 이미 확정됨 | 400 `이미 크기가 확정된 작업입니다.` |

- 공개 전에는 자기 값과 근거를 다시 내면 조용히 덮어씁니다(기록 없음).
- 공개 뒤에도 크기 확정 전까지는 다시 낼 수 있고, 낼 때마다 `addVersion` 으로 작업의 `estimateHistory` 에 버전이 쌓입니다. 값과 근거가 앞 버전과 같으면 쌓지 않습니다. 공개된 작업의 요약에는 `history` 로 함께 나갑니다.
- 근거는 선택 입력입니다. 강제하면 "그냥"만 채워집니다. 대신 공개 화면에서 근거가 있는 추정이 눈에 띄게 합니다.
- 저장은 B의 `store.load()` / `store.save()` 를 씁니다.
- **추정값은 이 두 API로만 밖에 나갑니다.** 항상 `estimateSummary` 를 거친 요약만 내보내고 원본 `estimates` 는 담지 않습니다. C의 `GET /api/tasks` 는 `estimates` · `estimateHistory` 필드를 아예 빼고 내보냅니다.
- 크기 확정은 새 API를 만들지 않고 C의 `PATCH /api/tasks/:id { hours }` 를 씁니다.

> 로그인이 없으므로 "누가 냈는지"는 화면에서 고른 `memberId` 를 믿습니다. 과제 제한 사항(로그인 금지) 안에서 받아들이는 한계입니다.

---

## A-4. 추정 화면 — `sizing.html` 의 `#sizing` · `public/js/sizing.js`

화면은 홈과 기능별 페이지 네 개로 나뉘어 있습니다. 추정은 **작업 정의 페이지(`sizing.html`)의 `#sizing` 구역에 A가 작업 목록을 직접 그립니다.** C의 작업 카드에 끼워 넣지 않습니다.

- `"data"` 이벤트의 `members` · `tasks` 와 `GET /api/estimates` 를 받아, 작업마다 카드(`.card`) 하나를 그립니다. 이벤트가 올 때마다 `#sizing` 의 `h2` 아래를 통째로 다시 그립니다.
- 순서: 크기 미정 작업을 위에(등록 순서), 크기가 확정된 작업은 그 아래.
- **상위 작업(다른 작업이 `parentId` 로 가리키는 작업)은 목록에 넣지 않습니다.** 시간은 세부 작업에서 추정합니다 — [team/README.md](README.md)의 "상위 작업은 세지 않습니다".
- 카드 머리에는 작업 제목. 세분화로 만든 작업이면 C의 보드와 같은 모양으로 상위 작업을 보조 글자로 적습니다 (`↳ 발표 준비의 세부 작업`). 카드 머리 모양은 [디자인 가이드](DESIGN.md)의 "작업 카드" 를 따릅니다.

| 상태 | 카드 안 |
|---|---|
| `revealed: false` | `1 / 3 제출` 배지 + **제출한 사람 이름만** (`김권섭 님이 제출했습니다. 값은 전원이 낸 뒤 함께 공개됩니다.`) + 입력 줄: `누구의 추정인가요` `<select>` · `예상 시간` · `근거 (선택)` · `추정 제출` |
| `revealed: true`, `hours` 미확정 | 위에서부터 ① 팀원별 추정값과 **근거** (`.est` — 칩 + 이름 · 시간 · 근거, 근거가 없으면 `근거 없음`), `wideSpread` 면 `의견 차이 큼` 빨강 배지 ② 아직 안 낸 팀원이 있으면 `○○ 님은 아직 내지 않았습니다.` ③ **수정 기록** ④ **추정 고치기** 입력 줄 ⑤ 확정 칸 (`median` 을 미리 채움) + `크기 확정` → C의 `PATCH /api/tasks/:id { hours }` |
| `hours` 확정됨 | `4시간 확정` 초록 배지 + 접어 둔 `추정 기록 보기`(최종 값 · 근거 · 마지막 중앙값 · 수정 기록). 입력칸은 그리지 않는다. 추정이 공개된 적 없이 크기가 정해진 작업(보드 임시 크기칸이 있던 때의 데이터 등)은 기록이 없으므로 배지만 |

- **확정 칸과 `크기 확정` 버튼은 `revealed: true` 일 때만 그립니다.** C의 `PATCH` 는 공개 전에도 `hours` 를 받으므로, 블라인드 추정을 건너뛰지 못하게 막는 곳은 이 화면입니다.
- **추정 고치기:** 공개 뒤에도 확정 전까지는 입력 줄 하나를 둡니다. 이미 낸 사람은 여기서 고치고(A-3 대로 버전이 쌓임), 공개 뒤 들어온 새 팀원은 여기서 처음 냅니다(공개 유지 규칙). 안 낸 팀원이 있으면 버튼 글자는 `추정 제출`, 없으면 `추정 고치기` 이고 둘 다 같은 `POST /api/tasks/:id/estimates` 입니다.
- **수정 기록:** `history` 가 2개 이상일 때만 `<details>` 로 접어 `수정 기록 n` 으로 둡니다. 오래된 것부터 한 줄씩 — `ver 1 처음 공개 · 중앙값 4시간 · 11/16 14:05`, `ver 2 김권섭 3 → 5시간 · 중앙값 5시간 · 11/16 14:20`. 바꾼 사람의 값만 적고, 처음 낸 사람은 `– → 5시간`, 값은 같고 근거만 고쳤으면 `5시간 (근거 수정)`. 같은 값 · 근거의 재제출은 서버가 쌓지 않으므로 화면에서 따로 거르지 않습니다.
- **확정 칸:** `type="number"` `min="0.5"` `step="any"`. 중앙값은 3.75 처럼 0.5 단위가 아닐 수 있어서 `step` 을 정하면 브라우저가 미리 채운 값을 잘못됐다고 표시합니다. 빈칸으로 내면 서버는 `null`(크기 미정으로 되돌리기)로 받아 통과시키므로, 화면에서 먼저 `작업 크기는 0보다 큰 숫자로 입력해 주세요.` 를 띄웁니다.
- **오류:** 폼은 `noValidate` — 브라우저 기본 경고 대신 서버의 `error` 문장을 그 폼 아래 `p.msg-error` 에 그대로 띄웁니다(보드와 같게). 요청 중에는 버튼을 `disabled`, 실패해도 입력칸은 비우지 않습니다. `GET /api/estimates` 가 실패하면 `#sizing` 에 `추정 현황을 불러오지 못했습니다.` + 서버 문장.
- 빈 상태: 팀원이 없으면 `팀원을 먼저 등록해 주세요.` 와 `board.html` 링크. 작업이 없으면 `등록된 작업이 없습니다. 위에서 큰 작업을 나누거나 등록 · 진행 화면에서 작업을 추가해 주세요.`
- 근거 입력칸의 안내 문구: "왜 이 시간인가요? 예: 슬라이드 10장 기준". 숫자만 공개되면 차이가 나도 이유를 알 수 없어서 넣는 칸입니다.
- 제출 뒤 시간과 근거 입력칸을 모두 비웁니다. 옆 사람이 내 값을 보지 못하게.
- 데이터가 바뀌어 화면을 다시 그려도 **다른 카드에 입력하던 값은 남깁니다** (처음 채워 둔 값과 달라진 칸만). 미리 채워 둔 확정칸은 손대지 않았으면 새 중앙값으로 바뀝니다.
- 마지막으로 고른 팀원을 `localStorage` 에 기억합니다 (읽기 · 쓰기는 `try/catch`).
- 서버에서 온 이름 · 제목은 **`textContent`** 로 넣습니다. `innerHTML` 을 쓰지 않습니다.
- 데이터를 바꾼 뒤에는 `refresh()`.

---

## A-5. `src/lib/llm.js` · `src/routes/breakdown.js`

```js
// 프롬프트를 보내고 응답 문자열을 돌려준다. 어떤 이유로든 실패하면 null. 절대 throw 하지 않는다.
// generationConfig: 응답 형식을 정할 때만 (세분화는 JSON 문자열 배열)
export async function askLlm(prompt, generationConfig)
```

- Node 내장 `fetch` 를 씁니다. SDK 패키지를 추가하지 않습니다.
- `GEMINI_API_KEY` 가 없으면 호출하지 않고 바로 `null`.
- `AbortSignal.timeout(8000)` 으로 8초 제한. 시간 초과 · 네트워크 오류 · 200이 아닌 응답 · 글자 없는 응답(차단 등) 전부 `null`.
- 요청 형식 (2026-11 [Gemini API 문서](https://ai.google.dev/gemini-api/docs) 기준): `POST https://generativelanguage.googleapis.com/v1beta/models/{모델}:generateContent`, 본문 `{ contents: [{ parts: [{ text }] }], generationConfig }`, 응답 글자는 `candidates[0].content.parts[].text`.
- **키는 `x-goog-api-key` 헤더로만** 보냅니다. 주소(`?key=`)에 넣으면 로그 · 오류 메시지에 남을 수 있습니다.
- 모델은 `GEMINI_MODEL`, 비어 있으면 안정판 경량 모델 `gemini-3.5-flash-lite`. (`gemini-2.5-flash` 는 지원 종료 예정이라 쓰지 않습니다.) 유료 API가 있어야만 동작하면 안 됩니다.
- 세분화 요청은 `generationConfig` 로 `responseMimeType: 'application/json'` + `responseJsonSchema: { type: 'array', items: { type: 'string' } }` 를 붙여 문자열 배열을 받습니다. 그래도 `parseSubtasks` 가 마지막으로 거릅니다.
- 실패 원인은 `console.warn` 으로 남기되(HTTP 상태 · 오류 이름만) **API 키와 응답 본문을 로그에 찍지 않습니다.**
- 테스트(`test/llm.test.js`)는 `fetch` 를 바꿔 끼워 네트워크 없이 실패 경로를 확인합니다 — 키 없음 · 정상 · 키는 헤더로만 · 200 아님 · 시간 초과 · 글자 없음.

**프롬프트 초안**

```
너는 대학생 팀 프로젝트의 작업을 나누는 도우미다.
아래 작업을 3~6개의 세부 작업으로 나눠라.
- 세부 작업의 제목만 쓴다. 각 제목은 20자 이내의 명사형.
- 예상 시간, 담당자, 날짜, 설명은 쓰지 않는다.
- JSON 문자열 배열만 출력한다. 다른 말은 쓰지 않는다.

작업: <사용자가 입력한 제목>
```

**LLM에는 작업 제목만 보냅니다.** 팀원 이름, 가능한 시간, 다른 작업 목록은 보내지 않습니다.

```
POST /api/breakdown   { title }
→ 200 { subtasks: ['발표 자료 제작', ...], source: 'ai' }
→ 200 { subtasks: [], source: 'fallback' }       LLM 실패 · 키 없음 · 응답을 못 읽음
→ 400 { error: '작업 제목을 입력해 주세요.' }     title 이 비었거나 100자 초과
```

- `title` 은 문자열인지, 공백을 뗀 뒤 1~100자인지 검사합니다. 사용자 입력이 LLM으로 나가는 유일한 지점입니다.
- `askLlm` → `parseSubtasks` 순으로 부르고, 결과가 빈 배열이면 `source: 'fallback'`.
- **이 라우트는 작업을 저장하지 않습니다.** 제안만 돌려줍니다.
- 어떤 경우에도 500을 내지 않습니다.

---

## A-6. 세분화 화면 — `sizing.html` 의 `#breakdown` · `public/js/sizing.js`

같은 작업 정의 페이지의 위쪽 구역입니다. C의 작업 등록 폼(`board.html`)과는 다른 페이지라 **큰 작업 제목 입력칸을 A가 직접 둡니다.**

| 상태 | 모양 |
|---|---|
| 처음 | 일반 `.panel`. 큰 작업 제목 입력 + `AI로 나누기` |
| 불러오는 중 | 버튼 `disabled`, 글자 `나누는 중…` |
| 제안 도착 (`source: 'ai'`) | `.panel--ai` 로 바뀌고 `AI 제안` 배지 + **체크박스 목록**(전부 체크된 채로 시작, 빼거나 제목을 고칠 수 있음) + `고른 3개 등록`(primary, 개수 반영). 0개를 고르면 `disabled` |
| 실패 · 키 없음 (`source: 'fallback'`) | 일반 `.panel` 유지 + `직접 입력` 회색 배지 + `AI 제안을 불러오지 못했습니다. 세부 작업을 직접 적어 주세요.` + 빈 입력칸. 오류 화면이 아니라 평소 화면의 한 갈래로 보이게 합니다 |

- **노랑(`.panel--ai`)은 AI가 실제로 제안했을 때만 씁니다.** `sizing.html` 의 `#breakdown` 마크업에는 `panel--ai` 를 달지 않고, `source: 'ai'` 일 때만 `sizing.js` 가 붙입니다. 실패 · 등록 뒤에는 일반 패널로 돌아갑니다.
- 한 줄 = 고르기 체크박스(`.check`) + 고칠 수 있는 제목 입력칸(`.field`). `칸 추가`(quiet)로 줄을 더할 수 있고, 등록 개수는 **체크했고 제목이 비어 있지 않은 줄**만 셉니다. 실패(`fallback`)일 때는 빈 줄 3개로 시작합니다.
- 진한 파란 버튼은 구역에 하나 — 처음에는 `AI로 나누기`, 목록이 열리면 `고른 n개 등록` 이 primary 가 되고 `AI로 나누기` 는 기본 버튼.
- 패널은 처음 한 번만 그립니다. `'data'` 로 다시 그리면 입력하던 제목 · 고른 목록이 지워지기 때문입니다.
- 오류: 제목이 비면 서버의 400 문장(`작업 제목을 입력해 주세요.`)을 폼 아래에. AI 실패는 서버가 200 + `fallback` 으로 주므로 오류가 아니라 `직접 입력` 갈래로 보입니다.
- 등록: 상위 작업을 `POST /api/tasks` 하고, 받은 id 를 `parentId` 로 세부 작업을 각각 `POST /api/tasks` → `refresh()`. 같은 페이지 아래 `#sizing` 에 세부 작업이 바로 나타나 추정으로 이어집니다(상위 작업은 목록에 나오지 않음).
- **등록이 중간에 실패하면 이어서 합니다.** 작업 삭제 API 가 없어 되돌릴 수 없으므로, 만든 상위 작업의 id 를 기억해 두고 등록된 줄은 잠급니다. 버튼은 `남은 n개 등록` 으로 바뀌고, 다시 누르면 **같은 상위 작업 아래에 남은 것만** 등록합니다(상위 작업이 둘 생기지 않음). 안내: `서버에 연결하지 못했습니다. 세부 작업 1개까지 등록했습니다. 다시 누르면 남은 것만 같은 상위 작업 아래에 등록합니다.` 상위 작업을 만드는 단계에서 실패하면 아무것도 생기지 않으므로 오류 문장만 띄웁니다. 실패해도 `refresh()` 해서 이미 등록된 세부 작업은 아래 목록에 보입니다.
- **등록하는 동안에는 잠급니다.** 큰 작업 제목 · `AI로 나누기` · `칸 추가` · 모든 줄 입력을 잠그고, 등록 버튼은 입력이 바뀌어도 다시 켜지지 않습니다(`registering`). 그 사이 다시 나누면 `parentId` 가 지워져 상위 작업이 둘 생기고, 등록 버튼이 다시 켜지면 같은 줄이 두 번 나가기 때문입니다. 끝나면(성공 · 실패 모두) 풀고, 이미 등록된 줄만 계속 잠가 둡니다.
- 패널 아래에 항상 한 줄 고지: `작업 제목만 AI에 보냅니다. 팀원 이름과 시간은 보내지 않습니다.`

---

## A-7. 마무리 점검표

- [ ] `npm test` 에서 A의 테스트 32개가 통과한다
- [ ] `.env` 의 `GEMINI_API_KEY` 를 비우고 서버를 켜도 작업 등록 · 추정 · 추천이 된다
- [ ] 키를 일부러 틀리게 넣어도 `/api/breakdown` 이 200 + `fallback` 을 돌려준다
- [ ] 와이파이를 끄고 눌러도 화면이 멈추지 않는다 (8초 안에 직접 입력으로 넘어감)
- [ ] 한 명만 추정을 낸 상태에서 `GET /api/estimates` 와 `GET /api/tasks` 응답(개발자 도구 네트워크 탭)에 그 값과 근거가 없다
- [ ] 같은 제목을 다섯 번 넣어 응답에 숫자 · 담당자가 섞이지 않는지 본다. 섞이면 프롬프트를 고친다
- [ ] 이상한 입력("ㅁㄴㅇㄹ", 아주 긴 문장, 프롬프트를 무시하라는 문장)에도 제목 배열 아니면 빈 배열만 나온다

## 현재 상태와 마감까지 일정 (11/20 기준)

마감은 **12/3(목)**, 기능 동결은 **11/28(토)** 입니다. 전체 계획 · 정한 규칙 · 근거는 [STATUS.md](https://github.com/Heetaeeee/3oss/blob/kwonseop/status-check/team/STATUS.md) (`kwonseop/status-check` 브랜치)에 있습니다. **(합의 대기)** 표시는 팀 합의 뒤 확정됩니다.

### 완성된 것

| 무엇 | 어디서 |
|---|---|
| AI 응답 검사 `parseSubtasks` (A-1) | #6 |
| 블라인드 추정 요약 · 제출 · 조회 API, 공개 유지 · 수정 버전 기록 (A-2 · A-3) | #10 |
| 추정 화면 — 제출 → 동시 공개 → 크기 확정 (A-4) | #29 |
| LLM 호출 · 세분화 API · 세분화 화면, 키가 없어도 직접 입력 (A-5 · A-6) — **과제 LLM 조건 충족** | #44 |
| 공용 스타일 · 디자인 가이드 · 목업, 상위 작업 규칙 | #5 · #12 · #35 |
| 테스트 **32개** (breakdown 11 · estimate 15 · llm 6) | `main` |
| A-7 실패 경로 점검 — 실제 Google 호출로 기록, AI 제한 시간 15초 | `kwonseop/final-check` (PR 전) |

원래 지침서의 A-1 ~ A-6 은 모두 끝났습니다.

### 남은 것 (개괄)

- **새 요청** — 나눌 작업을 목록에서 고르기(R4), 추정 미완료 · 완료 좌우 분리(R6)
- **입장 코드** — 추정 공개 기준에 정원 반영, 입장 화면, 체험 방, 추정의 "누구" 칸 없애기
- **팀원 삭제 대응** — 삭제로 공개 조건이 채워질 때 공개 기록을 남기는 함수 (C 가 부름)
- **마무리** — A-7 PR 병합, README 정리

### 주차별 할 일

| 주차 | 할 일 | 끝 기준 |
|---|---|---|
| **1주차** 11/19 ~ 11/23 | A-7 점검 PR 병합 (`kwonseop/final-check`) | 점검표 전부 체크 |
| | **R4** 나눌 작업을 목록에서 고르기 — **P1(B) 병합 뒤**. 새 상위 작업을 만들지 않음. 목록이 비면 등록 · 진행으로 안내, 크기 · 담당이 정해진 작업은 경고. A-6 지침서 · DESIGN 같이 수정 | 보드에 같은 작업이 두 번 생기지 않음 |
| | **R6** 추정 미완료 · 완료 좌우 분리 | 넓은 화면 두 칸, 640px 이하 위아래 |
| | 추정 공개 기준에 정원 반영 (`estimateSummary`) + 테스트 | 정원이 차기 전에는 공개 안 됨. 입장 코드가 꺼져 있으면 지금과 같음 |
| | 팀원 삭제 때 공개 처리 순수 함수 + 테스트 | C 의 삭제 라우트가 부를 수 있음 |
| | **입장 화면** `enter.html` · `enter.js` — 코드 입력 · 방 만들기(팀명 · 정원) · 이름 입력 · 체험 방 버튼. 처음 참여 / 기존 팀원 참여 분리 **(합의 대기)** | B 의 API 계약대로 동작, 디자인 가이드대로 |
| | P4 리뷰 (C) | |
| **판단일** 11/24 오전 | 입장 코드 뼈대가 `main` 에 없으면 R1 보류 → 입장 화면 · 체험 방은 하지 않음 | |
| **2주차** 11/24 ~ 11/28 | `estimates` · `breakdown` 라우트를 방 단위로 | |
| | 추정에서 "누구의 추정인가요" 선택칸 없애기 | 입장한 팀원으로 제출. 신원 확인은 보장하지 않음 |
| | **체험 방** `src/routes/demo.js` · `src/lib/demo.js` — 누를 때마다 새 방 복사, 날짜를 오늘 기준으로, 하루 지난 방 지우기 + 테스트 | 두 번 누르면 서로 다른 방, 둘 다 처음 상태 |
| | `seed/demo.json` 틀(첫날) + 작업 정의 부분 | B · C 가 자기 부분을 채울 수 있음 |
| **3주차** 11/29 ~ 12/3 | 11/29 배포 주소 전체 점검 → 11/30 `Fix:` 만 → **12/1 README 정리**(입장 코드 · 새 API · 배포 주소 · 원칙 4 문구), A 지침서 점검표 → 12/2 리허설 · 동결 → 12/3 제출 | |

## 발표에서 시연할 것

"발표 준비"를 AI로 나눠 등록 → 세 명이 추정값 제출(두 번째까지는 값이 안 보임) → 세 번째 제출에 추정값과 근거가 동시 공개 · 의견 차이 표시 → 크기 확정. 마지막으로 API 키를 비운 서버에서 세분화 버튼을 눌러 직접 입력으로 넘어가는 것.

**받을 질문** — "AI가 틀리면요?" → 제목 제안뿐이고 사용자가 골라서 등록한다 / "AI가 꺼지면요?" → 시연으로 보여준다 / "작업량은 누가 정하나요?" → 블라인드 추정.

## 추가 구현 — 지난주 AI 요약 (시간이 남으면)

핵심 기능과 통합이 끝난 뒤에만 시작합니다. 계약은 [team/README.md](README.md)의 "추가 구현" 절에 있습니다.

| 순서 | 할 일 | 기다리는 것 |
|---|---|---|
| A+1 | `src/lib/summary.js` — `parseSummary` · `fallbackSummary` + 테스트 | 없음 |
| A+2 | `src/routes/weekly-summary.js` — `POST /api/weekly/summary` | C의 `completedAt` 기록 |
| A+3 | 요약 한 줄 표시 — `public/js/sizing.js` 또는 새 파일 | C의 주차별 수행률 구역 |

```js
export function parseSummary(raw)            // → 정리된 문자열, 못 쓰면 null
export function fallbackSummary(titles)      // → 고정 문구
```

**먼저 쓸 테스트**

```js
test('앞뒤 공백과 따옴표를 떼어낸다', () => {
  assert.equal(parseSummary(' "발표 자료를 마무리했습니다." '), '발표 자료를 마무리했습니다.');
});
test('빈 응답과 120자 초과는 null', () => {
  assert.equal(parseSummary('   '), null);
  assert.equal(parseSummary('가'.repeat(121)), null);
});
test('문자열이 아니면 null', () => {
  assert.equal(parseSummary(null), null);
});
test('4줄 이상이면 앞의 3줄만 남긴다', () => {
  assert.equal(parseSummary('a\nb\nc\nd'), 'a\nb\nc');
});
test('고정 문구는 건수와 제목을 적는다', () => {
  assert.equal(fallbackSummary(['자료 제작', '대본 작성']), '지난주 완료 2건: 자료 제작, 대본 작성');
});
test('3건을 넘으면 외 n건으로 줄인다', () => {
  assert.equal(fallbackSummary(['a', 'b', 'c', 'd', 'e']), '지난주 완료 5건: a, b, c 외 2건');
});
test('완료한 작업이 없으면 없다고 말한다', () => {
  assert.equal(fallbackSummary([]), '지난주에 완료한 작업이 없습니다.');
});
```

**프롬프트 초안**

```
아래는 대학생 팀이 지난주에 완료한 작업 목록이다.
무엇을 했는지 한 문장(최대 두 문장)으로 요약하라.
- 목록에 없는 내용을 지어내지 않는다.
- 숫자, 날짜, 사람 이름은 쓰지 않는다.
- 요약 문장만 출력한다.

<완료한 작업 제목을 한 줄에 하나씩>
```

- 완료 작업이 0건이면 **LLM을 부르지 않고** 바로 고정 문구를 돌려줍니다.
- `askLlm` 이 `null` 이거나 `parseSummary` 가 `null` 이면 `fallbackSummary`, `source: 'fallback'`. 500을 내지 않습니다.
- 화면에서는 요약을 `textContent` 로 넣고, 옆에 "AI 요약 · 완료 3건"처럼 **서버가 센 건수**를 함께 둡니다.

## 이후 확장 (지금은 만들지 않음)

- 작업 난이도 · 선호 역할을 추천에 반영 (이슈 #4의 "향후 확장")
- LLM이 예상 시간까지 제안 — 블라인드 추정의 취지와 충돌하므로 넣지 않습니다
