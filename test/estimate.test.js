import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateSummary } from '../src/lib/estimate.js';

const e = (hours, reason = "") => ({ hours, reason });

test('전원이 내기 전에는 값을 공개하지 않는다', () => {
  const s = estimateSummary({ m1: e(3) }, ['m1', 'm2']);
  assert.equal(s.revealed, false);
  assert.deepEqual(s.submittedIds, ['m1']);
  assert.equal('values' in s, false);
  assert.equal('median' in s, false);
});
test('전원이 내면 값과 중앙값을 공개한다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(4), m3: e(8) }, ['m1', 'm2', 'm3']);
  assert.equal(s.revealed, true);
  assert.deepEqual(s.values, { m1: 3, m2: 4, m3: 8 });
  assert.equal(s.median, 4);
});
test('짝수 개면 가운데 두 값의 평균', () => {
  assert.equal(estimateSummary({ m1: e(3), m2: e(4) }, ['m1', 'm2']).median, 3.5);
});
test('최댓값이 최솟값의 2배 이상이면 의견 차이가 크다', () => {
  assert.equal(estimateSummary({ m1: e(3), m2: e(6) }, ['m1', 'm2']).wideSpread, true);
});
test('차이가 2배 미만이면 wideSpread 는 false', () => {
  assert.equal(estimateSummary({ m1: e(3), m2: e(4) }, ['m1', 'm2']).wideSpread, false);
});
test('팀원이 없으면 공개하지 않는다', () => {
  assert.equal(estimateSummary({}, []).revealed, false);
});
test('팀에 없는 사람의 추정은 무시한다', () => {
  const s = estimateSummary({ m1: e(3), gone: e(99) }, ['m1']);
  assert.deepEqual(s.values, { m1: 3 });
  assert.equal(s.median, 3);
});
test("공개되면 근거도 함께 나간다", () => {
  const s = estimateSummary({ m1: e(3, "슬라이드 10장 기준"), m2: e(8) }, ["m1", "m2"]);
  assert.deepEqual(s.reasons, { m1: "슬라이드 10장 기준" });
});
test("전원이 내기 전에는 근거도 공개하지 않는다", () => {
  const s = estimateSummary({ m1: e(3, "슬라이드 10장 기준") }, ["m1", "m2"]);
  assert.equal("reasons" in s, false);
});
