import { Router } from 'express';

import { load } from '../lib/store.js';
import { currentHours, loadPercent } from '../lib/load.js';

const router = Router();

router.get('/', (req, res) => {
  const db = load();

  const members = db.members.map((member) => {
    const hours = currentHours(member.id, db.tasks);
    const percent = loadPercent(hours, member.availableHours);

    return {
      memberId: member.id,
      name: member.name,
      load: percent,
      overloaded: percent !== null && percent > 100
    };
  });

  res.json({ members });
});

export default router;