import { Router } from 'express';

import { load, save } from '../lib/store.js';
import { estimateSummary, addVersion } from '../lib/estimate.js';

const router = Router();

// app.js 에서 /api 에 붙어 있다 → POST /api/tasks/:id/estimates
router.post('/tasks/:id/estimates', (req, res) => {
  const { memberId, hours, reason } = req.body ?? {};
  const db = load();
  const task = db.tasks.find((t) => t.id === req.params.id);

  if (!task) return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
  if (task.hours != null) return res.status(400).json({ error: '이미 크기가 확정된 작업입니다.' });
  if (!db.members.some((m) => m.id === memberId)) {
    return res.status(400).json({ error: '누구로 입력하는지 골라 주세요.' });
  }
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > 1000) {
    return res.status(400).json({ error: '예상 시간은 0보다 큰 숫자로 입력해 주세요.' });
  }
  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 100)) {
    return res.status(400).json({ error: '근거는 100자 이내로 적어 주세요.' });
  }

  // 공개 전에는 같은 사람이 다시 내면 조용히 덮어쓰고, 공개 뒤에는 고칠 때마다 버전이 쌓인다
  const wasRevealed = Boolean(task.estimatesRevealed);
  task.estimates = { ...task.estimates, [memberId]: { hours, reason: reason?.trim() ?? '' } };
  const summary = estimateSummary(task.estimates, memberIds(db), wasRevealed);
  // 한 번 공개되면 기록해 둔다 — 나중에 팀원이 늘어도 다시 가려지지 않게
  task.estimatesRevealed = summary.revealed;
  task.estimateHistory = addVersion(task.estimateHistory ?? [], summary, wasRevealed ? memberId : null, new Date().toISOString());
  save(db);

  res.json({ taskId: task.id, estimate: publicSummary(task, summary) });
});

// GET /api/estimates — 원본 estimates 대신 요약만 내보낸다
router.get('/estimates', (req, res) => {
  const db = load();
  const ids = memberIds(db);
  res.json(Object.fromEntries(db.tasks.map((t) =>
    [t.id, publicSummary(t, estimateSummary(t.estimates ?? {}, ids, t.estimatesRevealed))])));
});

function memberIds(db) {
  return db.members.map((m) => m.id);
}

// 공개된 작업에만 버전 기록을 붙인다
function publicSummary(task, summary) {
  return summary.revealed ? { ...summary, history: task.estimateHistory ?? [] } : summary;
}

export default router;
