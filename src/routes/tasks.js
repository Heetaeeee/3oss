import { Router } from 'express';
import { load, save, newId } from '../lib/store.js';
import { validateTask } from '../lib/validate.js';

const router = Router();

// 원본 추정값이 응답에 새면 블라인드 추정이 깨진다. 작업을 돌려줄 때는 항상 이걸 거친다.
const publicTask = ({ estimates, ...task }) => task;

const rulesFor = (db) => ({ memberIds: db.members.map((m) => m.id), taskIds: db.tasks.map((t) => t.id) });

router.get('/', (req, res) => {
  res.json(load().tasks.map(publicTask));
});

router.post('/', (req, res) => {
  const db = load();
  const v = validateTask(req.body, rulesFor(db));
  if (!v.ok) return res.status(400).json({ error: v.error });
  const task = {
    id: newId(), parentId: null, status: 'TODO', assigneeId: null, dueDate: null, hours: null,
    ...v.value, estimates: {}, createdAt: new Date().toISOString(),
  };
  db.tasks.push(task);
  save(db);
  res.status(201).json(publicTask(task));
});

router.patch('/:id', (req, res) => {
  const db = load();
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
  const v = validateTask(req.body, { partial: true, ...rulesFor(db) });
  if (!v.ok) return res.status(400).json({ error: v.error });
  if (v.value.parentId === task.id) return res.status(400).json({ error: '상위 작업을 찾을 수 없습니다.' });
  Object.assign(task, v.value);
  save(db);
  res.json(publicTask(task));
});

export default router;
