import { Router } from 'express';
import { load, save, newId } from '../lib/store.js';
import { validateNewTask, validateTaskPatch } from '../lib/validate.js';
import { nextCompletedAt, withDescendants } from '../lib/progress.js';

// 원본 추정값이 응답에 새면 블라인드 추정이 깨진다. 작업을 돌려줄 때는 항상 이걸 거친다.
const publicTask = ({ estimates, estimateHistory, ...task }) => task;

// 테스트는 메모리 데이터를 넘긴다 (recommend.js 와 같은 방식)
export function createTasksRouter(loadDb = load, saveDb = save) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(loadDb().tasks.map(publicTask));
  });

  router.post('/', (req, res) => {
    const db = loadDb();
    const v = validateNewTask(req.body, { taskIds: db.tasks.map((t) => t.id) });
    if (!v.ok) return res.status(400).json({ error: v.error });
    const task = {
      id: newId(), parentId: null, status: 'TODO', assigneeId: null, dueDate: null, hours: null,
      ...v.value, estimates: {}, createdAt: new Date().toISOString(), completedAt: null,
    };
    db.tasks.push(task);
    saveDb(db);
    res.status(201).json(publicTask(task));
  });

  router.patch('/:id', (req, res) => {
    const db = loadDb();
    const task = db.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
    const v = validateTaskPatch(req.body, { memberIds: db.members.map((m) => m.id), revealed: Boolean(task.estimatesRevealed) });
    if (!v.ok) return res.status(400).json({ error: v.error });
    // 주차별 수행률 · 지난주 요약용
    task.completedAt = nextCompletedAt(task.status, v.value.status, task.completedAt, new Date().toISOString());
    Object.assign(task, v.value);
    saveDb(db);
    res.json(publicTask(task));
  });

  // 상위 작업을 지우면 세부 작업도 함께 지운다. 남겨 두면 parentId 가 없는 작업을 가리킨다
  router.delete('/:id', (req, res) => {
    const db = loadDb();
    if (!db.tasks.some((t) => t.id === req.params.id)) return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
    const ids = withDescendants(req.params.id, db.tasks);
    db.tasks = db.tasks.filter((t) => !ids.has(t.id));
    saveDb(db);
    res.json({ deleted: [...ids] });
  });

  return router;
}

export default createTasksRouter();
