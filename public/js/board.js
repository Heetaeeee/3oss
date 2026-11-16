// C 우희태 — #task-form · #tasks · #members · #progress (board.html, 홈의 #progress)
// 페이지마다 있는 자리만 그린다. 서버에서 온 글자는 전부 textContent 로만 넣는다.
import { api, refresh } from './api.js';

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
  const form = el('form', { className: 'stack slot' },
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
  const form = el('form', { className: 'stack' },
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

function drawMembers(members) {
  if (members.length === 0) {
    memberList.replaceChildren(el('p', { className: 'sub' }, '아직 팀원이 없습니다. 아래에서 첫 팀원을 등록하세요.'));
    return;
  }
  memberList.replaceChildren(...members.map((m) => {
    const hours = el('input', { type: 'number', min: 0, step: 0.5, value: m.availableHours, ariaLabel: `${m.name} 이번 주 가능한 시간(시간)` });
    const error = el('p', { className: 'msg-error', role: 'alert' });
    hours.addEventListener('change', () =>
      act(hours, error, () => api(`/api/members/${m.id}`, { method: 'PATCH', body: { availableHours: hours.valueAsNumber } })));
    return el('div', { className: 'stack' },
      el('div', { className: 'between' },
        el('span', { className: 'who' }, avatar(members, m.id), m.name),
        field('이번 주 시간', hours, 'field field--s')),
      error);
  }));
}

function taskCard(task, members, tasks) {
  const error = el('p', { className: 'msg-error', role: 'alert' });
  const patch = (control, body) => act(control, error, () => api(`/api/tasks/${task.id}`, { method: 'PATCH', body }));

  const status = el('select', { className: 'status', ariaLabel: `${task.title} 상태` },
    ...Object.entries(STATUS).map(([value, label]) => el('option', { value, selected: task.status === value }, label)));
  status.addEventListener('change', () => patch(status, { status: status.value }));

  const assignee = el('select', {},
    el('option', { value: '' }, '미정'),
    ...members.map((m) => el('option', { value: m.id, selected: task.assigneeId === m.id }, m.name)));
  assignee.addEventListener('change', () => patch(assignee, { assigneeId: assignee.value || null }));

  // A 의 추정 화면이 붙기 전에도 크기를 넣을 수 있게
  const hours = el('input', { type: 'number', min: 0.5, step: 0.5, value: task.hours ?? '' });
  hours.addEventListener('change', () => patch(hours, { hours: Number.isNaN(hours.valueAsNumber) ? null : hours.valueAsNumber }));

  const d = daysLeft(task.dueDate);
  const owner = members.find((m) => m.id === task.assigneeId);
  const parent = tasks.find((t) => t.id === task.parentId);
  const badges = el('div', { className: 'badges' },
    d === null || task.status === 'DONE' ? null
      : d < 0 ? el('span', { className: 'badge badge--over' }, `지남 ${-d}일`)
      : el('span', { className: 'badge' }, d === 0 ? 'D-day' : `D-${d}`),
    task.hours === null ? el('span', { className: 'badge badge--todo' }, '크기 미정')
      : el('span', { className: 'badge badge--team' }, `${task.hours}시간 확정`),
    owner ? el('span', { className: 'badge badge--team' }, `담당 ${owner.name}`)
      : el('span', { className: 'badge badge--todo' }, '담당 미정'));

  return el('article', { className: 'card stack' },
    el('div', { className: 'between' }, el('h3', {}, task.title), status),
    parent ? el('p', { className: 'sub' }, `↳ ${parent.title}의 세부 작업`) : null,
    badges,
    el('div', { className: 'row' }, field('담당자', assignee), field('크기(시간)', hours, 'field field--s')),
    error);
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

async function drawProgress(slot, tasks) {
  const [p, { weeks }] = await Promise.all([api('/api/progress'), api('/api/weekly')]);
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const shares = p.doneHoursTotal === 0
    ? [el('p', { className: 'sub' }, done === 0 ? '아직 완료된 작업이 없습니다.' : '완료한 작업의 확정 시간이 아직 없습니다.')]
    : p.members.map((m) => meter(m.name, `${m.doneShare}% · ${m.doneHours}시간 / ${p.doneHoursTotal}시간`, m.doneShare));
  const weekly = weeks.length === 0
    ? [el('p', { className: 'sub' }, '아직 마감일이 있는 작업이 없습니다. 작업에 마감일을 넣으면 주별로 보입니다.')]
    : weeks.map((w) => meter(`${+w.weekStart.slice(5, 7)}/${+w.weekStart.slice(8)} 주`, `${w.rate}% · ${w.done}건 / ${w.total}건`, w.rate));
  // A 의 지난주 요약 자리. 다시 그려도 A 가 채운 내용이 지워지지 않게 같은 노드를 다시 붙인다
  const summary = slot.querySelector('#weekly-summary') ?? el('div', { id: 'weekly-summary' });
  fill(slot,
    meter('전체 진행률', `${p.progress}% · ${done}건 / ${tasks.length}건`, p.progress),
    el('h3', { className: 'slot' }, '완료 작업 비중'),
    ...shares,
    el('p', { className: 'sub' }, '완료한 작업의 확정 예상 시간 기준입니다. 실제 걸린 시간과 다를 수 있습니다.'),
    el('h3', { className: 'slot' }, '주차별 수행률'),
    summary,
    ...weekly,
    el('p', { className: 'sub' }, '그 주에 마감인 작업 중 완료한 비율입니다.'));
}

document.addEventListener('data', async (e) => {
  const { members, tasks } = e.detail;
  if (memberList) drawMembers(members);
  if ($('#tasks')) drawTasks($('#tasks'), members, tasks);
  if ($('#progress')) {
    await drawProgress($('#progress'), tasks).catch((error) => {
      fill($('#progress'), el('p', { className: 'msg-error', role: 'alert' }, error.message));
    });
  }
});
