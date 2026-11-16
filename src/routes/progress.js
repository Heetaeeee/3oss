import { Router } from 'express';
import { load } from '../lib/store.js';
import { progressPercent, doneShare } from '../lib/progress.js';

const router = Router();

router.get('/', (req, res) => {
  const { members, tasks } = load();
  const shares = members.map((m) => ({ m, s: doneShare(m.id, tasks) }));
  res.json({
    progress: progressPercent(tasks),
    doneHoursTotal: doneShare(null, tasks).totalHours,
    members: shares.map(({ m, s }) => ({ memberId: m.id, name: m.name, doneShare: s.percent, doneHours: s.hours })),
  });
});

export default router;
