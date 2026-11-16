import { Router } from 'express';
import { load, save, newId } from '../lib/store.js';
import { validateNewTask, validateTaskPatch } from '../lib/validate.js';

const router = Router();

// 원본 추정값이 응답에 새면 블라인드 추정이 깨진다. 작업을 돌려줄 때는 항상 이걸 거친다.
const publicTask = ({ estimates, estimateHistory, ...task }) => task;

router.get('/', (req, res) => {
  res.json(load().tasks.map(publicTask));
});

router.post('/', (req, res) => {
  const db = load();
  const v = validateNewTask(req.body, { taskIds: db.tasks.map((t) => t.id) });
  if (!v.ok) return res.status(400).json({ error: v.error });
  const task = {
    id: newId(), parentId: null, status: 'TODO', assigneeId: null, dueDate: null, hours: null,
    ...v.value, estimates: {}, createdAt: new Date().toISOString(), completedAt: null,
  };
  db.tasks.push(task);
  save(db);
  res.status(201).json(publicTask(task));
});

router.patch('/:id', (req, res) => {
  const db = load();
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
  const v = validateTaskPatch(req.body, { memberIds: db.members.map((m) => m.id) });
  if (!v.ok) return res.status(400).json({ error: v.error });
  // 주차별 수행률 · 지난주 요약용. 완료로 바뀔 때만 기록하고, 되돌리면 지운다
  if ('status' in v.value && v.value.status !== task.status) {
    task.completedAt = v.value.status === 'DONE' ? new Date().toISOString() : null;
  }
  Object.assign(task, v.value);
  save(db);
  res.json(publicTask(task));
});

export default router;
