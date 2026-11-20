// 진행률 · D-day · 완료 작업 비중. 전부 순수 함수이고 오늘 날짜도 인자로 받는다.

// 상태가 바뀔 때의 완료 시각. 완료로 바뀌면 now, 완료에서 벗어나면 null, 그대로면 이전 값
export function nextCompletedAt(prevStatus, nextStatus, prevCompletedAt, now) {
  if (nextStatus === undefined || nextStatus === prevStatus) return prevCompletedAt ?? null;
  return nextStatus === 'DONE' ? now : null;
}

// 상위 작업 = 다른 작업이 parentId 로 가리키는 작업. 시간과 완료는 세부 작업에서 세므로 뺀다 (team/README "상위 작업은 세지 않습니다")
export function withoutParents(tasks) {
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  return tasks.filter((t) => !parentIds.has(t.id));
}

// 작업 삭제 때 함께 지울 id — 자기 자신과 그 아래 세부 작업 전부 (세부 작업의 세부 작업까지)
export function withDescendants(id, tasks) {
  const ids = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const t of tasks) if (ids.has(t.parentId) && !ids.has(t.id)) { ids.add(t.id); grew = true; }
  }
  return ids;
}

export function progressPercent(allTasks) {
  const tasks = withoutParents(allTasks);
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === 'DONE').length / tasks.length) * 100);
}

const DAY = 86_400_000;
// 'YYYY-MM-DD' → 그날 UTC 자정. 시간대가 끼어들지 않게 날짜 계산은 전부 이걸 거친다
const utcDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

// 'YYYY-MM-DD' 두 개를 날짜 단위로 뺀다.
export function daysLeft(dueDate, today) {
  if (dueDate === null) return null;
  return Math.round((utcDay(dueDate) - utcDay(today)) / DAY);
}

export function doneShare(memberId, tasks) {
  const done = withoutParents(tasks).filter((t) => t.status === 'DONE' && t.hours !== null);
  const totalHours = done.reduce((sum, t) => sum + t.hours, 0);
  const hours = done.filter((t) => t.assigneeId === memberId).reduce((sum, t) => sum + t.hours, 0);
  return { percent: totalHours === 0 ? 0 : Math.round((hours / totalHours) * 100), hours, totalHours };
}

// 'YYYY-MM-DD' 가 속한 주의 월요일
function weekStartOf(s) {
  const d = utcDay(s);
  const sinceMonday = (new Date(d).getUTCDay() + 6) % 7;
  return new Date(d - sinceMonday * DAY).toISOString().slice(0, 10);
}

// → [{ weekStart, rate, done, total }] 월요일 시작, 오래된 주부터. 마감인 작업이 없는 주는 뺀다.
// 아직 오지 않은 주는 수행률이 낮게만 보이므로 오늘이 속한 주까지만 센다.
export function weeklyRates(tasks, today) {
  const thisWeek = weekStartOf(today);
  const weeks = new Map();
  for (const task of withoutParents(tasks)) {
    if (task.dueDate === null) continue;
    const start = weekStartOf(task.dueDate);
    if (start > thisWeek) continue;
    const w = weeks.get(start) ?? { weekStart: start, done: 0, total: 0 };
    w.total += 1;
    if (task.status === 'DONE') w.done += 1;
    weeks.set(start, w);
  }
  return [...weeks.values()]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map(({ weekStart, done, total }) => ({ weekStart, rate: Math.round((done / total) * 100), done, total }));
}
