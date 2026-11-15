// 진행률 · D-day · 완료 작업 비중. 전부 순수 함수이고 오늘 날짜도 인자로 받는다.

export function progressPercent(tasks) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.status === 'DONE').length / tasks.length) * 100);
}

// 'YYYY-MM-DD' 두 개를 날짜 단위로 뺀다. 시간대가 끼어들지 않게 UTC 자정끼리 비교.
export function daysLeft(dueDate, today) {
  if (dueDate === null) return null;
  const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((utc(dueDate) - utc(today)) / 86_400_000);
}

export function doneShare(memberId, tasks) {
  const done = tasks.filter((t) => t.status === 'DONE' && t.hours !== null);
  const totalHours = done.reduce((sum, t) => sum + t.hours, 0);
  const hours = done.filter((t) => t.assigneeId === memberId).reduce((sum, t) => sum + t.hours, 0);
  return { percent: totalHours === 0 ? 0 : Math.round((hours / totalHours) * 100), hours, totalHours };
}
