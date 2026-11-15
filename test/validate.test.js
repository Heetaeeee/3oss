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
