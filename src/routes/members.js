import { Router } from 'express';
import { load, save, newId } from '../lib/store.js';
import { validateMember } from '../lib/validate.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(load().members);
});

router.post('/', (req, res) => {
  const db = load();
  const v = validateMember(req.body, { takenNames: db.members.map((m) => m.name) });
  if (!v.ok) return res.status(400).json({ error: v.error });
  const member = { id: newId(), ...v.value };
  db.members.push(member);
  save(db);
  res.status(201).json(member);
});

router.patch('/:id', (req, res) => {
  const db = load();
  const member = db.members.find((m) => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
  const takenNames = db.members.filter((m) => m.id !== member.id).map((m) => m.name);
  const v = validateMember(req.body, { partial: true, takenNames });
  if (!v.ok) return res.status(400).json({ error: v.error });
  Object.assign(member, v.value);
  save(db);
  res.json(member);
});

export default router;
