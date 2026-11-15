import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressPercent, daysLeft, doneShare } from '../src/lib/progress.js';

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
test("완료된 작업이 없으면 비중은 0", () => {
  assert.deepEqual(doneShare("m1", []), { percent: 0, hours: 0, totalHours: 0 });
});
test('크기가 정해지지 않은 완료 작업은 세지 않는다', () => {
  const tasks = [t({ assigneeId: 'm1', hours: null, status: 'DONE' })];
  assert.deepEqual(doneShare("m1", tasks), { percent: 0, hours: 0, totalHours: 0 });
});
