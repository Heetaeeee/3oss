import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

import { createStore } from '../src/lib/store.js';
import { createRoomsRouter } from '../src/routes/rooms.js';

async function withApi(run, { enabled = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'hallae-rooms-api-'));
  const store = createStore(join(dir, 'db.json'));
  const app = express();

  // null 본문도 라우터에 전달해 입력 검사를 확인한다.
  app.use(express.json({ strict: false }));
  app.use('/api/rooms', createRoomsRouter({
    store,
    enabled: () => enabled
  }));

  let server;

  try {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const base =
      `http://127.0.0.1:${server.address().port}/api/rooms`;

    async function request(path = '', options = {}) {
      const response = await fetch(base + path, {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
      });

      return {
        status: response.status,
        body: await response.json()
      };
    }

    await run({ request, store, dir });
  } finally {
    try {
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });

          server.closeIdleConnections();
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

test('스위치가 꺼져 있으면 생성과 조회·입장·정원 수정을 차단하고 저장하지 않는다', async () => {
  await withApi(async ({ request, dir }) => {
    const created = await request('', {
      method: 'POST',
      body: { name: '테스트 방', size: 3 }
    });

    const found = await request('/ABC234');

    const joined = await request('/ABC234/join', {
      method: 'POST',
      body: { name: 'A' }
    });

    const patched = await request('/ABC234', {
      method: 'PATCH',
      headers: { 'X-Room-Code': 'ABC234' },
      body: { size: 2 }
    });

    assert.equal(created.status, 404);
    assert.equal(found.status, 404);
    assert.equal(joined.status, 404);
    assert.equal(patched.status, 404);
    assert.deepEqual(readdirSync(dir), []);
  }, { enabled: false });
});

test('방 생성은 201과 공개 정보만 반환한다', async () => {
  await withApi(async ({ request, store }) => {
    const result = await request('', {
      method: 'POST',
      body: { name: ' 테스트 방 ', size: 3 }
    });

    assert.equal(result.status, 201);
    assert.match(result.body.code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.deepEqual(
      Object.keys(result.body).sort(),
      ['code', 'name', 'size']
    );
    assert.equal(result.body.name, '테스트 방');
    assert.equal(result.body.size, 3);

    const room = store.loadRoom(result.body.code);

    assert.deepEqual(room.members, []);
    assert.deepEqual(room.tasks, []);
  });
});

test('잘못된 방 생성 요청은 400이며 저장하지 않는다', async () => {
  await withApi(async ({ request, dir }) => {
    for (const body of [
      {},
      [],
      { name: ' ', size: 3 },
      { name: '방', size: 0 },
      { name: '방', size: 1.5 },
      { name: '방', size: '3' }
    ]) {
      const result = await request('', {
        method: 'POST',
        body
      });

      assert.equal(result.status, 400);
      assert.equal(typeof result.body.error, 'string');
    }

    assert.deepEqual(readdirSync(dir), []);
  });
});

test('소문자 방 코드로 조회해도 같은 방을 찾고 내부 데이터는 반환하지 않는다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '조회 방',
      size: 3
    });

    store.saveRoom(room.code, {
      members: [
        { id: 'A', name: 'A', availableHours: 10 }
      ],
      tasks: [
        { id: 't1', title: '내부 작업' }
      ]
    });

    const result = await request(
      `/${room.code.toLowerCase()}`
    );

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      code: room.code,
      name: '조회 방',
      size: 3,
      memberCount: 1
    });
  });
});

test('형식이 잘못된 방 코드는 400이다', async () => {
  await withApi(async ({ request, dir }) => {
    const result = await request('/ABC01O');

    assert.equal(result.status, 400);
    assert.equal(
      result.body.error,
      '방 코드는 영문과 숫자 6자리로 입력해 주세요.'
    );
    assert.deepEqual(readdirSync(dir), []);
  });
});

test('형식은 맞지만 존재하지 않는 방은 404이다', async () => {
  await withApi(async ({ request, store }) => {
    store.load();

    const missing = store.loadRoom('AAAAAA') === null
      ? 'AAAAAA'
      : 'BBBBBB';

    const result = await request(`/${missing}`);

    assert.equal(result.status, 404);
    assert.equal(
      result.body.error,
      '방을 찾을 수 없습니다.'
    );
  });
});

test('방을 두 번 생성하면 서로 다른 코드로 저장한다', async () => {
  await withApi(async ({ request, store }) => {
    const first = await request('', {
      method: 'POST',
      body: { name: '첫 번째 방', size: 2 }
    });

    const second = await request('', {
      method: 'POST',
      body: { name: '두 번째 방', size: 3 }
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.code, second.body.code);

    assert.equal(
      store.loadRoom(first.body.code).name,
      '첫 번째 방'
    );
    assert.equal(
      store.loadRoom(second.body.code).name,
      '두 번째 방'
    );
  });
});

test('입장하면 서버 ID와 가능한 시간 0으로 팀원을 생성한다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '입장 방',
      size: 3
    });

    const result = await request(`/${room.code}/join`, {
      method: 'POST',
      body: {
        name: ' A ',
        id: '임의 ID',
        availableHours: 100
      }
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.name, 'A');
    assert.equal(result.body.availableHours, 0);
    assert.equal(typeof result.body.id, 'string');
    assert.notEqual(result.body.id, '임의 ID');

    const saved = store.loadRoom(room.code);

    assert.deepEqual(saved.members, [result.body]);
    assert.equal(saved.size, 3);
  });
});

test('앞뒤 공백을 제외한 중복 이름은 거부하고 저장하지 않는다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '중복 검사',
      size: 3
    });

    await request(`/${room.code}/join`, {
      method: 'POST',
      body: { name: 'A' }
    });

    const before = store.loadRoom(room.code);

    const result = await request(`/${room.code}/join`, {
      method: 'POST',
      body: { name: ' A ' }
    });

    assert.equal(result.status, 400);
    assert.equal(
      result.body.error,
      '이미 같은 이름의 팀원이 있습니다.'
    );
    assert.deepEqual(store.loadRoom(room.code), before);
  });
});

test('정원이 찬 방은 새로운 팀원 입장을 거부한다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '정원 검사',
      size: 1
    });

    await request(`/${room.code}/join`, {
      method: 'POST',
      body: { name: 'A' }
    });

    const result = await request(`/${room.code}/join`, {
      method: 'POST',
      body: { name: 'B' }
    });

    assert.equal(result.status, 400);
    assert.equal(
      result.body.error,
      '팀원 수가 다 찼습니다.'
    );
    assert.equal(
      store.loadRoom(room.code).members.length,
      1
    );
  });
});

test('잘못된 입장 이름과 본문은 거부한다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '입력 검사',
      size: 3
    });

    for (const body of [
      null,
      [],
      {},
      { name: '' },
      { name: '   ' },
      { name: '가'.repeat(21) }
    ]) {
      const result = await request(`/${room.code}/join`, {
        method: 'POST',
        body
      });

      assert.equal(result.status, 400);
    }

    assert.deepEqual(
      store.loadRoom(room.code).members,
      []
    );
  });
});

test('같은 이름도 서로 다른 방에는 각각 입장할 수 있다', async () => {
  await withApi(async ({ request, store }) => {
    const first = store.createRoom({
      name: '첫 방',
      size: 2
    });

    const second = store.createRoom({
      name: '둘째 방',
      size: 2
    });

    const a = await request(`/${first.code}/join`, {
      method: 'POST',
      body: { name: 'A' }
    });

    const b = await request(`/${second.code}/join`, {
      method: 'POST',
      body: { name: 'A' }
    });

    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.id, b.body.id);

    assert.deepEqual(
      store.loadRoom(first.code).members,
      [a.body]
    );
    assert.deepEqual(
      store.loadRoom(second.code).members,
      [b.body]
    );
  });
});

test('잘못된 코드와 존재하지 않는 방의 입장은 거부한다', async () => {
  await withApi(async ({ request, store }) => {
    store.load();

    const missing = store.loadRoom('AAAAAA') === null
      ? 'AAAAAA'
      : 'BBBBBB';

    const invalid = await request('/ABC01O/join', {
      method: 'POST',
      body: { name: 'A' }
    });

    const absent = await request(`/${missing}/join`, {
      method: 'POST',
      body: { name: 'A' }
    });

    assert.equal(invalid.status, 400);
    assert.equal(absent.status, 404);
    assert.equal(
      absent.body.error,
      '방을 찾을 수 없습니다.'
    );
  });
});

test('정원 감소로 전원 제출 조건이 채워지면 공개 기록을 남긴다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '공개 검사',
      size: 3
    });

    store.saveRoom(room.code, {
      members: [
        { id: 'A', name: 'A', availableHours: 0 },
        { id: 'B', name: 'B', availableHours: 0 }
      ],
      tasks: [{
        id: 't1',
        title: '자료 조사',
        hours: null,
        estimates: {
          A: { hours: 2, reason: '자료 확인' },
          B: { hours: 4, reason: '정리 포함' }
        },
        estimatesRevealed: false,
        estimateHistory: []
      }]
    });

    const options = {
      method: 'PATCH',
      headers: { 'X-Room-Code': room.code },
      body: { size: 2 }
    };

    const result = await request(`/${room.code}`, options);

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      code: room.code,
      name: '공개 검사',
      size: 2,
      memberCount: 2
    });

    const saved = store.loadRoom(room.code);

    assert.equal(saved.tasks[0].estimatesRevealed, true);
    assert.equal(saved.tasks[0].estimateHistory.length, 1);
    assert.equal(saved.tasks[0].estimateHistory[0].version, 1);
    assert.equal(saved.tasks[0].estimateHistory[0].median, 3);

    // 같은 정원으로 다시 요청해도 공개 기록이 중복되지 않는다.
    await request(`/${room.code}`, options);

    assert.equal(
      store.loadRoom(room.code).tasks[0].estimateHistory.length,
      1
    );
  });
});

test('정원을 늘리거나 미제출자가 남아 있으면 최초 공개하지 않는다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '대기 검사',
      size: 2
    });

    store.saveRoom(room.code, {
      members: [
        { id: 'A', name: 'A', availableHours: 0 },
        { id: 'B', name: 'B', availableHours: 0 }
      ],
      tasks: [{
        id: 't1',
        title: '자료 조사',
        hours: null,
        estimates: {
          A: { hours: 2 }
        },
        estimatesRevealed: false,
        estimateHistory: []
      }]
    });

    const headers = { 'X-Room-Code': room.code };

    const increased = await request(`/${room.code}`, {
      method: 'PATCH',
      headers,
      body: { size: 3 }
    });

    assert.equal(increased.status, 200);
    assert.equal(
      store.loadRoom(room.code).tasks[0].estimatesRevealed,
      false
    );

    const decreased = await request(`/${room.code}`, {
      method: 'PATCH',
      headers,
      body: { size: 2 }
    });

    assert.equal(decreased.status, 200);

    const task = store.loadRoom(room.code).tasks[0];

    assert.equal(task.estimatesRevealed, false);
    assert.deepEqual(task.estimateHistory, []);
  });
});

test('현재 등록 인원보다 작은 정원은 거부하고 저장하지 않는다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '정원 하한',
      size: 3
    });

    store.saveRoom(room.code, {
      members: [
        { id: 'A', name: 'A', availableHours: 0 },
        { id: 'B', name: 'B', availableHours: 0 }
      ],
      tasks: []
    });

    const before = store.loadRoom(room.code);

    const result = await request(`/${room.code}`, {
      method: 'PATCH',
      headers: { 'X-Room-Code': room.code },
      body: { size: 1 }
    });

    assert.equal(result.status, 400);
    assert.deepEqual(store.loadRoom(room.code), before);
  });
});

test('잘못된 정원 수정 본문은 거부한다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '본문 검사',
      size: 3
    });

    const before = store.loadRoom(room.code);

    for (const body of [
      null,
      [],
      {},
      { size: 0 },
      { size: -1 },
      { size: 1.5 },
      { size: '3' }
    ]) {
      const result = await request(`/${room.code}`, {
        method: 'PATCH',
        headers: { 'X-Room-Code': room.code },
        body
      });

      assert.equal(result.status, 400);
    }

    assert.deepEqual(store.loadRoom(room.code), before);
  });
});

test('정원 수정은 대상 방과 일치하는 코드 헤더가 필요하다', async () => {
  await withApi(async ({ request, store }) => {
    const room = store.createRoom({
      name: '헤더 검사',
      size: 3
    });

    const before = store.loadRoom(room.code);
    const otherCode = room.code === 'AAAAAA'
      ? 'BBBBBB'
      : 'AAAAAA';

    for (const headers of [
      {},
      { 'X-Room-Code': 'INVALID!' },
      { 'X-Room-Code': otherCode }
    ]) {
      const result = await request(`/${room.code}`, {
        method: 'PATCH',
        headers,
        body: { size: 2 }
      });

      assert.equal(result.status, 400);
    }

    assert.deepEqual(store.loadRoom(room.code), before);

    const missing = store.loadRoom('AAAAAA') === null
      ? 'AAAAAA'
      : 'BBBBBB';

    const absent = await request(`/${missing}`, {
      method: 'PATCH',
      headers: { 'X-Room-Code': missing },
      body: { size: 2 }
    });

    assert.equal(absent.status, 404);
  });
});