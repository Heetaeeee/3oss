# B — 나누기: 저장 · 부담률 · 담당자 추천 (박지호)

[team/README.md](README.md)의 공용 데이터 형태와 API 형식을 먼저 읽어주세요. 이 문서는 그 위에서 B가 맡을 것만 다룹니다.

| | 맡는 것 |
|---|---|
| **화면** | 부담률 막대, 담당자 추천 · 배정 패널 — `public/js/load.js` |
| **계산 규칙** | 작업 부담률, 담당자 추천 — `src/lib/load.js` |
| **서버 API** | `POST /api/recommend` · `GET /api/summary` |
| **공용** | Express 스캐폴드, 저장 `src/lib/store.js` |

**안 맡는 것:** AI 세분화 · 추정 · 추천 근거 문장(김권섭), 팀원 · 작업 등록과 진행률(우희태)

---

## 이 역할의 핵심 문장

**이 서비스의 이름값인 "공정한 분배"를 계산하는 곳입니다.**

제안 이슈에서 받은 지적이 "ChatGPT에 물어도 되는 것 아니냐"였습니다. 답은 **저장되고, 자동으로 다시 계산되고, 항상 같은 결과가 나온다**는 것이고, 그 셋이 B의 코드입니다. 예외(가능한 시간 0, 동률)가 테스트로 박혀 있어야 발표에서 "규칙이 뭔가요"에 바로 답할 수 있습니다.

**B의 스캐폴드와 `store.js` 가 팀 전체의 0순위입니다.** 반나절 안에 올려주세요. A와 C의 API가 전부 이 위에 올라갑니다.

---

## 개발 순서

| 순서 | 할 일 | 기다리는 것 | 완료 기준 |
|---|---|---|---|
| B-0 | 스캐폴드 + `store.js` | 없음 | `npm start` 로 `public/index.html` 이 뜨고, `store.load()` 가 빈 상태를 돌려줌 |
| B-1 | `load.js` + 테스트 | 없음 | 아래 테스트 통과 |
| B-2 | `routes/recommend.js` · `summary.js` | C의 members · tasks API (데이터 넣어보기용) | 형식이 [team/README.md](README.md)와 일치 |
| B-3 | 부담률 막대 화면 | C의 `index.html` 뼈대 | 작업을 완료로 바꾸면 막대가 줄어듦 |
| B-4 | 추천 · 배정 화면 | C의 작업 카드 | **1차 목표 장면 완성** |
| B-5 | A · C 함수 연결, 배포 | A의 `explain`, C의 `progress` | 임시 값이 실제 함수로 교체됨 |

**커밋은 표의 한 줄이 한 커밋 이상입니다.** 예: `Chore: Express 스캐폴드와 실행 스크립트 추가` → `Feat: JSON 파일 저장소 추가` → `Test: 부담률 · 추천 케이스 추가` → `Feat: 작업 부담률 계산 추가` → `Feat: 예상 부담률이 가장 낮은 팀원 추천` → `Feat: 담당자 추천 API 추가` → `Feat: 부담률 막대 화면`.

---

## B-0. 스캐폴드 + 저장

```
package.json      "type": "module", scripts: start · test, dependencies: express 만
server.js         app.listen(process.env.PORT ?? 3000)
src/app.js        express.json() · express.static('public') · 라우트 연결. app 을 export
src/routes/       빈 라우터 6개 — members · tasks(C), recommend · summary(B), estimates · breakdown(A)
src/lib/store.js
.env.example      PORT= · GEMINI_API_KEY= · GEMINI_MODEL=
.gitignore        node_modules · .env · data/ 가 들어 있는지 확인
```

```json
"scripts": {
  "start": "node --env-file-if-exists=.env server.js",
  "test": "node --test test/"
}
```

- 의존성은 `express` 하나입니다. `dotenv` · `nodemon` · `cors` 는 넣지 않습니다 (Node 내장 `--env-file`, `--watch` 로 충분하고, 화면을 같은 서버가 제공하므로 CORS가 필요 없습니다). 과제 조건이 메모리 512MB · 무료 플랜입니다.
- `express.json({ limit: '10kb' })` 로 본문 크기를 막습니다.
- **빈 라우터 6개를 미리 연결해 둡니다.** A와 C는 자기 라우터 파일만 채우면 되고 `app.js` 를 건드릴 일이 없어집니다.

### `src/lib/store.js`

```js
export function load()          // → { members: [], tasks: [] }. 파일이 없으면 빈 상태
export function save(db)        // data/db.json 에 기록
export function newId()         // crypto.randomUUID()
```

- `data/db.json` 한 파일에 전부 저장합니다. DB를 붙이지 않습니다 — 팀 하나, 작업 수십 건 규모입니다.
- **쓰기는 임시 파일에 쓴 뒤 `rename`** 합니다. 쓰는 도중 서버가 죽어도 기존 파일이 깨지지 않습니다.
- 파일이 깨져 JSON으로 못 읽으면 조용히 빈 상태로 덮지 말고 **오류를 내고 서버를 멈춥니다.** 데이터를 잃는 것보다 낫습니다.
- 코드에 한 줄 남깁니다: `// shortcut: 단일 프로세스 · 단일 팀 전제의 JSON 파일, 팀이 여러 개가 되거나 동시 쓰기가 늘면 SQLite 로`
- 무료 호스팅은 재배포 때 파일이 초기화될 수 있습니다. 발표 전에 시연 데이터를 다시 넣는 순서를 정해 둡니다.

---

## B-1. `src/lib/load.js` — 부담률 · 추천

**파일:** `src/lib/load.js`, `test/load.test.js`

전부 **순수 함수**입니다. 파일 · 시간 · 네트워크를 건드리지 않습니다.

```js
// 완료되지 않았고 hours 가 확정된, 이 팀원의 작업 시간 합
export function currentHours(memberId, tasks)

// 부담률 %. 가능한 시간이 0 이하면 null
export function loadPercent(hours, availableHours)

// 새 작업(newHours)을 맡겼을 때의 추천.
// → { recommendedId, candidates, excluded }  (team/README.md 의 recommend 응답에서 explanation 을 뺀 것)
export function recommend(members, tasks, newHours)
```

| 함수 | 규칙 |
|---|---|
| `currentHours` | `assigneeId` 가 일치하고 `status !== 'DONE'` 이고 `hours` 가 숫자인 작업만 더한다 |
| `loadPercent` | `Math.round(hours / availableHours * 100)`. `availableHours <= 0` 이면 `null` |
| `recommend` | 가능한 시간이 0 이하인 팀원은 `excluded` 로. 나머지는 `projectedLoad` 오름차순 → `currentLoad` 오름차순 → 원래 등록 순서. 첫 번째가 `recommendedId`. 후보가 없으면 `null` |

**먼저 쓸 테스트 — 이게 스펙입니다.**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentHours, loadPercent, recommend } from '../src/lib/load.js';

const members = [
  { id: 'm1', name: '김권섭', availableHours: 10 },
  { id: 'm2', name: '박지호', availableHours: 10 },
  { id: 'm3', name: '우희태', availableHours: 0 },
];
const t = (o) => ({ id: 'x', status: 'TODO', assigneeId: null, hours: null, dueDate: null, ...o });

test('완료된 작업과 미확정 작업은 현재 작업량에 넣지 않는다', () => {
  const tasks = [
    t({ assigneeId: 'm1', hours: 3 }),
    t({ assigneeId: 'm1', hours: 4, status: 'DONE' }),
    t({ assigneeId: 'm1', hours: null }),
    t({ assigneeId: 'm2', hours: 5 }),
  ];
  assert.equal(currentHours('m1', tasks), 3);
});
test('맡은 작업이 없으면 현재 작업량은 0', () => {
  assert.equal(currentHours('m1', []), 0);
});

test('부담률은 (작업량 ÷ 가능한 시간) × 100', () => {
  assert.equal(loadPercent(6, 10), 60);
  assert.equal(loadPercent(1, 3), 33);
});
test('가능한 시간을 넘으면 100%를 넘는다', () => {
  assert.equal(loadPercent(12, 10), 120);
});
test('가능한 시간이 0이면 부담률은 null', () => {
  assert.equal(loadPercent(5, 0), null);
});

test('예상 부담률이 가장 낮은 팀원을 추천한다', () => {
  const tasks = [t({ assigneeId: 'm1', hours: 6 }), t({ assigneeId: 'm2', hours: 3 })];
  const r = recommend(members, tasks, 2);
  assert.equal(r.recommendedId, 'm2');
  assert.deepEqual(r.candidates.map((c) => [c.memberId, c.currentLoad, c.projectedLoad]),
    [['m2', 30, 50], ['m1', 60, 80]]);
});
test('가능한 시간이 0인 팀원은 추천에서 제외한다', () => {
  const r = recommend(members, [], 2);
  assert.deepEqual(r.excluded, [{ memberId: 'm3', name: '우희태', reason: 'NO_AVAILABLE_TIME' }]);
  assert.ok(!r.candidates.some((c) => c.memberId === 'm3'));
});
test('모두 같으면 먼저 등록된 팀원을 추천한다', () => {
  assert.equal(recommend(members, [], 2).recommendedId, 'm1');
});
test('예상 부담률이 같으면 현재 부담률이 낮은 쪽을 추천한다', () => {
  // b 가 먼저 등록됐지만 현재 부담률은 a 가 낮다. b: 30% → 40%, a: 20% → 40%
  const ms = [{ id: 'b', name: 'B', availableHours: 20 }, { id: 'a', name: 'A', availableHours: 10 }];
  const tasks = [t({ assigneeId: 'b', hours: 6 }), t({ assigneeId: 'a', hours: 2 })];
  assert.equal(recommend(ms, tasks, 2).recommendedId, 'a');
});
test('배정할 수 있는 팀원이 없으면 추천은 null', () => {
  const r = recommend([members[2]], [], 2);
  assert.equal(r.recommendedId, null);
  assert.deepEqual(r.candidates, []);
});
```

---

## B-2. `routes/recommend.js` · `routes/summary.js`

```
POST /api/recommend   { taskId }  → 그 작업의 확정 hours 로 계산
POST /api/recommend   { hours }   → 아직 등록하지 않은 작업을 가정해 계산
```

| 검사 | 위반 시 |
|---|---|
| `taskId` 의 작업이 없음 | 404 `작업을 찾을 수 없습니다.` |
| 그 작업의 `hours` 가 `null` | 400 `작업 크기를 먼저 정해 주세요.` |
| `hours` 가 유한한 숫자가 아니거나 0 이하 · 1000 초과 | 400 `작업 크기는 0보다 큰 숫자로 입력해 주세요.` |
| 둘 다 없음 | 400 |

- `taskId` 로 계산할 때는 **그 작업 자신을 현재 작업량에서 빼고** 계산합니다. 이미 누군가에게 배정된 작업을 다시 추천받을 때 두 번 세지 않게.
- 응답은 `recommend(...)` 결과에 `explanation` 을 붙입니다. A의 `explainRecommendation` 이 생기기 전에는 `''` 로 두고 먼저 머지합니다.
- **이 라우트는 담당자를 바꾸지 않습니다.** 계산만 해서 돌려줍니다. 배정은 화면에서 C의 `PATCH /api/tasks/:id { assigneeId }` 를 부릅니다.

```
GET /api/summary
→ { progress, doneHoursTotal, members: [{ memberId, name, load, overloaded, doneShare, doneHours }] }
```

- `load` 는 `loadPercent(currentHours(...), availableHours)`, `overloaded` 는 `load > 100`.
- `progress` 는 C의 `progressPercent(tasks)` 를 부릅니다. 생기기 전에는 `0`.
- `doneShare` · `doneHours` · `doneHoursTotal` 은 C의 `doneShare(memberId, tasks)` 가 돌려주는 `{ percent, hours, totalHours }` 에서 꺼냅니다. 생기기 전에는 전부 `0`.

---

## B-3. 부담률 막대 — `public/js/load.js`

C가 만든 `index.html` 의 `#load` 자리를 채웁니다. `'data'` 이벤트의 `summary.members` 를 그대로 그립니다. **화면에서 부담률을 다시 계산하지 않습니다.**

| 항목 | 그리는 법 |
|---|---|
| 팀원별 부담률 | 가로 막대. 너비는 `min(load, 100)%`, 숫자는 실제 값 (`120%`) |
| 과부하 (`overloaded`) | 색을 바꾸고 **"과부하" 글자를 함께** 표시. 색만으로 구분하지 않습니다 |
| `load: null` | 막대 없이 "가능한 시간 0 — 배정 불가" |

차트 라이브러리를 쓰지 않습니다. `<div>` 너비로 충분합니다. 이름은 `textContent` 로 넣습니다.

---

## B-4. 추천 · 배정 패널 — 1차 목표 장면

C가 만든 작업 카드의 `[data-slot="recommend"]` 자리에 **[담당자 추천]** 버튼을 넣습니다 → `POST /api/recommend { taskId }`

| 화면 요소 | 내용 |
|---|---|
| 맨 위 한 줄 | 응답의 `explanation` 그대로 |
| 후보 줄 | 이름, `현재 30% → 예상 50%` 와 두 막대, **[배정]** 버튼. 추천된 사람에는 "추천" 글자 표시 |
| 제외된 팀원 | "가능한 시간 0 — 제외" |

- `candidates` 를 **받은 순서 그대로** 그립니다. 화면에서 다시 정렬하지 않습니다.
- **[배정] 버튼은 모든 후보에 있습니다.** 추천은 참고 자료이고 결정은 팀이 합니다. 추천된 사람을 자동으로 넣지 않습니다.
- [배정] → `PATCH /api/tasks/:id { assigneeId }` → `refresh()`.
- 서버가 400을 주면 그 문장을 그대로 띄웁니다 (`작업 크기를 먼저 정해 주세요.`).
- 요청 중에는 버튼을 `disabled`.

---

## B-5. 마무리 점검표

- [ ] `npm test` 에서 B의 테스트 10개가 통과한다
- [ ] 서버를 껐다 켜도 팀원 · 작업이 남아 있다
- [ ] 가능한 시간 0인 팀원이 추천 후보에 나오지 않는다
- [ ] 작업을 `DONE` 으로 바꾸면 **새로고침 없이** 그 팀원의 막대가 줄어든다
- [ ] 추천된 사람이 아닌 다른 사람에게도 배정할 수 있다
- [ ] 이미 배정된 작업을 다시 추천받아도 그 작업이 두 번 세지지 않는다
- [ ] 이상한 본문(문자열 시간, 음수, 없는 id)에 500이 아니라 400 · 404가 난다
- [ ] `explanation` · `progress` · `doneShare` 의 임시 값이 실제 함수로 바뀌었다
- [ ] 무료 플랜에 배포해 주소로 접속된다

## 발표에서 시연할 것

새 작업에 [담당자 추천] → 근거 문장과 예상 부담률 → 추천되지 않은 사람에게도 배정할 수 있음을 보여주고 배정 → 막대 변화. 이어서 한 팀원의 가능한 시간을 0으로 바꿔 추천에서 제외되는 것.

**받을 질문** — "동률이면요?" · "가능한 시간이 0이면요?" · "100%를 넘으면요?" 에 테스트 이름으로 답합니다.
