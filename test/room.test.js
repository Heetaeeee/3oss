import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeRoomCode,
  generateRoomCode,
  validateRoomInput,
  migrateLegacyData
} from '../src/lib/room.js';

test('방 코드의 앞뒤 공백과 소문자를 정리한다', () => {
  assert.equal(normalizeRoomCode(' abcd23 '), 'ABCD23');
});

test('길이가 다르거나 제외 문자가 들어간 코드는 거절한다', () => {
  for (const value of [
    null,
    123456,
    '',
    'ABC23',
    'ABCDE23',
    'ABCD01',
    'ABCDO2',
    'ABCDI2',
    'ABC 23'
  ]) {
    assert.equal(normalizeRoomCode(value), null);
  }
});

test('이미 존재하는 코드가 생성되면 다시 생성한다', () => {
  let calls = 0;

  // 첫 6회는 AAAAAA, 다음 6회는 BBBBBB를 만든다.
  const nextIndex = () => calls++ < 6 ? 0 : 1;

  assert.equal(
    generateRoomCode(['AAAAAA'], nextIndex),
    'BBBBBB'
  );
});

test('코드 충돌이 계속되면 무한 반복하지 않고 오류를 반환한다', () => {
  assert.throws(
    () => generateRoomCode(['AAAAAA'], () => 0),
    /방 코드를 생성하지 못했습니다/
  );
});

test('방 이름을 정리하고 허용한 필드만 반환한다', () => {
  assert.deepEqual(
    validateRoomInput({
      name: ' 할래말래 ',
      size: 3,
      members: ['임의의 팀원']
    }),
    {
      ok: true,
      value: {
        name: '할래말래',
        size: 3
      }
    }
  );
});

test('빈 방 이름과 50자를 넘는 이름은 거절한다', () => {
  for (const name of ['', '   ', '가'.repeat(51), null]) {
    assert.equal(validateRoomInput({ name, size: 3 }).ok, false);
  }
});

test('정원은 1 이상의 안전한 정수만 허용한다', () => {
  for (const size of [
    0,
    -1,
    1.5,
    '3',
    null,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1
  ]) {
    assert.equal(
      validateRoomInput({ name: '테스트 방', size }).ok,
      false
    );
  }

  assert.equal(
    validateRoomInput({ name: '테스트 방', size: 1 }).ok,
    true
  );
});

test('객체가 아닌 방 생성 요청은 거절한다', () => {
  for (const body of [null, [], '방 생성', 3]) {
    assert.equal(validateRoomInput(body).ok, false);
  }
});

test('기존 팀원과 작업의 모든 필드를 기본 방에 보존한다', () => {
  const db = {
    members: [
      { id: 'A', name: 'A', availableHours: 10 },
      { id: 'B', name: 'B', availableHours: 5 }
    ],
    tasks: [
      {
        id: 't1',
        title: '자료 조사',
        parentId: null,
        status: 'DONE',
        assigneeId: 'A',
        hours: 3,
        estimates: {
          A: { hours: 3, reason: '자료 3개' }
        },
        estimatesRevealed: true,
        estimateHistory: [
          {
            version: 1,
            by: null,
            values: { A: 3 },
            reasons: { A: '자료 3개' },
            median: 3,
            at: '2026-11-20T00:00:00.000Z'
          }
        ],
        completedAt: '2026-11-21T00:00:00.000Z'
      }
    ]
  };

  const before = structuredClone(db);
  const at = '2026-11-21T01:00:00.000Z';
  const result = migrateLegacyData(db, 'ABC234', at);
  const room = result.rooms.ABC234;

  assert.equal(result.schemaVersion, 1);
  assert.equal(result.defaultRoom, 'ABC234');
  assert.equal(room.size, 2);
  assert.equal(room.demo, false);
  assert.equal(room.createdAt, at);
  assert.deepEqual(room.members, db.members);
  assert.deepEqual(room.tasks, db.tasks);
  assert.deepEqual(db, before);

  // 변환 결과를 수정해도 원본 데이터는 변경되지 않는다.
  room.tasks[0].estimates.A.hours = 99;
  assert.deepEqual(db, before);
});

test('빈 기존 데이터도 정원 1명의 기본 방으로 변환한다', () => {
  const result = migrateLegacyData(
    { members: [], tasks: [] },
    'ABC234'
  );

  assert.equal(result.rooms.ABC234.size, 1);
  assert.deepEqual(result.rooms.ABC234.members, []);
  assert.deepEqual(result.rooms.ABC234.tasks, []);
});

test('잘못된 기존 데이터와 이미 변환된 구조를 다시 변환하지 않는다', () => {
  const converted = migrateLegacyData(
    { members: [], tasks: [] },
    'ABC234'
  );

  for (const db of [
    null,
    [],
    {},
    { members: {}, tasks: [] },
    { members: [], tasks: null },
    converted
  ]) {
    assert.throws(
      () => migrateLegacyData(db, 'ABC234'),
      /기존 저장 데이터 형식/
    );
  }
});

test('정규화되지 않았거나 잘못된 기본 방 코드는 거절한다', () => {
  for (const code of ['abc234', ' ABC234 ', 'ABC01O', null]) {
    assert.throws(
      () => migrateLegacyData({ members: [], tasks: [] }, code),
      /기본 방 코드/
    );
  }
});