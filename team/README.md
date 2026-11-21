# 역할 분담과 일정

제품이 무엇이고 왜 이렇게 설계했는지는 루트의 [README.md](../README.md)를, 브랜치 · 커밋 규칙은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 먼저 읽어주세요.
이 문서는 세 명이 **서로 기다리지 않고** 동시에 작업하기 위한 공용 계약입니다.

## 나누는 원칙 — 기능을 셋으로, 각자 화면부터 서버까지

한 사람이 화면만, 다른 사람이 서버 API만 맡는 식으로 나누지 않습니다.
**앱의 기능을 셋으로 나누고, 각자 자기 기능에 필요한 화면 · 계산 규칙 · 서버 API를 모두 만듭니다.** 최종 발표에서도 각자 자기 기능을 직접 시연합니다.

```mermaid
flowchart LR
    subgraph C["C 우희태 — 등록 · 진행 관리"]
        direction TB
        C1["화면<br/>팀원 등록 · 작업 보드 · 진행 현황"]
        C2["계산 규칙<br/>입력값 검사 · 진행률 · D-day · 완료 작업 비중"]
        C3["서버 API<br/>/api/members · /api/tasks · /api/progress"]
        C1 --- C2 --- C3
    end
    subgraph A["A 김권섭 — 작업 정의"]
        direction TB
        A1["화면<br/>AI 세분화 제안 · 블라인드 추정"]
        A2["계산 규칙<br/>AI 응답 검사 · 추정 요약"]
        A3["서버 API<br/>/api/breakdown · /api/estimates"]
        A1 --- A2 --- A3
    end
    subgraph B["B 박지호 — 분배"]
        direction TB
        B1["화면<br/>부담률 막대 · 담당자 추천 · 배정"]
        B2["계산 규칙<br/>부담률 · 담당자 추천 · 근거 문장"]
        B3["서버 API<br/>/api/loads · /api/recommend"]
        B1 --- B2 --- B3
    end
    C -- 팀원 · 작업이 있어야 --> A
    A -- 작업 크기가 정해져야 --> B
```

사용자가 앱을 쓰는 순서가 곧 기능의 순서입니다 — **등록하고(C) → 무엇을 얼마나 할지 정하고(A) → 누가 할지 나눈다(B)** → 진행 상황을 본다(C).

## 기능 명세

### C 우희태 — 등록 · 진행 관리 기능

> 팀원과 작업을 등록하고, 진행 상황을 숫자로 보여준다.

| | 만드는 것 | 파일 |
|---|---|---|
| **화면** | 팀원 등록 폼 · 목록, 작업 등록 폼 · 작업 보드(상태 · 담당자 · 크기 · 마감일), 진행 현황(진행률 · D-day · 완료 작업 비중) | `public/js/board.js` |
| **계산 규칙** | 입력값 검사, 진행률, D-day, 완료 작업 비중 | `src/lib/validate.js` · `progress.js` |
| **서버 API** | `GET · POST · PATCH /api/members`<br/>`GET · POST · PATCH · DELETE /api/tasks`<br/>`GET /api/progress` | `src/routes/members.js` · `tasks.js` · `progress.js` |
| **테스트** | 44개 | `test/validate.test.js` · `progress.test.js` · `completed-at.test.js` · `tasks-api.test.js` |
| **시연** | 팀원 · 작업 등록 → 잘못된 값에 안내 문장 → 완료 처리 → 진행률 · 완료 작업 비중 변화 | |

### A 김권섭 — 작업 정의 기능

> 큰 작업을 AI로 나누고, 각 작업의 크기를 팀이 함께 정한다.

| | 만드는 것 | 파일 |
|---|---|---|
| **화면** | AI 세분화 제안(체크박스로 골라 등록), 블라인드 추정(시간 · 근거 제출 → 동시 공개 → 크기 확정) | `public/js/sizing.js` |
| **계산 규칙** | AI 응답 검사, 추정 요약(공개 조건 · 중앙값 · 의견 차이 · 근거) | `src/lib/breakdown.js` · `estimate.js` |
| **서버 API** | `POST /api/breakdown` (LLM 호출)<br/>`POST /api/tasks/:id/estimates`<br/>`GET /api/estimates` | `src/routes/breakdown.js` · `estimates.js`, `src/lib/llm.js` |
| **테스트** | 38개 | `test/breakdown.test.js` · `estimate.test.js` · `llm.test.js` |
| **시연** | "발표 준비"를 AI로 나눠 등록 → 세 명이 추정 제출 → 동시 공개 · 의견 차이 → 크기 확정. API 키를 비워도 동작하는 것 | |

### B 박지호 — 분배 기능

> 팀원별 부담률을 계산하고, 새 작업을 누가 맡으면 좋을지 근거와 함께 추천한다.

| | 만드는 것 | 파일 |
|---|---|---|
| **화면** | 부담률 막대(과부하 표시), 담당자 추천 패널(근거 문장 · 예상 부담률 · 배정 버튼) | `public/js/load.js` |
| **계산 규칙** | 작업 부담률, 담당자 추천(제외 · 동률 규칙), 추천 근거 문장 | `src/lib/load.js` · `explain.js` |
| **서버 API** | `GET /api/loads`<br/>`POST /api/recommend` | `src/routes/loads.js` · `recommend.js` |
| **테스트** | 26개 | `test/load.test.js` · `explain.test.js` · `recommend-api.test.js` |
| **시연** | 새 작업에 담당자 추천 → 근거 문장과 예상 부담률 → 배정 → 막대 변화. 가능한 시간 0인 팀원이 제외되는 것 | |

### 공용 뼈대 — 기능이 아니라 바닥

어느 기능에도 속하지 않지만 누군가는 먼저 깔아야 하는 것입니다. 각자의 "기능"으로 세지 않습니다.

| 뼈대 | 담당 | 내용 |
|---|---|---|
| 서버 뼈대 | B | `package.json` · `server.js` · `src/app.js` (빈 라우터 7개 연결) · `src/lib/store.js` (JSON 파일 저장) |
| 화면 뼈대 | C | 홈과 기능별 페이지 `public/index.html` · `board.html` · `sizing.html` · `load.html` (같은 이동 메뉴와 각자의 자리) · `public/js/api.js` |
| 공용 스타일 | A | `public/style.css` (토큰 · 공용 부품), [디자인 가이드](DESIGN.md) · [목업](design-mockup.html) |

이슈 #4의 "역할 분배 설명"은 추천 결과를 설명하는 문장이라 **분배 기능(B)** 에 넣었습니다. 추천과 그 근거가 한 사람의 기능 안에 있어야 "각자 자기 기능의 화면 · 규칙 · API"가 성립합니다.

## 기능 사이의 경계

**남의 함수를 부르지 않습니다.** 기능끼리는 저장된 데이터와 화면의 `'data'` 이벤트로만 만납니다.

| 만나는 곳 | 규칙 |
|---|---|
| 저장 | 서버의 `data/db.json`에 방별로 저장합니다. 전환 중인 기존 라우터는 `load()` · `save()`로 기본 방을 사용하고, 전환한 라우터는 `loadRoom(req.roomCode)` · `saveRoom(req.roomCode, db)`를 사용합니다. 방 기능 전체 전환 전에는 `ROOMS_ENABLED`를 켜지 않습니다 |
| 작업 크기 `hours` | A의 추정 화면이 확정 → C의 `PATCH /api/tasks/:id { hours }` 호출 |
| 담당자 `assigneeId` | B의 추천 화면이 배정 → C의 `PATCH /api/tasks/:id { assigneeId }` 호출 |
| 세부 작업 등록 | A의 세분화 화면이 고른 제목 → C의 `POST /api/tasks { title, parentId }` 호출 |
| 추정값 | C의 작업 응답에는 `estimates` 가 **없습니다.** A의 `GET /api/estimates` 만 요약을 내보냅니다 |
| 화면 갱신 | 누구든 데이터를 바꾸면 `refresh()` → `'data'` 이벤트 → 각자 자기 API를 불러 자기 자리를 다시 그립니다 |
| 상위 작업 | 아래 "상위 작업은 세지 않습니다" — 세 기능이 같은 기준으로 뺍니다 |
| 팀원 삭제와 추정 공개 | **예외 — A 의 함수를 C 가 부릅니다.** C 의 `DELETE /api/members/:id` 가 팀원을 지운 뒤, 작업마다 A 의 `revealAfterMemberRemoved(task, 남은 팀원 id, 지금)` 를 불러 결과(`estimatesRevealed` · `estimateHistory`)를 덮어씁니다. 삭제로 "남은 전원이 냄" 이 채워진 작업에 공개 기록과 ver 1 을 남기기 위해서입니다 (아래 코드) |
| 정원 변경과 추정 공개 | **예외 — B가 A의 공개 처리 함수를 재사용합니다.** 정원 수정 후 등록 인원이 정원과 같을 때만 `revealAfterMemberRemoved()`로 작업별 공개 조건을 다시 검사하고 기록을 저장합니다 |

### 팀원을 지울 때 추정 공개 처리

팀원을 지우면 그 사람이 안 낸 탓에 공개되지 않던 작업이 "남은 전원이 냄" 이 될 수 있습니다. 추정은 제출할 때만 공개를 기록하므로, 지우는 쪽(C)이 A 의 함수로 그 자리에서 기록합니다. 그 사람이 낸 추정은 지우지 않습니다 — 남은 팀원 id 에 없으니 계산에서만 빠집니다.

```js
// src/routes/members.js (C) — DELETE /api/members/:id 안에서, 팀원을 db.members 에서 뺀 뒤
import { revealAfterMemberRemoved } from '../lib/estimate.js';

const ids = db.members.map((m) => m.id);        // 지운 뒤 남은 팀원
const now = new Date().toISOString();
for (const t of db.tasks) Object.assign(t, revealAfterMemberRemoved(t, ids, now));
save(db);
```

- 함수는 원본 작업을 바꾸지 않고 덮어쓸 값만 돌려줍니다. 이미 공개된 작업 · 아직 안 낸 팀원이 남은 작업은 그대로 돌려줍니다.
- 테스트는 A 의 `test/estimate.test.js` 에 있습니다 (공개 · 그대로 · 이미 공개 · 삭제된 사람 값 제외 · 0명 · 원본 그대로).

### 상위 작업은 세지 않습니다

**상위 작업 = 다른 작업이 `parentId` 로 가리키는 작업.** 기준은 이것 하나입니다. 저장된 필드를 따로 두지 않고, 매번 `tasks` 에서 계산합니다.

```js
// 세 기능이 같은 식으로 판단한다 (각자 자기 파일에 둔다 — 남의 함수를 부르지 않는다)
const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
const isParent = (task) => parentIds.has(task.id);
```

"발표 준비"를 "자료 제작 · 대본 작성 · 발표 연습"으로 나누면, 시간과 완료는 세부 작업에서 셉니다. 상위 작업까지 세면 같은 일이 두 번 들어갑니다.

| 기능 | 상위 작업을 빼는 곳 |
|---|---|
| A 작업 정의 | 추정 화면의 작업 목록 (추정 · 확정 대상이 아님) |
| B 분배 | 부담률(`currentHours`), 추천 카드 목록 |
| C 등록 · 진행 | 진행률, 완료 작업 비중, 주차별 수행률, 진행 현황의 건수 · 팀원별 맡은 시간 |

- 작업 보드(C)에는 상위 작업도 그대로 보입니다. 세부 작업의 `↳ 발표 준비의 세부 작업` 표시도 그대로입니다.
- 세부 작업이 없는 작업은 상위 작업이 아닙니다. 지금처럼 추정 · 배정 · 진행률에 모두 들어갑니다.

## 공용 데이터 형태

```js
// 팀원
{
  id: 'm1',
  name: '김권섭',           // 팀원 이름. 학번 · 연락처는 받지 않는다
  availableHours: 10        // 이번 주 가능한 시간(시간). 0 이상의 숫자
}

// 작업
{
  id: 't1',
  title: '발표 자료 제작',
  parentId: null,           // 세분화로 만든 작업이면 상위 작업 id
  status: 'TODO',           // 'TODO' | 'DOING' | 'DONE'
  assigneeId: null,         // 팀원 id 또는 null
  dueDate: '2026-12-01',    // 'YYYY-MM-DD' 또는 null
  hours: null,              // 팀이 확정한 작업 크기(시간). 확정 전에는 null
  estimates: { m1: { hours: 3, reason: '슬라이드 10장 기준' } },  // 서버 안에서만 보관. A만 읽고 쓴다
  estimatesRevealed: false, // 추정이 한 번이라도 공개됐는지. A만 쓴다. 없으면 false 로 본다
  estimateHistory: [],      // 공개 뒤 추정 버전 기록. A만 읽고 쓰고, GET /api/tasks 에서는 뺀다
  createdAt: '2026-11-10T09:00:00.000Z'
}
```

**이 형태와 아래 API 형식을 바꿀 때는 반드시 먼저 공유합니다.**

### 방별 저장 구조와 전환 상태

방 기능의 서버 뼈대는 구현됐지만, 기존 기능 API와 화면의 방별 전환은 진행 전입니다. **전체 전환·통합 검증이 끝날 때까지 `ROOMS_ENABLED`는 0 또는 미설정으로 유지합니다.**

```js
{
  schemaVersion: 1,
  defaultRoom: 'ABC234',
  rooms: {
    ABC234: {
      name: '기존 프로젝트',
      size: 3,
      demo: false,
      members: [],
      tasks: [],
      createdAt: '2026-11-21T00:00:00.000Z'
    }
  }
}
```

- 방 코드는 영문 대문자·숫자 6자리이며 `0`, `O`, `1`, `I`를 제외합니다. 사용자 입력의 앞뒤 공백과 소문자는 정리합니다.
- 방 이름은 공백 제거 후 1~50자, 정원은 1 이상의 안전한 정수입니다.
- 최초 입장은 이름만 받습니다. 팀원 ID는 서버가 생성하고, 가능한 시간은 0으로 시작합니다.
- 같은 방의 중복 이름과 정원 초과 입장은 거절합니다. 서로 다른 방에서는 같은 이름을 사용할 수 있습니다.
- 기존 팀원으로 재입장하는 화면·브라우저 저장 처리는 이번 서버 뼈대에 포함되지 않습니다.
- 방 코드는 공유 공간을 선택하는 수단이며, 개인 신원이나 방장 권한을 인증하지 않습니다.

#### 저장소 함수

| 함수 | 동작 |
|---|---|
| `load()` | 기본 방의 `{ members, tasks }` 반환 |
| `save(db)` | 기본 방의 팀원·작업만 저장하고 방 정보와 다른 방은 보존 |
| `getDefaultRoomCode()` | 기본 방 코드 반환 |
| `loadRoom(code)` | 방 정보와 팀원·작업 반환. 잘못되거나 없는 코드는 `null` |
| `saveRoom(code, room)` | 기존 방을 저장. 생략된 방 정보와 다른 방은 보존. 없는 방은 오류 |
| `createRoom({ name, size })` | 새 방을 저장하고 `{ code, ...room }` 반환 |
| `createStore(filePath)` | 테스트용 독립 저장소 생성 |

저장 위치는 `DATA_DIR`을 따르며, 미설정·빈 값이면 기존 프로젝트의 `data/`를 사용합니다.

기존 `{ members, tasks }` 파일을 처음 읽을 때 원본을 같은 폴더의 `db.json.before-rooms-<고유값>.bak`으로 백업한 후 기본 방으로 이전합니다. 팀원·작업의 기존 필드는 보존합니다. 이미 이전된 파일은 다시 이전하지 않으며, 잘못된 JSON이나 구조는 덮어쓰지 않습니다.

#### 방 코드 검사와 활성화

- `ROOMS_ENABLED=1`일 때만 방 API가 동작합니다. 꺼져 있으면 방 API는 404를 반환합니다.
- `GET /api/config`는 스위치와 관계없이 `{ roomsEnabled: boolean }`을 반환합니다.
- 설정 조회와 방 생성·조회·입장은 공용 방 코드 검사보다 먼저 처리합니다.
- 정원 수정은 `X-Room-Code` 헤더와 URL의 방 코드가 일치해야 합니다.
- 기존 기능 API 앞의 공용 미들웨어는 켜진 상태에서 헤더를 검사하고 `req.roomCode`를 설정합니다. 헤더 누락·형식 오류는 400, 없는 방은 404입니다.
- 꺼진 상태에서는 방 코드 헤더를 무시하고 `req.roomCode`를 기본 방으로 설정합니다.

**주의:** 미들웨어를 통과한다고 기존 API의 데이터가 자동으로 방별 분리되는 것은 아닙니다. 각 라우터의 저장소 호출을 전환해야 합니다.

#### 각 담당자의 후속 작업

| 담당 | 후속 작업 |
|---|---|
| A | 추정·세분화 라우터의 방별 전환, 정원을 반영한 최초 공개 조건, 입장 화면 |
| B | 부담률·추천 라우터의 방별 전환, 전체 전환 후 스위치 활성화·통합 검증 |
| C | 팀원·작업·진행률·주차별 라우터의 방별 전환, 공용 화면의 방 코드 전달·참여 정보 관리 |

정원 변경 API는 등록 인원이 새 정원과 같을 때 공개 조건을 재검사합니다. 정원 미충족 상태의 추정 제출·조회 차단은 A의 후속 전환에서 연결해야 합니다.

기존 라우터의 테스트용 저장소 주입 방식도 새 방별 호출에 맞춰 함께 수정합니다.

## API 형식

오류 응답은 `{ "error": "한국어 안내 문장" }` 형식으로 반환합니다.
화면은 `error` 문장을 그대로 표시합니다.

- 잘못된 입력이나 JSON 형식 오류: 400
- 존재하지 않는 데이터 또는 경로: 404
- 요청 본문 10KB 초과: 413
- 기타 서버 내부 오류: 500

서버 내부 오류의 상세 내용은 서버 로그에만 기록합니다.
응답에는 PC 폴더 경로나 오류 스택 대신 일반 안내 문장을 반환합니다.

| 기능 | 메서드 · 경로 | 요청 본문 | 응답 |
|---|---|---|---|
| 공용 | `GET /api/config` | — | `{ roomsEnabled: boolean }` |
| B | `POST /api/rooms` | `{ name, size }` | `{ code, name, size }` (201) |
| B | `GET /api/rooms/:code` | — | `{ code, name, size, memberCount }` |
| B | `POST /api/rooms/:code/join` | `{ name }` | `Member` (201). 가능한 시간 0, 중복 이름·정원 초과는 400 |
| B | `PATCH /api/rooms/:code` | `{ size }` | `{ code, name, size, memberCount }`. 현재 인원보다 작은 정원은 400. 일치하는 `X-Room-Code` 헤더 필요 |
| C | `GET /api/members` | — | `Member[]` |
| C | `POST /api/members` | `{ name, availableHours }` | `Member` (201) — 같은 이름이 있으면 400 `이미 같은 이름의 팀원이 있습니다.` |
| C | `PATCH /api/members/:id` | `{ name?, availableHours? }` | `Member` — 다른 팀원과 같은 이름이면 400 |
| C | `GET /api/tasks` | — | `Task[]` (`estimates` · `estimateHistory` 필드 없이) |
| C | `POST /api/tasks` | `{ title, dueDate?, parentId? }` | `Task` (201) |
| C | `PATCH /api/tasks/:id` | `{ status?, assigneeId?, hours?, dueDate?, title? }` | `Task` — 추정 공개 전에 `hours` 를 숫자로 보내면 400 (`null` 로 되돌리기는 허용) |
| C | `DELETE /api/tasks/:id` | — | `{ deleted: [id, …] }` — 세부 작업까지 함께 지움, 없으면 404 |
| C | `GET /api/progress` | — | 아래 |
| A | `POST /api/breakdown` | `{ title }` | `{ subtasks: string[], source: 'ai' \| 'fallback' }` |
| A | `POST /api/tasks/:id/estimates` | `{ memberId, hours, reason? }` | `{ taskId, estimate }` |
| A | `GET /api/estimates` | — | `{ [taskId]: estimate }` |
| B | `GET /api/loads` | — | 아래 |
| B | `POST /api/recommend` | `{ taskId }` 또는 `{ hours }` | 아래 |

```js
// C — GET /api/progress
{
  progress: 40,                      // 전체 진행률 %
  doneHoursTotal: 12,                // 완료된 작업의 확정 예상 시간 합
  members: [ { memberId: 'm1', name: '김권섭', doneShare: 50, doneHours: 6 } ]
}

// A — estimate 요약
{ revealed: false, submittedIds: ['m1'] }                       // 전원이 내기 전
{ revealed: true, submittedIds: ['m1','m2','m3'],               // 전원이 낸 뒤
  values: { m1: 3, m2: 4, m3: 8 }, median: 4, wideSpread: true,
  reasons: { m1: '슬라이드 10장 기준', m3: '디자인까지 포함' },
  history: [                                                    // 공개된 뒤의 버전 기록 (오래된 것부터)
    { version: 1, by: null, at: '…', values: { m1: 3, m2: 4, m3: 8 }, reasons: {…}, median: 4 },  // 처음 공개
    { version: 2, by: 'm1', at: '…', values: { m1: 5, m2: 4, m3: 8 }, reasons: {…}, median: 5 }   // m1 이 고침
  ] }
// 한 번 공개된 작업은 팀원이 늘어도 revealed: true 를 유지한다.
// 새 팀원이 아직 안 냈으면 submittedIds · values 에 없고, 내는 즉시 values · median 에 반영된다.
// 공개 뒤 누가 다시 내면 앞 버전은 그대로 두고 다음 버전이 쌓인다. 공개 전의 재제출과 앞 버전과 같은 값은 기록하지 않는다.

// B — GET /api/loads
{
  members: [
    {
      memberId: 'm1',
      name: '김권섭',
      currentHours: 6,
      availableHours: 10,
      load: 60,
      overloaded: false
    }
  ]
}
// currentHours: 맡은 미완료 작업의 확정 시간 합계
// availableHours: 팀원이 입력한 작업 가능 시간
// 가능한 시간이 0이면 load: null

// B — POST /api/recommend
{
  recommendedId: 'm2',               // 후보가 없으면 null
  candidates: [                      // 예상 부담률 오름차순
    { memberId: 'm2', name: '박지호', currentLoad: 30, projectedLoad: 50 },
    { memberId: 'm1', name: '김권섭', currentLoad: 60, projectedLoad: 100 }
  ],
  excluded: [ { memberId: 'm3', name: '우희태', reason: 'NO_AVAILABLE_TIME' } ],
  explanation: '박지호 님이 맡으면 부담률이 30% → 50%로 가장 낮습니다.'
}
```

부담률 · 진행률 · 완료 작업 비중은 **반올림한 정수**로 내려보냅니다.
담당자 추천 순위는 반올림 전 예상 부담률 → 반올림 전 현재 부담률 → 팀원 등록 순서로 정합니다. 응답에 표시하는 부담률은 정수로 반올림하므로 표시값이 같더라도 추천 순서는 다를 수 있습니다.

`POST /api/recommend`에 완료된 작업의 `taskId`를 보내면 400과 `{ error: '완료된 작업은 담당자 추천 대상이 아닙니다.' }`를 반환합니다.

세부 작업이 있는 상위 작업의 `taskId`로 `POST /api/recommend`를 요청하면 400과 `{ error: '상위 작업 대신 세부 작업의 담당자를 추천해 주세요.' }`를 반환합니다.

추천 요청은 작업이나 담당자를 변경하지 않습니다.

## 화면을 나눠 쓰는 법

한 화면에 다 넣지 않고, **홈에서 각자 화면으로 넘어갑니다.** 페이지마다 위쪽 머리말(이동 메뉴)은 같고, 각자 **자기 페이지 · 자기 JS 파일**만 고칩니다.
작업 목록이 필요한 화면(A의 크기 추정, B의 담당자 추천)은 `'data'` 이벤트의 `tasks` 로 자기 화면에 직접 그립니다. 남의 작업 카드 안에 끼워 넣지 않습니다.
색 · 글자 · 부품 · 상태별 모양은 [화면 디자인 가이드](DESIGN.md)와 [목업](design-mockup.html)을 따릅니다.

| 페이지 | 자리 | 채우는 기능 · 파일 |
|---|---|---|
| `index.html` (홈) | 각 화면으로 가는 카드, `#progress` | C · `public/js/board.js` |
| `board.html` (등록 · 진행) | `#task-form` · `#tasks` · `#members` · `#progress` | C · `public/js/board.js` |
| `sizing.html` (작업 정의) | `#breakdown` · `#sizing` | A · `public/js/sizing.js` |
| `load.html` (분배) | `#load` · `#recommend` | B · `public/js/load.js` |

머리말 메뉴를 바꿀 때는 네 페이지를 함께 고칩니다. 페이지를 열면 맨 끝의 `start()` 가 `refresh()` 를 한 번 부릅니다.

```js
// public/js/api.js (C 작성)
export async function api(path, options)   // fetch + JSON + 오류 문장 throw
export async function refresh()            // members · tasks 를 받아 'data' 이벤트 발행

// 각자 파일에서
import { api, refresh } from './api.js';
document.addEventListener('data', async (e) => {
  const { members, tasks } = e.detail;
  // 필요하면 자기 API(/api/progress · /api/estimates · /api/loads)를 부르고 자기 자리만 다시 그린다
});
```

**데이터를 바꾼 뒤에는 항상 `refresh()` 를 부릅니다.** 실시간 통신은 쓰지 않습니다.

## 전원이 지키는 원칙 넷

**1. 숫자는 AI를 거치지 않습니다.** 부담률 · 추천 · 진행률 · 완료 작업 비중은 순수 함수만 계산합니다. LLM은 세부 작업 **제목**만 제안합니다.

**2. AI가 죽어도 나머지는 동작합니다.** `/api/breakdown` 은 실패해도 500을 내지 않고 `{ subtasks: [], source: 'fallback' }` 을 돌려줍니다.

**3. 추천은 참고 자료이고, 결정은 사람이 합니다.** 서버는 담당자를 자동으로 지정하지 않습니다. 작업 크기도 중앙값을 제안할 뿐 팀이 확정합니다.

**4. 개인정보를 받지 않습니다.** 로그인 · 회원가입이 없고, 팀원은 이름과 가능한 시간만 등록합니다. 학번 · 연락처 같은 정보는 받지도, 예시 데이터에 쓰지도 않습니다.

---

## 일정 — 발표를 기준으로 세 구간

> 중간발표 · 최종발표 날짜는 공지에 맞춰 이 줄에 적습니다 → 중간발표: `____` / 최종발표: `____`

```mermaid
flowchart LR
    P0["0. 뼈대<br/>서버 · 화면"] --> P1["1. 중간발표 전<br/>세 기능의 기본 흐름"]
    P1 --> M(["중간발표"])
    M --> P2["2. 중간발표 이후<br/>예외 · 다듬기 · 배포"]
    P2 --> P3["3. 최종발표 전<br/>완성 기준 충족 · 리허설"]
    P3 --> F(["최종발표"])
    P3 -.-> X["시간이 남으면<br/>추가 구현"]
```

### 1. 중간발표 전까지 — 세 기능이 한 흐름으로 이어진다

**목표 장면:** 팀원 3명과 작업을 등록 → 작업 크기를 추정으로 정하고 → 담당자를 추천받아 배정 → 작업을 완료로 바꾸면 부담률 막대와 진행률이 바뀐다.

각자 자기 기능의 **화면 · 계산 규칙 · 서버 API가 하나씩은 끝까지** 돌아가야 합니다. 예외 처리와 모양은 다음 구간으로 미룹니다.

| | 먼저 (뼈대) | 계산 규칙 + 테스트 | 서버 API | 화면 |
|---|---|---|---|---|
| **C 우희태** | 네 페이지 뼈대 · `api.js` | 입력값 검사, 진행률, D-day | `/api/members` · `/api/tasks` · `/api/progress` (진행률만) | 팀원 등록, 작업 보드, 진행률 |
| **A 김권섭** | — | 추정 요약, AI 응답 검사 | `POST · GET` estimates, `POST /api/breakdown` (LLM 호출 + 실패 시 fallback) | 블라인드 추정(제출 → 공개 → 확정), 세분화 제안 목록 |
| **B 박지호** | 스캐폴드 · `store.js` | 부담률, 담당자 추천, 근거 문장 | `/api/loads` · `/api/recommend` | 부담률 막대, 추천 · 배정 패널 |

**순서**

| 순서 | 할 일 | 끝나야 풀리는 것 |
|---|---|---|
| ① | B 스캐폴드 · store, C 화면 뼈대 · `api.js`, A 공용 스타일 — **반나절 안에** | 나머지 전부 |
| ① | 세 명 모두 자기 계산 규칙과 테스트 (아무것도 기다리지 않음) | 각자의 API |
| ② | C `/api/members` · `/api/tasks` + 등록 화면 | A · B가 실제 데이터로 화면을 붙임 |
| ③ | A 추정 API · 화면, B 부담률 · 추천 API · 화면 | 목표 장면 |
| ④ | 모여서 처음부터 끝까지 눌러보기, 중간발표 시연 순서 정하기 | |

**중간발표 전 확인**

- [ ] `npm install` → `npm start` 로 누구 컴퓨터에서나 뜬다
- [ ] `npm test` 가 통과하고, **각자 테스트가 5개 이상**이다
- [ ] 목표 장면이 새로고침 없이 끝까지 이어진다
- [ ] LLM 호출이 서버에서 일어나고, API 키를 비워도 나머지 기능이 동작한다
- [ ] 각자 자기 기능을 1~2분 안에 시연할 수 있다

### 2. 중간발표 이후 — 예외를 막고 다듬는다

중간발표에서 받은 피드백을 먼저 정리해 나눠 갖고, 아래를 채웁니다.

| | 할 일 |
|---|---|
| **C 우희태** | 완료 작업 비중(계산 규칙 · `/api/progress` 확장 · `75% · 6시간 / 8시간` 화면), 지난 작업 표시, 잘못된 입력마다 안내 문장, 허용하지 않은 필드 무시, 휴대폰 폭 · 키보드 조작 |
| **A 김권섭** | 추정 근거 입력과 공개, 의견 차이 표시, 확정된 작업 재제출 차단, LLM 실패 경로(시간 초과 · 이상한 응답 · 이상한 입력), 프롬프트 다듬기, "작업 제목만 전송" 고지 |
| **B 박지호** | 과부하(100% 초과) 표시, 가능한 시간 0 · 동률 · 후보 없음 화면, 이미 배정된 작업을 다시 추천받을 때 중복 계산 방지, 저장 안전(임시 파일 후 rename · 깨진 파일 감지), **무료 플랜 배포** |
| **전원** | 서로의 PR 리뷰, 통합 후 처음부터 끝까지 다시 눌러보기, 각 지침서의 마무리 점검표 |

### 3. 최종발표 전까지 — 완성 기준

아래가 전부 체크돼야 "완성"입니다.

**과제 조건**

- [ ] **화면** — 값을 입력 · 선택하면 결과가 바뀐다 (세 기능 모두)
- [ ] **계산 규칙** — 각자 테스트 5개 이상, `npm test` 전부 통과
- [ ] **서버** — JSON 파일에 저장되고 서버를 껐다 켜도 남는다
- [ ] **LLM 호출** — 서버가 호출하고, 응답이 화면에 제안으로 뜨고, 고른 것이 저장된다. 실패해도 나머지가 동작한다
- [ ] **규모** — 무료 플랜에 배포돼 주소로 접속된다
- [ ] **공개** — `.env` · `data/` 가 저장소에 없고, 학번 · 연락처 같은 정보를 받지 않는다
- [ ] **세 사람의 몫** — 각자 화면 · 계산 규칙 · 서버 API가 있고, 커밋 기록으로 확인된다

**품질**

- [ ] 잘못된 입력에 500이 아니라 안내 문장이 나온다
- [ ] 한 명만 추정을 낸 상태에서 어떤 응답에도 그 값이 없다
- [ ] 이름에 `<b>굵게</b>` 를 넣어도 글자 그대로 보인다
- [ ] 휴대폰 폭에서 깨지지 않는다

**발표 준비**

- [ ] 시연용 데이터를 넣는 순서를 정해 뒀다 (배포 서버는 재배포 때 초기화될 수 있음)
- [ ] 각자 자기 기능 시연을 한 번 이상 리허설했다
- [ ] API 키를 비운 상태의 시연을 준비했다
- [ ] README의 기능 · API · 실행 방법이 실제 코드와 일치한다
- [ ] 예상 질문에 답할 수 있다 — "ChatGPT와 뭐가 다른가", "작업량은 누가 정하나", "AI가 틀리면", "동률이면"

---

## 추가 구현 (시간이 남으면)

**최종발표 전 완성 기준이 전부 체크된 뒤에만** 시작합니다. 여기 손대다가 핵심 기능이 밀리면 안 됩니다. 이것도 기능 단위로 화면 · 규칙 · API를 함께 맡습니다.

| | **주차별 수행률** — C 우희태 | **지난주 AI 요약** — A 김권섭 |
|---|---|---|
| 화면 | 진행 현황에 주별 막대 (`67% · 2건 / 3건`) | 그 위에 요약 한 줄 + "AI 요약 · 완료 3건" |
| 계산 규칙 | `weeklyRates(tasks, today)` | `parseSummary(raw)` · `fallbackSummary(titles)` |
| 서버 API | `GET /api/weekly` | `POST /api/weekly/summary` |

```js
// 작업에 한 줄 추가 — status 가 DONE 으로 바뀔 때 서버가 기록, 되돌리면 null
completedAt: '2026-11-17T10:00:00.000Z'

// GET /api/weekly
{ weeks: [ { weekStart: '2026-11-09', rate: 60, done: 3, total: 5 } ] }   // 월요일 시작, 오래된 주부터

// POST /api/weekly/summary   (본문 없음 — 서버가 지난주 완료 작업을 직접 고른다)
{ text: '발표 자료와 대본을 마무리했습니다.', count: 3, source: 'ai' | 'fallback' }
```

| 규칙 | |
|---|---|
| 주의 기준 | 월요일 시작 ~ 일요일 끝. 날짜 단위로 계산 |
| 수행률 | (그 주에 마감인 작업 중 `DONE` 수 ÷ 그 주에 마감인 작업 수) × 100 반올림 |
| 마감일이 없는 작업 | 수행률에 넣지 않는다 |
| 마감인 작업이 0건인 주 | 목록에 넣지 않는다 |
| 지난주 완료 작업 | `completedAt` 이 지난주 월~일 안에 있는 작업 |
| 요약 검사 | 문자열, 공백 제거 후 1~120자, 최대 3줄. 어긋나면 고정 문구로 |
| 고정 문구 | `지난주 완료 3건: 발표 자료 제작, 대본 작성, 발표 연습` (3건 초과는 `외 n건`). 0건이면 `지난주에 완료한 작업이 없습니다.` — 이 경우 LLM을 부르지 않는다 |

- **숫자는 여전히 AI를 거치지 않습니다.** `count` 와 수행률은 서버가 세고, LLM은 문장만 씁니다.
- LLM에는 **완료한 작업 제목만** 보냅니다. 요청 본문을 받지 않으므로 임의의 글을 LLM으로 보낼 수 없습니다.
- 요약은 **[지난주 요약 보기] 버튼**을 눌렀을 때만 호출합니다 (무료 등급 호출량).

## 파일 소유

| 기능 | 파일 |
|---|---|
| C 등록 · 진행 관리 | `src/lib/validate.js` · `progress.js`<br/>`src/routes/members.js` · `tasks.js` · `progress.js`<br/>`public/js/board.js`<br/>`test/validate.test.js` · `progress.test.js` |
| A 작업 정의 | `src/lib/breakdown.js` · `estimate.js` · `llm.js`<br/>`src/routes/breakdown.js` · `estimates.js`<br/>`public/js/sizing.js`<br/>`test/breakdown.test.js` · `estimate.test.js` |
| B 분배 | `src/lib/load.js` · `explain.js`<br/>`src/routes/loads.js` · `recommend.js`<br/>`public/js/load.js`<br/>`test/load.test.js` · `explain.test.js` |
| 서버 뼈대 (B) | `package.json` · `server.js` · `src/app.js` · `src/lib/store.js` · `.env.example` |
| 방 서버 뼈대 (B) | `src/lib/room.js` · `src/routes/rooms.js` · `src/middleware/room-context.js`<br/>`test/room.test.js` · `store.test.js` · `rooms-api.test.js` · `room-context.test.js` |
| 화면 뼈대 (C) | `public/index.html` · `board.html` · `sizing.html` · `load.html` · `public/js/api.js` |
| 공용 스타일 (A) | `public/style.css` · `team/DESIGN.md` · `team/design-mockup.html` |

남의 파일을 고쳐야 하면 고치기 전에 담당자에게 말하고, **커밋을 따로 냅니다.**

## 테스트

계산·입력 검사 순수 함수와 저장소·API·공용 미들웨어를 Node 내장 테스트 러너로 검증합니다. 저장소·API 테스트는 임시 폴더와 별도 서버를 사용하며 실제 데이터를 변경하지 않습니다. 화면 동작은 별도로 브라우저에서 확인합니다.

방 서버 뼈대 테스트는 44개입니다 — 방 규칙·변환 12개, 저장소 7개, 방 API 18개, 공용 방 코드 검사 7개. 기존 기능 테스트 108개와 합쳐 전체 152개입니다.

각 지침서에 통과해야 할 테스트 케이스가 그대로 적혀 있습니다. **테스트를 먼저 쓰고 실패를 확인한 뒤 구현하세요.**
