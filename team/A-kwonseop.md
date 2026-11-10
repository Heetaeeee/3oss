# A — 작업 정의 기능: AI 세분화 · 블라인드 추정 (김권섭)

[team/README.md](README.md)의 공용 데이터 형태와 원칙을 먼저 읽어주세요. 이 문서는 그 위에서 A가 맡을 것만 다룹니다.

| | 맡는 것 |
|---|---|
| **화면** | AI 세분화 제안 패널, 블라인드 추정 패널 — `public/js/sizing.js` |
| **계산 규칙** | AI 응답 검사(`breakdown`), 추정 요약(`estimate`) |
| **서버 API** | `POST /api/breakdown` · `POST /api/tasks/:id/estimates` · `GET /api/estimates` |
| **공용** | LLM 호출 `src/lib/llm.js` |

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
| A-1 | `breakdown.js` + 테스트 | 없음 | 아래 테스트 통과 |
| A-2 | `estimate.js` + 테스트 | 없음 | 아래 테스트 통과 |
| A-3 | `routes/estimates.js` | B의 스캐폴드 · store | 전원 제출 전 응답에 값이 없음 |
| A-4 | 추정 화면 | C의 작업 카드 | 제출 → 공개 → 확정까지 눌러짐 |
| A-5 | `llm.js` + `routes/breakdown.js` | B의 스캐폴드 | 키를 비워도 200 + `fallback` |
| A-6 | 세분화 화면 | C의 작업 등록 폼 | AI가 꺼져도 직접 입력으로 등록 |
| A-7 | 실패 경로 점검, 프롬프트 다듬기 | 전체 | 아래 점검표 |

A-1 · A-2는 아무것도 기다리지 않습니다. `package.json` 이 없어도 `node --test test/` 로 돌아갑니다.

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
```

---

## A-2. `src/lib/estimate.js` — 블라인드 추정 요약

**파일:** `src/lib/estimate.js`, `test/estimate.test.js`

```js
// estimates: { 팀원 id: { hours, reason } }
// 전원이 내기 전에는 values · reasons 를 담지 않는다
export function estimateSummary(estimates, memberIds)
// → { revealed: false, submittedIds }
// → { revealed: true, submittedIds, values, reasons, median, wideSpread }
```

| 규칙 | |
|---|---|
| 공개 조건 | 현재 팀원 **전원**이 제출했을 때만 `revealed: true`. 팀원이 0명이면 `false` |
| 탈퇴한 팀원의 값 | `memberIds` 에 없는 id 의 추정은 무시 |
| 중앙값 | 짝수 개면 가운데 두 값의 평균 |
| 의견 차이 | 최댓값 ≥ 최솟값 × 2 이면 `wideSpread: true` |
| 근거 | 공개될 때 추정값과 함께 `reasons` 로 나간다. 근거를 적지 않은 사람은 `reasons` 에 넣지 않는다 |

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateSummary } from '../src/lib/estimate.js';

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
```

---

## A-3. `src/routes/estimates.js` — 추정 제출 · 조회

```
POST /api/tasks/:id/estimates   { memberId, hours, reason? }
→ 200 { taskId, estimate }          estimate 는 estimateSummary 결과

GET  /api/estimates
→ 200 { t1: { revealed: false, submittedIds: ["m1"] }, t2: { revealed: true, … } }   작업 id → 요약
→ 404 { error: '작업을 찾을 수 없습니다.' }
→ 400 { error: '…' }
```

| 검사 | 위반 시 |
|---|---|
| `memberId` 가 실제 팀원 | 400 `누구로 입력하는지 골라 주세요.` |
| `hours` 가 유한한 숫자, 0 초과 1000 이하 | 400 `예상 시간은 0보다 큰 숫자로 입력해 주세요.` |
| `reason` 은 없어도 된다. 있으면 문자열, 공백 제거 후 100자 이하 | 400 `근거는 100자 이내로 적어 주세요.` |
| 작업의 `hours` 가 이미 확정됨 | 400 `이미 크기가 확정된 작업입니다.` |

- 공개 전에는 자기 값과 근거를 다시 내면 덮어씁니다.
- 근거는 선택 입력입니다. 강제하면 "그냥"만 채워집니다. 대신 공개 화면에서 근거가 있는 추정이 눈에 띄게 합니다.
- 저장은 B의 `store.load()` / `store.save()` 를 씁니다.
- **추정값은 이 두 API로만 밖에 나갑니다.** 항상 `estimateSummary` 를 거친 요약만 내보내고 원본 `estimates` 는 담지 않습니다. C의 `GET /api/tasks` 는 `estimates` 필드를 아예 빼고 내보냅니다.
- 크기 확정은 새 API를 만들지 않고 C의 `PATCH /api/tasks/:id { hours }` 를 씁니다.

> 로그인이 없으므로 "누가 냈는지"는 화면에서 고른 `memberId` 를 믿습니다. 과제 제한 사항(로그인 금지) 안에서 받아들이는 한계입니다.

---

## A-4. 추정 화면 — `public/js/sizing.js`

C가 만든 작업 카드의 `[data-slot="sizing"]` 자리를 채웁니다. `"data"` 이벤트가 오면 `GET /api/estimates` 를 받아, 작업마다 요약에 따라 세 가지 모습으로 그립니다.

| 상태 | 화면 |
|---|---|
| `revealed: false` | "누구로 입력하나요" `<select>` + 예상 시간 입력 + **근거 입력(선택, 한 줄)** + [제출]. 아래에 **제출한 사람 이름만** (`2/3명 제출`) |
| `revealed: true`, `hours` 미확정 | 팀원별 추정값과 **근거**를 나란히 (`김권섭 3시간 — 슬라이드 10장 기준`). 근거가 없으면 시간만. `wideSpread` 면 "의견 차이가 큽니다 — 왜 다르게 봤는지 이야기해 보세요". 확정 칸에 `median` 을 기본값으로 채우고 [이 크기로 확정] |
| `hours` 확정됨 | 확정 시간만 |

- 근거 입력칸의 안내 문구: "왜 이 시간인가요? 예: 슬라이드 10장 기준". 숫자만 공개되면 차이가 나도 이유를 알 수 없어서 넣는 칸입니다.
- 제출 뒤 시간과 근거 입력칸을 모두 비웁니다. 옆 사람이 내 값을 보지 못하게.
- 마지막으로 고른 팀원을 `localStorage` 에 기억합니다 (읽기 · 쓰기는 `try/catch`).
- 서버에서 온 이름 · 제목은 **`textContent`** 로 넣습니다. `innerHTML` 을 쓰지 않습니다.
- 데이터를 바꾼 뒤에는 `refresh()`.

---

## A-5. `src/lib/llm.js` · `src/routes/breakdown.js`

```js
// 프롬프트를 보내고 응답 문자열을 돌려준다. 어떤 이유로든 실패하면 null. 절대 throw 하지 않는다.
export async function askLlm(prompt)
```

- Node 20의 내장 `fetch` 를 씁니다. SDK 패키지를 추가하지 않습니다.
- `GEMINI_API_KEY` 가 없으면 호출하지 않고 바로 `null`.
- `AbortSignal.timeout(8000)` 으로 8초 제한. 시간 초과 · 네트워크 오류 · 200이 아닌 응답 전부 `null`.
- 엔드포인트와 요청 형식은 [Gemini API 문서](https://ai.google.dev/gemini-api/docs)에서 **지금 기준으로 확인**하고 씁니다. 무료 등급에서 쓸 수 있는 모델을 `GEMINI_MODEL` 로 고릅니다 (유료 API가 있어야만 동작하면 안 됩니다).
- 실패 원인은 `console.warn` 으로 남기되 **API 키를 로그에 찍지 않습니다.**

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

## A-6. 세분화 화면 — `public/js/sizing.js`

C가 만든 작업 등록 폼 옆 `#breakdown` 자리를 채웁니다.

- **[AI로 세부 작업 나누기]** → `POST /api/breakdown { title }`
- `subtasks` 를 **체크박스 목록**으로 보여줍니다. 전부 체크된 상태로 시작하고, 빼거나 제목을 고칠 수 있습니다.
- [선택한 작업 등록] → 상위 작업을 `POST /api/tasks` 하고, 받은 id 를 `parentId` 로 세부 작업을 각각 `POST /api/tasks` → `refresh()`.
- **`source: 'fallback'` 이면** "지금은 AI 제안을 쓸 수 없어요. 직접 입력해 주세요." 를 띄우고 빈 입력칸을 보여줍니다. 오류 화면이 아니라 평소 화면의 한 갈래로 보이게 합니다.
- 기다리는 동안 버튼을 `disabled` 로 두고 "제안을 만드는 중…" 을 표시합니다.
- 버튼 근처에 한 줄 고지: "작업 제목만 AI로 전송됩니다."

---

## A-7. 마무리 점검표

- [ ] `npm test` 에서 A의 테스트 18개가 통과한다
- [ ] `.env` 의 `GEMINI_API_KEY` 를 비우고 서버를 켜도 작업 등록 · 추정 · 추천이 된다
- [ ] 키를 일부러 틀리게 넣어도 `/api/breakdown` 이 200 + `fallback` 을 돌려준다
- [ ] 와이파이를 끄고 눌러도 화면이 멈추지 않는다 (8초 안에 직접 입력으로 넘어감)
- [ ] 한 명만 추정을 낸 상태에서 `GET /api/estimates` 와 `GET /api/tasks` 응답(개발자 도구 네트워크 탭)에 그 값과 근거가 없다
- [ ] 같은 제목을 다섯 번 넣어 응답에 숫자 · 담당자가 섞이지 않는지 본다. 섞이면 프롬프트를 고친다
- [ ] 이상한 입력("ㅁㄴㅇㄹ", 아주 긴 문장, 프롬프트를 무시하라는 문장)에도 제목 배열 아니면 빈 배열만 나온다

## 발표 기준 일정

전체 일정과 완성 기준은 [team/README.md](README.md#일정--발표를-기준으로-세-구간)에 있습니다. 아래는 A의 몫입니다.

| 구간 | 해야 할 일 | 위 순서 |
|---|---|---|
| **중간발표 전** | 추정 요약 · AI 응답 검사 규칙과 테스트 → 추정 제출 · 조회 API → 추정 화면(제출 → 공개 → 확정) → LLM 호출과 `/api/breakdown`(실패 시 fallback) → 세분화 제안 목록에서 골라 등록 | A-1 ~ A-6 의 기본 흐름 |
| **중간발표 이후** | 추정 근거 입력 · 공개, 의견 차이 표시, 확정된 작업 재제출 차단, LLM 실패 경로 점검(시간 초과 · 이상한 응답 · 이상한 입력), 프롬프트 다듬기, "작업 제목만 전송" 고지 | A-3 ~ A-7 의 나머지 |
| **최종발표 전 완성** | 테스트 18개 통과, 마무리 점검표 전부 체크, API 키를 비운 서버에서의 시연 준비, 시연 리허설 | 마무리 점검표 |
| 시간이 남으면 | 지난주 AI 요약 | 추가 구현 |

**중간발표에서 보여줄 것:** 작업 하나에 세 명이 추정을 내고, 세 번째 제출에 동시 공개되어 크기를 확정하는 것. 그리고 "발표 준비"를 AI로 나눠 등록하는 것.

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
