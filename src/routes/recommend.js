import { Router } from 'express';

import { load } from '../lib/store.js';
import { recommend } from '../lib/load.js';
import { explainRecommendation } from '../lib/explain.js';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: '추천할 작업 또는 시간을 입력해 주세요.'
    });
  }

  const hasTaskId = Object.hasOwn(body, 'taskId');
  const hasHours = Object.hasOwn(body, 'hours');

  if (hasTaskId === hasHours) {
    return res.status(400).json({
      error: 'taskId 또는 hours 중 하나만 입력해 주세요.'
    });
  }

  if (
    hasTaskId &&
    (typeof body.taskId !== 'string' || body.taskId.trim() === '')
  ) {
    return res.status(400).json({
      error: '올바른 작업 ID를 입력해 주세요.'
    });
  }

  const db = load();

  let newHours = body.hours;
  let tasks = db.tasks;

  if (hasTaskId) {
    const task = db.tasks.find((item) => item.id === body.taskId);

    if (!task) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    if (task.hours === null) {
      return res.status(400).json({
        error: '작업 크기를 먼저 정해 주세요.'
      });
    }

    newHours = task.hours;

    // 재추천할 작업을 제외해 같은 시간을 두 번 더하지 않는다.
    tasks = db.tasks.filter((item) => item.id !== task.id);
  }

  if (
    !Number.isFinite(newHours) ||
    newHours <= 0 ||
    newHours > 1000
  ) {
    return res.status(400).json({
      error: '작업 크기는 0보다 크고 1000 이하인 숫자로 입력해 주세요.'
    });
  }

  const result = recommend(db.members, tasks, newHours);

  res.json({
    ...result,
    explanation: explainRecommendation(result)
  });
});

export default router;