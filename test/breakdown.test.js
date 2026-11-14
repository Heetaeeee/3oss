import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSubtasks } from '../src/lib/breakdown.js';

test('JSON 배열을 제목 배열로 읽는다', () => {
  assert.deepEqual(parseSubtasks('["발표 자료 제작","발표 대본 작성"]', '발표 준비'),
    ['발표 자료 제작', '발표 대본 작성']);
});
test('앞뒤 설명과 코드 펜스를 무시한다', () => {
  assert.deepEqual(parseSubtasks('네, 제안합니다.\n```json\n["자료 조사"]\n```', '보고서'),
    ['자료 조사']);
});
test('JSON이 아니면 빈 배열', () => {
  assert.deepEqual(parseSubtasks('죄송합니다', '보고서'), []);
});
test('배열이 아니면 빈 배열', () => {
  assert.deepEqual(parseSubtasks('{"a":1}', '보고서'), []);
});
test('문자열이 아닌 원소는 버린다', () => {
  assert.deepEqual(parseSubtasks('["자료 조사", 3, null]', '보고서'), ['자료 조사']);
});
test('번호와 공백을 떼어낸다', () => {
  assert.deepEqual(parseSubtasks('["1. 자료 조사 ", "- 초안 작성"]', '보고서'),
    ['자료 조사', '초안 작성']);
});
test('빈 문자열과 40자 초과는 버린다', () => {
  assert.deepEqual(parseSubtasks(JSON.stringify(['', '가'.repeat(41), '초안 작성']), '보고서'),
    ['초안 작성']);
});
test('중복과 상위 작업 제목은 버린다', () => {
  assert.deepEqual(parseSubtasks('["보고서","초안 작성","초안 작성"]', '보고서'), ['초안 작성']);
});
test('7개까지만 남긴다', () => {
  const raw = JSON.stringify(Array.from({ length: 10 }, (_, i) => `작업 ${i}`));
  assert.equal(parseSubtasks(raw, '보고서').length, 7);
});
