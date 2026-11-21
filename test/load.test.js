import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  currentHours,
  loadPercent,
  recommend
} from '../src/lib/load.js';

const task = (values) => ({
  id: 't1',
  status: 'TODO',
  assigneeId: null,
  hours: null,
  ...values
});

test('완료된 작업과 미확정 작업은 현재 작업량에서 제외한다', () => {
  const tasks = [
    task({ assigneeId: 'A', hours: 3 }),
    task({ assigneeId: 'A', hours: 4, status: 'DONE' }),
    task({ assigneeId: 'A', hours: null }),
    task({ assigneeId: 'B', hours: 5 })
  ];

  assert.equal(currentHours('A', tasks), 3);
});

test('맡은 작업이 없으면 현재 작업량은 0이다', () => {
  assert.equal(currentHours('A', []), 0);
});

test('부담률을 계산하고 정수로 반올림한다', () => {
  assert.equal(loadPercent(6, 10), 60);
  assert.equal(loadPercent(1, 3), 33);
});

test('과부하이면 부담률이 100%를 넘는다', () => {
  assert.equal(loadPercent(12, 10), 120);
});

test('가능한 시간이 0이면 부담률은 null이다', () => {
  assert.equal(loadPercent(5, 0), null);
});

const members = [
  { id: 'A', name: 'A', availableHours: 10 },
  { id: 'B', name: 'B', availableHours: 10 },
  { id: 'C', name: 'C', availableHours: 0 }
];

test('배정 후 예상 부담률이 가장 낮은 팀원을 추천한다', () => {
  const tasks = [
    task({ assigneeId: 'A', hours: 6 }),
    task({ assigneeId: 'B', hours: 3 })
  ];

  const result = recommend(members, tasks, 2);

  assert.equal(result.recommendedId, 'B');

  assert.deepEqual(
    result.candidates.map((candidate) => [
      candidate.memberId,
      candidate.currentLoad,
      candidate.projectedLoad
    ]),
    [
      ['B', 30, 50],
      ['A', 60, 80]
    ]
  );
});

test('가능한 시간이 0인 팀원은 추천에서 제외한다', () => {
  const result = recommend(members, [], 2);

  assert.deepEqual(result.excluded, [
    {
      memberId: 'C',
      name: 'C',
      reason: 'NO_AVAILABLE_TIME'
    }
  ]);

  assert.ok(
    !result.candidates.some((candidate) => candidate.memberId === 'C')
  );
});

test('예상·현재 부담률이 모두 같으면 등록 순서를 따른다', () => {
  const result = recommend(members, [], 2);

  assert.equal(result.recommendedId, 'A');
});

test('예상 부담률이 같으면 현재 부담률이 낮은 팀원을 추천한다', () => {
  const team = [
    { id: 'B', name: 'B', availableHours: 20 },
    { id: 'A', name: 'A', availableHours: 10 }
  ];

  const tasks = [
    task({ assigneeId: 'B', hours: 6 }),
    task({ assigneeId: 'A', hours: 2 })
  ];

  // B: 30% → 40%, A: 20% → 40%
  const result = recommend(team, tasks, 2);

  assert.equal(result.recommendedId, 'A');
});

test('배정 가능한 팀원이 없으면 추천은 null이다', () => {
  const result = recommend([members[2]], [], 2);

  assert.equal(result.recommendedId, null);
  assert.deepEqual(result.candidates, []);
});

test('표시 부담률이 같아도 반올림 전 예상 비율이 낮은 팀원을 추천한다', () => {
  const team = [
    { id: 'A', name: 'A', availableHours: 10 },
    { id: 'B', name: 'B', availableHours: 20 }
  ];

  const tasks = [
    task({ assigneeId: 'A', hours: 4.04 }),
    task({ assigneeId: 'B', hours: 9.02 })
  ];

  // A: 40.4% → 50.4%
  // B: 45.1% → 50.1%
  // 표시값은 둘 다 50%지만 B를 먼저 추천해야 한다.
  const result = recommend(team, tasks, 1);

  assert.equal(result.recommendedId, 'B');
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.projectedLoad),
    [50, 50]
  );
});

test('상위 작업 6시간과 세부 작업 4시간 중 세부 작업만 부담률에 반영한다', () => {
  const tasks = [
    task({
      id: 'parent',
      assigneeId: 'A',
      hours: 6
    }),
    task({
      id: 'child',
      parentId: 'parent',
      assigneeId: 'A',
      hours: 4
    })
  ];

  const hours = currentHours('A', tasks);

  assert.equal(hours, 4);
  assert.equal(loadPercent(hours, 10), 40);
});