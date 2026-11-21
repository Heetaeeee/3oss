import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressPercent, daysLeft, doneShare, withDescendants } from '../src/lib/progress.js';

const t = (o) => ({ id: 'x', status: 'TODO', assigneeId: null, hours: null, dueDate: null, ...o });

test('진행률은 (완료 수 ÷ 전체 수) × 100', () => {
  assert.equal(progressPercent([t({ status: 'DONE' }), t({}), t({ status: 'DOING' })]), 33);
});
test('작업이 0개면 진행률은 0', () => {
  assert.equal(progressPercent([]), 0);
});
test('전부 완료면 100', () => {
  assert.equal(progressPercent([t({ status: 'DONE' })]), 100);
});

test('D-day 는 날짜 단위로 센다', () => {
  assert.equal(daysLeft('2026-11-13', '2026-11-10'), 3);
  assert.equal(daysLeft('2026-11-10', '2026-11-10'), 0);
  assert.equal(daysLeft('2026-11-08', '2026-11-10'), -2);
});
test('달과 해가 바뀌어도 맞게 센다', () => {
  assert.equal(daysLeft('2026-12-01', '2026-11-30'), 1);
  assert.equal(daysLeft('2027-01-01', '2026-12-31'), 1);
});
test('마감일이 없으면 null', () => {
  assert.equal(daysLeft(null, '2026-11-10'), null);
});

test("완료 작업 비중은 완료한 예상 시간의 비율과 시간을 함께 돌려준다", () => {
  const tasks = [
    t({ assigneeId: 'm1', hours: 6, status: 'DONE' }),
    t({ assigneeId: 'm2', hours: 2, status: 'DONE' }),
    t({ assigneeId: 'm2', hours: 9 }),
  ];
  assert.deepEqual(doneShare("m1", tasks), { percent: 75, hours: 6, totalHours: 8 });
  assert.deepEqual(doneShare("m2", tasks), { percent: 25, hours: 2, totalHours: 8 });
});
test('담당자가 없는 완료 작업도 전체 시간에 들어가고, 담당 미정 몫으로 따로 셀 수 있다', () => {
  // 삭제된 팀원이 끝낸 4시간 → 담당 미정. 남은 팀원 비중을 더해도 60% 라서 나머지 40% 를 따로 보여 준다
  const tasks = [t({ assigneeId: 'm1', hours: 6, status: 'DONE' }), t({ assigneeId: null, hours: 4, status: 'DONE' })];
  assert.deepEqual(doneShare('m1', tasks), { percent: 60, hours: 6, totalHours: 10 });
  assert.deepEqual(doneShare(null, tasks), { percent: 40, hours: 4, totalHours: 10 });
});
test("완료된 작업이 없으면 비중은 0", () => {
  assert.deepEqual(doneShare("m1", []), { percent: 0, hours: 0, totalHours: 0 });
});
test('크기가 정해지지 않은 완료 작업은 세지 않는다', () => {
  const tasks = [t({ assigneeId: 'm1', hours: null, status: 'DONE' })];
  assert.deepEqual(doneShare("m1", tasks), { percent: 0, hours: 0, totalHours: 0 });
});

import { weeklyRates } from '../src/lib/progress.js';

// 2026-11-09 는 월요일
test('주는 월요일에 시작한다', () => {
  const r = weeklyRates([t({ dueDate: '2026-11-15' }), t({ dueDate: '2026-11-16' })], '2026-11-20');
  assert.deepEqual(r.map((w) => w.weekStart), ['2026-11-09', '2026-11-16']);
});
test('수행률은 그 주에 마감인 작업 중 완료한 비율', () => {
  const tasks = [
    t({ dueDate: '2026-11-10', status: 'DONE' }),
    t({ dueDate: '2026-11-12', status: 'DONE' }),
    t({ dueDate: '2026-11-13' }),
  ];
  assert.deepEqual(weeklyRates(tasks, '2026-11-20'),
    [{ weekStart: '2026-11-09', rate: 67, done: 2, total: 3 }]);
});
test('마감일이 없는 작업은 넣지 않는다', () => {
  assert.deepEqual(weeklyRates([t({ status: 'DONE' })], '2026-11-20'), []);
});
test('작업이 없으면 빈 배열', () => {
  assert.deepEqual(weeklyRates([], '2026-11-20'), []);
});
test('해가 바뀌는 주도 한 주로 묶는다', () => {
  const r = weeklyRates([t({ dueDate: '2026-12-31' }), t({ dueDate: '2027-01-02' })], '2027-01-05');
  assert.equal(r.length, 1);
  assert.equal(r[0].weekStart, '2026-12-28');
});
test('오늘이 속한 주보다 뒤의 주는 넣지 않는다', () => {
  assert.deepEqual(weeklyRates([t({ dueDate: '2026-11-30' })], '2026-11-20'), []);
});

// 상위 작업 p 를 세부 작업 a · b 로 나눈 상황
const split = (o = {}) => [
  t({ id: 'p', hours: 6, assigneeId: 'm1', dueDate: '2026-11-18', ...o.p }),
  t({ id: 'a', parentId: 'p', hours: 2, assigneeId: 'm1', status: 'DONE', dueDate: '2026-11-18' }),
  t({ id: 'b', parentId: 'p', hours: 4, assigneeId: 'm2', status: 'DONE', dueDate: '2026-11-18' }),
];
test('세부 작업을 다 끝내면 상위 작업이 남아 있어도 진행률 100', () => {
  assert.equal(progressPercent(split()), 100);
});
test('완료 작업 비중은 상위 작업의 시간을 세지 않는다', () => {
  assert.deepEqual(doneShare('m1', split({ p: { status: 'DONE' } })), { percent: 33, hours: 2, totalHours: 6 });
});
test('주차별 수행률도 상위 작업을 세지 않는다', () => {
  assert.deepEqual(weeklyRates(split(), '2026-11-18'), [{ weekStart: '2026-11-16', rate: 100, done: 2, total: 2 }]);
});
test('세부 작업이 없는 작업은 그대로 센다', () => {
  assert.equal(progressPercent([t({ id: 'p' }), t({ id: 'q', status: 'DONE' })]), 50);
});

test('작업을 지우면 세부 작업과 그 아래 작업까지 함께 지울 id 로 고른다', () => {
  const tasks = [t({ id: 'p' }), t({ id: 'c1', parentId: 'p' }), t({ id: 'g', parentId: 'c1' }), t({ id: 'other' })];
  assert.deepEqual([...withDescendants('p', tasks)].sort(), ['c1', 'g', 'p']);
  assert.deepEqual([...withDescendants('other', tasks)], ['other']);
});
