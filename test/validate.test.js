import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMember, validateTask } from '../src/lib/validate.js';

test('이름의 앞뒤 공백을 떼고 통과시킨다', () => {
  assert.deepEqual(validateMember({ name: ' 김권섭 ', availableHours: 10 }),
    { ok: true, value: { name: '김권섭', availableHours: 10 } });
});
test('빈 이름은 거절한다', () => {
  assert.equal(validateMember({ name: '  ', availableHours: 10 }).ok, false);
});
test('가능한 시간 0은 허용한다', () => {
  assert.equal(validateMember({ name: '김권섭', availableHours: 0 }).ok, true);
});
test('음수 · 문자열 · NaN 시간은 거절한다', () => {
  for (const v of [-1, '10', NaN, Infinity, null]) {
    assert.equal(validateMember({ name: '김권섭', availableHours: v }).ok, false, String(v));
  }
});
test('거절할 때는 고칠 점을 문장으로 알려준다', () => {
  assert.match(validateMember({ name: '김권섭', availableHours: -1 }).error, /가능한 시간/);
});
test('PATCH 는 보낸 필드만 검사한다', () => {
  assert.deepEqual(validateMember({ availableHours: 5 }, { partial: true }),
    { ok: true, value: { availableHours: 5 } });
});
test('허용하지 않은 필드는 버린다', () => {
  const r = validateTask({ title: '발표', id: 'hack', estimates: { m1: 1 } });
  assert.deepEqual(r.value, { title: '발표' });
});
test('없는 담당자는 거절한다', () => {
  const r = validateTask({ assigneeId: 'nope' }, { partial: true, memberIds: ['m1'] });
  assert.equal(r.ok, false);
});
test('담당자 해제(null)는 허용한다', () => {
  assert.equal(validateTask({ assigneeId: null }, { partial: true, memberIds: ['m1'] }).ok, true);
});
test('모르는 상태 값은 거절한다', () => {
  assert.equal(validateTask({ status: 'DELETED' }, { partial: true }).ok, false);
});
test('작업 크기 0과 음수는 거절하고 null 은 허용한다', () => {
  assert.equal(validateTask({ hours: 0 }, { partial: true }).ok, false);
  assert.equal(validateTask({ hours: -2 }, { partial: true }).ok, false);
  assert.equal(validateTask({ hours: null }, { partial: true }).ok, true);
});
test('실제로 없는 날짜는 거절한다', () => {
  assert.equal(validateTask({ dueDate: '2026-02-30' }, { partial: true }).ok, false);
  assert.equal(validateTask({ dueDate: '12/01' }, { partial: true }).ok, false);
  assert.equal(validateTask({ dueDate: '2026-12-01' }, { partial: true }).ok, true);
});

import { validateNewTask, validateTaskPatch } from '../src/lib/validate.js';

test('새 작업은 상태 · 담당 · 크기를 받지 않는다', () => {
  const r = validateNewTask({ title: '발표', status: 'DONE', assigneeId: 'm1', hours: 3 });
  assert.deepEqual(r, { ok: true, value: { title: '발표' } });
});
test('새 작업은 제목 · 마감일 · 상위 작업을 받는다', () => {
  const r = validateNewTask({ title: '대본', dueDate: '2026-12-01', parentId: 't1' }, { taskIds: ['t1'] });
  assert.deepEqual(r.value, { title: '대본', dueDate: '2026-12-01', parentId: 't1' });
});
test('작업 수정으로 상위 작업을 바꿀 수 없다', () => {
  assert.deepEqual(validateTaskPatch({ parentId: 't2', status: 'DONE' }), { ok: true, value: { status: 'DONE' } });
});

test('같은 이름의 팀원이 있으면 거절한다 (앞뒤 공백 무시)', () => {
  assert.equal(validateMember({ name: ' 박지호 ', availableHours: 5 }, { takenNames: ['박지호'] }).error, '이미 같은 이름의 팀원이 있습니다.');
  assert.equal(validateMember({ name: '박지호', availableHours: 5 }, { takenNames: ['김권섭'] }).ok, true);
  // 가능한 시간만 고칠 때는 이름 검사를 하지 않는다
  assert.equal(validateMember({ availableHours: 5 }, { partial: true, takenNames: ['박지호'] }).ok, true);
});
test('추정이 공개되기 전에는 크기를 정하지 못한다 (되돌리기 null 은 허용)', () => {
  assert.match(validateTaskPatch({ hours: 4 }).error, /공개된 뒤/);
  assert.deepEqual(validateTaskPatch({ hours: 4 }, { revealed: true }), { ok: true, value: { hours: 4 } });
  assert.equal(validateTaskPatch({ hours: null }).ok, true);
});
