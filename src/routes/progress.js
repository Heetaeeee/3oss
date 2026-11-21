import { Router } from 'express';
import { load } from '../lib/store.js';
import { progressPercent, doneShare } from '../lib/progress.js';

const router = Router();

router.get('/', (req, res) => {
  const { members, tasks } = load();
  const shares = members.map((m) => ({ m, s: doneShare(m.id, tasks) }));
  // 담당자가 없는 완료 작업(삭제된 팀원이 끝낸 작업 등)도 전체 시간에 들어가므로 따로 보여 준다
  const unassigned = doneShare(null, tasks);
  res.json({
    progress: progressPercent(tasks),
    doneHoursTotal: unassigned.totalHours,
    members: shares.map(({ m, s }) => ({ memberId: m.id, name: m.name, doneShare: s.percent, doneHours: s.hours })),
    unassigned: { doneShare: unassigned.percent, doneHours: unassigned.hours },
  });
});

export default router;
