import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';

import { createTasksRouter } from '../src/routes/tasks.js';

const task = (o) => ({ title: o.id, status: 'TODO', assigneeId: null, hours: null, dueDate: null, parentId: null, ...o });

async function withApi(run) {
  let db = {
    members: [],
    tasks: [task({ id: 'p' }), task({ id: 'c1', parentId: 'p' }), task({ id: 'g', parentId: 'c1' }), task({ id: 'other' })],
  };
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', createTasksRouter(() => structuredClone(db), (next) => { db = next; }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/tasks`;
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

test('없는 작업을 지우려 하면 404 이고 저장하지 않는다', async () => {
  await withApi(async ({ del, saved }) => {
    const before = structuredClone(saved());
    const r = await del('nope');
    assert.equal(r.status, 404);
    assert.equal(r.body.error, '작업을 찾을 수 없습니다.');
    assert.deepEqual(saved(), before);
  });
});

test('상위 작업을 지우면 세부 작업까지 지우고, 관계없는 작업은 남는다', async () => {
  await withApi(async ({ del, saved }) => {
    const r = await del('p');
    assert.equal(r.status, 200);
    assert.deepEqual([...r.body.deleted].sort(), ['c1', 'g', 'p']);
    assert.deepEqual(saved().tasks.map((t) => t.id), ['other']);
  });
});

test('세부 작업 하나를 지우면 그 작업과 그 아래만 지운다', async () => {
  await withApi(async ({ del, saved }) => {
    const r = await del('c1');
    assert.deepEqual([...r.body.deleted].sort(), ['c1', 'g']);
    assert.deepEqual(saved().tasks.map((t) => t.id), ['p', 'other']);
  });
});
