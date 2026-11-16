// A 김권섭 — #sizing (sizing.html). #breakdown 은 A-6 에서 채운다.
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

// 버튼을 잠근 채 요청 → 성공하면 refresh, 실패하면 서버 문장을 errorBox 에 띄우고 입력칸은 그대로 둔다
async function act(button, errorBox, fn) {
  button.disabled = true;
  errorBox.textContent = '';
  try {
    await fn();
    await refresh();
  } catch (error) {
    errorBox.textContent = error.message;
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
  const memberSelect = el('select', {}, ...members.map((m) => el('option', { value: m.id, selected: m.id === pick }, m.name)));
  const hours = el('input', { type: 'number', min: '0.5', step: 'any', required: true, inputMode: 'decimal' });
  const reason = el('input', { maxLength: 100, placeholder: '왜 이 시간인가요? 예: 슬라이드 10장 기준' });
  const button = el('button', { className: primary ? 'btn btn--primary' : 'btn', type: 'submit' }, label);
  const error = el('p', { className: 'msg-error', role: 'alert' });

  const form = el('form', { className: 'stack' },
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

function historyList(members, history) {
  if (!history || history.length < 2) return null;
  const rows = history.map((v, i) => {
    if (i === 0 || !v.by) return el('li', {}, `ver ${v.version} 처음 공개 · 중앙값 ${v.median}시간 · ${fmtTime(v.at)}`);
    const before = history[i - 1].values[v.by];
    const after = v.values[v.by];
    const change = before === after ? `${after}시간 (근거 수정)` : `${before ?? '–'} → ${after}시간`;
    return el('li', {}, `ver ${v.version} ${nameOf(members, v.by)} ${change} · 중앙값 ${v.median}시간 · ${fmtTime(v.at)}`);
  });
  return el('details', {},
    el('summary', {}, `수정 기록 ${history.length}`),
    el('ol', { className: 'stack sub' }, ...rows));
}

function confirmForm(task, median) {
  const hours = el('input', { type: 'number', min: '0.5', step: 'any', required: true, value: String(median), inputMode: 'decimal' });
  const button = el('button', { className: 'btn btn--primary', type: 'submit' }, '크기 확정');
  const error = el('p', { className: 'msg-error', role: 'alert' });
  const form = el('form', { className: 'stack' },
    el('div', { className: 'row' }, field('확정 크기(시간)', hours, 'field field--s'), button),
    el('p', { className: 'sub' }, `중앙값인 ${median}시간을 미리 넣어 두었습니다. 이야기해 보고 바꿔도 됩니다.`),
    error);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    act(button, error, () => api(`/api/tasks/${task.id}`, { method: 'PATCH', body: { hours: hours.valueAsNumber } }));
  });
  return form;
}

function revealedSlot(task, members, summary) {
  const notYet = members.filter((m) => !summary.submittedIds.includes(m.id)).map((m) => m.id);
  return el('div', { className: 'slot stack' },
    el('div', { className: 'between' }, el('h3', {}, '크기 추정'),
      summary.wideSpread ? el('span', { className: 'badge badge--over' }, '의견 차이 큼') : null),
    el('div', { className: 'est' }, ...summary.submittedIds.flatMap((id) => [
      who(members, id),
      el('strong', {}, `${summary.values[id]}시간`),
      el('span', { className: 'sub' }, summary.reasons[id] ?? '근거 없음'),
    ])),
    notYet.length ? el('p', { className: 'sub' }, `${notYet.map((id) => nameOf(members, id)).join(', ')} 님은 아직 내지 않았습니다.`) : null,
    historyList(members, summary.history),
    // 이미 낸 사람은 고치고(버전이 쌓인다), 공개 뒤 들어온 사람은 여기서 처음 낸다
    estimateForm(task, members, { label: notYet.length ? '추정 제출' : '추정 고치기', primary: false, preferIds: notYet }),
    // 확정칸은 공개된 뒤에만 — C 의 PATCH 는 공개 전에도 hours 를 받으므로 블라인드를 지키는 곳은 여기다
    confirmForm(task, summary.median));
}

// ---------- 전체 ----------

function card(task, tasks, members, summary) {
  return el('article', { className: 'card stack' },
    ...cardHead(task, tasks, members),
    // ③ 크기가 확정되면 배지만 남긴다
    task.hours != null ? null : summary?.revealed ? revealedSlot(task, members, summary) : hiddenSlot(task, members, summary ?? { submittedIds: [] }));
}

function fill(...nodes) {
  slot.replaceChildren(slot.querySelector('h2'), ...nodes);
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
      fill(el('p', { className: 'msg-error', role: 'alert' }, `추정 현황을 불러오지 못했습니다. ${error.message}`));
      return;
    }
    // 크기 미정 작업이 위(등록 순서), 확정된 작업이 아래
    const ordered = [...tasks.filter((t) => t.hours == null), ...tasks.filter((t) => t.hours != null)];
    // shortcut: 데이터가 바뀌면 카드를 통째로 다시 그려 다른 카드에 입력하던 값도 지워진다. 한 화면을 여러 명이 동시에 쓰게 되면 카드별로 갱신
    fill(...ordered.map((t) => card(t, tasks, members, summaries[t.id])));
  });
}
