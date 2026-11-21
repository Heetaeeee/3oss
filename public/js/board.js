// C 우희태 — #task-form · #tasks · #members · #progress (board.html, 홈의 #progress)
// 페이지마다 있는 자리만 그린다. 서버에서 온 글자는 전부 textContent 로만 넣는다.
import { api, refresh } from './api.js';

// 폼은 noValidate — 브라우저 기본 경고 대신 서버의 안내 문장을 폼 아래에 띄운다
const $ = (s) => document.querySelector(s);
const STATUS = { TODO: '할 일', DOING: '진행 중', DONE: '완료' };

// el('p', { className: 'sub' }, '글자', 다른요소) — 문자열 자식은 글자로만 들어간다
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c != null));
  return node;
}

function field(label, input, className = 'field') {
  return el('label', { className }, label, input);
}

// 버튼을 잠근 채 요청 → 성공하면 refresh, 실패하면 서버 문장을 errorBox 에 띄운다
// undo: 실패했을 때 바꾸던 값을 원래대로 돌리는 함수 (선택칸 · 입력칸)
async function act(button, errorBox, fn, undo) {
  button.disabled = true;
  errorBox.textContent = '';
  let saved = false;
  try {
    await fn();
    saved = true;
    await refresh();
  } catch (error) {
    if (!saved) undo?.();
    errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function avatar(members, id) {
  const i = members.findIndex((m) => m.id === id);
  const n = (i % 6) + 1;
  return el('span', { className: n === 1 ? 'avatar' : `avatar avatar--${n}`, ariaHidden: 'true' }, members[i].name.slice(0, 1));
}

// 서버 progress.js 의 daysLeft 와 같은 방식(날짜 단위)
function daysLeft(dueDate) {
  if (!dueDate) return null;
  const today = new Date().toLocaleDateString('sv-SE'); // 로컬 날짜 'YYYY-MM-DD'
  const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((utc(dueDate) - utc(today)) / 86_400_000);
}

function meter(label, valueText, percent) {
  return el('div', { className: 'meter' },
    el('div', { className: 'between' }, label, el('strong', {}, valueText)),
    el('div', { className: 'bar bar--100', role: 'img', ariaLabel: `${valueText}` },
      el('span', { className: 'bar-now', style: `--v:${percent}` })));
}

// ---------- 폼: 처음 한 번만 그린다 (다시 그리면 입력하던 값이 지워진다) ----------

const memberSlot = $('#members');
let memberList;
if (memberSlot) {
  memberList = el('div', { className: 'stack' });
  const name = el('input', { required: true, maxLength: 20 });
  const hours = el('input', { type: 'number', min: 0, step: 0.5, required: true });
  const button = el('button', { className: 'btn', type: 'submit' }, '팀원 등록');
  const error = el('p', { className: 'msg-error', role: 'alert' });
  const form = el('form', { className: 'stack slot', noValidate: true },
    el('div', { className: 'row' }, field('이름', name), field('이번 주 가능한 시간(시간)', hours, 'field field--s'), button),
    error,
    el('p', { className: 'sub' }, '이름과 가능한 시간만 받습니다. 학번 · 연락처는 적지 마세요. 이 페이지는 공개됩니다.'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    act(button, error, async () => {
      await api('/api/members', { method: 'POST', body: { name: name.value, availableHours: hours.valueAsNumber } });
      form.reset();
    });
  });
  memberSlot.append(memberList, form);
}

const taskFormSlot = $('#task-form');
if (taskFormSlot) {
  const title = el('input', { required: true, maxLength: 100, placeholder: '예: 발표 자료 제작' });
  const due = el('input', { type: 'date' });
  const button = el('button', { className: 'btn btn--primary', type: 'submit' }, '작업 등록');
  const error = el('p', { className: 'msg-error', role: 'alert' });
  const form = el('form', { className: 'stack', noValidate: true },
    el('div', { className: 'row' }, field('작업 제목', title), field('마감일 (선택)', due), button), error);
  title.parentElement.style.flexGrow = 3;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    act(button, error, async () => {
      await api('/api/tasks', { method: 'POST', body: { title: title.value, dueDate: due.value || null } });
      form.reset();
    });
  });
  taskFormSlot.append(form);
}

// 팀원 · 작업 · 진행 자리마다 제목 아래 내용만 갈아 끼운다
function fill(slot, ...nodes) {
  slot.replaceChildren(slot.querySelector('h2'), ...nodes);
}

// ---------- 'data' 이벤트마다 다시 그린다 ----------

function drawMembers(members, tasks) {
  if (members.length === 0) {
    memberList.replaceChildren(el('p', { className: 'sub' }, '아직 팀원이 없습니다. 아래에서 첫 팀원을 등록하세요.'));
    return;
  }
  memberList.replaceChildren(...members.map((m) => {
    const hours = el('input', { type: 'number', min: 0, step: 0.5, value: m.availableHours, ariaLabel: `${m.name} 이번 주 가능한 시간(시간)` });
    const error = el('p', { className: 'msg-error', role: 'alert' });
    hours.addEventListener('change', () =>
      act(hours, error, () => api(`/api/members/${m.id}`, { method: 'PATCH', body: { availableHours: hours.valueAsNumber } }),
        () => { hours.value = m.availableHours; }));
    const remove = el('button', { className: 'btn btn--quiet btn--s', type: 'button', ariaLabel: `${m.name} 삭제` }, '삭제');
    remove.addEventListener('click', () => {
      const mine = tasks.filter((t) => t.assigneeId === m.id).length;
      const note = (mine > 0 ? `\n맡은 작업 ${mine}개는 담당 미정이 됩니다.` : '')
        + '\n낸 추정은 남지만 공개 · 중앙값 계산에서는 빠집니다.';
      if (!confirm(`'${m.name}' 팀원을 삭제할까요? 되돌릴 수 없습니다.${note}`)) return;
      act(remove, error, () => api(`/api/members/${m.id}`, { method: 'DELETE' }));
    });
    return el('div', { className: 'stack' },
      el('div', { className: 'between' },
        el('span', { className: 'who' }, avatar(members, m.id), m.name),
        el('div', { className: 'row' }, field('이번 주 시간', hours, 'field field--s'), remove)),
      error);
  }));
}

function taskCard(task, members, tasks) {
  const error = el('p', { className: 'msg-error', role: 'alert' });
  // 저장에 실패하면 선택칸을 서버에 있는 값으로 되돌린다
  const patch = (control, body, was) =>
    act(control, error, () => api(`/api/tasks/${task.id}`, { method: 'PATCH', body }), () => { control.value = was; });

  const status = el('select', { className: 'status', ariaLabel: `${task.title} 상태` },
    ...Object.entries(STATUS).map(([value, label]) => el('option', { value, selected: task.status === value }, label)));
  status.addEventListener('change', () => patch(status, { status: status.value }, task.status));

  const assignee = el('select', {},
    el('option', { value: '' }, '미정'),
    ...members.map((m) => el('option', { value: m.id, selected: task.assigneeId === m.id }, m.name)));
  assignee.addEventListener('change', () => patch(assignee, { assigneeId: assignee.value || null }, task.assigneeId ?? ''));

  const d = daysLeft(task.dueDate);
  const owner = members.find((m) => m.id === task.assigneeId);
  const parent = tasks.find((t) => t.id === task.parentId);
  const badges = el('div', { className: 'badges' },
    d === null || task.status === 'DONE' ? null
      : d < 0 ? el('span', { className: 'badge badge--over' }, `지남 ${-d}일`)
      : el('span', { className: 'badge' }, d === 0 ? 'D-day' : `D-${d}`),
    // 크기는 작업 정의 화면의 블라인드 추정으로만 정한다. 여기서 넣으면 전원 제출 전에 확정돼 버림
    task.hours === null ? el('span', { className: 'badge badge--todo' }, '크기 미정')
      : el('span', { className: 'badge badge--team' }, `${task.hours}시간 확정`),
    owner ? el('span', { className: 'badge badge--team' }, `담당 ${owner.name}`)
      : el('span', { className: 'badge badge--todo' }, '담당 미정'));

  const remove = el('button', { className: 'btn btn--quiet btn--s', type: 'button', ariaLabel: `${task.title} 삭제` }, '삭제');
  remove.addEventListener('click', () => {
    // 서버 withDescendants 와 같은 범위 — 세부 작업의 세부 작업까지 센다
    const ids = new Set([task.id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of tasks) if (ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); grew = true; }
    }
    const children = ids.size - 1;
    // 마지막 세부 작업을 지우면 상위 작업이 일반 작업으로 돌아가 진행률 · 부담률에 다시 들어간다
    const parent = tasks.find((t) => t.id === task.parentId);
    const lastChild = parent && !tasks.some((t) => t.parentId === parent.id && !ids.has(t.id));
    const note = (children > 0 ? `\n세부 작업 ${children}개도 함께 삭제됩니다.` : '')
      + (lastChild ? `\n'${parent.title}'은(는) 일반 작업으로 돌아가 진행률 · 부담률에 다시 들어갑니다.` : '');
    if (!confirm(`'${task.title}' 작업을 삭제할까요? 되돌릴 수 없습니다.${note}`)) return;
    act(remove, error, () => api(`/api/tasks/${task.id}`, { method: 'DELETE' }));
  });

  return el('article', { className: 'card stack' },
    el('div', { className: 'between' }, el('h3', {}, task.title), status),
    parent ? el('p', { className: 'sub' }, `↳ ${parent.title}의 세부 작업`) : null,
    badges,
    el('div', { className: 'slot stack' },
      el('div', { className: 'between' }, field('담당자', assignee), remove),
      error));
}

function drawTasks(slot, members, tasks) {
  if (tasks.length === 0) {
    fill(slot, el('p', { className: 'sub' }, '아직 작업이 없습니다. 위에서 첫 작업을 등록하세요.'));
    return;
  }
  fill(slot, el('div', { className: 'board' }, ...Object.entries(STATUS).map(([key, label]) => {
    const list = tasks.filter((t) => t.status === key);
    return el('div', { className: 'stack' },
      el('div', { className: 'between' }, el('h3', {}, label), el('span', { className: 'badge' }, String(list.length))),
      ...list.map((t) => taskCard(t, members, tasks)));
  })));
}

// '2026-11-16' → '11/16 ~ 11/22', 오늘이 그 주면 ' (이번 주)' 를 붙인다
function weekLabel(weekStart) {
  const md = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const thisWeek = daysLeft(weekStart) <= 0 && daysLeft(weekStart) > -7;
  return `${md(start)} ~ ${md(end)}${thisWeek ? ' (이번 주)' : ''}`;
}

async function drawWeekly(tasks) {
  try {
    const { weeks } = await api('/api/weekly');
    if (weeks.length > 0) {
      return weeks.map((w) => meter(weekLabel(w.weekStart), `${w.rate}% · ${w.done}건 / ${w.total}건`, w.rate));
    }
    // 서버는 이번 주까지만 센다. 마감일이 전부 다음 주 이후면 마감일은 있어도 목록이 비어 있다
    return [el('p', { className: 'sub' }, tasks.some((t) => t.dueDate)
      ? '이번 주까지 표시할 주차별 기록이 없습니다.'
      : '아직 마감일이 있는 작업이 없습니다. 작업에 마감일을 넣으면 주별로 보입니다.')];
  } catch (error) {
    return [el('p', { className: 'msg-error', role: 'alert' }, `주차별 수행률을 불러오지 못했습니다. ${error.message}`)];
  }
}

// 담당을 정하면 바로 바뀌도록 서버를 거치지 않고 작업 목록에서 센다. 크기 미정 작업은 0시간
function assignedHours(members, counted) {
  if (members.length === 0) return [el('p', { className: 'sub' }, '아직 팀원이 없습니다.')];
  const sum = (list) => Math.round(list.reduce((s, t) => s + (t.hours ?? 0), 0) * 10) / 10;
  return members.map((m) => {
    const mine = counted.filter((t) => t.assigneeId === m.id);
    return el('div', { className: 'between' },
      el('span', { className: 'who' }, avatar(members, m.id), m.name),
      el('span', {}, `맡은 ${sum(mine)}시간 (완료 ${sum(mine.filter((t) => t.status === 'DONE'))}시간)`));
  });
}

async function drawProgress(slot, members, tasks, isLatest) {
  // 서버 progress.js 와 같은 기준: 다른 작업이 parentId 로 가리키는 상위 작업은 세지 않는다
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  const counted = tasks.filter((t) => !parentIds.has(t.id));
  // 주차별 조회가 실패해도 진행률 · 완료 작업 비중은 보이게 따로 받는다
  const [p, weekly] = await Promise.all([api('/api/progress'), drawWeekly(counted)]);
  if (!isLatest()) return;
  const done = counted.filter((t) => t.status === 'DONE').length;
  const shares = p.doneHoursTotal === 0
    ? [el('p', { className: 'sub' }, done === 0 ? '아직 완료된 작업이 없습니다.' : '완료한 작업의 확정 시간이 아직 없습니다.')]
    : [...p.members, ...(p.unassigned.doneHours > 0 ? [{ name: '담당 미정', ...p.unassigned }] : [])]
      .map((m) => meter(m.name, `${m.doneShare}% · ${m.doneHours}시간 / ${p.doneHoursTotal}시간`, m.doneShare));
  // A 의 지난주 요약 자리. 다시 그려도 A 가 채운 내용이 지워지지 않게 같은 노드를 다시 붙인다
  const summary = slot.querySelector('#weekly-summary') ?? el('div', { id: 'weekly-summary' });
  fill(slot,
    meter('전체 진행률', `${p.progress}% · ${done}건 / ${counted.length}건`, p.progress),
    el('h3', { className: 'slot' }, '팀원별 맡은 시간'),
    ...assignedHours(members, counted),
    el('h3', { className: 'slot' }, '완료 작업 비중'),
    ...shares,
    el('p', { className: 'sub' }, '완료한 작업의 확정 예상 시간 기준입니다. 실제 걸린 시간과 다를 수 있습니다.'),
    el('h3', { className: 'slot' }, '주차별 수행률'),
    summary,
    ...weekly,
    el('p', { className: 'sub' }, '그 주에 마감인 작업 중 완료한 비율입니다.'));
}

// 진행 현황은 'data' 뒤에 따로 API 를 기다리므로, 먼저 시작한 요청이 늦게 끝나 최신 화면을 덮지 않게 마지막 것만 그린다
let progressSeq = 0;

document.addEventListener('data', async (e) => {
  const { members, tasks } = e.detail;
  if (memberList) drawMembers(members, tasks);
  if ($('#tasks')) drawTasks($('#tasks'), members, tasks);
  if ($('#progress')) {
    const mine = ++progressSeq;
    const isLatest = () => mine === progressSeq;
    await drawProgress($('#progress'), members, tasks, isLatest).catch((error) => {
      if (isLatest()) fill($('#progress'), el('p', { className: 'msg-error', role: 'alert' }, error.message));
    });
  }
});
