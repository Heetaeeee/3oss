import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateSummary, addVersion } from '../src/lib/estimate.js';

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
test('한 번 공개된 뒤에는 새 팀원이 들어와도 공개를 유지한다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(4) }, ['m1', 'm2', 'm3'], true);
  assert.equal(s.revealed, true);
  assert.deepEqual(s.submittedIds, ['m1', 'm2']);
  assert.deepEqual(s.values, { m1: 3, m2: 4 });
  assert.equal(s.median, 3.5);
});
test('공개된 뒤 새 팀원이 내면 바로 반영한다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(4), m3: e(8, '디자인 포함') }, ['m1', 'm2', 'm3'], true);
  assert.deepEqual(s.values, { m1: 3, m2: 4, m3: 8 });
  assert.deepEqual(s.reasons, { m3: '디자인 포함' });
  assert.equal(s.median, 4);
  assert.equal(s.wideSpread, true);
});
test("전원이 내기 전에는 근거도 공개하지 않는다", () => {
  const s = estimateSummary({ m1: e(3, "슬라이드 10장 기준") }, ["m1", "m2"]);
  assert.equal("reasons" in s, false);
});
test('공개되지 않았으면 버전을 남기지 않는다', () => {
  const s = estimateSummary({ m1: e(3) }, ['m1', 'm2']);
  assert.deepEqual(addVersion([], s, 'm1', 'T1'), []);
});
test('처음 공개되면 ver 1 로 전원의 처음 값을 남긴다', () => {
  const s = estimateSummary({ m1: e(3), m2: e(8, '디자인 포함') }, ['m1', 'm2']);
  assert.deepEqual(addVersion([], s, null, 'T1'), [
    { version: 1, by: null, at: 'T1', values: { m1: 3, m2: 8 }, reasons: { m2: '디자인 포함' }, median: 5.5 },
  ]);
});
test('공개 뒤 수정하면 앞 버전을 두고 수정한 사람의 버전을 쌓는다', () => {
  const v1 = addVersion([], estimateSummary({ m1: e(3), m2: e(8) }, ['m1', 'm2']), null, 'T1');
  const v2 = addVersion(v1, estimateSummary({ m1: e(6), m2: e(8) }, ['m1', 'm2'], true), 'm1', 'T2');
  const v3 = addVersion(v2, estimateSummary({ m1: e(6), m2: e(6) }, ['m1', 'm2'], true), 'm2', 'T3');
  assert.deepEqual(v3.map((v) => [v.version, v.by, v.median]), [[1, null, 5.5], [2, 'm1', 7], [3, 'm2', 6]]);
  assert.deepEqual(v3[0].values, { m1: 3, m2: 8 });
});
test('공개 뒤 같은 값을 다시 내면 버전을 쌓지 않는다', () => {
  const v1 = addVersion([], estimateSummary({ m1: e(3), m2: e(8) }, ['m1', 'm2']), null, 'T1');
  assert.equal(addVersion(v1, estimateSummary({ m1: e(3), m2: e(8) }, ['m1', 'm2'], true), 'm2', 'T2'), v1);
});
