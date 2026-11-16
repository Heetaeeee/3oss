import { test } from 'node:test';
import assert from 'node:assert/strict';

import { explainRecommendation } from '../src/lib/explain.js';

const candidateA = {
  memberId: 'A',
  name: 'A',
  currentLoad: 30,
  projectedLoad: 50
};

const candidateB = {
  memberId: 'B',
  name: 'B',
  currentLoad: 60,
  projectedLoad: 100
};

test('추천 대상과 다음 후보의 부담률 변화를 설명한다', () => {
  const text = explainRecommendation({
    recommendedId: 'A',
    candidates: [candidateA, candidateB],
    excluded: []
  });

  assert.match(text, /A 님이 맡으면 부담률이 30% → 50%로 가장 낮습니다/);
  assert.match(text, /B 님\(60% → 100%\)/);
});

test('후보가 한 명이면 배정 가능한 사람이 한 명임을 안내한다', () => {
  const text = explainRecommendation({
    recommendedId: 'A',
    candidates: [candidateA],
    excluded: []
  });

  assert.match(text, /A 님만 배정할 수 있습니다/);
});

test('추천 대상도 과부하이면 작업이나 일정 조정을 안내한다', () => {
  const text = explainRecommendation({
    recommendedId: 'A',
    candidates: [{ ...candidateA, projectedLoad: 120 }],
    excluded: []
  });

  assert.match(text, /100%를 넘으니/);
});

test('제외된 팀원과 이유를 설명한다', () => {
  const text = explainRecommendation({
    recommendedId: 'A',
    candidates: [candidateA],
    excluded: [
      {
        memberId: 'C',
        name: 'C',
        reason: 'NO_AVAILABLE_TIME'
      }
    ]
  });

  assert.match(text, /C 님은 가능한 시간이 0이라 제외했습니다/);
});

test('후보가 없으면 가능한 시간 입력을 안내한다', () => {
  const text = explainRecommendation({
    recommendedId: null,
    candidates: [],
    excluded: []
  });

  assert.match(text, /배정할 수 있는 팀원이 없습니다/);
});