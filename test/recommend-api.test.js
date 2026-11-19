import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

import { createRecommendRouter } from '../src/routes/recommend.js';

function sampleDb() {
  return {
    members: [
      { id: 'A', name: 'A', availableHours: 10 },
      { id: 'B', name: 'B', availableHours: 10 }
    ],
    tasks: [
      {
        id: 't1',
        title: '자료 조사',
        hours: 6,
        status: 'TODO',
        assigneeId: 'A'
      },
      {
        id: 't2',
        title: '대본 작성',
        hours: 3,
        status: 'TODO',
        assigneeId: 'B'
      },
      {
        id: 't3',
        title: '발표 연습',
        hours: null,
        status: 'TODO',
        assigneeId: null
      },
      {
        id: 't4',
        title: '완료 작업',
        hours: 2,
        status: 'DONE',
        assigneeId: 'A'
      }
    ]
  };
}

async function withApi(run) {
  const db = sampleDb();
  const app = express();

  app.use(express.json());
  app.use('/api/recommend', createRecommendRouter(() => db));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const url =
    `http://127.0.0.1:${server.address().port}/api/recommend`;

  async function post(body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return {
      status: response.status,
      body: await response.json()
    };
  }

  try {
    await run({ db, post });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeIdleConnections();
    });
  }
}

test('taskId와 hours를 함께 보내면 400이다', async () => {
  await withApi(async ({ post }) => {
    const result = await post({ taskId: 't1', hours: 2 });

    assert.equal(result.status, 400);
    assert.equal(
      result.body.error,
      'taskId 또는 hours 중 하나만 입력해 주세요.'
    );
  });
});

test('없는 작업을 추천하면 404이다', async () => {
  await withApi(async ({ post }) => {
    const result = await post({ taskId: 'missing' });

    assert.equal(result.status, 404);
    assert.equal(result.body.error, '작업을 찾을 수 없습니다.');
  });
});

test('시간 미확정 작업을 추천하면 400이다', async () => {
  await withApi(async ({ post }) => {
    const result = await post({ taskId: 't3' });

    assert.equal(result.status, 400);
    assert.equal(result.body.error, '작업 크기를 먼저 정해 주세요.');
  });
});

test('완료된 작업을 추천하면 400이다', async () => {
  await withApi(async ({ post }) => {
    const result = await post({ taskId: 't4' });

    assert.equal(result.status, 400);
    assert.equal(
      result.body.error,
      '완료된 작업은 담당자 추천 대상이 아닙니다.'
    );
  });
});

test('기존 작업 추천 시 대상 작업의 시간을 중복 계산하지 않는다', async () => {
  await withApi(async ({ post }) => {
    const result = await post({ taskId: 't1' });

    assert.equal(result.status, 200);
    assert.equal(result.body.recommendedId, 'A');

    const candidate = result.body.candidates.find(
      (item) => item.memberId === 'A'
    );

    assert.equal(candidate.currentLoad, 0);
    assert.equal(candidate.projectedLoad, 60);
  });
});

test('새 작업 시간을 보내면 예상 부담률이 낮은 팀원을 추천한다', async () => {
  await withApi(async ({ post }) => {
    const result = await post({ hours: 2 });

    assert.equal(result.status, 200);
    assert.equal(result.body.recommendedId, 'B');
  });
});

test('추천 요청은 작업 데이터와 담당자를 변경하지 않는다', async () => {
  await withApi(async ({ db, post }) => {
    const before = structuredClone(db);

    const result = await post({ taskId: 't1' });

    assert.equal(result.status, 200);
    assert.deepEqual(db, before);
  });
});