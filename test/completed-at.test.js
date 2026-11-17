import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextCompletedAt } from '../src/lib/progress.js';

const NOW = '2026-11-17T10:00:00.000Z';
const BEFORE = '2026-11-10T09:00:00.000Z';

test('완료로 바뀌면 지금 시각을 기록한다', () => {
  assert.equal(nextCompletedAt('DOING', 'DONE', null, NOW), NOW);
});
test('이미 완료인 작업을 다시 완료로 보내도 처음 시각을 지킨다', () => {
  assert.equal(nextCompletedAt('DONE', 'DONE', BEFORE, NOW), BEFORE);
});
test('완료에서 되돌리면 지운다', () => {
  assert.equal(nextCompletedAt('DONE', 'TODO', BEFORE, NOW), null);
});
test('상태를 보내지 않은 수정은 그대로 둔다', () => {
  assert.equal(nextCompletedAt('DONE', undefined, BEFORE, NOW), BEFORE);
});
