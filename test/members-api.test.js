import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

import { createMembersRouter } from '../src/routes/members.js';

const e = (hours) => ({ hours, reason: '' });

async function withApi(run) {
  let db = {
    members: [{ id: 'm1', name: '김권섭', availableHours: 10 }, { id: 'm2', name: '박지호', availableHours: 10 }, { id: 'm3', name: '우희태', availableHours: 10 }],
    tasks: [
      // m3 만 안 낸 작업 — m3 을 지우면 공개돼야 한다
      { id: 'wait', title: '자료 조사', status: 'TODO', assigneeId: 'm3', hours: null, estimates: { m1: e(3), m2: e(5) }, estimatesRevealed: false, estimateHistory: [] },
      { id: 'other', title: '대본', status: 'TODO', assigneeId: 'm1', hours: 2, estimates: {}, estimatesRevealed: false, estimateHistory: [] },
    ],
  };
  const app = express();
  app.use(express.json());
  app.use('/api/members', createMembersRouter(() => structuredClone(db), (next) => { db = next; }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/members`;
  const del = async (id) => {
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
    return { status: res.status, body: await res.json() };
  };
  try {
    await run({ del, saved: () => db });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('없는 팀원을 지우려 하면 404 이고 저장하지 않는다', async () => {
  await withApi(async ({ del, saved }) => {
    const before = structuredClone(saved());
    const r = await del('nope');
    assert.equal(r.status, 404);
    assert.equal(r.body.error, '팀원을 찾을 수 없습니다.');
    assert.deepEqual(saved(), before);
  });
});

test('팀원을 지우면 맡은 작업은 담당 미정이 되고 다른 작업은 그대로다', async () => {
  await withApi(async ({ del, saved }) => {
    const r = await del('m3');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.unassigned, ['wait']);
    assert.deepEqual(saved().members.map((m) => m.id), ['m1', 'm2']);
    assert.equal(saved().tasks.find((t) => t.id === 'wait').assigneeId, null);
    assert.equal(saved().tasks.find((t) => t.id === 'other').assigneeId, 'm1');
  });
});

test('지운 사람만 안 냈던 작업은 그 자리에서 공개 기록과 ver 1 이 남는다', async () => {
  await withApi(async ({ del, saved }) => {
    await del('m3');
    const t = saved().tasks.find((x) => x.id === 'wait');
    assert.equal(t.estimatesRevealed, true);
    assert.equal(t.estimateHistory.length, 1);
    assert.deepEqual(t.estimateHistory[0].values, { m1: 3, m2: 5 });
  });
});

test('지운 사람이 낸 추정은 남기되 공개 값에서는 빠진다', async () => {
  await withApi(async ({ del, saved }) => {
    await del('m2');
    const t = saved().tasks.find((x) => x.id === 'wait');
    assert.equal('m2' in t.estimates, true);
    assert.equal(t.estimatesRevealed, false); // m3 이 아직 안 냄
  });
});
