// A 김권섭 — #breakdown (큰 작업 나누기) · #sizing (크기 추정), sizing.html
// 서버에서 온 글자는 전부 textContent 로만 넣는다. 추정값은 GET /api/estimates 의 요약만 쓴다.
import { api, refresh } from './api.js';

const slot = document.querySelector('#sizing');
const LAST_MEMBER = 'sizing:lastMember';

// el('p', { className: 'sub' }, '글자', 다른요소) — 문자열 자식은 글자로만 들어간다
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

function field(label, input, className = 'field') {
  return el('label', { className }, label, input);
}

// 네트워크 오류(서버에 닿지 못함)는 브라우저 영어 문장(Failed to fetch)이라 바꿔 보여 준다. 서버 오류는 서버 문장 그대로
const messageOf = (error) => (error instanceof TypeError ? '서버에 연결하지 못했습니다.' : error.message);

// 폼은 noValidate — 브라우저 기본 경고 대신 서버의 안내 문장을 폼 아래에 띄운다 (보드와 같게)
// 버튼을 잠근 채 요청 → 성공하면 refresh, 실패하면 서버 문장을 errorBox 에 띄우고 입력칸은 그대로 둔다
async function act(button, errorBox, fn) {
  button.disabled = true;
  errorBox.textContent = '';
  try {
    await fn();
    await refresh();
  } catch (error) {
    errorBox.textContent = messageOf(error);
  } finally {
    button.disabled = false;
  }
}

const nameOf = (members, id) => members.find((m) => m.id === id)?.name ?? '지금은 없는 팀원';

// 칩 색 번호는 팀원 목록 순서 (보드와 같게)
function who(members, id) {
  const i = members.findIndex((m) => m.id === id);
  const n = (i % 6) + 1;
  const chip = el('span', { className: n === 1 ? 'avatar' : `avatar avatar--${n}`, ariaHidden: 'true' }, nameOf(members, id).slice(0, 1));
  return el('span', { className: 'who' }, chip, nameOf(members, id));
}

// 보드(board.js)와 같은 날짜 단위 계산
function daysLeft(dueDate) {
  if (!dueDate) return null;
  const today = new Date().toLocaleDateString('sv-SE');
  const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((utc(dueDate) - utc(today)) / 86_400_000);
}

function rememberedMember() {
  try { return localStorage.getItem(LAST_MEMBER); } catch { return null; }
}
function rememberMember(id) {
  try { localStorage.setItem(LAST_MEMBER, id); } catch { /* 저장 못 해도 고르기만 다시 하면 된다 */ }
}

// ---------- 카드 머리: 보드와 같은 모양 (제목 · 세부 작업 · 배지 순서 마감 → 크기 → 담당) ----------

function cardHead(task, tasks, members) {
  const parent = tasks.find((t) => t.id === task.parentId);
  const d = task.status === 'DONE' ? null : daysLeft(task.dueDate);
  const badges = el('div', { className: 'badges' },
    d === null ? null
      : d < 0 ? el('span', { className: 'badge badge--over' }, `지남 ${-d}일`)
      : el('span', { className: 'badge' }, d === 0 ? 'D-day' : `D-${d}`),
    task.hours == null ? el('span', { className: 'badge badge--todo' }, '크기 미정')
      : el('span', { className: 'badge badge--team' }, `${task.hours}시간 확정`),
    task.assigneeId ? el('span', { className: 'badge badge--team' }, `담당 ${nameOf(members, task.assigneeId)}`)
      : el('span', { className: 'badge badge--todo' }, '담당 미정'));
  return [
    el('h3', {}, task.title),
    parent ? el('p', { className: 'sub' }, `↳ ${parent.title}의 세부 작업`) : null,
    badges,
  ];
}

// ---------- 추정 입력 줄: 누구 · 예상 시간 · 근거 ----------

function estimateForm(task, members, { label, primary, preferIds }) {
  const remembered = rememberedMember();
  const pick = members.some((m) => m.id === remembered) ? remembered : preferIds[0] ?? members[0].id;
  // name 은 다시 그릴 때 입력값을 되살리는 열쇠, default* 는 "사람이 고친 칸"을 가려내는 기준 (fill 참고)
  const memberSelect = el('select', { name: `${task.id}:who` }, ...members.map((m) => el('option', { value: m.id, defaultSelected: m.id === pick }, m.name)));
  const hours = el('input', { name: `${task.id}:hours`, type: 'number', min: '0.5', step: 'any', required: true, inputMode: 'decimal' });
  const reason = el('input', { name: `${task.id}:reason`, maxLength: 100, placeholder: '왜 이 시간인가요? 예: 슬라이드 10장 기준' });
  const button = el('button', { className: primary ? 'btn btn--primary' : 'btn', type: 'submit' }, label);
  const error = el('p', { className: 'msg-error', role: 'alert' });

  const form = el('form', { className: 'stack', noValidate: true },
    el('div', { className: 'row' }, field('누구의 추정인가요', memberSelect), field('예상 시간', hours, 'field field--s')),
    field('근거 (선택)', reason),
    el('div', {}, button),
    error);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    act(button, error, async () => {
      await api(`/api/tasks/${task.id}/estimates`, {
        method: 'POST',
        body: { memberId: memberSelect.value, hours: hours.valueAsNumber, reason: reason.value.trim() || undefined },
      });
      rememberMember(memberSelect.value);
      // 옆 사람이 내 값을 보지 못하게 바로 비운다 (refresh 로 다시 그려지기 전에도)
      hours.value = '';
      reason.value = '';
    });
  });
  return form;
}

// ---------- ① 제출 받는 중: 누가 냈는지만 ----------

function hiddenSlot(task, members, summary) {
  const done = summary.submittedIds;
  const notYet = members.filter((m) => !done.includes(m.id)).map((m) => m.id);
  return el('div', { className: 'slot stack' },
    el('div', { className: 'between' }, el('h3', {}, '크기 추정'),
      el('span', { className: 'badge' }, `${done.length} / ${members.length} 제출`)),
    el('p', { className: 'sub' }, done.length
      ? `${done.map((id) => nameOf(members, id)).join(', ')} 님이 제출했습니다. 값은 전원이 낸 뒤 함께 공개됩니다.`
      : '아직 아무도 내지 않았습니다. 값은 전원이 낸 뒤 함께 공개됩니다.'),
    estimateForm(task, members, { label: '추정 제출', primary: true, preferIds: notYet }));
}

// ---------- ② 공개: 값 · 근거 · 수정 기록 · 고치기 · 확정 ----------

const fmtTime = (iso) => {
  const t = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
};

function historyRows(members, history) {
  return history.map((v, i) => {
    if (i === 0 || !v.by) return el('li', {}, `ver ${v.version} 처음 공개 · 중앙값 ${v.median}시간 · ${fmtTime(v.at)}`);
    const before = history[i - 1].values[v.by];
    const after = v.values[v.by];
    const change = before === after ? `${after}시간 (근거 수정)` : `${before ?? '–'} → ${after}시간`;
    return el('li', {}, `ver ${v.version} ${nameOf(members, v.by)} ${change} · 중앙값 ${v.median}시간 · ${fmtTime(v.at)}`);
  });
}

function historyList(members, history) {
  if (!history || history.length < 2) return null;
  return el('details', {},
    el('summary', {}, `수정 기록 ${history.length}`),
    el('ol', { className: 'stack sub' }, ...historyRows(members, history)));
}

// 팀원별 값 · 근거 (칩 + 이름 · 시간 · 근거)
function estList(members, summary) {
  return el('div', { className: 'est' }, ...summary.submittedIds.flatMap((id) => [
    who(members, id),
    el('strong', {}, `${summary.values[id]}시간`),
    el('span', { className: 'sub' }, summary.reasons[id] ?? '근거 없음'),
  ]));
}

function confirmForm(task, median) {
  const hours = el('input', { name: `${task.id}:confirm`, type: 'number', min: '0.5', step: 'any', required: true, defaultValue: String(median), inputMode: 'decimal' });
  const button = el('button', { className: 'btn btn--primary', type: 'submit' }, '크기 확정');
  const error = el('p', { className: 'msg-error', role: 'alert' });
  const form = el('form', { className: 'stack', noValidate: true },
    el('div', { className: 'row' }, field('확정 크기(시간)', hours, 'field field--s'), button),
    el('p', { className: 'sub' }, `중앙값인 ${median}시간을 미리 넣어 두었습니다. 이야기해 보고 바꿔도 됩니다.`),
    error);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // 빈칸은 null 로 나가는데, 서버는 null 을 "크기 미정으로 되돌리기"로 받아 아무 안내 없이 통과시킨다
    if (!Number.isFinite(hours.valueAsNumber)) {
      error.textContent = '작업 크기는 0보다 큰 숫자로 입력해 주세요.';
      return;
    }
    act(button, error, () => api(`/api/tasks/${task.id}`, { method: 'PATCH', body: { hours: hours.valueAsNumber } }));
  });
  return form;
}

function revealedSlot(task, members, summary) {
  const notYet = members.filter((m) => !summary.submittedIds.includes(m.id)).map((m) => m.id);
  return el('div', { className: 'slot stack' },
    el('div', { className: 'between' }, el('h3', {}, '크기 추정'),
      summary.wideSpread ? el('span', { className: 'badge badge--over' }, '의견 차이 큼') : null),
    estList(members, summary),
    notYet.length ? el('p', { className: 'sub' }, `${notYet.map((id) => nameOf(members, id)).join(', ')} 님은 아직 내지 않았습니다.`) : null,
    historyList(members, summary.history),
    // 이미 낸 사람은 고치고(버전이 쌓인다), 공개 뒤 들어온 사람은 여기서 처음 낸다
    estimateForm(task, members, { label: notYet.length ? '추정 제출' : '추정 고치기', primary: false, preferIds: notYet }),
    // 확정칸은 공개된 뒤에만 — 서버(C 의 PATCH, P4)도 공개 전 hours 를 400 으로 거절하고, 화면은 애초에 확정칸을 그리지 않는다
    confirmForm(task, summary.median));
}

// ---------- ③ 확정 뒤: 배지 + 접어 둔 추정 기록 ----------

function recordDetails(members, summary) {
  // 보드에서 크기를 바로 정한 작업처럼 추정이 공개된 적 없으면 보여 줄 기록이 없다
  if (!summary?.revealed) return null;
  const history = summary.history ?? [];
  return el('details', { className: 'slot' },
    el('summary', {}, '추정 기록 보기'),
    el('div', { className: 'stack' },
      estList(members, summary),
      el('p', { className: 'sub' }, `마지막 중앙값 ${summary.median}시간${summary.wideSpread ? ' · 의견 차이 큼' : ''}`),
      history.length >= 2 ? el('ol', { className: 'stack sub' }, ...historyRows(members, history)) : null));
}

// ---------- 전체 ----------

function card(task, tasks, members, summary) {
  return el('article', { className: 'card stack' },
    ...cardHead(task, tasks, members),
    task.hours != null ? recordDetails(members, summary)
      : summary?.revealed ? revealedSlot(task, members, summary) : hiddenSlot(task, members, summary ?? { submittedIds: [] }));
}

// 사람이 고친 칸 = 처음 채워 둔 값(defaultValue · defaultSelected)과 달라진 칸
const isEdited = (f) => (f.tagName === 'SELECT' ? !f.selectedOptions[0]?.defaultSelected : f.value !== f.defaultValue);

// 다시 그려도 다른 카드에 입력하던 값은 남긴다. 제출한 카드의 칸은 제출 직후 비웠으므로 되살아나지 않는다
function fill(...nodes) {
  const edited = [...slot.querySelectorAll('[name]')].filter(isEdited).map((f) => [f.name, f.value]);
  slot.replaceChildren(slot.querySelector('h2'), ...nodes);
  for (const [name, value] of edited) {
    const f = slot.querySelector(`[name="${CSS.escape(name)}"]`);
    // 고르던 팀원이 목록에서 사라졌으면 되살리지 않는다
    if (f && (f.tagName !== 'SELECT' || [...f.options].some((o) => o.value === value))) f.value = value;
  }
}

if (slot) {
  document.addEventListener('data', async (e) => {
    const { members, tasks } = e.detail;
    if (!members.length) {
      fill(el('p', { className: 'sub' }, '팀원을 먼저 등록해 주세요. ', el('a', { href: 'board.html' }, '등록 · 진행 화면으로')));
      return;
    }
    if (!tasks.length) {
      fill(el('p', { className: 'sub' }, '등록된 작업이 없습니다. 위에서 큰 작업을 나누거나 등록 · 진행 화면에서 작업을 추가해 주세요.'));
      return;
    }
    let summaries;
    try {
      summaries = await api('/api/estimates');
    } catch (error) {
      fill(el('p', { className: 'msg-error', role: 'alert' }, `추정 현황을 불러오지 못했습니다. ${messageOf(error)}`));
      return;
    }
    // 상위 작업(다른 작업이 parentId 로 가리키는 작업)은 세부 작업에서 추정하므로 목록에서 뺀다 — team/README "상위 작업은 세지 않습니다"
    const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
    const own = tasks.filter((t) => !parentIds.has(t.id));
    // 크기 미정 작업이 위(등록 순서), 확정된 작업이 아래
    const ordered = [...own.filter((t) => t.hours == null), ...own.filter((t) => t.hours != null)];
    // shortcut: 카드를 통째로 다시 그리고 입력값만 되살린다 — 커서 위치 · 펼친 수정 기록은 닫힌다. 불편하면 바뀐 카드만 갱신
    fill(...ordered.map((t) => card(t, tasks, members, summaries[t.id])));
  });
}

// ---------- #breakdown: 큰 작업 나누기 (AI 제안 → 골라서 등록) ----------
// 처음 한 번만 그린다 — 'data' 로 다시 그리면 입력하던 제목 · 고른 목록이 지워진다

const breakdown = document.querySelector('#breakdown');
if (breakdown) {
  const badgeBox = el('span');
  const title = el('input', { maxLength: 100, placeholder: '예: 발표 준비' });
  const splitButton = el('button', { className: 'btn btn--primary', type: 'submit' }, 'AI로 나누기');
  const splitError = el('p', { className: 'msg-error', role: 'alert' });
  const splitForm = el('form', { className: 'stack', noValidate: true },
    el('div', { className: 'row' }, field('나눌 작업 제목', title), splitButton),
    splitError);

  const notice = el('p', { className: 'sub' });
  const list = el('div', { className: 'stack' });
  const addRow = el('button', { className: 'btn btn--quiet', type: 'button' }, '칸 추가');
  const registerButton = el('button', { className: 'btn btn--primary', type: 'button', disabled: true }, '고른 0개 등록');
  const registerError = el('p', { className: 'msg-error', role: 'alert' });
  const picks = el('div', { className: 'stack', hidden: true },
    notice, list, el('div', { className: 'between' }, addRow, registerButton), registerError);

  breakdown.replaceChildren(
    el('div', { className: 'between' }, breakdown.querySelector('h2'), badgeBox),
    splitForm,
    picks,
    el('p', { className: 'sub' }, '작업 제목만 AI에 보냅니다. 팀원 이름과 시간은 보내지 않습니다.'));

  // 세부 작업 등록이 중간에 실패하면 만든 상위 작업을 기억해 두고, 다시 누를 때 같은 상위 작업 아래에 남은 것만 등록한다
  // (작업 삭제 API 가 없어 되돌릴 수 없으므로 이어서 한다)
  let parentId = null;
  // 등록하는 동안(요청 사이 await) 입력 · 다시 나누기 · 두 번째 등록을 막는다 — 그 사이 parentId 가 지워지거나 같은 줄이 두 번 나가지 않게
  let registering = false;
  const textOf = (r) => r.querySelector('input[type="text"]').value.trim();
  // 등록할 칸 = 아직 등록 안 됐고, 체크했고, 제목이 비어 있지 않은 칸
  const pendingRows = () => [...list.children]
    .filter((r) => !r.dataset.done && r.querySelector('input[type="checkbox"]').checked && textOf(r));
  const updateCount = () => {
    const n = pendingRows().length;
    registerButton.textContent = parentId ? `남은 ${n}개 등록` : `고른 ${n}개 등록`;
    registerButton.disabled = registering || n === 0;
  };
  const setRegistering = (on) => {
    registering = on;
    for (const c of [title, splitButton, addRow]) c.disabled = on;
    // 이미 등록된 줄은 계속 잠가 둔다
    for (const r of list.children) if (!r.dataset.done) r.querySelectorAll('input').forEach((i) => { i.disabled = on; });
    updateCount();
  };
  // 한 줄 = 고르기 체크박스 + 고칠 수 있는 제목
  const row = (value = '') => el('div', { className: 'row' },
    el('label', { className: 'check' }, el('input', { type: 'checkbox', checked: true, ariaLabel: '이 세부 작업 등록' })),
    el('label', { className: 'field' }, el('input', { type: 'text', value, maxLength: 100, ariaLabel: '세부 작업 제목', placeholder: '예: 대본 작성' })));
  list.addEventListener('input', updateCount);
  list.addEventListener('change', updateCount);
  addRow.addEventListener('click', () => {
    list.append(row());
    updateCount();
    list.lastChild.querySelector('input[type="text"]').focus();
  });

  // 노랑은 AI 가 실제로 제안했을 때만 — 처음 · 실패 · 등록 뒤에는 일반 패널
  function show(source, subtasks) {
    parentId = null; // 새로 나누거나 등록을 마치면 이어 하던 상위 작업은 잊는다 (만든 것은 그대로 남아 있다)
    breakdown.classList.toggle('panel--ai', source === 'ai');
    badgeBox.replaceChildren(source === 'ai' ? el('span', { className: 'badge badge--ai' }, 'AI 제안')
      : source === 'fallback' ? el('span', { className: 'badge' }, '직접 입력') : '');
    notice.textContent = source === 'ai' ? '등록할 세부 작업을 고르고, 필요하면 제목을 고쳐 주세요.'
      : 'AI 제안을 불러오지 못했습니다. 세부 작업을 직접 적어 주세요.';
    list.replaceChildren(...(source === 'ai' ? subtasks : ['', '', '']).map((t) => row(t)));
    picks.hidden = !source;
    // 진한 파란 버튼은 구역에 하나 — 목록이 열리면 등록 버튼이 주 행동
    splitButton.className = source ? 'btn' : 'btn btn--primary';
    updateCount();
  }

  splitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (registering) return; // 엔터로 제출해도 등록 중에는 다시 나누지 않는다
    splitButton.disabled = true;
    splitButton.textContent = '나누는 중…';
    splitError.textContent = '';
    registerError.textContent = '';
    try {
      const { subtasks, source } = await api('/api/breakdown', { method: 'POST', body: { title: title.value } });
      show(source, subtasks);
    } catch (error) {
      splitError.textContent = messageOf(error); // 400(제목 없음) 등. AI 실패는 서버가 200 + fallback 으로 돌려준다
    } finally {
      splitButton.disabled = false;
      splitButton.textContent = 'AI로 나누기';
    }
  });

  // 상위 작업을 먼저 만들고, 받은 id 를 parentId 로 세부 작업을 하나씩 등록한다
  registerButton.addEventListener('click', async () => {
    if (registering) return;
    const rows = pendingRows();
    setRegistering(true);
    registerError.textContent = '';
    let done = 0;
    try {
      if (!parentId) parentId = (await api('/api/tasks', { method: 'POST', body: { title: title.value.trim() } })).id;
      for (const r of rows) {
        await api('/api/tasks', { method: 'POST', body: { title: textOf(r), parentId } });
        // 등록된 줄은 잠가서 다시 보내지 않는다
        r.dataset.done = '1';
        r.querySelectorAll('input').forEach((i) => { i.disabled = true; });
        done += 1;
      }
      title.value = '';
      show(null, []);
    } catch (error) {
      const reason = messageOf(error);
      registerError.textContent = parentId
        ? `${reason} 세부 작업 ${done}개까지 등록했습니다. 다시 누르면 남은 것만 같은 상위 작업 아래에 등록합니다.`
        : reason;
    }
    // 일부만 등록됐어도 아래 크기 추정 목록에 보이게
    await refresh().catch(() => {});
    setRegistering(false);
  });
}
